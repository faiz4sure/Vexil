import { readAfkData, writeAfkData } from '../../utils/afkHandler.js';
import { log } from '../../utils/functions.js';
import { aiAfkUsers } from '../AI/aiafk.js';

export default {
    name: 'afk',
    description: 'Set your AFK status.',
    aliases: [],
    usage: '[reason]',
    category: 'general',
    type: 'both',
    permissions: ['SendMessages'],
    cooldown: 10,

    execute: async (client, message, args) => {
        try {
            // Block if AI AFK is already active
            if (aiAfkUsers.has(message.author.id)) {
                return message.channel.send('> ❌ **AI AFK is active.** Please send any message to return from AI AFK before setting normal AFK.');
            }

            const reason = args.length > 0 ? args.join(' ') : 'No reason provided';
            const afkData = readAfkData();

            afkData[message.author.id] = {
                reason: reason,
                timestamp: Date.now()
            };

            writeAfkData(afkData);

            await message.channel.send(`> ✅ You are now AFK. Reason: ${reason}`);
            log(`${message.author.tag} is now AFK. Reason: ${reason}`, 'info');

        } catch (error) {
            console.error('[ERROR] Error in afk command:', error);
            message.channel.send('> ❌ **Error:** An error occurred while setting your AFK status.');
        }
    }
};