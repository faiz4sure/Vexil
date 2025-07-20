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

      // Store the deleted message in the cache
      client._deletedMessages.set(message.channel.id, {
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
