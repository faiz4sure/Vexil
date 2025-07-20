import { log, loadConfig } from "../../utils/functions.js";
import axios from "axios";

export default {
  name: "tokencheck",
  description: "Check if a Discord token is valid",
  aliases: ["checktoken", "validtoken"],
  usage: "<token>",
  category: "general",
  type: "both",
  permissions: ["SendMessages"],
  cooldown: 5,

  execute: async (client, message, args) => {
    try {
      if (message.author.id !== client.user.id) return;

      // Delete the command message for security
      try {
        await message.delete();
      } catch (error) {
        log(`Could not delete command message: ${error.message}`, "warn");
      }

      // Check if a token was provided
      if (!args[0]) {
        return message.channel.send("> ❌ Please provide a token to check.");
      }

      const token = args[0];

      // Load config to get API version
      const config = loadConfig();
      const apiVersion = config?.api?.version || "v10"; // Default to v10 if not specified

      // Send initial message
      const statusMsg = await message.channel.send(
        "> 🔍 Checking token validity..."
      );

      try {
        // Try to make a request to Discord API with the token
        const response = await axios({
          method: "GET",
          url: `https://discord.com/api/${apiVersion}/users/@me`,
          headers: {
            Authorization: token,
          },
          validateStatus: () => true, // Accept any status code
        });

        // Check the response status
        if (response.status === 200) {
          await statusMsg.edit(
            `> ✅ **Valid Token**\n> The token is valid and belongs to **${
              response.data.username
            }${
              response.data.discriminator !== "0"
                ? `#${response.data.discriminator}`
                : ""
            }** (ID: ${response.data.id})`
          );
          log(`Token check: Valid token for ${response.data.username}`, "debug");
        } else if (response.status === 401) {
          await statusMsg.edit(
            "> ❌ **Invalid Token**\n> The token is invalid or has been revoked."
          );
          log("Token check: Invalid token", "debug");
        } else {
          await statusMsg.edit(
            `> ⚠️ **Unknown Status**\n> The token check returned status code ${response.status}.`
          );
          log(`Token check: Unknown status ${response.status}`, "warn");
        }
      } catch (error) {
        await statusMsg.edit(
          `> ❌ **Error**\n> Failed to check token: ${error.message}`
        );
        log(`Error checking token: ${error.message}`, "error");
      }
    } catch (error) {
      log(`Error in tokencheck command: ${error.message}`, "error");
      message.channel.send(`> ❌ An error occurred: ${error.message}`);
    }
  },
};
