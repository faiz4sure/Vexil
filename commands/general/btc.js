import { loadConfig } from "../../utils/functions.js";

export default {
  name: "btc",
  aliases: ["bitcoin", "btcaddress"],
  description: "Display configured Bitcoin address",
  usage: "btc",
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

      const btcAddress = config.crypto.btc;

      if (
        !btcAddress ||
        btcAddress.trim() === "" ||
        btcAddress === "BTC_address_here"
      ) {
        return message.channel.send(
          "❌ **Bitcoin address not configured!**\n" +
            "Please set your BTC address in the config.yaml file:\n" +
            "```yaml\n" +
            "crypto:\n" +
            '  btc: "your_bitcoin_address_here"\n' +
            "```"
        );
      }

      // Display the BTC address with nice formatting
      const response =
        `₿ **Bitcoin Address:**\n` +
        `\`\`\`${btcAddress}\`\`\`\n` +
        `**Network:** Bitcoin (BTC)\n` +
        `**Type:** Cryptocurrency Address\n\n` +
        `*Copy the address above to send Bitcoin*`;

      await message.channel.send(response);
    } catch (error) {
      console.error("BTC command error:", error);
      await message.channel.send(
        "❌ **Error loading Bitcoin address!**\n" +
          "Please check your configuration file."
      );
    }
  },
};
