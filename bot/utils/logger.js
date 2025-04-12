const winston = require('winston');
const path = require('path');
const fs = require('fs');

// Create logs directory if it doesn't exist
const logsDir = path.join(__dirname, '../logs');
if (!fs.existsSync(logsDir)) {
  fs.mkdirSync(logsDir);
}

// Define log format
const logFormat = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  winston.format.errors({ stack: true }),
  winston.format.printf(({ level, message, timestamp, stack }) => {
    return `[${timestamp}] ${level.toUpperCase()}: ${message} ${stack ? '\n' + stack : ''}`;
  })
);

// Create logger
const logger = winston.createLogger({
  level: process.env.NODE_ENV === 'production' ? 'info' : 'debug',
  format: logFormat,
  defaultMeta: { service: 'ticket-bot' },
  transports: [
    // Console output
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize(),
        logFormat
      )
    }),
    // File output - error logs
    new winston.transports.File({ 
      filename: path.join(logsDir, 'error.log'),
      level: 'error'
    }),
    // File output - all logs
    new winston.transports.File({ 
      filename: path.join(logsDir, 'combined.log')
    })
  ],
  exceptionHandlers: [
    new winston.transports.File({ 
      filename: path.join(logsDir, 'exceptions.log')
    })
  ]
});

module.exports = logger;