const Message = require('../models/Message');

function initSocket(io) {
  io.on('connection', (socket) => {
    // 1. Tham gia phòng theo dõi lịch sân real-time
    socket.on('join_court_schedule', ({ court_id, date }) => {
      if (court_id) {
        socket.join(`court_${court_id}_${date || ''}`);
      }
    });

    // 2. Tham gia phòng Chat của trận đấu / kèo giao lưu (Room: match_<id>)
    socket.on('join_match_room', ({ match_id, user_name }) => {
      if (!match_id) return;
      const roomName = `match_${match_id}`;
      socket.join(roomName);
      socket.to(roomName).emit('user_online', {
        match_id,
        user_name: user_name || 'Thành viên',
        timestamp: new Date(),
      });
    });

    socket.on('leave_match_room', ({ match_id }) => {
      if (!match_id) return;
      socket.leave(`match_${match_id}`);
    });

    // 3. Gửi tin nhắn Real-time trong phòng chat trận đấu
    socket.on('send_message', async (payload, callback) => {
      try {
        const {
          match_id,
          sender_id,
          sender_name,
          sender_avatar,
          content,
          client_temp_id,
        } = payload || {};

        if (!match_id || !content || !content.trim()) return;

        const savedMsg = await Message.create({
          match_id,
          sender_id: sender_id || null,
          sender_name: sender_name || 'Tay vợt',
          sender_avatar: sender_avatar || '',
          content: content.trim(),
          message_type: 'text',
        });

        const populated = await Message.findById(savedMsg._id).populate(
          'sender_id',
          'full_name avatar profile'
        );

        const messageData = {
          ...populated.toObject(),
          client_temp_id: client_temp_id || null,
          delivery_status: 'sent',
        };

        io.to(`match_${match_id}`).emit('receive_message', messageData);

        if (typeof callback === 'function') {
          callback({ success: true, message: messageData });
        }
      } catch (err) {
        if (typeof callback === 'function') {
          callback({ success: false, error: err.message });
        }
      }
    });

    socket.on('typing', ({ match_id, user_name }) => {
      if (match_id) {
        socket.to(`match_${match_id}`).emit('user_typing', { match_id, user_name });
      }
    });

    socket.on('disconnect', () => {});
  });
}

module.exports = { initSocket };

