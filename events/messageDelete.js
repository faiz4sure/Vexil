import { log } from "../utils/functions.js";
import StalkManager from "../utils/StalkManager.js";

export default {
  name: "messageDelete",
  once: false,

  /**
   * Handle message deletion events
   * @param {Client} client - Discord.js client instance
   * @param {Message} message - The deleted message
   */
  execute: async (client, message) => {
    try {
      // Initialize the deleted messages cache if it doesn't exist
      if (!client._deletedMessages) {
        client._deletedMessages = new Map();
        log("Initialized deleted messages cache", "debug");
        
        // Start a sweeper to clear messages older than 1 hour
        setInterval(() => {
          const now = Date.now();
          const ONE_HOUR = 60 * 60 * 1000;
          let prunedCount = 0;
          
          for (const [channelId, messages] of client._deletedMessages.entries()) {
            const validMessages = messages.filter(m => now - m.timestamp < ONE_HOUR);
            if (validMessages.length === 0) {
              client._deletedMessages.delete(channelId);
            } else if (validMessages.length !== messages.length) {
              client._deletedMessages.set(channelId, validMessages);
            }
            prunedCount += (messages.length - validMessages.length);
          }
          
          if (prunedCount > 0) {
            log(`[Sweeper] Cleared ${prunedCount} expired deleted messages from cache`, "debug");
          }
        }, 10 * 60 * 1000); // Run every 10 minutes
      }

      // Skip if the message is invalid
      if (!message || !message.author) {
        log("Skipping invalid message in messageDelete event", "debug");
        return;
      }

      // Skip if the message is from a bot
      if (message.author.bot) {
        log(`Skipping bot message from ${message.author.tag}`, "debug");
        return;
      }

      // Skip if the message is from the selfbot
      if (message.author.id === client.user.id) {
        log("Skipping own message in messageDelete event", "debug");
        return;
      }

      log(
        `Processing deleted message from ${message.author.tag} in #${
          message.channel.name || message.channel.id
        }`,
        "debug"
      );

      // Initialize array for this channel if it doesn't exist
      if (!client._deletedMessages.has(message.channel.id)) {
        client._deletedMessages.set(message.channel.id, []);
      }
      
      const channelCache = client._deletedMessages.get(message.channel.id);

      // Store the deleted message in the cache at the beginning
      channelCache.unshift({
        content: message.content || "",
        author: {
          id: message.author.id,
          tag: message.author.tag,
          displayAvatarURL: message.author.displayAvatarURL
            ? message.author.displayAvatarURL()
            : null,
        },
        timestamp: Date.now(),
        attachments: message.attachments
          ? [...message.attachments.values()].map((att) => ({
              name: att.name || "attachment",
              url: att.url || att.proxyURL,
              contentType: att.contentType || "unknown",
              size: att.size || 0,
            }))
          : [],
      });
      
      // Keep only the last 10 deleted messages
      if (channelCache.length > 10) {
        channelCache.pop();
      }

      // Handle stalk logging for message deleted
      if (StalkManager.isStalking(message.author.id)) {
        StalkManager.logMessageEvent(message.author.id, 'MESSAGE_DELETED', {
          guildName: message.guild?.name,
          channelName: message.channel.name,
          content: message.content
        });
      }

      log(
        `Successfully cached deleted message from ${message.author.tag} in #${
          message.channel.name || message.channel.id
        }`,
        "debug"
      );
      log(`Cache now has ${client._deletedMessages.size} entries`, "debug");
    } catch (error) {
      log(`Error in messageDelete event: ${error.message}`, "error");
      console.error("Full error:", error);
    }
  },
};
