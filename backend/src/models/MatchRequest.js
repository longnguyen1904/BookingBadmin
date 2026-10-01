const mongoose = require('mongoose');

const matchRequestSchema = new mongoose.Schema(
  {
    creator_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    booking_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Booking',
      default: null,
    },
    court_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Court',
      default: null,
    },
    title: {
      type: String,
      required: [true, 'Tiêu đề kèo giao lưu là bắt buộc'],
      trim: true,
    },
    location_name: {
      type: String,
      required: true,
    },
    district: {
      type: String,
      default: 'Cầu Giấy',
    },
    scheduled_date: {
      type: String, // 'YYYY-MM-DD'
      default: () => new Date().toISOString().slice(0, 10),
    },
    scheduled_time: {
      type: Date,
      required: true,
    },
    time_range: {
      type: String,
      default: '19:00 - 21:00',
    },
    required_level: {
      type: String,
      enum: ['beginner', 'intermediate', 'advanced', 'pro', 'all'],
      default: 'intermediate',
    },
    max_players: {
      type: Number,
      required: true,
      default: 4,
    },
    current_players: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
      },
    ],
    cost_per_person: {
      type: Number,
      default: 60000,
    },
    notes: {
      type: String,
      default: '',
    },
    status: {
      type: String,
      enum: ['open', 'full', 'cancelled'],
      default: 'open',
    },
  },
  {
    timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' },
  }
);

module.exports = mongoose.model('MatchRequest', matchRequestSchema);

