export default {
    name: 'banner',
    description: "Displays a user's or server's banner.",
    aliases: ['b'],
    usage: '[user mention/id | server]',
    category: 'general',
    type: 'both',
    permissions: ['SendMessages'],    cooldown: 3,
    async execute(client, message, args) {
        let targetUser = null;
        let targetGuild = null;
        let bannerName = "";

        if (args.length > 0) {
            const arg = args[0].toLowerCase();
            if (arg === 'server' || arg === 'guild') {
                if (message.guild) {
                    targetGuild = message.guild;
                    bannerName = `${message.guild.name}'s`;
                } else {
                    return message.channel.send('> ❌ **Error:** This command can only fetch server banners in a guild channel.');
                }
            } else {
                // Try to find a mentioned user
                const mentionedUser = message.mentions.users.first();
                if (mentionedUser) {
                    targetUser = mentionedUser;
                    bannerName = `${targetUser.username}'s`;
                } else {
                    // Try to find user by ID
                    const userId = args[0].replace(/[^0-9]/g, ''); // Extract ID from potential mention or raw ID
                    if (userId) {
                        try {
                            // Force fetch user to ensure banner property is populated
                            const fetchedUser = await client.users.fetch(userId, { force: true });
                            if (fetchedUser) {
                                targetUser = fetchedUser;
                                bannerName = `${targetUser.username}'s`;
                            } else {
                                return message.channel.send(`> ❌ **Error:** Could not find a user with that ID. Usage: \`${client.prefix}banner [user mention/id | server]\``);
                            }
                        } catch (error) {
                            console.error("Error fetching user for banner:", error);
                            return message.channel.send(`> ❌ **Error:** Invalid argument or user not found. Usage: \`${client.prefix}banner [user mention/id | server]\``);
                        }
                    } else {
                        // If no valid argument, default to author
                        targetUser = message.author;
                        bannerName = "Your";
                    }
                }
            }
        } else {
            // No arguments, default to author
            targetUser = message.author;
            bannerName = "Your";
        }

        let bannerURL = null;
        if (targetGuild) {
            bannerURL = targetGuild.bannerURL({ size: 1024 });
        } else if (targetUser) {
            // Ensure the user object has the banner property populated by re-fetching with force: true
            const fullUser = await client.users.fetch(targetUser.id, { force: true });
            bannerURL = fullUser.bannerURL({ size: 1024 });
        }

        if (!bannerURL) {
            let infoMessage = `> ℹ️ **Info:** ${bannerName} doesn't have a banner.`;
            if (targetUser) {
                infoMessage += `\n> (Users need Discord Nitro to set a banner.)`;
            } else if (targetGuild) {
                infoMessage += `\n> (Servers need a certain boost level to set a banner.)`;
            }
            return message.channel.send(infoMessage);
        }

        const messageContent = `> **${bannerName} Banner**\n> ${bannerURL}\n> [Download Link](${bannerURL})`;

        message.channel.send(messageContent);
    },
};