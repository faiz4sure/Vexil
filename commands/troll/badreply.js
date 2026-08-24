import { log, loadConfig } from "../../utils/functions.js";
import TaskManager from "../../utils/TaskManager.js";
import RateLimitManager from "../../utils/RateLimitManager.js";

// Store active bad reply sessions
const badReplySessions = new Map();

// Default bad replies (fallback if config is not available)
const defaultBadReplies = [
  "You're such a pathetic loser, go touch some grass you basement dweller.",
  "Shut the hell up, nobody asked for your stupid opinion you moron.",
  "You're absolutely worthless, a complete waste of oxygen and space.",
  "Go f*ck yourself, you annoying piece of sh*t nobody likes you.",
  "You're a braindead idiot who should just delete your account already.",
  "Stop being such a dumbass, your stupidity is showing again.",
  "You're the most annoying b*tch I've ever encountered online.",
  "Seriously, just shut your mouth you ignorant fool.",
  "You're a complete failure at life, go cry to your mommy.",
  "Nobody cares about what you have to say, you're irrelevant.",
  "You're such a cringe loser, get a life outside the internet.",
  "Stop embarrassing yourself, you look like a total clown.",
  "You're absolutely disgusting, both inside and out you freak.",
  "Go away you toxic piece of garbage, nobody wants you here.",
  "You're the definition of human trash, completely worthless.",
  "Shut up you annoying brat, adults are talking here.",
  "You're such a pathetic virgin, go outside and touch grass.",
  "Stop being such a drama queen, you attention-seeking wh*re.",
  "You're completely braindead, use your brain for once idiot.",
  "Nobody likes you, you're just an annoying pest that won't go away.",
];

/**
 * Get bad replies from config or use defaults
 * @returns {Array} Array of bad reply phrases
 */
function getBadReplies() {
  try {
    const config = loadConfig();

    const configPhrases = config.bad_phrases && Array.isArray(config.bad_phrases.phrases)
      ? config.bad_phrases.phrases.filter(p => typeof p === "string" && p.trim().length > 0)
      : [];

    // Check if bad_phrases is configured, enabled, and has valid phrases
    if (
      config.bad_phrases &&
      config.bad_phrases.enabled &&
      configPhrases.length > 0
    ) {
      log("Using bad phrases from config", "debug");
      return configPhrases;
    } else {
      log("Using default bad phrases (config not found, disabled, or no custom phrases configured)", "debug");
      return defaultBadReplies;
    }
  } catch (error) {
    log(`Error loading bad phrases from config: ${error.message}`, "warn");
    return defaultBadReplies;
  }
}

export default {
  name: "badreply",
  description: "Auto-reply with bad words to a specific user",
  aliases: ["br", "toxicreply", "badword"],
  usage: "<@user/user_id> | badreply stop <@user/user_id> | badreply spam <@user/user_id> | badreply spam stop <@user/user_id> | badreply list",
  category: "troll",
  type: "both",
  permissions: ["SendMessages"],
  cooldown: 5,

  async execute(client, message, args) {
    if (!args.length) {
      return message.channel.send(
        "❌ **Please specify a command!**\n" +
          `**Usage:**\n` +
          `• \`${client.prefix}badreply @user\` - Start bad replying on user message\n` +
          `• \`${client.prefix}badreply stop @user\` - Stop bad replying\n` +
          `• \`${client.prefix}badreply spam @user\` - Start bad reply spamming\n` +
          `• \`${client.prefix}badreply spam stop @user\` - Stop bad reply spamming\n` +
          `• \`${client.prefix}badreply list\` - Show active sessions`
      );
    }

    const subcommand = args[0].toLowerCase();

    // Handle subcommands
    if (subcommand === "stop" || subcommand === "end") {
      return this.stopBadReply(client, message, args.slice(1));
    }

    if (subcommand === "list" || subcommand === "active") {
      return this.listActive(client, message);
    }

    if (subcommand === "spam") {
      const secondArg = args[1]?.toLowerCase();
      if (secondArg === "stop" || secondArg === "end") {
        return this.stopBadReply(client, message, args.slice(2));
      }
      return this.startBadReplySpam(client, message, args.slice(1));
    }

    // Default: start bad replying to a user
    return this.startBadReply(client, message, args);
  },

  async startBadReply(client, message, args) {
    let targetUser = null;

    // Parse user from mention or ID
    if (message.mentions.users.size > 0) {
      targetUser = message.mentions.users.first();
    } else if (args[0]) {
      try {
        const userId = args[0].replace(/[<@!>]/g, "");
        if (/^\d+$/.test(userId)) {
          targetUser = await client.users.fetch(userId);
        }
      } catch (error) {
        return message.channel.send(
          "❌ **User not found!** Please mention a valid user or provide a valid user ID."
        );
      }
    }

    if (!targetUser) {
      return message.channel.send(
        "❌ **Please specify a user to bad reply to!**\n" +
          `**Usage:** \`${client.prefix}badreply @user\``
      );
    }

    // Prevent self-targeting
    if (targetUser.id === message.author.id) {
      return message.channel.send("🤡 **You can't bad reply to yourself!**");
    }

    // Prevent targeting bots
    if (targetUser.bot) {
      return message.channel.send("🤖 **Can't bad reply to bots!**");
    }

    const guildId = message.guild?.id || "dm";
    const sessionKey = `${targetUser.id}:${guildId}`;

    // Check if user is already being bad replied to
    if (badReplySessions.has(sessionKey)) {
      const existingSession = badReplySessions.get(sessionKey);
      const sessionType = existingSession.type === "spam" ? "spam" : "normal bad reply";
      return message.channel.send(
        `💀 **${targetUser.username} is already targeted by a ${sessionType} session!**`
      );
    }

    // Create task using TaskManager
    const taskName = `badreply_${targetUser.id}`;
    const task = TaskManager.createTask(taskName, guildId);

    if (!task) {
      return message.channel.send("❌ **Failed to create bad reply task!**");
    }

    // Store session data
    const sessionData = {
      type: "normal",
      targetUserId: targetUser.id,
      targetUsername: targetUser.username,
      guildId: guildId,
      channelId: message.channel.id,
      startedBy: message.author.id,
      startedAt: Date.now(),
      replyCount: 0,
      task: task,
      isCancelled: false,
    };

    // Add cancellation listener to clean up session immediately
    if (task.signal) {
      task.signal.addEventListener("abort", () => {
        sessionData.isCancelled = true;
        badReplySessions.delete(sessionKey);
        // Only log if it was actually cancelled by user, not by natural completion
        if (!task.signal.reason || task.signal.reason !== "completed") {
          log(
            `Bad reply task for ${targetUser.username} was cancelled`,
            "warn"
          );
        }
      });
    }

    badReplySessions.set(sessionKey, sessionData);

    await message.channel.send(
      `💀 **Started bad replying to ${targetUser.username}!**\n` +
        `Every message they send will get a toxic reply.`
    );

    log(
      `Started bad replying to ${targetUser.username} (${targetUser.id}) in ${guildId}`,
      "debug"
    );
  },

  async startBadReplySpam(client, message, args) {
    let targetUser = null;

    // Parse user from mention or ID
    if (message.mentions.users.size > 0) {
      targetUser = message.mentions.users.first();
    } else if (args[0]) {
      try {
        const userId = args[0].replace(/[<@!>]/g, "");
        if (/^\d+$/.test(userId)) {
          targetUser = await client.users.fetch(userId);
        }
      } catch (error) {
        return message.channel.send(
          "❌ **User not found!** Please mention a valid user or provide a valid user ID."
        );
      }
    }

    if (!targetUser) {
      return message.channel.send(
        "❌ **Please specify a user to bad reply spam!**\n" +
          `**Usage:** \`${client.prefix}badreply spam @user\``
      );
    }

    // Prevent self-targeting
    if (targetUser.id === message.author.id) {
      return message.channel.send("🤡 **You can't bad reply spam yourself!**");
    }

    // Prevent targeting bots
    if (targetUser.bot) {
      return message.channel.send("🤖 **Can't bad reply spam bots!**");
    }

    const guildId = message.guild?.id || "dm";
    const sessionKey = `${targetUser.id}:${guildId}`;

    // Check if user is already being bad replied to (any session type)
    if (badReplySessions.has(sessionKey)) {
      const existingSession = badReplySessions.get(sessionKey);
      const sessionType = existingSession.type === "spam" ? "spam" : "normal bad reply";
      return message.channel.send(
        `💀 **${targetUser.username} is already targeted by a ${sessionType} session!**`
      );
    }

    // Create task using TaskManager
    const taskName = `badreply_spam_${targetUser.id}`;
    const task = TaskManager.createTask(taskName, guildId);

    if (!task) {
      return message.channel.send("❌ **Failed to create bad reply spam task!**");
    }

    // Store session data
    const sessionData = {
      type: "spam",
      targetUserId: targetUser.id,
      targetUsername: targetUser.username,
      guildId: guildId,
      channelId: message.channel.id,
      startedBy: message.author.id,
      startedAt: Date.now(),
      replyCount: 0,
      task: task,
      isCancelled: false,
    };

    // Add cancellation listener to clean up session immediately
    if (task.signal) {
      task.signal.addEventListener("abort", () => {
        sessionData.isCancelled = true;
        badReplySessions.delete(sessionKey);
        if (!task.signal.reason || task.signal.reason !== "completed") {
          log(
            `Bad reply spam task for ${targetUser.username} was cancelled`,
            "warn"
          );
        }
      });
    }

    badReplySessions.set(sessionKey, sessionData);

    await message.channel.send(
      `💀 **Started bad reply spamming to ${targetUser.username}!**\n` +
        `Mentions and bad phrases will be spammed in this channel.`
    );

    log(
      `Started bad reply spamming to ${targetUser.username} (${targetUser.id}) in ${guildId}`,
      "debug"
    );

    // Start the asynchronous spam loop
    (async () => {
      const rateLimiter = new RateLimitManager(1);

      while (!sessionData.isCancelled && !task.signal.aborted) {
        try {
          const badReplies = getBadReplies();
          const randomReply = badReplies[Math.floor(Math.random() * badReplies.length)];
          const spamMsg = `${randomReply} <@${targetUser.id}>`;

          await rateLimiter.execute(async () => {
            if (sessionData.isCancelled || task.signal.aborted) return;
            const channel = await client.channels.fetch(sessionData.channelId).catch(() => null);
            if (!channel) throw new Error("Channel not found or inaccessible");
            await channel.send(spamMsg);
            sessionData.replyCount++;
          }, task.signal);

          // Wait 2000ms or until aborted
          await new Promise((resolve) => {
            const timeout = setTimeout(resolve, 2000);
            const onAbort = () => {
              clearTimeout(timeout);
              resolve();
            };
            task.signal.addEventListener("abort", onAbort);
          });
        } catch (error) {
          if (task.signal.aborted || sessionData.isCancelled || error.message.includes("cancelled")) {
            break;
          }
          log(`Error in bad reply spam loop: ${error.message}`, "warn");

          // Stop if permission error
          if (error.status === 403 || error.message.includes("Missing Permissions")) {
            log(`Stopping bad reply spam session due to missing permissions`, "debug");
            break;
          }

          // Wait 3 seconds on error before retrying
          await new Promise((resolve) => {
            const timeout = setTimeout(resolve, 3000);
            if (task.signal) {
              task.signal.addEventListener("abort", () => {
                clearTimeout(timeout);
                resolve();
              });
            }
          });
        }
      }

      // Cleanup if loop exited (e.g. error, or if aborted naturally but not yet cleaned up)
      if (!sessionData.isCancelled) {
        sessionData.isCancelled = true;
        if (task) {
          task.stop();
        }
        badReplySessions.delete(sessionKey);
      }
    })();
  },

  async stopBadReply(client, message, args) {
    let targetUser = null;

    // Parse user from mention or ID
    if (message.mentions.users.size > 0) {
      targetUser = message.mentions.users.first();
    } else if (args[0]) {
      try {
        const userId = args[0].replace(/[<@!>]/g, "");
        if (/^\d+$/.test(userId)) {
          targetUser = await client.users.fetch(userId);
        }
      } catch (error) {
        return message.channel.send("❌ **User not found!**");
      }
    }

    if (!targetUser) {
      return message.channel.send(
        "❌ **Please specify which user to stop targeting!**"
      );
    }

    const guildId = message.guild?.id || "dm";
    const sessionKey = `${targetUser.id}:${guildId}`;

    if (!badReplySessions.has(sessionKey)) {
      return message.channel.send(
        `❌ **${targetUser.username} is not being bad replied/spammed to!**`
      );
    }

    const sessionData = badReplySessions.get(sessionKey);
    const duration = Date.now() - sessionData.startedAt;
    const durationText = this.formatDuration(duration);
    const isSpam = sessionData.type === "spam";

    // Stop the task and remove session
    if (sessionData.task) {
      sessionData.task.stop();
    }
    badReplySessions.delete(sessionKey);

    await message.channel.send(
      `✅ **Stopped ${isSpam ? "bad reply spamming" : "bad replying"} to ${targetUser.username}!**\n` +
        `**Duration:** ${durationText}\n` +
        `**Messages sent:** ${sessionData.replyCount}`
    );

    log(
      `Stopped bad reply session for ${targetUser.username} (${targetUser.id})`,
      "debug"
    );
  },

  async listActive(client, message) {
    const guildId = message.guild?.id || "dm";
    const activeSessions = Array.from(badReplySessions.entries()).filter(
      ([key, data]) => data.guildId === guildId
    );

    if (activeSessions.length === 0) {
      return message.channel.send("📝 **No active bad reply/spam sessions!**");
    }

    let listText = "💀 **Active Bad Reply/Spam Sessions:**\n\n";

    for (const [sessionKey, data] of activeSessions) {
      const duration = Date.now() - data.startedAt;
      const durationText = this.formatDuration(duration);
      const sessionType = data.type === "spam" ? "Spam" : "Normal";

      listText += `**${data.targetUsername}** (${sessionType})\n`;
      listText += `• Duration: ${durationText}\n`;
      listText += `• Messages sent: ${data.replyCount}\n\n`;
    }

    await message.channel.send(listText);
  },

  formatDuration(ms) {
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);

    if (hours > 0) {
      return `${hours}h ${minutes % 60}m`;
    } else if (minutes > 0) {
      return `${minutes}m ${seconds % 60}s`;
    } else {
      return `${seconds}s`;
    }
  },
};

// Export the sessions map and getBadReplies function so they can be accessed from messageCreate event
export { badReplySessions, getBadReplies };
