import { log } from "../../utils/functions.js";
import TaskManager from "../../utils/TaskManager.js";
import RateLimitManager from "../../utils/RateLimitManager.js";
import { hasPermissions } from "../../utils/functions.js";

export default {
  name: "purge",
  description: "Purge a specified number of messages from the current channel.",
  aliases: ["clear", "delete"],
  usage: "<amount>",
  category: "moderation",
  type: "both",
  permissions: ["ManageMessages"], // Required in servers
  cooldown: 5,

  execute: async (client, message, args) => {
    const amount = parseInt(args[0]);
    if (!amount || amount <= 0 || amount > 100) {
      return message.channel.send(
        "> ❌ Please provide a valid number between 1 and 100."
      );
    }

    const channelId = message.channel.id;
    const guildId = message.guild?.id || "dm";
    const isDM = message.channel.type === "DM";
    const taskName = `purge_${channelId}`;

    // Ensure only one task runs per channel using TaskManager
    if (TaskManager.hasTask(taskName, guildId)) {
      return message.channel.send(
        "> ⚠️ Another purge task is already running for this channel."
      );
    }

    // Create a task for this purge operation
    const task = TaskManager.createTask(taskName, guildId);
    if (!task) {
      return message.channel.send("> ❌ Failed to create purge task.");
    }

    try {
      // Check permissions in servers
      if (!isDM && !hasPermissions(message.member, "ManageMessages")) {
        return message.channel.send(
          '> ❌ You need the "Manage Messages" permission to use this command.'
        );
      }

      const rateLimiter = new RateLimitManager(5); // Allow 5 concurrent operations
      let isCancelled = false;
      let deletedCount = 0;

      // Add cancellation listener
      if (task.signal) {
        task.signal.addEventListener("abort", () => {
          isCancelled = true;
          // Only log if task was actually cancelled by user, not by completion
          if (!task.signal.reason || task.signal.reason !== "completed") {
            log(
              `Purge task cancelled after deleting ${deletedCount} messages`,
              "warn"
            );
          }
        });
      }

      if (isDM) {
        // In DMs, delete only the bot's own messages
        const messages = await message.channel.messages.fetch({ limit: 100 });
        const botMessages = messages
          .filter((msg) => msg.author.id === client.user.id)
          .first(amount);

        // Create status message
        const statusMsg = await message.channel.send(
          `> ⏳ Purging ${botMessages.length} messages...`
        );

        for (const msg of botMessages) {
          if (task.signal.aborted) break;

          await rateLimiter
            .execute(async () => {
              if (task.signal.aborted) return;
              await msg.delete();
              deletedCount++;
            }, task.signal)
            .catch((error) => {
              if (task.signal.aborted || error.message.includes("cancelled"))
                return;
              log(`Error deleting message in DM: ${error.message}`, "error");
            });
        }

        if (!task.signal.aborted) {
          statusMsg
            .edit(`> ✅ Successfully purged ${deletedCount} messages.`)
            .then((msg) => {
              // Use regular setTimeout to avoid race condition with task destruction
              setTimeout(() => {
                msg.delete().catch(() => {});
              }, 5000);
            })
            .catch(() => {});
        } else {
          statusMsg
            .edit(
              `> ⚠️ Purge cancelled after deleting ${deletedCount} messages.`
            )
            .catch(() => {});
        }
      } else {
        // In servers, delete messages one by one using the rate limiter
        // First fetch the messages
        const messages = await message.channel.messages.fetch({
          limit: amount + 1,
        }); // +1 to account for the command message
        const messagesToDelete = Array.from(messages.values());

        // Send a status message
        const statusMsg = await message.channel.send(
          `> ⏳ Deleting ${messagesToDelete.length} messages...`
        );

        // Delete messages one by one
        for (const msg of messagesToDelete) {
          if (task.signal.aborted) break;

          await rateLimiter
            .execute(async () => {
              if (task.signal.aborted) return;
              await msg.delete().catch((e) => {
                log(`Failed to delete message: ${e.message}`, "warn");
              });
              deletedCount++;
            }, task.signal)
            .catch((error) => {
              if (task.signal.aborted || error.message.includes("cancelled"))
                return;
              log(`Error in rate limiter: ${error.message}`, "error");
            });
        }

        // Update status message
        if (!task.signal.aborted) {
          statusMsg
            .edit(`> ✅ Successfully purged ${deletedCount} messages.`)
            .then((msg) => {
              // Use regular setTimeout to avoid race condition with task destruction
              setTimeout(() => {
                msg.delete().catch(() => {});
              }, 5000);
            })
            .catch(() => {});
        } else {
          statusMsg
            .edit(
              `> ⚠️ Purge cancelled after deleting ${deletedCount} messages.`
            )
            .catch(() => {});
        }
      }
    } catch (error) {
      log(`Error in purge command: ${error.message}`, "error");
      message.channel.send(
        `> ❌ An error occurred while purging messages: ${error.message}`
      );
    } finally {
      // Clean up the task
      task.stop();
    }
  },
};
