const mongoose = require('mongoose');

const messageSchema = new mongoose.Schema(
  {
    match_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'MatchRequest',
      required: true,
      index: true,
    },
    sender_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    sender_name: {
      type: String,
      default: 'Hệ thống',
    },
    sender_avatar: {
      type: String,
      default: '',
    },
    content: {
      type: String,
      required: true,
    },
    message_type: {
      type: String,
      enum: ['text', 'system_event'],
      default: 'text',
    },
  },
  {
    timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' },
  }
);

module.exports = mongoose.model('Message', messageSchema);

