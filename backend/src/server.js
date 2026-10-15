require('dotenv').config();
const path = require('path');
const http = require('http');
const express = require('express');
const cors = require('cors');
const mongoose = require('mongoose');
const { Server } = require('socket.io');

const apiRoutes = require('./routes/apiRoutes');
const { initSocket } = require('./socket/socketHandler');
const { releaseExpiredLocks } = require('./services/slotService');
const Court = require('./models/Court');
const { seedDatabase } = require('./seed/seedData');

const app = express();
const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST', 'PUT', 'DELETE'],
  },
});

app.set('io', io);
initSocket(io);

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Phục vụ Web Admin Dashboard tại /admin và trang chủ /
app.use('/admin', express.static(path.join(__dirname, '../public/admin')));
app.get('/', (req, res) => {
  res.redirect('/admin');
});

// Hệ thống RESTful API
app.use('/api', apiRoutes);

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    service: 'Badminton Booking Backend API & Socket.io',
    timestamp: new Date(),
  });
});

const PORT = process.env.PORT || 5000;
const MONGODB_URI =
  process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/badminton_booking';

async function startServer() {
  try {
    await mongoose.connect(MONGODB_URI);
    console.log('✅ Đã kết nối MongoDB thành công:', MONGODB_URI);

    // Tự động khởi tạo dữ liệu mẫu nếu database đang trống
    const courtCount = await Court.countDocuments();
    if (courtCount === 0) {
      console.log('🌱 Database đang trống, đang tự động khởi tạo dữ liệu mẫu Badminton Booking...');
      await seedDatabase(false);
    }

    // Background worker giải phóng các slot khóa quá 5 phút mỗi 15 giây
    setInterval(() => {
      releaseExpiredLocks(io).catch(() => {});
    }, 15000);

    server.listen(PORT, '0.0.0.0', () => {
      console.log(`🚀 Server Badminton Booking đang chạy tại: http://localhost:${PORT}`);
      console.log(`📊 Web Admin Dashboard: http://localhost:${PORT}/admin`);
      console.log(`🔌 RESTful API Base URL: http://localhost:${PORT}/api`);
    });
  } catch (error) {
    console.error('❌ Không thể kết nối MongoDB:', error.message);
    process.exit(1);
  }
}

startServer();
