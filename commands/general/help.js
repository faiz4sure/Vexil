import chalk from 'chalk';
import { log } from '../../utils/functions.js';

export default {
    name: 'help',
    description: 'Display help information for commands',
    aliases: ['commands', 'cmds', 'h'],
    usage: '[command name]',
    category: 'general',
    type: 'both', // Can be chosen from dm_only or server_only
    permissions: ['SendMessages'], // Permissions required to execute the command
    cooldown: 5,
    
    /**
     * Execute the help command
     * @param {Client} client - Discord.js client instance
     * @param {Message} message - The message object
     * @param {Array} args - Command arguments
     */
    execute: async (client, message, args) => {
        try {
            const { commands } = client;
            const prefix = client.prefix;
            
            // If no arguments, show categories only
            if (!args.length) {
                // Get unique categories
                const categories = new Set();
                
                commands.forEach(command => {
                    const category = command.category || 'general';
                    categories.add(category);
                });
                
                // Sort categories alphabetically
                const sortedCategories = Array.from(categories).sort();
                
                // Create help message with categories only
                let helpMessage = [
                    '> **⚡ Vexil Help Menu**',
                    `> **Prefix:** \`${prefix}\``,
                    '> ',
                    '> **Available Categories:**'
                ];
                
                // Add categories
                sortedCategories.forEach(category => {
                    const categoryName = category.charAt(0).toUpperCase() + category.slice(1);
                    helpMessage.push(`> - ${categoryName}`);
                });
                
                helpMessage.push('> ');
                helpMessage.push(`> **Usage:**`);
                helpMessage.push(`> \`${prefix}help <category>\` - Show commands in category`);
                helpMessage.push(`> \`${prefix}help ${prefix}<command>\` - Show command details`);
                
                // Send the help message
                return message.channel.send(helpMessage.join('\n'));
            }
            
            const firstArg = args[0].toLowerCase();
            
            // Check if it's a command help request (starts with prefix)
            if (firstArg.startsWith(prefix)) {
                const commandName = firstArg.slice(prefix.length);
                const command = commands.get(commandName) || 
                                [...commands.values()].find(cmd => cmd.aliases && cmd.aliases.includes(commandName));
                
                if (!command) {
                    return message.channel.send(`> **Error:** No command found with name or alias "${commandName}"`);
                }
                
                // Create detailed command help
                let commandHelp = [
                    `> **Command: ${command.name}**`,
                    '> '
                ];
                
                if (command.description) commandHelp.push(`> **Description:** ${command.description}`);
                if (command.aliases && command.aliases.length) commandHelp.push(`> **Aliases:** ${command.aliases.join(', ')}`);
                if (command.usage) commandHelp.push(`> **Usage:** \`${prefix}${command.name} ${command.usage}\``);
                if (command.category) commandHelp.push(`> **Category:** ${command.category.charAt(0).toUpperCase() + command.category.slice(1)}`);
                
                commandHelp.push(`> **Cooldown:** ${command.cooldown || 3} second(s)`);
                
                // Send the command help
                message.channel.send(commandHelp.join('\n'));
                
                // Log the command usage
                log(`${message.author.tag} used help command for "${commandName}"`, 'debug');
                return;
            }
            
            // Otherwise, treat it as a category request
            const categoryName = firstArg;
            
            // Get commands in the specified category
            const categoryCommands = [];
            commands.forEach(command => {
                const commandCategory = (command.category || 'general').toLowerCase();
                if (commandCategory === categoryName) {
                    categoryCommands.push(command.name);
                }
            });
            
            if (categoryCommands.length === 0) {
                return message.channel.send(`> **Error:** No category found with name "${categoryName}"`);
            }
            
            // Sort commands alphabetically
            categoryCommands.sort();
            
            // Create category help message
            const displayCategoryName = categoryName.charAt(0).toUpperCase() + categoryName.slice(1);
            let categoryHelp = [
                `> **${displayCategoryName} Commands**`,
                '> '
            ];
            
            // Add commands in the category
            categoryCommands.forEach(commandName => {
                categoryHelp.push(`> - ${commandName}`);
            });
            
            categoryHelp.push('> ');
            categoryHelp.push(`> **Usage:** \`${prefix}help ${prefix}<command>\` for command details`);
            
            // Send the category help
            message.channel.send(categoryHelp.join('\n'));
            
            // Log the command usage
            log(`${message.author.tag} used help command for category "${categoryName}"`, 'debug');
        } catch (error) {
            console.error(chalk.red('[ERROR] Error in help command:'), error);
            message.channel.send('> **Error:** An error occurred while displaying help.');
        }
    }
};