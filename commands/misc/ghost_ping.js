import TaskManager from "../../utils/TaskManager.js";
import RateLimitManager from "../../utils/RateLimitManager.js";
import { log } from "../../utils/functions.js";

export default {
  name: "ghost_ping",
  description: "Send ghost pings to a specified user or channel.",
  aliases: [],
  usage: "<user_mention_or_channel_id>",
  category: "misc",
  type: "both",
  permissions: ["SendMessages"],
  cooldown: 5,

  execute: async (client, message, args) => {
    try {
      if (message.author.id !== client.user.id) return;

      const target =
        message.mentions.users.first() || client.users.cache.get(args[0]);
      if (!target) {
        return message.channel.send(
          "> ❌ Please mention a user or provide a valid user ID."
        );
      }

      const task = TaskManager.createTask(
        "ghost_ping",
        message.guild?.id || message.author.id
      );
      if (!task) {
        return message.reply("A ghost_ping task is already in progress.");
      }

      // Delete the command message to keep it hidden
      await message.delete().catch(() => {});

      try {
        const rateLimiter = new RateLimitManager(5, 5000); // Batch size: 5, Delay: 5 seconds
        let sentCount = 0;
        const totalPings = 5;

        for (let i = 0; i < totalPings; i++) {
          if (task.signal.aborted) break;

          await rateLimiter.execute(async () => {
            if (task.signal.aborted) return;
            return message.channel.send(`<@${target.id}>`).then((msg) => {
              sentCount++;
              msg.delete().catch((err) => {
                log(`Failed to delete ghost ping: ${err.message}`, "error");
              });
            });
          }, task.signal);
        }
      } catch (error) {
        log(`Error during ghost_ping task: ${error.message}`, "error");
        message.channel.send(
          "> ❌ An error occurred while sending ghost pings."
        );
      } finally {
        task.stop();
      }
    } catch (error) {
      console.error(error);
      message.channel.send("> ❌ An unexpected error occurred.");
    }
  },
};
