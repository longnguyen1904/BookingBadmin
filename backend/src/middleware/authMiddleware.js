const jwt = require('jsonwebtoken');
const User = require('../models/User');

const protect = async (req, res, next) => {
  try {
    let token;
    if (
      req.headers.authorization &&
      req.headers.authorization.startsWith('Bearer')
    ) {
      token = req.headers.authorization.split(' ')[1];
    }

    if (!token) {
      return res.status(401).json({
        success: false,
        message: 'Vui lòng đăng nhập để thực hiện thao tác này (Thiếu Bearer Token)',
      });
    }

    const decoded = jwt.verify(
      token,
      process.env.JWT_SECRET || 'badminton_booking_super_secret_jwt_key_2026'
    );

    const user = await User.findById(decoded.id).select('-password_hash');
    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'Tài khoản không tồn tại hoặc phiên đăng nhập đã hết hạn',
      });
    }

    req.user = user;
    next();
  } catch (error) {
    return res.status(401).json({
      success: false,
      message: 'Token không hợp lệ hoặc đã hết hạn',
      error: error.message,
    });
  }
};

const requireAdmin = (req, res, next) => {
  if (
    req.user &&
    (req.user.role === 'admin' || req.user.role === 'court_owner')
  ) {
    return next();
  }
  return res.status(403).json({
    success: false,
    message: 'Chỉ Quản trị viên (Admin / Chủ sân) mới có quyền truy cập chức năng này',
  });
};

module.exports = { protect, requireAdmin };

