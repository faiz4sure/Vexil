import { log } from '../../utils/functions.js';
import axios from 'axios'; 

export default {
    name: 'fox',
    description: 'Get a random fox picture.',
    aliases: ['foxpic'],
    usage: '',
    category: 'general',
    type: 'both',
    permissions: ['SendMessages', 'AttachFiles'], 
    cooldown: 5,

    execute: async (client, message, args) => {
        try {
            const response = await axios.get('https://api.alexflipnote.dev/foxes'); // Using axios instead of fetch
            if (response.status !== 200) throw new Error('Failed to fetch fox image.');

            const imageUrl = response.data.file;

            message.channel.send(imageUrl);
        } catch (error) {
            log(`Error fetching fox image: ${error.message}`, 'error');
            message.channel.send(`> ❌ Failed to get fox picture: ${error.message}`); // Improved error message
        }
    }
};