# Badminton Booking - Hệ Thống Đặt Sân Cầu Lông & Ghép Trận Giao Lưu

**Nền tảng:** React Native (Expo + TypeScript) + Node.js/Express (REST API + Socket.io) + MongoDB + Web Admin Dashboard

## Cấu trúc thư mục dự án (`badminton_booking`)

- `backend/`: Server Node.js/Express, Mongoose Models (`Users`, `Courts`, `TimeSlots`, `Bookings`, `MatchRequests`, `Messages`), Socket.io Real-time, Cổng thanh toán VNPay/MoMo Sandbox, Web Admin Dashboard (`/admin`) và dữ liệu JSON mẫu (`backend/import-json/`).
- `mobile/`: Ứng dụng di động React Native (Expo + TypeScript) gồm 6 màn hình chính (`AuthScreen`, `CourtScheduleScreen`, `CheckoutPaymentScreen`, `MatchFeedScreen`, `MatchChatRoomScreen`, `BookingHistoryScreen`) và cấu hình `eas.json` xuất file `.apk`.
- `docs/`: Sơ đồ ERD Database (`ERD_Database_Schema.md`), Postman Collection (`BadmintonBooking.postman_collection.json`), và Slide thuyết trình + Câu hỏi vấn đáp (`Slide_Thuyet_Trinh_Va_Cau_Hoi_Van_Dap.md`).
- `HUONG_DAN_THAO_TAC_THU_CONG.md`: Hướng dẫn chạy hệ thống và các bước đăng nhập Expo build APK / đẩy GitHub.
