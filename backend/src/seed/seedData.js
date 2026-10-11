require('dotenv').config();
const fs = require('fs');
const path = require('path');
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const User = require('../models/User');
const Court = require('../models/Court');
const TimeSlot = require('../models/TimeSlot');
const Booking = require('../models/Booking');
const MatchRequest = require('../models/MatchRequest');
const Message = require('../models/Message');
const { ensureSlotsForCourtDate } = require('../services/slotService');

async function seedDatabase(closeConnection = false) {
  try {
    if (mongoose.connection.readyState === 0) {
      await mongoose.connect(
        process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/badminton_booking'
      );
    }

    await Promise.all([
      User.deleteMany({}),
      Court.deleteMany({}),
      TimeSlot.deleteMany({}),
      Booking.deleteMany({}),
      MatchRequest.deleteMany({}),
      Message.deleteMany({}),
    ]);

    const salt = await bcrypt.genSalt(10);
    const defaultPass = await bcrypt.hash('123456', salt);

    // 1. Tạo Users (Admin, Chủ sân, Người chơi)
    const users = await User.insertMany([
      {
        full_name: 'Quản Trị Hệ Thống (Admin)',
        email: 'admin@badmintonbooking.vn',
        password_hash: defaultPass,
        phone: '0901234567',
        avatar: 'https://ui-avatars.com/api/?background=0f766e&color=fff&name=Admin',
        role: 'admin',
        profile: { skill_level: 'advanced', dominant_hand: 'right', preferred_play: 'double' },
      },
      {
        full_name: 'Nguyễn Minh Quân',
        email: 'quan@gmail.com',
        password_hash: defaultPass,
        phone: '0988112233',
        avatar: 'https://ui-avatars.com/api/?background=0284c7&color=fff&name=Minh+Quan',
        role: 'user',
        profile: { skill_level: 'intermediate', dominant_hand: 'right', preferred_play: 'double' },
      },
      {
        full_name: 'Trần Hoàng Nam',
        email: 'nam@gmail.com',
        password_hash: defaultPass,
        phone: '0977334455',
        avatar: 'https://ui-avatars.com/api/?background=4f46e5&color=fff&name=Hoang+Nam',
        role: 'user',
        profile: { skill_level: 'advanced', dominant_hand: 'left', preferred_play: 'single' },
      },
      {
        full_name: 'Lê Thu Hà',
        email: 'ha@gmail.com',
        password_hash: defaultPass,
        phone: '0912556677',
        avatar: 'https://ui-avatars.com/api/?background=db2777&color=fff&name=Thu+Ha',
        role: 'user',
        profile: { skill_level: 'intermediate', dominant_hand: 'right', preferred_play: 'double' },
      },
      {
        full_name: 'Phạm Đức Anh',
        email: 'ducanh@gmail.com',
        password_hash: defaultPass,
        phone: '0933889900',
        avatar: 'https://ui-avatars.com/api/?background=d97706&color=fff&name=Duc+Anh',
        role: 'user',
        profile: { skill_level: 'beginner', dominant_hand: 'right', preferred_play: 'double' },
      },
    ]);

    const [adminUser, userQuan, userNam, userHa, userDucAnh] = users;

    // 2. Tạo Cụm sân & Sân con (Courts & SubCourts)
    const createSubCourts = (count) =>
      Array.from({ length: count }, (_, i) => ({
        sub_court_id: new mongoose.Types.ObjectId(),
        court_number: `Sân ${i + 1}`,
        is_active: true,
      }));

    const courts = await Court.insertMany([
      {
        name: 'Cụm Sân Cầu Lông Cầu Giấy Arena',
        address: 'Số 35 Trần Quý Kiên, Dịch Vọng, Cầu Giấy, Hà Nội',
        district: 'Cầu Giấy',
        city: 'Hà Nội',
        images: [
          'https://images.unsplash.com/photo-1626224583764-f87db24ac4ea?auto=format&fit=crop&w=900&q=80',
        ],
        open_time: '05:00',
        close_time: '23:00',
        hourly_rate: 90000,
        peak_hour_rate: 130000,
        peak_hours: { start: '17:00', end: '21:00' },
        carpet_type: 'Thảm Yonex',
        court_type: 'indoor',
        amenities: ['Wifi tốc độ cao', 'Thảm Yonex chuẩn BWF', 'Tắm nóng lạnh', 'Bãi đỗ ô tô', 'Căng tin nước giải khát'],
        sub_courts: createSubCourts(4),
        rating_avg: 4.9,
        rating_count: 38,
        reviews: [
          {
            user_id: userQuan._id,
            user_name: userQuan.full_name,
            rating: 5,
            comment: 'Thảm Yonex cực bám chân, trần cao 11m không bị chói đèn LED!',
          },
          {
            user_id: userHa._id,
            user_name: userHa.full_name,
            rating: 5,
            comment: 'Nhà vệ sinh sạch sẽ, chủ sân nhiệt tình, check-in QR rất nhanh.',
          },
        ],
      },
      {
        name: 'Sân Cầu Lông Đống Đa Star Club',
        address: 'Ngõ 157 Chùa Láng, Láng Thượng, Đống Đa, Hà Nội',
        district: 'Đống Đa',
        city: 'Hà Nội',
        images: [
          'https://images.unsplash.com/photo-1521537634581-0dced2fee2ef?auto=format&fit=crop&w=900&q=80',
        ],
        open_time: '05:00',
        close_time: '23:00',
        hourly_rate: 80000,
        peak_hour_rate: 120000,
        peak_hours: { start: '17:00', end: '21:00' },
        carpet_type: 'Thảm PVC',
        court_type: 'indoor',
        amenities: ['Wifi', 'Thảm PVC tiêu chuẩn', 'Tắm nóng lạnh', 'Cho thuê vợt & giày'],
        sub_courts: createSubCourts(4),
        rating_avg: 4.7,
        rating_count: 24,
      },
      {
        name: 'Tổ Hợp Cầu Lông Thanh Xuân Pro',
        address: 'Số 286 Nguyễn Xiển, Hạ Đình, Thanh Xuân, Hà Nội',
        district: 'Thanh Xuân',
        city: 'Hà Nội',
        images: [
          'https://images.unsplash.com/photo-1613918431703-aa50889e3be9?auto=format&fit=crop&w=900&q=80',
        ],
        open_time: '05:00',
        close_time: '23:00',
        hourly_rate: 85000,
        peak_hour_rate: 125000,
        peak_hours: { start: '17:00', end: '21:00' },
        carpet_type: 'Thảm Enlio',
        court_type: 'indoor',
        amenities: ['Wifi', 'Thảm Enlio 5.0mm', 'Trần cao 10m', 'Bãi gửi xe miễn phí'],
        sub_courts: createSubCourts(5),
        rating_avg: 4.8,
        rating_count: 19,
      },
      {
        name: 'Sân Cầu Lông Tây Hồ Lakeview',
        address: 'Số 88 Võ Chí Công, Xuân La, Tây Hồ, Hà Nội',
        district: 'Tây Hồ',
        city: 'Hà Nội',
        images: [
          'https://images.unsplash.com/photo-1599474924187-334a4ae5bd3c?auto=format&fit=crop&w=900&q=80',
        ],
        open_time: '05:00',
        close_time: '23:00',
        hourly_rate: 70000,
        peak_hour_rate: 100000,
        peak_hours: { start: '17:00', end: '21:00' },
        carpet_type: 'Sàn gỗ',
        court_type: 'outdoor',
        amenities: ['Thoáng mát', 'Đèn pha cao áp', 'Quán trà chanh giao lưu'],
        sub_courts: createSubCourts(3),
        rating_avg: 4.5,
        rating_count: 14,
      },
    ]);

    const todayStr = new Date().toISOString().slice(0, 10);
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const tomorrowStr = tomorrow.toISOString().slice(0, 10);

    // 3. Khởi tạo TimeSlots cho hôm nay và ngày mai
    for (const c of courts) {
      await ensureSlotsForCourtDate(c, todayStr);
      await ensureSlotsForCourtDate(c, tomorrowStr);
    }

    // 4. Tạo các đơn Booking mẫu (Confirmed, Completed) & cập nhật màu Đỏ cho TimeSlot
    const mainCourt = courts[0];
    const sub1 = mainCourt.sub_courts[0];
    const sub2 = mainCourt.sub_courts[1];

    const bookedSlotsSub1 = await TimeSlot.find({
      court_id: mainCourt._id,
      sub_court_id: sub1.sub_court_id,
      date: todayStr,
      start_time: { $in: ['18:00', '19:00'] },
    });

    const booking1 = await Booking.create({
      booking_code: `BB-${todayStr.replace(/-/g, '')}-1001`,
      user_id: userQuan._id,
      court_id: mainCourt._id,
      sub_court_id: sub1.sub_court_id,
      sub_court_name: sub1.court_number,
      booking_date: todayStr,
      start_time: '18:00',
      end_time: '20:00',
      slots: ['18:00', '19:00'],
      slot_ids: bookedSlotsSub1.map((s) => s._id),
      extra_services: [
        { service_id: 'water_bottle', name: 'Nước suối Aquafina 500ml', quantity: 4, price: 10000 },
        { service_id: 'shuttlecock_tube', name: 'Ống cầu lông Hải Yến S90', quantity: 1, price: 220000 },
      ],
      court_fee: 260000,
      services_fee: 260000,
      total_amount: 520000,
      deposit_paid: 260000,
      status: 'confirmed',
      payment_info: {
        transaction_id: 'VNP14589201',
        payment_method: 'VNPAY',
        pay_time: new Date(),
      },
      qr_checkin_code: `BBQR|BB-${todayStr.replace(/-/g, '')}-1001|DEMO`,
    });

    await TimeSlot.updateMany(
      { _id: { $in: bookedSlotsSub1.map((s) => s._id) } },
      { $set: { status: 'booked', booking_id: booking1._id } }
    );

    const bookedSlotsSub2 = await TimeSlot.find({
      court_id: mainCourt._id,
      sub_court_id: sub2.sub_court_id,
      date: todayStr,
      start_time: { $in: ['19:00', '20:00'] },
    });

    const booking2 = await Booking.create({
      booking_code: `BB-${todayStr.replace(/-/g, '')}-1002`,
      user_id: userNam._id,
      court_id: mainCourt._id,
      sub_court_id: sub2.sub_court_id,
      sub_court_name: sub2.court_number,
      booking_date: todayStr,
      start_time: '19:00',
      end_time: '21:00',
      slots: ['19:00', '20:00'],
      slot_ids: bookedSlotsSub2.map((s) => s._id),
      extra_services: [{ service_id: 'racket_rental', name: 'Thuê vợt cầu lông Yonex', quantity: 2, price: 35000 }],
      court_fee: 260000,
      services_fee: 70000,
      total_amount: 330000,
      deposit_paid: 165000,
      status: 'completed',
      checked_in_at: new Date(),
      payment_info: {
        transaction_id: 'MOMO9988123',
        payment_method: 'MOMO',
        pay_time: new Date(),
      },
      qr_checkin_code: `BBQR|BB-${todayStr.replace(/-/g, '')}-1002|DEMO`,
    });

    await TimeSlot.updateMany(
      { _id: { $in: bookedSlotsSub2.map((s) => s._id) } },
      { $set: { status: 'booked', booking_id: booking2._id } }
    );

    await Booking.create({
      booking_code: `BB-${todayStr.replace(/-/g, '')}-0988`,
      user_id: userQuan._id,
      court_id: courts[1]._id,
      sub_court_id: courts[1].sub_courts[0].sub_court_id,
      sub_court_name: 'Sân 1',
      booking_date: todayStr,
      start_time: '06:00',
      end_time: '08:00',
      slots: ['06:00', '07:00'],
      slot_ids: [],
      court_fee: 160000,
      services_fee: 20000,
      total_amount: 180000,
      deposit_paid: 90000,
      status: 'completed',
      checked_in_at: new Date(Date.now() - 3600 * 1000 * 3),
      payment_info: {
        transaction_id: 'VNP14500112',
        payment_method: 'VNPAY',
        pay_time: new Date(Date.now() - 3600 * 1000 * 5),
      },
      qr_checkin_code: `BBQR|BB-${todayStr.replace(/-/g, '')}-0988|DEMO`,
      is_reviewed: false,
    });

    // 5. Tạo các Kèo giao lưu (MatchRequests) & Tin nhắn phòng Chat (Messages)
    const match1 = await MatchRequest.create({
      creator_id: userQuan._id,
      booking_id: booking1._id,
      court_id: mainCourt._id,
      title: 'Cần tìm 2 tay vợt Nam/Nữ trình độ TB+ đánh đôi sân Cầu Giấy lúc 18h tối nay',
      location_name: 'Cụm Sân Cầu Lông Cầu Giấy Arena (Sân 1)',
      district: 'Cầu Giấy',
      scheduled_date: todayStr,
      scheduled_time: new Date(`${todayStr}T18:00:00`),
      time_range: '18:00 - 20:00',
      required_level: 'intermediate',
      max_players: 6,
      current_players: [userQuan._id, userHa._id, userNam._id],
      cost_per_person: 75000,
      notes: 'Cầu Hải Yến S90 có sẵn, anh em mang vợt đến chiến vui vẻ hòa đồng nhé!',
      status: 'open',
    });

    await MatchRequest.create({
      creator_id: userNam._id,
      court_id: courts[1]._id,
      title: 'Tuyển 3 bạn giao lưu trình độ Khá - Đánh đôi nam căng tay tại Chùa Láng',
      location_name: 'Sân Cầu Lông Đống Đa Star Club (Sân 2)',
      district: 'Đống Đa',
      scheduled_date: todayStr,
      scheduled_time: new Date(`${todayStr}T19:30:00`),
      time_range: '19:30 - 21:30',
      required_level: 'advanced',
      max_players: 6,
      current_players: [userNam._id, userQuan._id],
      cost_per_person: 85000,
      notes: 'Share đều tiền sân + cầu, có nước trà đá miễn phí.',
      status: 'open',
    });

    await MatchRequest.create({
      creator_id: userHa._id,
      court_id: courts[2]._id,
      title: 'Kèo Newbie thân thiện cho người mới chơi - Giao lưu rèn kỹ thuật cơ bản',
      location_name: 'Tổ Hợp Cầu Lông Thanh Xuân Pro (Sân 3)',
      district: 'Thanh Xuân',
      scheduled_date: tomorrowStr,
      scheduled_time: new Date(`${tomorrowStr}T17:30:00`),
      time_range: '17:30 - 19:30',
      required_level: 'beginner',
      max_players: 8,
      current_players: [userHa._id, userDucAnh._id],
      cost_per_person: 60000,
      notes: 'Phù hợp các bạn mới tập đập/phông cầu, hỗ trợ hướng dẫn nhiệt tình.',
      status: 'open',
    });

    await Message.insertMany([
      {
        match_id: match1._id,
        sender_id: userQuan._id,
        sender_name: 'Hệ thống',
        content: 'Chủ kèo Nguyễn Minh Quân đã mở phòng chat giao lưu Sân Cầu Giấy Arena.',
        message_type: 'system_event',
      },
      {
        match_id: match1._id,
        sender_id: userQuan._id,
        sender_name: userQuan.full_name,
        sender_avatar: userQuan.avatar,
        content: 'Chào anh em! Mình đã cọc Sân 1 từ 18h-20h tối nay rồi nhé. Chỗ gửi xe ngay cổng chính số 35 Trần Quý Kiên.',
        message_type: 'text',
      },
      {
        match_id: match1._id,
        sender_id: userHa._id,
        sender_name: userHa.full_name,
        sender_avatar: userHa.avatar,
        content: 'Ok anh Quân, tầm 17h50 em có mặt ở sân số 1, em mặc áo Yonex màu xanh ngọc nhé!',
        message_type: 'text',
      },
      {
        match_id: match1._id,
        sender_id: userNam._id,
        sender_name: 'Hệ thống',
        content: '🎉 Trần Hoàng Nam vừa tham gia vào kèo giao lưu (3/6 tay vợt).',
        message_type: 'system_event',
      },
      {
        match_id: match1._id,
        sender_id: userNam._id,
        sender_name: userNam.full_name,
        sender_avatar: userNam.avatar,
        content: 'Mình vừa bấm tham gia kèo, tối nay mang thêm 1 ống Hải Yến S90 sơ cua cho anh em đánh thoải mái!',
        message_type: 'text',
      },
    ]);

    // Xuất dữ liệu mẫu ra thư mục import-json (để dễ dàng import vào MongoDB Compass nếu cần)
    const importDir = path.join(__dirname, '../../import-json');
    if (!fs.existsSync(importDir)) {
      fs.mkdirSync(importDir, { recursive: true });
    }
    const [allUsers, allCourts, allTimeSlots, allBookings, allMatches, allMessages] = await Promise.all([
      User.find().lean(),
      Court.find().lean(),
      TimeSlot.find().lean(),
      Booking.find().lean(),
      MatchRequest.find().lean(),
      Message.find().lean(),
    ]);
    fs.writeFileSync(path.join(importDir, 'users.json'), JSON.stringify(allUsers, null, 2));
    fs.writeFileSync(path.join(importDir, 'courts.json'), JSON.stringify(allCourts, null, 2));
    fs.writeFileSync(path.join(importDir, 'timeslots.json'), JSON.stringify(allTimeSlots, null, 2));
    fs.writeFileSync(path.join(importDir, 'bookings.json'), JSON.stringify(allBookings, null, 2));
    fs.writeFileSync(path.join(importDir, 'matchrequests.json'), JSON.stringify(allMatches, null, 2));
    fs.writeFileSync(path.join(importDir, 'messages.json'), JSON.stringify(allMessages, null, 2));

    console.log('✅ Seed dữ liệu mẫu Badminton Booking thành công!');
    console.log('   - Tài khoản Người chơi: quan@gmail.com / 123456');
    console.log('   - Tài khoản Người chơi 2: nam@gmail.com / 123456');
    console.log('   - Tài khoản Admin Web: admin@badmintonbooking.vn / 123456');

    if (closeConnection) {
      await mongoose.connection.close();
    }
  } catch (error) {
    console.error('❌ Lỗi khi seed dữ liệu:', error);
    if (closeConnection) process.exit(1);
  }
}

if (require.main === module) {
  seedDatabase(true);
}

module.exports = { seedDatabase };
