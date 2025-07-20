import chalk from 'chalk';
import { log } from '../../utils/functions.js';

export default {
    name: 'serverinfo',
    description: 'Fetches and displays detailed information about the server.',
    aliases: ['si', 'server'],
    usage: '',
    category: 'general',
    type: 'server_only',
    permissions: ['SendMessages'],
    cooldown: 10,

    /**
     * Execute the serverinfo command
     * @param {Client} client - Discord.js client instance
     * @param {Message} message - The message object
     * @param {Array} args - Command arguments
     */
    execute: async (client, message, args) => {
        const guild = message.guild;

        try {
            let ownerDisplay = 'Unknown Owner';
            try {
                // Add null check for ownerId
                if (guild.ownerId) {
                    const owner = await client.users.fetch(guild.ownerId).catch(() => null);
                    if (owner?.tag) {
                        ownerDisplay = owner.tag;
                    } else {
                        ownerDisplay = `ID: ${guild.ownerId} (Uncached User)`;
                    }
                }
            } catch (fetchError) {
                log(`Could not fetch owner for guild ${guild?.name || 'Unknown'} (${guild?.id || 'Unknown ID'}). Error: ${fetchError.message}`, 'warn');
                ownerDisplay = guild?.ownerId ? `ID: ${guild.ownerId} (Couldn't fetch tag)` : 'Unknown Owner';
            }

            const verificationLevels = {
                NONE: 'None',
                LOW: 'Low',
                MEDIUM: 'Medium',
                HIGH: 'High',
                VERY_HIGH: 'Very High'
            };

            const features = Array.isArray(guild.features) ? 
                guild.features.map(feature => 
                    feature.split('_').map(word => word.charAt(0) + word.slice(1).toLowerCase()).join(' ')
                ).join(', ') : 'None';

            const serverInfoMessage = [
                `> **Server Information for ${guild?.name || 'Unknown Server'}**`,
                '> ',
                `> **Owner:** ${ownerDisplay}`,
                `> **Server ID:** ${guild?.id || 'Unknown'}`,
                `> **Created On:** ${guild?.createdAt ? guild.createdAt.toUTCString() : 'Unknown'}`,
                '> ',
                `> **Members:** ${guild?.memberCount || 0}`,
                `> **Channels:** ${guild?.channels?.cache?.size || 0} total`,
                `>   - Text: ${guild?.channels?.cache?.filter(c => c?.type === 'GUILD_TEXT')?.size || 0}`,
                `>   - Voice: ${guild?.channels?.cache?.filter(c => c?.type === 'GUILD_VOICE')?.size || 0}`,
                `>   - Categories: ${guild?.channels?.cache?.filter(c => c?.type === 'GUILD_CATEGORY')?.size || 0}`,
                `> **Roles:** ${guild?.roles?.cache?.size || 0}`,
                '> ',
                `> **Boost Tier:** ${guild?.premiumTier || 'None'}`,
                `> **Boosts:** ${guild?.premiumSubscriptionCount || 0}`,
                `> **Verification Level:** ${verificationLevels[guild?.verificationLevel] || 'Unknown'}`,
                `> **Features:** ${features}`
            ].join('\n');

            await message.channel.send(serverInfoMessage).catch(err => {
                log(`Failed to send server info message: ${err.message}`, 'error');
                return message?.channel?.send('> ❌ **Error:** Failed to send server information.');
            });

            log(`${message?.author?.tag || 'Unknown User'} requested server info for "${guild?.name || 'Unknown Server'}"`, 'info');

        } catch (error) {
            console.error(chalk.red(`[ERROR] Error in serverinfo command for guild ${guild?.id || 'Unknown'}:`), error);
            return message?.channel?.send('> ❌ **Error:** An error occurred while fetching server information.').catch(() => {});
        }
    }
};