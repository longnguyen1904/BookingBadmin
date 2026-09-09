# SƠ ĐỒ THIẾT KẾ CƠ SỞ DỮ LIỆU MONGODB (ERD) - Badminton Booking

## 1. Sơ đồ quan hệ thực thể (Entity-Relationship Diagram)

```mermaid
erDiagram
    USERS ||--o{ BOOKINGS : "places (user_id)"
    USERS ||--o{ MATCH_REQUESTS : "creates (creator_id)"
    USERS ||--o{ MESSAGES : "sends (sender_id)"
    USERS ||--o{ TIME_SLOTS : "locks (locked_by)"
    COURTS ||--|{ SUB_COURTS : "embeds"
    COURTS ||--o{ TIME_SLOTS : "has (court_id)"
    COURTS ||--o{ BOOKINGS : "hosts (court_id)"
    BOOKINGS ||--|{ TIME_SLOTS : "reserves (booking_id)"
    BOOKINGS ||--o| MATCH_REQUESTS : "links (booking_id)"
    MATCH_REQUESTS ||--o{ MESSAGES : "contains (match_id)"

    USERS {
        ObjectId _id PK
        String full_name
        String email UK
        String password_hash
        String phone
        String avatar
        String role "user | court_owner | admin"
        Object profile "skill_level, dominant_hand, preferred_play"
        Date created_at
        Date updated_at
    }

    COURTS {
        ObjectId _id PK
        String name
        String address
        String district
        String city
        Array images
        String open_time "05:00"
        String close_time "23:00"
        Number hourly_rate
        Number peak_hour_rate "Khung giờ vàng 17:00-21:00"
        String carpet_type "Thảm PVC | Thảm Yonex | Thảm Enlio | Sàn gỗ"
        String court_type "indoor | outdoor"
        Array amenities
        Array extra_services "Thuê vợt, nước suối, hộp cầu"
        Array sub_courts "sub_court_id, court_number, is_active"
        Number rating_avg
        Number rating_count
        Array reviews
    }

    TIME_SLOTS {
        ObjectId _id PK
        ObjectId court_id FK
        ObjectId sub_court_id
        String sub_court_name
        String date "YYYY-MM-DD"
        String start_time "05:00 .. 22:00"
        String end_time "06:00 .. 23:00"
        Number price
        Boolean is_peak_hour
        String status "available (Xanh) | locked (Vàng) | booked (Đỏ)"
        ObjectId locked_by FK
        Date lock_expires_at "Hết hạn sau 5 phút"
        ObjectId booking_id FK
    }

    BOOKINGS {
        ObjectId _id PK
        String booking_code UK "BB-YYYYMMDD-XXXX"
        ObjectId user_id FK
        ObjectId court_id FK
        ObjectId sub_court_id
        String sub_court_name
        String booking_date "YYYY-MM-DD"
        String start_time
        String end_time
        Array slots
        Array slot_ids
        Array extra_services
        Number total_amount
        Number deposit_paid
        String status "locked_pending | confirmed | completed | cancelled"
        Date lock_expires_at
        Object payment_info "transaction_id, payment_method, pay_time"
        String qr_checkin_code
        Date checked_in_at
        Number penalty_amount
    }

    MATCH_REQUESTS {
        ObjectId _id PK
        ObjectId creator_id FK
        ObjectId booking_id FK
        ObjectId court_id FK
        String title
        String location_name
        String district
        String scheduled_date
        Date scheduled_time
        String required_level "beginner | intermediate | advanced | pro"
        Number max_players
        Array current_players "Array<ObjectId Ref Users>"
        Number cost_per_person
        String status "open | full | cancelled"
    }

    MESSAGES {
        ObjectId _id PK
        ObjectId match_id FK
        ObjectId sender_id FK
        String sender_name
        String content
        String message_type "text | system_event"
        Date created_at
    }
```

---

## 2. Giải thích kỹ thuật xử lý Concurrency (Atomic Slot Locking)

- **Unique Compound Index trên `TimeSlots`**: `{ court_id: 1, sub_court_id: 1, date: 1, start_time: 1 }` đảm bảo không bao giờ sinh trùng 2 bản ghi cho cùng 1 khung giờ của 1 sân con.
- **Câu lệnh Atomic Update chống Race Condition**:
  ```javascript
  const lockedSlot = await TimeSlot.findOneAndUpdate(
    { _id: slotId, status: 'available' },
    {
      $set: {
        status: 'locked',
        locked_by: userId,
        lock_expires_at: new Date(Date.now() + 5 * 60 * 1000)
      }
    },
    { new: true }
  );
  ```
- Nếu 2 người chơi cùng bấm đặt 1 khung giờ ở cùng 1 mili-giây, MongoDB đảm bảo tính nguyên tử (Atomicity) ở mức document: chỉ 1 request nhận được `lockedSlot`, request còn lại nhận `null` và trả về ngay thông báo: **"Khung giờ này vừa có người nhanh tay chọn trước!"**.

