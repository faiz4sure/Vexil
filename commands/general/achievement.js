import { log } from '../../utils/functions.js';
import axios from 'axios'; 
import fs from 'fs';

export default {
    name: 'achievement',
    description: 'Create a custom Minecraft achievement image.',
    aliases: ['mcachievement'],
    usage: '<icon> <text>',
    category: 'general',
    type: 'both',
    permissions: ['SendMessages', 'AttachFiles'], // Added AttachFiles permission
    cooldown: 60,

    execute: async (client, message, args) => {
        const givenIcon = args[0];
        const text = args.slice(1).join(' ');

        if (!givenIcon || !text) {
            return message.channel.send('> ❌ Please provide both icon and text.\nUsage: `achievement <icon> <text>`');
        }

        try {
            const iconsResponse = await axios.get('https://api.alexflipnote.dev/achievement?icon=0'); // Using axios instead of fetch
            if (iconsResponse.status !== 200) throw new Error('Failed to fetch available icons.');

            const icons = iconsResponse.data;
            let iconId = null;

            // Match icon name or ID
            if (!isNaN(givenIcon)) {
                iconId = givenIcon;
            } else {
                for (const [id, name] of Object.entries(icons)) {
                    if (name.toLowerCase() === givenIcon.toLowerCase()) {
                        iconId = id;
                        break;
                    }
                }
            }

            if (!iconId) {
                const iconsList = Object.entries(icons).map(([k, v]) => `${k}: ${v}`).join('\n');
                return message.channel.send(`> ❌ Invalid icon! Available icons:\n\`\`\`${iconsList}\`\`\``);
            }

            const achievementResponse = await axios.get(`https://api.alexflipnote.dev/achievement?text=${encodeURIComponent(text)}&icon=${iconId}`, { responseType: 'arraybuffer' }); // Using axios with responseType
            if (achievementResponse.status !== 200) throw new Error('Failed to generate achievement.');

            const buffer = Buffer.from(achievementResponse.data); // Convert response to buffer
            const filePath = './achievement.png';
            fs.writeFileSync(filePath, buffer);

            await message.channel.send({ files: [filePath] });
            fs.unlinkSync(filePath); // Clean up after sending
        } catch (error) {
            log(`Error generating achievement: ${error.message}`, 'error');
            message.channel.send(`> ❌ Failed to generate achievement: ${error.message}`); // Improved error message
        }
    }
};