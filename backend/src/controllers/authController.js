const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const User = require('../models/User');

const generateToken = (id, role) => {
  return jwt.sign(
    { id, role },
    process.env.JWT_SECRET || 'badminton_booking_super_secret_jwt_key_2026',
    { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
  );
};

// POST /api/auth/register
const register = async (req, res) => {
  try {
    const {
      full_name,
      email,
      password,
      phone,
      skill_level,
      dominant_hand,
      preferred_play,
      profile,
    } = req.body;

    if (!full_name || !email || !password) {
      return res.status(400).json({
        success: false,
        message: 'Vui lòng nhập đầy đủ Họ tên, Email và Mật khẩu',
      });
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({
        success: false,
        message: 'Định dạng Email không hợp lệ',
      });
    }

    if (password.length < 6) {
      return res.status(400).json({
        success: false,
        message: 'Mật khẩu phải có tối thiểu 6 ký tự',
      });
    }

    const existingUser = await User.findOne({ email: email.toLowerCase() });
    if (existingUser) {
      return res.status(409).json({
        success: false,
        message: 'Email này đã được đăng ký sử dụng',
      });
    }

    const salt = await bcrypt.genSalt(10);
    const password_hash = await bcrypt.hash(password, salt);

    const userProfile = {
      skill_level: profile?.skill_level || skill_level || 'intermediate',
      dominant_hand: profile?.dominant_hand || dominant_hand || 'right',
      preferred_play: profile?.preferred_play || preferred_play || 'double',
    };

    const user = await User.create({
      full_name,
      email: email.toLowerCase(),
      password_hash,
      phone: phone || '',
      avatar: `https://ui-avatars.com/api/?background=0D9488&color=fff&name=${encodeURIComponent(full_name)}`,
      role: 'user',
      profile: userProfile,
    });

    const token = generateToken(user._id, user.role);

    return res.status(201).json({
      success: true,
      message: 'Đăng ký tài khoản thành công',
      token,
      user: {
        _id: user._id,
        full_name: user.full_name,
        email: user.email,
        phone: user.phone,
        avatar: user.avatar,
        role: user.role,
        profile: user.profile,
      },
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: 'Lỗi hệ thống khi đăng ký',
      error: error.message,
    });
  }
};

// POST /api/auth/login
const login = async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message: 'Vui lòng nhập Email và Mật khẩu',
      });
    }

    const user = await User.findOne({ email: email.toLowerCase() });
    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'Email hoặc mật khẩu không chính xác',
      });
    }

    const isMatch = await bcrypt.compare(password, user.password_hash);
    if (!isMatch) {
      return res.status(401).json({
        success: false,
        message: 'Email hoặc mật khẩu không chính xác',
      });
    }

    const token = generateToken(user._id, user.role);

    return res.status(200).json({
      success: true,
      message: 'Đăng nhập thành công',
      token,
      user: {
        _id: user._id,
        full_name: user.full_name,
        email: user.email,
        phone: user.phone,
        avatar: user.avatar,
        role: user.role,
        profile: user.profile,
      },
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: 'Lỗi hệ thống khi đăng nhập',
      error: error.message,
    });
  }
};

// GET /api/auth/me
const getMe = async (req, res) => {
  return res.status(200).json({
    success: true,
    user: req.user,
  });
};

// PUT /api/auth/profile
const updateProfile = async (req, res) => {
  try {
    const { full_name, phone, skill_level, dominant_hand, preferred_play, profile } = req.body;
    const user = await User.findById(req.user._id);
    if (!user) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy người dùng' });
    }

    if (full_name) user.full_name = full_name;
    if (phone !== undefined) user.phone = phone;
    if (profile || skill_level || dominant_hand || preferred_play) {
      user.profile = {
        skill_level: profile?.skill_level || skill_level || user.profile.skill_level,
        dominant_hand: profile?.dominant_hand || dominant_hand || user.profile.dominant_hand,
        preferred_play: profile?.preferred_play || preferred_play || user.profile.preferred_play,
      };
    }

    await user.save();

    return res.status(200).json({
      success: true,
      message: 'Cập nhật hồ sơ cá nhân thành công',
      user: {
        _id: user._id,
        full_name: user.full_name,
        email: user.email,
        phone: user.phone,
        avatar: user.avatar,
        role: user.role,
        profile: user.profile,
      },
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: 'Lỗi khi cập nhật hồ sơ',
      error: error.message,
    });
  }
};

module.exports = { register, login, getMe, updateProfile };

