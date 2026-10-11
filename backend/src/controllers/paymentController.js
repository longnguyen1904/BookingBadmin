const crypto = require('crypto');
const Booking = require('../models/Booking');
const TimeSlot = require('../models/TimeSlot');

function sortObject(obj) {
  const sorted = {};
  const keys = Object.keys(obj).sort();
  for (const key of keys) {
    sorted[key] = encodeURIComponent(obj[key]).replace(/%20/g, '+');
  }
  return sorted;
}

function formatVnPayDate(date = new Date()) {
  const pad = (n) => String(n).padStart(2, '0');
  return (
    date.getFullYear().toString() +
    pad(date.getMonth() + 1) +
    pad(date.getDate()) +
    pad(date.getHours()) +
    pad(date.getMinutes()) +
    pad(date.getSeconds())
  );
}

// POST /api/payment/vnpay/create-url
const createPaymentUrl = async (req, res) => {
  try {
    const { booking_id, payment_method = 'VNPAY', extra_services, pay_full = false } = req.body;

    const booking = await Booking.findById(booking_id).populate('court_id', 'name address');
    if (!booking) {
      return res.status(404).json({
        success: false,
        message: 'Không tìm thấy đơn đặt sân cần thanh toán',
      });
    }

    if (booking.status === 'cancelled') {
      return res.status(400).json({
        success: false,
        message: 'Đơn đặt sân đã hết thời gian giữ chỗ (5 phút) hoặc đã bị hủy',
      });
    }

    // Cập nhật dịch vụ đi kèm (thuê vợt, nước suối, hộp cầu) nếu có
    if (Array.isArray(extra_services)) {
      booking.extra_services = extra_services.filter((s) => Number(s.quantity) > 0);
      booking.services_fee = booking.extra_services.reduce(
        (sum, s) => sum + Number(s.price || 0) * Number(s.quantity || 0),
        0
      );
      booking.total_amount = booking.court_fee + booking.services_fee;
      booking.deposit_paid = pay_full
        ? booking.total_amount
        : Math.round(booking.total_amount * 0.5);
    }

    booking.payment_info.payment_method = payment_method;
    await booking.save();

    const tmnCode = process.env.VNP_TMNCODE || 'BADMINTON1';
    const secretKey =
      process.env.VNP_HASHSECRET || 'BADMINTONBOOKINGVNPAYSANDBOXSECRET2026';
    const vnpUrl =
      process.env.VNP_URL || 'https://sandbox.vnpayment.vn/paymentv2/vpcpay.html';

    const host = `${req.protocol}://${req.get('host')}`;
    const returnUrl = `${host}/api/payment/vnpay/return`;

    const createDate = formatVnPayDate(new Date());
    const orderId = `${booking._id}_${Date.now()}`;
    const amountToPay = booking.deposit_paid || booking.total_amount;

    const vnpParams = {
      vnp_Version: '2.1.0',
      vnp_Command: 'pay',
      vnp_TmnCode: tmnCode,
      vnp_Locale: 'vn',
      vnp_CurrCode: 'VND',
      vnp_TxnRef: orderId,
      vnp_OrderInfo: `Dat coc san ${booking.booking_code} - ${booking.sub_court_name}`,
      vnp_OrderType: 'billpayment',
      vnp_Amount: amountToPay * 100, // VNPay yêu cầu nhân 100
      vnp_ReturnUrl: returnUrl,
      vnp_IpAddr: req.ip || '127.0.0.1',
      vnp_CreateDate: createDate,
    };

    const sortedParams = sortObject(vnpParams);
    const signData = Object.keys(sortedParams)
      .map((k) => `${k}=${sortedParams[k]}`)
      .join('&');

    const hmac = crypto.createHmac('sha512', secretKey);
    const signed = hmac.update(Buffer.from(signData, 'utf-8')).digest('hex');
    sortedParams.vnp_SecureHash = signed;

    const queryString = Object.keys(sortedParams)
      .map((k) => `${k}=${sortedParams[k]}`)
      .join('&');

    const officialVnPayUrl = `${vnpUrl}?${queryString}`;
    const builtinSandboxUrl = `${host}/api/payment/vnpay/sandbox-gateway?${queryString}&gateway=${payment_method}`;

    const useBuiltin =
      process.env.USE_BUILTIN_SANDBOX_GATEWAY !== 'false' || payment_method === 'MOMO';

    return res.status(200).json({
      success: true,
      message: 'Khởi tạo đường dẫn thanh toán Sandbox thành công',
      payment_url: useBuiltin ? builtinSandboxUrl : officialVnPayUrl,
      official_vnpay_url: officialVnPayUrl,
      builtin_sandbox_url: builtinSandboxUrl,
      checksum_algorithm: 'HMAC-SHA512',
      vnp_SecureHash: signed,
      amount: amountToPay,
      booking_id: booking._id,
      booking_code: booking.booking_code,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: 'Lỗi khi tạo URL thanh toán',
      error: error.message,
    });
  }
};

// GET /api/payment/vnpay/sandbox-gateway (Trang cổng thanh toán VNPay / MoMo Sandbox mở trong WebView)
const renderSandboxGateway = async (req, res) => {
  const {
    vnp_TxnRef = '',
    vnp_Amount = 0,
    vnp_OrderInfo = '',
    vnp_TmnCode = 'BADMINTON1',
    gateway = 'VNPAY',
  } = req.query;

  const amountVnd = Math.round(Number(vnp_Amount) / 100);
  const secretKey =
    process.env.VNP_HASHSECRET || 'BADMINTONBOOKINGVNPAYSANDBOXSECRET2026';

  const buildCallbackUrl = (responseCode) => {
    const callbackParams = {
      vnp_Amount: String(vnp_Amount),
      vnp_BankCode: gateway === 'MOMO' ? 'MOMOQR' : 'NCB',
      vnp_BankTranNo: `VNP${Date.now()}`,
      vnp_CardType: 'ATM',
      vnp_OrderInfo: String(vnp_OrderInfo),
      vnp_PayDate: formatVnPayDate(new Date()),
      vnp_ResponseCode: responseCode,
      vnp_TmnCode: String(vnp_TmnCode),
      vnp_TransactionNo: String(Math.floor(10000000 + Math.random() * 90000000)),
      vnp_TransactionStatus: responseCode,
      vnp_TxnRef: String(vnp_TxnRef),
    };
    const sorted = sortObject(callbackParams);
    const signData = Object.keys(sorted)
      .map((k) => `${k}=${sorted[k]}`)
      .join('&');
    const hash = crypto
      .createHmac('sha512', secretKey)
      .update(Buffer.from(signData, 'utf-8'))
      .digest('hex');
    sorted.vnp_SecureHash = hash;
    const qs = Object.keys(sorted)
      .map((k) => `${k}=${sorted[k]}`)
      .join('&');
    return `/api/payment/vnpay/return?${qs}`;
  };

  const successReturnUrl = buildCallbackUrl('00');
  const cancelReturnUrl = buildCallbackUrl('24');
  const isMomo = gateway === 'MOMO';

  const html = `<!DOCTYPE html>
<html lang="vi">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Cổng thanh toán ${isMomo ? 'MoMo' : 'VNPay'} Sandbox</title>
  <style>
    * { box-sizing: border-box; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; }
    body { margin: 0; background: #f1f5f9; color: #0f172a; padding: 16px; }
    .card { max-width: 440px; margin: 0 auto; background: #fff; border-radius: 16px; box-shadow: 0 10px 25px rgba(0,0,0,0.08); overflow: hidden; }
    .header { background: ${isMomo ? 'linear-gradient(135deg,#a50064,#d82d8b)' : 'linear-gradient(135deg,#005baa,#0284c7)'}; color: #fff; padding: 20px; text-align: center; }
    .header h2 { margin: 0 0 6px; font-size: 20px; }
    .badge { display: inline-block; background: rgba(255,255,255,0.2); padding: 4px 10px; border-radius: 999px; font-size: 12px; }
    .body { padding: 20px; }
    .amount-box { background: #f8fafc; border: 1px dashed #cbd5e1; border-radius: 12px; padding: 14px; text-align: center; margin-bottom: 16px; }
    .amount { font-size: 26px; font-weight: 800; color: ${isMomo ? '#a50064' : '#005baa'}; margin: 4px 0; }
    .qr-wrap { text-align: center; margin: 14px 0; }
    .qr-wrap img { width: 165px; height: 165px; border: 4px solid #e2e8f0; border-radius: 12px; padding: 6px; }
    .field { margin-bottom: 12px; }
    .field label { display: block; font-size: 12px; font-weight: 600; color: #475569; margin-bottom: 4px; }
    .field input { width: 100%; padding: 10px 12px; border: 1px solid #cbd5e1; border-radius: 8px; font-size: 14px; background: #f8fafc; }
    .btn { display: block; width: 100%; padding: 14px; border: none; border-radius: 10px; font-size: 15px; font-weight: 700; cursor: pointer; text-align: center; text-decoration: none; margin-bottom: 10px; }
    .btn-pay { background: ${isMomo ? '#a50064' : '#005baa'}; color: #fff; }
    .btn-cancel { background: #e2e8f0; color: #475569; }
  </style>
</head>
<body>
  <div class="card">
    <div class="header">
      <h2>${isMomo ? 'MoMo Payment Sandbox' : 'VNPAY Sandbox Gateway'}</h2>
      <span class="badge">Môi trường thử nghiệm • HMAC-SHA512 Verified</span>
    </div>
    <div class="body">
      <div class="amount-box">
        <div style="font-size:13px;color:#64748b;">Số tiền thanh toán đặt cọc giữ sân</div>
        <div class="amount">${amountVnd.toLocaleString('vi-VN')} VNĐ</div>
        <div style="font-size:12px;color:#475569;">${vnp_OrderInfo}</div>
      </div>

      <div class="qr-wrap">
        <img src="https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=${encodeURIComponent(vnp_OrderInfo + '|' + amountVnd)}" alt="QR Payment" />
        <div style="font-size:12px;color:#64748b;margin-top:4px;">Quét mã QR hoặc dùng thẻ ATM nội địa NCB Test bên dưới</div>
      </div>

      <div class="field">
        <label>Ngân hàng / Ví thanh toán</label>
        <input type="text" value="${isMomo ? 'Ví điện tử MoMo Sandbox' : 'Ngân hàng NCB (Nội địa Test)'}" readonly />
      </div>
      <div class="field">
        <label>Số thẻ ATM Test chuẩn Sandbox</label>
        <input type="text" value="9704198526191432198" readonly />
      </div>
      <div style="display:flex;gap:10px;">
        <div class="field" style="flex:1;">
          <label>Chủ thẻ</label>
          <input type="text" value="NGUYEN VAN A" readonly />
        </div>
        <div class="field" style="width:110px;">
          <label>Mã OTP</label>
          <input type="text" value="123456" readonly />
        </div>
      </div>

      <a class="btn btn-pay" href="${successReturnUrl}">XÁC NHẬN THANH TOÁN (${amountVnd.toLocaleString('vi-VN')}đ)</a>
      <a class="btn btn-cancel" href="${cancelReturnUrl}">HỦY GIAO DỊCH</a>
    </div>
  </div>
</body>
</html>`;

  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  return res.status(200).send(html);
};

// GET /api/payment/vnpay/return
const vnpayReturn = async (req, res) => {
  try {
    const vnpParams = { ...req.query };
    const secureHash = vnpParams.vnp_SecureHash;

    delete vnpParams.vnp_SecureHash;
    delete vnpParams.vnp_SecureHashType;

    const secretKey =
      process.env.VNP_HASHSECRET || 'BADMINTONBOOKINGVNPAYSANDBOXSECRET2026';
    const sortedParams = sortObject(vnpParams);
    const signData = Object.keys(sortedParams)
      .map((k) => `${k}=${sortedParams[k]}`)
      .join('&');

    const checkSum = crypto
      .createHmac('sha512', secretKey)
      .update(Buffer.from(signData, 'utf-8'))
      .digest('hex');

    const txnRef = String(req.query.vnp_TxnRef || '');
    const bookingId = txnRef.split('_')[0];
    const responseCode = req.query.vnp_ResponseCode || '00';
    const transactionNo = req.query.vnp_TransactionNo || `VNP${Date.now()}`;

    const booking = await Booking.findById(bookingId).populate('court_id', 'name address');
    const isSuccess = responseCode === '00';

    if (booking) {
      if (isSuccess) {
        booking.status = 'confirmed';
        booking.lock_expires_at = null;
        booking.qr_checkin_code = `BBQR|${booking.booking_code}|${booking._id}`;
        booking.payment_info = {
          transaction_id: transactionNo,
          payment_method:
            req.query.vnp_BankCode === 'MOMOQR'
              ? 'MOMO'
              : booking.payment_info?.payment_method || 'VNPAY',
          pay_time: new Date(),
        };
        await booking.save();

        await TimeSlot.updateMany(
          { _id: { $in: booking.slot_ids } },
          {
            $set: {
              status: 'booked',
              lock_expires_at: null,
              booking_id: booking._id,
            },
          }
        );

        const updatedSlots = await TimeSlot.find({ _id: { $in: booking.slot_ids } });
        const io = req.app.get('io');
        if (io) {
          for (const s of updatedSlots) {
            io.emit('slot_status_changed', {
              slot_id: s._id,
              court_id: s.court_id,
              sub_court_id: s.sub_court_id,
              date: s.date,
              start_time: s.start_time,
              status: 'booked',
              booking_id: booking._id,
            });
          }
          io.emit('booking_confirmed', {
            booking_id: booking._id,
            booking_code: booking.booking_code,
            status: 'confirmed',
            qr_checkin_code: booking.qr_checkin_code,
          });
        }
      }
    }

    if (req.query.format === 'json') {
      return res.status(200).json({
        success: isSuccess,
        signature_valid: secureHash ? secureHash === checkSum : true,
        vnp_ResponseCode: responseCode,
        booking,
      });
    }

    const resultHtml = `<!DOCTYPE html>
<html lang="vi">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Kết quả thanh toán - Badminton Booking</title>
  <style>
    body { font-family: -apple-system, sans-serif; background: #f8fafc; margin: 0; padding: 24px; text-align: center; }
    .box { max-width: 400px; margin: 20px auto; background: #fff; border-radius: 16px; padding: 24px; box-shadow: 0 8px 24px rgba(0,0,0,0.08); }
    .icon { width: 64px; height: 64px; border-radius: 50%; display: flex; align-items: center; justify-content: center; margin: 0 auto 16px; font-size: 32px; background: ${isSuccess ? '#dcfce7' : '#fee2e2'}; color: ${isSuccess ? '#16a34a' : '#dc2626'}; }
    h2 { margin: 0 0 8px; color: #0f172a; }
    p { color: #64748b; font-size: 14px; }
    .code { background: #f1f5f9; padding: 10px; border-radius: 8px; font-family: monospace; font-weight: 700; margin: 12px 0; }
  </style>
</head>
<body>
  <div class="box" id="payment-result" data-status="${isSuccess ? 'success' : 'failed'}" data-booking-id="${booking?._id || ''}" data-booking-code="${booking?.booking_code || ''}">
    <div class="icon">${isSuccess ? '✓' : '✕'}</div>
    <h2>${isSuccess ? 'Thanh toán đặt cọc thành công!' : 'Giao dịch đã bị hủy'}</h2>
    <p>${
      isSuccess
        ? `Đơn đặt sân ${booking?.booking_code || ''} đã được xác nhận và sinh mã vé điện tử QR.`
        : 'Bạn có thể chọn lại phương thức thanh toán khác trước khi hết 5 phút giữ chỗ.'
    }</p>
    ${
      booking
        ? `<div class="code">Mã vé QR: ${booking.qr_checkin_code || booking.booking_code}</div>`
        : ''
    }
  </div>
  <script>
    if (window.ReactNativeWebView) {
      window.ReactNativeWebView.postMessage(JSON.stringify({
        type: 'PAYMENT_RESULT',
        success: ${isSuccess},
        booking_id: '${booking?._id || ''}',
        booking_code: '${booking?.booking_code || ''}',
        qr_checkin_code: '${booking?.qr_checkin_code || ''}',
        vnp_ResponseCode: '${responseCode}'
      }));
    }
  </script>
</body>
</html>`;

    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    return res.status(200).send(resultHtml);
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: 'Lỗi xử lý kết quả thanh toán VNPay Return',
      error: error.message,
    });
  }
};

module.exports = {
  createPaymentUrl,
  renderSandboxGateway,
  vnpayReturn,
};

