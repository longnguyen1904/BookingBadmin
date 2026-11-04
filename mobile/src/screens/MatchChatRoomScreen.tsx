import React, { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TextInput,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  Alert,
  Image,
} from 'react-native';
import { BADMINTON_IMAGES } from '../constants/badmintonTheme';
import { useNavigation, useRoute } from '@react-navigation/native';
import { apiRequest, getSocket } from '../config/api';
import { useAuth } from '../context/AuthContext';
import { ChatMessage, MatchRequest } from '../types/models';

const QUICK_REPLIES = [
  '🛵 Chỗ gửi xe ở cổng nào anh em?',
  '👕 Mình mặc áo Yonex màu xanh nhé!',
  '⏰ Mình đang qua, 10 phút nữa có mặt ở sân!',
  '🏸 Nhờ anh em mang giúp 1 ống cầu nhé!',
  '🥤 Mình mang theo nước uống cho cả team rồi!',
];

export const MatchChatRoomScreen: React.FC = () => {
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const { user } = useAuth();
  const initialMatch: MatchRequest = route.params?.match;

  const [match, setMatch] = useState<MatchRequest>(initialMatch);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputText, setInputText] = useState('');
  const flatListRef = useRef<FlatList>(null);

  const matchId = match?._id;
  const isCreator =
    String(match?.creator_id?._id || match?.creator_id) === String(user?._id);

  // Tải lịch sử tin nhắn & kích hoạt Socket.io Room `match_<id>`
  useEffect(() => {
    if (!matchId) return;

    const loadMessages = async () => {
      try {
        const res = await apiRequest(`/api/matches/${matchId}/messages`);
        if (res.success && Array.isArray(res.messages)) {
          setMessages(
            res.messages.map((m: ChatMessage) => ({
              ...m,
              delivery_status: 'sent',
            }))
          );
        }
      } catch (_) {}
    };
    loadMessages();

    const socket = getSocket();
    socket.emit('join_match_room', {
      match_id: matchId,
      user_name: user?.full_name || 'Tay vợt',
    });

    const handleReceiveMessage = (incomingMsg: ChatMessage) => {
      if (String(incomingMsg.match_id) !== String(matchId)) return;

      setMessages((prev) => {
        // Nếu là tin nhắn vừa gửi đang ở trạng thái 'sending' (khớp client_temp_id), cập nhật sang 'sent'
        if (incomingMsg.client_temp_id) {
          const existsTemp = prev.some(
            (m) => m.client_temp_id === incomingMsg.client_temp_id
          );
          if (existsTemp) {
            return prev.map((m) =>
              m.client_temp_id === incomingMsg.client_temp_id
                ? { ...incomingMsg, delivery_status: 'sent' }
                : m
            );
          }
        }
        if (prev.some((m) => String(m._id) === String(incomingMsg._id))) {
          return prev;
        }
        return [...prev, { ...incomingMsg, delivery_status: 'sent' }];
      });
    };

    const handleMatchUpdated = (updatedMatch: MatchRequest) => {
      if (String(updatedMatch._id) === String(matchId)) {
        setMatch(updatedMatch);
      }
    };

    socket.on('receive_message', handleReceiveMessage);
    socket.on('match_updated', handleMatchUpdated);

    return () => {
      socket.emit('leave_match_room', { match_id: matchId });
      socket.off('receive_message', handleReceiveMessage);
      socket.off('match_updated', handleMatchUpdated);
    };
  }, [matchId, user?.full_name]);

  const sendMessage = async (textOverride?: string) => {
    const text = (textOverride ?? inputText).trim();
    if (!text || !matchId) return;

    const tempId = `temp_${Date.now()}`;
    const optimisticMsg: ChatMessage = {
      _id: tempId,
      client_temp_id: tempId,
      match_id: matchId,
      sender_id: user?._id,
      sender_name: user?.full_name || 'Bạn',
      content: text,
      message_type: 'text',
      created_at: new Date().toISOString(),
      delivery_status: 'sending',
    };

    setMessages((prev) => [...prev, optimisticMsg]);
    if (!textOverride) setInputText('');

    const socket = getSocket();
    if (socket.connected) {
      socket.emit(
        'send_message',
        {
          match_id: matchId,
          sender_id: user?._id,
          sender_name: user?.full_name,
          sender_avatar: user?.avatar,
          content: text,
          client_temp_id: tempId,
        },
        (ack: any) => {
          if (ack?.success) {
            setMessages((prev) =>
              prev.map((m) =>
                m.client_temp_id === tempId
                  ? { ...ack.message, delivery_status: 'sent' }
                  : m
              )
            );
          }
        }
      );
    } else {
      try {
        const res = await apiRequest(`/api/matches/${matchId}/messages`, {
          method: 'POST',
          body: JSON.stringify({ content: text, client_temp_id: tempId }),
        });
        if (res.success && res.message) {
          setMessages((prev) =>
            prev.map((m) =>
              m.client_temp_id === tempId
                ? { ...res.message, delivery_status: 'sent' }
                : m
            )
          );
        }
      } catch (_) {}
    }
  };

  const handleLeaveOrCancel = async (cancelMatch = false) => {
    try {
      const res = await apiRequest(`/api/matches/${matchId}/leave`, {
        method: 'POST',
        body: JSON.stringify({ cancel_match: cancelMatch }),
      });
      if (res.success) {
        Alert.alert('Thông báo', res.message, [
          { text: 'Quay lại Bảng tin', onPress: () => navigation.goBack() },
        ]);
      }
    } catch (error: any) {
      Alert.alert('Lỗi', error.message);
    }
  };

  const formatTime = (isoString: string) => {
    try {
      const d = new Date(isoString);
      return `${String(d.getHours()).padStart(2, '0')}:${String(
        d.getMinutes()
      ).padStart(2, '0')}`;
    } catch (_) {
      return '';
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={90}
    >
      {/* Header thông tin kèo & Room Socket.io */}
      <View style={styles.roomHeader}>
        <TouchableOpacity
          style={styles.backBtn}
          onPress={() => navigation.goBack()}
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
        >
          <Text style={styles.backBtnText}>←</Text>
        </TouchableOpacity>
        <Image
          source={{ uri: BADMINTON_IMAGES.courtDefault2 }}
          style={styles.headerCourtThumb}
          resizeMode="cover"
        />
        <View style={{ flex: 1 }}>
          <Text style={styles.roomTitle} numberOfLines={1}>
            {match?.title || 'Phòng Chat Trận Đấu'}
          </Text>
          <Text style={styles.roomSub}>
            🟢 {match?.location_name || 'Sân Cầu Lông'} •{' '}
            {match?.current_players?.length || 1}/{match?.max_players || 6} người
          </Text>
        </View>
        <TouchableOpacity
          style={styles.leaveBtn}
          onPress={() => handleLeaveOrCancel(isCreator)}
        >
          <Text style={styles.leaveBtnText}>
            {isCreator ? 'Hủy trận' : 'Rời nhóm'}
          </Text>
        </TouchableOpacity>
      </View>

      {/* Danh sách tin nhắn Real-time */}
      <FlatList
        ref={flatListRef}
        data={messages}
        keyExtractor={(item) => String(item._id || item.client_temp_id)}
        contentContainerStyle={styles.messageList}
        onContentSizeChange={() =>
          flatListRef.current?.scrollToEnd({ animated: true })
        }
        renderItem={({ item }) => {
          // Thông báo tự động của hệ thống trong box chat
          if (item.message_type === 'system_event') {
            return (
              <View style={styles.systemBubble}>
                <Text style={styles.systemText}>{item.content}</Text>
                <Text style={styles.systemTime}>{formatTime(item.created_at)}</Text>
              </View>
            );
          }

          const senderId =
            typeof item.sender_id === 'object' && item.sender_id
              ? item.sender_id._id
              : item.sender_id;
          const isMe = String(senderId) === String(user?._id);

          return (
            <View
              style={[
                styles.msgRow,
                isMe ? styles.msgRowRight : styles.msgRowLeft,
              ]}
            >
              {!isMe && (
                <Text style={styles.senderName}>{item.sender_name}</Text>
              )}
              <View style={[styles.bubbleWithAvatarRow, isMe && { justifyContent: 'flex-end' }]}>
                {!isMe && (
                  <Image
                    source={{ uri: item.sender_avatar || BADMINTON_IMAGES.avatarFemale1 }}
                    style={styles.chatAvatarSmall}
                  />
                )}
                <View
                  style={[
                    styles.msgBubble,
                    isMe ? styles.msgBubbleMe : styles.msgBubbleOther,
                  ]}
                >
                  <Text
                    style={[
                      styles.msgContent,
                      isMe ? { color: '#FFFFFF' } : { color: '#0F172A' },
                    ]}
                  >
                    {item.content}
                  </Text>
                </View>
              </View>
              <View style={styles.msgStatusRow}>
                <Text style={styles.msgTime}>{formatTime(item.created_at)}</Text>
                {isMe && (
                  <Text style={styles.msgStatusText}>
                    {item.delivery_status === 'sending'
                      ? '• Đang gửi...'
                      : '• Đã gửi ✓'}
                  </Text>
                )}
              </View>
            </View>
          );
        }}
      />

      {/* Chip gợi ý trao đổi nhanh (vị trí gửi xe, nhận diện áo, giờ đến) */}
      <View style={styles.quickReplyRow}>
        {QUICK_REPLIES.map((qr, idx) => (
          <TouchableOpacity
            key={idx}
            style={styles.quickChip}
            onPress={() => sendMessage(qr)}
          >
            <Text style={styles.quickChipText}>{qr}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Ô nhập tin nhắn */}
      <View style={styles.inputBar}>
        <TextInput
          style={styles.textInput}
          value={inputText}
          onChangeText={setInputText}
          placeholder="Nhắn vị trí gửi xe, màu áo thi đấu, giờ đến..."
          onSubmitEditing={() => sendMessage()}
        />
        <TouchableOpacity
          style={styles.sendBtn}
          onPress={() => sendMessage()}
        >
          <Text style={styles.sendBtnText}>Gửi ➤</Text>
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  backBtn: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    backgroundColor: '#F1F5F9',
    justifyContent: 'center',
    alignItems: 'center',
  },
  backBtnText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#0F172A',
  },
  headerCourtThumb: {
    width: 44,
    height: 44,
    borderRadius: 10,
    backgroundColor: '#E2E8F0',
  },
  bubbleWithAvatarRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 6,
  },
  chatAvatarSmall: {
    width: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#CBD5E1',
    marginBottom: 2,
  },

  container: {
    flex: 1,
    backgroundColor: '#F1F5F9',
  },
  roomHeader: {
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  roomTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: '#0F172A',
  },
  roomSub: {
    fontSize: 11,
    color: '#0D9488',
    fontWeight: '700',
    marginTop: 2,
  },
  leaveBtn: {
    backgroundColor: '#FEE2E2',
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 10,
  },
  leaveBtnText: {
    color: '#DC2626',
    fontSize: 11,
    fontWeight: '800',
  },
  messageList: {
    padding: 14,
    paddingBottom: 20,
  },
  systemBubble: {
    alignSelf: 'center',
    backgroundColor: '#E2E8F0',
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 999,
    marginVertical: 6,
    maxWidth: '90%',
    alignItems: 'center',
  },
  systemText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#334155',
    textAlign: 'center',
  },
  systemTime: {
    fontSize: 9,
    color: '#64748B',
    marginTop: 2,
  },
  msgRow: {
    marginVertical: 5,
    maxWidth: '80%',
  },
  msgRowRight: {
    alignSelf: 'flex-end',
    alignItems: 'flex-end',
  },
  msgRowLeft: {
    alignSelf: 'flex-start',
    alignItems: 'flex-start',
  },
  senderName: {
    fontSize: 11,
    fontWeight: '700',
    color: '#475569',
    marginBottom: 3,
    marginLeft: 4,
  },
  msgBubble: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 16,
  },
  msgBubbleMe: {
    backgroundColor: '#0D9488',
    borderBottomRightRadius: 4,
  },
  msgBubbleOther: {
    backgroundColor: '#FFFFFF',
    borderBottomLeftRadius: 4,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  msgContent: {
    fontSize: 14,
    lineHeight: 19,
  },
  msgStatusRow: {
    flexDirection: 'row',
    gap: 4,
    marginTop: 3,
    paddingHorizontal: 4,
  },
  msgTime: {
    fontSize: 10,
    color: '#64748B',
  },
  msgStatusText: {
    fontSize: 10,
    color: '#0D9488',
    fontWeight: '700',
  },
  quickReplyRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: 10,
    paddingVertical: 6,
    backgroundColor: '#F8FAFC',
    borderTopWidth: 1,
    borderTopColor: '#E2E8F0',
    gap: 6,
  },
  quickChip: {
    backgroundColor: '#E0F2FE',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
  },
  quickChipText: {
    fontSize: 11,
    color: '#0369A1',
    fontWeight: '600',
  },
  inputBar: {
    flexDirection: 'row',
    padding: 10,
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1,
    borderTopColor: '#CBD5E1',
    alignItems: 'center',
    gap: 8,
  },
  textInput: {
    flex: 1,
    backgroundColor: '#F1F5F9',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 14,
    color: '#0F172A',
  },
  sendBtn: {
    backgroundColor: '#0D9488',
    paddingHorizontal: 16,
    paddingVertical: 11,
    borderRadius: 12,
  },
  sendBtnText: {
    color: '#FFFFFF',
    fontWeight: '800',
    fontSize: 13,
  },
});

