import { log } from "../../utils/functions.js";

export default {
  name: "snipe",
  description: "Get the last deleted message in a channel",
  aliases: ["s", "deletesnipe"],
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

      // Get the deleted message cache from the messageDelete event
      // This is a workaround since we can't directly import from the event file
      const deletedMessages = client._deletedMessages || new Map();

      // Debug: Log the current cache state
      log(
        `Snipe command executed. Current cache has ${deletedMessages.size} entries.`,
        "debug"
      );
      log(`Looking for messages in channel ID: ${targetChannel.id}`, "debug");

      // Get the deleted message for this channel
      const deletedMessage = deletedMessages.get(targetChannel.id);

      // If no message was found
      if (!deletedMessage) {
        log(
          `No deleted messages found for channel ${targetChannel.id}`,
          "debug"
        );
        return message.channel.send(
          "> ❌ No recently deleted messages found in this channel."
        );
      }

      log(`Found deleted message from ${deletedMessage.author.tag}`, "debug");

      // Format the timestamp
      const timestamp = new Date(deletedMessage.timestamp).toLocaleString();

      // Create a formatted message
      let snipeMessage = `> 🗑️ **Deleted Message**\n`;
      snipeMessage += `> **Author:** ${
        deletedMessage.author.tag || "Unknown User"
      }\n`;
      snipeMessage += `> **Channel:** <#${targetChannel.id}>\n`;
      snipeMessage += `> **Deleted at:** ${timestamp}\n`;

      // Handle content with proper formatting
      if (deletedMessage.content && deletedMessage.content.trim().length > 0) {
        // If content is short, show it inline
        if (deletedMessage.content.length < 100) {
          snipeMessage += `> **Content:** ${deletedMessage.content}\n`;
        } else {
          // For longer content, use code blocks
          snipeMessage += `> **Content:**\n\`\`\`\n${deletedMessage.content}\n\`\`\``;
        }
      } else {
        snipeMessage += `> **Content:** *No text content*\n`;
      }

      // Add attachment info if there were any
      if (deletedMessage.attachments && deletedMessage.attachments.length > 0) {
        snipeMessage += `> **Attachments:**\n`;

        deletedMessage.attachments.forEach((att, index) => {
          snipeMessage += `> ${index + 1}. ${att.name}: ${att.url}\n`;
        });
      }

      // Send the message
      await message.channel.send(snipeMessage);

      // If there are image attachments, send them separately
      if (deletedMessage.attachments && deletedMessage.attachments.length > 0) {
        const imageAttachments = deletedMessage.attachments.filter(
          (att) => att.contentType && att.contentType.startsWith("image/")
        );

        if (imageAttachments.length > 0) {
          await message.channel.send("> **Deleted Images:**");

          // Send up to 3 images to avoid spam
          const maxImages = Math.min(imageAttachments.length, 3);
          for (let i = 0; i < maxImages; i++) {
            await message.channel.send(imageAttachments[i].url);
          }

          // If there are more images, mention it
          if (imageAttachments.length > maxImages) {
            await message.channel.send(
              `> *${
                imageAttachments.length - maxImages
              } more image(s) not shown*`
            );
          }
        }
      }

      log(
        `Sniped a deleted message in #${
          targetChannel.name || targetChannel.id
        }`,
        "debug"
      );
    } catch (error) {
      log(`Error in snipe command: ${error.message}`, "error");
      message.channel.send(
        `> ❌ An error occurred while sniping the message: ${error.message}`
      );
    }
  },
};
