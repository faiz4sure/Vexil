import { log } from "../utils/functions.js";
import StalkManager from "../utils/StalkManager.js";

export default {
  name: "messageUpdate",
  once: false,

  /**
   * Handle message update events
   * @param {Client} client - Discord.js client instance
   * @param {Message} oldMessage - The message before the update
   * @param {Message} newMessage - The message after the update
   */
  execute: async (client, oldMessage, newMessage) => {
    try {
      // Initialize the edited messages cache if it doesn't exist
      if (!client._editedMessages) {
        client._editedMessages = new Map();
        log("Initialized edited messages cache", "debug");
        
        // Start a sweeper to clear messages older than 1 hour
        setInterval(() => {
          const now = Date.now();
          const ONE_HOUR = 60 * 60 * 1000;
          let prunedCount = 0;
          
          for (const [channelId, messages] of client._editedMessages.entries()) {
            const validMessages = messages.filter(m => now - m.timestamp < ONE_HOUR);
            if (validMessages.length === 0) {
              client._editedMessages.delete(channelId);
            } else if (validMessages.length !== messages.length) {
              client._editedMessages.set(channelId, validMessages);
            }
            prunedCount += (messages.length - validMessages.length);
          }
          
          if (prunedCount > 0) {
            log(`[Sweeper] Cleared ${prunedCount} expired edited messages from cache`, "debug");
          }
        }, 10 * 60 * 1000); // Run every 10 minutes
      }

      // Skip if the message is invalid
      if (!oldMessage || !oldMessage.author || !newMessage) {
        log("Skipping invalid message in messageUpdate event", "debug");
        return;
      }

      // Skip if the message is from a bot
      if (oldMessage.author.bot) {
        log(`Skipping bot message from ${oldMessage.author.tag}`, "debug");
        return;
      }

      // Skip if the message is from the selfbot
      if (oldMessage.author.id === client.user.id) {
        log("Skipping own message in messageUpdate event", "debug");
        return;
      }

      // Skip if content didn't change
      if (oldMessage.content === newMessage.content) {
        log("Skipping message update with no content change", "debug");
        return;
      }

      log(
        `Processing edited message from ${oldMessage.author.tag} in #${
          oldMessage.channel.name || oldMessage.channel.id
        }`,
        "debug"
      );

      // Initialize array for this channel if it doesn't exist
      if (!client._editedMessages.has(oldMessage.channel.id)) {
        client._editedMessages.set(oldMessage.channel.id, []);
      }
      
      const channelCache = client._editedMessages.get(oldMessage.channel.id);

      // Store the edited message in the cache at the beginning
      channelCache.unshift({
        oldContent: oldMessage.content || "",
        newContent: newMessage.content || "",
        author: {
          id: oldMessage.author.id,
          tag: oldMessage.author.tag,
          displayAvatarURL: oldMessage.author.displayAvatarURL
            ? oldMessage.author.displayAvatarURL()
            : null,
        },
        timestamp: Date.now(),
        messageId: newMessage.id,
        guildId: newMessage.guild?.id,
        channelId: oldMessage.channel.id,
      });
      
      // Keep only the last 10 edited messages
      if (channelCache.length > 10) {
        channelCache.pop();
      }

      // Handle stalk logging for message edited
      if (StalkManager.isStalking(oldMessage.author.id)) {
        StalkManager.logMessageEvent(oldMessage.author.id, 'MESSAGE_EDITED', {
          guildName: oldMessage.guild?.name,
          channelName: oldMessage.channel.name,
          oldContent: oldMessage.content,
          newContent: newMessage.content
        });
      }

      log(
        `Successfully cached edited message from ${oldMessage.author.tag} in #${
          oldMessage.channel.name || oldMessage.channel.id
        }`,
        "debug"
      );
      log(`Cache now has ${client._editedMessages.size} entries`, "debug");
    } catch (error) {
      log(`Error in messageUpdate event: ${error.message}`, "error");
      console.error("Full error:", error);
    }
  },
};
