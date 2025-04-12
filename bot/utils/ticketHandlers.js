const { 
  PermissionFlagsBits, 
  ChannelType, 
  EmbedBuilder, 
  ActionRowBuilder, 
  ButtonBuilder, 
  ButtonStyle 
} = require('discord.js');
const config = require('../config');
const logger = require('./logger');
const Ticket = require('../models/ticket');

/**
 * Creates a new ticket thread
 * @param {ButtonInteraction} interaction - The interaction that triggered the ticket creation
 * @param {string} ticketType - The type of ticket being created
 * @returns {Promise<ThreadChannel>} The created thread
 */
async function createTicketThread(interaction, ticketType) {
  const { user, guild, channel } = interaction;
  const ticketConfig = config.ticketTypes[ticketType];
  
  if (!ticketConfig) {
    throw new Error(`Invalid ticket type: ${ticketType}`);
  }
  
  try {
    // Create a unique ticket number
    const ticketCount = await Ticket.countDocuments() + 1;
    const ticketNumber = `${ticketCount.toString().padStart(4, '0')}`;
    
    // Thread name format: #0001-username-tickettype
    const threadName = `#${ticketNumber}-${user.username}-${ticketType}`;
    
    // Create the thread - THIS IS THE FIX - setting type to PRIVATE_THREAD
    const thread = await channel.threads.create({
      name: threadName,
      type: ChannelType.PrivateThread,
      reason: `Ticket created by ${user.tag}`
    });
    
    // THIS IS THE FIX - Set proper permissions for the thread
    // Add the ticket creator to the thread
    await thread.members.add(user.id);
    
    // Add support role to the thread if configured
    if (config.supportRoleId) {
      try {
        // This allows adding a role to a private thread
        // Note: The bot needs MANAGE_THREADS permission to do this
        await thread.send({
          content: `<@&${config.supportRoleId}> A new ticket has been created.`,
          allowedMentions: { roles: [config.supportRoleId] }
        });
      } catch (error) {
        logger.error('Error adding support role to thread:', error);
      }
    }
    
    // Create welcome message
    const embed = new EmbedBuilder()
      .setColor(ticketConfig.color)
      .setTitle(`${ticketConfig.emoji} ${ticketConfig.label} Ticket`)
      .setDescription(
        `Hello <@${user.id}>,\n\nThank you for creating a ticket. ` +
        `A staff member will be with you shortly.\n\n` +
        `**Ticket Type:** ${ticketConfig.label}\n` +
        `**Ticket ID:** ${ticketNumber}`
      )
      .setFooter({
        text: `Ticket created by ${user.tag}`,
        iconURL: user.displayAvatarURL()
      })
      .setTimestamp();
    
    // Create buttons for the ticket
    const buttons = new ActionRowBuilder()
      .addComponents(
        new ButtonBuilder()
          .setCustomId(`ticket_close_${thread.id}`)
          .setLabel('Close Ticket')
          .setStyle(ButtonStyle.Danger)
          .setEmoji('🔒'),
        new ButtonBuilder()
          .setCustomId(`ticket_claim_${thread.id}`)
          .setLabel('Claim Ticket')
          .setStyle(ButtonStyle.Success)
          .setEmoji('✋')
      );
    
    // Send the welcome message
    await thread.send({
      content: `<@${user.id}>`,
      embeds: [embed],
      components: [buttons]
    });
    
    // Create a database entry for the ticket
    const newTicket = new Ticket({
      ticketId: ticketNumber,
      userId: user.id,
      username: user.tag,
      channelId: thread.id,
      guildId: guild.id,
      type: ticketType,
      status: 'open',
      createdAt: new Date()
    });
    
    await newTicket.save();
    logger.info(`Ticket #${ticketNumber} created by ${user.tag}`);
    
    return thread;
  } catch (error) {
    logger.error('Error creating ticket thread:', error);
    throw error;
  }
}

/**
 * Claims a ticket and assigns it to a staff member
 * @param {ButtonInteraction} interaction - The interaction that triggered the claim
 * @param {string} threadId - The ID of the thread to claim
 */
async function claimTicket(interaction, threadId) {
  const { user, guild } = interaction;
  
  try {
    // Check if user is staff
    const member = await guild.members.fetch(user.id);
    const isStaff = member.roles.cache.has(config.supportRoleId) || 
                   member.roles.cache.has(config.adminRoleId) ||
                   member.permissions.has(PermissionFlagsBits.Administrator);
    
    // THIS IS THE FIX - Only allow staff to claim tickets
    if (!isStaff) {
      return interaction.reply({
        content: '❌ Only staff members can claim tickets.',
        ephemeral: true
      });
    }
    
    // Get the ticket from database
    const ticket = await Ticket.findOne({ channelId: threadId });
    
    if (!ticket) {
      return interaction.reply({
        content: '❌ Ticket not found in the database.',
        ephemeral: true
      });
    }
    
    // Prevent ticket creator from claiming their own ticket
    if (ticket.userId === user.id) {
      return interaction.reply({
        content: '❌ You cannot claim a ticket you created.',
        ephemeral: true
      });
    }
    
    // Check if ticket is already claimed
    if (ticket.claimedBy) {
      return interaction.reply({
        content: `❌ This ticket has already been claimed by <@${ticket.claimedBy}>.`,
        ephemeral: true
      });
    }
    
    // Update the ticket in the database
    ticket.claimedBy = user.id;
    ticket.claimedByUsername = user.tag;
    ticket.claimedAt = new Date();
    ticket.status = 'claimed';
    
    await ticket.save();
    
    // Send a message to the thread
    const embed = new EmbedBuilder()
      .setColor('#57F287')
      .setTitle('Ticket Claimed')
      .setDescription(`This ticket has been claimed by <@${user.id}>.`)
      .setFooter({
        text: `Claimed by ${user.tag}`,
        iconURL: user.displayAvatarURL()
      })
      .setTimestamp();
    
    await interaction.reply({ embeds: [embed] });
    
    logger.info(`Ticket #${ticket.ticketId} claimed by ${user.tag}`);
  } catch (error) {
    logger.error('Error claiming ticket:', error);
    
    await interaction.reply({
      content: '❌ An error occurred while claiming the ticket.',
      ephemeral: true
    });
  }
}

/**
 * Closes a ticket
 * @param {ButtonInteraction} interaction - The interaction that triggered the close
 * @param {string} threadId - The ID of the thread to close
 */
async function closeTicket(interaction, threadId) {
  const { user, guild, channel } = interaction;
  
  try {
    // Get the ticket from database
    const ticket = await Ticket.findOne({ channelId: threadId });
    
    if (!ticket) {
      return interaction.reply({
        content: '❌ Ticket not found in the database.',
        ephemeral: true
      });
    }
    
    // Check if user is staff or ticket creator
    const member = await guild.members.fetch(user.id);
    const isStaff = member.roles.cache.has(config.supportRoleId) || 
                   member.roles.cache.has(config.adminRoleId) ||
                   member.permissions.has(PermissionFlagsBits.Administrator);
    
    const isTicketCreator = ticket.userId === user.id;
    
    if (!isStaff && !isTicketCreator) {
      return interaction.reply({
        content: '❌ You don\'t have permission to close this ticket.',
        ephemeral: true
      });
    }
    
    // Update the ticket in the database
    ticket.closedBy = user.id;
    ticket.closedByUsername = user.tag;
    ticket.closedAt = new Date();
    ticket.status = 'closed';
    
    await ticket.save();
    
    // Send a message to the thread
    const embed = new EmbedBuilder()
      .setColor('#ED4245')
      .setTitle('Ticket Closed')
      .setDescription(`This ticket has been closed by <@${user.id}>.`)
      .setFooter({
        text: `Closed by ${user.tag}`,
        iconURL: user.displayAvatarURL()
      })
      .setTimestamp();
    
    await interaction.reply({ embeds: [embed] });
    
    // Archive the thread after a short delay
    setTimeout(async () => {
      try {
        await channel.setArchived(true);
        logger.info(`Ticket #${ticket.ticketId} closed and archived by ${user.tag}`);
      } catch (error) {
        logger.error('Error archiving thread:', error);
      }
    }, 5000);
  } catch (error) {
    logger.error('Error closing ticket:', error);
    
    await interaction.reply({
      content: '❌ An error occurred while closing the ticket.',
      ephemeral: true
    });
  }
}

module.exports = {
  createTicketThread,
  claimTicket,
  closeTicket
};