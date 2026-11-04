import React, { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Modal,
  TextInput,
  Alert,
  ActivityIndicator,
  RefreshControl,
  Image,
} from 'react-native';
import { BADMINTON_IMAGES } from '../constants/badmintonTheme';
import QRCode from 'react-native-qrcode-svg';
import { apiRequest } from '../config/api';
import { Booking } from '../types/models';

type BookingTab = 'upcoming' | 'completed' | 'cancelled';

export const BookingHistoryScreen: React.FC = () => {
  const [activeTab, setActiveTab] = useState<BookingTab>('upcoming');
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Modal hiển thị Vé điện tử QR Code động
  const [qrTicketBooking, setQrTicketBooking] = useState<Booking | null>(null);

  // Modal Đánh giá & Nhận xét sao (Rating & Review)
  const [reviewBookingItem, setReviewBookingItem] = useState<Booking | null>(null);
  const [ratingStars, setRatingStars] = useState(5);
  const [reviewComment, setReviewComment] = useState(
    'Sân cầu lông thảm đẹp, ánh sáng chuẩn thi đấu, chủ sân nhiệt tình!'
  );
  const [submittingReview, setSubmittingReview] = useState(false);

  const fetchBookings = useCallback(async () => {
    try {
      setLoading(true);
      const res = await apiRequest(`/api/bookings/my-bookings?tab=${activeTab}`);
      if (res.success && Array.isArray(res.bookings)) {
        setBookings(res.bookings);
      }
    } catch (_) {
    } finally {
      setLoading(false);
    }
  }, [activeTab]);

  useEffect(() => {
    fetchBookings();
  }, [fetchBookings]);

  const handleCancelBooking = (booking: Booking) => {
    const matchStartTime = new Date(
      `${booking.booking_date}T${booking.start_time}:00`
    );
    const hoursUntilMatch =
      (matchStartTime.getTime() - Date.now()) / (1000 * 60 * 60);
    const isLateCancel = hoursUntilMatch < 4;

    Alert.alert(
      'Xác nhận Hủy lịch đặt sân',
      isLateCancel
        ? `⚠️ CẢNH BÁO PHẠT CỌC: Thời gian còn lại tới giờ bóng lăn dưới 4 tiếng. Nếu hủy lịch bây giờ, bạn sẽ bị phạt 100% tiền cọc (${booking.deposit_paid.toLocaleString(
            'vi-VN'
          )}đ). Bạn vẫn muốn hủy?`
        : `Bạn đang hủy trước giờ bóng lăn hơn 4 tiếng. Tiền đặt cọc (${booking.deposit_paid.toLocaleString(
            'vi-VN'
          )}đ) sẽ được hoàn lại 100%. Xác nhận hủy?`,
      [
        { text: 'Không hủy', style: 'cancel' },
        {
          text: isLateCancel ? 'Chấp nhận phạt & Hủy' : 'Xác nhận Hủy',
          style: 'destructive',
          onPress: async () => {
            try {
              const res = await apiRequest(
                `/api/bookings/${booking._id}/cancel`,
                {
                  method: 'POST',
                }
              );
              Alert.alert('Kết quả hủy lịch', res.message);
              fetchBookings();
            } catch (error: any) {
              Alert.alert('Lỗi', error.message);
            }
          },
        },
      ]
    );
  };

  const handleSubmitReview = async () => {
    if (!reviewBookingItem) return;
    try {
      setSubmittingReview(true);
      const res = await apiRequest(
        `/api/bookings/${reviewBookingItem._id}/review`,
        {
          method: 'POST',
          body: JSON.stringify({
            rating: ratingStars,
            comment: reviewComment.trim(),
          }),
        }
      );
      setSubmittingReview(false);
      if (res.success) {
        setReviewBookingItem(null);
        Alert.alert('Cảm ơn bạn!', res.message);
        fetchBookings();
      } else {
        Alert.alert('Lỗi', res.message);
      }
    } catch (error: any) {
      setSubmittingReview(false);
      Alert.alert('Lỗi', error.message);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchBookings();
    setRefreshing(false);
  };

  return (
    <View style={styles.container}>
      {/* 3 Tab phân loại: Sắp diễn ra | Đã hoàn thành | Đã hủy */}
      <View style={styles.tabBar}>
        <TouchableOpacity
          style={[styles.tabItem, activeTab === 'upcoming' && styles.tabItemActive]}
          onPress={() => setActiveTab('upcoming')}
        >
          <Text
            style={[
              styles.tabText,
              activeTab === 'upcoming' && styles.tabTextActive,
            ]}
          >
            Sắp diễn ra
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[
            styles.tabItem,
            activeTab === 'completed' && styles.tabItemActive,
          ]}
          onPress={() => setActiveTab('completed')}
        >
          <Text
            style={[
              styles.tabText,
              activeTab === 'completed' && styles.tabTextActive,
            ]}
          >
            Đã hoàn thành
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[
            styles.tabItem,
            activeTab === 'cancelled' && styles.tabItemActive,
          ]}
          onPress={() => setActiveTab('cancelled')}
        >
          <Text
            style={[
              styles.tabText,
              activeTab === 'cancelled' && styles.tabTextActive,
            ]}
          >
            Đã hủy
          </Text>
        </TouchableOpacity>
      </View>

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
        {loading ? (
          <ActivityIndicator size="large" color="#0D9488" style={{ marginTop: 32 }} />
        ) : bookings.length === 0 ? (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyTitle}>
              Chưa có đơn đặt sân nào trong mục này
            </Text>
            <Text style={styles.emptySub}>
              Các vé đặt sân điện tử QR sẽ hiển thị tại đây ngay sau khi bạn đặt sân.
            </Text>
          </View>
        ) : (
          bookings.map((b) => {
            const courtName = b.court_id?.name || 'Cụm sân cầu lông';
            const qrValue =
              b.qr_checkin_code || `BBQR|${b.booking_code}|${b._id}`;

            return (
              <View key={b._id} style={styles.bookingCard}>
                <View style={styles.cardHeaderTop}>
                  <Image
                    source={{ uri: b.court_id?.images?.[0] || BADMINTON_IMAGES.courtDefault1 }}
                    style={styles.cardCourtThumb}
                    resizeMode="cover"
                  />
                  <View style={{ flex: 1, marginLeft: 10 }}>
                    <View style={styles.codePillRow}>
                      <Text style={styles.bookingCode}>#{b.booking_code}</Text>
                      <View
                        style={[
                          styles.statusPill,
                          b.status === 'confirmed' && { backgroundColor: '#DCFCE7' },
                          b.status === 'completed' && { backgroundColor: '#DBEAFE' },
                          b.status === 'cancelled' && { backgroundColor: '#FEE2E2' },
                        ]}
                      >
                        <Text
                          style={[
                            styles.statusPillText,
                            b.status === 'confirmed' && { color: '#15803D' },
                            b.status === 'completed' && { color: '#1D4ED8' },
                            b.status === 'cancelled' && { color: '#B91C1C' },
                          ]}
                        >
                          {b.status === 'confirmed'
                            ? '✓ Đã xác nhận'
                            : b.status === 'locked_pending'
                            ? 'Chờ cọc (5p)'
                            : b.status === 'completed'
                            ? 'Đã hoàn thành ✓'
                            : 'Đã hủy'}
                        </Text>
                      </View>
                    </View>
                    <Text style={styles.courtTitle} numberOfLines={1}>{courtName}</Text>
                    <Text style={styles.courtSub}>
                      🏸 {b.sub_court_name} • 📅 {b.booking_date} • ⏰ {b.start_time} - {b.end_time}
                    </Text>
                  </View>
                </View>

                {b.extra_services && b.extra_services.length > 0 && (
                  <Text style={styles.extraServicesText}>
                    🎒 Dịch vụ kèm:{' '}
                    {b.extra_services
                      .map((s) => `${s.name} (x${s.quantity})`)
                      .join(', ')}
                  </Text>
                )}

                <View style={styles.priceBox}>
                  <View>
                    <Text style={styles.priceLabel}>Tổng hóa đơn</Text>
                    <Text style={styles.priceTotal}>
                      {b.total_amount.toLocaleString('vi-VN')} VNĐ
                    </Text>
                  </View>
                  <View style={{ alignItems: 'flex-end' }}>
                    <Text style={styles.priceLabel}>
                      Đã cọc ({b.payment_info?.payment_method || 'VNPAY'})
                    </Text>
                    <Text style={styles.priceDeposit}>
                      {b.deposit_paid.toLocaleString('vi-VN')} VNĐ
                    </Text>
                  </View>
                </View>

                {b.status === 'cancelled' && b.cancel_reason ? (
                  <View style={styles.cancelNoteBox}>
                    <Text style={styles.cancelNoteText}>
                      📌 Lý do: {b.cancel_reason}
                    </Text>
                  </View>
                ) : null}

                {/* Các nút hành động theo từng Tab */}
                <View style={styles.actionRow}>
                  {(b.status === 'confirmed' || b.status === 'completed') && (
                    <TouchableOpacity
                      style={styles.qrBtn}
                      onPress={() => setQrTicketBooking(b)}
                    >
                      <Text style={styles.qrBtnText}>🎫 Mở Vé Điện Tử QR</Text>
                    </TouchableOpacity>
                  )}

                  {activeTab === 'upcoming' && (
                    <TouchableOpacity
                      style={styles.cancelBtn}
                      onPress={() => handleCancelBooking(b)}
                    >
                      <Text style={styles.cancelBtnText}>Hủy lịch đặt</Text>
                    </TouchableOpacity>
                  )}

                  {activeTab === 'completed' && !b.is_reviewed && (
                    <TouchableOpacity
                      style={styles.reviewBtn}
                      onPress={() => {
                        setRatingStars(5);
                        setReviewBookingItem(b);
                      }}
                    >
                      <Text style={styles.reviewBtnText}>⭐ Đánh giá sân</Text>
                    </TouchableOpacity>
                  )}

                  {activeTab === 'completed' && b.is_reviewed && (
                    <View style={styles.reviewedBadge}>
                      <Text style={styles.reviewedBadgeText}>⭐ Đã đánh giá</Text>
                    </View>
                  )}
                </View>

                {/* Hiển thị mã QR thu nhỏ ngay trên thẻ */}
                {b.status === 'confirmed' && (
                  <View style={styles.inlineQrRow}>
                    <Text style={styles.inlineQrCodeText}>
                      Mã Check-in: {qrValue}
                    </Text>
                  </View>
                )}
              </View>
            );
          })
        )}
      </ScrollView>

      {/* Modal Vé Điện Tử QR Code Động */}
      <Modal
        visible={!!qrTicketBooking}
        animationType="fade"
        transparent
        onRequestClose={() => setQrTicketBooking(null)}
      >
        <View style={styles.modalOverlay}>
          {qrTicketBooking && (
            <View style={styles.ticketModal}>
              <View style={styles.ticketBannerWrap}>
                <Image
                  source={{ uri: BADMINTON_IMAGES.ticketHero }}
                  style={styles.ticketBannerImg}
                  resizeMode="cover"
                />
                <View style={styles.ticketBannerOverlay}>
                  <Text style={styles.ticketBadgePill}>🎟️ VÉ CHECK-IN ĐIỆN TỬ VIP</Text>
                  <Text style={styles.ticketBannerCourtName} numberOfLines={1}>
                    {qrTicketBooking.court_id?.name || 'Sân Cầu Lông'}
                  </Text>
                </View>
              </View>
              <View style={styles.ticketHeader}>
                <Text style={styles.ticketHeaderSub}>
                  Đưa mã QR này cho Nhân viên lễ tân / Web Admin quét khi vào sân
                </Text>
              </View>

              <View style={styles.qrContainer}>
                <QRCode
                  value={
                    qrTicketBooking.qr_checkin_code ||
                    `BBQR|${qrTicketBooking.booking_code}|${qrTicketBooking._id}`
                  }
                  size={190}
                  backgroundColor="#FFFFFF"
                  color="#0F172A"
                />
              </View>

              <Text style={styles.qrCodeString}>
                {qrTicketBooking.qr_checkin_code || qrTicketBooking.booking_code}
              </Text>

              <View style={styles.ticketDetails}>
                <Text style={styles.ticketDetailLine}>
                  🏟️ Sân: {qrTicketBooking.court_id?.name} ({qrTicketBooking.sub_court_name})
                </Text>
                <Text style={styles.ticketDetailLine}>
                  📅 Ngày: {qrTicketBooking.booking_date} • ⏰ {qrTicketBooking.start_time} -{' '}
                  {qrTicketBooking.end_time}
                </Text>
                <Text style={styles.ticketDetailLine}>
                  💰 Đã thanh toán cọc:{' '}
                  {qrTicketBooking.deposit_paid.toLocaleString('vi-VN')} VNĐ
                </Text>
              </View>

              <TouchableOpacity
                style={styles.closeTicketBtn}
                onPress={() => setQrTicketBooking(null)}
              >
                <Text style={styles.closeTicketBtnText}>Đóng Vé Điện Tử</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>
      </Modal>

      {/* Modal Đánh giá & Nhận xét sao (Rating & Review) */}
      <Modal
        visible={!!reviewBookingItem}
        animationType="slide"
        transparent
        onRequestClose={() => setReviewBookingItem(null)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.ticketModal}>
            <Text style={styles.reviewModalTitle}>
              ⭐ Đánh Giá Chất Lượng Sân
            </Text>
            <Text style={styles.reviewModalSub}>
              {reviewBookingItem?.court_id?.name} ({reviewBookingItem?.sub_court_name})
            </Text>

            <View style={styles.starsRow}>
              {[1, 2, 3, 4, 5].map((star) => (
                <TouchableOpacity
                  key={star}
                  onPress={() => setRatingStars(star)}
                >
                  <Text
                    style={[
                      styles.starIcon,
                      star <= ratingStars
                        ? { color: '#F59E0B' }
                        : { color: '#CBD5E1' },
                    ]}
                  >
                    ★
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <TextInput
              style={styles.reviewInput}
              value={reviewComment}
              onChangeText={setReviewComment}
              multiline
              placeholder="Chia sẻ trải nghiệm về thảm sân, ánh sáng, thái độ phục vụ..."
            />

            <View style={{ flexDirection: 'row', gap: 10, width: '100%' }}>
              <TouchableOpacity
                style={[styles.closeTicketBtn, { flex: 1, backgroundColor: '#E2E8F0' }]}
                onPress={() => setReviewBookingItem(null)}
              >
                <Text style={[styles.closeTicketBtnText, { color: '#475569' }]}>
                  Đóng
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.closeTicketBtn, { flex: 2 }]}
                onPress={handleSubmitReview}
                disabled={submittingReview}
              >
                {submittingReview ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text style={styles.closeTicketBtnText}>
                    Gửi Đánh Giá ({ratingStars} ⭐)
                  </Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  cardHeaderTop: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  cardCourtThumb: {
    width: 64,
    height: 64,
    borderRadius: 12,
    backgroundColor: '#E2E8F0',
  },
  codePillRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 2,
  },
  ticketBannerWrap: {
    height: 100,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    overflow: 'hidden',
    position: 'relative',
    backgroundColor: '#0F172A',
  },
  ticketBannerImg: {
    width: '100%',
    height: '100%',
    opacity: 0.75,
  },
  ticketBannerOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    padding: 12,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(15, 23, 42, 0.4)',
  },
  ticketBadgePill: {
    backgroundColor: '#0D9488',
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '800',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 999,
    alignSelf: 'flex-start',
    marginBottom: 4,
  },
  ticketBannerCourtName: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '900',
  },

  container: {
    flex: 1,
    backgroundColor: '#F1F5F9',
  },
  tabBar: {
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    padding: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
    gap: 6,
  },
  tabItem: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 10,
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
  },
  tabItemActive: {
    backgroundColor: '#0D9488',
  },
  tabText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#64748B',
  },
  tabTextActive: {
    color: '#FFFFFF',
  },
  scrollContent: {
    padding: 14,
    paddingBottom: 30,
  },
  emptyCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 28,
    alignItems: 'center',
  },
  emptyTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#334155',
  },
  emptySub: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 6,
    textAlign: 'center',
  },
  bookingCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  bookingCode: {
    fontSize: 13,
    fontWeight: '900',
    color: '#0F172A',
  },
  statusPill: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    backgroundColor: '#F1F5F9',
  },
  statusPillText: {
    fontSize: 11,
    fontWeight: '800',
  },
  courtTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#0F172A',
  },
  courtSub: {
    fontSize: 12,
    color: '#0F766E',
    fontWeight: '700',
    marginTop: 4,
  },
  extraServicesText: {
    fontSize: 11,
    color: '#475569',
    marginTop: 6,
  },
  priceBox: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    backgroundColor: '#F8FAFC',
    borderRadius: 12,
    padding: 10,
    marginTop: 10,
  },
  priceLabel: {
    fontSize: 11,
    color: '#64748B',
  },
  priceTotal: {
    fontSize: 14,
    fontWeight: '800',
    color: '#0F172A',
  },
  priceDeposit: {
    fontSize: 14,
    fontWeight: '800',
    color: '#0D9488',
  },
  cancelNoteBox: {
    marginTop: 8,
    backgroundColor: '#FEF2F2',
    padding: 8,
    borderRadius: 8,
  },
  cancelNoteText: {
    fontSize: 11,
    color: '#B91C1C',
    fontWeight: '600',
  },
  actionRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 12,
  },
  qrBtn: {
    flex: 1,
    backgroundColor: '#0D9488',
    paddingVertical: 11,
    borderRadius: 10,
    alignItems: 'center',
  },
  qrBtnText: {
    color: '#FFFFFF',
    fontWeight: '800',
    fontSize: 12,
  },
  cancelBtn: {
    paddingHorizontal: 14,
    paddingVertical: 11,
    borderRadius: 10,
    backgroundColor: '#FEE2E2',
    alignItems: 'center',
  },
  cancelBtnText: {
    color: '#DC2626',
    fontWeight: '800',
    fontSize: 12,
  },
  reviewBtn: {
    flex: 1,
    backgroundColor: '#F59E0B',
    paddingVertical: 11,
    borderRadius: 10,
    alignItems: 'center',
  },
  reviewBtnText: {
    color: '#FFFFFF',
    fontWeight: '800',
    fontSize: 12,
  },
  reviewedBadge: {
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 10,
    backgroundColor: '#FEF3C7',
    justifyContent: 'center',
  },
  reviewedBadgeText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#B45309',
  },
  inlineQrRow: {
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
  },
  inlineQrCodeText: {
    fontSize: 11,
    color: '#64748B',
    fontFamily: 'monospace',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.7)',
    justifyContent: 'center',
    padding: 18,
  },
  ticketModal: {
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    padding: 20,
    alignItems: 'center',
  },
  ticketHeader: {
    alignItems: 'center',
    marginBottom: 16,
  },
  ticketHeaderTitle: {
    fontSize: 15,
    fontWeight: '900',
    color: '#0D9488',
    textAlign: 'center',
  },
  ticketHeaderSub: {
    fontSize: 11,
    color: '#64748B',
    marginTop: 4,
    textAlign: 'center',
  },
  qrContainer: {
    padding: 16,
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    borderWidth: 2,
    borderColor: '#0D9488',
    marginBottom: 12,
  },
  qrCodeString: {
    fontSize: 12,
    fontWeight: '800',
    color: '#0F172A',
    backgroundColor: '#F1F5F9',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    marginBottom: 12,
  },
  ticketDetails: {
    width: '100%',
    backgroundColor: '#F8FAFC',
    borderRadius: 12,
    padding: 12,
    marginBottom: 16,
    gap: 4,
  },
  ticketDetailLine: {
    fontSize: 12,
    fontWeight: '700',
    color: '#334155',
  },
  closeTicketBtn: {
    width: '100%',
    backgroundColor: '#0D9488',
    paddingVertical: 13,
    borderRadius: 12,
    alignItems: 'center',
  },
  closeTicketBtnText: {
    color: '#FFFFFF',
    fontWeight: '800',
    fontSize: 14,
  },
  reviewModalTitle: {
    fontSize: 17,
    fontWeight: '800',
    color: '#0F172A',
  },
  reviewModalSub: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 4,
  },
  starsRow: {
    flexDirection: 'row',
    gap: 10,
    marginVertical: 14,
  },
  starIcon: {
    fontSize: 36,
  },
  reviewInput: {
    width: '100%',
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 12,
    padding: 12,
    fontSize: 13,
    minHeight: 80,
    marginBottom: 14,
    textAlignVertical: 'top',
  },
});

