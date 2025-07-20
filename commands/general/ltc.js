import { loadConfig } from "../../utils/functions.js";

export default {
  name: "ltc",
  aliases: ["litecoin", "ltcaddress"],
  description: "Display configured Litecoin address",
  usage: "ltc",
  category: "general",
  type: "both",
  permissions: ["SendMessages"],
  cooldown: 3,

  async execute(client, message, args) {
    try {
      const config = loadConfig();

      // Check if crypto section exists in config
      if (!config.crypto) {
        return message.channel.send(
          "❌ **Crypto configuration not found!**\n" +
            "Please add a `crypto` section to your config.yaml file."
        );
      }

      const ltcAddress = config.crypto.ltc;

      if (
        !ltcAddress ||
        ltcAddress.trim() === "" ||
        ltcAddress === "LTC_address_here"
      ) {
        return message.channel.send(
          "❌ **Litecoin address not configured!**\n" +
            "Please set your LTC address in the config.yaml file:\n" +
            "```yaml\n" +
            "crypto:\n" +
            '  ltc: "your_litecoin_address_here"\n' +
            "```"
        );
      }

      // Display the LTC address with nice formatting
      const response =
        `🪙 **Litecoin Address:**\n` +
        `\`\`\`${ltcAddress}\`\`\`\n` +
        `**Network:** Litecoin (LTC)\n` +
        `**Type:** Cryptocurrency Address\n\n` +
        `*Copy the address above to send Litecoin*`;

      await message.channel.send(response);
    } catch (error) {
      console.error("LTC command error:", error);
      await message.channel.send(
        "❌ **Error loading Litecoin address!**\n" +
          "Please check your configuration file."
      );
    }
  },
};
