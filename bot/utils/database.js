const mongoose = require('mongoose');
const config = require('../config');
const logger = require('./logger');

/**
 * Connect to MongoDB database
 * @returns {Promise} Mongoose connection promise
 */
const connectDatabase = async () => {
  try {
    logger.info('Connecting to MongoDB...');
    
    await mongoose.connect(config.databaseUri, {
      // Mongoose 6+ doesn't need these options anymore, they're the default
      // Keeping the comment for reference if needed
      // useNewUrlParser: true,
      // useUnifiedTopology: true
    });
    
    logger.info('Successfully connected to MongoDB');
    return mongoose.connection;
  } catch (error) {
    logger.error('MongoDB connection error:', error);
    throw error;
  }
};

/**
 * Disconnect from MongoDB database
 * @returns {Promise} Mongoose disconnection promise
 */
const disconnectDatabase = async () => {
  try {
    logger.info('Disconnecting from MongoDB...');
    await mongoose.disconnect();
    logger.info('Successfully disconnected from MongoDB');
  } catch (error) {
    logger.error('MongoDB disconnection error:', error);
    throw error;
  }
};

module.exports = {
  connectDatabase,
  disconnectDatabase,
  connection: mongoose.connection
};