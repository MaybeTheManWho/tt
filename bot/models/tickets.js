const mongoose = require('mongoose');

const messageSchema = new mongoose.Schema({
  content: {
    type: String,
    required: true
  },
  author: {
    type: String,
    required: true
  },
  authorId: {
    type: String,
    required: true
  },
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
});

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
  messages: [messageSchema]
});

module.exports = mongoose.model('Ticket', ticketSchema);