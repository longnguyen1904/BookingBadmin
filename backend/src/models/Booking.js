const mongoose = require('mongoose');

const bookingSchema = new mongoose.Schema(
  {
    booking_code: {
      type: String,
      unique: true,
      required: true,
    },
    user_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
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
    booking_date: {
      type: String, // 'YYYY-MM-DD'
      required: true,
    },
    start_time: {
      type: String, // '18:00'
      required: true,
    },
    end_time: {
      type: String, // '20:00'
      required: true,
    },
    slots: {
      type: [String], // ['18:00', '19:00']
      default: [],
    },
    slot_ids: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'TimeSlot',
      },
    ],
    extra_services: [
      {
        service_id: String,
        name: String,
        quantity: { type: Number, default: 1 },
        price: Number,
      },
    ],
    court_fee: {
      type: Number,
      default: 0,
    },
    services_fee: {
      type: Number,
      default: 0,
    },
    total_amount: {
      type: Number,
      required: true,
    },
    deposit_paid: {
      type: Number,
      default: 0,
    },
    status: {
      type: String,
      enum: ['locked_pending', 'confirmed', 'completed', 'cancelled'],
      default: 'locked_pending',
    },
    lock_expires_at: {
      type: Date,
      default: null,
    },
    payment_info: {
      transaction_id: { type: String, default: '' },
      payment_method: {
        type: String,
        enum: ['VNPAY', 'MOMO', 'CASH'],
        default: 'VNPAY',
      },
      pay_time: { type: Date, default: null },
    },
    qr_checkin_code: {
      type: String,
      default: '',
    },
    checked_in_at: {
      type: Date,
      default: null,
    },
    cancel_reason: {
      type: String,
      default: '',
    },
    penalty_amount: {
      type: Number,
      default: 0,
    },
    is_reviewed: {
      type: Boolean,
      default: false,
    },
  },
  {
    timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' },
  }
);

module.exports = mongoose.model('Booking', bookingSchema);

