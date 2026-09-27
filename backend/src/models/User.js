const mongoose = require('mongoose');

const userSchema = new mongoose.Schema(
  {
    full_name: {
      type: String,
      required: [true, 'Họ tên là bắt buộc'],
      trim: true,
    },
    email: {
      type: String,
      required: [true, 'Email là bắt buộc'],
      unique: true,
      lowercase: true,
      trim: true,
    },
    password_hash: {
      type: String,
      required: [true, 'Mật khẩu là bắt buộc'],
    },
    phone: {
      type: String,
      default: '',
      trim: true,
    },
    avatar: {
      type: String,
      default: 'https://ui-avatars.com/api/?background=0D9488&color=fff&name=BC',
    },
    role: {
      type: String,
      enum: ['user', 'court_owner', 'admin'],
      default: 'user',
    },
    profile: {
      skill_level: {
        type: String,
        enum: ['beginner', 'intermediate', 'advanced', 'pro'],
        default: 'intermediate',
      },
      dominant_hand: {
        type: String,
        enum: ['left', 'right'],
        default: 'right',
      },
      preferred_play: {
        type: String,
        enum: ['single', 'double'],
        default: 'double',
      },
    },
  },
  {
    timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' },
  }
);

module.exports = mongoose.model('User', userSchema);

