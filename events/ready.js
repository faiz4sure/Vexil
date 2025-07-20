/**
 * READY EVENT HANDLER
 *
 * This event handler is triggered when the Discord client is fully initialized
 * and ready to start operating. It handles:
 * - Displaying startup information and system details
 * - Setting the user's Discord status
 * - Configuring Rich Presence (custom activity status)
 * - Initializing relationship tracking and debugging features
 * - Final startup confirmation and ready state logging
 *
 * This is a one-time event that fires only once per bot session when the
 * connection to Discord is established and all initial data is loaded.
 *
 * @module events/ready
 * @author faiz4sure
 */

import chalk from "chalk";
import { log } from "../utils/functions.js";
import { RichPresence, Util } from "discord.js-selfbot-rpc";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

// Get current directory path for ES modules
const __dirname = path.dirname(fileURLToPath(import.meta.url));

export default {
  name: "ready",
  once: true,

  /**
   * Handle the ready event when the Discord client is fully initialized
   *
   * @async
   * @function execute
   * @param {Client} client - Discord.js client instance
   * @description Executes when the bot successfully connects to Discord and is
   *              ready to start processing events and commands. Sets up the
   *              final configuration, displays startup information, and
   *              initializes Rich Presence features.
   */
  execute: async (client) => {
    // Display visual separator for clean startup output
    console.log(chalk.cyan("─".repeat(50)));

    // Display essential bot information
    log(`Logged in as ${chalk.cyan(client.user.tag)}`, "success");
    log(`User ID: ${chalk.cyan(client.user.id)}`, "info");
    log(`Prefix: ${chalk.cyan(client.prefix)}`, "info");
    log(`Status: ${chalk.cyan(client.config.selfbot.status)}`, "info");

    // Display helpful usage information
    console.log("");
    log(
      `Use ${chalk.cyan(
        `${client.prefix}help`
      )} to get info about available commands`,
      "info"
    );

    // Display system environment information
    console.log("");
    log("System Information:", "info");
    console.log(
      `  ${chalk.yellow("•")} ${chalk.yellow("Node.js")}: ${chalk.green(
        process.version
      )}`
    );
    console.log(
      `  ${chalk.yellow("•")} ${chalk.yellow("Platform")}: ${chalk.green(
        process.platform
      )}`
    );

    // Display closing separator
    console.log(chalk.cyan("─".repeat(50)));

    // Set the user's Discord status as configured
    client.user.setStatus(client.config.selfbot.status);

    // Setup Rich Presence (custom activity status)
    const rpcFilePath = path.join(__dirname, "../data/rpc.json");

    let rpcConfig = {};
    try {
      // Load Rich Presence configuration from file
      if (fs.existsSync(rpcFilePath)) {
        rpcConfig = JSON.parse(fs.readFileSync(rpcFilePath, "utf8"));
      } else {
        // Create a new rpc.json file with default structure if it doesn't exist
        fs.writeFileSync(rpcFilePath, '{"enabled": true}', "utf8");
      }
    } catch (error) {
      console.error("Error reading rpc.json:", error);
      // Create a new rpc.json with default structure if there's an error reading
      fs.writeFileSync(rpcFilePath, '{"enabled": true}', "utf8");
      log("Created new rpc.json file after encountering read error.", "warn");
      rpcConfig = { enabled: true };
    }

    // Check if RPC is permanently disabled
    if (rpcConfig.enabled === false) {
      client.user.setActivity(null);
      log("Rich Presence is permanently disabled.", "info");
    }
    // Use custom RPC if available
    else if (rpcConfig.custom) {
      const presence = new RichPresence();
      // Set properties from rpcConfig.custom
      if (rpcConfig.custom.details)
        presence.setDetails(rpcConfig.custom.details);
      if (rpcConfig.custom.state) presence.setState(rpcConfig.custom.state);
      if (rpcConfig.custom.type) presence.setType(rpcConfig.custom.type);

      // Ensure name is always a string
      const rpcName =
        typeof rpcConfig.custom.name === "string"
          ? rpcConfig.custom.name
          : client.config.rich_presence.default &&
            typeof client.config.rich_presence.default.name === "string"
          ? client.config.rich_presence.default.name
          : "Selfbot"; // Fallback to default config name or generic
      presence.setName(rpcName);

      // Ensure application_id is always a string
      const rpcApplicationId =
        typeof rpcConfig.custom.application_id === "string"
          ? rpcConfig.custom.application_id
          : client.config.rich_presence.default &&
            typeof client.config.rich_presence.default.application_id ===
              "string"
          ? client.config.rich_presence.default.application_id
          : "1306468377539379241"; // Fallback to default config ID or hardcoded
      presence.setApplicationId(rpcApplicationId);

      if (rpcConfig.custom.timestamps) {
        if (rpcConfig.custom.timestamps.start)
          presence.setTimestamp(rpcConfig.custom.timestamps.start);
        if (rpcConfig.custom.timestamps.end)
          presence.setEndTimestamp(rpcConfig.custom.timestamps.end);
      }

      // Handle assets (images and text)
      if (rpcConfig.custom.assets) {
        // Use the determined rpcApplicationId for assets
        if (rpcConfig.custom.assets.large_image) {
          try {
            const largeImage = await Util.getAssets(
              rpcApplicationId,
              rpcConfig.custom.assets.large_image
            );
            if (largeImage) {
              presence.setAssetsLargeImage(largeImage.id);
            } else {
              console.warn(
                `Asset not found for large_image: ${rpcConfig.custom.assets.large_image}`
              );
            }
          } catch (error) {
            console.error(`Error fetching large_image asset: ${error.message}`);
          }
        }
        if (rpcConfig.custom.assets.large_text) {
          presence.setAssetsLargeText(rpcConfig.custom.assets.large_text);
        }
        if (rpcConfig.custom.assets.small_image) {
          try {
            const smallImage = await Util.getAssets(
              rpcApplicationId,
              rpcConfig.custom.assets.small_image
            );
            if (smallImage) {
              presence.setAssetsSmallImage(smallImage.id);
            } else {
              console.warn(
                `Asset not found for small_image: ${rpcConfig.custom.assets.small_image}`
              );
            }
          } catch (error) {
            console.error(`Error fetching small_image asset: ${error.message}`);
          }
        }
        if (rpcConfig.custom.assets.small_text) {
          presence.setAssetsSmallText(rpcConfig.custom.assets.small_text);
        }
      }

      // Set status from client.config.selfbot.status
      presence.setStatus(client.config.selfbot.status);

      client.user.setPresence(presence.toData());
      log("Custom Rich Presence has been set from rpc.json.", "success");
    }
    // Fallback to default RPC if enabled in config
    else if (
      client.config.rich_presence &&
      client.config.rich_presence.enabled
    ) {
      const applicationId = "1306468377539379241"; // From sample-rpc.js
      try {
        const largeImage = await Util.getAssets(applicationId, "vexil");
        const smallImage = await Util.getAssets(applicationId, "thunder");

        const presence = new RichPresence()
          .setStatus(client.config.selfbot.status)
          .setType("PLAYING")
          .setApplicationId(applicationId)
          .setName("Vexil Selfbot")
          .setDetails("Summoning Silence")
          .setState("github.com/faiz4sure")
          .setAssetsLargeImage(largeImage.id)
          .setAssetsLargeText("Vexil")
          .setAssetsSmallImage(smallImage.id)
          .setAssetsSmallText("github.com/faiz4sure")
          .setTimestamp();

        client.user.setPresence(presence.toData());
        log("Default Rich Presence has been set.", "success");
      } catch (error) {
        log(`Failed to set Default Rich Presence: ${error.message}`, "error");
      }
    } else {
      log("Rich Presence is not configured and disabled in config.", "info");
    }

    // Debug relationship information if debug mode is enabled
    if (client.config.debug_mode && client.config.debug_mode.enabled) {
      // Log relationship manager info
      log("Relationship Manager Information:", "debug");

      // Check if relationships are available
      if (client.relationships) {
        const friends = client.relationships.cache.filter(
          (r) => r.type === "FRIEND"
        ).size;
        const blocked = client.relationships.cache.filter(
          (r) => r.type === "BLOCKED"
        ).size;
        const incoming = client.relationships.cache.filter(
          (r) => r.type === "INCOMING_REQUEST"
        ).size;
        const outgoing = client.relationships.cache.filter(
          (r) => r.type === "OUTGOING_REQUEST"
        ).size;

        log(`Friends: ${chalk.green(friends)}`, "debug");
        log(`Blocked: ${chalk.red(blocked)}`, "debug");
        log(`Incoming Requests: ${chalk.yellow(incoming)}`, "debug");
        log(`Outgoing Requests: ${chalk.yellow(outgoing)}`, "debug");

        // Register additional event listeners for debugging
        client.on("relationshipAdd", (relationship) => {
          if (client.config.debug_mode.enabled) {
            const relationshipType =
              typeof relationship === "string" ? "unknown" : relationship.type;
            const userId =
              typeof relationship === "string" ? relationship : relationship.id;
            log(
              `[DEBUG] relationshipAdd event fired: ${relationshipType} - ${userId}`,
              "debug"
            );
          }
        });

        client.on("relationshipRemove", (relationship) => {
          if (client.config.debug_mode.enabled) {
            const relationshipType =
              typeof relationship === "string" ? "unknown" : relationship.type;
            const userId =
              typeof relationship === "string" ? relationship : relationship.id;
            log(
              `[DEBUG] relationshipRemove event fired: ${relationshipType} - ${userId}`,
              "debug"
            );
          }
        });

        client.on("presenceUpdate", (oldPresence, newPresence) => {
          if (client.config.debug_mode.enabled && newPresence.user) {
            const isFriend =
              client.relationships.cache.has(newPresence.user.id) &&
              client.relationships.cache.get(newPresence.user.id).type ===
                "FRIEND";

            if (isFriend) {
              log(
                `[DEBUG] presenceUpdate event fired for friend: ${newPresence.user.tag}`,
                "debug"
              );
            }
          }
        });

        client.on("userUpdate", (oldUser, newUser) => {
          if (client.config.debug_mode.enabled) {
            const isFriend =
              client.relationships.cache.has(newUser.id) &&
              client.relationships.cache.get(newUser.id).type === "FRIEND";

            if (isFriend) {
              log(
                `[DEBUG] userUpdate event fired for friend: ${newUser.tag}`,
                "debug"
              );
            }
          }
        });
      } else {
        log("Relationship manager is not available!", "warn");
      }
    }

    log(`Vexil is ready with ${client.commands.size} commands`, "success");
  },
};
