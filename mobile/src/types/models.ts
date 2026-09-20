export type SkillLevel = 'beginner' | 'intermediate' | 'advanced' | 'pro';
export type DominantHand = 'left' | 'right';
export type PreferredPlay = 'single' | 'double';

export interface UserProfile {
  skill_level: SkillLevel;
  dominant_hand: DominantHand;
  preferred_play: PreferredPlay;
}

export interface User {
  _id: string;
  full_name: string;
  email: string;
  phone: string;
  avatar?: string;
  role: 'user' | 'court_owner' | 'admin';
  profile: UserProfile;
}

export interface SubCourt {
  _id?: string;
  sub_court_id: string;
  court_number: string;
  is_active: boolean;
}

export interface ExtraService {
  service_id: string;
  name: string;
  price: number;
  unit: string;
  quantity?: number;
}

export interface CourtReview {
  _id?: string;
  user_id: string;
  user_name: string;
  rating: number;
  comment: string;
  created_at: string;
}

export interface Court {
  _id: string;
  name: string;
  address: string;
  district: string;
  city: string;
  images: string[];
  open_time: string;
  close_time: string;
  hourly_rate: number;
  peak_hour_rate: number;
  peak_hours: {
    start: string;
    end: string;
  };
  carpet_type: string;
  court_type: 'indoor' | 'outdoor';
  amenities: string[];
  extra_services: ExtraService[];
  sub_courts: SubCourt[];
  rating_avg: number;
  rating_count: number;
  reviews?: CourtReview[];
}

export interface TimeSlot {
  _id: string;
  court_id: string;
  sub_court_id: string;
  sub_court_name: string;
  date: string;
  start_time: string;
  end_time: string;
  price: number;
  is_peak_hour: boolean;
  status: 'available' | 'locked' | 'booked';
  locked_by?: string | null;
  lock_expires_at?: string | null;
  booking_id?: string | null;
}

export interface Booking {
  _id: string;
  booking_code: string;
  user_id: string;
  court_id: Court | any;
  sub_court_id: string;
  sub_court_name: string;
  booking_date: string;
  start_time: string;
  end_time: string;
  slots: string[];
  slot_ids: string[];
  extra_services: {
    service_id: string;
    name: string;
    quantity: number;
    price: number;
  }[];
  court_fee: number;
  services_fee: number;
  total_amount: number;
  deposit_paid: number;
  status: 'locked_pending' | 'confirmed' | 'completed' | 'cancelled';
  lock_expires_at?: string | null;
  payment_info?: {
    transaction_id: string;
    payment_method: 'VNPAY' | 'MOMO' | 'CASH';
    pay_time?: string;
  };
  qr_checkin_code?: string;
  checked_in_at?: string;
  cancel_reason?: string;
  penalty_amount?: number;
  is_reviewed?: boolean;
  created_at?: string;
}

export interface MatchRequest {
  _id: string;
  creator_id: User;
  booking_id?: string | null;
  court_id?: string | null;
  title: string;
  location_name: string;
  district: string;
  scheduled_date: string;
  scheduled_time: string;
  time_range: string;
  required_level: SkillLevel | 'all';
  max_players: number;
  current_players: User[];
  cost_per_person: number;
  notes?: string;
  status: 'open' | 'full' | 'cancelled';
  created_at?: string;
}

export interface ChatMessage {
  _id: string;
  match_id: string;
  sender_id?: User | string | null;
  sender_name: string;
  sender_avatar?: string;
  content: string;
  message_type: 'text' | 'system_event';
  created_at: string;
  client_temp_id?: string | null;
  delivery_status?: 'sending' | 'sent';
}

