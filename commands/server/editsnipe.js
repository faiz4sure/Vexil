import { log } from "../../utils/functions.js";

export default {
  name: "editsnipe",
  description: "Get the last edited message in a channel",
  aliases: ["es", "esnipe"],
  usage: "",
  category: "server",
  type: "both",
  permissions: ["SendMessages"],
  cooldown: 3,

  execute: async (client, message, args) => {
    try {
      if (message.author.id !== client.user.id) return;

      // Determine which channel to snipe from
      let targetChannel = message.channel;

      // If a channel is mentioned, use that instead
      if (message.mentions.channels.size > 0) {
        targetChannel = message.mentions.channels.first();
      }
      // If a channel ID is provided, try to get that channel
      else if (args[0] && !isNaN(args[0])) {
        const channel =
          message.guild?.channels.cache.get(args[0]) ||
          client.channels.cache.get(args[0]);
        if (channel) {
          targetChannel = channel;
        }
      }

      // Get the edited message cache from the messageUpdate event
      const editedMessages = client._editedMessages || new Map();

      // Debug: Log the current cache state
      log(
        `Editsnipe command executed. Current cache has ${editedMessages.size} entries.`,
        "debug"
      );
      log(`Looking for messages in channel ID: ${targetChannel.id}`, "debug");

      // Get the edited message for this channel
      const editedMessage = editedMessages.get(targetChannel.id);

      // If no message was found
      if (!editedMessage) {
        log(
          `No edited messages found for channel ${targetChannel.id}`,
          "debug"
        );
        return message.channel.send(
          "> ❌ No recently edited messages found in this channel."
        );
      }

      log(`Found edited message from ${editedMessage.author.tag}`, "debug");

      // Format the timestamp
      const timestamp = new Date(editedMessage.timestamp).toLocaleString();

      // Create a formatted message
      let snipeMessage = `> ✏️ **Edited Message**\n`;
      snipeMessage += `> **Author:** ${
        editedMessage.author.tag || "Unknown User"
      }\n`;
      snipeMessage += `> **Channel:** <#${targetChannel.id}>\n`;
      snipeMessage += `> **Edited at:** ${timestamp}\n`;

      // Add message link if available
      if (editedMessage.messageId && editedMessage.guildId) {
        snipeMessage += `> **Message Link:** https://discord.com/channels/${editedMessage.guildId}/${targetChannel.id}/${editedMessage.messageId}\n`;
      }

      // Format the before content
      if (
        editedMessage.oldContent &&
        editedMessage.oldContent.trim().length > 0
      ) {
        // If content is short, show it inline
        if (editedMessage.oldContent.length < 100) {
          snipeMessage += `> **Before:** ${editedMessage.oldContent}\n`;
        } else {
          // For longer content, use code blocks
          snipeMessage += `> **Before:**\n\`\`\`\n${editedMessage.oldContent}\n\`\`\``;
        }
      } else {
        snipeMessage += `> **Before:** *No content*\n`;
      }

      // Format the after content
      if (
        editedMessage.newContent &&
        editedMessage.newContent.trim().length > 0
      ) {
        // If content is short, show it inline
        if (editedMessage.newContent.length < 100) {
          snipeMessage += `> **After:** ${editedMessage.newContent}\n`;
        } else {
          // For longer content, use code blocks
          snipeMessage += `> **After:**\n\`\`\`\n${editedMessage.newContent}\n\`\`\``;
        }
      } else {
        snipeMessage += `> **After:** *No content*\n`;
      }

      // Send the message
      await message.channel.send(snipeMessage);

      log(
        `Sniped an edited message in #${
          targetChannel.name || targetChannel.id
        }`,
        "debug"
      );
    } catch (error) {
      log(`Error in editsnipe command: ${error.message}`, "error");
      message.channel.send(
        `> ❌ An error occurred while sniping the edited message: ${error.message}`
      );
    }
  },
};
