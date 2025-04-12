const { Events } = require('discord.js');
const Ticket = require('../models/ticket');
const logger = require('../utils/logger');
const config = require('../config');

module.exports = {
  name: Events.MessageCreate,
  
  async execute(message, client) {
    // Ignore bot messages and messages not in guilds or threads
    if (message.author.bot || !message.guild || (!message.channel.isThread() && !message.channel.name.startsWith('ticket-'))) {
      return;
    }
    
    try {
      // Find the ticket for this thread/channel
      const ticket = await Ticket.findOne({
        $or: [
          { threadId: message.channel.id },
          { channelId: message.channel.id }
        ]
      });
      
      // If this is a ticket thread/channel, process the message
      if (ticket && ticket.status === 'open') {
        // Check if message author is the ticket creator or a staff member
        const isStaff = checkIfStaff(message.member);
        
        // Get message attachments
        const attachments = message.attachments.map(attachment => ({
          url: attachment.url,
          name: attachment.name
        }));
        
        // Create message object for database
        const messageObj = {
          content: message.content,
          author: message.author.username,
          authorId: message.author.id,
          timestamp: message.createdAt,
          isStaff: isStaff,
          attachments: attachments
        };
        
        // Add message to the ticket
        ticket.messages.push(messageObj);
        ticket.lastActivity = new Date();
        
        // If message is from staff and ticket is unassigned, assign it
        if (isStaff && !ticket.assignedStaff) {
          ticket.assignedStaff = message.author.id;
          // Reply to the message to indicate assignment
          await message.reply(`**Note:** This ticket has been automatically assigned to you since you're the first staff member to respond.`);
        }
        
        await ticket.save();
        logger.debug(`Message in ticket ${ticket.ticketId} saved to database`);
      }
    } catch (error) {
      logger.error('Error processing ticket message:', error);
    }
  }
};

/**
 * Check if a guild member is part of the support staff
 * @param {GuildMember} member The guild member to check
 * @returns {boolean} Whether the member is staff
 */
function checkIfStaff(member) {
  if (!member) return false;
  
  // Check for support role
  if (config.supportRoleId && member.roles.cache.has(config.supportRoleId)) {
    return true;
  }
  
  // Check for admin role
  if (config.adminRoleId && member.roles.cache.has(config.adminRoleId)) {
    return true;
  }
  
  // Check for manage guild permission
  if (member.permissions.has('MANAGE_GUILD')) {
    return true;
  }
  
  return false;
}