const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  userId: { type: String, required: true, unique: true },
  coins: { type: Number, default: 10 },
  wins: { type: Number, default: 0 },
  losses: { type: Number, default: 0 },
  elo: { type: Number, default: 1000 },
  lastDaily: { type: Date, default: null }
});

module.exports = mongoose.model('User', userSchema);
