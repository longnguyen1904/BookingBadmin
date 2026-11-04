# SLIDE THUYẾT TRÌNH & BỘ CÂU HỎI VẤN ĐÁP BẢO VỆ PROJECT (SLOT 19)
**Đề tài:** Ứng dụng đặt sân và kết nối giao lưu thể thao cho người chơi cầu lông phong trào (**Badminton Booking**)

---

## PHẦN 1: DÀN Ý SLIDE THUYẾT TRÌNH (8 SLIDES SÚC TÍCH)

### Slide 1: Giới thiệu đề tài & Bài toán thực tế
- **Bối cảnh**: Phong trào cầu lông phát triển mạnh nhưng đặt sân thủ công qua điện thoại/Zalo dễ bị trùng lịch (**Double-booking**), người chơi lẻ thiếu đồng đội cùng trình độ.
- **Giải pháp Badminton Booking**: Ứng dụng di động tập trung kết hợp **Đặt sân thời gian thực (Real-time Slot Matrix)** và **Ghép trận giao lưu (Matchmaking & Room Chat)**.

### Slide 2: Kiến trúc hệ thống & Công nghệ sử dụng
- **Mobile Client**: React Native (Expo), TypeScript, React Navigation, AsyncStorage, WebView, QRCode SVG.
- **Backend & Real-time**: Node.js, Express.js (MVC), Socket.io, JWT Authentication, Bcryptjs.
- **Database**: MongoDB & Mongoose ODM (6 Collections: `Users`, `Courts`, `TimeSlots`, `Bookings`, `MatchRequests`, `Messages`).
- **Web Admin**: Tailwind CSS, Chart.js (Biểu đồ doanh thu & Occupancy Rate), HTML5-QRCode Scanner.

### Slide 3: Luồng 6 Màn hình Mobile App
1. **AuthScreen**: Đăng ký/Đăng nhập Regex, băm mật khẩu bcrypt, lưu JWT vào AsyncStorage, hồ sơ trình độ tay vợt.
2. **CourtScheduleScreen**: Lọc cụm sân, Calendar Strip 7 ngày, Ma trận khung giờ 05:00-23:00 với 3 màu (**Xanh lá: Trống**, **Vàng: Giữ chỗ 5p**, **Đỏ: Đã đặt**).
3. **CheckoutPaymentScreen**: Chọn dịch vụ đi kèm (thuê vợt, nước, cầu), đồng hồ đếm ngược 5:00 phút, thanh toán cọc VNPay/MoMo Sandbox qua WebView.
4. **MatchFeedScreen**: Bảng tin tìm đồng đội theo trình độ, khu vực, đăng kèo mới.
5. **MatchChatRoomScreen**: Phòng chat Socket.io theo Room `match_<id>`, thông báo tự động khi vào/rời kèo.
6. **BookingHistoryScreen**: Quản lý đơn đặt 3 tab, sinh **Vé điện tử QR Code**, hủy lịch (phạt cọc nếu < 4 tiếng), đánh giá sao.

### Slide 4: Điểm nhấn Kỹ thuật #1 - Xử lý Concurrency & Race Condition
- Bài toán: 2 người cùng bấm đặt 1 khung giờ ở cùng 1 thời điểm.
- Giải pháp: **Atomic Update** trong MongoDB (`TimeSlot.findOneAndUpdate({ _id: slotId, status: 'available' }, { $set: { status: 'locked' } })`) kết hợp khóa tạm 5 phút (`lock_expires_at`).

### Slide 5: Điểm nhấn Kỹ thuật #2 - Thanh toán VNPay/MoMo Sandbox & Vé QR
- Tạo chữ ký số bảo mật `HMAC-SHA512` (`vnp_SecureHash`) sắp xếp tham số theo bảng chữ cái.
- Sau khi `vnp_ResponseCode === '00'`, tự động chuyển slot sang `booked` (Màu Đỏ) và sinh mã QR Check-in.

### Slide 6: Demo Trực tiếp & Kết luận

---

## PHẦN 2: BỘ CÂU HỎI & TRẢ LỜI VẤN ĐÁP GHI ĐIỂM TUYỆT ĐỐI (MỐC 6 ĐIỂM)

### Câu 1: Làm thế nào hệ thống chống được việc 2 người cùng bấm đặt 1 sân ở cùng 1 giây (Race Condition)?
- **Trả lời**: Trong [`bookingController.js`](file:///d:/Semester7/MMA301/badminton_booking/backend/src/controllers/bookingController.js), em không dùng `findById` rồi mới `save()` (vì giữa 2 bước đó sẽ xảy ra Race Condition). Thay vào đó, em sử dụng câu lệnh **Atomic Update của MongoDB**:
  ```javascript
  TimeSlot.findOneAndUpdate(
    { _id: slotId, status: 'available' },
    { $set: { status: 'locked', locked_by: userId, lock_expires_at: lockExpiresAt } },
    { new: true }
  )
  ```
  MongoDB khóa cấp độ Document khi thực thi `findOneAndUpdate`. Do đó chỉ đúng 1 người nhận được document trả về, người thứ 2 nhận `null` và hệ thống lập tức trả mã HTTP `409 Conflict` kèm thông báo: *"Khung giờ này vừa có người nhanh tay chọn trước!"*.

### Câu 2: Nếu người dùng khóa slot (Màu Vàng) rồi tắt app không thanh toán thì sao?
- **Trả lời**: Khi khóa slot, trường `lock_expires_at` được gán bằng `Date.now() + 5 phút`.
  1. Trên Mobile App ([`CheckoutPaymentScreen.tsx`](file:///d:/Semester7/MMA301/badminton_booking/mobile/src/screens/CheckoutPaymentScreen.tsx)): Có bộ đếm ngược `05:00` về `00:00`, hết giờ tự gọi API `/api/bookings/:id/release`.
  2. Trên Backend ([`server.js`](file:///d:/Semester7/MMA301/badminton_booking/backend/src/server.js) & [`slotService.js`](file:///d:/Semester7/MMA301/badminton_booking/backend/src/services/slotService.js)): Có tiến trình chạy ngầm mỗi 15 giây (`releaseExpiredLocks`) quét toàn bộ các slot có `status === 'locked'` và `lock_expires_at <= now` để tự động trả về `'available'` (Màu Xanh lá) và bắn sự kiện `slot_status_changed` qua Socket.io cho tất cả client.

### Câu 3: Cơ chế đồng bộ màu sắc khung giờ và phòng Chat hoạt động như thế nào?
- **Trả lời**:
  - **Đồng bộ Slot**: Khi API `/api/bookings/lock-slot` hoặc `/api/payment/vnpay/return` đổi trạng thái slot, server gọi `io.emit('slot_status_changed', payload)`. Màn hình `CourtScheduleScreen` của các máy khác đang mở sẽ lắng nghe sự kiện này và cập nhật ngay state `slots` từ Xanh -> Vàng hoặc Đỏ mà không cần tải lại trang.
  - **Phòng Chat**: Khi người chơi mở kèo giao lưu, client gửi `socket.emit('join_match_room', { match_id })`, server đưa socket đó vào room riêng biệt `match_<id>`. Tin nhắn gửi đi chỉ phát trong phạm vi `io.to('match_<id>').emit('receive_message', msg)` và được lưu xuống collection `Messages` trong MongoDB.

