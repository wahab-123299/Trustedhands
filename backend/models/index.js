// models/index.js
const User = require('./User');
const ArtisanProfile = require('./ArtisanProfile');
const Job = require('./Job');
const Transaction = require('./Transaction');
const Wallet = require('./Wallet');
const Conversation = require('./Conversation');
const Message = require('./Message');
const AvailabilitySlot = require('./AvailabilitySlot');
const RecurringPattern = require('./RecurringPattern');
const Favorite = require('./Favorite');
const Milestone = require('./Milestone');

module.exports = {
  User,
  ArtisanProfile,
  Job,
  Transaction,
  Wallet,
  Conversation,
  Message,
  AvailabilitySlot,
  RecurringPattern,
  Favorite,
  Milestone
};