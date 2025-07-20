import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { RichPresence, Util } from 'discord.js-selfbot-rpc';
import { log } from '../../utils/functions.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rpcFilePath = path.join(__dirname, '../../data/rpc.json');

export default {
    name: 'rpc',
    description: "Manages the bot's Rich Presence",
    aliases: ['richpresence', 'presence'],
    usage: '<on|off|set|view>',
    category: 'status',
    type: 'both',
    permissions: ['SendMessages'],
    cooldown: 3,
    async execute(client, message, args) {

        // Add channel type logging for debugging
        if (message.channel && message.channel.type === 'DM') {
            log('Command executed in DM channel', 'info');
        } else if (message.channel) {
            log(`Command executed in guild: ${message.channel.guild?.name} (${message.channel.guild?.id})`, 'info');
        }

        let rpcConfig = {};
        if (fs.existsSync(rpcFilePath)) {
            try {
                rpcConfig = JSON.parse(fs.readFileSync(rpcFilePath, 'utf8'));
            } catch (error) {
                log('Error parsing rpc.json:', 'error', error);
                // If parsing fails, initialize with empty config
                rpcConfig = {};
            }
        } else {
            // If file doesn't exist, ensure the directory exists and then create it with an empty object
            fs.mkdirSync(path.dirname(rpcFilePath), { recursive: true });
            fs.writeFileSync(rpcFilePath, '{}', 'utf8');
        }

        const subcommand = args[0] ? args[0].toLowerCase() : null;

        // Provide usage instructions when no subcommand is provided
        if (!subcommand) {
            // Check if message and message.channel are defined before sending
            if (!message || !message.channel) {
                log('Cannot send message: invalid message object', 'error');
                return;
            }
            
            try {
                return message.channel.send(`Usage: \`rpc <on|off|set|view>\`
Valid subcommands are: on, off, set, view\n\nExamples:\n• \`rpc on\` - Enable Rich Presence\n• \`rpc off\` - Disable Rich Presence\n• \`rpc set details "Playing cool game"\` - Set status details\n• \`rpc view\` - View current configuration`);
            } catch (error) {
                log('Error sending usage message:', 'error', error);
                return;
            }
        }

        switch (subcommand) {
            case 'on':
                rpcConfig.enabled = true;
                if (rpcConfig.custom) {
                    // Ensure assets object exists in custom config before merging
                    rpcConfig.custom.assets = rpcConfig.custom.assets || {};
                    // Apply custom RPC if it exists, merging with default values
                    // Ensure default assets are merged with custom assets
                    const activity = {
                        ...client.config.rich_presence.default,
                        ...rpcConfig.custom,
                        assets: { ...client.config.rich_presence.default.assets, ...rpcConfig.custom.assets }
                    };
                    await client.user.setActivity(activity);
                    message.channel.send('> **Rich Presence enabled with custom configuration!**');
                } else {
                    // Reset to default RPC from ready.js using RichPresence
                    const applicationId = '1306468377539379241'; // From sample-rpc.js
                    try {
                        const largeImage = await Util.getAssets(applicationId, 'vexil');
                        const smallImage = await Util.getAssets(applicationId, 'thunder');
                        
                        const presence = new RichPresence()
                            .setStatus(client.config.selfbot.status)
                            .setType('PLAYING')
                            .setApplicationId(applicationId)
                            .setName('Vexil Selfbot')
                            .setDetails('Summoning Silence')
                            .setState('github.com/faiz4sure')
                            .setAssetsLargeImage(largeImage.id)
                            .setAssetsLargeText('Vexil')
                            .setAssetsSmallImage(smallImage.id)
                            .setAssetsSmallText('github.com/faiz4sure')
                            .setTimestamp();

                        await client.user.setPresence(presence.toData());
                        message.channel.send('> **Rich Presence enabled with default configuration!**');
                    } catch (error) {
                        log(`Failed to set Default Rich Presence: ${error.message}`, 'error');
                        message.channel.send('> ❌ **Error:** Failed to set default Rich Presence. Check console for details.');
                    }
                }
                break;
            case 'off':
                rpcConfig.enabled = false;
                client.user.setActivity(null); // Clear RPC
                message.channel.send('Rich Presence disabled permanently.');
                break;
            case 'set': {
                let setProperty = args[1] ? args[1].toLowerCase() : null;
                let setValue = args.slice(2).join(' ');
                let validTypes, timestampType, timestampValue;

                if (!rpcConfig.custom) {
                    rpcConfig.custom = {};
                }

                if (!setProperty) {
                    return message.channel.send('Please specify what RPC property you want to set (e.g., `details`, `state`, `largeimage`, `smallimage`, `type`, `name`, `buttons`, `applicationid`, `timestamps`).');
                }

                switch (setProperty) {
                    case 'details':
                        rpcConfig.custom.details = setValue;
                        message.channel.send(`RPC Details set to: \`\`\`${setValue}\`\`\``);
                        break;
                    case 'state':
                        rpcConfig.custom.state = setValue;
                        message.channel.send(`RPC State set to: \`\`\`${setValue}\`\`\``);
                        break;
                    case 'largeimage':
                        rpcConfig.custom.assets = rpcConfig.custom.assets || {};
                        rpcConfig.custom.assets.large_image = setValue;
                        message.channel.send(`RPC Large Image set to: \`\`\`${setValue}\`\`\``);
                        break;
                    case 'largetext':
                        rpcConfig.custom.assets = rpcConfig.custom.assets || {};
                        rpcConfig.custom.assets.large_text = setValue;
                        message.channel.send(`RPC Large Image Text set to: \`\`\`${setValue}\`\`\``);
                        break;
                    case 'smallimage':
                        rpcConfig.custom.assets = rpcConfig.custom.assets || {};
                        rpcConfig.custom.assets.small_image = setValue;
                        message.channel.send(`RPC Small Image set to: \`\`\`${setValue}\`\`\``);
                        break;
                    case 'smalltext':
                        rpcConfig.custom.assets = rpcConfig.custom.assets || {};
                        rpcConfig.custom.assets.small_text = setValue;
                        message.channel.send(`> **RPC Small Image Text Set!**\n> \`${setValue}\``);
                        break;
                    case 'type':
                        validTypes = ['playing', 'streaming', 'listening', 'watching', 'custom_status', 'competing'];
                        if (!validTypes.includes(setValue.toLowerCase())) {
                            return message.channel.send(`Invalid activity type. Valid types are: ${validTypes.join(', ')}.`);
                        }
                        rpcConfig.custom.type = setValue.toUpperCase();
                        message.channel.send(`RPC Type set to: \`\`\`${setValue.toUpperCase()}\`\`\``);
                        break;
                    case 'name':
                        rpcConfig.custom.name = setValue;
                        message.channel.send(`RPC Name set to: \`\`\`${setValue}\`\`\``);
                        break;
                    case 'applicationid':
                        rpcConfig.custom.application_id = setValue;
                        message.channel.send(`RPC Application ID set to: \`\`\`${setValue}\`\`\``);
                        break;
                    
                    case 'timestamps':
                        // Example: timestamps start 1234567890 or timestamps end 1234567890
                        timestampType = args[2] ? args[2].toLowerCase() : null;
                        timestampValue = args[3] ? parseInt(args[3]) : null;

                        if (!timestampType || !timestampValue || !['start', 'end'].includes(timestampType)) {
                            return message.channel.send('Invalid timestamp format. Use: `timestamps <start|end> <unix_timestamp>`');
                        }
                        rpcConfig.custom.timestamps = rpcConfig.custom.timestamps || {};
                        if (timestampType === 'start') {
                            rpcConfig.custom.timestamps.start = timestampValue;
                        } else {
                            rpcConfig.custom.timestamps.end = timestampValue;
                        }
                        message.channel.send(`RPC Timestamp ${timestampType} set to: \`\`\`${timestampValue}\`\`\``);
                        break;
                    default:
                        if (message && message.channel) {
                            message.channel.send('> **Error:** Unknown RPC property.\n> Valid properties are: `details`, `state`, `largeimage`, `largetext`, `smallimage`, `smalltext`, `type`, `name`, `buttons`, `applicationid`, `timestamps`');
                        }
                        break;
                }

                // Apply the new custom RPC if enabled
                if (rpcConfig.enabled) {
                    const applicationId = rpcConfig.custom.application_id || '1306468377539379241'; // Use custom ID or default
                    try {
                        const presence = new RichPresence();

                        // Set properties from rpcConfig.custom
                        if (rpcConfig.custom.details) presence.setDetails(rpcConfig.custom.details);
                        if (rpcConfig.custom.state) presence.setState(rpcConfig.custom.state);
                        if (rpcConfig.custom.type) presence.setType(rpcConfig.custom.type);

                        // Ensure name is always a string
                        const rpcName = typeof rpcConfig.custom.name === 'string'
                            ? rpcConfig.custom.name
                            : (client.config.rich_presence.default && typeof client.config.rich_presence.default.name === 'string' ? client.config.rich_presence.default.name : 'Selfbot');
                        presence.setName(rpcName);

                        // Ensure application_id is always a string
                        const rpcApplicationId = typeof rpcConfig.custom.application_id === 'string'
                            ? rpcConfig.custom.application_id
                            : (client.config.rich_presence.default && typeof client.config.rich_presence.default.application_id === 'string' ? client.config.rich_presence.default.application_id : '1306468377539379241');
                        presence.setApplicationId(rpcApplicationId);

                        if (rpcConfig.custom.timestamps) {
                            if (rpcConfig.custom.timestamps.start) presence.setTimestamp(rpcConfig.custom.timestamps.start);
                            if (rpcConfig.custom.timestamps.end) presence.setEndTimestamp(rpcConfig.custom.timestamps.end);
                        }

                        // Handle assets (images and text)
                        if (rpcConfig.custom.assets) {
                            if (rpcConfig.custom.assets.large_image) {
                                try {
                                    const largeImage = await Util.getAssets(applicationId, rpcConfig.custom.assets.large_image);
                                    if (largeImage) {
                                        presence.setAssetsLargeImage(largeImage.id);
                                    } else {
                                        log(`Asset not found for large_image: ${rpcConfig.custom.assets.large_image}`, 'warn');
                                    }
                                } catch (error) {
                                    log(`Error fetching large_image asset: ${error.message}`, 'error');
                                }
                            }
                            if (rpcConfig.custom.assets.large_text) {
                                presence.setAssetsLargeText(rpcConfig.custom.assets.large_text);
                            }
                            if (rpcConfig.custom.assets.small_image) {
                                try {
                                    const smallImage = await Util.getAssets(applicationId, rpcConfig.custom.assets.small_image);
                                    if (smallImage) {
                                        presence.setAssetsSmallImage(smallImage.id);
                                    } else {
                                        log(`Asset not found for small_image: ${rpcConfig.custom.assets.small_image}`, 'warn');
                                    }
                                } catch (error) {
                                    log(`Error fetching small_image asset: ${error.message}`, 'error');
                                }
                            }
                            if (rpcConfig.custom.assets.small_text) {
                                presence.setAssetsSmallText(rpcConfig.custom.assets.small_text);
                            }
                        }

                        // Set status from client.config.selfbot.status
                        presence.setStatus(client.config.selfbot.status);

                        await client.user.setPresence(presence.toData());
                    } catch (error) {
                        log(`Failed to set custom Rich Presence: ${error.message}`, 'error');
                        message.channel.send('> ❌ **Error:** Failed to set custom Rich Presence. Check console for details.');
                    }
                }
                break;
            }
            case 'view':
                if (rpcConfig.custom) {
                    message.channel.send(`Current Custom RPC Configuration:\n\`\`\`json\n${JSON.stringify(rpcConfig.custom, null, 2)}\n\`\`\``);
                } else {
                    message.channel.send('No custom RPC configuration set. Using default configuration:');
                    message.channel.send(`\`\`\`json\n${JSON.stringify(client.config.rich_presence.default, null, 2)}\`\`\``);
                }
                break;
            default:
                message.channel.send('Usage: `rpc <on|off|set|view>`');
                break;
        }

        fs.writeFileSync(rpcFilePath, JSON.stringify(rpcConfig, null, 2), 'utf8');
    },
};
