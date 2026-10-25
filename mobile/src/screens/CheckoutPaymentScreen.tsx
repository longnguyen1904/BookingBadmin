import React, { useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Modal,
  Alert,
  ActivityIndicator,
  Platform,
} from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import { WebView } from 'react-native-webview';
import { apiRequest } from '../config/api';
import { Booking, Court, ExtraService } from '../types/models';

const DEFAULT_SERVICES: ExtraService[] = [
  { service_id: 'racket_rental', name: 'Thuê vợt cầu lông Yonex', price: 35000, unit: 'cây', quantity: 0 },
  { service_id: 'water_bottle', name: 'Nước suối Aquafina 500ml', price: 10000, unit: 'chai', quantity: 0 },
  { service_id: 'shuttlecock_tube', name: 'Hộp cầu lông Hải Yến S90', price: 220000, unit: 'hộp', quantity: 0 },
  { service_id: 'grip_tape', name: 'Quấn cán vợt chống trơn', price: 15000, unit: 'cái', quantity: 0 },
];

export const CheckoutPaymentScreen: React.FC = () => {
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const booking: Booking = route.params?.booking;
  const court: Court = route.params?.court || booking?.court_id;

  const [secondsLeft, setSecondsLeft] = useState<number>(() => {
    if (booking?.lock_expires_at) {
      const diff = Math.floor(
        (new Date(booking.lock_expires_at).getTime() - Date.now()) / 1000
      );
      return diff > 0 ? diff : 300;
    }
    return 300; // 5:00 phút
  });

  const [services, setServices] = useState<ExtraService[]>(() => {
    const source =
      court?.extra_services && court.extra_services.length > 0
        ? court.extra_services
        : DEFAULT_SERVICES;
    return source.map((s) => ({ ...s, quantity: 0 }));
  });

  const [paymentMethod, setPaymentMethod] = useState<'VNPAY' | 'MOMO' | 'CASH'>('VNPAY');
  const [processing, setProcessing] = useState(false);
  const [webViewUrl, setWebViewUrl] = useState<string | null>(null);

  // Hẹn giờ đếm ngược giữ chỗ (Slot Lock Countdown: 5:00 phút)
  useEffect(() => {
    const timer = setInterval(() => {
      setSecondsLeft((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          handleExpireSlot();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const handleExpireSlot = async () => {
    if (!booking?._id) return;
    try {
      await apiRequest(`/api/bookings/${booking._id}/release`, {
        method: 'POST',
        body: JSON.stringify({
          reason: 'Hết thời gian đếm ngược giữ chỗ 5:00 phút',
        }),
      });
    } catch (_) {}
    Alert.alert(
      'Hết thời gian giữ chỗ (5:00 phút)',
      'Khung giờ đã tự động giải phóng về màu xanh lá. Vui lòng chọn lại khung giờ!',
      [{ text: 'Quay lại chọn sân', onPress: () => navigation.goBack() }]
    );
  };

  const handleReleaseAndGoBack = async () => {
    if (booking?._id) {
      try {
        await apiRequest(`/api/bookings/${booking._id}/release`, {
          method: 'POST',
          body: JSON.stringify({ reason: 'Người dùng quay lại màn hình chọn sân' }),
        });
      } catch (_) {}
    }
    navigation.goBack();
  };

  const updateServiceQty = (serviceId: string, delta: number) => {
    setServices((prev) =>
      prev.map((item) =>
        item.service_id === serviceId
          ? { ...item, quantity: Math.max(0, (item.quantity || 0) + delta) }
          : item
      )
    );
  };

  const courtFee = booking?.court_fee || 180000;
  const servicesFee = useMemo(
    () =>
      services.reduce(
        (sum, s) => sum + (s.price || 0) * (s.quantity || 0),
        0
      ),
    [services]
  );
  const totalAmount = courtFee + servicesFee;
  const depositAmount = Math.round(totalAmount * 0.5);

  const formattedCountdown = useMemo(() => {
    const m = Math.floor(secondsLeft / 60);
    const s = secondsLeft % 60;
    return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  }, [secondsLeft]);

  const handleProceedPayment = async () => {
    if (!booking?._id) return;
    const selectedServices = services.filter((s) => (s.quantity || 0) > 0);

    try {
      setProcessing(true);

      // Nếu chọn Thanh toán tại sân (CASH) -> Xác nhận trực tiếp và sinh vé QR
      if (paymentMethod === 'CASH') {
        const res = await apiRequest(`/api/bookings/${booking._id}/confirm`, {
          method: 'POST',
          body: JSON.stringify({
            extra_services: selectedServices,
            payment_method: 'CASH',
          }),
        });
        setProcessing(false);
        if (res.success) {
          Alert.alert(
            'Đặt sân thành công!',
            `Mã đơn ${res.booking.booking_code} đã được xác nhận và tạo vé QR điện tử.`,
            [
              {
                text: 'Xem Vé QR Điện Tử',
                onPress: () =>
                  navigation.navigate('MainTabs', { screen: 'BookingHistory' }),
              },
            ]
          );
        } else {
          Alert.alert('Lỗi', res.message);
        }
        return;
      }

      // Nếu chọn VNPay Sandbox hoặc MoMo Sandbox -> Sinh URL checksum & Mở WebView
      const res = await apiRequest('/api/payment/vnpay/create-url', {
        method: 'POST',
        body: JSON.stringify({
          booking_id: booking._id,
          payment_method: paymentMethod,
          extra_services: selectedServices,
        }),
      });
      setProcessing(false);

      if (!res.success || !res.payment_url) {
        Alert.alert('Lỗi cổng thanh toán', res.message || 'Không tạo được URL thanh toán');
        return;
      }

      // Trên nền tảng Web, mở cửa sổ thanh toán hoặc xác nhận nhanh
      if (Platform.OS === 'web') {
        window.open(res.payment_url, '_blank');
      }
      setWebViewUrl(res.payment_url);
    } catch (error: any) {
      setProcessing(false);
      Alert.alert('Lỗi thanh toán', error.message);
    }
  };

  const handlePaymentSuccessRedirect = () => {
    setWebViewUrl(null);
    Alert.alert(
      '🎉 Thanh toán đặt cọc thành công!',
      'Slot sân đã chuyển sang màu Đỏ (Đã đặt) và Vé điện tử QR đã sẵn sàng để Check-in.',
      [
        {
          text: 'Mở Vé Điện Tử QR',
          onPress: () =>
            navigation.navigate('MainTabs', { screen: 'BookingHistory' }),
        },
      ]
    );
  };

  const handleWebViewNavChange = (navState: any) => {
    const url: string = navState?.url || '';
    if (url.includes('/api/payment/vnpay/return')) {
      if (url.includes('vnp_ResponseCode=00')) {
        setTimeout(() => {
          handlePaymentSuccessRedirect();
        }, 1200);
      } else if (url.includes('vnp_ResponseCode=24')) {
        setTimeout(() => {
          setWebViewUrl(null);
          Alert.alert(
            'Đã hủy giao dịch',
            'Bạn đã hủy thao tác trên cổng thanh toán. Bạn vẫn có thể chọn lại phương thức khác trong thời gian giữ chỗ.'
          );
        }, 800);
      }
    }
  };

  return (
    <View style={styles.container}>
      {/* Thanh đếm ngược giữ chỗ 5:00 phút */}
      <View
        style={[
          styles.countdownBanner,
          secondsLeft <= 60 && { backgroundColor: '#DC2626' },
        ]}
      >
        <Text style={styles.countdownTitle}>
          ⏳ Thời gian giữ chỗ tạm thời (Slot Lock Countdown):
        </Text>
        <Text style={styles.countdownTimer}>{formattedCountdown}</Text>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* 1. Tóm tắt thông tin đặt sân */}
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>📋 Thông tin đơn vị đặt sân</Text>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Mã đơn giữ chỗ:</Text>
            <Text style={styles.infoValue}>{booking?.booking_code}</Text>
          </View>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Cụm sân:</Text>
            <Text style={styles.infoValue}>{court?.name || 'Sân Cầu Lông'}</Text>
          </View>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Sân con:</Text>
            <Text style={styles.infoHighlight}>{booking?.sub_court_name}</Text>
          </View>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Ngày thi đấu:</Text>
            <Text style={styles.infoValue}>{booking?.booking_date}</Text>
          </View>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Khung giờ đã khóa:</Text>
            <Text style={styles.infoHighlight}>
              {booking?.start_time} - {booking?.end_time} ({booking?.slots?.length || 1}h)
            </Text>
          </View>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Tiền thuê sân:</Text>
            <Text style={styles.infoValue}>
              {courtFee.toLocaleString('vi-VN')} VNĐ
            </Text>
          </View>
        </View>

        {/* 2. Dịch vụ đi kèm (Thuê vợt, mua nước suối, mua hộp cầu) */}
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>
            🎒 Dịch vụ đi kèm (Thuê vợt, Nước suối, Hộp cầu)
          </Text>
          {services.map((srv) => (
            <View key={srv.service_id} style={styles.serviceRow}>
              <View style={{ flex: 1 }}>
                <Text style={styles.serviceName}>{srv.name}</Text>
                <Text style={styles.servicePrice}>
                  {srv.price.toLocaleString('vi-VN')}đ / {srv.unit}
                </Text>
              </View>
              <View style={styles.qtyControl}>
                <TouchableOpacity
                  style={styles.qtyBtn}
                  onPress={() => updateServiceQty(srv.service_id, -1)}
                >
                  <Text style={styles.qtyBtnText}>−</Text>
                </TouchableOpacity>
                <Text style={styles.qtyValue}>{srv.quantity || 0}</Text>
                <TouchableOpacity
                  style={[styles.qtyBtn, styles.qtyBtnPlus]}
                  onPress={() => updateServiceQty(srv.service_id, 1)}
                >
                  <Text style={[styles.qtyBtnText, { color: '#fff' }]}>+</Text>
                </TouchableOpacity>
              </View>
            </View>
          ))}
        </View>

        {/* 3. Lựa chọn hình thức thanh toán */}
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>💳 Chọn phương thức thanh toán</Text>

          <TouchableOpacity
            style={[
              styles.payMethodOption,
              paymentMethod === 'VNPAY' && styles.payMethodActive,
            ]}
            onPress={() => setPaymentMethod('VNPAY')}
          >
            <View style={styles.radioDot}>
              {paymentMethod === 'VNPAY' && <View style={styles.radioInner} />}
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.payMethodTitle}>
                Cổng VNPay QR / ATM Nội Địa (Sandbox)
              </Text>
              <Text style={styles.payMethodDesc}>
                Mở WebView quét mã QR hoặc nhập thẻ NCB Test (Đặt cọc 50%)
              </Text>
            </View>
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.payMethodOption,
              paymentMethod === 'MOMO' && styles.payMethodActive,
            ]}
            onPress={() => setPaymentMethod('MOMO')}
          >
            <View style={styles.radioDot}>
              {paymentMethod === 'MOMO' && <View style={styles.radioInner} />}
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.payMethodTitle}>
                Ví điện tử MoMo QR (Sandbox)
              </Text>
              <Text style={styles.payMethodDesc}>
                Thanh toán cọc tự động qua cổng giả lập MoMo Sandbox
              </Text>
            </View>
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.payMethodOption,
              paymentMethod === 'CASH' && styles.payMethodActive,
            ]}
            onPress={() => setPaymentMethod('CASH')}
          >
            <View style={styles.radioDot}>
              {paymentMethod === 'CASH' && <View style={styles.radioInner} />}
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.payMethodTitle}>
                Thanh toán trực tiếp tại sân (CASH)
              </Text>
              <Text style={styles.payMethodDesc}>
                Xác nhận giữ lịch và xuất mã QR Check-in ngay lập tức
              </Text>
            </View>
          </TouchableOpacity>
        </View>

        {/* 4. Tổng kết chi phí */}
        <View style={styles.card}>
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>Tiền sân ({booking?.slots?.length || 1} giờ):</Text>
            <Text style={styles.summaryVal}>{courtFee.toLocaleString('vi-VN')}đ</Text>
          </View>
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>Dịch vụ đi kèm:</Text>
            <Text style={styles.summaryVal}>{servicesFee.toLocaleString('vi-VN')}đ</Text>
          </View>
          <View style={[styles.summaryRow, styles.summaryTotalRow]}>
            <Text style={styles.summaryTotalLabel}>Tổng cộng hóa đơn:</Text>
            <Text style={styles.summaryTotalVal}>
              {totalAmount.toLocaleString('vi-VN')} VNĐ
            </Text>
          </View>
          <View style={styles.depositHighlight}>
            <Text style={styles.depositLabel}>Số tiền cọc giữ sân (50%):</Text>
            <Text style={styles.depositValue}>
              {depositAmount.toLocaleString('vi-VN')} VNĐ
            </Text>
          </View>
        </View>

        <TouchableOpacity
          style={styles.payNowBtn}
          onPress={handleProceedPayment}
          disabled={processing}
        >
          {processing ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.payNowBtnText}>
              {paymentMethod === 'CASH'
                ? 'Xác nhận đặt sân & Nhận vé QR'
                : `Thanh toán cọc ${depositAmount.toLocaleString('vi-VN')}đ qua ${paymentMethod}`}
            </Text>
          )}
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.cancelLockBtn}
          onPress={handleReleaseAndGoBack}
        >
          <Text style={styles.cancelLockBtnText}>
            Hủy giữ chỗ & Giải phóng slot về màu xanh
          </Text>
        </TouchableOpacity>
      </ScrollView>

      {/* Modal WebView Cổng thanh toán VNPay / MoMo Sandbox */}
      <Modal
        visible={!!webViewUrl}
        animationType="slide"
        onRequestClose={() => setWebViewUrl(null)}
      >
        <View style={styles.webViewContainer}>
          <View style={styles.webViewHeader}>
            <Text style={styles.webViewTitle}>
              🔒 Cổng Thanh Toán {paymentMethod} Sandbox
            </Text>
            <TouchableOpacity
              style={styles.closeWebViewBtn}
              onPress={() => setWebViewUrl(null)}
            >
              <Text style={styles.closeWebViewText}>Đóng ✕</Text>
            </TouchableOpacity>
          </View>

          {webViewUrl && Platform.OS !== 'web' ? (
            <WebView
              source={{ uri: webViewUrl }}
              onNavigationStateChange={handleWebViewNavChange}
              onMessage={(event) => {
                try {
                  const data = JSON.parse(event.nativeEvent.data);
                  if (data.type === 'PAYMENT_RESULT') {
                    if (data.success) {
                      handlePaymentSuccessRedirect();
                    } else {
                      setWebViewUrl(null);
                    }
                  }
                } catch (_) {}
              }}
              startInLoadingState
            />
          ) : (
            <View style={{ padding: 24, alignItems: 'center' }}>
              <Text style={{ fontSize: 15, textAlign: 'center', marginBottom: 16 }}>
                Cổng thanh toán Sandbox đã được mở. Sau khi xác nhận trên cổng thanh toán, bấm nút bên dưới để hoàn tất:
              </Text>
              <TouchableOpacity
                style={styles.payNowBtn}
                onPress={handlePaymentSuccessRedirect}
              >
                <Text style={styles.payNowBtnText}>
                  Hoàn tất & Mở Vé Điện Tử QR
                </Text>
              </TouchableOpacity>
            </View>
          )}
        </View>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F1F5F9',
  },
  countdownBanner: {
    backgroundColor: '#D97706',
    paddingVertical: 10,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  countdownTitle: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
  },
  countdownTimer: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '900',
    backgroundColor: 'rgba(0,0,0,0.2)',
    paddingHorizontal: 10,
    paddingVertical: 2,
    borderRadius: 8,
  },
  scrollContent: {
    padding: 14,
    paddingBottom: 40,
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: '#0F172A',
    marginBottom: 12,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 6,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  infoLabel: {
    fontSize: 13,
    color: '#64748B',
    fontWeight: '600',
  },
  infoValue: {
    fontSize: 13,
    color: '#0F172A',
    fontWeight: '700',
  },
  infoHighlight: {
    fontSize: 13,
    color: '#0D9488',
    fontWeight: '800',
  },
  serviceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  serviceName: {
    fontSize: 13,
    fontWeight: '700',
    color: '#0F172A',
  },
  servicePrice: {
    fontSize: 12,
    color: '#0D9488',
    fontWeight: '600',
    marginTop: 2,
  },
  qtyControl: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  qtyBtn: {
    width: 30,
    height: 30,
    borderRadius: 8,
    backgroundColor: '#E2E8F0',
    alignItems: 'center',
    justifyContent: 'center',
  },
  qtyBtnPlus: {
    backgroundColor: '#0D9488',
  },
  qtyBtnText: {
    fontSize: 16,
    fontWeight: '800',
    color: '#0F172A',
  },
  qtyValue: {
    fontSize: 14,
    fontWeight: '800',
    minWidth: 20,
    textAlign: 'center',
  },
  payMethodOption: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
    marginBottom: 8,
    gap: 12,
  },
  payMethodActive: {
    borderColor: '#0D9488',
    backgroundColor: '#F0FDFA',
  },
  radioDot: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: '#0D9488',
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioInner: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#0D9488',
  },
  payMethodTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: '#0F172A',
  },
  payMethodDesc: {
    fontSize: 11,
    color: '#64748B',
    marginTop: 2,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  summaryLabel: {
    fontSize: 13,
    color: '#64748B',
  },
  summaryVal: {
    fontSize: 13,
    fontWeight: '700',
    color: '#0F172A',
  },
  summaryTotalRow: {
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#E2E8F0',
    marginTop: 4,
  },
  summaryTotalLabel: {
    fontSize: 14,
    fontWeight: '800',
    color: '#0F172A',
  },
  summaryTotalVal: {
    fontSize: 16,
    fontWeight: '900',
    color: '#0F172A',
  },
  depositHighlight: {
    marginTop: 10,
    backgroundColor: '#F0FDFA',
    padding: 12,
    borderRadius: 12,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#99F6E4',
  },
  depositLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: '#0F766E',
  },
  depositValue: {
    fontSize: 17,
    fontWeight: '900',
    color: '#0D9488',
  },
  payNowBtn: {
    backgroundColor: '#0D9488',
    paddingVertical: 15,
    borderRadius: 14,
    alignItems: 'center',
    marginTop: 4,
  },
  payNowBtnText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '800',
  },
  cancelLockBtn: {
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 6,
  },
  cancelLockBtnText: {
    color: '#DC2626',
    fontSize: 13,
    fontWeight: '700',
  },
  webViewContainer: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  webViewHeader: {
    backgroundColor: '#0F172A',
    paddingTop: 44,
    paddingBottom: 14,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  webViewTitle: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '800',
  },
  closeWebViewBtn: {
    backgroundColor: 'rgba(255,255,255,0.15)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
  },
  closeWebViewText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
  },
});

