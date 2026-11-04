import React, { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Modal,
  Alert,
  ActivityIndicator,
  RefreshControl,
  Image,
} from 'react-native';
import { BADMINTON_IMAGES } from '../constants/badmintonTheme';
import { useNavigation } from '@react-navigation/native';
import { rootNavigate } from '../navigation/navigationRef';
import { apiRequest, getSocket } from '../config/api';
import { useAuth } from '../context/AuthContext';
import { MatchRequest, SkillLevel } from '../types/models';

const LEVEL_FILTERS: { key: string; label: string }[] = [
  { key: 'all', label: 'Mọi trình độ' },
  { key: 'beginner', label: 'Mới chơi (Newbie)' },
  { key: 'intermediate', label: 'Trung bình (TB+)' },
  { key: 'advanced', label: 'Khá / Bán chuyên' },
];

const DISTRICT_FILTERS = ['all', 'Cầu Giấy', 'Đống Đa', 'Thanh Xuân', 'Tây Hồ'];

const LEVEL_LABELS: Record<string, string> = {
  beginner: 'Mới chơi (Newbie)',
  intermediate: 'Trung bình (TB+)',
  advanced: 'Khá (TB-Khá)',
  pro: 'Chuyên nghiệp',
  all: 'Mọi trình độ',
};

export const MatchFeedScreen: React.FC = () => {
  const navigation = useNavigation<any>();
  const { user } = useAuth();

  const [matches, setMatches] = useState<MatchRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Bộ lọc tìm kèo
  const [levelFilter, setLevelFilter] = useState('all');
  const [districtFilter, setDistrictFilter] = useState('all');
  const [dateFilter, setDateFilter] = useState<string>('all');

  // Modal tạo bài đăng ghép kèo mới
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newTitle, setNewTitle] = useState(
    'Cần tìm 2 tay vợt Nam trình độ TB+ đánh đôi sân Cầu Giấy lúc 19h tối nay'
  );
  const [newLocation, setNewLocation] = useState(
    'Cụm Sân Cầu Lông Cầu Giấy Arena (Sân 1)'
  );
  const [newDistrict, setNewDistrict] = useState('Cầu Giấy');
  const [newTimeRange, setNewTimeRange] = useState('19:00 - 21:00');
  const [newLevel, setNewLevel] = useState<SkillLevel>('intermediate');
  const [newMaxPlayers, setNewMaxPlayers] = useState('6');
  const [newCost, setNewCost] = useState('70000');
  const [newNotes, setNewNotes] = useState(
    'Share đều tiền sân + cầu Hải Yến S90, vui vẻ hòa đồng!'
  );
  const [creating, setCreating] = useState(false);

  const todayStr = new Date().toISOString().slice(0, 10);

  const fetchMatches = useCallback(async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (levelFilter !== 'all') params.append('required_level', levelFilter);
      if (districtFilter !== 'all') params.append('district', districtFilter);
      if (dateFilter === 'today') params.append('date', todayStr);

      const res = await apiRequest(`/api/matches?${params.toString()}`);
      if (res.success && Array.isArray(res.matches)) {
        setMatches(res.matches);
      }
    } catch (_) {
    } finally {
      setLoading(false);
    }
  }, [levelFilter, districtFilter, dateFilter, todayStr]);

  useEffect(() => {
    fetchMatches();
  }, [fetchMatches]);

  useEffect(() => {
    const socket = getSocket();
    const handleMatchUpdate = () => {
      fetchMatches();
    };
    socket.on('match_created', handleMatchUpdate);
    socket.on('match_list_updated', handleMatchUpdate);
    return () => {
      socket.off('match_created', handleMatchUpdate);
      socket.off('match_list_updated', handleMatchUpdate);
    };
  }, [fetchMatches]);

  const handleJoinMatch = async (match: MatchRequest) => {
    try {
      const res = await apiRequest(`/api/matches/${match._id}/join`, {
        method: 'POST',
      });
      if (!res.success) {
        Alert.alert('Không thể tham gia', res.message);
        return;
      }
      fetchMatches();
      rootNavigate('MatchChatRoom', { match: res.match || match });
      try {
        navigation.navigate('MatchChatRoom', { match: res.match || match });
      } catch (_) {}
    } catch (error: any) {
      Alert.alert('Lỗi', error.message);
    }
  };

  const handleCreateMatch = async () => {
    if (!newTitle.trim() || !newLocation.trim()) {
      Alert.alert('Thiếu thông tin', 'Vui lòng nhập tiêu đề kèo và địa điểm sân!');
      return;
    }

    try {
      setCreating(true);
      const res = await apiRequest('/api/matches', {
        method: 'POST',
        body: JSON.stringify({
          title: newTitle.trim(),
          location_name: newLocation.trim(),
          district: newDistrict,
          scheduled_date: todayStr,
          time_range: newTimeRange,
          required_level: newLevel,
          max_players: Number(newMaxPlayers) || 6,
          cost_per_person: Number(newCost) || 70000,
          notes: newNotes,
        }),
      });
      setCreating(false);

      if (res.success && res.match) {
        setShowCreateModal(false);
        fetchMatches();
        Alert.alert('Đăng kèo thành công!', 'Đã tạo bài ghép kèo và mở phòng Chat trận đấu.', [
          {
            text: 'Vào Phòng Chat',
            onPress: () => {
              rootNavigate('MatchChatRoom', { match: res.match });
              try {
                navigation.navigate('MatchChatRoom', { match: res.match });
              } catch (_) {}
            },
          },
          { text: 'Đóng' },
        ]);
      } else {
        Alert.alert('Lỗi', res.message || 'Không thể đăng bài');
      }
    } catch (error: any) {
      setCreating(false);
      Alert.alert('Lỗi', error.message);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchMatches();
    setRefreshing(false);
  };

  return (
    <View style={styles.container}>
      {/* Thanh công cụ & Nút tạo bài đăng ghép kèo mới */}
      <View style={styles.topHeader}>
        <View style={{ flex: 1 }}>
          <Text style={styles.topHeaderTitle}>🤝 Ghép Kèo & Tìm Đồng Đội</Text>
          <Text style={styles.topHeaderSub}>
            Kết nối giao lưu cầu lông ngang trình độ • Chat trực tiếp
          </Text>
        </View>
        <TouchableOpacity
          style={styles.createBtn}
          onPress={() => setShowCreateModal(true)}
        >
          <Text style={styles.createBtnText}>+ Tạo Kèo Mới</Text>
        </TouchableOpacity>
      </View>

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
        {/* Bộ lọc theo Ngày, Trình độ, Khoảng cách vị trí */}
        <View style={styles.filterCard}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 6 }}>
            <TouchableOpacity
              style={[styles.chip, dateFilter === 'all' && styles.chipActive]}
              onPress={() => setDateFilter('all')}
            >
              <Text style={[styles.chipText, dateFilter === 'all' && styles.chipTextActive]}>
                📅 Tất cả ngày
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.chip, dateFilter === 'today' && styles.chipActive]}
              onPress={() => setDateFilter('today')}
            >
              <Text style={[styles.chipText, dateFilter === 'today' && styles.chipTextActive]}>
                🔥 Kèo hôm nay ({todayStr})
              </Text>
            </TouchableOpacity>
          </ScrollView>

          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 6 }}>
            {LEVEL_FILTERS.map((lv) => (
              <TouchableOpacity
                key={lv.key}
                style={[styles.chip, levelFilter === lv.key && styles.chipActive]}
                onPress={() => setLevelFilter(lv.key)}
              >
                <Text
                  style={[
                    styles.chipText,
                    levelFilter === lv.key && styles.chipTextActive,
                  ]}
                >
                  🏸 {lv.label}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>

          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            {DISTRICT_FILTERS.map((dist) => (
              <TouchableOpacity
                key={dist}
                style={[styles.chip, districtFilter === dist && styles.chipActive]}
                onPress={() => setDistrictFilter(dist)}
              >
                <Text
                  style={[
                    styles.chipText,
                    districtFilter === dist && styles.chipTextActive,
                  ]}
                >
                  📍 {dist === 'all' ? 'Quanh bạn (< 5km)' : dist}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>

        {loading ? (
          <ActivityIndicator size="large" color="#0D9488" style={{ marginTop: 30 }} />
        ) : matches.length === 0 ? (
          <View style={styles.emptyBox}>
            <Text style={styles.emptyTitle}>Chưa có kèo giao lưu nào khớp bộ lọc</Text>
            <Text style={styles.emptySub}>
              Hãy bấm "+ Tạo Kèo Mới" ở góc phải để tuyển đồng đội ngay!
            </Text>
          </View>
        ) : (
          matches.map((match) => {
            const creatorName = match.creator_id?.full_name || 'Chủ kèo';
            const currentCount = match.current_players?.length || 1;
            const isJoined = match.current_players?.some(
              (p: any) => String(p._id || p) === String(user?._id)
            );
            const slotsNeeded = Math.max(0, match.max_players - currentCount);

            return (
              <View key={match._id} style={styles.matchCard}>
                {/* Header chủ kèo & trạng thái */}
                <View style={styles.creatorRow}>
                  <Image
                    source={{ uri: match.creator_id?.avatar || BADMINTON_IMAGES.avatarMale1 }}
                    style={styles.creatorAvatarImg}
                  />
                  <View style={{ flex: 1, marginLeft: 10 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                      <Text style={styles.creatorName}>{creatorName}</Text>
                      <View style={styles.creatorBadge}>
                        <Text style={styles.creatorBadgeText}>Chủ kèo</Text>
                      </View>
                    </View>
                    <Text style={styles.matchMeta}>
                      📍 {match.district} • 📅 {match.scheduled_date} ({match.time_range})
                    </Text>
                  </View>
                  <View
                    style={[
                      styles.statusBadge,
                      match.status === 'full' && { backgroundColor: '#FEF3C7' },
                    ]}
                  >
                    <Text
                      style={[
                        styles.statusBadgeText,
                        match.status === 'full' && { color: '#B45309' },
                      ]}
                    >
                      {slotsNeeded > 0 ? `Cần thêm ${slotsNeeded} người` : 'Đã đủ người'}
                    </Text>
                  </View>
                </View>

                {/* Tiêu đề kèo */}
                <Text style={styles.matchTitle}>{match.title}</Text>
                <Text style={styles.matchLocation}>🏟️ {match.location_name}</Text>

                {match.notes ? (
                  <Text style={styles.matchNotes}>💬 {match.notes}</Text>
                ) : null}

                {/* Tags thông tin: Trình độ, Số người, Tiền share */}
                <View style={styles.tagsRow}>
                  <View style={styles.tagItem}>
                    <Text style={styles.tagLabel}>Trình độ yêu cầu</Text>
                    <Text style={styles.tagVal}>
                      {LEVEL_LABELS[match.required_level] || match.required_level}
                    </Text>
                  </View>
                  <View style={styles.tagItem}>
                    <Text style={styles.tagLabel}>Thành viên</Text>
                    <Text style={styles.tagVal}>
                      {currentCount}/{match.max_players} tay vợt
                    </Text>
                  </View>
                  <View style={styles.tagItem}>
                    <Text style={styles.tagLabel}>Share dự kiến</Text>
                    <Text style={[styles.tagVal, { color: '#0D9488' }]}>
                      {match.cost_per_person.toLocaleString('vi-VN')}đ/người
                    </Text>
                  </View>
                </View>

                {/* Thanh tiến độ số lượng người tham gia */}
                <View style={styles.progressWrap}>
                  <View style={styles.progressBarBg}>
                    <View
                      style={[
                        styles.progressBarFill,
                        {
                          width: `${Math.min(
                            100,
                            Math.round((currentCount / match.max_players) * 100)
                          )}%`,
                          backgroundColor:
                            currentCount >= match.max_players ? '#D97706' : '#0D9488',
                        },
                      ]}
                    />
                  </View>
                  <Text style={styles.progressText}>
                    {slotsNeeded > 0
                      ? `Đã có ${currentCount} người, cần thêm ${slotsNeeded} tay vợt nữa`
                      : 'Đã đủ thành viên, phòng chat đang trao đổi sôi nổi!'}
                  </Text>
                </View>

                {/* Nút Tham gia kèo & Mở phòng Chat */}
                <View style={styles.actionRow}>
                  <TouchableOpacity
                    style={[
                      styles.joinBtn,
                      isJoined && { backgroundColor: '#0284C7' },
                    ]}
                    onPress={() => handleJoinMatch(match)}
                  >
                    <Text style={styles.joinBtnText}>
                      {isJoined
                        ? '💬 Đã tham gia • Mở Phòng Chat'
                        : '⚡ Tham gia kèo & Vào Phòng Chat'}
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>
            );
          })
        )}
      </ScrollView>

      {/* Modal Tạo bài đăng ghép kèo mới */}
      <Modal
        visible={showCreateModal}
        animationType="slide"
        transparent
        onRequestClose={() => setShowCreateModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalBox}>
            <Text style={styles.modalTitle}>📝 Tạo Bài Đăng Ghép Kèo Mới</Text>
            <ScrollView style={{ maxHeight: 440 }}>
              <Text style={styles.inputLabel}>Tiêu đề bài đăng tuyển giao lưu *</Text>
              <TextInput
                style={styles.input}
                value={newTitle}
                onChangeText={setNewTitle}
                multiline
              />

              <Text style={styles.inputLabel}>Tên sân & Số sân đã đặt *</Text>
              <TextInput
                style={styles.input}
                value={newLocation}
                onChangeText={setNewLocation}
              />

              <View style={{ flexDirection: 'row', gap: 10 }}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.inputLabel}>Quận/Huyện</Text>
                  <TextInput
                    style={styles.input}
                    value={newDistrict}
                    onChangeText={setNewDistrict}
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.inputLabel}>Khung giờ thi đấu</Text>
                  <TextInput
                    style={styles.input}
                    value={newTimeRange}
                    onChangeText={setNewTimeRange}
                  />
                </View>
              </View>

              <Text style={styles.inputLabel}>Trình độ yêu cầu</Text>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
                {(['beginner', 'intermediate', 'advanced'] as SkillLevel[]).map(
                  (lv) => (
                    <TouchableOpacity
                      key={lv}
                      style={[
                        styles.chip,
                        newLevel === lv && styles.chipActive,
                      ]}
                      onPress={() => setNewLevel(lv)}
                    >
                      <Text
                        style={[
                          styles.chipText,
                          newLevel === lv && styles.chipTextActive,
                        ]}
                      >
                        {LEVEL_LABELS[lv]}
                      </Text>
                    </TouchableOpacity>
                  )
                )}
              </View>

              <View style={{ flexDirection: 'row', gap: 10 }}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.inputLabel}>Tổng số người tối đa</Text>
                  <TextInput
                    style={styles.input}
                    value={newMaxPlayers}
                    onChangeText={setNewMaxPlayers}
                    keyboardType="numeric"
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.inputLabel}>Tiền share dự kiến (VNĐ)</Text>
                  <TextInput
                    style={styles.input}
                    value={newCost}
                    onChangeText={setNewCost}
                    keyboardType="numeric"
                  />
                </View>
              </View>

              <Text style={styles.inputLabel}>Ghi chú thêm (Loại cầu, gửi xe...)</Text>
              <TextInput
                style={styles.input}
                value={newNotes}
                onChangeText={setNewNotes}
              />
            </ScrollView>

            <View style={{ flexDirection: 'row', gap: 10, marginTop: 14 }}>
              <TouchableOpacity
                style={styles.cancelModalBtn}
                onPress={() => setShowCreateModal(false)}
              >
                <Text style={styles.cancelModalBtnText}>Hủy</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.submitModalBtn}
                onPress={handleCreateMatch}
                disabled={creating}
              >
                {creating ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text style={styles.submitModalBtnText}>Đăng Kèo Ngay</Text>
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
  heroBannerWrap: {
    height: 160,
    borderRadius: 18,
    overflow: 'hidden',
    marginBottom: 14,
    position: 'relative',
    backgroundColor: '#0F172A',
  },
  heroBannerImg: {
    width: '100%',
    height: '100%',
    opacity: 0.75,
  },
  heroBannerOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    padding: 14,
    justifyContent: 'space-between',
    backgroundColor: 'rgba(15, 23, 42, 0.4)',
  },
  heroTagRow: {
    flexDirection: 'row',
    gap: 8,
  },
  heroTagBadge: {
    backgroundColor: '#0D9488',
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '800',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
  },
  heroTagOnline: {
    backgroundColor: '#D97706',
    color: '#FEF3C7',
    fontSize: 10,
    fontWeight: '800',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
  },
  heroHeading: {
    fontSize: 16,
    fontWeight: '900',
    color: '#FFFFFF',
    marginTop: 4,
  },
  heroSubheading: {
    fontSize: 11,
    color: '#CBD5E1',
    marginTop: 2,
    fontWeight: '500',
  },
  heroPostBtn: {
    backgroundColor: '#0D9488',
    alignSelf: 'flex-start',
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 8,
    marginTop: 6,
  },
  heroPostBtnText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '800',
  },
  creatorAvatarImg: {
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 2,
    borderColor: '#0D9488',
  },
  creatorBadge: {
    backgroundColor: '#CCFBF1',
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 4,
  },
  creatorBadgeText: {
    color: '#0F766E',
    fontSize: 9,
    fontWeight: '800',
  },
  progressWrap: {
    marginTop: 10,
    marginBottom: 6,
  },
  progressBarBg: {
    height: 6,
    backgroundColor: '#E2E8F0',
    borderRadius: 999,
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    borderRadius: 999,
  },
  progressText: {
    fontSize: 11,
    color: '#64748B',
    marginTop: 4,
    fontWeight: '600',
  },

  container: {
    flex: 1,
    backgroundColor: '#F1F5F9',
  },
  topHeader: {
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 16,
    paddingVertical: 12,
    flexDirection: 'row',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
  },
  topHeaderTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#0F172A',
  },
  topHeaderSub: {
    fontSize: 11,
    color: '#64748B',
    marginTop: 2,
  },
  createBtn: {
    backgroundColor: '#0D9488',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 12,
  },
  createBtnText: {
    color: '#FFFFFF',
    fontWeight: '800',
    fontSize: 12,
  },
  scrollContent: {
    padding: 14,
    paddingBottom: 30,
  },
  filterCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 12,
    marginBottom: 12,
  },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: '#F1F5F9',
    marginRight: 8,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  chipActive: {
    backgroundColor: '#0D9488',
    borderColor: '#0D9488',
  },
  chipText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#475569',
  },
  chipTextActive: {
    color: '#FFFFFF',
  },
  emptyBox: {
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
  matchCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  creatorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 10,
  },
  avatar: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: '#0D9488',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    color: '#FFFFFF',
    fontWeight: '800',
    fontSize: 14,
  },
  creatorName: {
    fontSize: 14,
    fontWeight: '800',
    color: '#0F172A',
  },
  matchMeta: {
    fontSize: 11,
    color: '#64748B',
    marginTop: 2,
  },
  statusBadge: {
    backgroundColor: '#DCFCE7',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
  },
  statusBadgeText: {
    color: '#15803D',
    fontSize: 11,
    fontWeight: '800',
  },
  matchTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: '#0F172A',
    lineHeight: 21,
  },
  matchLocation: {
    fontSize: 13,
    fontWeight: '700',
    color: '#0F766E',
    marginTop: 6,
  },
  matchNotes: {
    fontSize: 12,
    color: '#475569',
    marginTop: 4,
    fontStyle: 'italic',
  },
  tagsRow: {
    flexDirection: 'row',
    backgroundColor: '#F8FAFC',
    borderRadius: 12,
    padding: 10,
    marginTop: 12,
    justifyContent: 'space-between',
  },
  tagItem: {
    alignItems: 'center',
    flex: 1,
  },
  tagLabel: {
    fontSize: 10,
    color: '#64748B',
    fontWeight: '600',
  },
  tagVal: {
    fontSize: 12,
    fontWeight: '800',
    color: '#0F172A',
    marginTop: 2,
  },
  actionRow: {
    marginTop: 12,
  },
  joinBtn: {
    backgroundColor: '#0D9488',
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: 'center',
  },
  joinBtnText: {
    color: '#FFFFFF',
    fontWeight: '800',
    fontSize: 13,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.65)',
    justifyContent: 'center',
    padding: 16,
  },
  modalBox: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 18,
  },
  modalTitle: {
    fontSize: 17,
    fontWeight: '800',
    color: '#0F172A',
    marginBottom: 10,
  },
  inputLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: '#475569',
    marginTop: 8,
    marginBottom: 4,
  },
  input: {
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 9,
    fontSize: 13,
    color: '#0F172A',
  },
  cancelModalBtn: {
    flex: 1,
    backgroundColor: '#E2E8F0',
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: 'center',
  },
  cancelModalBtnText: {
    color: '#475569',
    fontWeight: '700',
  },
  submitModalBtn: {
    flex: 2,
    backgroundColor: '#0D9488',
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: 'center',
  },
  submitModalBtnText: {
    color: '#FFFFFF',
    fontWeight: '800',
  },
});

