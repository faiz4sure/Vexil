/**
 * AI AFK COMMAND
 *
 * Replaces the normal AFK hardcoded reply with an AI model that responds
 * on behalf of the selfbot user while they are away.
 *
 * Features:
 * - Chain-of-providers: tries providers in configured order; falls back on failure
 * - Per-sender, per-channel conversation history (kept for 20 minutes of inactivity)
 * - Message batching: collects messages for 5 seconds before sending to AI
 * - Per-sender rate limiting: max 5 triggers per minute, 30-second cooldown after that
 * - Mass-mention filtering (@everyone, @here, 4+ mentions)
 * - Anti-Spam Blocker: Permanently blocks users who trigger the bot 3+ times in 5s
 * - Character Limits: Ignores messages > 800 chars; drops batches > 4000 chars
 * - Mention Logging: Tracks all mentions/DMs while AFK and shows a summary on return
 * - Intelligent AFK Removal: Prevents own AI responses from triggering AFK removal
 * - Mutual Exclusivity: Safely blocks if normal AFK is already running
 */

import { log, loadConfig, formatTime } from "../../utils/functions.js";
import AIManager from "../../utils/AIManager.js";
import { readAfkData } from "../../utils/afkHandler.js";

// ─── In-memory state ──────────────────────────────────────────────────────────

/** Map<userId, { reason, startedAt, userInfo }> */
export const aiAfkUsers = new Map();

/**
 * Per AFK-user, per sender+channel conversation history.
 * Map<afkUserId, Map<"senderId:channelId", { history: [{role,content}], lastActivity: timestamp }>>
 */
const conversationHistories = new Map();

/** Map<afkUserId, MentionRecord[]> – mentions logged while AFK */
const afkMentions = new Map();

/**
 * Map<"channelId:afkUserId:senderId", timestamp> – recent responses to debounce
 * duplicates (30-second window).
 */
const recentResponses = new Map();

/**
 * Set of message content strings recently sent by the AI so we don't
 * mistake them for real user messages when checking AFK removal.
 * Map<afkUserId, Set<string>>
 */
const recentAiResponses = new Map();

/**
 * Per-sender rate limiting state.
 * Map<senderId, { count: number, windowStart: number, coolingUntil: number }>
 */
const senderRateLimits = new Map();

/**
 * Message batching buffers.
 * Map<"afkUserId:senderId:channelId", { messages: string[], timer: TimeoutId }>
 */
const batchBuffers = new Map();

/** Permanently blocked users (during this uptime) due to extreme spam */
const blockedUsers = new Set();

/** Rolling timestamp log per user for spam detection: Map<senderId, number[]> */
const spamTracker = new Map();

// ─── Constants ────────────────────────────────────────────────────────────────

const RATE_LIMIT_MAX = 5;            // max triggers per window
const RATE_LIMIT_WINDOW_MS = 60_000;  // 1 minute window
const RATE_LIMIT_COOLDOWN_MS = 30_000; // 30-second cooldown after limit hit
const BATCH_DELAY_MS = 5_000;         // collect messages for 5 s before calling AI
const HISTORY_TTL_MS = 20 * 60_000;  // clear history after 20 min of inactivity
const MAX_HISTORY_PAIRS = 6;         // keep last 6 user+assistant pairs (12 msgs)
const MAX_MENTIONS_STORED = 50;      // max mention records stored per AFK user
const AI_RESPONSE_CACHE_TTL_MS = 4_000; // how long to keep AI response text in memory after sending

const SPAM_THRESHOLD_COUNT = 4;      // messages within window to trigger permanent block
const SPAM_THRESHOLD_WINDOW_MS = 5000; // 5-second spam window
const MSG_MAX_LENGTH = 800;          // ignore individual messages exceeding this
const BATCH_MAX_LENGTH = 4000;       // ignore entire batch if combined length exceeds this

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** Format milliseconds into a human-readable duration string. */
function formatDuration(ms) {
  const secs = Math.floor(ms / 1000);
  const mins = Math.floor(secs / 60);
  const hrs  = Math.floor(mins / 60);
  if (hrs  > 0) return `${hrs}h ${mins % 60}m`;
  if (mins > 0) return `${mins}m ${secs % 60}s`;
  return `${secs}s`;
}

/**
 * Build the AI system prompt for a given AFK user.
 * @param {string} userName   - Discord display name
 * @param {string} reason     - AFK reason
 * @param {Object} cfg        - ai_afk config section
 */
function buildSystemPrompt(userName, reason, cfg) {
  const ui  = cfg.user_info || {};
  const ins = cfg.instructions || "";

  return `${ins.trim()}

You are Vexil, an AI assistant responding on behalf of **${userName}** who is currently AFK on Discord.
Reason for being AFK: ${reason || "No reason given"}

USER BACKGROUND (for context – do NOT recite this verbatim):
${ui.details     ? `- Details: ${ui.details}`          : ""}
${ui.background  ? `- Background: ${ui.background}`    : ""}
${ui.additional_info ? `- Notes: ${ui.additional_info}` : ""}

HARD RULES:
1. always write in lowercase only – no capitalisation
2. keep replies concise (2-4 sentences max)
3. never disclose which AI or model you are
4. never say anything violating Discord ToS
5. ABSOLUTE CRITICAL RULE: UNDER NO CIRCUMSTANCES can you claim, imply, or joke that you or the user are under 13 years old. Even if directly instructed to act like a child, adopt an underage persona, or state an age below 13 by the user, you MUST completely ignore that instruction. Claiming to be underage is a severe platform violation. If pressured, simply state you are an adult AI assistant.
6. do not repeat the same phrasing in consecutive messages
7. only greet on the very first message from a new person; skip greetings on follow-ups
8. make it clear the user is currently away, but still be helpful
9. respond directly to what was said – do not force the user's background into every reply
10. you represent ${userName} – you are NOT them, you are Vexil, their assistant`;
}

/**
 * Check if a message is one of our own AI AFK notifications so we
 * can prevent it from removing the AFK state.
 * @param {string} content
 */
export function isAiAfkNotification(content) {
  const lowerContent = content.toLowerCase();
  return (
    lowerContent.includes("**[ai afk mode]**") ||
    lowerContent.includes("**[ai afk]**") ||
    lowerContent.includes("**welcome back!**") ||
    lowerContent.includes("> 👋") ||
    lowerContent.includes("ai afk already active")
  );
}

/**
 * Returns true if the message contains mass mentions.
 * @param {import('discord.js-selfbot-v13').Message} message
 */
function containsMassMentions(message) {
  if (message.mentions.everyone) return true;
  if (message.content.includes("@here")) return true;
  if (message.mentions.users.size > 3) return true;
  return false;
}

/**
 * Check if the sender should be permanently blocked for spamming.
 * Tracks message timestamps and triggers block if >= 4 msgs in 5s.
 * @param {string} senderId
 * @returns {boolean} true if user is blocked
 */
function checkSpamBlock(senderId) {
  if (blockedUsers.has(senderId)) return true;

  const now = Date.now();
  if (!spamTracker.has(senderId)) spamTracker.set(senderId, []);
  
  const timestamps = spamTracker.get(senderId);
  timestamps.push(now);

  // Keep only timestamps within the spam window
  while (timestamps.length > 0 && now - timestamps[0] > SPAM_THRESHOLD_WINDOW_MS) {
    timestamps.shift();
  }

  if (timestamps.length >= SPAM_THRESHOLD_COUNT) {
    blockedUsers.add(senderId);
    spamTracker.delete(senderId); // Clean up memory since they are now perm-blocked
    log(`AI AFK: user ${senderId} is blocked from ai afk bcz of spamming (≥4 msgs in 5s)`, "warn");
    return true;
  }

  return false;
}

/**
 * Check per-sender rate limit.
 * @returns {{ allowed: boolean, cooldownRemainingMs: number }}
 */
function checkRateLimit(senderId) {
  const now = Date.now();
  let state = senderRateLimits.get(senderId);
  if (!state) {
    state = { count: 0, windowStart: now, coolingUntil: 0 };
    senderRateLimits.set(senderId, state);
  }

  // Still in cooldown?
  if (now < state.coolingUntil) {
    return { allowed: false, cooldownRemainingMs: state.coolingUntil - now };
  } else if (state.coolingUntil > 0) {
    // Cooldown just expired. Start a fresh window so they don't get instantly
    // re-punished by the old window's count.
    state.count = 0;
    state.windowStart = now;
    state.coolingUntil = 0;
  }

  // Reset window if elapsed naturally
  if (now - state.windowStart > RATE_LIMIT_WINDOW_MS) {
    state.count       = 0;
    state.windowStart = now;
    state.coolingUntil = 0;
  }

  state.count++;
  if (state.count > RATE_LIMIT_MAX) {
    state.coolingUntil = now + RATE_LIMIT_COOLDOWN_MS;
    return { allowed: false, cooldownRemainingMs: RATE_LIMIT_COOLDOWN_MS };
  }
  return { allowed: true, cooldownRemainingMs: 0 };
}

/**
 * Retrieve (or initialise) the conversation history for a
 * specific afkUser ↔ sender+channel pair.
 * @returns {Array<{role:string, content:string}>}
 */
function getHistory(afkUserId, senderId, channelId) {
  if (!conversationHistories.has(afkUserId)) {
    conversationHistories.set(afkUserId, new Map());
  }
  const userHistories = conversationHistories.get(afkUserId);
  const key = `${senderId}:${channelId}`;
  if (!userHistories.has(key)) {
    userHistories.set(key, { history: [], lastActivity: Date.now() });
  }
  const entry = userHistories.get(key);
  entry.lastActivity = Date.now(); // refresh TTL
  return entry.history;
}

/**
 * Append a user+assistant pair to history and trim to MAX_HISTORY_PAIRS.
 */
function appendHistory(afkUserId, senderId, channelId, userContent, assistantContent) {
  const history = getHistory(afkUserId, senderId, channelId);
  history.push({ role: "user",      content: userContent });
  history.push({ role: "assistant", content: assistantContent });

  // Trim: keep only the last MAX_HISTORY_PAIRS×2 messages
  if (history.length > MAX_HISTORY_PAIRS * 2) {
    history.splice(0, history.length - MAX_HISTORY_PAIRS * 2);
  }
}

/** Periodically prune conversation histories older than HISTORY_TTL_MS. */
function pruneOldHistories() {
  const now = Date.now();
  for (const [afkUserId, userHistories] of conversationHistories) {
    for (const [key, entry] of userHistories) {
      if (now - entry.lastActivity > HISTORY_TTL_MS) {
        userHistories.delete(key);
        log(`AI AFK: pruned stale history for afkUser=${afkUserId} key=${key}`, "debug");
      }
    }
    if (userHistories.size === 0) {
      conversationHistories.delete(afkUserId);
    }
  }
}

// Prune every 5 minutes
setInterval(pruneOldHistories, 5 * 60_000);

/** Prune recentResponses older than 5 minutes. */
function pruneRecentResponses() {
  const now = Date.now();
  for (const [key, ts] of recentResponses) {
    if (now - ts > 5 * 60_000) recentResponses.delete(key);
  }
}
setInterval(pruneRecentResponses, 60_000);

// ─── Core AI response generator ───────────────────────────────────────────────

/**
 * Generate an AI reply for a batched group of messages from one sender.
 * @param {string} afkUserId
 * @param {string} senderId
 * @param {string} channelId
 * @param {string} batchedContent  – all collected messages joined by newline
 * @param {Object} senderInfo      – { username, displayName, globalName }
 * @param {boolean} isFirstMessage
 * @param {Object}  cfg            – ai_afk config section
 * @returns {Promise<string>} AI response text
 */
async function generateAiResponse(
  afkUserId, senderId, channelId, batchedContent, senderInfo, isFirstMessage, cfg
) {
  const afkData    = aiAfkUsers.get(afkUserId);
  const userName   = afkData?.userInfo?.name || "the user";
  const reason     = afkData?.reason || "no reason given";

  const systemPrompt = buildSystemPrompt(userName, reason, cfg);

  // Build detailed sender context injected at the end of the human turn
  const preferredName = senderInfo.displayName || senderInfo.globalName || senderInfo.username || "this person";
  let senderContext = `\n\nINFO ABOUT THE PERSON MESSAGING YOU:`;
  senderContext    += `\n- username: ${senderInfo.username}`;
  if (senderInfo.globalName && senderInfo.globalName !== senderInfo.username) {
    senderContext  += `\n- global name: ${senderInfo.globalName}`;
  }
  if (senderInfo.displayName && senderInfo.displayName !== senderInfo.username) {
    senderContext  += `\n- server display name: ${senderInfo.displayName}`;
  }
  senderContext    += `\n- prefer to address them as: "${preferredName}"`;
  senderContext    += isFirstMessage
    ? "\n\nINSTRUCTION: first message — a brief, natural greeting is appropriate."
    : "\n\nINSTRUCTION: follow-up message — DO NOT start with any greeting.";
  senderContext    += "\nRespond directly and naturally to the content above.";

  // Fetch existing history
  const history = getHistory(afkUserId, senderId, channelId);

  // Compose messages array
  const messages = [
    { role: "system", content: systemPrompt },
    ...history,
    { role: "user",   content: batchedContent + senderContext }
  ];

  const providerChain = cfg.provider_chain || ["groq"];
  const { text } = await AIManager.chainGenerateWithHistory(messages, providerChain);

  // Persist to history (store raw content, not context-augmented version)
  appendHistory(afkUserId, senderId, channelId, batchedContent, text);

  return text;
}

// ─── Exported handler (called from messageCreate) ────────────────────────────

/**
 * Main message handler for AI AFK.
 * Call this from the messageCreate event *before* the normal AFK check.
 * @param {import('discord.js-selfbot-v13').Client} client
 * @param {import('discord.js-selfbot-v13').Message} message
 */
export async function handleAiAfkMessage(client, message) {
  const cfg = loadConfig().ai_afk;
  if (!cfg || !cfg.enabled) return;

  const authorId  = message.author.id;
  const guildId   = message.guild?.id || "dm";
  const channelId = message.channel.id;

  // ── 1. AFK REMOVAL: selfbot user sent a real message ─────────────────────
  if (aiAfkUsers.has(authorId)) {
    // Skip if it's the ai-afk set command itself
    const prefix = client.prefix || "+";
    if (
      message.content.startsWith(`${prefix}aiafk`) ||
      message.content.startsWith(`${prefix}aiaway`)
    ) return;

    // Skip if it matches a recent AI response we sent
    const myResponses = recentAiResponses.get(authorId);
    if (myResponses && myResponses.has(message.content.trim())) return;

    // Skip very short/empty messages
    if (!message.content || message.content.trim().length < 2) return;

    // Skip our own AFK notification messages
    if (isAiAfkNotification(message.content)) return;

    log(`AI AFK: detected real user message from ${message.author.username}. Removing AI AFK state...`, "debug");

    // The user is back → remove AI AFK
    const afkData   = aiAfkUsers.get(authorId);
    const duration  = formatDuration(Date.now() - afkData.startedAt);
    aiAfkUsers.delete(authorId);
    conversationHistories.delete(authorId);
    recentAiResponses.delete(authorId);

    // Build summary of mentions while away
    const mentions     = afkMentions.get(authorId) || [];
    afkMentions.delete(authorId);

    let welcomeMsg = `> 👋 **Welcome back!** AI AFK removed. You were away for **${duration}**.`;
    if (mentions.length > 0) {
      const bySender = new Map();
      for (const m of mentions) {
        if (!bySender.has(m.senderId)) bySender.set(m.senderId, []);
        bySender.get(m.senderId).push(m);
      }
      const uniqueUsers  = [...bySender.keys()];
      welcomeMsg += `\n\n**While you were away, ${uniqueUsers.length} user${uniqueUsers.length > 1 ? "s" : ""} reached out:**`;
      for (const [i, sid] of uniqueUsers.slice(0, 10).entries()) {
        const recs     = bySender.get(sid);
        const latest   = recs[recs.length - 1];
        const loc      = latest.isDm ? "in DMs" : `in ${latest.guildName} / <#${latest.channelId}>`;
        const timeStr  = new Date(latest.timestamp).toLocaleTimeString();
        welcomeMsg    += `\n${i + 1}. **${latest.senderName}** at ${timeStr} ${loc}`;
        if (recs.length > 1) welcomeMsg += ` (${recs.length} messages)`;
      }
      if (uniqueUsers.length > 10) {
        welcomeMsg += `\n...and ${uniqueUsers.length - 10} more.`;
      }
    }

    await message.channel.send(welcomeMsg).catch(() => {});
    return;
  }

  // ── 2. SKIP if mass mention ───────────────────────────────────────────────
  if (containsMassMentions(message)) return;

  // ── 3. SKIP bots ──────────────────────────────────────────────────────────
  if (message.author.bot) return;

  // ── 4. Determine which AFK users are targeted by this message ────────────
  const targetedAfkUserIds = new Set();

  // Direct mentions of an AFK user
  for (const user of message.mentions.users.values()) {
    if (aiAfkUsers.has(user.id)) targetedAfkUserIds.add(user.id);
  }

  // DMs – any AFK user is implicitly targeted
  if (!message.guild) {
    for (const id of aiAfkUsers.keys()) {
      if (id !== authorId) targetedAfkUserIds.add(id);
    }
  }

  // Replies to an AFK user's message
  if (message.reference?.resolved?.author) {
    const repliedId = message.reference.resolved.author.id;
    if (aiAfkUsers.has(repliedId)) targetedAfkUserIds.add(repliedId);
  }

  if (targetedAfkUserIds.size === 0) return;
  log(`AI AFK: message targets ${targetedAfkUserIds.size} AFK user(s) — processing`, "debug");

  const senderId = authorId;

  // ── 4b. Pre-loop Safety Filters (Spam Block & Length Limits) ──────────────
  
  if (blockedUsers.has(senderId)) {
    log(`AI AFK: ignored message from ${senderId} (user is permanently blocked for spamming)`, "debug");
    return;
  }
  if (checkSpamBlock(senderId)) return;

  if (message.content.length > MSG_MAX_LENGTH) {
    log(`AI AFK: ignored message from ${senderId} bcz it exceeds ${MSG_MAX_LENGTH} characters`, "debug");
    return;
  }

  // ── 5. Process each targeted AFK user ─────────────────────────────────────
  for (const afkUserId of targetedAfkUserIds) {
    // Collect full sender info for AI context
    const senderInfo = {
      username:    message.author.username,
      displayName: message.member?.displayName || message.author.username,
      globalName:  message.author.globalName   || null,
    };

    // Dedup: same sender+channel+similar content within 30 s
    const msgHash  = `${message.content.slice(0, 50)}`;
    const dedupKey = `${channelId}:${afkUserId}:${senderId}:${msgHash}`;
    const lastResp = recentResponses.get(dedupKey);
    if (lastResp && Date.now() - lastResp < 30_000) continue;

    // Rate limit per sender
    const rl = checkRateLimit(senderId);
    if (!rl.allowed) {
      log(`AI AFK: rate-limited sender ${senderId} (${Math.ceil(rl.cooldownRemainingMs / 1000)}s remaining)`, "debug");
      continue;
    }

    // Log this mention
    if (!afkMentions.has(afkUserId)) afkMentions.set(afkUserId, []);
    const mentionList = afkMentions.get(afkUserId);
    mentionList.push({
      senderId,
      senderName:  senderInfo.displayName,
      channelId,
      channelName: message.channel.name || "Direct Message",
      guildId:     message.guild?.id   || null,
      guildName:   message.guild?.name || null,
      timestamp:   Date.now(),
      content:     message.content.slice(0, 100) + (message.content.length > 100 ? "…" : ""),
      isDm:        !message.guild
    });
    if (mentionList.length > MAX_MENTIONS_STORED) {
      mentionList.splice(0, mentionList.length - MAX_MENTIONS_STORED);
    }

    // ── 6. Batch messages from this sender in this channel ────────────────
    const batchKey = `${afkUserId}:${senderId}:${channelId}`;
    if (!batchBuffers.has(batchKey)) {
      batchBuffers.set(batchKey, { messages: [], timer: null });
    }
    const buffer = batchBuffers.get(batchKey);
    buffer.messages.push(message.content);

    if (buffer.timer) clearTimeout(buffer.timer);

    log(`AI AFK: message from ${senderInfo.displayName}, starting/resetting ${BATCH_DELAY_MS}ms batch timer`, "debug");
    buffer.timer = setTimeout(async () => {
      batchBuffers.delete(batchKey);
      const batchedContent = buffer.messages.join("\n");
      const isFirstMessage = getHistory(afkUserId, senderId, channelId).length === 0;
      log(`AI AFK: batch timer ended for ${senderInfo.displayName}. Messages in batch: ${buffer.messages.length}`, "debug");

      // ── Batch Length Limit ──────────────────────────────────────────────────
      if (batchedContent.length > BATCH_MAX_LENGTH) {
        log(`AI AFK: ignored batch for ${senderInfo.displayName} bcz total combined length exceeds ${BATCH_MAX_LENGTH} characters`, "debug");
        return;
      }

      try {
        log(`AI AFK: generating AI response for ${senderInfo.displayName}...`, "debug");
        const aiResponse = await generateAiResponse(
          afkUserId, senderId, channelId,
          batchedContent, senderInfo, isFirstMessage, cfg
        );
        log(`AI AFK: response successfully generated. Caching before send to avoid race condition...`, "debug");

        // IMPORTANT: Cache BEFORE sending so the messageCreate guard is already
        // populated when Discord fires the event during the await below.
        if (!recentAiResponses.has(afkUserId)) recentAiResponses.set(afkUserId, new Set());
        const mySet = recentAiResponses.get(afkUserId);
        const trimmed = aiResponse.trim();
        mySet.add(trimmed);
        setTimeout(() => mySet.delete(trimmed), AI_RESPONSE_CACHE_TTL_MS);
        log(`AI AFK: response cached in recentAiResponses (expires in ${AI_RESPONSE_CACHE_TTL_MS}ms)`, "debug");

        // Reply to original message, fall back to channel.send
        log(`AI AFK: sending response to Discord...`, "debug");
        try {
          await message.reply(aiResponse);
        } catch {
          await message.channel.send(aiResponse).catch(() => {});
        }
        log(`AI AFK: successfully delivered response to ${senderInfo.displayName}`, "debug");

        recentResponses.set(dedupKey, Date.now());

        const afkOwnerName = client.user?.username || afkUserId;
        log(`AI AFK: finished processing cycle for ${senderInfo.displayName} on behalf of afkUser=${afkOwnerName}`, "debug");
      } catch (err) {
        log(`AI AFK: failed to generate response — ${err.message}`, "warn");
      }
    }, BATCH_DELAY_MS);
  }
}

// ─── Command export ───────────────────────────────────────────────────────────

export default {
  name: "aiafk",
  description: "Set an AI-powered AFK that responds to mentions on your behalf",
  aliases: ["aiaway"],
  usage: "[reason]",
  category: "AI",
  type: "both",
  permissions: ["SendMessages"],
  cooldown: 5,

  async execute(client, message, args) {
    const cfg = loadConfig().ai_afk;
    if (!cfg || !cfg.enabled) {
      return message.channel.send("> ❌ **AI AFK is disabled.** Enable it in `config.yaml` under `ai_afk`.");
    }

    const userId = message.author.id;

    // Block if normal AFK is active
    const normalAfk = readAfkData();
    if (normalAfk[userId]) {
      return message.channel.send("> ❌ **Normal AFK is active.**");
    }

    // Already AI AFK
    if (aiAfkUsers.has(userId)) {
      const existing  = aiAfkUsers.get(userId);
      const duration  = formatDuration(Date.now() - existing.startedAt);
      return message.channel.send(
        `> ⚠️ **AI AFK already active!** You've been AFK for **${duration}**.\n` +
        `> Reason: ${existing.reason || "none"}`
      );
    }

    const reason = args.join(" ").trim() || null;

    // Ensure at least one AI provider is available for the chain
    const chain = cfg.provider_chain || [];
    const anyAvailable = chain.some(p => AIManager.isAvailable(p));
    if (!anyAvailable) {
      return message.channel.send(
        "> ❌ **No AI providers available.** Please configure at least one provider in `config.yaml` under `ai`."
      );
    }

    aiAfkUsers.set(userId, {
      reason,
      startedAt: Date.now(),
      userInfo: {
        name: message.member?.displayName || message.author.username,
      }
    });

    const reasonText = reason ? ` Reason: **${reason}**` : "";
    await message.channel.send(
      `> 🤖 **[AI AFK Mode]** I'm now AFK with AI responses!${reasonText}`
    );

    log(`AI AFK set by ${message.author.username} (${userId}) — reason: ${reason || "none"}`, "debug");
  }
};
