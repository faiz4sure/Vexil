/**
 * GAME COMMAND
 *
 * Set Discord "Playing" status using Discord's detectable games database.
 * Fetches games directly from Discord API - no memory-heavy storage needed.
 * Supports fuzzy matching for game names.
 *
 * Subcommands:
 * - set <game> - Set game activity (fuzzy search)
 * - remove - Remove current game activity
 * - view - View current game activity
 * - setstate <text> - Set state text
 * - setdetails <text> - Set details text
 * - setparty <current> <max> - Set party size
 * - (no args) - Show help
 *
 * @author faiz4sure
 */

import { RichPresence } from "discord.js-selfbot-v13";

export default {
  name: "game",
  description:
    "Set your Discord 'Playing' status using Discord's game database",
  aliases: ["playgame", "setgame"],
  usage: "<set|remove|view|setstate|setdetails|setparty> [args]",
  category: "status",
  type: "both",
  permissions: ["SendMessages"],
  cooldown: 3,

  // Store current game info and RPC config (lightweight)
  currentGame: null,
  currentConfig: {
    state: null,
    details: null,
    party: null,
    timestamps: { start: null, end: null },
  },

  async execute(client, message, args) {
    const subcommand = args[0]?.toLowerCase();

    if (!subcommand) {
      return this.showHelp(message, client);
    }

    switch (subcommand) {
      case "set":
        return await this.setGame(client, message, args.slice(1));

      case "remove":
      case "clear":
      case "stop":
        return await this.removeGame(client, message);

      case "view":
      case "current":
      case "status":
        return await this.viewGame(client, message);

      // Edit subcommands
      case "setstate":
        return await this.setState(client, message, args.slice(1));

      case "setdetails":
        return await this.setDetails(client, message, args.slice(1));

      case "setparty":
        return await this.setParty(client, message, args.slice(1));

      case "setstarttimestamp":
      case "starttime":
        return await this.setStartTimestamp(client, message, args.slice(1));

      case "setendtimestamp":
      case "endtime":
        return await this.setEndTimestamp(client, message, args.slice(1));

      case "clearstate":
        return await this.clearProperty(client, message, "state");

      case "cleardetails":
        return await this.clearProperty(client, message, "details");

      case "clearparty":
        return await this.clearProperty(client, message, "party");

      default:
        // If not a subcommand, treat entire args as game name
        return await this.setGame(client, message, args);
    }
  },

  /**
   * Show help message with available subcommands
   */
  showHelp(message, client) {
    const helpText = `> **🎮 Game Activity Command**
>
> **Usage:** \`${client.prefix}game <subcommand> [args]\`
>
> **Core Commands:**
> • \`set <game>\` - Set game activity (supports partial names)
> • \`remove\` - Remove current game activity
> • \`view\` - View your current game activity
>
> **Edit Commands:** (requires active game)
> • \`setstate <text>\` - Set state text
> • \`setdetails <text>\` - Set details text
> • \`setparty <current> <max>\` - Set party size (e.g., \`1 5\`)
> • \`starttime\` - Set start timestamp to now
> • \`endtime <+1h|+30m>\` - Set end timestamp
>
> **Clear Commands:**
> • \`clearstate\` - Clear state text
> • \`cleardetails\` - Clear details text
> • \`clearparty\` - Clear party info
>
> **Examples:**
> • \`${client.prefix}game set valorant\`
> • \`${client.prefix}game set where winds meet\`
> • \`${client.prefix}game setstate In Queue\`
> • \`${client.prefix}game setdetails Competitive Match\`
> • \`${client.prefix}game setparty 1 5\`
> • \`${client.prefix}game remove\`
>
> **Note:** Uses Discord's official game database (21,000+ games) with automatic icon/image support.`;

    return message.channel.send(helpText);
  },

  /**
   * Set game activity by searching Discord's detectable games
   */
  async setGame(client, message, args) {
    if (!args.length) {
      return message.channel.send(
        `> ❌ **Please specify a game name.**\n> Usage: \`${client.prefix}game set <game name>\``
      );
    }

    const query = args.join(" ").toLowerCase();
    const statusMsg = await message.channel.send(
      `> 🔍 **Searching for "${args.join(" ")}"...**`
    );

    try {
      // Fetch detectable games from Discord API (fresh each time - no memory storage)
      const games = await client.api.applications.detectable.get();

      // Search with fuzzy matching
      const results = this.searchGames(games, query);

      if (results.length === 0) {
        return statusMsg.edit(
          `> ❌ **No games found matching "${args.join(
            " "
          )}"**\n> Try a different search term or check the spelling.`
        );
      }

      // Get the best match
      const game = results[0];

      // Reset config for new game
      this.currentConfig = {
        state: null,
        details: null,
        party: null,
        timestamps: { start: Date.now(), end: null },
      };

      // Store current game info (lightweight)
      this.currentGame = {
        id: game.id,
        name: game.name,
        startedAt: Date.now(),
      };

      // Update presence
      await this.updatePresence(client);

      // Build response with alternatives if found multiple
      let response = `> ✅ **Now playing: ${game.name}**\n> (ID: \`${game.id}\`)`;

      if (results.length > 1) {
        const alternatives = results
          .slice(1, 4)
          .map((g) => `\`${g.name}\``)
          .join(", ");
        response += `\n>\n> **Other matches:** ${alternatives}`;
      }

      return statusMsg.edit(response);
    } catch (error) {
      console.error("Error setting game:", error);
      return statusMsg.edit(`> ❌ **Error:** ${error.message}`);
    }
  },

  /**
   * Update presence with current game and config
   */
  async updatePresence(client) {
    if (!this.currentGame) {
      throw new Error("No game currently set. Use `+game set <game>` first.");
    }

    const rpc = new RichPresence(client)
      .setApplicationId(this.currentGame.id)
      .setName(this.currentGame.name)
      .setType("PLAYING");

    // Apply config properties
    if (this.currentConfig.state) {
      rpc.setState(this.currentConfig.state);
    }

    if (this.currentConfig.details) {
      rpc.setDetails(this.currentConfig.details);
    }

    if (this.currentConfig.party) {
      rpc.setParty({
        id: `game_${this.currentGame.id}`,
        current: this.currentConfig.party.current,
        max: this.currentConfig.party.max,
      });
    }

    if (this.currentConfig.timestamps.start) {
      rpc.setStartTimestamp(this.currentConfig.timestamps.start);
    }

    if (this.currentConfig.timestamps.end) {
      rpc.setEndTimestamp(this.currentConfig.timestamps.end);
    }

    await client.user.setPresence({ activities: [rpc] });
    return true;
  },

  /**
   * Set state text
   */
  async setState(client, message, args) {
    if (!this.currentGame) {
      return message.channel.send(
        `> ❌ **No game currently set.**\n> Use \`${client.prefix}game set <game>\` first.`
      );
    }

    if (!args.length) {
      return message.channel.send(
        `> ❌ **Please specify state text.**\n> Usage: \`${client.prefix}game setstate <text>\``
      );
    }

    const state = args.join(" ");

    if (state.length > 128) {
      return message.channel.send(
        "> ❌ **State text too long.** Maximum 128 characters."
      );
    }

    try {
      this.currentConfig.state = state;
      await this.updatePresence(client);

      return message.channel.send(`> ✅ **State set to:** \`${state}\``);
    } catch (error) {
      return message.channel.send(`> ❌ **Error:** ${error.message}`);
    }
  },

  /**
   * Set details text
   */
  async setDetails(client, message, args) {
    if (!this.currentGame) {
      return message.channel.send(
        `> ❌ **No game currently set.**\n> Use \`${client.prefix}game set <game>\` first.`
      );
    }

    if (!args.length) {
      return message.channel.send(
        `> ❌ **Please specify details text.**\n> Usage: \`${client.prefix}game setdetails <text>\``
      );
    }

    const details = args.join(" ");

    if (details.length > 128) {
      return message.channel.send(
        "> ❌ **Details text too long.** Maximum 128 characters."
      );
    }

    try {
      this.currentConfig.details = details;
      await this.updatePresence(client);

      return message.channel.send(`> ✅ **Details set to:** \`${details}\``);
    } catch (error) {
      return message.channel.send(`> ❌ **Error:** ${error.message}`);
    }
  },

  /**
   * Set party size
   */
  async setParty(client, message, args) {
    if (!this.currentGame) {
      return message.channel.send(
        `> ❌ **No game currently set.**\n> Use \`${client.prefix}game set <game>\` first.`
      );
    }

    if (args.length < 2) {
      return message.channel.send(
        `> ❌ **Usage:** \`${client.prefix}game setparty <current> <max>\`\n> Example: \`${client.prefix}game setparty 1 5\``
      );
    }

    const current = parseInt(args[0]);
    const max = parseInt(args[1]);

    if (isNaN(current) || isNaN(max)) {
      return message.channel.send(
        "> ❌ **Both values must be valid numbers.**"
      );
    }

    if (current < 1 || max < 1) {
      return message.channel.send(
        "> ❌ **Both values must be positive numbers.**"
      );
    }

    if (current > max) {
      return message.channel.send(
        "> ❌ **Current value cannot exceed max value.**"
      );
    }

    try {
      this.currentConfig.party = { current, max };
      await this.updatePresence(client);

      return message.channel.send(`> ✅ **Party set to:** ${current}/${max}`);
    } catch (error) {
      return message.channel.send(`> ❌ **Error:** ${error.message}`);
    }
  },

  /**
   * Set start timestamp
   */
  async setStartTimestamp(client, message, args) {
    if (!this.currentGame) {
      return message.channel.send(
        `> ❌ **No game currently set.**\n> Use \`${client.prefix}game set <game>\` first.`
      );
    }

    try {
      const timestamp = args[0]
        ? this.parseTimestamp(args.join(" "))
        : Date.now();

      if (timestamp === null) {
        return message.channel.send(
          "> ❌ **Invalid timestamp format.**\n> Use `now`, `+1h`, `+30m`, or Unix timestamp."
        );
      }

      this.currentConfig.timestamps.start = timestamp;
      await this.updatePresence(client);

      const date = new Date(timestamp);
      return message.channel.send(
        `> ✅ **Start timestamp set to:** ${date.toLocaleString()}`
      );
    } catch (error) {
      return message.channel.send(`> ❌ **Error:** ${error.message}`);
    }
  },

  /**
   * Set end timestamp
   */
  async setEndTimestamp(client, message, args) {
    if (!this.currentGame) {
      return message.channel.send(
        `> ❌ **No game currently set.**\n> Use \`${client.prefix}game set <game>\` first.`
      );
    }

    if (!args.length) {
      return message.channel.send(
        `> ❌ **Please specify a timestamp.**\n> Examples: \`+1h\`, \`+30m\`, \`+2h30m\``
      );
    }

    try {
      const timestamp = this.parseTimestamp(args.join(" "));

      if (timestamp === null) {
        return message.channel.send(
          "> ❌ **Invalid timestamp format.**\n> Use `+1h`, `+30m`, or Unix timestamp."
        );
      }

      this.currentConfig.timestamps.end = timestamp;
      await this.updatePresence(client);

      const date = new Date(timestamp);
      return message.channel.send(
        `> ✅ **End timestamp set to:** ${date.toLocaleString()}`
      );
    } catch (error) {
      return message.channel.send(`> ❌ **Error:** ${error.message}`);
    }
  },

  /**
   * Clear a specific property
   */
  async clearProperty(client, message, property) {
    if (!this.currentGame) {
      return message.channel.send(
        `> ❌ **No game currently set.**\n> Use \`${client.prefix}game set <game>\` first.`
      );
    }

    try {
      this.currentConfig[property] = null;
      await this.updatePresence(client);

      return message.channel.send(
        `> ✅ **${
          property.charAt(0).toUpperCase() + property.slice(1)
        } cleared!**`
      );
    } catch (error) {
      return message.channel.send(`> ❌ **Error:** ${error.message}`);
    }
  },

  /**
   * Parse timestamp from various formats
   */
  parseTimestamp(input) {
    if (!input) return Date.now();

    if (input.toLowerCase() === "now") {
      return Date.now();
    }

    // Relative time: +1h, +30m, +2h30m
    const relativeMatch = input.match(/^\+?(\d+)([hms])(?:(\d+)([hms]))?$/i);
    if (relativeMatch) {
      const multiplier = { h: 60 * 60 * 1000, m: 60 * 1000, s: 1000 };
      let total = 0;

      total +=
        parseInt(relativeMatch[1]) *
        (multiplier[relativeMatch[2].toLowerCase()] || 0);

      if (relativeMatch[3] && relativeMatch[4]) {
        total +=
          parseInt(relativeMatch[3]) *
          (multiplier[relativeMatch[4].toLowerCase()] || 0);
      }

      return Date.now() + total;
    }

    // Unix timestamp
    const timestamp = parseInt(input);
    if (!isNaN(timestamp) && timestamp > 0) {
      return timestamp;
    }

    return null;
  },

  /**
   * Search games with fuzzy matching
   * Prioritizes exact matches, then starts-with, then contains
   */
  searchGames(games, query) {
    const queryLower = query.toLowerCase().trim();
    const queryWords = queryLower.split(/\s+/);

    // Score each game based on match quality
    const scored = games
      .filter((game) => game.name) // Filter out games without names
      .map((game) => {
        const nameLower = game.name.toLowerCase();
        let score = 0;

        // Exact match = highest priority
        if (nameLower === queryLower) {
          score = 1000;
        }
        // Starts with query
        else if (nameLower.startsWith(queryLower)) {
          score = 500 + (100 - nameLower.length); // Prefer shorter names
        }
        // Contains exact query
        else if (nameLower.includes(queryLower)) {
          score = 300 + (100 - nameLower.length);
        }
        // All query words present (fuzzy)
        else if (queryWords.every((word) => nameLower.includes(word))) {
          score = 200 + (100 - nameLower.length);
        }
        // Check aliases
        else if (
          game.aliases?.some((alias) => {
            const aliasLower = alias.toLowerCase();
            return (
              aliasLower === queryLower ||
              aliasLower.includes(queryLower) ||
              queryWords.every((word) => aliasLower.includes(word))
            );
          })
        ) {
          score = 150;
        }
        // Partial word matches (at least 70% of query chars match)
        else {
          const matchedChars = queryLower
            .split("")
            .filter((char) => nameLower.includes(char)).length;
          const matchRatio = matchedChars / queryLower.length;
          if (matchRatio >= 0.7) {
            score = Math.floor(matchRatio * 100);
          }
        }

        return { game, score };
      })
      .filter((item) => item.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, 10) // Limit to top 10
      .map((item) => item.game);

    return scored;
  },

  /**
   * Remove current game activity
   */
  async removeGame(client, message) {
    try {
      await client.user.setPresence({ activities: [] });
      this.currentGame = null;
      this.currentConfig = {
        state: null,
        details: null,
        party: null,
        timestamps: { start: null, end: null },
      };

      return message.channel.send(`> ✅ **Game activity removed!**`);
    } catch (error) {
      console.error("Error removing game:", error);
      return message.channel.send(`> ❌ **Error:** ${error.message}`);
    }
  },

  /**
   * View current game activity
   */
  async viewGame(client, message) {
    try {
      // Get current activities from client
      const activities = client.user.presence?.activities || [];
      const gameActivity = activities.find((a) => a.type === 0); // Type 0 = Playing

      if (!gameActivity && !this.currentGame) {
        return message.channel.send(
          `> ℹ️ **No game activity currently set.**\n> Use \`${client.prefix}game set <game>\` to set one.`
        );
      }

      // Calculate elapsed time if we have start timestamp
      let elapsedText = "";
      const startTime =
        this.currentConfig.timestamps?.start || this.currentGame?.startedAt;
      if (startTime) {
        const elapsed = Date.now() - startTime;
        const hours = Math.floor(elapsed / (1000 * 60 * 60));
        const minutes = Math.floor((elapsed % (1000 * 60 * 60)) / (1000 * 60));
        elapsedText = hours > 0 ? `${hours}h ${minutes}m` : `${minutes}m`;
      }

      const gameName =
        gameActivity?.name || this.currentGame?.name || "Unknown";
      const gameId =
        gameActivity?.applicationId || this.currentGame?.id || "N/A";

      let response = `> **🎮 Current Game Activity**
>
> **Game:** ${gameName}
> **Application ID:** \`${gameId}\``;

      if (elapsedText) {
        response += `\n> **Playing for:** ${elapsedText}`;
      }

      // Show configured properties
      if (this.currentConfig.state) {
        response += `\n> **State:** ${this.currentConfig.state}`;
      }
      if (this.currentConfig.details) {
        response += `\n> **Details:** ${this.currentConfig.details}`;
      }
      if (this.currentConfig.party) {
        response += `\n> **Party:** ${this.currentConfig.party.current}/${this.currentConfig.party.max}`;
      }
      if (this.currentConfig.timestamps.end) {
        const endDate = new Date(this.currentConfig.timestamps.end);
        response += `\n> **Ends at:** ${endDate.toLocaleTimeString()}`;
      }

      return message.channel.send(response);
    } catch (error) {
      console.error("Error viewing game:", error);
      return message.channel.send(`> ❌ **Error:** ${error.message}`);
    }
  },
};
