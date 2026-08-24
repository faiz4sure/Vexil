import AIManager from "../../utils/AIManager.js";

export default {
    name: 'ask',
    description: "Asks a question to the configured default AI model.",
    aliases: ['ai', 'chat'],
    usage: '<query>',
    category: 'AI',
    type: 'both',
    permissions: ['SendMessages'],
    cooldown: 5,
    async execute(client, message, args) {
        const query = args.join(' ');

        if (!query) {
            return message.channel.send(`Usage: \`${client.prefix}ask <query>\``);
        }

        try {
            const defaultProvider = AIManager.getDefaultProvider();
            if (!AIManager.isAvailable(defaultProvider)) {
                return message.channel.send(`> ❌ **Error:** Default AI provider \`${defaultProvider}\` is not enabled or its API key is missing in config.yaml.`);
            }

            const responseContent = await AIManager.generateContent(query);

            if (responseContent) {
                // Discord message limit is 2000 characters, so we need to split if longer
                if (responseContent.length > 2000) {
                    const chunks = responseContent.match(/[^]{1,2000}/g);
                    for (const chunk of chunks) {
                        await message.channel.send(chunk);
                    }
                } else {
                    await message.channel.send(responseContent);
                }
            } else {
                await message.channel.send(`> ❌ **Error:** AI Provider \`${defaultProvider}\` did not return a response.`);
            }

        } catch (error) {
            console.error('Error communicating with AI:', error);
            await message.channel.send(`> ❌ **Error:** There was an error trying to get a response from the AI: ${error.message}`);
        }
    },
};
