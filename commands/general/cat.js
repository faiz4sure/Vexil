import { log } from '../../utils/functions.js';
import axios from 'axios';

export default {
    name: 'cat',
    description: 'Get a random cat picture.',
    aliases: ['catpic'],
    usage: '',
    category: 'general',
    type: 'both',
    permissions: ['SendMessages', 'AttachFiles'],
    cooldown: 5,

    execute: async (client, message, args) => {
        try {
            const response = await axios.get('https://api.alexflipnote.dev/cats');
            if (response.status !== 200) throw new Error('Failed to fetch cat image.');

            const imageUrl = response.data.file;

            message.channel.send(imageUrl);
        } catch (error) {
            log(`Error fetching cat image: ${error.message}`, 'error');
            message.channel.send(`> ❌ Failed to get cat picture: ${error.message}`);
        }
    }
};