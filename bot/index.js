require('dotenv').config();
const { 
  Client, 
  GatewayIntentBits, 
  Partials, 
  Collection, 
  Events, 
  ChannelType, 
  EmbedBuilder, 
  ActionRowBuilder, 
  ButtonBuilder,
  ButtonStyle,
  PermissionFlagsBits
} = require('discord.js');
const fs = require('fs');
const path = require('path');
const mongoose = require('mongoose');
const express = require('express');
const cors = require('cors');
const moment = require('moment');

// Improved error handling
process.on('uncaughtException', (error) => {
  console.error('Uncaught Exception:', error);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
});

// Load configuration
const config = {
  token: process.env.DISCORD_BOT_TOKEN,
  clientId: process.env.DISCORD_CLIENT_ID,
  guildId: process.env.GUILD_ID,
  ticketCategoryId: process.env.TICKET_CATEGORY_ID,
  ticketLogsChannelId: process.env.TICKET_LOGS_CHANNEL_ID,
  supportRoleId: process.env.SUPPORT_ROLE_ID,
  adminRoleId: process.env.ADMIN_ROLE_ID,
  databaseUri: process.env.MONGODB_URI,
  webPanelUrl: process.env.WEB_PANEL_URL || 'http://localhost:3000',
  apiPort: process.env.API_PORT || 3001,
  // Ticket Types
  ticketTypes: {
    support: {
      label: 'Support',
      emoji: '🔧',
      description: 'Get help with general questions or issues.',
      color: '#5865F2'
    },
    purchase: {
      label: 'Purchase',
      emoji: '💸',
      description: 'Questions about purchasing our products or services.',
      color: '#57F287'
    },
    report: {
      label: 'Report User',
      emoji: '🛡️',
      description: 'Report a user for breaking rules.',
      color: '#FEE75C'
    },
    staffReport: {
      label: 'Staff Report',
      emoji: '⚠️',
      description: 'Report a staff member (handled privately).',
      color: '#ED4245'
    },
    other: {
      label: 'Other',
      emoji: '❓',
      description: 'Other inquiries that don\'t fit the categories above.',
      color: '#EB459E'
    }
  }
};

// Simple logger
const logger = {
  info: (message) => console.log(`[INFO] ${message}`),
  error: (message, error) => console.error(`[ERROR] ${message}`, error),
  warn: (message) => console.warn(`[WARN] ${message}`),
  debug: (message) => console.debug(`[DEBUG] ${message}`)
};

// Create the Discord client with necessary intents
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.MessageContent
  ],
  partials: [
    Partials.Channel,
    Partials.Message,
    Partials.User,
    Partials.GuildMember,
    Partials.ThreadMember
  ]
});

// Create collections to store commands
client.commands = new Collection();

// Define Ticket schema directly in index.js for simplicity
const ticketSchema = new mongoose.Schema({
  ticketId: {
    type: String,
    required: true,
    unique: true
  },
  userId: {
    type: String,
    required: true
  },
  username: {
    type: String,
    required: true
  },
  threadId: {
    type: String,
    required: true
  },
  channelId: {
    type: String,
    required: true
  },
  guildId: {
    type: String,
    required: true
  },
  status: {
    type: String,
    enum: ['open', 'closed'],
    default: 'open'
  },
  type: {
    type: String,
    required: true,
    enum: ['support', 'purchase', 'report', 'staffReport', 'other']
  },
  priority: {
    type: String,
    enum: ['low', 'medium', 'urgent'],
    default: 'medium'
  },
  assignedStaff: {
    type: String,
    default: null
  },
  assignedTeam: {
    type: String,
    default: null
  },
  tags: [{
    type: String
  }],
  createdAt: {
    type: Date,
    default: Date.now
  },
  closedAt: {
    type: Date,
    default: null
  },
  closedBy: {
    type: String,
    default: null
  },
  lastActivity: {
    type: Date,
    default: Date.now
  },
  messages: [{
    content: String,
    author: String,
    authorId: String,
    timestamp: {
      type: Date,
      default: Date.now
    },
    isStaff: {
      type: Boolean,
      default: false
    },
    attachments: [{
      url: String,
      name: String
    }]
  }]
});

// Add the model
let Ticket;
try {
  Ticket = mongoose.model('Ticket');
} catch (error) {
  Ticket = mongoose.model('Ticket', ticketSchema);
}

// Load commands
const commandsPath = path.join(__dirname, 'commands');
if (fs.existsSync(commandsPath)) {
  const commandFiles = fs.readdirSync(commandsPath).filter(file => file.endsWith('.js'));
  for (const file of commandFiles) {
    const filePath = path.join(commandsPath, file);
    try {
      const command = require(filePath);
      
      if ('data' in command && 'execute' in command) {
        client.commands.set(command.data.name, command);
        console.log(`Loaded command: ${command.data.name}`);
      } else {
        console.warn(`Command at ${filePath} is missing required properties`);
      }
    } catch (error) {
      console.error(`Error loading command ${file}:`, error);
    }
  }
} else {
  console.warn('Commands directory not found!');
}

// Handle ready event directly instead of loading from file
client.once(Events.ClientReady, () => {
  console.log(`Logged in as ${client.user.tag}`);
  console.log('Bot is now running!');
  
  // Set the bot's activity
  client.user.setActivity('support tickets', { type: 'WATCHING' });
});

// Create a ticket embed
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

// Create a new ticket embed for inside the thread
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

// Create a ticket log embed
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

// Handle interaction event directly
client.on(Events.InteractionCreate, async interaction => {
  try {
    // Handle slash commands
    if (interaction.isChatInputCommand()) {
      const command = client.commands.get(interaction.commandName);
      
      if (!command) {
        console.warn(`No command matching ${interaction.commandName} was found.`);
        return;
      }
      
      await command.execute(interaction);
    } 
    // Handle ticket button clicks
    else if (interaction.isButton() && interaction.customId.startsWith('ticket_')) {
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
      }).exec();
      
      if (existingTicket) {
        return interaction.editReply({ 
          content: `You already have an open ticket! Please use <#${existingTicket.threadId}> instead.`, 
          ephemeral: true 
        });
      }
      
      // Create a unique ticket ID
      const ticketCount = await Ticket.countDocuments().exec() + 1;
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
        thread = await channel.threads.create({
          name: threadName,
          autoArchiveDuration: 4320, // 3 days
          reason: `Support ticket created by ${user.tag}`
        });
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
      
      const row = new ActionRowBuilder().addComponents(closeButton);
      
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
        username: user.username,
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
    }
    // Handle close ticket button
    else if (interaction.isButton() && interaction.customId === 'close_ticket') {
      // Defer the reply
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
      }).exec();
      
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
    }
  } catch (error) {
    console.error(`Error handling interaction:`, error);
    
    const errorMessage = { 
      content: 'There was an error while executing this command!', 
      ephemeral: true 
    };
    
    if (interaction.replied || interaction.deferred) {
      await interaction.followUp(errorMessage).catch(console.error);
    } else {
      await interaction.reply(errorMessage).catch(console.error);
    }
  }
});

// Handle message creation to sync with database
client.on(Events.MessageCreate, async message => {
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
    }).exec();
    
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
});

// Check if a guild member is part of the support staff
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
  if (member.permissions.has(PermissionFlagsBits.ManageGuild)) {
    return true;
  }
  
  return false;
}

// Add specific Discord error handling
client.on('error', error => {
  console.error('Discord client error:', error);
});

client.on('shardError', error => {
  console.error('WebSocket connection error:', error);
});

// Setup Express API for web panel integration
const app = express();
app.use(cors({ origin: config.webPanelUrl || '*', credentials: true }));
app.use(express.json());

// Simple health check endpoint
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'ok' });
});

// API Endpoints for ticket management
app.get('/api/tickets', async (req, res) => {
  try {
    let query = {};
    
    // Filter by status
    if (req.query.status) {
      query.status = req.query.status;
    }
    
    // Filter by assigned staff
    if (req.query.assignedStaff) {
      query.assignedStaff = req.query.assignedStaff;
    }
    
    // Filter by unassigned
    if (req.query.unassigned === 'true') {
      query.status = 'open';
      query.assignedStaff = null;
    }
    
    // Get tickets
    const tickets = await Ticket.find(query).sort({ createdAt: -1 }).exec();
    res.json(tickets);
  } catch (error) {
    console.error('Error fetching tickets:', error);
    res.status(500).json({ error: 'Failed to fetch tickets' });
  }
});

// Get a specific ticket
app.get('/api/tickets/:id', async (req, res) => {
  try {
    const ticket = await Ticket.findOne({ ticketId: req.params.id }).exec();
    
    if (!ticket) {
      return res.status(404).json({ error: 'Ticket not found' });
    }
    
    res.json(ticket);
  } catch (error) {
    console.error(`Error fetching ticket ${req.params.id}:`, error);
    res.status(500).json({ error: 'Failed to fetch ticket' });
  }
});

// Update a ticket
app.patch('/api/tickets/:id', async (req, res) => {
  try {
    const ticket = await Ticket.findOne({ ticketId: req.params.id }).exec();
    
    if (!ticket) {
      return res.status(404).json({ error: 'Ticket not found' });
    }
    
    // Update fields
    if (req.body.status) ticket.status = req.body.status;
    if (req.body.priority) ticket.priority = req.body.priority;
    if (req.body.assignedStaff) ticket.assignedStaff = req.body.assignedStaff;
    if (req.body.tags) ticket.tags = req.body.tags;
    
    ticket.lastActivity = new Date();
    
    // Save changes
    await ticket.save();
    
    res.json(ticket);
  } catch (error) {
    console.error(`Error updating ticket ${req.params.id}:`, error);
    res.status(500).json({ error: 'Failed to update ticket' });
  }
});

// Send a message to a ticket
app.post('/api/tickets/:id/message', async (req, res) => {
  try {
    const ticket = await Ticket.findOne({ ticketId: req.params.id }).exec();
    
    if (!ticket) {
      return res.status(404).json({ error: 'Ticket not found' });
    }
    
    // Create message
    const message = {
      content: req.body.message,
      author: req.body.author || 'Staff Member',
      authorId: req.body.authorId || 'web-panel',
      timestamp: new Date(),
      isStaff: true
    };
    
    // Add message to ticket
    ticket.messages.push(message);
    ticket.lastActivity = new Date();
    
    // If ticket is unassigned, assign it to web panel user
    if (!ticket.assignedStaff && req.body.authorId) {
      ticket.assignedStaff = req.body.authorId;
    }
    
    await ticket.save();
    
    // Get the Discord thread/channel
    const guild = await client.guilds.fetch(ticket.guildId);
    const channel = await guild.channels.fetch(ticket.threadId || ticket.channelId).catch(() => null);
    
    if (channel) {
      // Send message to Discord
      await channel.send({
        content: `**${message.author}:** ${message.content}`,
        allowedMentions: { parse: ['users'] }
      });
    }
    
    res.json(ticket);
  } catch (error) {
    console.error(`Error sending message to ticket ${req.params.id}:`, error);
    res.status(500).json({ error: 'Failed to send message' });
  }
});

// Get all staff users
app.get('/api/users', async (req, res) => {
  try {
    // Get all guilds the bot is in
    const guilds = await client.guilds.fetch();
    
    let staffMembers = [];
    
    for (const [guildId, guild] of guilds) {
      const fullGuild = await guild.fetch();
      
      // Get support role members
      if (config.supportRoleId) {
        const role = await fullGuild.roles.fetch(config.supportRoleId).catch(() => null);
        
        if (role) {
          const members = await role.members.fetch();
          
          members.forEach(member => {
            if (!staffMembers.some(staff => staff.discordId === member.id)) {
              staffMembers.push({
                discordId: member.id,
                username: member.user.username,
                discriminator: member.user.discriminator || '0',
                avatar: member.user.avatar,
                permissions: {
                  tickets: true,
                  stats: true,
                  snippets: false,
                  siteManagement: false
                }
              });
            }
          });
        }
      }
      
      // Add admin role members
      if (config.adminRoleId) {
        const adminRole = await fullGuild.roles.fetch(config.adminRoleId).catch(() => null);
        
        if (adminRole) {
          const adminMembers = await adminRole.members.fetch();
          
          adminMembers.forEach(member => {
            const existingStaff = staffMembers.find(staff => staff.discordId === member.id);
            
            if (existingStaff) {
              existingStaff.permissions.siteManagement = true;
              existingStaff.permissions.snippets = true;
            } else {
              staffMembers.push({
                discordId: member.id,
                username: member.user.username,
                discriminator: member.user.discriminator || '0',
                avatar: member.user.avatar,
                permissions: {
                  tickets: true,
                  stats: true,
                  snippets: true,
                  siteManagement: true
                }
              });
            }
          });
        }
      }
    }
    
    res.json(staffMembers);
  } catch (error) {
    console.error('Error fetching staff users:', error);
    res.status(500).json({ error: 'Failed to fetch staff users' });
  }
});

// Mock authentication for the web panel
app.post('/api/auth/discord', (req, res) => {
  // This is a mock endpoint for development
  // In production, this would authenticate with Discord OAuth
  res.json({
    user: {
      id: '123456789012345678',
      username: 'TestUser',
      discriminator: '1234',
      avatar: null,
      roles: ['Staff'],
      permissions: {
        tickets: true,
        stats: true,
        snippets: true,
        siteManagement: true
      }
    },
    token: 'mock_token'
  });
});

// MongoDB connection function
const connectDatabase = async () => {
  try {
    console.log('Connecting to MongoDB...');
    
    await mongoose.connect(config.databaseUri);
    
    console.log('Successfully connected to MongoDB');
    return mongoose.connection;
  } catch (error) {
    console.error('MongoDB connection error:', error);
    // Instead of throwing the error, we'll return false
    return false;
  }
};

// Startup sequence
const startBot = async () => {
  console.log('Starting ticket bot...');
  
  // Try to connect to database but don't fail if it doesn't work
  try {
    const dbConnection = await connectDatabase();
    if (dbConnection) {
      console.log('Database connection successful');
    } else {
      console.warn('Database connection failed, but continuing with limited functionality');
    }
  } catch (error) {
    console.warn('Failed to connect to database, continuing with limited functionality:', error);
  }
  
  // Start the Discord bot
  try {
    console.log('Logging in to Discord...');
    await client.login(config.token);
    console.log('Discord login successful');
    
    // Start the API server
    const PORT = config.apiPort || 3001;
    app.listen(PORT, () => {
      console.log(`API server running on port ${PORT}`);
    });
    
  } catch (error) {
    console.error('Failed to start bot:', error);
    process.exit(1);
  }
};

// Start the bot
startBot();