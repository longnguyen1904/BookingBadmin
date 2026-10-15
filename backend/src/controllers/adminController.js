const Booking = require('../models/Booking');
const Court = require('../models/Court');
const TimeSlot = require('../models/TimeSlot');
const User = require('../models/User');
const MatchRequest = require('../models/MatchRequest');

// GET /api/admin/analytics
const getAnalytics = async (req, res) => {
  try {
    const totalUsers = await User.countDocuments();
    const totalCourts = await Court.countDocuments();
    const totalMatches = await MatchRequest.countDocuments();

    const allBookings = await Booking.find()
      .populate('court_id', 'name district')
      .populate('user_id', 'full_name email phone')
      .sort({ created_at: -1 });

    const validBookings = allBookings.filter(
      (b) => b.status === 'confirmed' || b.status === 'completed'
    );

    const totalRevenue = validBookings.reduce(
      (sum, b) => sum + (b.total_amount || 0),
      0
    );
    const totalDeposit = validBookings.reduce(
      (sum, b) => sum + (b.deposit_paid || 0),
      0
    );

    // Thống kê doanh thu theo 7 ngày gần nhất
    const revenueByDayMap = {};
    const today = new Date();
    for (let i = 6; i >= 0; i--) {
      const d = new Date(today);
      d.setDate(today.getDate() - i);
      const dateStr = d.toISOString().slice(0, 10);
      revenueByDayMap[dateStr] = { date: dateStr, revenue: 0, bookings: 0 };
    }

    for (const b of validBookings) {
      const dStr = b.booking_date;
      if (!revenueByDayMap[dStr]) {
        revenueByDayMap[dStr] = { date: dStr, revenue: 0, bookings: 0 };
      }
      revenueByDayMap[dStr].revenue += b.total_amount || 0;
      revenueByDayMap[dStr].bookings += 1;
    }

    const revenueByDay = Object.values(revenueByDayMap).sort((a, b) =>
      a.date.localeCompare(b.date)
    );

    // Top khung giờ được đặt nhiều nhất
    const slotFrequency = {};
    for (const b of validBookings) {
      const slotList =
        b.slots && b.slots.length > 0 ? b.slots : [b.start_time];
      for (const hr of slotList) {
        if (!hr) continue;
        slotFrequency[hr] = (slotFrequency[hr] || 0) + 1;
      }
    }

    const topTimeSlots = Object.entries(slotFrequency)
      .map(([hour, count]) => ({ hour: `${hour} - ${String(parseInt(hour) + 1).padStart(2, '0')}:00`, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 8);

    // Tỷ lệ lấp đầy sân (Occupancy Rate)
    const totalSlotsCount = await TimeSlot.countDocuments();
    const bookedSlotsCount = await TimeSlot.countDocuments({
      status: { $in: ['booked', 'locked'] },
    });
    const occupancyRate =
      totalSlotsCount > 0
        ? Number(((bookedSlotsCount / totalSlotsCount) * 100).toFixed(1))
        : 38.5;

    // Thống kê theo cụm sân
    const courtRevenueMap = {};
    for (const b of validBookings) {
      const cName = b.court_id?.name || 'Cụm sân khác';
      if (!courtRevenueMap[cName]) {
        courtRevenueMap[cName] = { court_name: cName, revenue: 0, bookings: 0 };
      }
      courtRevenueMap[cName].revenue += b.total_amount || 0;
      courtRevenueMap[cName].bookings += 1;
    }

    return res.status(200).json({
      success: true,
      summary: {
        total_revenue: totalRevenue,
        total_deposit: totalDeposit,
        total_bookings: allBookings.length,
        confirmed_bookings: validBookings.length,
        cancelled_bookings: allBookings.filter((b) => b.status === 'cancelled').length,
        total_users: totalUsers,
        total_courts: totalCourts,
        total_matches: totalMatches,
        occupancy_rate: occupancyRate,
      },
      revenue_by_day: revenueByDay,
      top_time_slots: topTimeSlots,
      revenue_by_court: Object.values(courtRevenueMap),
      recent_bookings: allBookings.slice(0, 20),
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: 'Lỗi khi tải dữ liệu thống kê Admin',
      error: error.message,
    });
  }
};

// POST /api/admin/checkin-qr (Quét mã QR Check-in vé điện tử)
const checkinQr = async (req, res) => {
  try {
    const { qr_code } = req.body;
    if (!qr_code || !qr_code.trim()) {
      return res.status(400).json({
        success: false,
        message: 'Vui lòng cung cấp mã QR hoặc mã đặt sân (Booking Code)',
      });
    }

    const raw = qr_code.trim();
    let booking = null;

    // Hỗ trợ định dạng BBQR|BB-20261104-1234|<id>, JSON, hoặc trực tiếp mã BC-...
    if (raw.startsWith('BBQR|')) {
      const parts = raw.split('|');
      const code = parts[1];
      booking = await Booking.findOne({ booking_code: code })
        .populate('court_id', 'name address')
        .populate('user_id', 'full_name email phone');
    } else if (raw.startsWith('{')) {
      try {
        const parsed = JSON.parse(raw);
        booking = await Booking.findOne({
          $or: [
            { _id: parsed.booking_id },
            { booking_code: parsed.booking_code },
          ],
        })
          .populate('court_id', 'name address')
          .populate('user_id', 'full_name email phone');
      } catch (_) {}
    }

    if (!booking) {
      booking = await Booking.findOne({
        $or: [{ qr_checkin_code: raw }, { booking_code: raw }],
      })
        .populate('court_id', 'name address')
        .populate('user_id', 'full_name email phone');
    }

    if (!booking && raw.match(/^[0-9a-fA-F]{24}$/)) {
      booking = await Booking.findById(raw)
        .populate('court_id', 'name address')
        .populate('user_id', 'full_name email phone');
    }

    if (!booking) {
      return res.status(404).json({
        success: false,
        message: 'Không tìm thấy vé đặt sân hợp lệ khớp với mã QR này!',
      });
    }

    if (booking.status === 'cancelled') {
      return res.status(400).json({
        success: false,
        message: `Vé ${booking.booking_code} đã bị hủy trước đó, không thể Check-in!`,
        booking,
      });
    }

    booking.checked_in_at = new Date();
    booking.status = 'completed';
    await booking.save();

    return res.status(200).json({
      success: true,
      message: `Check-in thành công cho khách hàng ${booking.user_id?.full_name || ''} (${booking.sub_court_name} • ${booking.start_time}-${booking.end_time})!`,
      booking,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: 'Lỗi khi quét mã QR Check-in',
      error: error.message,
    });
  }
};

// PUT /api/admin/bookings/:id/status (Admin duyệt ca / cập nhật trạng thái đơn)
const updateBookingStatus = async (req, res) => {
  try {
    const { status } = req.body;
    const booking = await Booking.findById(req.params.id)
      .populate('court_id', 'name address')
      .populate('user_id', 'full_name email phone');

    if (!booking) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy đơn đặt sân' });
    }

    booking.status = status;
    if (status === 'completed' && !booking.checked_in_at) {
      booking.checked_in_at = new Date();
    }
    await booking.save();

    if (status === 'cancelled') {
      await TimeSlot.updateMany(
        { _id: { $in: booking.slot_ids } },
        { $set: { status: 'available', locked_by: null, lock_expires_at: null, booking_id: null } }
      );
    }

    return res.status(200).json({
      success: true,
      message: `Đã cập nhật trạng thái đơn ${booking.booking_code} thành "${status}"`,
      booking,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: 'Lỗi cập nhật trạng thái đơn',
      error: error.message,
    });
  }
};

module.exports = {
  getAnalytics,
  checkinQr,
  updateBookingStatus,
};

