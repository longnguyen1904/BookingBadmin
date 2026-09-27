const mongoose = require('mongoose');

const subCourtSchema = new mongoose.Schema({
  sub_court_id: {
    type: mongoose.Schema.Types.ObjectId,
    default: () => new mongoose.Types.ObjectId(),
  },
  court_number: {
    type: String,
    required: true, // e.g., 'Sân 1', 'Sân 2', 'Sân 3'
  },
  is_active: {
    type: Boolean,
    default: true,
  },
});

const extraServiceSchema = new mongoose.Schema({
  service_id: { type: String, required: true },
  name: { type: String, required: true },
  price: { type: Number, required: true },
  unit: { type: String, default: 'món' },
});

const reviewSchema = new mongoose.Schema({
  user_id: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  user_name: { type: String, default: 'Người chơi' },
  booking_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Booking' },
  rating: { type: Number, min: 1, max: 5, required: true },
  comment: { type: String, default: '' },
  created_at: { type: Date, default: Date.now },
});

const courtSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Tên cụm sân là bắt buộc'],
      trim: true,
    },
    address: {
      type: String,
      required: [true, 'Địa chỉ sân là bắt buộc'],
    },
    district: {
      type: String,
      required: true,
      index: true,
    },
    city: {
      type: String,
      default: 'Hà Nội',
    },
    images: {
      type: [String],
      default: [
        'https://images.unsplash.com/photo-1626224583764-f87db24ac4ea?auto=format&fit=crop&w=800&q=80',
      ],
    },
    open_time: {
      type: String,
      default: '05:00',
    },
    close_time: {
      type: String,
      default: '23:00',
    },
    hourly_rate: {
      type: Number,
      required: true,
      default: 90000,
    },
    peak_hour_rate: {
      type: Number,
      default: 130000, // Khung giờ vàng 17:00 - 21:00
    },
    peak_hours: {
      start: { type: String, default: '17:00' },
      end: { type: String, default: '21:00' },
    },
    carpet_type: {
      type: String,
      enum: ['Thảm PVC', 'Thảm Yonex', 'Sàn gỗ', 'Thảm Enlio'],
      default: 'Thảm PVC',
    },
    court_type: {
      type: String,
      enum: ['indoor', 'outdoor'],
      default: 'indoor',
    },
    amenities: {
      type: [String],
      default: ['Wifi', 'Thảm PVC', 'Tắm nóng lạnh', 'Bãi đỗ xe miễn phí'],
    },
    extra_services: {
      type: [extraServiceSchema],
      default: [
        { service_id: 'racket_rental', name: 'Thuê vợt cầu lông Yonex', price: 35000, unit: 'cây' },
        { service_id: 'water_bottle', name: 'Nước suối Aquafina 500ml', price: 10000, unit: 'chai' },
        { service_id: 'shuttlecock_tube', name: 'Ống cầu lông Hải Yến S90', price: 220000, unit: 'ống (12 quả)' },
        { service_id: 'grip_tape', name: 'Quấn cán vợt VS chống trơn', price: 15000, unit: 'cái' },
      ],
    },
    sub_courts: {
      type: [subCourtSchema],
      default: [],
    },
    rating_avg: {
      type: Number,
      default: 4.8,
    },
    rating_count: {
      type: Number,
      default: 12,
    },
    reviews: {
      type: [reviewSchema],
      default: [],
    },
  },
  {
    timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' },
  }
);

module.exports = mongoose.model('Court', courtSchema);

