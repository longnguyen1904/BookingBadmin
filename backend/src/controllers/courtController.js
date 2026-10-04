const mongoose = require('mongoose');
const Court = require('../models/Court');
const TimeSlot = require('../models/TimeSlot');
const { ensureSlotsForCourtDate, releaseExpiredLocks } = require('../services/slotService');

// GET /api/courts
const getCourts = async (req, res) => {
  try {
    const { district, minPrice, maxPrice, carpet_type, court_type, search } = req.query;
    const filter = {};

    if (district && district !== 'all') {
      filter.district = { $regex: district, $options: 'i' };
    }
    if (carpet_type && carpet_type !== 'all') {
      filter.carpet_type = { $regex: carpet_type, $options: 'i' };
    }
    if (court_type && court_type !== 'all') {
      filter.court_type = court_type;
    }
    if (minPrice || maxPrice) {
      filter.hourly_rate = {};
      if (minPrice) filter.hourly_rate.$gte = Number(minPrice);
      if (maxPrice) filter.hourly_rate.$lte = Number(maxPrice);
    }
    if (search) {
      filter.$or = [
        { name: { $regex: search, $options: 'i' } },
        { address: { $regex: search, $options: 'i' } },
        { district: { $regex: search, $options: 'i' } },
      ];
    }

    const courts = await Court.find(filter).sort({ rating_avg: -1, created_at: -1 });
    return res.status(200).json({
      success: true,
      count: courts.length,
      courts,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: 'Lỗi khi tải danh sách cụm sân',
      error: error.message,
    });
  }
};

// GET /api/courts/:id
const getCourtById = async (req, res) => {
  try {
    const court = await Court.findById(req.params.id);
    if (!court) {
      return res.status(404).json({
        success: false,
        message: 'Không tìm thấy cụm sân',
      });
    }
    return res.status(200).json({
      success: true,
      court,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: 'Lỗi khi lấy chi tiết sân',
      error: error.message,
    });
  }
};

// GET /api/courts/:id/slots?date=YYYY-MM-DD&sub_court_id=...
const getCourtSlots = async (req, res) => {
  try {
    const courtId = req.params.id;
    const date = req.query.date || new Date().toISOString().slice(0, 10);
    const subCourtId = req.query.sub_court_id;

    const court = await Court.findById(courtId);
    if (!court) {
      return res.status(404).json({
        success: false,
        message: 'Không tìm thấy cụm sân',
      });
    }

    // Giải phóng các slot khóa quá 5 phút
    const io = req.app.get('io');
    await releaseExpiredLocks(io);

    // Đảm bảo đã sinh đầy đủ slot 05:00 - 23:00 cho ngày được chọn
    await ensureSlotsForCourtDate(court, date);

    const query = { court_id: court._id, date };
    if (subCourtId) {
      query.sub_court_id = subCourtId;
    }

    const slots = await TimeSlot.find(query).sort({ sub_court_name: 1, start_time: 1 });

    return res.status(200).json({
      success: true,
      date,
      court_id: court._id,
      court_name: court.name,
      sub_courts: court.sub_courts,
      slots,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: 'Lỗi khi lấy danh sách slot giờ của sân',
      error: error.message,
    });
  }
};

// POST /api/courts (Admin CRUD)
const createCourt = async (req, res) => {
  try {
    const {
      name,
      address,
      district,
      city,
      images,
      open_time,
      close_time,
      hourly_rate,
      peak_hour_rate,
      peak_hours,
      carpet_type,
      court_type,
      amenities,
      sub_courts_count,
      sub_courts,
    } = req.body;

    let finalSubCourts = sub_courts;
    if (!finalSubCourts || finalSubCourts.length === 0) {
      const count = Number(sub_courts_count) || 4;
      finalSubCourts = Array.from({ length: count }, (_, idx) => ({
        sub_court_id: new mongoose.Types.ObjectId(),
        court_number: `Sân ${idx + 1}`,
        is_active: true,
      }));
    }

    const court = await Court.create({
      name,
      address,
      district: district || 'Cầu Giấy',
      city: city || 'Hà Nội',
      images:
        images && images.length > 0
          ? images
          : ['https://images.unsplash.com/photo-1626224583764-f87db24ac4ea?auto=format&fit=crop&w=800&q=80'],
      open_time: open_time || '05:00',
      close_time: close_time || '23:00',
      hourly_rate: Number(hourly_rate) || 90000,
      peak_hour_rate: Number(peak_hour_rate) || 130000,
      peak_hours: peak_hours || { start: '17:00', end: '21:00' },
      carpet_type: carpet_type || 'Thảm PVC',
      court_type: court_type || 'indoor',
      amenities: amenities || ['Wifi', 'Thảm PVC', 'Tắm nóng lạnh', 'Bãi đỗ xe'],
      sub_courts: finalSubCourts,
    });

    return res.status(201).json({
      success: true,
      message: 'Tạo cụm sân mới thành công',
      court,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: 'Lỗi khi tạo cụm sân mới',
      error: error.message,
    });
  }
};

// PUT /api/courts/:id (Admin CRUD & Điều chỉnh giá khung giờ vàng)
const updateCourt = async (req, res) => {
  try {
    const court = await Court.findById(req.params.id);
    if (!court) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy cụm sân' });
    }

    const updatableFields = [
      'name',
      'address',
      'district',
      'city',
      'images',
      'open_time',
      'close_time',
      'hourly_rate',
      'peak_hour_rate',
      'peak_hours',
      'carpet_type',
      'court_type',
      'amenities',
      'sub_courts',
      'extra_services',
    ];

    for (const field of updatableFields) {
      if (req.body[field] !== undefined) {
        court[field] = req.body[field];
      }
    }

    await court.save();

    // Cập nhật lại giá cho các TimeSlot đang trống (available) của cụm sân này
    if (req.body.hourly_rate !== undefined || req.body.peak_hour_rate !== undefined) {
      await TimeSlot.updateMany(
        { court_id: court._id, status: 'available', is_peak_hour: false },
        { $set: { price: court.hourly_rate } }
      );
      await TimeSlot.updateMany(
        { court_id: court._id, status: 'available', is_peak_hour: true },
        { $set: { price: court.peak_hour_rate } }
      );
    }

    return res.status(200).json({
      success: true,
      message: 'Cập nhật cụm sân và bảng giá thành công',
      court,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: 'Lỗi khi cập nhật cụm sân',
      error: error.message,
    });
  }
};

// DELETE /api/courts/:id (Admin CRUD)
const deleteCourt = async (req, res) => {
  try {
    const court = await Court.findByIdAndDelete(req.params.id);
    if (!court) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy cụm sân' });
    }
    await TimeSlot.deleteMany({ court_id: court._id, status: 'available' });
    return res.status(200).json({
      success: true,
      message: 'Đã xóa cụm sân thành công',
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: 'Lỗi khi xóa cụm sân',
      error: error.message,
    });
  }
};

module.exports = {
  getCourts,
  getCourtById,
  getCourtSlots,
  createCourt,
  updateCourt,
  deleteCourt,
};

