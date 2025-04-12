const { REST, Routes } = require('discord.js');
const fs = require('fs');
const path = require('path');
const config = require('../config');
const logger = require('../utils/logger');

module.exports = {
  name: 'ready',
  once: true,
  
  async execute(client) {
    try {
      logger.info(`Logged in as ${client.user.tag}!`);
      
      // Set the bot's activity
      client.user.setActivity('support tickets', { type: 'WATCHING' });
      
      // Register slash commands
      logger.info('Started refreshing application (/) commands.');
      
      const commands = [];
      const commandsPath = path.join(__dirname, '../commands');
      const commandFiles = fs.readdirSync(commandsPath).filter(file => file.endsWith('.js'));
      
      for (const file of commandFiles) {
        const filePath = path.join(commandsPath, file);
        const command = require(filePath);
        
        if ('data' in command && 'execute' in command) {
          commands.push(command.data.toJSON());
        } else {
          logger.warn(`Command at ${filePath} is missing required properties`);
        }
      }
      
      const rest = new REST().setToken(config.token);
      
      // If guildId is provided, register commands in that guild
      // Otherwise, register them globally
      if (config.guildId) {
        await rest.put(
          Routes.applicationGuildCommands(config.clientId, config.guildId),
          { body: commands }
        );
        logger.info(`Successfully registered ${commands.length} application commands in guild ${config.guildId}.`);
      } else {
        await rest.put(
          Routes.applicationCommands(config.clientId),
          { body: commands }
        );
        logger.info(`Successfully registered ${commands.length} global application commands.`);
      }
      
      logger.info('Bot is ready!');
    } catch (error) {
      logger.error('Error in ready event:', error);
    }
  },
};