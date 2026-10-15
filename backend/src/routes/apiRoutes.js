const express = require('express');
const router = express.Router();

const { protect, requireAdmin } = require('../middleware/authMiddleware');
const authController = require('../controllers/authController');
const courtController = require('../controllers/courtController');
const bookingController = require('../controllers/bookingController');
const paymentController = require('../controllers/paymentController');
const matchController = require('../controllers/matchController');
const adminController = require('../controllers/adminController');

// 1. Auth Endpoints
router.post('/auth/register', authController.register);
router.post('/auth/login', authController.login);
router.get('/auth/me', protect, authController.getMe);
router.put('/auth/profile', protect, authController.updateProfile);

// 2. Courts & TimeSlots Endpoints
router.get('/courts', courtController.getCourts);
router.get('/courts/:id', courtController.getCourtById);
router.get('/courts/:id/slots', courtController.getCourtSlots);
router.post('/courts', protect, requireAdmin, courtController.createCourt);
router.put('/courts/:id', protect, requireAdmin, courtController.updateCourt);
router.delete('/courts/:id', protect, requireAdmin, courtController.deleteCourt);

// 3. Bookings & Concurrency Slot Locking Endpoints
router.post('/bookings/lock-slot', protect, bookingController.lockSlot);
router.get('/bookings/my-bookings', protect, bookingController.getMyBookings);
router.get('/bookings/:id', protect, bookingController.getBookingById);
router.post('/bookings/:id/release', protect, bookingController.releaseBookingSlot);
router.post('/bookings/:id/confirm', protect, bookingController.confirmBooking);
router.post('/bookings/:id/cancel', protect, bookingController.cancelBooking);
router.post('/bookings/:id/review', protect, bookingController.reviewBooking);

// 4. Payment Gateway (VNPay / MoMo Sandbox) Endpoints
router.post('/payment/vnpay/create-url', protect, paymentController.createPaymentUrl);
router.get('/payment/vnpay/sandbox-gateway', paymentController.renderSandboxGateway);
router.get('/payment/vnpay/return', paymentController.vnpayReturn);

// 5. Matchmaking & Real-time Chat Endpoints
router.get('/matches', matchController.getMatches);
router.get('/matches/:id', matchController.getMatchById);
router.post('/matches', protect, matchController.createMatch);
router.post('/matches/:id/join', protect, matchController.joinMatch);
router.post('/matches/:id/leave', protect, matchController.leaveMatch);
router.get('/matches/:id/messages', protect, matchController.getMatchMessages);
router.post('/matches/:id/messages', protect, matchController.sendMatchMessage);

// 6. Web Admin Analytics & QR Check-in Endpoints
router.get('/admin/analytics', protect, requireAdmin, adminController.getAnalytics);
router.post('/admin/checkin-qr', protect, requireAdmin, adminController.checkinQr);
router.put('/admin/bookings/:id/status', protect, requireAdmin, adminController.updateBookingStatus);

module.exports = router;

