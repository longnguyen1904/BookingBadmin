const TimeSlot = require('../models/TimeSlot');
const Booking = require('../models/Booking');
const Court = require('../models/Court');

/**
 * Sinh danh sách khung giờ 1 tiếng từ open_time (05:00) đến close_time (23:00)
 */
function generateHourRanges(openTime = '05:00', closeTime = '23:00', peakStart = '17:00', peakEnd = '21:00', normalRate = 90000, peakRate = 130000) {
  const startHour = parseInt(openTime.split(':')[0], 10) || 5;
  const endHour = parseInt(closeTime.split(':')[0], 10) || 23;
  const pStart = parseInt(peakStart.split(':')[0], 10) || 17;
  const pEnd = parseInt(peakEnd.split(':')[0], 10) || 21;

  const ranges = [];
  for (let h = startHour; h < endHour; h++) {
    const sh = String(h).padStart(2, '0') + ':00';
    const eh = String(h + 1).padStart(2, '0') + ':00';
    const isPeak = h >= pStart && h < pEnd;
    ranges.push({
      start_time: sh,
      end_time: eh,
      is_peak_hour: isPeak,
      price: isPeak ? peakRate : normalRate,
    });
  }
  return ranges;
}

/**
 * Đảm bảo toàn bộ TimeSlots của 1 cụm sân trong ngày `date` đã được khởi tạo trong MongoDB
 */
async function ensureSlotsForCourtDate(court, date) {
  if (!court || !court.sub_courts || court.sub_courts.length === 0) return;

  const existingCount = await TimeSlot.countDocuments({
    court_id: court._id,
    date,
  });

  const hourRanges = generateHourRanges(
    court.open_time,
    court.close_time,
    court.peak_hours?.start || '17:00',
    court.peak_hours?.end || '21:00',
    court.hourly_rate,
    court.peak_hour_rate || Math.round(court.hourly_rate * 1.4)
  );

  const expectedCount = court.sub_courts.length * hourRanges.length;
  if (existingCount >= expectedCount) return;

  const ops = [];
  for (const sub of court.sub_courts) {
    const subId = sub.sub_court_id || sub._id;
    for (const hr of hourRanges) {
      ops.push({
        updateOne: {
          filter: {
            court_id: court._id,
            sub_court_id: subId,
            date,
            start_time: hr.start_time,
          },
          update: {
            $setOnInsert: {
              court_id: court._id,
              sub_court_id: subId,
              sub_court_name: sub.court_number,
              date,
              start_time: hr.start_time,
              end_time: hr.end_time,
              price: hr.price,
              is_peak_hour: hr.is_peak_hour,
              status: 'available',
            },
          },
          upsert: true,
        },
      });
    }
  }

  if (ops.length > 0) {
    await TimeSlot.bulkWrite(ops, { ordered: false });
  }
}

/**
 * Giải phóng các slot đã hết hạn giữ chỗ (5 phút) và thông báo qua Socket.io
 */
async function releaseExpiredLocks(io = null) {
  const now = new Date();
  const expiredSlots = await TimeSlot.find({
    status: 'locked',
    lock_expires_at: { $lte: now },
  });

  if (expiredSlots.length === 0) return 0;

  const expiredSlotIds = expiredSlots.map((s) => s._id);
  const bookingIds = [
    ...new Set(
      expiredSlots
        .map((s) => (s.booking_id ? s.booking_id.toString() : null))
        .filter(Boolean)
    ),
  ];

  await TimeSlot.updateMany(
    { _id: { $in: expiredSlotIds }, status: 'locked' },
    {
      $set: {
        status: 'available',
        locked_by: null,
        lock_expires_at: null,
        booking_id: null,
      },
    }
  );

  if (bookingIds.length > 0) {
    await Booking.updateMany(
      { _id: { $in: bookingIds }, status: 'locked_pending' },
      {
        $set: {
          status: 'cancelled',
          cancel_reason: 'Hết thời gian giữ chỗ 5 phút không thanh toán',
        },
      }
    );
  }

  if (io) {
    for (const slot of expiredSlots) {
      io.emit('slot_status_changed', {
        slot_id: slot._id,
        court_id: slot.court_id,
        sub_court_id: slot.sub_court_id,
        date: slot.date,
        start_time: slot.start_time,
        status: 'available',
        locked_by: null,
        lock_expires_at: null,
      });
    }
  }

  return expiredSlots.length;
}

module.exports = {
  generateHourRanges,
  ensureSlotsForCourtDate,
  releaseExpiredLocks,
};

