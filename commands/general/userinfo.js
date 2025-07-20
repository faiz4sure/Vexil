import chalk from "chalk";
import { log } from "../../utils/functions.js";

export default {
  name: "userinfo",
  description: "Fetches and displays detailed information about a user.",
  aliases: ["ui", "user"],
  usage: "[user mention or ID]",
  category: "general",
  type: "server_only",
  permissions: ["SendMessages"],
  cooldown: 10,

  /**
   * Execute the userinfo command
   * @param {Client} client - Discord.js client instance
   * @param {Message} message - The message object
   * @param {Array} args - Command arguments
   */
  execute: async (client, message, args) => {
    let targetUser = message.author; // Default to message author
    let targetMember = null;

    if (message.guild) {
      // Attempt to find a member by mention or ID
      const fetchedMember =
        message.mentions.members.first() ||
        (await message.guild.members.fetch(args[0]).catch(() => null));

      if (fetchedMember) {
        targetMember = fetchedMember;
        targetUser = fetchedMember.user;
      } else {
        // If no specific target, use the message author's member object
        targetMember = message.member;
        targetUser = message.author;
      }
    } else {
      // In DM context, targetUser is message.author and targetMember remains null
      targetUser = message.author;
      targetMember = null;
    }

    try {
      const userStatus = targetMember?.presence?.status ?? "offline";

      // Safe role handling with proper null checks
      let userRoles = "N/A (DM)";
      let highestRole = "N/A (DM)";

      if (targetMember && targetMember.roles && targetMember.roles.cache) {
        try {
          const rolesList = targetMember.roles.cache
            .filter((role) => role.id !== message.guild?.id)
            .sort((a, b) => b.position - a.position)
            .map((role) => role.name);

          userRoles = rolesList.length > 0 ? rolesList.join(", ") : "None";
          highestRole = targetMember.roles.highest?.name || "None";
        } catch (roleError) {
          log(`Error processing roles: ${roleError.message}`, "warn");
          userRoles = "Error loading roles";
          highestRole = "Error loading role";
        }
      }

      const joinedAt = targetMember?.joinedAt
        ? targetMember.joinedAt.toUTCString()
        : targetMember
        ? "Unknown"
        : "N/A (DM)";

      const userInfoMessage = [
        `> **User Information for ${targetUser?.tag || "Unknown User"}**`,
        "> ",
        `> **ID:** ${targetUser?.id || "Unknown"} `,
        `> **Username:** ${targetUser?.username || "Unknown"} `,
        `> **Discriminator:** ${targetUser?.discriminator || "Unknown"} `,
        `> **Bot:** ${targetUser?.bot ? "Yes" : "No"}`,
        `> **Created On:** ${
          targetUser?.createdAt ? targetUser.createdAt.toUTCString() : "Unknown"
        }`,
        `> **Avatar:** ${
          targetUser?.displayAvatarURL({ dynamic: true }) || "N/A"
        }`,
        `> **Flags:** ${targetUser?.flags?.toArray().join(", ") || "None"}`,
        "> ",
        `> **Joined Server On:** ${joinedAt} `,
        `> **Status:** ${
          userStatus.charAt(0).toUpperCase() + userStatus.slice(1)
        } `,
        `> **Roles:** ${userRoles} `,
        `> **Highest Role:** ${highestRole}`,
      ].join("\n");

      if (message.channel) {
        await message.channel.send(userInfoMessage).catch((err) => {
          log(`Failed to send user info message: ${err.message}`, "error");
          return message?.channel?.send(
            "> ❌ **Error:** Failed to send user information."
          );
        });
      } else {
        log(
          "Message channel is undefined, cannot send user info message.",
          "error"
        );
      }

      log(
        `${message?.author?.tag || "Unknown User"} requested user info for "${
          targetUser?.tag || "Unknown User"
        }"`,
        "debug"
      );
    } catch (error) {
      log(
        `[ERROR] Error in userinfo command for user ${
          targetUser?.id || "Unknown"
        }: ${error.message}`,
        "error"
      );
      return message?.channel
        ?.send(
          "> ❌ **Error:** An error occurred while fetching user information."
        )
        .catch(() => {});
    }
  },
};
