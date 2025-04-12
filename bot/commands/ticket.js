const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const { createTicketEmbed } = require('../utils/embeds');
const config = require('../config');
const logger = require('../utils/logger');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('ticket')
    .setDescription('Create a ticket panel message with buttons')
    .addChannelOption(option =>
      option.setName('channel')
        .setDescription('The channel to send the ticket panel to')
        .setRequired(true))
    .addStringOption(option =>
      option.setName('title')
        .setDescription('Custom title for the ticket panel (optional)')
        .setRequired(false))
    .addStringOption(option =>
      option.setName('description')
        .setDescription('Custom description for the ticket panel (optional)')
        .setRequired(false))
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild),
  
  async execute(interaction) {
    try {
      // Defer the reply to buy time for processing
      await interaction.deferReply({ ephemeral: true });
      
      // Get the specified channel
      const channel = interaction.options.getChannel('channel');
      const customTitle = interaction.options.getString('title');
      const customDescription = interaction.options.getString('description');
      
      // Check if the channel is a text channel
      if (!channel.isTextBased()) {
        return interaction.editReply({ 
          content: 'The specified channel must be a text channel.', 
          ephemeral: true 
        });
      }
      
      // Check for permissions
      const permissions = channel.permissionsFor(interaction.client.user);
      if (!permissions.has(PermissionFlagsBits.SendMessages) || 
          !permissions.has(PermissionFlagsBits.ViewChannel) ||
          !permissions.has(PermissionFlagsBits.EmbedLinks)) {
        return interaction.editReply({ 
          content: 'I don\'t have the required permissions in that channel. I need permissions to view the channel, send messages, and embed links.', 
          ephemeral: true 
        });
      }
      
      // Create the ticket panel embed and components
      const { embed, components } = createTicketEmbed();
      
      // Apply custom title and description if provided
      if (customTitle) embed.setTitle(customTitle);
      if (customDescription) embed.setDescription(customDescription);
      
      // Send the ticket panel to the specified channel
      await channel.send({ 
        embeds: [embed], 
        components: components 
      });
      
      // Reply to the interaction
      await interaction.editReply({ 
        content: `Ticket panel has been created in ${channel}!`, 
        ephemeral: true 
      });
      
      logger.info(`Ticket panel created by ${interaction.user.tag} in channel ${channel.name}`);
      
    } catch (error) {
      logger.error('Error executing ticket command:', error);
      
      if (interaction.replied || interaction.deferred) {
        await interaction.editReply({ 
          content: 'There was an error while creating the ticket panel. Please try again later.', 
          ephemeral: true 
        });
      } else {
        await interaction.reply({ 
          content: 'There was an error while creating the ticket panel. Please try again later.', 
          ephemeral: true 
        });
      }
    }
  },
};