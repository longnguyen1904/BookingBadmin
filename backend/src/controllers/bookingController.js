const QRCode = require('qrcode');
const Booking = require('../models/Booking');
const TimeSlot = require('../models/TimeSlot');
const Court = require('../models/Court');
const { releaseExpiredLocks } = require('../services/slotService');

/**
 * POST /api/bookings/lock-slot
 * BÍ QUYẾT GHI ĐIỂM KHI BẢO VỆ VẤN ĐÁP: XỬ LÝ CONCURRENCY & RACE CONDITION
 * Sử dụng Atomic Update trong MongoDB:
 * TimeSlot.findOneAndUpdate({ _id: slotId, status: 'available' }, { $set: { status: 'locked' } })
 * Nếu trả về null -> Báo ngay: "Khung giờ này vừa có người nhanh tay chọn trước!"
 */
const lockSlot = async (req, res) => {
  try {
    const io = req.app.get('io');
    await releaseExpiredLocks(io);

    const { slot_id, slot_ids, court_id, sub_court_id, booking_date, slots } = req.body;
    const userId = req.user._id;

    // Cho phép truyền 1 slot_id, mảng slot_ids, hoặc (court_id, sub_court_id, booking_date, slots)
    let targetSlotIds = [];
    if (Array.isArray(slot_ids) && slot_ids.length > 0) {
      targetSlotIds = slot_ids;
    } else if (slot_id) {
      targetSlotIds = [slot_id];
    } else if (court_id && sub_court_id && booking_date && Array.isArray(slots)) {
      const foundSlots = await TimeSlot.find({
        court_id,
        sub_court_id,
        date: booking_date,
        start_time: { $in: slots },
      });
      targetSlotIds = foundSlots.map((s) => s._id);
    }

    if (targetSlotIds.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Vui lòng chọn ít nhất 1 khung giờ để đặt sân',
      });
    }

    // Thời gian giữ chỗ: 5 phút (300 giây)
    const lockDurationMs = 5 * 60 * 1000;
    const lockExpiresAt = new Date(Date.now() + lockDurationMs);
    const lockedSlots = [];

    // Thực hiện Atomic Update cho từng slot được chọn
    for (const slotId of targetSlotIds) {
      const lockedSlot = await TimeSlot.findOneAndUpdate(
        { _id: slotId, status: 'available' },
        {
          $set: {
            status: 'locked',
            locked_by: userId,
            lock_expires_at: lockExpiresAt,
          },
        },
        { new: true }
      );

      if (!lockedSlot) {
        // Rollback các slot đã khóa trước đó trong cùng request nếu có 1 slot bị trùng
        if (lockedSlots.length > 0) {
          await TimeSlot.updateMany(
            { _id: { $in: lockedSlots.map((s) => s._id) } },
            {
              $set: {
                status: 'available',
                locked_by: null,
                lock_expires_at: null,
              },
            }
          );
        }

        return res.status(409).json({
          success: false,
          code: 'SLOT_ALREADY_LOCKED',
          message: 'Khung giờ này vừa có người nhanh tay chọn trước!',
        });
      }

      lockedSlots.push(lockedSlot);
    }

    // Sắp xếp các slot theo thứ tự thời gian
    lockedSlots.sort((a, b) => a.start_time.localeCompare(b.start_time));

    const firstSlot = lockedSlots[0];
    const lastSlot = lockedSlots[lockedSlots.length - 1];
    const courtFee = lockedSlots.reduce((sum, s) => sum + (s.price || 90000), 0);

    const randomSuffix = Math.floor(1000 + Math.random() * 9000);
    const dateStr = firstSlot.date.replace(/-/g, '');
    const bookingCode = `BB-${dateStr}-${randomSuffix}`;

    const booking = await Booking.create({
      booking_code: bookingCode,
      user_id: userId,
      court_id: firstSlot.court_id,
      sub_court_id: firstSlot.sub_court_id,
      sub_court_name: firstSlot.sub_court_name,
      booking_date: firstSlot.date,
      start_time: firstSlot.start_time,
      end_time: lastSlot.end_time,
      slots: lockedSlots.map((s) => s.start_time),
      slot_ids: lockedSlots.map((s) => s._id),
      court_fee: courtFee,
      services_fee: 0,
      total_amount: courtFee,
      deposit_paid: Math.round(courtFee * 0.5),
      status: 'locked_pending',
      lock_expires_at: lockExpiresAt,
    });

    // Gắn booking_id vào các TimeSlot đã khóa
    await TimeSlot.updateMany(
      { _id: { $in: lockedSlots.map((s) => s._id) } },
      { $set: { booking_id: booking._id } }
    );

    // Phát sự kiện Real-time qua Socket.io để màn hình các User khác đổi sang màu VÀNG ngay lập tức
    if (io) {
      for (const s of lockedSlots) {
        io.emit('slot_status_changed', {
          slot_id: s._id,
          court_id: s.court_id,
          sub_court_id: s.sub_court_id,
          date: s.date,
          start_time: s.start_time,
          status: 'locked',
          locked_by: userId,
          lock_expires_at: lockExpiresAt,
          booking_id: booking._id,
        });
      }
    }

    const populatedBooking = await Booking.findById(booking._id).populate(
      'court_id',
      'name address district images extra_services'
    );

    return res.status(200).json({
      success: true,
      message: 'Đã giữ chỗ khung giờ trong 5 phút. Vui lòng hoàn tất thanh toán!',
      lock_expires_at: lockExpiresAt,
      countdown_seconds: 300,
      booking: populatedBooking,
      locked_slots: lockedSlots,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: 'Lỗi khi khóa khung giờ đặt sân',
      error: error.message,
    });
  }
};

// POST /api/bookings/:id/release (Nhả slot khi user thoát hoặc hết giờ đếm ngược)
const releaseBookingSlot = async (req, res) => {
  try {
    const booking = await Booking.findById(req.params.id);
    if (!booking) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy đơn đặt sân' });
    }

    if (booking.status !== 'locked_pending') {
      return res.status(400).json({
        success: false,
        message: 'Chỉ có thể giải phóng đơn đang trong trạng thái giữ chỗ tạm thời',
      });
    }

    booking.status = 'cancelled';
    booking.cancel_reason = req.body.reason || 'Hết thời gian giữ chỗ 5 phút hoặc người dùng hủy thao tác';
    await booking.save();

    const slotsToRelease = await TimeSlot.find({ _id: { $in: booking.slot_ids } });
    await TimeSlot.updateMany(
      { _id: { $in: booking.slot_ids } },
      {
        $set: {
          status: 'available',
          locked_by: null,
          lock_expires_at: null,
          booking_id: null,
        },
      }
    );

    const io = req.app.get('io');
    if (io) {
      for (const s of slotsToRelease) {
        io.emit('slot_status_changed', {
          slot_id: s._id,
          court_id: s.court_id,
          sub_court_id: s.sub_court_id,
          date: s.date,
          start_time: s.start_time,
          status: 'available',
          locked_by: null,
          lock_expires_at: null,
        });
      }
    }

    return res.status(200).json({
      success: true,
      message: 'Đã giải phóng khung giờ về trạng thái trống (Màu Xanh)',
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: 'Lỗi khi giải phóng slot',
      error: error.message,
    });
  }
};

// POST /api/bookings/:id/confirm (Thanh toán tại sân CASH hoặc xác nhận trực tiếp)
const confirmBooking = async (req, res) => {
  try {
    const { extra_services, payment_method } = req.body;
    const booking = await Booking.findById(req.params.id).populate('court_id');
    if (!booking) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy đơn đặt sân' });
    }

    if (booking.status === 'cancelled') {
      return res.status(400).json({
        success: false,
        message: 'Đơn đặt sân này đã hết hạn giữ chỗ hoặc đã bị hủy',
      });
    }

    let servicesFee = 0;
    if (Array.isArray(extra_services)) {
      booking.extra_services = extra_services.filter((item) => item.quantity > 0);
      servicesFee = booking.extra_services.reduce(
        (sum, item) => sum + Number(item.price || 0) * Number(item.quantity || 0),
        0
      );
    }

    booking.services_fee = servicesFee;
    booking.total_amount = booking.court_fee + servicesFee;
    booking.deposit_paid = Math.round(booking.total_amount * 0.5);

    const qrPayload = JSON.stringify({
      booking_id: booking._id,
      booking_code: booking.booking_code,
      court: booking.court_id?.name,
      sub_court: booking.sub_court_name,
      date: booking.booking_date,
      time: `${booking.start_time}-${booking.end_time}`,
    });

    booking.qr_checkin_code = `BBQR|${booking.booking_code}|${booking._id}`;
    booking.status = 'confirmed';
    booking.lock_expires_at = null;
    booking.payment_info = {
      transaction_id: `TXN-${Date.now()}`,
      payment_method: payment_method || 'CASH',
      pay_time: new Date(),
    };
    await booking.save();

    await TimeSlot.updateMany(
      { _id: { $in: booking.slot_ids } },
      {
        $set: {
          status: 'booked',
          lock_expires_at: null,
          booking_id: booking._id,
        },
      }
    );

    const updatedSlots = await TimeSlot.find({ _id: { $in: booking.slot_ids } });
    const io = req.app.get('io');
    if (io) {
      for (const s of updatedSlots) {
        io.emit('slot_status_changed', {
          slot_id: s._id,
          court_id: s.court_id,
          sub_court_id: s.sub_court_id,
          date: s.date,
          start_time: s.start_time,
          status: 'booked',
          booking_id: booking._id,
        });
      }
    }

    const qrDataUrl = await QRCode.toDataURL(qrPayload);

    return res.status(200).json({
      success: true,
      message: 'Xác nhận đặt sân thành công! Vé điện tử QR đã sẵn sàng.',
      booking,
      qr_data_url: qrDataUrl,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: 'Lỗi khi xác nhận đặt sân',
      error: error.message,
    });
  }
};

// GET /api/bookings/my-bookings
const getMyBookings = async (req, res) => {
  try {
    const io = req.app.get('io');
    await releaseExpiredLocks(io);

    const { tab } = req.query; // 'upcoming' | 'completed' | 'cancelled'
    const filter = { user_id: req.user._id };

    if (tab === 'upcoming') {
      filter.status = { $in: ['confirmed', 'locked_pending'] };
    } else if (tab === 'completed') {
      filter.status = 'completed';
    } else if (tab === 'cancelled') {
      filter.status = 'cancelled';
    }

    const bookings = await Booking.find(filter)
      .populate('court_id', 'name address district images hourly_rate')
      .sort({ created_at: -1 });

    return res.status(200).json({
      success: true,
      count: bookings.length,
      bookings,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: 'Lỗi khi tải lịch sử đặt sân',
      error: error.message,
    });
  }
};

// GET /api/bookings/:id
const getBookingById = async (req, res) => {
  try {
    const booking = await Booking.findById(req.params.id)
      .populate('court_id', 'name address district images extra_services hourly_rate peak_hour_rate')
      .populate('user_id', 'full_name email phone');

    if (!booking) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy đơn đặt sân' });
    }

    return res.status(200).json({
      success: true,
      booking,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: 'Lỗi khi lấy chi tiết đơn đặt sân',
      error: error.message,
    });
  }
};

// POST /api/bookings/:id/cancel (Hủy lịch đặt kèm điều kiện phạt cọc nếu hủy sát giờ dưới 4 tiếng)
const cancelBooking = async (req, res) => {
  try {
    const booking = await Booking.findById(req.params.id);
    if (!booking) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy đơn đặt sân' });
    }

    if (booking.status === 'cancelled' || booking.status === 'completed') {
      return res.status(400).json({
        success: false,
        message: 'Đơn đặt sân này không thể hủy',
      });
    }

    // Kiểm tra thời gian hiện tại so với giờ bắt đầu trận đấu (phạt cọc nếu dưới 4 tiếng)
    const matchStartTime = new Date(`${booking.booking_date}T${booking.start_time}:00`);
    const hoursUntilMatch = (matchStartTime.getTime() - Date.now()) / (1000 * 60 * 60);
    const isLateCancel = hoursUntilMatch < 4;

    const penaltyAmount = isLateCancel ? booking.deposit_paid : 0;
    booking.status = 'cancelled';
    booking.penalty_amount = penaltyAmount;
    booking.cancel_reason =
      req.body.reason ||
      (isLateCancel
        ? 'Hủy sát giờ (dưới 4 tiếng trước trận) - Phạt 100% tiền cọc'
        : 'Người dùng chủ động hủy trước 4 tiếng - Hoàn trả 100% tiền cọc');
    await booking.save();

    // Giải phóng các TimeSlot trở về available (Màu Xanh)
    const releasedSlots = await TimeSlot.find({ _id: { $in: booking.slot_ids } });
    await TimeSlot.updateMany(
      { _id: { $in: booking.slot_ids } },
      {
        $set: {
          status: 'available',
          locked_by: null,
          lock_expires_at: null,
          booking_id: null,
        },
      }
    );

    const io = req.app.get('io');
    if (io) {
      for (const s of releasedSlots) {
        io.emit('slot_status_changed', {
          slot_id: s._id,
          court_id: s.court_id,
          sub_court_id: s.sub_court_id,
          date: s.date,
          start_time: s.start_time,
          status: 'available',
        });
      }
    }

    return res.status(200).json({
      success: true,
      is_late_cancel: isLateCancel,
      penalty_amount: penaltyAmount,
      message: isLateCancel
        ? `Đã hủy lịch đặt. Do hủy sát giờ (< 4 tiếng), bạn bị phạt cọc ${penaltyAmount.toLocaleString('vi-VN')}đ.`
        : 'Đã hủy lịch đặt thành công trước 4 tiếng. Tiền cọc được hoàn lại 100%.',
      booking,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: 'Lỗi khi hủy lịch đặt sân',
      error: error.message,
    });
  }
};

// POST /api/bookings/:id/review (Đánh giá & nhận xét sao sau khi hoàn tất trận)
const reviewBooking = async (req, res) => {
  try {
    const { rating, comment } = req.body;
    const booking = await Booking.findById(req.params.id);
    if (!booking) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy đơn đặt sân' });
    }

    const court = await Court.findById(booking.court_id);
    if (!court) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy cụm sân' });
    }

    const numericRating = Math.min(5, Math.max(1, Number(rating) || 5));
    court.reviews.unshift({
      user_id: req.user._id,
      user_name: req.user.full_name,
      booking_id: booking._id,
      rating: numericRating,
      comment: comment || 'Sân đẹp, ánh sáng tốt, thảm bám chân!',
      created_at: new Date(),
    });

    const totalReviews = court.reviews.length;
    const sumRatings = court.reviews.reduce((acc, r) => acc + r.rating, 0);
    court.rating_count = totalReviews;
    court.rating_avg = Number((sumRatings / totalReviews).toFixed(1));
    await court.save();

    booking.is_reviewed = true;
    await booking.save();

    return res.status(200).json({
      success: true,
      message: 'Cảm ơn bạn đã gửi đánh giá chất lượng sân!',
      rating_avg: court.rating_avg,
      rating_count: court.rating_count,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: 'Lỗi khi gửi đánh giá',
      error: error.message,
    });
  }
};

module.exports = {
  lockSlot,
  releaseBookingSlot,
  confirmBooking,
  getMyBookings,
  getBookingById,
  cancelBooking,
  reviewBooking,
};

