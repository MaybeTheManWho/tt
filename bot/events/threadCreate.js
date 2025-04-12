const { Events } = require('discord.js');
const Ticket = require('../models/ticket');
const logger = require('../utils/logger');

module.exports = {
  name: Events.ThreadCreate,
  
  async execute(thread, client) {
    // We only care about threads created in our guild
    if (!thread.guild) return;
    
    // Check if this thread is a ticket thread
    const ticket = await Ticket.findOne({ threadId: thread.id });
    
    // If this is a ticket thread, set up message listener
    if (ticket) {
      try {
        // Add the thread to client's ActiveThreads collection if not already there
        if (!client.channels.cache.has(thread.id)) {
          await thread.join();
        }
        
        logger.info(`Joined ticket thread: ${thread.name} (${thread.id})`);
      } catch (error) {
        logger.error(`Error joining ticket thread ${thread.id}:`, error);
      }
    }
  }
};