import { log } from "../../utils/functions.js";
import EmojiEnhancer from "../../utils/EmojiEnhancer.js";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import axios from "axios";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export default {
  name: "emoji",
  description: "Get an emoji as a high-quality image (supports animated GIFs)",
  aliases: ["emote", "e"],
  usage: "<emoji>",
  category: "general",
  type: "both",
  permissions: ["SendMessages", "AttachFiles"],
  cooldown: 3,

  async execute(client, message, args) {
    try {
      if (!args.length) {
        return message.channel.send(
          `> ❌ **Usage:** \`${client.prefix}emoji <emoji>\`\n` +
            `> **Example:** \`${client.prefix}emoji 😀\` or \`${client.prefix}emoji :smile:\``
        );
      }

      const emojiInput = args.join(" ");

      // Send processing message
      const processingMsg = await message.channel.send(
        "> 🔄 **Processing emoji...**"
      );

      try {
        // Get emoji information
        const emojiInfo = await this.parseEmoji(emojiInput, message);

        if (!emojiInfo) {
          await processingMsg.edit(
            "> ❌ **Invalid emoji!**\n" +
              "> Please provide a valid emoji or custom emoji."
          );
          return;
        }

        // Download the emoji image
        const imageBuffer = await this.downloadEmojiImage(emojiInfo);

        if (!imageBuffer) {
          await processingMsg.edit(
            "> ❌ **Failed to download emoji image!**\n" +
              "> The emoji might not be available or accessible."
          );
          return;
        }

        // Enhance image quality using EmojiEnhancer utility
        await processingMsg.edit("> 🎨 **Enhancing image quality...**");
        const finalBuffer = await EmojiEnhancer.enhanceImage(
          imageBuffer,
          emojiInfo.animated
        );

        // Get enhancement info for display
        const enhancementInfo = EmojiEnhancer.getEnhancementInfo(
          imageBuffer,
          finalBuffer
        );

        // Create temp file
        const tempDir = path.join(__dirname, "..", "..", "temp");
        if (!fs.existsSync(tempDir)) {
          fs.mkdirSync(tempDir, { recursive: true });
        }

        const fileExtension = emojiInfo.animated ? "gif" : "png";
        const fileName = `emoji_${Date.now()}.${fileExtension}`;
        const filePath = path.join(tempDir, fileName);

        // Save enhanced image
        fs.writeFileSync(filePath, finalBuffer);

        // Send the enhanced emoji image
        await message.channel.send({
          content:
            `> ✅ **${enhancementInfo.wasEnhanced ? "Enhanced" : "Original"} ${
              emojiInfo.animated ? "Animated" : "Static"
            } Emoji**\n` +
            `> **Name:** ${emojiInfo.name}\n` +
            `> **Size:** ${enhancementInfo.enhancedSize}KB${
              enhancementInfo.wasEnhanced
                ? ` (+${enhancementInfo.sizeIncrease}KB)`
                : ""
            }\n` +
            `> **Enhanced:** ${enhancementInfo.wasEnhanced ? "Yes" : "No"}${
              enhancementInfo.wasEnhanced
                ? ` (+${enhancementInfo.percentIncrease}%)`
                : ""
            }`,
          files: [
            {
              attachment: filePath,
              name: `${emojiInfo.name.replace(
                /[^a-zA-Z0-9]/g,
                "_"
              )}.${fileExtension}`,
            },
          ],
        });

        // Clean up
        await processingMsg.delete().catch(() => {});

        // Delete temp file after a delay
        setTimeout(() => {
          try {
            if (fs.existsSync(filePath)) {
              fs.unlinkSync(filePath);
            }
          } catch (error) {
            log(`Failed to delete temp file: ${error.message}`, "warn");
          }
        }, 5000);

        log(
          `Emoji command used by ${message.author.tag} for emoji: ${emojiInfo.name}`,
          "debug"
        );
      } catch (error) {
        await processingMsg.edit(
          `> ❌ **Error processing emoji:** ${error.message}`
        );
        log(`Error in emoji command: ${error.message}`, "error");
      }
    } catch (error) {
      log(`Error in emoji command: ${error.message}`, "error");
      message.channel.send(`> ❌ An error occurred: ${error.message}`);
    }
  },

  /**
   * Parse emoji input and get emoji information
   */
  async parseEmoji(input, message) {
    try {
      // Check if it's a custom Discord emoji
      const customEmojiMatch = input.match(/<a?:(\w+):(\d+)>/);
      if (customEmojiMatch) {
        const [, name, id] = customEmojiMatch;
        const animated = input.startsWith("<a:");

        return {
          id: id,
          name: name,
          animated: animated,
          url: `https://cdn.discordapp.com/emojis/${id}.${
            animated ? "gif" : "png"
          }?size=512&quality=lossless`,
        };
      }

      // Check if it's a Unicode emoji
      if (this.isUnicodeEmoji(input)) {
        const codePoints = [...input]
          .map((char) => char.codePointAt(0).toString(16).padStart(4, "0"))
          .join("-");

        return {
          id: null,
          name: input,
          animated: false,
          url: `https://cdn.jsdelivr.net/gh/twitter/twemoji@14.0.2/assets/72x72/${codePoints}.png`,
        };
      }

      // Check if it's an emoji name (like :smile:)
      const emojiNameMatch = input.match(/^:(\w+):$/);
      if (emojiNameMatch) {
        // Try to find it in the guild's emojis
        if (message.guild) {
          const guildEmoji = message.guild.emojis.cache.find(
            (e) => e.name === emojiNameMatch[1]
          );
          if (guildEmoji) {
            return {
              id: guildEmoji.id,
              name: guildEmoji.name,
              animated: guildEmoji.animated,
              url: guildEmoji.url + "?size=512&quality=lossless",
            };
          }
        }
      }

      return null;
    } catch (error) {
      log(`Error parsing emoji: ${error.message}`, "error");
      return null;
    }
  },

  /**
   * Check if input is a Unicode emoji
   */
  isUnicodeEmoji(input) {
    // Basic Unicode emoji detection
    const emojiRegex =
      /[\u{1F600}-\u{1F64F}]|[\u{1F300}-\u{1F5FF}]|[\u{1F680}-\u{1F6FF}]|[\u{1F1E0}-\u{1F1FF}]|[\u{2600}-\u{26FF}]|[\u{2700}-\u{27BF}]/u;
    return emojiRegex.test(input);
  },

  /**
   * Download emoji image from URL
   */
  async downloadEmojiImage(emojiInfo) {
    try {
      const response = await axios.get(emojiInfo.url, {
        responseType: "arraybuffer",
        timeout: 10000,
        headers: {
          "User-Agent":
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
        },
      });

      return Buffer.from(response.data);
    } catch (error) {
      log(`Error downloading emoji image: ${error.message}`, "error");
      return null;
    }
  },
};
