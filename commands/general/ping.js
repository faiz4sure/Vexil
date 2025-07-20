import chalk from 'chalk';
import { log, formatTime } from '../../utils/functions.js';

export default {
    name: 'ping',
    description: 'Check the bot\'s latency and API response time',
    aliases: ['latency', 'pong'],
    usage: '[command name]',
    category: 'general', 
    type: 'both', // Can be chosen from dm_only or server_only
    permissions: ['SendMessages'], // Permissions required to execute the command
    cooldown: 5,
    
    /**
     * Execute the ping command
     * @param {Client} client - Discord.js client instance
     * @param {Message} message - The message object
     * @param {Array} args - Command arguments
     */
    execute: async (client, message, args) => {
        try {
            // Send initial message
            const initialMessage = await message.channel.send('> 🔄 **Pinging...**');
            
            // Calculate latencies
            const latency = initialMessage.createdTimestamp - message.createdTimestamp;
            const apiLatency = Math.round(client.ws.ping);
            
            // Get emoji based on latency
            const getLatencyEmoji = (ms) => {
                if (ms < 100) return '🟢'; // Excellent
                if (ms < 200) return '🟢'; // Good
                if (ms < 400) return '🟡'; // Average
                if (ms < 600) return '🟠'; // Poor
                return '🔴';               // Bad
            };
            
            // Format uptime
            const uptime = formatTime(client.uptime);
            
            // Create a formatted response with quote blocks
            const response = [
                '> 🏓 **Pong!**',
                '> ',
                `> ${getLatencyEmoji(latency)} **Message Latency:** ${latency}ms`,
                `> ${getLatencyEmoji(apiLatency)} **API Latency:** ${apiLatency}ms`,
                '> ',
                `> ⏱️ **Uptime:** ${uptime}`
            ].join('\n');
            
            // Edit the initial message with the results
            await initialMessage.edit(response);
            
            // Log the command usage
            log(`${message.author.tag} used ping command (${latency}ms / ${apiLatency}ms)`, 'success');
        } catch (error) {
            console.error(chalk.red('[ERROR] Error in ping command:'), error);
            message.channel.send('> ❌ **Error:** An error occurred while checking ping.');
        }
    }
};