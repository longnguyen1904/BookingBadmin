import React, { createContext, useContext, useEffect, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { User, UserProfile } from '../types/models';
import { apiRequest, initBaseUrl } from '../config/api';

interface RegisterPayload {
  full_name: string;
  email: string;
  password: string;
  phone: string;
  profile: UserProfile;
}

interface AuthContextType {
  user: User | null;
  token: string | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<{ success: boolean; message: string }>;
  register: (payload: RegisterPayload) => Promise<{ success: boolean; message: string }>;
  updateProfile: (payload: Partial<User> & { profile?: UserProfile }) => Promise<{ success: boolean; message: string }>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  token: null,
  loading: true,
  login: async () => ({ success: false, message: '' }),
  register: async () => ({ success: false, message: '' }),
  updateProfile: async () => ({ success: false, message: '' }),
  logout: async () => {},
});

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    const restoreSession = async () => {
      try {
        await initBaseUrl();
        const savedToken = await AsyncStorage.getItem('bc_jwt_token');
        const savedUser = await AsyncStorage.getItem('bc_user_info');

        if (savedToken && savedUser) {
          setToken(savedToken);
          setUser(JSON.parse(savedUser));
          // Làm mới thông tin user từ server
          const res = await apiRequest('/api/auth/me');
          if (res?.success && res.user) {
            setUser(res.user);
            await AsyncStorage.setItem('bc_user_info', JSON.stringify(res.user));
          }
        }
      } catch (_) {
      } finally {
        setLoading(false);
      }
    };
    restoreSession();
  }, []);

  const login = async (email: string, password: string) => {
    try {
      const res = await apiRequest('/api/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email, password }),
      });

      if (res.success && res.token && res.user) {
        setToken(res.token);
        setUser(res.user);
        await AsyncStorage.setItem('bc_jwt_token', res.token);
        await AsyncStorage.setItem('bc_user_info', JSON.stringify(res.user));
        return { success: true, message: res.message || 'Đăng nhập thành công' };
      }
      return { success: false, message: res.message || 'Đăng nhập thất bại' };
    } catch (error: any) {
      return { success: false, message: error.message || 'Lỗi kết nối máy chủ' };
    }
  };

  const register = async (payload: RegisterPayload) => {
    try {
      const res = await apiRequest('/api/auth/register', {
        method: 'POST',
        body: JSON.stringify(payload),
      });

      if (res.success && res.token && res.user) {
        setToken(res.token);
        setUser(res.user);
        await AsyncStorage.setItem('bc_jwt_token', res.token);
        await AsyncStorage.setItem('bc_user_info', JSON.stringify(res.user));
        return { success: true, message: res.message || 'Đăng ký thành công' };
      }
      return { success: false, message: res.message || 'Đăng ký thất bại' };
    } catch (error: any) {
      return { success: false, message: error.message || 'Lỗi kết nối máy chủ' };
    }
  };

  const updateProfile = async (payload: Partial<User> & { profile?: UserProfile }) => {
    try {
      const res = await apiRequest('/api/auth/profile', {
        method: 'PUT',
        body: JSON.stringify(payload),
      });

      if (res.success && res.user) {
        setUser(res.user);
        await AsyncStorage.setItem('bc_user_info', JSON.stringify(res.user));
        return { success: true, message: res.message || 'Đã cập nhật hồ sơ' };
      }
      return { success: false, message: res.message || 'Cập nhật thất bại' };
    } catch (error: any) {
      return { success: false, message: error.message || 'Lỗi kết nối' };
    }
  };

  const logout = async () => {
    setToken(null);
    setUser(null);
    await AsyncStorage.removeItem('bc_jwt_token');
    await AsyncStorage.removeItem('bc_user_info');
  };

  return (
    <AuthContext.Provider value={{ user, token, loading, login, register, updateProfile, logout }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);

