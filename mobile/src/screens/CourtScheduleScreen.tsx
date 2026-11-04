import React, { useEffect, useMemo, useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  RefreshControl,
  Image,
} from 'react-native';
import { BADMINTON_IMAGES } from '../constants/badmintonTheme';
import { useNavigation } from '@react-navigation/native';
import { rootNavigate } from '../navigation/navigationRef';
import { apiRequest, getSocket } from '../config/api';
import { Court, SubCourt, TimeSlot } from '../types/models';

const DISTRICTS = ['Tất cả', 'Cầu Giấy', 'Đống Đa', 'Thanh Xuân', 'Tây Hồ'];
const CARPETS = ['Tất cả', 'Thảm Yonex', 'Thảm PVC', 'Thảm Enlio', 'Sàn gỗ'];
const COURT_TYPES = [
  { key: 'all', label: 'Tất cả sân' },
  { key: 'indoor', label: 'Trong nhà' },
  { key: 'outdoor', label: 'Ngoài trời' },
];
const PRICE_FILTERS = [
  { key: 'all', label: 'Mọi mức giá' },
  { key: 'low', label: '≤ 85.000đ/h' },
  { key: 'high', label: '> 85.000đ/h' },
];

function getNext7Days(): { dateStr: string; dayLabel: string; dayNum: string }[] {
  const days = ['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7'];
  const result = [];
  const base = new Date();
  for (let i = 0; i < 7; i++) {
    const d = new Date(base);
    d.setDate(base.getDate() + i);
    const dateStr = d.toISOString().slice(0, 10);
    const dayLabel = i === 0 ? 'Hôm nay' : days[d.getDay()];
    const dayNum = `${String(d.getDate()).padStart(2, '0')}/${String(
      d.getMonth() + 1
    ).padStart(2, '0')}`;
    result.push({ dateStr, dayLabel, dayNum });
  }
  return result;
}

const getCourtImage = (court: Court, index: number) => {
  if (court.images && court.images.length > 0 && typeof court.images[0] === 'string' && court.images[0].startsWith('http')) {
    return court.images[0];
  }
  const fallbacks = [
    BADMINTON_IMAGES.courtDefault1,
    BADMINTON_IMAGES.courtDefault2,
    BADMINTON_IMAGES.courtDefault3,
    BADMINTON_IMAGES.courtDefault4,
  ];
  return fallbacks[index % fallbacks.length];
};

export const CourtScheduleScreen: React.FC = () => {
  const navigation = useNavigation<any>();
  const calendarDays = useMemo(() => getNext7Days(), []);

  // Bộ lọc danh sách sân
  const [selectedDistrict, setSelectedDistrict] = useState('Tất cả');
  const [selectedCarpet, setSelectedCarpet] = useState('Tất cả');
  const [selectedCourtType, setSelectedCourtType] = useState('all');
  const [selectedPriceFilter, setSelectedPriceFilter] = useState('all');

  const [courts, setCourts] = useState<Court[]>([]);
  const [selectedCourt, setSelectedCourt] = useState<Court | null>(null);
  const [selectedSubCourt, setSelectedSubCourt] = useState<SubCourt | null>(null);
  const [selectedDate, setSelectedDate] = useState<string>(calendarDays[0].dateStr);

  const [slots, setSlots] = useState<TimeSlot[]>([]);
  const [selectedSlotIds, setSelectedSlotIds] = useState<string[]>([]);
  const [loadingCourts, setLoadingCourts] = useState(true);
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [locking, setLocking] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const fetchCourts = useCallback(async () => {
    try {
      setLoadingCourts(true);
      const params = new URLSearchParams();
      if (selectedDistrict !== 'Tất cả') params.append('district', selectedDistrict);
      if (selectedCarpet !== 'Tất cả') params.append('carpet_type', selectedCarpet);
      if (selectedCourtType !== 'all') params.append('court_type', selectedCourtType);
      if (selectedPriceFilter === 'low') params.append('maxPrice', '85000');
      if (selectedPriceFilter === 'high') params.append('minPrice', '86000');

      const res = await apiRequest(`/api/courts?${params.toString()}`);
      if (res.success && Array.isArray(res.courts)) {
        setCourts(res.courts);
        if (res.courts.length > 0) {
          const currentStillInList =
            selectedCourt && res.courts.find((c: Court) => c._id === selectedCourt._id);
          const targetCourt: Court = currentStillInList || res.courts[0];
          setSelectedCourt(targetCourt);
          if (targetCourt.sub_courts?.length > 0) {
            setSelectedSubCourt(targetCourt.sub_courts[0]);
          }
        } else {
          setSelectedCourt(null);
          setSlots([]);
        }
      }
    } catch (error: any) {
      Alert.alert('Lỗi kết nối', error.message);
    } finally {
      setLoadingCourts(false);
    }
  }, [selectedDistrict, selectedCarpet, selectedCourtType, selectedPriceFilter]);

  const fetchSlots = useCallback(async () => {
    if (!selectedCourt || !selectedSubCourt) return;
    try {
      setLoadingSlots(true);
      const subId = selectedSubCourt.sub_court_id || selectedSubCourt._id;
      const res = await apiRequest(
        `/api/courts/${selectedCourt._id}/slots?date=${selectedDate}&sub_court_id=${subId}`
      );
      if (res.success && Array.isArray(res.slots)) {
        setSlots(res.slots);
        // Loại bỏ những slot đang chọn nếu bị người khác khóa/đặt
        setSelectedSlotIds((prev) =>
          prev.filter((id) => {
            const found = res.slots.find((s: TimeSlot) => s._id === id);
            return found && found.status === 'available';
          })
        );
      }
    } catch (_) {
    } finally {
      setLoadingSlots(false);
    }
  }, [selectedCourt, selectedSubCourt, selectedDate]);

  useEffect(() => {
    fetchCourts();
  }, [fetchCourts]);

  useEffect(() => {
    setSelectedSlotIds([]);
    fetchSlots();
  }, [fetchSlots]);

  // Lắng nghe sự kiện Socket.io Real-time khi trạng thái slot thay đổi (Xanh <-> Vàng <-> Đỏ)
  useEffect(() => {
    const socket = getSocket();
    const handleSlotChange = (payload: any) => {
      if (!selectedCourt) return;
      if (
        String(payload.court_id) === String(selectedCourt._id) &&
        payload.date === selectedDate
      ) {
        setSlots((prev) =>
          prev.map((slot) =>
            String(slot._id) === String(payload.slot_id)
              ? {
                  ...slot,
                  status: payload.status,
                  locked_by: payload.locked_by,
                  lock_expires_at: payload.lock_expires_at,
                }
              : slot
          )
        );
        if (payload.status !== 'available') {
          setSelectedSlotIds((prev) =>
            prev.filter((id) => String(id) !== String(payload.slot_id))
          );
        }
      }
    };

    socket.on('slot_status_changed', handleSlotChange);
    return () => {
      socket.off('slot_status_changed', handleSlotChange);
    };
  }, [selectedCourt, selectedDate]);

  const handleToggleSlot = (slot: TimeSlot) => {
    if (slot.status === 'booked') {
      Alert.alert(
        'Khung giờ đã có người đặt (Màu Đỏ)',
        `Khung giờ ${slot.start_time} - ${slot.end_time} đã được đặt cọc. Vui lòng chọn ô màu xanh lá!`
      );
      return;
    }
    if (slot.status === 'locked') {
      Alert.alert(
        'Khung giờ đang giữ chỗ thanh toán (Màu Vàng)',
        `Khung giờ ${slot.start_time} - ${slot.end_time} đang được người chơi khác giữ chỗ trong 5 phút.`
      );
      return;
    }

    setSelectedSlotIds((prev) => {
      if (prev.includes(slot._id)) {
        return prev.filter((id) => id !== slot._id);
      }
      return [...prev, slot._id];
    });
  };

  const selectedSlotObjects = useMemo(
    () =>
      slots
        .filter((s) => selectedSlotIds.includes(s._id))
        .sort((a, b) => a.start_time.localeCompare(b.start_time)),
    [slots, selectedSlotIds]
  );

  const estimatedTotal = useMemo(
    () => selectedSlotObjects.reduce((sum, s) => sum + (s.price || 90000), 0),
    [selectedSlotObjects]
  );

  const handleLockAndProceed = async () => {
    if (!selectedCourt || selectedSlotIds.length === 0) return;

    try {
      setLocking(true);
      const res = await apiRequest('/api/bookings/lock-slot', {
        method: 'POST',
        body: JSON.stringify({
          slot_ids: selectedSlotIds,
          court_id: selectedCourt._id,
          sub_court_id: selectedSubCourt?.sub_court_id || selectedSubCourt?._id,
          booking_date: selectedDate,
        }),
      });

      setLocking(false);

      if (!res.success) {
        Alert.alert(
          'Cảnh báo trùng lịch (Race Condition)',
          res.message || 'Khung giờ này vừa có người nhanh tay chọn trước!'
        );
        fetchSlots();
        return;
      }

      setSelectedSlotIds([]);
      fetchSlots();

      const paymentParams = {
        booking: res.booking,
        court: selectedCourt,
        lockExpiresAt: res.lock_expires_at,
      };

      // Đảm bảo chuyển màn hình thanh toán cọc tức thì
      rootNavigate('CheckoutPayment', paymentParams);
      try {
        navigation.navigate('CheckoutPayment', paymentParams);
      } catch (_) {}
      try {
        navigation.getParent()?.navigate('CheckoutPayment', paymentParams);
      } catch (_) {}
    } catch (error: any) {
      setLocking(false);
      Alert.alert('Lỗi đặt sân', error.message);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchCourts();
    await fetchSlots();
    setRefreshing(false);
  };

  return (
    <View style={styles.container}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
        {/* Banner Chào mừng & Không khí Cầu lông Gần gũi */}
        <View style={styles.heroBannerWrap}>
          <Image
            source={{ uri: BADMINTON_IMAGES.heroBanner }}
            style={styles.heroBannerImg}
            resizeMode="cover"
          />
          <View style={styles.heroBannerOverlay}>
            <View style={styles.heroTagRow}>
              <Text style={styles.heroLivePill}>🟢 Đang hoạt động • Live Slots</Text>
              <Text style={styles.heroBadgePill}>🏸 Chuẩn BWF</Text>
            </View>
            <Text style={styles.heroTitle}>Sân Cầu Lông Đẹp & Chuẩn Thi Đấu</Text>
            <Text style={styles.heroSubtitle}>
              Giữ chỗ 5 phút tức thì • Check-in vé QR • Thảm Yonex bám giày
            </Text>
          </View>
        </View>

        {/* 1. Bộ lọc Quận/Huyện, Giá, Loại thảm, Trong nhà/Ngoài trời */}
        <View style={styles.filterSection}>
          <Text style={styles.filterTitle}>🔍 Bộ lọc cụm sân cầu lông</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterRow}>
            {DISTRICTS.map((d) => (
              <TouchableOpacity
                key={d}
                style={[
                  styles.filterChip,
                  selectedDistrict === d && styles.filterChipActive,
                ]}
                onPress={() => setSelectedDistrict(d)}
              >
                <Text
                  style={[
                    styles.filterChipText,
                    selectedDistrict === d && styles.filterChipTextActive,
                  ]}
                >
                  📍 {d}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>

          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterRow}>
            {CARPETS.map((c) => (
              <TouchableOpacity
                key={c}
                style={[
                  styles.filterChip,
                  selectedCarpet === c && styles.filterChipActive,
                ]}
                onPress={() => setSelectedCarpet(c)}
              >
                <Text
                  style={[
                    styles.filterChipText,
                    selectedCarpet === c && styles.filterChipTextActive,
                  ]}
                >
                  🟩 {c}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>

          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterRow}>
            {COURT_TYPES.map((t) => (
              <TouchableOpacity
                key={t.key}
                style={[
                  styles.filterChip,
                  selectedCourtType === t.key && styles.filterChipActive,
                ]}
                onPress={() => setSelectedCourtType(t.key)}
              >
                <Text
                  style={[
                    styles.filterChipText,
                    selectedCourtType === t.key && styles.filterChipTextActive,
                  ]}
                >
                  🏟️ {t.label}
                </Text>
              </TouchableOpacity>
            ))}
            {PRICE_FILTERS.map((p) => (
              <TouchableOpacity
                key={p.key}
                style={[
                  styles.filterChip,
                  selectedPriceFilter === p.key && styles.filterChipActive,
                ]}
                onPress={() => setSelectedPriceFilter(p.key)}
              >
                <Text
                  style={[
                    styles.filterChipText,
                    selectedPriceFilter === p.key && styles.filterChipTextActive,
                  ]}
                >
                  💰 {p.label}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>

        {/* 2. Danh sách cụm sân */}
        <Text style={styles.sectionHeader}>
          🏟️ Chọn Cụm Sân ({courts.length} sân phù hợp)
        </Text>
        {loadingCourts ? (
          <ActivityIndicator size="large" color="#0D9488" style={{ marginVertical: 20 }} />
        ) : (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={styles.courtScroll}
          >
            {courts.map((court, index) => {
              const isSelected = selectedCourt?._id === court._id;
              const courtImg = getCourtImage(court, index);
              return (
                <TouchableOpacity
                  key={court._id}
                  style={[
                    styles.courtCard,
                    isSelected && styles.courtCardSelected,
                  ]}
                  onPress={() => {
                    setSelectedCourt(court);
                    if (court.sub_courts?.length > 0) {
                      setSelectedSubCourt(court.sub_courts[0]);
                    }
                  }}
                  activeOpacity={0.85}
                >
                  <View style={styles.courtImgWrap}>
                    <Image source={{ uri: courtImg }} style={styles.courtThumb} resizeMode="cover" />
                    <View style={styles.courtBadgeTopRow}>
                      <Text style={styles.courtDistrictBadge}>📍 {court.district}</Text>
                      <Text style={styles.courtRatingBadge}>⭐ {court.rating_avg}</Text>
                    </View>
                    {isSelected && (
                      <View style={styles.selectedPill}>
                        <Text style={styles.selectedPillText}>✓ Đang chọn</Text>
                      </View>
                    )}
                  </View>
                  <View style={styles.courtCardBody}>
                    <Text style={styles.courtName} numberOfLines={1}>
                      {court.name}
                    </Text>
                    <Text style={styles.courtAddress} numberOfLines={1}>
                      {court.address}
                    </Text>
                    <View style={styles.courtMetaRow}>
                      <Text style={styles.courtMetaTag}>🟩 {court.carpet_type}</Text>
                      <Text style={styles.courtMetaTag}>
                        {court.court_type === 'indoor' ? '🏢 Trong nhà' : '🌤️ Ngoài trời'}
                      </Text>
                    </View>
                    <View style={styles.courtPriceRow}>
                      <Text style={styles.courtPrice}>
                        {court.hourly_rate.toLocaleString('vi-VN')}đ<Text style={{ fontSize: 11, fontWeight: 'normal' }}>/h</Text>
                      </Text>
                      <Text style={styles.courtPeakPrice}>
                        Giờ vàng: {(court.peak_hour_rate || court.hourly_rate).toLocaleString('vi-VN')}đ
                      </Text>
                    </View>
                  </View>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        )}

        {selectedCourt && (
          <>
            {/* Chi tiết cụm sân được chọn & Tiện ích thân thiện */}
            <View style={styles.selectedHeroBox}>
              <View style={styles.selectedHeroHeader}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.selectedHeroSub}>CỤM SÂN BẠN ĐANG XEM</Text>
                  <Text style={styles.selectedHeroTitle}>{selectedCourt.name}</Text>
                  <Text style={styles.selectedHeroAddr}>📍 {selectedCourt.address}</Text>
                </View>
                <View style={styles.ratingBadgeBig}>
                  <Text style={styles.ratingBigVal}>⭐ {selectedCourt.rating_avg}</Text>
                  <Text style={styles.ratingBigCount}>{selectedCourt.rating_count} đánh giá</Text>
                </View>
              </View>
              <View style={styles.amenityRow}>
                {(selectedCourt.amenities || ['Wifi tốc độ cao', 'Thảm Yonex BWF', 'Tắm nóng lạnh', 'Bãi đỗ ô tô', 'Căng tin nước']).map((am, i) => (
                  <View key={i} style={styles.amenityChip}>
                    <Text style={styles.amenityChipText}>✓ {am}</Text>
                  </View>
                ))}
              </View>
            </View>

            {/* 3. Calendar Strip 7 ngày tới */}
            <Text style={styles.sectionHeader}>📅 Chọn Ngày Đặt Sân (7 ngày tới)</Text>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              style={styles.calendarStrip}
            >
              {calendarDays.map((day) => {
                const active = selectedDate === day.dateStr;
                return (
                  <TouchableOpacity
                    key={day.dateStr}
                    style={[styles.dayItem, active && styles.dayItemActive]}
                    onPress={() => setSelectedDate(day.dateStr)}
                  >
                    <Text style={[styles.dayLabel, active && styles.dayTextActive]}>
                      {day.dayLabel}
                    </Text>
                    <Text style={[styles.dayNum, active && styles.dayTextActive]}>
                      {day.dayNum}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>

            {/* 4. Chọn Sân con (Sân 1, Sân 2, Sân 3...) */}
            <Text style={styles.sectionHeader}>🏸 Chọn Sân Con ({selectedCourt.name})</Text>
            <View style={styles.subCourtRow}>
              {selectedCourt.sub_courts.map((sub) => {
                const subId = sub.sub_court_id || sub._id;
                const active =
                  (selectedSubCourt?.sub_court_id || selectedSubCourt?._id) === subId;
                return (
                  <TouchableOpacity
                    key={subId}
                    style={[styles.subCourtBtn, active && styles.subCourtBtnActive]}
                    onPress={() => setSelectedSubCourt(sub)}
                  >
                    <Text
                      style={[
                        styles.subCourtBtnText,
                        active && styles.subCourtBtnTextActive,
                      ]}
                    >
                      {sub.court_number}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            {/* 5. Chú thích 3 trạng thái màu Time Slot Matrix */}
            <View style={styles.legendCard}>
              <View style={styles.legendItem}>
                <View style={[styles.legendDot, { backgroundColor: '#10B981' }]} />
                <Text style={styles.legendText}>Xanh lá: Trống</Text>
              </View>
              <View style={styles.legendItem}>
                <View style={[styles.legendDot, { backgroundColor: '#EF4444' }]} />
                <Text style={styles.legendText}>Đỏ: Đã đặt</Text>
              </View>
              <View style={styles.legendItem}>
                <View style={[styles.legendDot, { backgroundColor: '#F59E0B' }]} />
                <Text style={styles.legendText}>Vàng: Giữ chỗ (5p)</Text>
              </View>
            </View>

            {/* 6. Ma trận lưới khung giờ (05:00 đến 23:00) */}
            <Text style={styles.sectionHeader}>
              ⏰ Ma Trận Khung Giờ (05:00 - 23:00 • Real-time Socket.io)
            </Text>

            {loadingSlots ? (
              <ActivityIndicator size="large" color="#0D9488" style={{ marginVertical: 24 }} />
            ) : (
              <View style={styles.slotGrid}>
                {slots.map((slot) => {
                  const isChosen = selectedSlotIds.includes(slot._id);

                  // 3 trạng thái màu chuẩn theo Đặc tả:
                  // - Xanh lá: Đang trống (available)
                  // - Đỏ: Đã có người đặt (booked)
                  // - Vàng: Đang được giữ chỗ thanh toán (locked)
                  let boxStyle = styles.slotAvailable;
                  let textStyle = styles.slotTextAvailable;
                  let statusLabel = `${(slot.price / 1000).toFixed(0)}k`;

                  if (slot.status === 'booked') {
                    boxStyle = styles.slotBooked;
                    textStyle = styles.slotTextBooked;
                    statusLabel = 'Đã đặt';
                  } else if (slot.status === 'locked') {
                    boxStyle = styles.slotLocked;
                    textStyle = styles.slotTextLocked;
                    statusLabel = 'Đang giữ';
                  } else if (isChosen) {
                    boxStyle = styles.slotChosen;
                    textStyle = styles.slotTextChosen;
                    statusLabel = 'Đang chọn ✓';
                  }

                  return (
                    <TouchableOpacity
                      key={slot._id}
                      style={[styles.slotCell, boxStyle]}
                      onPress={() => handleToggleSlot(slot)}
                      activeOpacity={0.75}
                    >
                      {slot.is_peak_hour && (
                        <Text style={styles.peakStar}>🔥 Giờ vàng</Text>
                      )}
                      <Text style={[styles.slotTimeText, textStyle]}>
                        {slot.start_time} - {slot.end_time}
                      </Text>
                      <Text style={[styles.slotSubText, textStyle]}>
                        {statusLabel}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            )}
          </>
        )}
      </ScrollView>

      {/* Thanh tổng tiền tạm tính & Nút Giữ chỗ 5 phút */}
      {selectedSlotIds.length > 0 && (
        <View style={styles.bottomBar}>
          <View style={{ flex: 1 }}>
            <Text style={styles.bottomBarInfo}>
              Đã chọn {selectedSlotIds.length} khung giờ ({selectedSubCourt?.court_number})
            </Text>
            <Text style={styles.bottomBarTotal}>
              Tạm tính: {estimatedTotal.toLocaleString('vi-VN')} VNĐ
            </Text>
          </View>
          <TouchableOpacity
            style={styles.bookNowBtn}
            onPress={handleLockAndProceed}
            disabled={locking}
          >
            {locking ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.bookNowBtnText}>Giữ chỗ & Thanh toán →</Text>
            )}
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F1F5F9',
  },
  scrollContent: {
    padding: 14,
    paddingBottom: 110,
  },
  filterSection: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 12,
    marginBottom: 12,
  },
  filterTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: '#0F172A',
    marginBottom: 8,
  },
  filterRow: {
    marginBottom: 6,
  },
  filterChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: '#F1F5F9',
    marginRight: 8,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  filterChipActive: {
    backgroundColor: '#0D9488',
    borderColor: '#0D9488',
  },
  filterChipText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#475569',
  },
  filterChipTextActive: {
    color: '#FFFFFF',
  },
  sectionHeader: {
    fontSize: 14,
    fontWeight: '800',
    color: '#0F172A',
    marginTop: 8,
    marginBottom: 8,
  },
  courtScroll: {
    marginBottom: 8,
  },
  // Banner Hero đón chào
  heroBannerWrap: {
    height: 140,
    borderRadius: 18,
    overflow: 'hidden',
    marginBottom: 14,
    position: 'relative',
    backgroundColor: '#0F172A',
  },
  heroBannerImg: {
    width: '100%',
    height: '100%',
    opacity: 0.72,
  },
  heroBannerOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    padding: 14,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(15, 23, 42, 0.45)',
  },
  heroTagRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 6,
  },
  heroLivePill: {
    backgroundColor: '#065F46',
    color: '#A7F3D0',
    fontSize: 10,
    fontWeight: '800',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 999,
  },
  heroBadgePill: {
    backgroundColor: '#D97706',
    color: '#FEF3C7',
    fontSize: 10,
    fontWeight: '800',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 999,
  },
  heroTitle: {
    fontSize: 16,
    fontWeight: '900',
    color: '#FFFFFF',
    textShadowColor: 'rgba(0,0,0,0.6)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },
  heroSubtitle: {
    fontSize: 11,
    color: '#E2E8F0',
    marginTop: 2,
    fontWeight: '500',
  },
  // Court Card với ảnh minh họa chân thực
  courtCard: {
    width: 260,
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    marginRight: 12,
    borderWidth: 2,
    borderColor: '#E2E8F0',
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 6,
    elevation: 3,
  },
  courtCardSelected: {
    borderColor: '#0D9488',
    backgroundColor: '#F0FDFA',
    shadowColor: '#0D9488',
    shadowOpacity: 0.2,
  },
  courtImgWrap: {
    width: '100%',
    height: 120,
    position: 'relative',
    backgroundColor: '#E2E8F0',
  },
  courtThumb: {
    width: '100%',
    height: '100%',
  },
  courtBadgeTopRow: {
    position: 'absolute',
    top: 8,
    left: 8,
    right: 8,
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  courtDistrictBadge: {
    backgroundColor: 'rgba(15, 23, 42, 0.75)',
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '700',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  courtRatingBadge: {
    backgroundColor: '#FEF3C7',
    color: '#B45309',
    fontSize: 11,
    fontWeight: '800',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  selectedPill: {
    position: 'absolute',
    bottom: 8,
    right: 8,
    backgroundColor: '#0D9488',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  selectedPillText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '800',
  },
  courtCardBody: {
    padding: 12,
  },
  // Box chi tiết cụm sân được chọn
  selectedHeroBox: {
    borderRadius: 16,
    padding: 14,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#CCFBF1',
    backgroundColor: '#F0FDFA',
  },
  selectedHeroHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 10,
  },
  selectedHeroSub: {
    fontSize: 10,
    fontWeight: '800',
    color: '#0F766E',
    letterSpacing: 0.5,
  },
  selectedHeroTitle: {
    fontSize: 16,
    fontWeight: '900',
    color: '#0F172A',
    marginTop: 2,
  },
  selectedHeroAddr: {
    fontSize: 12,
    color: '#475569',
    marginTop: 2,
  },
  ratingBadgeBig: {
    backgroundColor: '#FEF3C7',
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 4,
    alignItems: 'center',
  },
  ratingBigVal: {
    fontSize: 14,
    fontWeight: '900',
    color: '#B45309',
  },
  ratingBigCount: {
    fontSize: 9,
    color: '#92400E',
    fontWeight: '600',
  },
  amenityRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#CCFBF1',
  },
  amenityChip: {
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#99F6E4',
  },
  amenityChipText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#0F766E',
  },
  courtBadgeRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  courtRating: {
    fontSize: 12,
    fontWeight: '700',
    color: '#D97706',
  },
  courtName: {
    fontSize: 15,
    fontWeight: '800',
    color: '#0F172A',
  },
  courtAddress: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 2,
  },
  courtMetaRow: {
    flexDirection: 'row',
    gap: 6,
    marginTop: 8,
  },
  courtMetaTag: {
    fontSize: 11,
    backgroundColor: '#F1F5F9',
    color: '#475569',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    fontWeight: '600',
  },
  courtPriceRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 10,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#E2E8F0',
  },
  courtPrice: {
    fontSize: 14,
    fontWeight: '800',
    color: '#0D9488',
  },
  courtPeakPrice: {
    fontSize: 11,
    fontWeight: '700',
    color: '#D97706',
  },
  calendarStrip: {
    marginBottom: 10,
  },
  dayItem: {
    width: 72,
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    paddingVertical: 10,
    alignItems: 'center',
    marginRight: 8,
    borderWidth: 1,
    borderColor: '#CBD5E1',
  },
  dayItemActive: {
    backgroundColor: '#0D9488',
    borderColor: '#0D9488',
  },
  dayLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: '#64748B',
  },
  dayNum: {
    fontSize: 14,
    fontWeight: '800',
    color: '#0F172A',
    marginTop: 2,
  },
  dayTextActive: {
    color: '#FFFFFF',
  },
  subCourtRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 10,
  },
  subCourtBtn: {
    paddingHorizontal: 16,
    paddingVertical: 9,
    borderRadius: 12,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#CBD5E1',
  },
  subCourtBtnActive: {
    backgroundColor: '#0F172A',
    borderColor: '#0F172A',
  },
  subCourtBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#334155',
  },
  subCourtBtnTextActive: {
    color: '#FFFFFF',
  },
  legendCard: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    paddingVertical: 10,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  legendDot: {
    width: 12,
    height: 12,
    borderRadius: 4,
  },
  legendText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#334155',
  },
  slotGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    gap: 8,
  },
  slotCell: {
    width: '31%',
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 6,
    alignItems: 'center',
    borderWidth: 1.5,
  },
  // Màu Xanh lá: Đang trống
  slotAvailable: {
    backgroundColor: '#DCFCE7',
    borderColor: '#10B981',
  },
  slotTextAvailable: {
    color: '#065F46',
  },
  // Màu Đỏ: Đã có người đặt
  slotBooked: {
    backgroundColor: '#FEE2E2',
    borderColor: '#EF4444',
  },
  slotTextBooked: {
    color: '#991B1B',
  },
  // Màu Vàng: Đang được giữ chỗ thanh toán (5 phút)
  slotLocked: {
    backgroundColor: '#FEF3C7',
    borderColor: '#F59E0B',
  },
  slotTextLocked: {
    color: '#92400E',
  },
  // Đang chạm chọn
  slotChosen: {
    backgroundColor: '#0D9488',
    borderColor: '#0F766E',
  },
  slotTextChosen: {
    color: '#FFFFFF',
  },
  peakStar: {
    fontSize: 9,
    fontWeight: '800',
    color: '#D97706',
    marginBottom: 2,
  },
  slotTimeText: {
    fontSize: 12,
    fontWeight: '800',
  },
  slotSubText: {
    fontSize: 11,
    fontWeight: '700',
    marginTop: 2,
  },
  bottomBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1,
    borderTopColor: '#CBD5E1',
    paddingHorizontal: 16,
    paddingVertical: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    elevation: 10,
  },
  bottomBarInfo: {
    fontSize: 12,
    color: '#64748B',
    fontWeight: '600',
  },
  bottomBarTotal: {
    fontSize: 16,
    fontWeight: '800',
    color: '#0D9488',
  },
  bookNowBtn: {
    backgroundColor: '#0D9488',
    paddingHorizontal: 18,
    paddingVertical: 12,
    borderRadius: 12,
  },
  bookNowBtnText: {
    color: '#FFFFFF',
    fontWeight: '800',
    fontSize: 14,
  },
});

