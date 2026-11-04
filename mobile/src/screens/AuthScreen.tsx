import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Alert,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Image,
} from 'react-native';
import { BADMINTON_IMAGES } from '../constants/badmintonTheme';
import { useAuth } from '../context/AuthContext';
import { DominantHand, PreferredPlay, SkillLevel } from '../types/models';
import { getBaseUrl, setBaseUrl } from '../config/api';

const SKILL_OPTIONS: { value: SkillLevel; label: string }[] = [
  { value: 'beginner', label: 'Mới chơi' },
  { value: 'intermediate', label: 'Trung bình' },
  { value: 'advanced', label: 'Khá' },
  { value: 'pro', label: 'Chuyên nghiệp' },
];

const HAND_OPTIONS: { value: DominantHand; label: string }[] = [
  { value: 'right', label: 'Tay phải' },
  { value: 'left', label: 'Tay trái' },
];

const PLAY_OPTIONS: { value: PreferredPlay; label: string }[] = [
  { value: 'double', label: 'Đánh đôi' },
  { value: 'single', label: 'Đánh đơn' },
];

export const AuthScreen: React.FC = () => {
  const { user, login, register, updateProfile, logout } = useAuth();

  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [email, setEmail] = useState('quan@gmail.com');
  const [password, setPassword] = useState('123456');
  const [fullName, setFullName] = useState(user?.full_name || '');
  const [phone, setPhone] = useState(user?.phone || '');
  const [skillLevel, setSkillLevel] = useState<SkillLevel>(
    user?.profile?.skill_level || 'intermediate'
  );
  const [dominantHand, setDominantHand] = useState<DominantHand>(
    user?.profile?.dominant_hand || 'right'
  );
  const [preferredPlay, setPreferredPlay] = useState<PreferredPlay>(
    user?.profile?.preferred_play || 'double'
  );

  const [serverUrl, setServerUrl] = useState(getBaseUrl());
  const [showServerConfig, setShowServerConfig] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const handleSaveServerUrl = async () => {
    if (!serverUrl.trim()) return;
    await setBaseUrl(serverUrl.trim());
    Alert.alert('Đã lưu cấu hình', `Đã trỏ API về: ${getBaseUrl()}`);
    setShowServerConfig(false);
  };

  // Nếu người dùng đã đăng nhập -> Hiển thị màn hình Quản lý Tài khoản & Hồ sơ người chơi
  if (user) {
    const handleUpdate = async () => {
      setSubmitting(true);
      const res = await updateProfile({
        full_name: fullName || user.full_name,
        phone: phone || user.phone,
        profile: {
          skill_level: skillLevel,
          dominant_hand: dominantHand,
          preferred_play: preferredPlay,
        },
      });
      setSubmitting(false);
      Alert.alert(res.success ? 'Thành công' : 'Thông báo', res.message);
    };

    return (
      <ScrollView style={styles.container} contentContainerStyle={styles.scrollContent}>
        <View style={styles.profileHeader}>
          <Image
            source={{ uri: user.avatar || BADMINTON_IMAGES.avatarMale1 }}
            style={styles.profileAvatarImg}
          />
          <Text style={styles.profileName}>{user.full_name}</Text>
          <Text style={styles.profileEmail}>{user.email}</Text>

          <View style={styles.playerMetaBadges}>
            <Text style={styles.playerBadge}>
              🏸 {SKILL_OPTIONS.find((s) => s.value === (user.profile?.skill_level || skillLevel))?.label || 'Trung bình'}
            </Text>
            <Text style={styles.playerBadge}>
              ✋ {HAND_OPTIONS.find((h) => h.value === (user.profile?.dominant_hand || dominantHand))?.label || 'Tay phải'}
            </Text>
            <Text style={styles.playerBadge}>
              👥 {PLAY_OPTIONS.find((p) => p.value === (user.profile?.preferred_play || preferredPlay))?.label || 'Đánh đôi'}
            </Text>
          </View>

          {/* Thống kê thành tích tay vợt */}
          <View style={styles.statsCardRow}>
            <View style={styles.statBox}>
              <Text style={styles.statNum}>12</Text>
              <Text style={styles.statLabel}>Trận đã chơi</Text>
            </View>
            <View style={styles.statBox}>
              <Text style={styles.statNum}>4.9 ⭐</Text>
              <Text style={styles.statLabel}>Đánh giá</Text>
            </View>
            <View style={styles.statBox}>
              <Text style={styles.statNum}>100%</Text>
              <Text style={styles.statLabel}>Uy tín</Text>
            </View>
          </View>

          <View style={styles.jwtBadge}>
            <Text style={styles.jwtBadgeText}>🔒 Phiên JWT Đang Hoạt Động (AsyncStorage)</Text>
          </View>
        </View>

        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Thông tin cá nhân & Hồ sơ tay vợt</Text>

          <Text style={styles.label}>Họ và tên</Text>
          <TextInput
            style={styles.input}
            defaultValue={user.full_name}
            onChangeText={setFullName}
            placeholder="Nhập họ và tên"
          />

          <Text style={styles.label}>Số điện thoại</Text>
          <TextInput
            style={styles.input}
            defaultValue={user.phone}
            onChangeText={setPhone}
            keyboardType="phone-pad"
            placeholder="Nhập số điện thoại"
          />

          <Text style={styles.label}>Trình độ chơi cầu lông</Text>
          <View style={styles.chipRow}>
            {SKILL_OPTIONS.map((opt) => (
              <TouchableOpacity
                key={opt.value}
                style={[styles.chip, skillLevel === opt.value && styles.chipActive]}
                onPress={() => setSkillLevel(opt.value)}
              >
                <Text
                  style={[
                    styles.chipText,
                    skillLevel === opt.value && styles.chipTextActive,
                  ]}
                >
                  {opt.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          <Text style={styles.label}>Tay thuận</Text>
          <View style={styles.chipRow}>
            {HAND_OPTIONS.map((opt) => (
              <TouchableOpacity
                key={opt.value}
                style={[styles.chip, dominantHand === opt.value && styles.chipActive]}
                onPress={() => setDominantHand(opt.value)}
              >
                <Text
                  style={[
                    styles.chipText,
                    dominantHand === opt.value && styles.chipTextActive,
                  ]}
                >
                  {opt.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          <Text style={styles.label}>Vị trí sở trường</Text>
          <View style={styles.chipRow}>
            {PLAY_OPTIONS.map((opt) => (
              <TouchableOpacity
                key={opt.value}
                style={[styles.chip, preferredPlay === opt.value && styles.chipActive]}
                onPress={() => setPreferredPlay(opt.value)}
              >
                <Text
                  style={[
                    styles.chipText,
                    preferredPlay === opt.value && styles.chipTextActive,
                  ]}
                >
                  {opt.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          <TouchableOpacity
            style={styles.primaryBtn}
            onPress={handleUpdate}
            disabled={submitting}
          >
            {submitting ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.primaryBtnText}>Lưu hồ sơ cá nhân</Text>
            )}
          </TouchableOpacity>

          <TouchableOpacity style={styles.logoutBtn} onPress={logout}>
            <Text style={styles.logoutBtnText}>Đăng xuất tài khoản</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    );
  }

  const handleSubmit = async () => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email.trim())) {
      Alert.alert('Lỗi định dạng', 'Vui lòng nhập đúng định dạng Email (Regex validation)!');
      return;
    }
    if (password.length < 6) {
      Alert.alert('Lỗi mật khẩu', 'Mật khẩu phải từ 6 ký tự trở lên!');
      return;
    }

    setSubmitting(true);
    if (mode === 'login') {
      const res = await login(email.trim(), password);
      setSubmitting(false);
      if (!res.success) {
        Alert.alert('Đăng nhập thất bại', res.message);
      }
    } else {
      if (!fullName.trim() || !phone.trim()) {
        setSubmitting(false);
        Alert.alert('Thiếu thông tin', 'Vui lòng nhập đầy đủ Họ tên và Số điện thoại!');
        return;
      }
      const res = await register({
        full_name: fullName.trim(),
        email: email.trim(),
        password,
        phone: phone.trim(),
        profile: {
          skill_level: skillLevel,
          dominant_hand: dominantHand,
          preferred_play: preferredPlay,
        },
      });
      setSubmitting(false);
      if (!res.success) {
        Alert.alert('Đăng ký thất bại', res.message);
      }
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <View style={styles.authHeroBanner}>
          <Image
            source={{ uri: BADMINTON_IMAGES.authHero }}
            style={styles.authHeroImg}
            resizeMode="cover"
          />
          <View style={styles.authHeroOverlay}>
            <Text style={styles.authHeroBadge}>🏸 Badminton Connect</Text>
            <Text style={styles.authHeroTitle}>Đam Mê Cầu Lông • Kết Nối Tay Vợt</Text>
            <Text style={styles.authHeroSub}>
              Đặt sân chuẩn BWF nhanh chóng • Ghép kèo sòng phẳng, vui vẻ
            </Text>
          </View>
        </View>

        <View style={styles.card}>
          <View style={styles.tabSwitch}>
            <TouchableOpacity
              style={[styles.tabBtn, mode === 'login' && styles.tabBtnActive]}
              onPress={() => setMode('login')}
            >
              <Text
                style={[styles.tabBtnText, mode === 'login' && styles.tabBtnTextActive]}
              >
                Đăng nhập
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.tabBtn, mode === 'register' && styles.tabBtnActive]}
              onPress={() => setMode('register')}
            >
              <Text
                style={[
                  styles.tabBtnText,
                  mode === 'register' && styles.tabBtnTextActive,
                ]}
              >
                Đăng ký mới
              </Text>
            </TouchableOpacity>
          </View>

          {mode === 'register' && (
            <>
              <Text style={styles.label}>Họ và tên *</Text>
              <TextInput
                style={styles.input}
                value={fullName}
                onChangeText={setFullName}
                placeholder="VD: Nguyễn Minh Quân"
              />

              <Text style={styles.label}>Số điện thoại *</Text>
              <TextInput
                style={styles.input}
                value={phone}
                onChangeText={setPhone}
                keyboardType="phone-pad"
                placeholder="VD: 0988112233"
              />
            </>
          )}

          <Text style={styles.label}>Địa chỉ Email *</Text>
          <TextInput
            style={styles.input}
            value={email}
            onChangeText={setEmail}
            autoCapitalize="none"
            keyboardType="email-address"
            placeholder="email@example.com"
          />

          <Text style={styles.label}>Mật khẩu (băm bcrypt) *</Text>
          <TextInput
            style={styles.input}
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            placeholder="••••••••"
          />

          {mode === 'register' && (
            <>
              <Text style={styles.label}>Trình độ chơi</Text>
              <View style={styles.chipRow}>
                {SKILL_OPTIONS.map((opt) => (
                  <TouchableOpacity
                    key={opt.value}
                    style={[styles.chip, skillLevel === opt.value && styles.chipActive]}
                    onPress={() => setSkillLevel(opt.value)}
                  >
                    <Text
                      style={[
                        styles.chipText,
                        skillLevel === opt.value && styles.chipTextActive,
                      ]}
                    >
                      {opt.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              <Text style={styles.label}>Tay thuận</Text>
              <View style={styles.chipRow}>
                {HAND_OPTIONS.map((opt) => (
                  <TouchableOpacity
                    key={opt.value}
                    style={[styles.chip, dominantHand === opt.value && styles.chipActive]}
                    onPress={() => setDominantHand(opt.value)}
                  >
                    <Text
                      style={[
                        styles.chipText,
                        dominantHand === opt.value && styles.chipTextActive,
                      ]}
                    >
                      {opt.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              <Text style={styles.label}>Vị trí sở trường</Text>
              <View style={styles.chipRow}>
                {PLAY_OPTIONS.map((opt) => (
                  <TouchableOpacity
                    key={opt.value}
                    style={[
                      styles.chip,
                      preferredPlay === opt.value && styles.chipActive,
                    ]}
                    onPress={() => setPreferredPlay(opt.value)}
                  >
                    <Text
                      style={[
                        styles.chipText,
                        preferredPlay === opt.value && styles.chipTextActive,
                      ]}
                    >
                      {opt.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </>
          )}

          <TouchableOpacity
            style={styles.primaryBtn}
            onPress={handleSubmit}
            disabled={submitting}
          >
            {submitting ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.primaryBtnText}>
                {mode === 'login' ? 'Đăng nhập vào hệ thống' : 'Tạo tài khoản & Lưu hồ sơ'}
              </Text>
            )}
          </TouchableOpacity>

          {mode === 'login' && (
            <View style={styles.demoBox}>
              <Text style={styles.demoTitle}>Tài khoản mẫu có sẵn (Chạm để điền nhanh):</Text>
              <View style={styles.demoRow}>
                <TouchableOpacity
                  style={styles.demoChip}
                  onPress={() => {
                    setEmail('quan@gmail.com');
                    setPassword('123456');
                  }}
                >
                  <Text style={styles.demoChipText}>👤 Minh Quân (User 1)</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.demoChip}
                  onPress={() => {
                    setEmail('nam@gmail.com');
                    setPassword('123456');
                  }}
                >
                  <Text style={styles.demoChipText}>👤 Hoàng Nam (User 2)</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}
        </View>

        {/* Cấu hình địa chỉ IP Backend cho thiết bị thật / máy ảo */}
        <TouchableOpacity
          style={styles.serverConfigToggle}
          onPress={() => setShowServerConfig(!showServerConfig)}
        >
          <Text style={styles.serverConfigToggleText}>
            ⚙️ Máy chủ API: {getBaseUrl()} (Chạm để đổi IP)
          </Text>
        </TouchableOpacity>

        {showServerConfig && (
          <View style={styles.card}>
            <Text style={styles.label}>Địa chỉ Backend API (Dùng IP LAN khi chạy máy thật)</Text>
            <TextInput
              style={styles.input}
              value={serverUrl}
              onChangeText={setServerUrl}
              autoCapitalize="none"
              placeholder="http://10.33.90.116:5000"
            />
            <TouchableOpacity style={styles.secondaryBtn} onPress={handleSaveServerUrl}>
              <Text style={styles.secondaryBtnText}>Lưu địa chỉ Server</Text>
            </TouchableOpacity>
          </View>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  profileAvatarImg: {
    width: 80,
    height: 80,
    borderRadius: 40,
    borderWidth: 3,
    borderColor: '#0D9488',
    marginBottom: 8,
  },
  playerMetaBadges: {
    flexDirection: 'row',
    gap: 6,
    marginTop: 8,
    marginBottom: 10,
  },
  playerBadge: {
    backgroundColor: '#CCFBF1',
    color: '#0F766E',
    fontSize: 11,
    fontWeight: '700',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  statsCardRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    width: '100%',
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    paddingVertical: 10,
    paddingHorizontal: 16,
    marginVertical: 10,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  statBox: {
    alignItems: 'center',
    flex: 1,
  },
  statNum: {
    fontSize: 16,
    fontWeight: '900',
    color: '#0D9488',
  },
  statLabel: {
    fontSize: 11,
    color: '#64748B',
    marginTop: 2,
    fontWeight: '600',
  },
  authHeroBanner: {
    height: 150,
    borderRadius: 18,
    overflow: 'hidden',
    marginBottom: 14,
    position: 'relative',
    backgroundColor: '#0F172A',
  },
  authHeroImg: {
    width: '100%',
    height: '100%',
    opacity: 0.72,
  },
  authHeroOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    padding: 14,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(15, 23, 42, 0.45)',
  },
  authHeroBadge: {
    backgroundColor: '#0D9488',
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '800',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 999,
    alignSelf: 'flex-start',
    marginBottom: 6,
  },
  authHeroTitle: {
    fontSize: 17,
    fontWeight: '900',
    color: '#FFFFFF',
  },
  authHeroSub: {
    fontSize: 11,
    color: '#E2E8F0',
    marginTop: 2,
    fontWeight: '500',
  },
  quickTestBox: {
    marginTop: 14,
    padding: 10,
    backgroundColor: '#F8FAFC',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  quickTestTitle: {
    fontSize: 11,
    fontWeight: '800',
    color: '#475569',
    marginBottom: 6,
  },
  quickTestRow: {
    gap: 6,
  },
  quickTestBtn: {
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#CBD5E1',
  },
  quickTestBtnText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#0F766E',
  },

  container: {
    flex: 1,
    backgroundColor: '#F1F5F9',
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 40,
  },
  brandBanner: {
    backgroundColor: '#0D9488',
    borderRadius: 20,
    padding: 24,
    alignItems: 'center',
    marginBottom: 16,
  },
  brandEmoji: {
    fontSize: 40,
    marginBottom: 6,
  },
  brandTitle: {
    fontSize: 24,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  brandSubtitle: {
    fontSize: 13,
    color: '#CCFBF1',
    textAlign: 'center',
    marginTop: 4,
  },
  profileHeader: {
    backgroundColor: '#0D9488',
    borderRadius: 20,
    padding: 24,
    alignItems: 'center',
    marginBottom: 16,
  },
  avatarCircle: {
    width: 68,
    height: 68,
    borderRadius: 34,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
  },
  avatarText: {
    fontSize: 24,
    fontWeight: '800',
    color: '#0D9488',
  },
  profileName: {
    fontSize: 20,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  profileEmail: {
    fontSize: 13,
    color: '#CCFBF1',
    marginTop: 2,
  },
  jwtBadge: {
    marginTop: 10,
    backgroundColor: 'rgba(255,255,255,0.18)',
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 999,
  },
  jwtBadgeText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '600',
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    padding: 18,
    marginBottom: 14,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#0F172A',
    marginBottom: 14,
  },
  tabSwitch: {
    flexDirection: 'row',
    backgroundColor: '#F1F5F9',
    borderRadius: 12,
    padding: 4,
    marginBottom: 16,
  },
  tabBtn: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 10,
    alignItems: 'center',
  },
  tabBtnActive: {
    backgroundColor: '#0D9488',
  },
  tabBtnText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#64748B',
  },
  tabBtnTextActive: {
    color: '#FFFFFF',
  },
  label: {
    fontSize: 12,
    fontWeight: '700',
    color: '#475569',
    marginBottom: 6,
    marginTop: 8,
  },
  input: {
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 11,
    fontSize: 14,
    color: '#0F172A',
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 2,
  },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#CBD5E1',
    backgroundColor: '#F8FAFC',
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
  primaryBtn: {
    backgroundColor: '#0D9488',
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 20,
  },
  primaryBtnText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '800',
  },
  secondaryBtn: {
    backgroundColor: '#0284C7',
    borderRadius: 10,
    paddingVertical: 11,
    alignItems: 'center',
    marginTop: 10,
  },
  secondaryBtnText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 13,
  },
  logoutBtn: {
    backgroundColor: '#FEE2E2',
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
    marginTop: 12,
  },
  logoutBtnText: {
    color: '#DC2626',
    fontWeight: '700',
    fontSize: 14,
  },
  demoBox: {
    marginTop: 16,
    paddingTop: 14,
    borderTopWidth: 1,
    borderTopColor: '#E2E8F0',
  },
  demoTitle: {
    fontSize: 12,
    color: '#64748B',
    fontWeight: '600',
    marginBottom: 8,
  },
  demoRow: {
    flexDirection: 'row',
    gap: 8,
  },
  demoChip: {
    flex: 1,
    backgroundColor: '#F0FDFA',
    borderWidth: 1,
    borderColor: '#99F6E4',
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderRadius: 10,
    alignItems: 'center',
  },
  demoChipText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#0F766E',
  },
  serverConfigToggle: {
    alignItems: 'center',
    paddingVertical: 8,
  },
  serverConfigToggleText: {
    fontSize: 12,
    color: '#64748B',
    fontWeight: '600',
  },
});

