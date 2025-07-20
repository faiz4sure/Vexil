/**
 * MESSAGE CREATE EVENT HANDLER
 *
 * This event handler processes all incoming messages and handles various
 * automated features including:
 * - AFK (Away From Keyboard) system management
 * - Stalk logging for monitored users
 * - Clownify reactions for targeted users
 * - Bad reply automation for troll commands
 * - Direct message logging
 *
 * The handler runs for every message sent in servers where the selfbot
 * has access, enabling comprehensive message monitoring and automation.
 *
 * @module events/messageCreate
 * @author faiz4sure
 */

import chalk from "chalk";
import { readAfkData, writeAfkData } from "../utils/afkHandler.js";
import { formatTime, log, loadConfig } from "../utils/functions.js";
import { clownifySessions } from "../commands/fun/clownify.js";
import { badReplySessions, getBadReplies } from "../commands/troll/badreply.js";
import StalkManager from "../utils/StalkManager.js";

export default {
  name: "messageCreate",
  once: false,

  /**
   * Handle incoming message events
   *
   * @async
   * @function execute
   * @param {Client} client - Discord.js client instance
   * @param {Message} message - The message that was created
   * @description Processes every new message for AFK management, stalk logging,
   *              automated reactions, and other selfbot features. Includes
   *              filtering to prevent bot loops and unwanted triggers.
   */
  execute: async (client, message) => {
    // Skip processing messages from bots to prevent loops
    if (message.author.bot) return;

    // Load current AFK data from storage
    const afkData = readAfkData();

    // Define message prefixes that should not trigger AFK removal
    // This prevents the bot's own messages from removing AFK status
    const afkIgnorePrefixes = [
      "> 👋 Welcome back!",
      "> ✅ You are now AFK.",
      "> ❌ **Error:**",
      "> 😴",
    ];

    // Check if message starts with ignored prefixes to prevent AFK removal loops
    if (
      afkIgnorePrefixes.some((prefix) => message.content.startsWith(prefix))
    ) {
      return;
    }

    // Handle AFK status removal when user sends a message
    if (
      afkData[message.author.id] &&
      !afkIgnorePrefixes.some((prefix) => message.content.startsWith(prefix))
    ) {
      const afkInfo = afkData[message.author.id];
      delete afkData[message.author.id];
      writeAfkData(afkData);

      // Calculate how long the user was AFK
      const timeAfk = formatTime(Date.now() - afkInfo.timestamp);
      await message.channel.send(
        `> 👋 Welcome back! You were AFK for ${timeAfk}.`
      );
      return;
    }

    // Collect mentioned users and replied-to users for AFK checking
    const mentionedUsers = new Set();

    // Add mentioned users
    if (message.mentions.users.size > 0) {
      message.mentions.users.forEach((user) => mentionedUsers.add(user));
    }

    // Add replied-to user
    if (message.reference && message.reference.messageId) {
      try {
        const repliedToMessage = await message.channel.messages.fetch(
          message.reference.messageId
        );
        if (repliedToMessage && repliedToMessage.author) {
          mentionedUsers.add(repliedToMessage.author);
        }
      } catch (error) {
        // Could not fetch replied to message
      }
    }

    // Check AFK status for all mentioned/replied-to users
    for (const user of mentionedUsers) {
      if (afkData[user.id]) {
        const afkInfo = afkData[user.id];
        const timeAfk = formatTime(Date.now() - afkInfo.timestamp);
        await message.channel.send(
          `> 😴 **${user.username}** is currently AFK: ${afkInfo.reason} (${timeAfk} ago).`
        );
      }
    }

    // Handle clownify reactions
    const guildId = message.guild?.id || "dm";
    const sessionKey = `${message.author.id}:${guildId}`;

    if (clownifySessions.has(sessionKey)) {
      const sessionData = clownifySessions.get(sessionKey);
      try {
        await message.react("🤡");
        sessionData.messageCount++;
        log(
          `Clownified message from ${message.author.username} (${sessionData.messageCount} total)`,
          "debug"
        );
      } catch (error) {
        log(
          `Failed to clownify message from ${message.author.username}: ${error.message}`,
          "warn"
        );

        // If we can't react (permissions lost), stop the session
        if (error.status === 403) {
          if (sessionData.task) {
            sessionData.task.stop();
          }
          clownifySessions.delete(sessionKey);
          log(
            `Stopped clownify session for ${message.author.username} due to missing permissions`,
            "debug"
          );
        }
      }
    }

    // Handle bad reply sessions
    if (badReplySessions.has(sessionKey)) {
      const sessionData = badReplySessions.get(sessionKey);
      try {
        // Get bad replies from config or defaults
        const badReplies = getBadReplies();

        // Get a random bad reply
        const randomReply =
          badReplies[Math.floor(Math.random() * badReplies.length)];

        // Reply to the message
        await message.reply(randomReply);
        sessionData.replyCount++;

        log(
          `Bad replied to ${message.author.username} (${sessionData.replyCount} total)`,
          "debug"
        );
      } catch (error) {
        log(
          `Failed to bad reply to ${message.author.username}: ${error.message}`,
          "warn"
        );

        // If we can't reply (permissions lost), stop the session
        if (error.status === 403) {
          if (sessionData.task) {
            sessionData.task.stop();
          }
          badReplySessions.delete(sessionKey);
          log(
            `Stopped bad reply session for ${message.author.username} due to missing permissions`,
            "debug"
          );
        }
      }
    }

    // Handle stalk logging for message sent
    if (StalkManager.isStalking(message.author.id)) {
      const attachments =
        message.attachments.size > 0
          ? Array.from(message.attachments.values()).map((att) => att.name)
          : [];

      StalkManager.logMessageEvent(message.author.id, "MESSAGE_SENT", {
        guildName: message.guild?.name,
        channelName: message.channel.name,
        content: message.content,
        attachments: attachments,
      });
    }

    // Log direct messages if enabled in config
    if (message.channel.type === "DM") {
      const config = loadConfig();
      if (config.selfbot.dm_logs) {
        console.log(
          chalk.blue(`[DM] ${message.author.tag}: ${message.content}`)
        );
      }
    }
  },
};
