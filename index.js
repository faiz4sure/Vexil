/**
 * VEXIL SELFBOT - Main Entry Point
 *
 * A powerful Discord selfbot with comprehensive features including:
 * - Command handling with cooldowns and permissions
 * - Event handling for message tracking and stalking
 * - Task management for long-running operations
 * - Rate limit handling to prevent API abuse
 * - Proper signal handling for graceful shutdown
 *
 * WARNING: Selfbots violate Discord's Terms of Service
 * Use at your own risk - accounts may be terminated
 *
 * @author faiz4sure
 * @version 1.0.0
 */

// Import required Discord.js modules
import { Client } from "discord.js-selfbot-v13";

// Import styling and display modules
import chalk from "chalk";
import figlet from "figlet";
import gradient from "gradient-string";

// Import core handlers for bot functionality
import { loadEvents } from "./handlers/EventsHandler.js";
import { loadCommands } from "./handlers/CommandHandler.js";
import { setupAntiCrash } from "./handlers/anticrash.js";
import { setupRateLimit } from "./handlers/RateLimitHandler.js";

// Import utility modules
import { loadConfig, clearConsole, log, wait } from "./utils/functions.js";
import TaskManager from "./utils/TaskManager.js";

// Import additional features
import { initNitroSniper } from "./commands/general/nitrosniper.js";

// Global variables for graceful shutdown
let isShuttingDown = false;
let client = null;

/**
 * Display a fancy ASCII art banner with gradient colors
 * Shows the selfbot name and important warnings
 *
 * @function displayBanner
 * @description Creates an eye-catching startup banner using figlet ASCII art
 *              with gradient colors. Falls back to simple text if figlet fails.
 */
function displayBanner() {
  try {
    // Create a blue gradient for the ASCII art
    const coolGradient = gradient(["#00FFFF", "#0099FF", "#0033FF", "#0000FF"]);

    // Generate ASCII art text using figlet library
    const asciiArt = figlet.textSync("Vexil", {
      font: "Standard", // Use standard figlet font
      horizontalLayout: "default", // Default horizontal spacing
      verticalLayout: "default", // Default vertical spacing
      width: 80, // Maximum width of 80 characters
      whitespaceBreak: true, // Break on whitespace
    });

    // Display the styled banner
    console.log("\n");
    console.log(coolGradient(asciiArt));
    console.log("\n");
    console.log(chalk.cyan("> ") + chalk.gray("A powerful Discord selfbot"));
    console.log(chalk.cyan("> ") + chalk.gray("Support server: https://discord.gg/pREvj3cEvY"));
    console.log(
      chalk.cyan("> ") +
        chalk.gray("Use at your own risk - selfbots violate Discord's ToS")
    );
    console.log(chalk.cyan("> ") + chalk.gray("Developed by faiz4sure"));
    console.log("\n");
  } catch (error) {
    // Fallback to simple banner if figlet library fails
    console.log("\n");
    console.log(chalk.cyan("=".repeat(50)));
    console.log(chalk.cyan("                     VEXIL SELFBOT"));
    console.log(chalk.cyan("=".repeat(50)));
    console.log("\n");
  }
}

/**
 * Validate Discord bot token format and presence
 *
 * @function validateToken
 * @param {string} token - The Discord bot token to validate
 * @returns {Object} - Validation result with isValid boolean and error message
 * @description Checks if the provided token matches Discord's token format
 *              and provides helpful error messages for common issues
 */
function validateToken(token) {
  // Check if token exists
  if (!token) {
    return {
      isValid: false,
      error: "No token provided in config.yaml. Please add your Discord token.",
    };
  }

  // Check if token is a string
  if (typeof token !== "string") {
    return {
      isValid: false,
      error: "Token must be a string. Check your config.yaml format.",
    };
  }

  // Check if token is not empty or just whitespace
  if (!token.trim()) {
    return {
      isValid: false,
      error: "Token is empty. Please provide a valid Discord token.",
    };
  }

  // Check basic Discord token format (should be base64-like)
  // Discord tokens are typically 59+ characters long
  if (token.length < 50) {
    return {
      isValid: false,
      error:
        "Token appears to be too short. Discord tokens are typically 59+ characters.",
    };
  }

  // Check for common placeholder values
  const placeholders = [
    "YOUR_TOKEN_HERE",
    "DISCORD_TOKEN",
    "TOKEN",
    "your_token",
    "paste_token_here",
    "YOUR_DISCORD_TOKEN",
  ];

  if (
    placeholders.some((placeholder) =>
      token.toLowerCase().includes(placeholder.toLowerCase())
    )
  ) {
    return {
      isValid: false,
      error:
        "Token appears to be a placeholder. Please replace with your actual Discord token.",
    };
  }

  // Basic format check - Discord tokens typically have dots
  if (!token.includes(".")) {
    return {
      isValid: false,
      error:
        "Token format appears invalid. Discord tokens typically contain dots (.).",
    };
  }

  // If all checks pass
  return {
    isValid: true,
    error: null,
  };
}

/**
 * Setup comprehensive signal handlers for graceful shutdown
 * Handles SIGINT (Ctrl+C), SIGTERM, and other termination signals
 *
 * @function setupSignalHandlers
 * @param {Client} discordClient - The Discord client instance
 * @description Registers signal handlers to ensure proper cleanup when the process
 *              is terminated. Prevents data loss and ensures all tasks are completed.
 */
function setupSignalHandlers(discordClient) {
  /**
   * Graceful shutdown handler
   * Cleans up all resources and exits properly
   *
   * @param {string} signal - The signal that triggered the shutdown
   * @param {number} exitCode - The exit code to use (default: 0)
   */
  const gracefulShutdown = async (signal, exitCode = 0) => {
    // Prevent multiple shutdown attempts
    if (isShuttingDown) {
      log("Shutdown already in progress...", "warn");
      return;
    }

    isShuttingDown = true;
    log(`\nReceived ${signal} signal, initiating graceful shutdown...`, "warn");

    try {
      // Step 1: Stop accepting new tasks
      log("Stopping new task creation...", "info");

      // Step 2: Cleanup all active tasks using TaskManager
      log("Cleaning up active tasks...", "info");
      await TaskManager.cleanup();

      // Step 3: Destroy Discord client connection
      if (discordClient && discordClient.destroy) {
        log("Closing Discord connection...", "info");
        try {
          discordClient.destroy();
        } catch (error) {
          log(`Error closing Discord connection: ${error.message}`, "warn");
        }
      }

      // Step 4: Final cleanup message
      log("Graceful shutdown completed successfully", "success");
    } catch (error) {
      log(`Error during shutdown: ${error.message}`, "error");
      exitCode = 1; // Set error exit code
    } finally {
      // Force exit after cleanup (with small delay to ensure logs are written)
      setTimeout(() => {
        process.exit(exitCode);
      }, 100);
    }
  };

  // Register signal handlers for different termination signals

  // SIGINT - Interrupt signal (Ctrl+C)
  process.on("SIGINT", () => gracefulShutdown("SIGINT", 0));

  // SIGTERM - Termination signal (kill command)
  process.on("SIGTERM", () => gracefulShutdown("SIGTERM", 0));

  // SIGQUIT - Quit signal (Ctrl+\)
  process.on("SIGQUIT", () => gracefulShutdown("SIGQUIT", 0));

  // Handle uncaught exceptions
  process.on("uncaughtException", (error) => {
    log(`Uncaught Exception: ${error.message}`, "error");
    log(error.stack, "error");
    gracefulShutdown("UNCAUGHT_EXCEPTION", 1);
  });

  // Handle unhandled promise rejections
  process.on("unhandledRejection", (reason, promise) => {
    log(`Unhandled Rejection at: ${promise}, reason: ${reason}`, "error");
    gracefulShutdown("UNHANDLED_REJECTION", 1);
  });

  log("Signal handlers registered for graceful shutdown", "debug");
}

/**
 * Main initialization function for the Discord selfbot
 * Handles the complete startup process including configuration loading,
 * client setup, handler registration, and login
 *
 * @async
 * @function initializeSelfbot
 * @description This is the core function that orchestrates the entire selfbot
 *              startup process. It includes proper error handling and validation
 *              to ensure the bot starts correctly or fails gracefully.
 */
async function initializeSelfbot() {
  try {
    // Step 1: Load and validate configuration
    log("Loading configuration...", "info");
    const config = loadConfig();

    // Step 2: Validate Discord token before proceeding
    log("Validating Discord token...", "info");
    const tokenValidation = validateToken(config.selfbot?.token);

    if (!tokenValidation.isValid) {
      console.error(chalk.red("\n[TOKEN ERROR] " + tokenValidation.error));
      console.error(chalk.yellow("\nHow to fix:"));
      console.error(chalk.yellow("1. Open config.yaml"));
      console.error(
        chalk.yellow("2. Replace the token value with your Discord token")
      );
      console.error(chalk.yellow("3. Save the file and restart the bot"));
      console.error(chalk.yellow("\nTo get your Discord token:"));
      console.error(chalk.yellow("1. Open Discord in browser"));
      console.error(chalk.yellow("2. Press F12 -> Network tab"));
      console.error(
        chalk.yellow("3. Send a message and look for 'authorization' header")
      );
      console.error(
        chalk.red("\nWARNING: Never share your token with anyone!\n")
      );
      process.exit(1);
    }

    // Step 3: Initialize Discord client with selfbot configuration
    log("Initializing Discord client...", "info");
    client = new Client({
      checkUpdate: false, // Disable update checks for selfbots
      autoRedeemNitro: true, // Auto-redeem Nitro codes if found
      relationshipSweepInterval: 60, // Clean up relationships every 60 seconds
      restRequestTimeout: 60000, // 60 second timeout for REST requests
      ws: {
        properties: {
          // Spoof browser properties to avoid detection
          $browser: config.client_properties?.browser || "Discord Client",
        },
      },
    });

    // Step 4: Attach configuration and initialize client properties
    client.config = config; // Attach config for global access
    client.prefix = config.selfbot.prefix; // Set command prefix
    client.commands = new Map(); // Initialize command collection
    client.cooldowns = new Map(); // Initialize cooldown tracking

    // Step 5: Setup core handlers and systems
    log("Setting up anti-crash system...", "info");
    setupAntiCrash(client);

    log("Setting up rate limit handler...", "info");
    setupRateLimit(client);

    log("Loading commands...", "info");
    const commandCount = await loadCommands(client);
    log(`Loaded ${commandCount} commands successfully`, "success");

    log("Loading events...", "info");
    const eventCount = await loadEvents(client);
    log(`Loaded ${eventCount} events successfully`, "success");

    // Step 6: Setup signal handlers for graceful shutdown
    log("Setting up signal handlers...", "info");
    setupSignalHandlers(client);

    // Step 7: Visual preparation for login
    await wait(1000); // Brief pause for visual effect

    // Clear console for clean startup display
    try {
      clearConsole();
    } catch (error) {
      // If clearing fails, add newlines for separation
      console.log("\n".repeat(10));
    }

    // Display the startup banner
    displayBanner();

    // Step 8: Attempt Discord login with proper error handling
    log("Connecting to Discord...", "info");

    try {
      await client.login(config.selfbot.token);
      log("Successfully connected to Discord!", "success");
    } catch (loginError) {
      // Handle specific login errors with helpful messages
      if (loginError.message.includes("TOKEN_INVALID")) {
        console.error(chalk.red("\n[LOGIN ERROR] Invalid Discord token"));
        console.error(chalk.yellow("Your token may be:"));
        console.error(chalk.yellow("• Expired or revoked"));
        console.error(chalk.yellow("• Incorrectly copied"));
        console.error(chalk.yellow("• From a different account"));
        console.error(
          chalk.yellow("\nPlease get a fresh token and update config.yaml")
        );
      } else if (loginError.message.includes("RATE_LIMITED")) {
        console.error(chalk.red("\n[LOGIN ERROR] Rate limited by Discord"));
        console.error(
          chalk.yellow("Please wait a few minutes before trying again")
        );
      } else {
        console.error(
          chalk.red("\n[LOGIN ERROR] Failed to connect to Discord")
        );
        console.error(chalk.yellow("Error details: " + loginError.message));
      }

      console.error(
        chalk.red("\nBot startup failed. Please check your configuration.\n")
      );
      process.exit(1);
    }

    // Step 9: Initialize additional features after successful login
    log("Initializing additional features...", "debug");

    try {
      // Initialize Nitro sniper if enabled
      if (config.nitro_sniper?.enabled !== false) {
        initNitroSniper(client);
        log("Nitro sniper initialized", "debug");
      }
    } catch (featureError) {
      log(
        `Warning: Failed to initialize some features: ${featureError.message}`,
        "warn"
      );
      // Don't exit - continue with basic functionality
    }

    // Step 10: Startup complete
    log("Selfbot initialization completed successfully!", "debug");
    log(
      `Bot is ready and listening for commands with prefix: ${client.prefix}`,
      "debug"
    );
  } catch (error) {
    // Handle any unexpected errors during initialization
    console.error(
      chalk.red("\n[INITIALIZATION ERROR] Failed to start selfbot:")
    );
    console.error(chalk.red("Error: " + error.message));

    if (error.stack) {
      console.error(chalk.gray("\nStack trace:"));
      console.error(chalk.gray(error.stack));
    }

    console.error(chalk.yellow("\nTroubleshooting:"));
    console.error(chalk.yellow("1. Check your config.yaml file"));
    console.error(chalk.yellow("2. Ensure your Discord token is valid"));
    console.error(chalk.yellow("3. Check your internet connection"));
    console.error(chalk.yellow("4. Make sure all dependencies are installed"));

    // Cleanup and exit
    if (client) {
      try {
        client.destroy();
      } catch (destroyError) {
        // Ignore cleanup errors during startup failure
      }
    }

    process.exit(1);
  }
}

/**
 * Application Entry Point
 * Start the selfbot initialization process
 *
 * This is where everything begins. The initializeSelfbot function
 * handles all the complex startup logic with proper error handling.
 */
log("Starting Vexil Selfbot...", "info");
initializeSelfbot().catch((error) => {
  // Final catch-all error handler
  console.error(chalk.red("\n[FATAL ERROR] Selfbot failed to start:"));
  console.error(chalk.red(error.message));
  process.exit(1);
});
