const { 
  ChannelType, 
  PermissionFlagsBits, 
  Collection, 
  ButtonBuilder, 
  ButtonStyle, 
  ActionRowBuilder,
  EmbedBuilder
} = require('discord.js');
const { createNewTicketEmbed, createTicketLogEmbed } = require('../utils/embeds');
const Ticket = require('../models/ticket');
const config = require('../config');
const logger = require('../utils/logger');

module.exports = {
  name: 'interactionCreate',
  
  async execute(interaction, client) {
    try {
      // Handle slash commands
      if (interaction.isChatInputCommand()) {
        const command = client.commands.get(interaction.commandName);
        
        if (!command) {
          logger.warn(`No command matching ${interaction.commandName} was found.`);
          return;
        }
        
        try {
          await command.execute(interaction);
        } catch (error) {
          logger.error(`Error executing command ${interaction.commandName}:`, error);
          
          const errorMessage = { 
            content: 'There was an error while executing this command!', 
            ephemeral: true 
          };
          
          if (interaction.replied || interaction.deferred) {
            await interaction.followUp(errorMessage);
          } else {
            await interaction.reply(errorMessage);
          }
        }
      }
      // Handle ticket buttons
      else if (interaction.isButton() && interaction.customId.startsWith('ticket_')) {
        await handleTicketButtonClick(interaction, client);
      }
      // Handle close ticket button
      else if (interaction.isButton() && interaction.customId === 'close_ticket') {
        await handleCloseTicket(interaction, client);
      }
      // Handle claim ticket button
      else if (interaction.isButton() && interaction.customId === 'claim_ticket') {
        await handleClaimTicket(interaction, client);
      }
    } catch (error) {
      logger.error('Error handling interaction:', error);
    }
  }
};

/**
 * Handle ticket button click
 * @param {ButtonInteraction} interaction The button interaction
 * @param {Client} client The Discord client
 */
async function handleTicketButtonClick(interaction, client) {
  try {
    // Extract ticket type from custom ID (format: ticket_<type>)
    const ticketType = interaction.customId.split('_')[1];
    
    if (!config.ticketTypes[ticketType]) {
      return interaction.reply({ 
        content: 'Invalid ticket type. Please try again.', 
        ephemeral: true 
      });
    }
    
    // Defer the reply to buy time for processing
    await interaction.deferReply({ ephemeral: true });
    
    const guild = interaction.guild;
    const user = interaction.user;
    
    // Check if user already has an open ticket
    const existingTicket = await Ticket.findOne({ 
      userId: user.id, 
      guildId: guild.id, 
      status: 'open' 
    });
    
    if (existingTicket) {
      try {
        // First try to fetch the thread to make sure it exists
        const thread = await guild.channels.fetch(existingTicket.threadId).catch(() => null);
        
        if (thread) {
          return interaction.editReply({ 
            content: `You already have an open ticket! Please use <#${existingTicket.threadId}> instead.`, 
            ephemeral: true 
          });
        } else {
          // If thread doesn't exist, close the ticket in DB
          existingTicket.status = 'closed';
          existingTicket.closedAt = new Date();
          existingTicket.closedBy = client.user.id;
          await existingTicket.save();
          logger.info(`Auto-closed stale ticket ${existingTicket.ticketId} because thread no longer exists`);
        }
      } catch (error) {
        logger.error('Error checking existing ticket:', error);
        // Close the ticket if we can't verify it
        existingTicket.status = 'closed';
        existingTicket.closedAt = new Date();
        existingTicket.closedBy = client.user.id;
        await existingTicket.save();
      }
    }
    
    // Create a unique ticket ID
    const ticketCount = await Ticket.countDocuments() + 1;
    const paddedCount = ticketCount.toString().padStart(5, '0');
    const ticketId = `TICKET-${paddedCount}`;
    
    // Get the ticket category if configured
    let parent = null;
    if (config.ticketCategoryId) {
      parent = await guild.channels.fetch(config.ticketCategoryId).catch(() => null);
    }
    
    // Create a new thread in the same channel or create a new channel
    let thread;
    let channel = interaction.channel;
    
    // If the channel is a forum channel, create a post
    if (channel.type === ChannelType.GuildForum) {
      const threadName = `${config.ticketTypes[ticketType].label}-${user.username}`;
      const post = await channel.threads.create({
        name: threadName,
        message: { content: `Ticket created by ${user}` },
        reason: `Support ticket created by ${user.tag}`
      });
      thread = post;
    } 
    // If it's a text channel, create a thread
    else if (channel.type === ChannelType.GuildText) {
      const threadName = `${config.ticketTypes[ticketType].label}-${user.username}`;
      
      // IMPORTANT FIX: Create a private thread instead of a public one
      thread = await channel.threads.create({
        name: threadName,
        type: ChannelType.PrivateThread, // Changed to private thread
        autoArchiveDuration: 4320, // 3 days
        reason: `Support ticket created by ${user.tag}`
      });
      
      // Add the user who created the ticket to the thread
      await thread.members.add(user.id);
      
      // Add support role to the thread if configured
      if (config.supportRoleId) {
        try {
          // This notifies the support team about the new ticket
          await thread.send({
            content: `<@&${config.supportRoleId}> A new ticket has been created.`,
            allowedMentions: { roles: [config.supportRoleId] }
          });
        } catch (error) {
          logger.error('Error mentioning support role in thread:', error);
        }
      }
    }
    // Otherwise, create a new ticket channel
    else {
      const channelName = `ticket-${ticketId.toLowerCase()}`;
      channel = await guild.channels.create({
        name: channelName,
        type: ChannelType.GuildText,
        parent: parent,
        permissionOverwrites: [
          {
            id: guild.id,
            deny: [PermissionFlagsBits.ViewChannel]
          },
          {
            id: user.id,
            allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory]
          },
          {
            id: client.user.id,
            allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory]
          }
        ],
        reason: `Support ticket created by ${user.tag}`
      });
      
      // Add support role if configured
      if (config.supportRoleId) {
        await channel.permissionOverwrites.create(config.supportRoleId, {
          ViewChannel: true, 
          SendMessages: true, 
          ReadMessageHistory: true
        });
      }
      
      thread = channel;
    }
    
    // Create ticket embed
    const ticketEmbed = createNewTicketEmbed(user, ticketType, ticketId);
    
    // Create close button
    const closeButton = new ButtonBuilder()
      .setCustomId('close_ticket')
      .setLabel('Close Ticket')
      .setStyle(ButtonStyle.Danger);
      
    // Create claim button
    const claimButton = new ButtonBuilder()
      .setCustomId('claim_ticket')
      .setLabel('Claim Ticket')
      .setStyle(ButtonStyle.Success);
    
    const row = new ActionRowBuilder().addComponents(claimButton, closeButton);
    
    // Send initial message in thread
    await thread.send({ 
      content: `${user}`, 
      embeds: [ticketEmbed], 
      components: [row] 
    });
    
    // Create the ticket in the database
    const newTicket = new Ticket({
      ticketId,
      userId: user.id,
      username: `${user.username}`,
      threadId: thread.id,
      channelId: channel.id,
      guildId: guild.id,
      type: ticketType,
      tags: [config.ticketTypes[ticketType].label]
    });
    
    await newTicket.save();
    
    // Log ticket creation
    if (config.ticketLogsChannelId) {
      const logsChannel = await guild.channels.fetch(config.ticketLogsChannelId).catch(() => null);
      if (logsChannel) {
        const logEmbed = createTicketLogEmbed(newTicket, 'created', user);
        await logsChannel.send({ embeds: [logEmbed] });
      }
    }
    
    // Reply to the interaction
    await interaction.editReply({ 
      content: `Your ticket has been created! Please check ${thread}.`, 
      ephemeral: true 
    });
    
    logger.info(`Ticket ${ticketId} created by ${user.tag} in ${thread.name}`);
  } catch (error) {
    logger.error('Error creating ticket:', error);
    
    if (interaction.replied || interaction.deferred) {
      await interaction.editReply({ 
        content: 'There was an error creating your ticket. Please try again later.', 
        ephemeral: true 
      });
    } else {
      await interaction.reply({ 
        content: 'There was an error creating your ticket. Please try again later.', 
        ephemeral: true 
      });
    }
  }
}

/**
 * Handle close ticket button
 * @param {ButtonInteraction} interaction The button interaction
 * @param {Client} client The Discord client
 */
async function handleCloseTicket(interaction, client) {
  try {
    // Defer the reply to buy time for processing
    await interaction.deferReply();
    
    const guild = interaction.guild;
    const user = interaction.user;
    const channel = interaction.channel;
    
    // Find the ticket in the database
    const ticket = await Ticket.findOne({ 
      $or: [
        { threadId: channel.id },
        { channelId: channel.id }
      ]
    });
    
    if (!ticket) {
      return interaction.editReply('This doesn\'t appear to be a valid ticket channel.');
    }
    
    if (ticket.status === 'closed') {
      return interaction.editReply('This ticket is already closed.');
    }
    
    // Close the ticket in the database
    ticket.status = 'closed';
    ticket.closedAt = new Date();
    ticket.closedBy = user.id;
    await ticket.save();
    
    // Send closure message
    await interaction.editReply('Ticket closed! This channel will be archived in 10 seconds.');
    
    // Log ticket closure
    if (config.ticketLogsChannelId) {
      const logsChannel = await guild.channels.fetch(config.ticketLogsChannelId).catch(() => null);
      if (logsChannel) {
        const logEmbed = createTicketLogEmbed(ticket, 'closed', user);
        await logsChannel.send({ embeds: [logEmbed] });
      }
    }
    
    // Archive or delete the channel/thread after a delay
    setTimeout(async () => {
      try {
        if (channel.isThread()) {
          await channel.setArchived(true);
        } else {
          await channel.delete('Ticket closed');
        }
      } catch (error) {
        logger.error('Error archiving or deleting channel:', error);
      }
    }, 10000);
    
    logger.info(`Ticket ${ticket.ticketId} closed by ${user.tag}`);
  } catch (error) {
    logger.error('Error closing ticket:', error);
    
    if (interaction.replied || interaction.deferred) {
      await interaction.editReply('There was an error closing this ticket. Please try again later.');
    } else {
      await interaction.reply({ 
        content: 'There was an error closing this ticket. Please try again later.',
        ephemeral: true
      });
    }
  }
}

/**
 * Handle claim ticket button
 * @param {ButtonInteraction} interaction The button interaction
 * @param {Client} client The Discord client
 */
async function handleClaimTicket(interaction, client) {
  try {
    // Defer the reply to buy time for processing
    await interaction.deferReply();
    
    const guild = interaction.guild;
    const user = interaction.user;
    const channel = interaction.channel;
    
    // Find the ticket in the database
    const ticket = await Ticket.findOne({ 
      $or: [
        { threadId: channel.id },
        { channelId: channel.id }
      ]
    });
    
    if (!ticket) {
      return interaction.editReply('This doesn\'t appear to be a valid ticket channel.');
    }
    
    // Check if the ticket is already claimed
    if (ticket.claimedBy) {
      return interaction.editReply(`This ticket is already claimed by <@${ticket.claimedBy}>.`);
    }
    
    // Check if user is staff before allowing claim
    const member = await guild.members.fetch(user.id);
    const isStaff = member.roles.cache.has(config.supportRoleId) || 
                   member.roles.cache.has(config.adminRoleId) ||
                   member.permissions.has(PermissionFlagsBits.Administrator);
                   
    // Prevent regular users from claiming tickets
    if (!isStaff) {
      return interaction.editReply('Only support staff can claim tickets.');
    }
    
    // Prevent ticket creator from claiming their own ticket
    if (ticket.userId === user.id) {
      return interaction.editReply('You cannot claim a ticket you created.');
    }
    
    // Claim the ticket in the database
    ticket.claimedBy = user.id;
    ticket.claimedByUsername = user.tag;
    ticket.claimedAt = new Date();
    ticket.status = 'claimed';
    await ticket.save();
    
    // Send claim message
    const embed = new EmbedBuilder()
      .setColor('#57F287')
      .setTitle('Ticket Claimed')
      .setDescription(`This ticket has been claimed by <@${user.id}>.`)
      .setFooter({ text: 'Support Ticket System' })
      .setTimestamp();
    
    await interaction.editReply({ embeds: [embed] });
    
    logger.info(`Ticket ${ticket.ticketId} claimed by ${user.tag}`);
  } catch (error) {
    logger.error('Error claiming ticket:', error);
    
    if (interaction.replied || interaction.deferred) {
      await interaction.editReply('There was an error claiming this ticket. Please try again later.');
    } else {
      await interaction.reply({ 
        content: 'There was an error claiming this ticket. Please try again later.',
        ephemeral: true
      });
    }
  }
}