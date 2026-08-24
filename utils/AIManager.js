import { log, loadConfig } from "./functions.js";
import Groq from "groq-sdk";
import { GoogleGenAI } from "@google/genai";
import OpenAI from "openai";

/**
 * AI Manager Module
 *
 * Centralized manager for handling different AI providers:
 * - Groq AI (groq-sdk)
 * - Google Gemini AI (@google/genai)
 * - OpenAI Compatible APIs (openai)
 *
 * It initializes enabled providers on startup and exposes a unified method
 * to generate content using the configured default provider.
 */
class AIManager {
  constructor() {
    this.providers = new Map();
    this.models = new Map();
    this.defaultProvider = "groq";
    this.initialized = false;
  }

  /**
   * Initialize all enabled AI providers with API keys from config
   */
  initialize() {
    if (this.initialized) return;

    try {
      const config = loadConfig();
      if (!config.ai) {
        log("No AI configuration found in config.yaml", "warn");
        return;
      }

      this.defaultProvider = config.ai.default_provider || "groq";

      // 1. Initialize Groq
      const groqConfig = config.ai.groq;
      if (groqConfig && groqConfig.enabled && groqConfig.api_key) {
        try {
          const client = new Groq({ apiKey: groqConfig.api_key, timeout: 10000 });
          this.providers.set("groq", client);
          this.models.set("groq", groqConfig.model || "llama-3.1-8b-instant");
          log("Groq AI provider initialized successfully (10s timeout)", "info");
        } catch (error) {
          log(`Failed to initialize Groq provider: ${error.message}`, "warn");
        }
      }

      // 2. Initialize Gemini
      const geminiConfig = config.ai.gemini;
      if (geminiConfig && geminiConfig.enabled && geminiConfig.api_key) {
        try {
          const client = new GoogleGenAI({ apiKey: geminiConfig.api_key, httpOptions: { timeout: 10000 } });
          this.providers.set("gemini", client);
          this.models.set("gemini", geminiConfig.model || "gemini-2.0-flash");
          log("Google Gemini AI provider initialized successfully (10s timeout)", "info");
        } catch (error) {
          log(`Failed to initialize Google Gemini provider: ${error.message}`, "warn");
        }
      }

      // 3. Initialize OpenAI Compatible
      const openaiConfig = config.ai.openai;
      if (openaiConfig && openaiConfig.enabled && openaiConfig.api_key) {
        try {
          const client = new OpenAI({
            apiKey: openaiConfig.api_key,
            baseURL: openaiConfig.base_url || "https://api.openai.com/v1",
            timeout: 10000
          });
          this.providers.set("openai", client);
          this.models.set("openai", openaiConfig.model || "gpt-4o");
          log("OpenAI compatible provider initialized successfully (10s timeout)", "info");
        } catch (error) {
          log(`Failed to initialize OpenAI compatible provider: ${error.message}`, "warn");
        }
      }

      this.initialized = true;
      log(`AI Manager initialized. Enabled providers: ${Array.from(this.providers.keys()).join(", ") || "none"}`, "info");
    } catch (error) {
      log(`Error initializing AI Manager: ${error.message}`, "error");
    }
  }

  /**
   * Check if a provider is initialized and ready
   * @param {string} providerName 
   * @returns {boolean}
   */
  isAvailable(providerName) {
    if (!this.initialized) this.initialize();
    return this.providers.has(providerName);
  }

  /**
   * Get the client instance for a provider
   * @param {string} providerName 
   * @returns {Object|null}
   */
  getClient(providerName) {
    if (!this.initialized) this.initialize();
    return this.providers.get(providerName) || null;
  }

  /**
   * Get the configured model name for a provider
   * @param {string} providerName 
   * @returns {string|null}
   */
  getModel(providerName) {
    if (!this.initialized) this.initialize();
    return this.models.get(providerName) || null;
  }

  /**
   * Get the default provider name
   * @returns {string}
   */
  getDefaultProvider() {
    if (!this.initialized) this.initialize();
    return this.defaultProvider;
  }

  /**
   * Generate content using a specified provider or the default provider
   * @param {string} prompt 
   * @param {Object} [options] 
   * @param {string} [options.provider] - Optional provider override
   * @returns {Promise<string>}
   */
  async generateContent(prompt, options = {}) {
    if (!this.initialized) this.initialize();
    const provider = options.provider || this.defaultProvider;

    if (!this.isAvailable(provider)) {
      throw new Error(`AI Provider "${provider}" is not initialized or enabled in config.`);
    }

    const client = this.getClient(provider);
    const model = this.getModel(provider);

    if (provider === "groq" || provider === "openai") {
      const response = await client.chat.completions.create({
        model: model,
        messages: [{ role: "user", content: prompt }]
      });
      return response.choices[0].message.content;
    } else if (provider === "gemini") {
      const response = await client.models.generateContent({
        model: model,
        config: { tools: [{ googleSearch: {} }] },
        contents: prompt
      });
      return response.text;
    } else {
      throw new Error(`Unsupported AI Provider: "${provider}"`);
    }
  }

  /**
   * Generate a response with conversation history (for AI AFK).
   * Uses chat.completions format for groq/openai, and turns history into
   * a multi-turn contents array for gemini.
   * @param {Array<{role:string,content:string}>} messages  - Chat history incl. system prompt as first msg
   * @param {string[]} providerChain
   * @returns {Promise<{text: string, provider: string}>}
   */
  async chainGenerateWithHistory(messages, providerChain) {
    if (!this.initialized) this.initialize();
    const errors = [];
    log(`AI AFK chain generator started. Trying providers: ${providerChain.join(", ")}`, "debug");
    for (const provider of providerChain) {
      if (!this.isAvailable(provider)) {
        errors.push(`${provider}: not initialized`);
        log(`AI AFK chain: skipping ${provider} (not initialized/enabled)`, "debug");
        continue;
      }
      try {
        log(`AI AFK chain: attempting generation via ${provider}...`, "debug");
        const client = this.getClient(provider);
        const model = this.getModel(provider);
        let text;

        if (provider === "groq" || provider === "openai") {
          const response = await client.chat.completions.create({ model, messages });
          text = response.choices[0].message.content;
        } else if (provider === "gemini") {
          // Extract system instruction if present
          const systemMsg = messages.find(m => m.role === "system");
          const systemInstruction = systemMsg ? systemMsg.content : undefined;

          // Convert chat message history (excluding system prompt) into Gemini's format
          const chatMsgs = messages.filter(m => m.role !== "system");
          const contents = chatMsgs.map(m => {
            const role = m.role === "assistant" ? "model" : "user";
            return { role, parts: [{ text: m.content }] };
          });

          // Build configuration object using native systemInstruction
          const requestConfig = {};
          if (systemInstruction) {
            requestConfig.systemInstruction = systemInstruction;
          }

          const response = await client.models.generateContent({
            model,
            contents,
            config: requestConfig
          });
          text = response.text;
        } else {
          throw new Error(`Unsupported provider: ${provider}`);
        }

        log(`AI AFK chain: successfully generated via ${provider}`, "debug");
        return { text, provider };
      } catch (err) {
        errors.push(`${provider}: ${err.message}`);
        log(`AI AFK chain: provider "${provider}" failed — ${err.message}`, "warn");
      }
    }
    throw new Error(`All AI AFK providers failed:\n${errors.join("\n")}`);
  }
}

export default new AIManager();
