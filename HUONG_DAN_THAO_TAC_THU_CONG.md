# HƯỚNG DẪN CHẠY DỰ ÁN & CÁC THAO TÁC THỦ CÔNG BẠN CẦN LÀM

Toàn bộ source code **Backend (Node.js/Express + MongoDB + Socket.io)**, **Web Admin Dashboard**, **Mobile App (React Native Expo + TypeScript - 6 màn hình)**, **Sơ đồ ERD**, **Postman Collection**, và **Cấu hình `eas.json`** đã được triển khai hoàn chỉnh 100%.

Dưới đây là hướng dẫn chạy nhanh và danh sách **những thao tác tôi không thể tự làm thay bạn** (do cần tài khoản cá nhân hoặc thiết bị vật lý của bạn).

---

## I. CÁCH CHẠY HỆ THỐNG NGAY TRÊN MÁY CỦA BẠN

### 1. Chạy Backend API + Socket.io + Web Admin Dashboard
Mở terminal tại thư mục `backend`:
```powershell
cd d:\Semester7\MMA301\badminton_booking\backend
npm run seed   # (Tùy chọn) Reset và tạo lại dữ liệu mẫu tiếng Việt
npm start      # Chạy server tại http://localhost:5000
```
- **Web Admin Dashboard**: Mở trình duyệt vào `http://localhost:5000/admin`
  - Tài khoản Admin mặc định (tự động điền sẵn): `admin@badmintonbooking.vn` / Mật khẩu: `123456`
- **Tài khoản Người chơi Mobile (Seed sẵn)**:
  - User 1: `quan@gmail.com` / `123456`
  - User 2: `nam@gmail.com` / `123456`

### 2. Chạy Mobile App (React Native Expo)
Mở terminal mới tại thư mục `mobile`:
```powershell
cd d:\Semester7\MMA301\badminton_booking\mobile
npx expo start
```
- Nhấn `a` để mở trên máy ảo Android, `w` để mở trên trình duyệt Web, hoặc dùng app **Expo Go** trên điện thoại Android/iOS quét mã QR trên màn hình terminal.
- **Lưu ý IP LAN**: File [`api.ts`](file:///d:/Semester7/MMA301/badminton_booking/mobile/src/config/api.ts) đã được cấu hình sẵn IP LAN hiện tại của máy bạn (`http://10.33.90.116:5000`) và tự động fallback về `http://10.0.2.2:5000` (máy ảo Android) hoặc `http://localhost:5000`. Bạn cũng có thể đổi IP trực tiếp ngay trên màn hình Đăng nhập của App.

---

## II. CÁC THAO TÁC BẠN CẦN TỰ THỰC HIỆN (DO CẦN TÀI KHOẢN / THIẾT BỊ CÁ NHÂN)

### 1. Đăng nhập tài khoản Expo & Xuất file `.apk` (Yêu cầu Slot 18)
File [`mobile/eas.json`](file:///d:/Semester7/MMA301/badminton_booking/mobile/eas.json) và [`mobile/app.json`](file:///d:/Semester7/MMA301/badminton_booking/mobile/app.json) đã được cấu hình sẵn `"buildType": "apk"`. Bạn chỉ cần mở terminal và chạy 3 lệnh sau bằng tài khoản Expo của bạn:
```powershell
cd d:\Semester7\MMA301\badminton_booking\mobile
npm install -g eas-cli
eas login
eas build -p android --profile preview
```
- Khi được hỏi *Generate a new Android Keystore?*, bạn chọn **`Y` (Yes)**.
- Đợi khoảng 10 - 15 phút để Expo Cloud đóng gói xong, hệ thống sẽ trả về đường link tải trực tiếp file `.apk` để bạn cài vào điện thoại Android thật và nộp lên Google Classroom.

### 2. Cài đặt Git & Đẩy Source Code lên GitHub cá nhân
Máy của bạn hiện chưa cài đặt `git` trong PATH. Để nộp link GitHub:
1. Tải và cài Git tại: https://git-scm.com/download/win
2. Mở terminal tại `d:\Semester7\MMA301\badminton_booking` và chạy:
```powershell
git init
git add .
git commit -m "Initial commit: Fullstack Badminton Booking Mobile, Backend & Web Admin"
git branch -M main
git remote add origin https://github.com/<ten-tai-khoan-cua-ban>/badminton-booking.git
git push -u origin main
```

### 3. (Tùy chọn) Chuyển từ MongoDB Local sang MongoDB Atlas Cloud
- Hiện tại hệ thống đang kết nối và chạy mượt trên dịch vụ **MongoDB Local** sẵn có trên máy bạn (`mongodb://127.0.0.1:27017/badminton_booking`).
- Nếu giảng viên yêu cầu dùng **MongoDB Atlas (Cloud)**:
  1. Đăng nhập https://cloud.mongodb.com, tạo Cluster miễn phí (M0) và lấy chuỗi kết nối `mongodb+srv://...`
  2. Dán chuỗi đó vào biến `MONGODB_URI` trong file [`backend/.env`](file:///d:/Semester7/MMA301/badminton_booking/backend/.env) rồi chạy lại `npm run seed`.

### 4. (Tùy chọn) Thay Key VNPay Sandbox cá nhân
- Hiện tại cổng thanh toán trong [`paymentController.js`](file:///d:/Semester7/MMA301/badminton_booking/backend/src/controllers/paymentController.js) đã cài sẵn thuật toán băm chuẩn `HMAC-SHA512` của VNPay và tích hợp sẵn **Cổng VNPay/MoMo Sandbox nội bộ** (`USE_BUILTIN_SANDBOX_GATEWAY=true`) có sẵn mã QR và thẻ NCB test `9704198526191432198` để bạn mở WebView thanh toán thành công 100% không lo lỗi mạng.
- Nếu muốn chuyển hướng sang trang `https://sandbox.vnpayment.vn/paymentv2/vpcpay.html` bằng tài khoản riêng của bạn, hãy điền `VNP_TMNCODE`, `VNP_HASHSECRET` của bạn vào [`backend/.env`](file:///d:/Semester7/MMA301/badminton_booking/backend/.env) và đổi `USE_BUILTIN_SANDBOX_GATEWAY=false`.

### 5. Quay Video Demo YouTube & Nộp bài (Slot 18 - 19)
- Mở song song **Web Admin Dashboard** (`http://localhost:5000/admin`) và **Mobile App** để quay cảnh:
  1. Chọn khung giờ trống (Màu Xanh) -> Bấm Giữ chỗ 5 phút -> Slot đổi sang **Màu Vàng** ngay lập tức theo thời gian thực.
  2. Chọn thêm dịch vụ (thuê vợt, nước, cầu) -> Thanh toán cọc qua WebView VNPay/MoMo Sandbox -> Slot đổi sang **Màu Đỏ** và sinh **Vé điện tử QR Code**.
  3. Dùng Web Admin quét/nhập mã QR để Check-in -> Doanh thu & Tỷ lệ lấp đầy sân trên biểu đồ tự động tăng lên.
  4. Tham gia kèo giao lưu & Nhắn tin Real-time trong phòng Chat `match_<id>`.

