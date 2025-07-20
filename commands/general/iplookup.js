import { log } from '../../utils/functions.js';
import axios from 'axios'; // Added axios import

export default {
    name: 'iplookup',
    description: 'Get detailed information about an IP address.',
    aliases: ['ipinfo', 'ip'],
    usage: '<ip>',
    category: 'misc',
    type: 'both',
    permissions: ['SendMessages'],
    cooldown: 5,

    execute: async (client, message, args) => {
        const ip = args[0];
        if (!ip) {
            return message.channel.send('> ❌ Please provide an IP address.');
        }

        try {
            // Replaced fetch with axios
            const response = await axios.get(`https://ipapi.co/${ip}/json/`);
            if (response.status !== 200) throw new Error('Failed to fetch IP details');

            const data = response.data;
            const info = {
                "IP": data.ip || "N/A",
                "City": data.city || "N/A",
                "Region": data.region || "N/A",
                "Country": data.country_name || "N/A",
                "Post Code": data.postal || "N/A",
                "Timezone": data.timezone || "N/A",
                "Org": data.org || "N/A",
                "ASN": data.asn || "N/A",
                "Location": `${data.latitude || "N/A"}, ${data.longitude || "N/A"}`
            };

            const output = Object.entries(info).map(([key, value]) => `> **${key}:** ${value}`).join('\n');
            message.channel.send(output);
        } catch (error) {
            log(`Error fetching IP details: ${error.message}`, 'error');
            message.channel.send('> ❌ Failed to get IP information.');
        }
    }
};
