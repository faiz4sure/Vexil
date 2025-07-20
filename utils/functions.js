/**
 * UTILITY FUNCTIONS MODULE
 *
 * This module provides essential utility functions used throughout the selfbot:
 * - Configuration management with caching
 * - Logging system with file output and colored console
 * - Time and date formatting utilities
 * - String manipulation and validation helpers
 * - File system utilities for data management
 *
 * All functions are designed to be reusable and handle errors gracefully.
 *
 * @module utils/functions
 * @author faiz4sure
 */

// Import required Node.js modules
import { setTimeout as sleep } from "timers/promises"; // Promise-based setTimeout
import chalk from "chalk"; // Terminal string styling
import fs from "fs"; // File system operations
import yaml from "js-yaml"; // YAML parsing and stringifying
import path from "path"; // Path manipulation utilities
import { fileURLToPath } from "url"; // URL to file path conversion

// Get current file path and directory (ES modules compatibility)
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Define important directory paths for data storage
const DATA_DIR = path.join(__dirname, "..", "data"); // Main data directory
const ERRORS_FILE = path.join(DATA_DIR, "errors.txt"); // Error log file
const RELATIONSHIP_DIR = path.join(DATA_DIR, "relationship"); // Relationship logs directory

// Initialize data directories on module load
// This ensures all required directories exist before any operations
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  console.log("Created data directory:", DATA_DIR);
}

if (!fs.existsSync(RELATIONSHIP_DIR)) {
  fs.mkdirSync(RELATIONSHIP_DIR, { recursive: true });
  console.log("Created relationship directory:", RELATIONSHIP_DIR);
}

// Clear the errors file on startup to start with a clean slate
try {
  fs.writeFileSync(ERRORS_FILE, "");
} catch (error) {
  console.error(`Failed to clear errors file: ${error.message}`);
}

// Configuration cache to avoid repeated file reads
// This improves performance by caching the config in memory
let configCache = null;

/**
 * Load and validate configuration from config.yaml file
 *
 * @function loadConfig
 * @param {boolean} forceReload - Force reload from file even if cached (default: false)
 * @returns {Object} Parsed and validated configuration object
 * @throws {Error} If configuration file is missing, invalid, or corrupted
 *
 * @description This function handles loading the bot's configuration from config.yaml.
 *              It includes caching to improve performance and comprehensive validation
 *              to ensure all required settings are present and valid.
 *
 * @example
 * // Load config (uses cache if available)
 * const config = loadConfig();
 *
 * // Force reload from file
 * const freshConfig = loadConfig(true);
 */
export function loadConfig(forceReload = false) {
  // Return cached config if available and not forcing reload
  if (configCache && !forceReload) {
    return configCache;
  }

  try {
    // Construct path to config file
    const configPath = path.join(__dirname, "..", "config.yaml");

    // Check if config file exists
    if (!fs.existsSync(configPath)) {
      throw new Error(`Configuration file not found at: ${configPath}`);
    }

    // Read and parse YAML configuration file
    const configFile = fs.readFileSync(configPath, "utf8");
    configCache = yaml.load(configFile);

    // Validate essential configuration sections
    if (!configCache || typeof configCache !== "object") {
      throw new Error(
        "Invalid configuration: File is empty or not a valid YAML object"
      );
    }

    if (!configCache.selfbot) {
      throw new Error('Invalid configuration: Missing "selfbot" section');
    }

    if (!configCache.selfbot.token) {
      throw new Error(
        "Invalid configuration: Missing Discord token in selfbot section"
      );
    }

    if (!configCache.selfbot.prefix) {
      throw new Error(
        "Invalid configuration: Missing command prefix in selfbot section"
      );
    }

    return configCache;
  } catch (error) {
    // Handle configuration errors with helpful messages
    console.error(
      chalk.red("[CONFIG] Error loading configuration:"),
      error.message
    );
    console.error(
      chalk.yellow(
        "[CONFIG] Please check your config.yaml file and ensure it's properly formatted"
      )
    );
    process.exit(1);
  }
}

/**
 * Clear the console screen in a cross-platform way
 */
export function clearConsole() {
  // Try multiple methods to clear the console for better cross-platform support
  try {
    // Method 1: ANSI escape codes
    const isWin = process.platform === "win32";

    if (isWin) {
      // Windows-specific clear
      process.stdout.write("\x1Bc");
    } else {
      // Unix-like clear
      process.stdout.write("\x1B[2J\x1B[3J\x1B[H");
    }

    // Method 2: Console API (as fallback)
    if (typeof console.clear === "function") {
      console.clear();
    }
  } catch (error) {
    // Method 3: If all else fails, print newlines
    console.log("\n".repeat(process.stdout.rows || 40));
  }
}

/**
 * Format milliseconds into a readable time string
 * @param {number} ms - Milliseconds to format
 * @returns {string} Formatted time string
 */
export function formatTime(ms) {
  if (ms < 1000) return `${ms}ms`;

  const seconds = Math.floor(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  const parts = [];

  if (days > 0) parts.push(`${days}d`);
  if (hours % 24 > 0) parts.push(`${hours % 24}h`);
  if (minutes % 60 > 0) parts.push(`${minutes % 60}m`);
  if (seconds % 60 > 0) parts.push(`${seconds % 60}s`);

  return parts.join(" ");
}

/**
 * Create a formatted code block message
 * @param {string} content - Message content
 * @param {string} language - Code block language (default: '')
 * @returns {string} Formatted code block
 */
export function codeBlock(content, language = "") {
  return `\`\`\`${language}\n${content}\n\`\`\``;
}

/**
 * Create a formatted ANSI code block with colored text
 * @param {Array} lines - Array of text lines with ANSI color codes
 * @returns {string} Formatted ANSI code block
 */
export function ansiBlock(lines) {
  return ["``ansi", ...lines, "```"].join("\n");
}

/**
 * Safely truncate a string to a maximum length
 * @param {string} str - String to truncate
 * @param {number} maxLength - Maximum length
 * @returns {string} Truncated string
 */
export function truncate(str, maxLength = 2000) {
  if (str.length <= maxLength) return str;
  return str.substring(0, maxLength - 3) + "...";
}

/**
 * Log a message with timestamp
 * @param {string} message - Message to log
 * @param {string} type - Log type (info, warn, error, success, debug)
 */
export function log(message, type = "info") {
  const timestamp = new Date().toLocaleTimeString();
  const prefix =
    {
      info: chalk.blue("[INFO]"),
      warn: chalk.yellow("[WARN]"),
      error: chalk.red("[ERROR]"),
      success: chalk.green("[SUCCESS]"),
      debug: chalk.magenta("[DEBUG]"),
    }[type] || chalk.blue("[INFO]");

  // Only log errors to file, not to console
  if (type === "error") {
    logError(message);
    return;
  }

  // Only log debug messages if debug mode is enabled
  if (type === "debug") {
    const config = loadConfig();
    if (!config.debug_mode || !config.debug_mode.enabled) {
      return;
    }

    // Also log debug messages to a debug file
    try {
      const debugDir = path.join(DATA_DIR, "debug");
      if (!fs.existsSync(debugDir)) {
        fs.mkdirSync(debugDir, { recursive: true });
      }

      const debugFile = path.join(debugDir, `${getFormattedDate()}.log`);
      const logEntry = `${new Date().toISOString()} [DEBUG] ${message}\n`;
      fs.appendFileSync(debugFile, logEntry);
    } catch (e) {
      // Silently fail if we can't log to file
    }
  }

  console.log(`${chalk.gray(timestamp)} ${prefix} ${message}`);
}

/**
 * Log an error to the errors.txt file
 * @param {string|Error} error - Error message or Error object
 * @param {string} context - Additional context for the error
 */
export function logError(error, context = "") {
  try {
    const timestamp = new Date().toISOString();
    let errorMessage = "";

    if (error instanceof Error) {
      errorMessage = `${timestamp} [ERROR] ${context ? context + ": " : ""}${
        error.message
      }\n${error.stack}\n\n`;
    } else {
      errorMessage = `${timestamp} [ERROR] ${
        context ? context + ": " : ""
      }${error}\n\n`;
    }

    fs.appendFileSync(ERRORS_FILE, errorMessage);
  } catch (e) {
    // If we can't log to file, fall back to console
    console.error(
      chalk.red("[ERROR]"),
      "Failed to log error to file:",
      e.message
    );
    console.error(chalk.red("[ORIGINAL ERROR]"), error);
  }
}

/**
 * Wait for a specified amount of time
 * @param {number} ms - Milliseconds to wait
 * @returns {Promise} Promise that resolves after the specified time
 */
export async function wait(ms) {
  return sleep(ms);
}

/**
 * Check if a string is a valid URL
 * @param {string} str - String to check
 * @returns {boolean} True if the string is a valid URL
 */
export function isValidUrl(str) {
  try {
    new URL(str);
    return true;
  } catch (err) {
    return false;
  }
}

/**
 * Parse arguments from a command string
 * @param {string} content - Command content
 * @returns {Array} Parsed arguments
 */
export function parseArgs(content) {
  const args = [];
  let current = "";
  let inQuotes = false;
  let escapeNext = false;

  for (let i = 0; i < content.length; i++) {
    const char = content[i];

    if (escapeNext) {
      current += char;
      escapeNext = false;
      continue;
    }

    if (char === "\\") {
      escapeNext = true;
      continue;
    }

    if (char === '"') {
      inQuotes = !inQuotes;
      continue;
    }

    if (char === " " && !inQuotes) {
      if (current) {
        args.push(current);
        current = "";
      }
      continue;
    }

    current += char;
  }

  if (current) {
    args.push(current);
  }

  return args;
}

/**
 * Get the current date formatted as YYYY-MM-DD
 * @returns {string} Formatted date
 */
export function getFormattedDate() {
  const date = new Date();
  return date.toISOString().split("T")[0]; // YYYY-MM-DD
}

/**
 * Format a string to be Discord-friendly (for channel names, etc.)
 * Replaces spaces with hyphens and removes special characters
 * @param {string} str - String to format
 * @returns {string} Formatted string
 */
export function formatDiscordName(str) {
  if (!str) return "unnamed";

  // Convert to lowercase
  let formatted = str.toLowerCase();

  // Replace spaces with hyphens
  formatted = formatted.replace(/\s+/g, "-");

  // Remove special characters (keep only alphanumeric, hyphens, and underscores)
  formatted = formatted.replace(/[^a-z0-9-_]/g, "");

  // Ensure the name is not empty
  if (!formatted) {
    return "unnamed";
  }

  // Ensure the name is not too long (Discord has a 100 character limit for channel names)
  if (formatted.length > 100) {
    formatted = formatted.substring(0, 100);
  }

  return formatted;
}

// Function to parse time strings like "5m", "1h", etc.
export function parseTime(duration) {
  const timeRegex = /^(\d+)([smhd])$/;
  const match = duration.match(timeRegex);
  if (!match) return null;

  const [, value, unit] = match;
  const multiplier = {
    s: 1000,
    m: 60 * 1000,
    h: 60 * 60 * 1000,
    d: 24 * 60 * 60 * 1000,
  }[unit];

  return parseInt(value, 10) * multiplier;
}
