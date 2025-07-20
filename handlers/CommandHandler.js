/**
 * COMMAND HANDLER
 *
 * This module handles the loading, registration, and execution of all bot commands.
 * It provides a comprehensive command system with features like:
 * - Automatic command discovery and loading
 * - Category-based organization
 * - Cooldown management
 * - Permission checking
 * - Alias support
 * - Error handling and logging
 *
 * The handler scans the commands directory recursively, loads all valid command files,
 * and sets up the message event listener for command execution.
 *
 * @module handlers/CommandHandler
 * @author faiz4sure
 */

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import chalk from "chalk";
import { log, parseArgs, formatTime } from "../utils/functions.js";

// Get current file path for ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Load and register all commands from the commands directory
 *
 * @async
 * @function loadCommands
 * @param {Client} client - Discord.js client instance
 * @returns {Promise<number>} Number of successfully loaded commands
 * @description Recursively scans the commands directory, loads all valid command files,
 *              registers them with the client, and sets up the message event handler
 *              for command execution. Also handles command validation and categorization.
 *
 * @example
 * // Load all commands during bot initialization
 * const commandCount = await loadCommands(client);
 * console.log(`Loaded ${commandCount} commands`);
 */
export async function loadCommands(client) {
  try {
    // Initialize commands collection if not already present
    if (!client.commands) client.commands = new Map();

    // Get path to commands directory
    const commandsDir = path.join(__dirname, "..", "commands");

    // Recursively find all command files
    const commandFiles = getCommandFiles(commandsDir);

    log(`Loading ${commandFiles.length} commands...`, "info");

    let loadedCount = 0;
    const categories = new Map();

    // Process each command file
    for (const filePath of commandFiles) {
      try {
        // Dynamically import the command module
        const command = await import(`file://${filePath}`);

        // Validate command structure
        if (
          !command.default ||
          !command.default.name ||
          !command.default.execute
        ) {
          log(
            `Skipping invalid command file: ${path.basename(filePath)}`,
            "warn"
          );
          continue;
        }

        // Extract category from file path structure
        const pathParts = filePath.split(path.sep);
        const categoryIndex = pathParts.indexOf("commands") + 1;
        const category = pathParts[categoryIndex] || "general";

        // Add category information to command object
        command.default.category = category;

        // Register command in the client's command collection
        client.commands.set(command.default.name, command.default);

        // Track categories for summary
        if (!categories.has(category)) {
          categories.set(category, 0);
        }
        categories.set(category, categories.get(category) + 1);

        loadedCount++;
        log(`Loaded command: ${command.default.name} (${category})`, "success");
      } catch (error) {
        log(
          `Error loading command file ${path.basename(filePath)}: ${
            error.message
          }`,
          "error"
        );
      }
    }

    // Log summary
    log(
      `Successfully loaded ${loadedCount} commands in ${categories.size} categories`,
      "success"
    );
    categories.forEach((count, category) => {
      log(`  - ${category}: ${count} commands`, "info");
    });

    // Set up message event handler for commands
    client.on("messageCreate", async (message) => {
      // Ignore messages from bots or messages that don't start with the prefix
      if (message.author.bot || !message.content.startsWith(client.prefix))
        return;

      // CRITICAL SECURITY CHECK: Only allow the selfbot account to execute commands
      if (message.author.id !== client.user.id) {
        return; // Silently ignore commands from other users
      }

      // Parse command and arguments
      const content = message.content.slice(client.prefix.length).trim();
      const args = parseArgs(content);
      const commandName = args.shift().toLowerCase();

      // Find command
      const command =
        client.commands.get(commandName) ||
        [...client.commands.values()].find(
          (cmd) => cmd.aliases && cmd.aliases.includes(commandName)
        );

      if (!command) return;

      // Check cooldowns
      if (!client.cooldowns.has(command.name)) {
        client.cooldowns.set(command.name, new Map());
      }

      const now = Date.now();
      const timestamps = client.cooldowns.get(command.name);
      const cooldownAmount = (command.cooldown || 3) * 1000;

      if (timestamps.has(message.author.id)) {
        const expirationTime =
          timestamps.get(message.author.id) + cooldownAmount;

        if (now < expirationTime) {
          const timeLeft = (expirationTime - now) / 1000;
          // Don't send cooldown message for the first command execution
          if (client.lastCommandTime && now - client.lastCommandTime < 3000) {
            return message.channel.send(
              `Please wait ${timeLeft.toFixed(
                1
              )} more second(s) before reusing the \`${command.name}\` command.`
            );
          }
          return; // Just silently ignore if it's the first attempt
        }
      }

      client.lastCommandTime = now;
      timestamps.set(message.author.id, now);
      setTimeout(() => timestamps.delete(message.author.id), cooldownAmount);

      // Execute command with type and permission checks
      try {
        const startTime = Date.now();

        // Validate message context before execution
        if (!message || !message.author || !message.content) {
          console.error("Invalid message context in command execution");
          return;
        }

        // Import the command handler utility
        const { canExecuteCommand } = await import(
          "../utils/commandHandler.js"
        );

        // Check if the command can be executed
        const { canExecute, reason } = canExecuteCommand(
          command,
          message,
          client
        );

        if (!canExecute) {
          // Send the reason to the user
          message.channel.send(`> ❌ **Error:** ${reason}`);
          return;
        }

        // Check if it's an NSFW command and if NSFW is enabled in config
        if (command.category === "nsfw") {
          // Load config to check if NSFW is enabled
          const { loadConfig } = await import("../utils/functions.js");
          const config = loadConfig();

          // Check if NSFW is disabled in config
          if (!config.nsfw || config.nsfw.enabled === false) {
            message.channel.send(
              "> ❌ **NSFW commands are disabled.** Enable them in the config file."
            );
            return;
          }
        }

        // Execute the command
        await command.execute(client, message, args);
        const executionTime = Date.now() - startTime;

        // Log command execution
        const location = message.guild
          ? `${message.guild.name} (${message.guild.id})`
          : "DM";

        log(
          `${message.author.tag} used command ${command.name} in ${location} (took ${executionTime}ms)`,
          "debug"
        );
      } catch (error) {
        log(
          `Error executing command ${command.name}: ${error.message}`,
          "error"
        );
        if (message?.channel) {
          message.channel.send(
            "> ❌ **Error:** There was an error trying to execute that command!"
          );
        }
      }
    });

    return loadedCount;
  } catch (error) {
    log(`Error loading commands: ${error.message}`, "error");
    return 0;
  }
}

/**
 * Recursively gets all command files from the commands directory
 * @param {string} directory - Directory to search for command files
 * @param {Array} files - Array to store found files
 * @returns {Array} Array of command file paths
 */
function getCommandFiles(directory, files = []) {
  const items = fs.readdirSync(directory, { withFileTypes: true });

  for (const item of items) {
    const fullPath = path.join(directory, item.name);

    if (item.isDirectory()) {
      getCommandFiles(fullPath, files);
    } else if (item.name.endsWith(".js")) {
      files.push(fullPath);
    }
  }

  return files;
}
