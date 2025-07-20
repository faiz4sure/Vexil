import { log } from '../../utils/functions.js';
import axios from 'axios';

export default {
    name: 'dog',
    description: 'Get a random dog picture.',
    aliases: ['dogpic'],
    usage: '',
    category: 'general',
    type: 'both',
    permissions: ['SendMessages', 'AttachFiles'],
    cooldown: 5,

    execute: async (client, message, args) => {
        try {
            const response = await axios.get('https://api.alexflipnote.dev/dogs');
            if (response.status !== 200) throw new Error('Failed to fetch dog image.');

            const imageUrl = response.data.file;

            message.channel.send(imageUrl);
        } catch (error) {
            log(`Error fetching dog image: ${error.message}`, 'error');
            message.channel.send(`> ❌ Failed to get dog picture: ${error.message}`);
        }
    }
};