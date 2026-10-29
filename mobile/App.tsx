import React from 'react';
import { ActivityIndicator, Text, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';

import { AuthProvider, useAuth } from './src/context/AuthContext';
import { AuthScreen } from './src/screens/AuthScreen';
import { CourtScheduleScreen } from './src/screens/CourtScheduleScreen';
import { CheckoutPaymentScreen } from './src/screens/CheckoutPaymentScreen';
import { MatchFeedScreen } from './src/screens/MatchFeedScreen';
import { MatchChatRoomScreen } from './src/screens/MatchChatRoomScreen';
import { BookingHistoryScreen } from './src/screens/BookingHistoryScreen';

const Stack = createNativeStackNavigator();
const Tab = createBottomTabNavigator();

function MainTabsNavigator() {
  return (
    <Tab.Navigator
      screenOptions={{
        headerStyle: { backgroundColor: '#0D9488' },
        headerTintColor: '#FFFFFF',
        headerTitleStyle: { fontWeight: '800', fontSize: 16 },
        tabBarActiveTintColor: '#0D9488',
        tabBarInactiveTintColor: '#64748B',
        tabBarStyle: {
          height: 62,
          paddingBottom: 8,
          paddingTop: 6,
          borderTopColor: '#E2E8F0',
        },
        tabBarLabelStyle: {
          fontSize: 11,
          fontWeight: '700',
        },
      }}
    >
      <Tab.Screen
        name="CourtSchedule"
        component={CourtScheduleScreen}
        options={{
          title: 'Đặt Sân Cầu Lông',
          tabBarLabel: 'Chọn Sân',
          tabBarIcon: () => <Text style={{ fontSize: 18 }}>🏟️</Text>,
        }}
      />
      <Tab.Screen
        name="MatchFeed"
        component={MatchFeedScreen}
        options={{
          title: 'Bảng Tin Ghép Kèo Giao Lưu',
          tabBarLabel: 'Ghép Kèo',
          tabBarIcon: () => <Text style={{ fontSize: 18 }}>🤝</Text>,
        }}
      />
      <Tab.Screen
        name="BookingHistory"
        component={BookingHistoryScreen}
        options={{
          title: 'Lịch Sử Đặt Sân & Vé QR',
          tabBarLabel: 'Vé QR & Lịch Sử',
          tabBarIcon: () => <Text style={{ fontSize: 18 }}>🎫</Text>,
        }}
      />
      <Tab.Screen
        name="AccountProfile"
        component={AuthScreen}
        options={{
          title: 'Hồ Sơ Tay Vợt & Tài Khoản',
          tabBarLabel: 'Tài Khoản',
          tabBarIcon: () => <Text style={{ fontSize: 18 }}>👤</Text>,
        }}
      />
    </Tab.Navigator>
  );
}

function RootNavigator() {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <View
        style={{
          flex: 1,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: '#F1F5F9',
        }}
      >
        <ActivityIndicator size="large" color="#0D9488" />
        <Text style={{ marginTop: 12, color: '#0F766E', fontWeight: '700' }}>
          Đang khôi phục phiên đăng nhập Badminton Booking...
        </Text>
      </View>
    );
  }

  return (
    <Stack.Navigator
      screenOptions={{
        headerStyle: { backgroundColor: '#0D9488' },
        headerTintColor: '#FFFFFF',
        headerTitleStyle: { fontWeight: '800', fontSize: 16 },
      }}
    >
      {!user ? (
        <Stack.Screen
          name="Auth"
          component={AuthScreen}
          options={{ title: 'Badminton Booking - Đăng Nhập / Đăng Ký' }}
        />
      ) : (
        <>
          <Stack.Screen
            name="MainTabs"
            component={MainTabsNavigator}
            options={{ headerShown: false }}
          />
          <Stack.Screen
            name="CheckoutPayment"
            component={CheckoutPaymentScreen}
            options={{
              title: 'Chi Tiết Đặt Sân & Thanh Toán Cọc',
            }}
          />
          <Stack.Screen
            name="MatchChatRoom"
            component={MatchChatRoomScreen}
            options={{
              title: 'Phòng Chat Trận Đấu (Real-time)',
            }}
          />
        </>
      )}
    </Stack.Navigator>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <NavigationContainer>
        <StatusBar style="light" />
        <RootNavigator />
      </NavigationContainer>
    </AuthProvider>
  );
}

