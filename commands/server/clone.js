import TaskManager from "../../utils/TaskManager.js";
import RateLimitManager from "../../utils/RateLimitManager.js";
import { log, loadConfig } from "../../utils/functions.js";
import chalk from "chalk";

export default {
  name: "clone",
  description: "Clones roles and channels from an old server to a new server.",
  aliases: ["copy"],
  usage: "clone <oldServerId> <newServerId>",
  category: "server",
  type: "server_only",
  permissions: ["Administrator"],
  cooldown: 60,

  /**
   * Execute the clone command
   * @param {Client} client - Discord.js client instance
   * @param {Message} message - The message object
   * @param {Array} args - Command arguments
   */
  execute: async (client, message, args) => {
    try {
      if (message.author.id !== client.user.id) return;

      const task = TaskManager.createTask("clone", message.guild.id);
      if (!task) {
        return message.reply(
          "A clone task is already in progress for this server."
        );
      }

      try {
        let isCancelled = false;
        let clonedRoles = 0;
        let clonedChannels = 0;

        // Initialize RateLimitManager
        const rateLimiter = new RateLimitManager(5, 5000); // Batch size: 5, Delay: 5 seconds

        // Delete the command message
        await rateLimiter.execute(() =>
          message.delete().catch((err) => {
            log(`Failed to delete command message: ${err.message}`, "error");
          })
        );

        // Get old and new server IDs from args
        const oldServerId = args[0];
        const newServerId = args[1];

        if (!oldServerId || !newServerId) {
          return message.reply("Usage: !clone <oldServerId> <newServerId>");
        }

        const oldServer = client.guilds.cache.get(oldServerId);
        const newServer = client.guilds.cache.get(newServerId);

        if (!oldServer || !newServer) {
          return message.reply("Invalid server IDs provided.");
        }

        // Check if the bot has administrator permissions in the new server
        const botMember = newServer.members.me;
        if (!botMember.permissions.has("Administrator")) {
          return message.reply(
            "The bot requires Administrator permissions in the new server to execute this command."
          );
        }

        log(
          `Starting cloning process from server ${oldServer.name} (${oldServer.id}) to server ${newServer.name} (${newServer.id})`,
          "debug"
        );

        // Add cancellation listener
        if (task.signal) {
          task.signal.addEventListener("abort", () => {
            if (!task.signal.reason || task.signal.reason !== "completed") {
              isCancelled = true;
              log(
                `Clone task cancelled after cloning ${clonedRoles} roles and ${clonedChannels} channels`,
                "warn"
              );
            }
          });
        }

        // Clone roles with added delay
        const oldRoles = Array.from(oldServer.roles.cache.values()).sort(
          (a, b) => a.position - b.position
        );
        for (const [index, role] of oldRoles.entries()) {
          if (task.signal.aborted) break;

          if (role.name === "@everyone") continue;

          // Introduce delay: 30 seconds per role with cancellation support
          await new Promise((resolve) => {
            const timeout = setTimeout(resolve, 30000);
            if (task.signal) {
              task.signal.addEventListener("abort", () => {
                clearTimeout(timeout);
                resolve();
              });
            }
          });

          if (task.signal.aborted) break;

          await rateLimiter.execute(async () => {
            if (task.signal.aborted) return;
            return newServer.roles
              .create(
                {
                  name: role.name,
                  color: role.color,
                  hoist: role.hoist,
                  permissions: role.permissions,
                  mentionable: role.mentionable,
                  position: role.position,
                },
                {
                  reason: "Role cloning initiated by selfbot",
                }
              )
              .catch((err) => {
                log(
                  `Failed to clone role ${role.name} (${role.id}): ${err.message}`,
                  "error"
                );
              });
          }, task.signal);
          clonedRoles++;
        }

        if (task.signal.aborted) {
          log(
            `Clone task was cancelled. Cloned ${clonedRoles} roles and ${clonedChannels} channels`,
            "warn"
          );
          return;
        }

        log(`All roles cloned successfully`, "debug");

        // Clone channels with added delay
        const oldChannels = Array.from(oldServer.channels.cache.values()).sort(
          (a, b) => a.position - b.position
        );
        for (const [index, channel] of oldChannels.entries()) {
          if (task.signal.aborted) break;

          // Introduce delay: 30 seconds per channel with cancellation support
          await new Promise((resolve) => {
            const timeout = setTimeout(resolve, 30000);
            if (task.signal) {
              task.signal.addEventListener("abort", () => {
                clearTimeout(timeout);
                resolve();
              });
            }
          });

          if (task.signal.aborted) break;

          await rateLimiter.execute(async () => {
            if (task.signal.aborted) return;
            return newServer.channels
              .create(channel.name, {
                type: channel.type,
                topic: channel.topic,
                nsfw: channel.nsfw,
                parent: channel.parent,
                permissionOverwrites: channel.permissionOverwrites,
                rateLimitPerUser: channel.rateLimitPerUser,
                position: channel.position,
                reason: "Channel cloning initiated by selfbot",
              })
              .catch((err) => {
                log(
                  `Failed to clone channel ${channel.name} (${channel.id}): ${err.message}`,
                  "error"
                );
              });
          }, task.signal);
          clonedChannels++;
        }

        if (!task.signal.aborted) {
          log(`All channels cloned successfully`, "debug");
          log(`Cloning process completed successfully`, "success");
        }
      } catch (err) {
        log(`An error occurred during the clone task: ${err.message}`, "error");
        console.error(chalk.red("[ERROR] Error in clone command:"), err);
      } finally {
        task.stop();
      }
    } catch (error) {
      console.error(chalk.red("[ERROR] Error in clone command:"), error);
      message.channel.send(
        "> ❌ **Error:** An error occurred while executing the clone command."
      );
    }
  },
};

//
