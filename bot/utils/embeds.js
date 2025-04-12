const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const config = require('../config');
const moment = require('moment');

/**
 * Creates a ticket selection embed with buttons
 * @returns {Object} Object containing embed and components
 */
function createTicketEmbed() {
  const embed = new EmbedBuilder()
    .setTitle('🎫 Create a Support Ticket')
    .setDescription('Need help? Click one of the buttons below to create a support ticket. Our team will assist you as soon as possible.')
    .setColor('#5865F2')
    .addFields(
      Object.values(config.ticketTypes).map(type => {
        return {
          name: `${type.emoji} ${type.label}`,
          value: type.description,
          inline: true
        };
      })
    )
    .setFooter({ text: 'Support Ticket System' })
    .setTimestamp();

  // Create buttons for each ticket type
  const row1 = new ActionRowBuilder();
  const row2 = new ActionRowBuilder();
  
  // Add first 3 buttons to row 1
  const ticketTypeEntries = Object.entries(config.ticketTypes);
  ticketTypeEntries.slice(0, 3).forEach(([id, type]) => {
    row1.addComponents(
      new ButtonBuilder()
        .setCustomId(`ticket_${id}`)
        .setLabel(type.label)
        .setEmoji(type.emoji)
        .setStyle(ButtonStyle.Primary)
    );
  });
  
  // Add remaining buttons to row 2
  ticketTypeEntries.slice(3).forEach(([id, type]) => {
    row2.addComponents(
      new ButtonBuilder()
        .setCustomId(`ticket_${id}`)
        .setLabel(type.label)
        .setEmoji(type.emoji)
        .setStyle(ButtonStyle.Primary)
    );
  });
  
  const components = [row1];
  if (row2.components.length > 0) {
    components.push(row2);
  }
  
  return { embed, components };
}

/**
 * Creates a new ticket embed for inside the thread
 * @param {Object} user The user who created the ticket
 * @param {string} ticketType The type of ticket
 * @param {string} ticketId The ticket ID
 * @returns {EmbedBuilder} The embed
 */
function createNewTicketEmbed(user, ticketType, ticketId) {
  const type = config.ticketTypes[ticketType];
  
  return new EmbedBuilder()
    .setTitle(`${type.emoji} ${type.label} Ticket`)
    .setDescription(`Thank you for creating a ticket. Our support team will assist you shortly.`)
    .setColor(type.color)
    .addFields(
      { name: 'Ticket ID', value: ticketId, inline: true },
      { name: 'Created By', value: `<@${user.id}>`, inline: true },
      { name: 'Created At', value: moment().format('YYYY-MM-DD HH:mm:ss'), inline: true },
      { name: 'Instructions', value: 'Please describe your issue in detail. Include any relevant information that might help us assist you better.' }
    )
    .setFooter({ text: 'Support Ticket System' })
    .setTimestamp();
}

/**
 * Creates a ticket closed embed
 * @param {Object} closer The user who closed the ticket
 * @param {string} reason The reason for closing
 * @returns {EmbedBuilder} The embed
 */
function createTicketClosedEmbed(closer, reason) {
  return new EmbedBuilder()
    .setTitle('Ticket Closed')
    .setDescription(`This ticket has been closed by <@${closer.id}>.`)
    .setColor('#ED4245')
    .addFields(
      { name: 'Reason', value: reason || 'No reason provided' },
      { name: 'Closed At', value: moment().format('YYYY-MM-DD HH:mm:ss') }
    )
    .setFooter({ text: 'Support Ticket System' })
    .setTimestamp();
}

/**
 * Creates a ticket log embed for the log channel
 * @param {Object} ticket The ticket object
 * @param {string} action The action performed (created, closed, etc.)
 * @param {Object} user The user who performed the action
 * @returns {EmbedBuilder} The embed
 */
function createTicketLogEmbed(ticket, action, user) {
  const embed = new EmbedBuilder()
    .setTitle(`Ticket ${action.charAt(0).toUpperCase() + action.slice(1)}`)
    .setColor(action === 'created' ? '#57F287' : action === 'closed' ? '#ED4245' : '#5865F2')
    .addFields(
      { name: 'Ticket ID', value: ticket.ticketId, inline: true },
      { name: 'User', value: `<@${ticket.userId}>`, inline: true },
      { name: 'Type', value: ticket.type.charAt(0).toUpperCase() + ticket.type.slice(1), inline: true },
      { name: `${action.charAt(0).toUpperCase() + action.slice(1)} By`, value: `<@${user.id}>`, inline: true },
      { name: `${action.charAt(0).toUpperCase() + action.slice(1)} At`, value: moment().format('YYYY-MM-DD HH:mm:ss'), inline: true }
    )
    .setFooter({ text: 'Support Ticket System' })
    .setTimestamp();
    
  if (ticket.threadId) {
    embed.setDescription(`[Jump to Ticket](https://discord.com/channels/${ticket.guildId}/${ticket.threadId})`);
  }
  
  return embed;
}

module.exports = {
  createTicketEmbed,
  createNewTicketEmbed,
  createTicketClosedEmbed,
  createTicketLogEmbed
};