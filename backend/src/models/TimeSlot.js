const mongoose = require('mongoose');

/**
 * TimeSlot Collection:
 * Phục vụ xử lý Concurrency & Race Condition theo chuẩn Atomic Update:
 * TimeSlot.findOneAndUpdate(
 *   { _id: slotId, status: 'available' },
 *   { $set: { status: 'locked', locked_by: userId, lock_expires_at: expiresAt } },
 *   { new: true }
 * )
 */
const timeSlotSchema = new mongoose.Schema(
  {
    court_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Court',
      required: true,
    },
    sub_court_id: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
    },
    sub_court_name: {
      type: String,
      default: 'Sân 1',
    },
    date: {
      type: String, // 'YYYY-MM-DD'
      required: true,
    },
    start_time: {
      type: String, // '05:00' .. '22:00'
      required: true,
    },
    end_time: {
      type: String, // '06:00' .. '23:00'
      required: true,
    },
    price: {
      type: Number,
      required: true,
    },
    is_peak_hour: {
      type: Boolean,
      default: false,
    },
    status: {
      type: String,
      enum: ['available', 'locked', 'booked'],
      default: 'available',
    },
    locked_by: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    lock_expires_at: {
      type: Date,
      default: null,
    },
    booking_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Booking',
      default: null,
    },
  },
  {
    timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' },
  }
);

timeSlotSchema.index(
  { court_id: 1, sub_court_id: 1, date: 1, start_time: 1 },
  { unique: true }
);

module.exports = mongoose.model('TimeSlot', timeSlotSchema);

