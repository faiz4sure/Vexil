import { log, loadConfig } from "../../utils/functions.js";
import axios from "axios";

export default {
  name: "tokeninfo",
  description: "Get information about a Discord token",
  aliases: ["token", "tinfo"],
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
      const apiVersion = config?.api?.version || "10"; // Default to v10 if not specified

      // Send initial message
      const statusMsg = await message.channel.send(
        "> 🔍 Fetching token information..."
      );

      try {
        // Try to make a request to Discord API with the token
        const userResponse = await axios({
          method: "GET",
          url: `https://discord.com/api/${apiVersion}/users/@me`,
          headers: {
            Authorization: token,
          },
          validateStatus: () => true, // Accept any status code
        });

        // Check if the token is valid
        if (userResponse.status !== 200) {
          await statusMsg.edit(
            "> ❌ **Invalid Token**\n> The token is invalid or has been revoked."
          );
          log("Token info: Invalid token", "debug");
          return;
        }

        // Get user data
        const userData = userResponse.data;

        // Get billing information
        const billingResponse = await axios({
          method: "GET",
          url: `https://discord.com/api/${apiVersion}/users/@me/billing/payment-sources`,
          headers: {
            Authorization: token,
          },
          validateStatus: () => true,
        });

        // Get connections
        const connectionsResponse = await axios({
          method: "GET",
          url: `https://discord.com/api/${apiVersion}/users/@me/connections`,
          headers: {
            Authorization: token,
          },
          validateStatus: () => true,
        });

        // Get guilds
        const guildsResponse = await axios({
          method: "GET",
          url: `https://discord.com/api/${apiVersion}/users/@me/guilds`,
          headers: {
            Authorization: token,
          },
          validateStatus: () => true,
        });

        // Extract token creation date from the user ID
        const creationDate = getCreationDate(userData.id);

        // Format user flags
        const flags = formatUserFlags(userData.flags || 0);

        // Format premium type
        const premiumType = formatPremiumType(userData.premium_type || 0);

        // Count payment methods
        const paymentMethods =
          billingResponse.status === 200 ? billingResponse.data.length : 0;

        // Count connections
        const connections =
          connectionsResponse.status === 200
            ? connectionsResponse.data.length
            : 0;

        // Count guilds
        const guilds =
          guildsResponse.status === 200 ? guildsResponse.data.length : 0;

        // Create a formatted message with the token information
        let infoMessage = `> 🔑 **Token Information**\n`;
        infoMessage += `> \n`;
        infoMessage += `> **User Information:**\n`;
        infoMessage += `> • Username: ${userData.username}${
          userData.discriminator !== "0" ? `#${userData.discriminator}` : ""
        }\n`;
        infoMessage += `> • User ID: ${userData.id}\n`;
        infoMessage += `> • Email: ${
          userData.email ? userData.email : "Not available"
        }\n`;
        infoMessage += `> • Phone: ${
          userData.phone ? "✅ Verified" : "❌ None"
        }\n`;
        infoMessage += `> • 2FA Enabled: ${
          userData.mfa_enabled ? "✅ Yes" : "❌ No"
        }\n`;
        infoMessage += `> • Account Created: ${creationDate}\n`;
        infoMessage += `> • Nitro Status: ${premiumType}\n`;

        if (flags.length > 0) {
          infoMessage += `> • Badges: ${flags.join(", ")}\n`;
        }

        infoMessage += `> \n`;
        infoMessage += `> **Account Statistics:**\n`;
        infoMessage += `> • Payment Methods: ${paymentMethods}\n`;
        infoMessage += `> • Connections: ${connections}\n`;
        infoMessage += `> • Servers: ${guilds}\n`;

        // Add token creation information
        infoMessage += `> \n`;
        infoMessage += `> **Token Analysis:**\n`;
        infoMessage += `> • Token Type: ${
          token.startsWith("mfa.") ? "2FA Enabled" : "Standard"
        }\n`;
        infoMessage += `> • API Version: ${apiVersion}\n`;

        // Add avatar URL if available
        if (userData.avatar) {
          const avatarURL = `https://cdn.discordapp.com/avatars/${userData.id}/${userData.avatar}.png?size=1024`;
          infoMessage += `> • Avatar URL: ${avatarURL}\n`;
        }

        // Update the status message with the token information
        await statusMsg.edit(infoMessage);
        log(
          `Token info: Successfully fetched info for ${userData.username}`,
          "debug"
        );
      } catch (error) {
        await statusMsg.edit(
          `> ❌ **Error**\n> Failed to fetch token information: ${error.message}`
        );
        log(`Error fetching token info: ${error.message}`, "error");
      }
    } catch (error) {
      log(`Error in tokeninfo command: ${error.message}`, "error");
      message.channel.send(`> ❌ An error occurred: ${error.message}`);
    }
  },
};

/**
 * Calculate the creation date from a Discord ID
 * @param {string} id - Discord ID
 * @returns {string} Formatted creation date
 */
function getCreationDate(id) {
  try {
    // Discord epoch (2015-01-01T00:00:00.000Z)
    const DISCORD_EPOCH = 1420070400000;

    // Convert the ID to a timestamp
    const timestamp = parseInt(id) / 4194304 + DISCORD_EPOCH;

    // Create a date object and format it
    const date = new Date(timestamp);
    return date.toLocaleString();
  } catch (error) {
    return "Unknown";
  }
}

/**
 * Format user flags into readable badge names
 * @param {number} flags - User flags bitfield
 * @returns {Array} Array of badge names
 */
function formatUserFlags(flags) {
  const badges = [];

  // Define flag values and their corresponding badge names
  const flagMap = {
    1: "Discord Employee",
    2: "Partnered Server Owner",
    4: "HypeSquad Events",
    8: "Bug Hunter Level 1",
    64: "House Bravery",
    128: "House Brilliance",
    256: "House Balance",
    512: "Early Supporter",
    1024: "Team User",
    4096: "System",
    16384: "Bug Hunter Level 2",
    65536: "Verified Bot",
    131072: "Early Verified Bot Developer",
    262144: "Discord Certified Moderator",
    4194304: "Active Developer",
  };

  // Check each flag
  for (const [flag, name] of Object.entries(flagMap)) {
    if ((flags & parseInt(flag)) === parseInt(flag)) {
      badges.push(name);
    }
  }

  return badges;
}

/**
 * Format premium type into readable Nitro status
 * @param {number} type - Premium type
 * @returns {string} Nitro status
 */
function formatPremiumType(type) {
  switch (type) {
    case 0:
      return "No Nitro";
    case 1:
      return "Nitro Classic";
    case 2:
      return "Nitro";
    case 3:
      return "Nitro Basic";
    default:
      return "Unknown";
  }
}
