import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { io, Socket } from 'socket.io-client';

// Tự động nhận diện địa chỉ Backend:
// - Trên Web / iOS Simulator: http://localhost:5000
// - Trên Máy ảo Android (Android Studio Emulator): http://10.0.2.2:5000 (hoặc LAN IP 10.33.90.116:5000)
const DEFAULT_BASE_URL =
  Platform.OS === 'web'
    ? 'http://localhost:5000'
    : 'http://10.33.90.116:5000';

let currentBaseUrl = DEFAULT_BASE_URL;
let socketInstance: Socket | null = null;

export const getBaseUrl = () => currentBaseUrl;

export const setBaseUrl = async (newUrl: string) => {
  const cleaned = newUrl.replace(/\/+$/, '');
  currentBaseUrl = cleaned;
  await AsyncStorage.setItem('bc_server_url', cleaned);
  if (socketInstance) {
    socketInstance.disconnect();
    socketInstance = null;
  }
};

export const initBaseUrl = async () => {
  try {
    const saved = await AsyncStorage.getItem('bc_server_url');
    if (saved) {
      currentBaseUrl = saved;
    }
  } catch (_) {}
  return currentBaseUrl;
};

export const getSocket = (): Socket => {
  if (!socketInstance) {
    socketInstance = io(currentBaseUrl, {
      transports: ['websocket', 'polling'],
      reconnection: true,
    });
  }
  return socketInstance;
};

export async function apiRequest<T = any>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const token = await AsyncStorage.getItem('bc_jwt_token');
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string>),
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const url = `${currentBaseUrl}${endpoint.startsWith('/') ? endpoint : '/' + endpoint}`;

  try {
    const response = await fetch(url, {
      ...options,
      headers,
    });
    const data = await response.json();
    return data as T;
  } catch (error: any) {
    // Fallback thử sang 10.0.2.2:5000 hoặc localhost:5000 nếu kết nối LAN gặp sự cố trên máy ảo
    const fallbackUrls = ['http://10.0.2.2:5000', 'http://localhost:5000'];
    for (const fb of fallbackUrls) {
      if (fb === currentBaseUrl) continue;
      try {
        const res2 = await fetch(`${fb}${endpoint}`, { ...options, headers });
        const data2 = await res2.json();
        currentBaseUrl = fb;
        return data2 as T;
      } catch (_) {}
    }
    throw new Error(
      error?.message || 'Không thể kết nối tới Backend Server. Hãy kiểm tra IP máy chủ!'
    );
  }
}

