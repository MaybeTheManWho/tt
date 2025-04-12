require('dotenv').config();
const { REST, Routes } = require('discord.js');
const fs = require('node:fs');
const path = require('node:path');
const config = require('./config');

// Improved error handling
process.on('uncaughtException', (error) => {
  console.error('Uncaught Exception:', error);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
});

// Log environment variables for debugging
console.log('Environment Check:');
console.log('- Token exists:', !!config.token);
console.log('- Client ID exists:', !!config.clientId);
console.log('- Guild ID exists:', !!config.guildId);

const commands = [];
// Grab all the command files from the commands directory
const commandsPath = path.join(__dirname, 'commands');

if (!fs.existsSync(commandsPath)) {
  console.error('Commands directory does not exist!');
  process.exit(1);
}

const commandFiles = fs.readdirSync(commandsPath).filter(file => file.endsWith('.js'));

// Grab the SlashCommandBuilder#toJSON() output of each command's data for deployment
for (const file of commandFiles) {
  const command = require(`./commands/${file}`);
  if (!command.data) {
    console.warn(`Command file ${file} is missing the required "data" export.`);
    continue;
  }
  commands.push(command.data.toJSON());
  console.log(`Added command: ${command.data.name}`);
}

if (commands.length === 0) {
  console.error('No commands found to register!');
  process.exit(1);
}

// Construct and prepare an instance of the REST module
const rest = new REST({ version: '10' }).setToken(config.token);

// and deploy your commands!
(async () => {
  try {
    console.log(`Started refreshing ${commands.length} application (/) commands.`);

    // The put method is used to fully refresh all commands with the current set
    if (config.guildId) {
      // Guild commands
      console.log(`Registering guild commands to guild ID: ${config.guildId}`);
      const data = await rest.put(
        Routes.applicationGuildCommands(config.clientId, config.guildId),
        { body: commands },
      );
      console.log(`Successfully reloaded ${data.length} guild (/) commands.`);
    } else {
      // Global commands
      console.log('Registering global commands');
      const data = await rest.put(
        Routes.applicationCommands(config.clientId),
        { body: commands },
      );
      console.log(`Successfully reloaded ${data.length} global (/) commands.`);
    }
  } catch (error) {
    console.error('Error during command registration:');
    console.error(error);
    
    if (error.code === 50001) {
      console.error('MISSING ACCESS ERROR: This usually means one of:');
      console.error('1. The bot token is incorrect');
      console.error('2. The bot lacks the "applications.commands" scope');
      console.error('3. If using guild commands, the bot is not in the specified guild');
      console.error('4. The bot lacks required permissions');
      
      console.error('\nSolution: Check your bot token and make sure to include these scopes when adding the bot to your server:');
      console.error('bot applications.commands');
      
      const inviteUrl = `https://discord.com/api/oauth2/authorize?client_id=${config.clientId}&permissions=8&scope=bot%20applications.commands`;
      console.error(`\nTry reinviting your bot using this URL: ${inviteUrl}`);
    }
  }
})();