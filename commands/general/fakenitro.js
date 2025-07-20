import { log } from "../../utils/functions.js";

export default {
  name: "fakenitro",
  description: "Generate fake Nitro gift links",
  aliases: ["nitro", "freegift"],
  usage: "[amount]",
  category: "general",
  type: "both",
  permissions: ["SendMessages"],
  cooldown: 5,

  execute: async (client, message, args) => {
    try {
      if (message.author.id !== client.user.id) return;

      // Determine how many links to generate (default: 1)
      let amount = 1;
      if (args[0] && !isNaN(args[0])) {
        amount = parseInt(args[0]);

        // Limit to a reasonable number
        if (amount < 1) amount = 1;
        if (amount > 10) amount = 10;
      }

      // Generate the specified number of fake Nitro links
      const links = [];
      for (let i = 0; i < amount; i++) {
        links.push(generateFakeNitroLink());
      }

      // Send the links
      if (links.length === 1) {
        await message.channel.send(`> 🎁 **Nitro Gift**\n> ${links[0]}`);
      } else {
        let response = `> 🎁 **${links.length} Nitro Gifts**\n`;
        links.forEach((link, index) => {
          response += `> ${index + 1}. ${link}\n`;
        });
        await message.channel.send(response);
      }

      log(`Generated ${links.length} fake Nitro gift links`, "debug");
    } catch (error) {
      log(`Error in fakenitro command: ${error.message}`, "error");
      message.channel.send(`> ❌ An error occurred: ${error.message}`);
    }
  },
};

/**
 * Generate a fake Nitro gift link
 * @returns {string} Fake Nitro gift link
 */
function generateFakeNitroLink() {
  // Generate a random 16-character code
  const code = Array(16)
    .fill(0)
    .map(() => {
      const chars =
        "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
      return chars.charAt(Math.floor(Math.random() * chars.length));
    })
    .join("");

  // Choose a random gift type
  const giftTypes = [
    "discord.gift/",
    "https://discord.gift/",
    "https://discord.com/gifts/",
  ];

  const giftType = giftTypes[Math.floor(Math.random() * giftTypes.length)];

  // Return the complete fake gift link
  return `${giftType}${code}`;
}
