const MatchRequest = require('../models/MatchRequest');
const Message = require('../models/Message');

// GET /api/matches
const getMatches = async (req, res) => {
  try {
    const { required_level, district, date, status, search } = req.query;
    const filter = {};

    if (status && status !== 'all') {
      filter.status = status;
    } else {
      filter.status = { $in: ['open', 'full'] };
    }

    if (required_level && required_level !== 'all') {
      filter.required_level = { $in: [required_level, 'all'] };
    }
    if (district && district !== 'all') {
      filter.district = { $regex: district, $options: 'i' };
    }
    if (date) {
      filter.scheduled_date = date;
    }
    if (search) {
      filter.$or = [
        { title: { $regex: search, $options: 'i' } },
        { location_name: { $regex: search, $options: 'i' } },
        { district: { $regex: search, $options: 'i' } },
      ];
    }

    const matches = await MatchRequest.find(filter)
      .populate('creator_id', 'full_name avatar phone profile')
      .populate('current_players', 'full_name avatar profile')
      .sort({ created_at: -1 });

    return res.status(200).json({
      success: true,
      count: matches.length,
      matches,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: 'Lỗi khi tải bảng tin ghép kèo giao lưu',
      error: error.message,
    });
  }
};

// GET /api/matches/:id
const getMatchById = async (req, res) => {
  try {
    const match = await MatchRequest.findById(req.params.id)
      .populate('creator_id', 'full_name avatar phone profile')
      .populate('current_players', 'full_name avatar phone profile');

    if (!match) {
      return res.status(404).json({
        success: false,
        message: 'Không tìm thấy kèo giao lưu',
      });
    }

    return res.status(200).json({
      success: true,
      match,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: 'Lỗi khi lấy chi tiết kèo giao lưu',
      error: error.message,
    });
  }
};

// POST /api/matches (Tạo bài đăng ghép kèo mới)
const createMatch = async (req, res) => {
  try {
    const {
      booking_id,
      court_id,
      title,
      location_name,
      district,
      scheduled_date,
      scheduled_time,
      time_range,
      required_level,
      max_players,
      cost_per_person,
      notes,
    } = req.body;

    if (!title || !location_name) {
      return res.status(400).json({
        success: false,
        message: 'Vui lòng nhập tiêu đề kèo và địa điểm sân',
      });
    }

    const dateStr = scheduled_date || new Date().toISOString().slice(0, 10);
    const parsedTime = scheduled_time
      ? new Date(scheduled_time)
      : new Date(`${dateStr}T19:00:00`);

    const match = await MatchRequest.create({
      creator_id: req.user._id,
      booking_id: booking_id || null,
      court_id: court_id || null,
      title,
      location_name,
      district: district || 'Cầu Giấy',
      scheduled_date: dateStr,
      scheduled_time: parsedTime,
      time_range: time_range || '19:00 - 21:00',
      required_level: required_level || 'intermediate',
      max_players: Number(max_players) || 4,
      current_players: [req.user._id],
      cost_per_person: Number(cost_per_person) || 60000,
      notes: notes || '',
      status: 'open',
    });

    // Tạo tin nhắn hệ thống mở phòng chat
    await Message.create({
      match_id: match._id,
      sender_id: req.user._id,
      sender_name: 'Hệ thống',
      content: `Chủ kèo ${req.user.full_name} đã tạo phòng chat giao lưu "${title}".`,
      message_type: 'system_event',
    });

    const populatedMatch = await MatchRequest.findById(match._id)
      .populate('creator_id', 'full_name avatar phone profile')
      .populate('current_players', 'full_name avatar profile');

    const io = req.app.get('io');
    if (io) {
      io.emit('match_created', populatedMatch);
    }

    return res.status(201).json({
      success: true,
      message: 'Đăng bài ghép kèo giao lưu thành công',
      match: populatedMatch,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: 'Lỗi khi tạo bài ghép kèo',
      error: error.message,
    });
  }
};

// POST /api/matches/:id/join (Tham gia kèo giao lưu)
const joinMatch = async (req, res) => {
  try {
    const match = await MatchRequest.findById(req.params.id);
    if (!match) {
      return res.status(404).json({
        success: false,
        message: 'Không tìm thấy kèo giao lưu',
      });
    }

    if (match.status === 'cancelled') {
      return res.status(400).json({
        success: false,
        message: 'Kèo giao lưu này đã bị hủy',
      });
    }

    const userIdStr = req.user._id.toString();
    const alreadyIn = match.current_players.some(
      (id) => id.toString() === userIdStr
    );

    if (alreadyIn) {
      const populatedExisting = await MatchRequest.findById(match._id)
        .populate('creator_id', 'full_name avatar phone profile')
        .populate('current_players', 'full_name avatar profile');
      return res.status(200).json({
        success: true,
        already_joined: true,
        message: 'Bạn đã là thành viên trong kèo này. Đang mở phòng chat!',
        match: populatedExisting,
      });
    }

    if (match.current_players.length >= match.max_players) {
      match.status = 'full';
      await match.save();
      return res.status(400).json({
        success: false,
        message: 'Kèo giao lưu này đã đủ số lượng người chơi',
      });
    }

    match.current_players.push(req.user._id);
    if (match.current_players.length >= match.max_players) {
      match.status = 'full';
    }
    await match.save();

    // Thông báo tự động trong box chat khi có thành viên mới tham gia
    const systemMsg = await Message.create({
      match_id: match._id,
      sender_id: req.user._id,
      sender_name: 'Hệ thống',
      content: `🎉 ${req.user.full_name} vừa tham gia vào kèo giao lưu (${match.current_players.length}/${match.max_players} tay vợt).`,
      message_type: 'system_event',
    });

    const populatedMatch = await MatchRequest.findById(match._id)
      .populate('creator_id', 'full_name avatar phone profile')
      .populate('current_players', 'full_name avatar profile');

    const io = req.app.get('io');
    if (io) {
      io.to(`match_${match._id}`).emit('receive_message', systemMsg);
      io.to(`match_${match._id}`).emit('match_updated', populatedMatch);
      io.emit('match_list_updated', populatedMatch);
    }

    return res.status(200).json({
      success: true,
      message: 'Tham gia kèo giao lưu thành công!',
      match: populatedMatch,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: 'Lỗi khi tham gia kèo giao lưu',
      error: error.message,
    });
  }
};

// POST /api/matches/:id/leave (Rời nhóm hoặc chủ kèo hủy trận)
const leaveMatch = async (req, res) => {
  try {
    const match = await MatchRequest.findById(req.params.id);
    if (!match) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy kèo giao lưu' });
    }

    const userIdStr = req.user._id.toString();
    const isCreator = match.creator_id.toString() === userIdStr;

    let systemText = '';
    if (isCreator && req.body.cancel_match) {
      match.status = 'cancelled';
      systemText = `⚠️ Chủ kèo ${req.user.full_name} đã hủy trận giao lưu này.`;
    } else {
      match.current_players = match.current_players.filter(
        (id) => id.toString() !== userIdStr
      );
      if (match.status === 'full' && match.current_players.length < match.max_players) {
        match.status = 'open';
      }
      systemText = `👋 ${req.user.full_name} đã rời khỏi nhóm giao lưu (${match.current_players.length}/${match.max_players}).`;
    }

    await match.save();

    const systemMsg = await Message.create({
      match_id: match._id,
      sender_id: req.user._id,
      sender_name: 'Hệ thống',
      content: systemText,
      message_type: 'system_event',
    });

    const populatedMatch = await MatchRequest.findById(match._id)
      .populate('creator_id', 'full_name avatar phone profile')
      .populate('current_players', 'full_name avatar profile');

    const io = req.app.get('io');
    if (io) {
      io.to(`match_${match._id}`).emit('receive_message', systemMsg);
      io.to(`match_${match._id}`).emit('match_updated', populatedMatch);
      io.emit('match_list_updated', populatedMatch);
    }

    return res.status(200).json({
      success: true,
      message: isCreator && req.body.cancel_match ? 'Đã hủy trận giao lưu' : 'Đã rời khỏi kèo giao lưu',
      match: populatedMatch,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: 'Lỗi khi rời kèo giao lưu',
      error: error.message,
    });
  }
};

// GET /api/matches/:id/messages
const getMatchMessages = async (req, res) => {
  try {
    const messages = await Message.find({ match_id: req.params.id })
      .populate('sender_id', 'full_name avatar profile')
      .sort({ created_at: 1 });

    return res.status(200).json({
      success: true,
      count: messages.length,
      messages,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: 'Lỗi khi tải tin nhắn phòng chat',
      error: error.message,
    });
  }
};

// POST /api/matches/:id/messages
const sendMatchMessage = async (req, res) => {
  try {
    const { content, client_temp_id } = req.body;
    if (!content || !content.trim()) {
      return res.status(400).json({
        success: false,
        message: 'Nội dung tin nhắn không được để trống',
      });
    }

    const msg = await Message.create({
      match_id: req.params.id,
      sender_id: req.user._id,
      sender_name: req.user.full_name,
      sender_avatar: req.user.avatar,
      content: content.trim(),
      message_type: 'text',
    });

    const populatedMsg = await Message.findById(msg._id).populate(
      'sender_id',
      'full_name avatar profile'
    );

    const payload = {
      ...populatedMsg.toObject(),
      client_temp_id: client_temp_id || null,
    };

    const io = req.app.get('io');
    if (io) {
      io.to(`match_${req.params.id}`).emit('receive_message', payload);
    }

    return res.status(201).json({
      success: true,
      message: payload,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: 'Lỗi khi gửi tin nhắn',
      error: error.message,
    });
  }
};

module.exports = {
  getMatches,
  getMatchById,
  createMatch,
  joinMatch,
  leaveMatch,
  getMatchMessages,
  sendMatchMessage,
};

