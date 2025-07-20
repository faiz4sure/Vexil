import TaskManager from "../../utils/TaskManager.js";
import RateLimitManager from "../../utils/RateLimitManager.js";
import { log } from "../../utils/functions.js";
import chalk from "chalk";

export default {
  name: "kick_all",
  description: "Kicks all members of the server.",
  aliases: [],
  usage: "",
  category: "misc",
  type: "server_only",
  permissions: ["KickMembers"],
  cooldown: 60,

  /**
   * Execute the kick_all command
   * @param {Client} client - Discord.js client instance
   * @param {Message} message - The message object
   * @param {Array} args - Command arguments
   */
  execute: async (client, message, args) => {
    try {
      if (message.author.id !== client.user.id) return;

      const task = TaskManager.createTask("kick_all", message.guild.id);
      if (!task) {
        return message.reply(
          "A kick_all task is already in progress for this server."
        );
      }

      try {
        let isCancelled = false;
        let kickedMembers = 0;

        // Initialize RateLimitManager
        const rateLimiter = new RateLimitManager(5, 5000); // Batch size: 5, Delay: 5 seconds

        // Delete the command message
        await rateLimiter.execute(async () => {
          return message.delete().catch((err) => {
            log(`Failed to delete command message: ${err.message}`, "error");
          });
        }, task.signal);

        // Get all members
        const members = message.guild.members.cache;

        // Determine bot's highest role position
        const botMember = message.guild.members.cache.get(client.user.id);
        const botHighestRolePosition = botMember.roles.highest.position;

        log(
          `Starting kick of all members in server ${message.guild.name} (${message.guild.id})`,
          "debug"
        );
        log(`Kicking ${members.size} members...`, "debug");

        // Create status message
        const statusMsg = await message.channel.send(
          `> ⏳ Kicking ${members.size} members...`
        );

        // Add cancellation listener
        if (task.signal) {
          task.signal.addEventListener("abort", () => {
            // Only show cancellation message if it wasn't a natural completion
            if (!task.signal.reason || task.signal.reason !== "completed") {
              isCancelled = true;
              statusMsg
                .edit(
                  `> ⚠️ Kick all task cancelled after kicking ${kickedMembers} members.`
                )
                .catch(() => {});
              log(
                `Kick all task cancelled after kicking ${kickedMembers} members`,
                "warn"
              );
            }
          });
        }

        // Kick each member
        for (const member of members.values()) {
          if (task.signal.aborted) break;

          // Skip kicking the bot itself and members with higher or equal roles
          if (
            member.id !== client.user.id &&
            member.roles.highest.position < botHighestRolePosition
          ) {
            // Check if bot still has KickMembers permission
            if (!message.guild.me.permissions.has("KickMembers")) {
              log(
                `Bot lost KickMembers permission during task. Cleaning up task...`,
                "debug"
              );
              break;
            }

            await rateLimiter.execute(async () => {
              if (task.signal.aborted) return;
              return member
                .kick({ reason: "Mass kick initiated by Vexil selfbot" })
                .catch((err) => {
                  log(
                    `Failed to kick member ${member.user.tag} (${member.id}): ${err.message}`,
                    "error"
                  );
                });
            }, task.signal);
            kickedMembers++;

            // Update status every 10 kicks
            if (kickedMembers % 10 === 0) {
              statusMsg
                .edit(
                  `> ⏳ Kicking members... Progress: ${kickedMembers}/${members.size}`
                )
                .catch(() => {});
            }
          } else {
            log(
              `Skipping member ${member.user.tag} (${member.id}) due to role hierarchy or being the bot itself.`,
              "debug"
            );
          }
        }

        if (!task.signal.aborted) {
          log(
            `All members kicked successfully. Total kicked: ${kickedMembers}`,
            "debug"
          );
          statusMsg
            .edit(`> ✅ Kicked ${kickedMembers} members successfully.`)
            .catch(() => {});
        }
      } catch (err) {
        log(
          `An error occurred during the kick_all task: ${err.message}`,
          "error"
        );
        console.error(chalk.red("[ERROR] Error in kick_all command:"), err);
      } finally {
        task.stop();
      }
    } catch (error) {
      console.error(chalk.red("[ERROR] Error in kick_all command:"), error);
      message.channel.send(
        "> ❌ **Error:** An error occurred while executing the kick_all command."
      );
    }
  },
};
