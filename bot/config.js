require('dotenv').config();

module.exports = {
  // Bot Configuration
  token: process.env.DISCORD_BOT_TOKEN,
  clientId: process.env.DISCORD_CLIENT_ID,
  guildId: process.env.GUILD_ID,
  
  // Ticket Configuration
  ticketCategoryId: process.env.TICKET_CATEGORY_ID,
  ticketLogsChannelId: process.env.TICKET_LOGS_CHANNEL_ID,
  
  // Role Configuration
  supportRoleId: process.env.SUPPORT_ROLE_ID,
  adminRoleId: process.env.ADMIN_ROLE_ID,
  
  // Database Configuration
  databaseUri: process.env.MONGODB_URI,
  
  // Web Panel Configuration
  webPanelUrl: process.env.WEB_PANEL_URL || 'http://localhost:3000',
  apiPort: process.env.API_PORT || 3001,
  
  // Ticket Types
  ticketTypes: {
    support: {
      label: 'Support',
      emoji: '🔧',
      description: 'Get help with general questions or issues.',
      color: '#5865F2' // Discord Blue
    },
    purchase: {
      label: 'Purchase',
      emoji: '💸',
      description: 'Questions about purchasing our products or services.',
      color: '#57F287' // Green
    },
    report: {
      label: 'Report User',
      emoji: '🛡️',
      description: 'Report a user for breaking rules.',
      color: '#FEE75C' // Yellow
    },
    staffReport: {
      label: 'Staff Report',
      emoji: '⚠️',
      description: 'Report a staff member (handled privately).',
      color: '#ED4245' // Red
    },
    other: {
      label: 'Other',
      emoji: '❓',
      description: 'Other inquiries that don\'t fit the categories above.',
      color: '#EB459E' // Pink
    }
  }
};