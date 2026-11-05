export type BranchId = 'CSE' | 'CSE-AI' | 'Civil' | 'Civil-CA' | 'Mechanical' | string;

export interface Branch {
  id: string;
  name: string;
  short_name?: string;
  shortName?: string;
  code: string;
  color?: string;
  bgLight?: string;
  bgDark?: string;
  borderLight?: string;
  borderDark?: string;
  textLight?: string;
  textDark?: string;
}

export interface Semester {
  id: string; // e.g. 'SEM1' ... 'SEM8'
  name: string; // e.g. 'Semester 1'
  number: number;
}

export interface Professor {
  id: string;
  name: string;
  email?: string;
  department?: string;
}

export interface Subject {
  id: string; // code e.g. 'CS501'
  name: string;
  code: string;
  branch_id?: string;
  semester_id?: string;
}

export type RoomType = 'classroom' | 'lab' | 'hall' | 'workshop';

export interface Room {
  id: string;
  name: string;
  type: RoomType;
  capacity: number;
  floor: number | string;
  building?: string;
  is_under_maintenance?: boolean;
  isMaintenance?: boolean;
}

export interface Period {
  id: number | string;
  period_number?: number;
  order: number;
  start: string; // "09:00"
  end: string;   // "09:55"
  start_time?: string;
  end_time?: string;
  label: string; // "Period 1" or "Lunch Break"
  is_break?: boolean;
  isBreak?: boolean;
}

export type ClassType = 'Lecture' | 'Lab' | 'Tutorial';

export type DayOfWeek = 'Monday' | 'Tuesday' | 'Wednesday' | 'Thursday' | 'Friday' | 'Saturday';

export interface TimetableSlot {
  id: string;
  branch: string;
  branch_id?: string;
  semester?: string;
  semester_id?: string;
  day: DayOfWeek;
  day_of_week?: number; // 1=Mon ... 7=Sun
  periodId: number | string;
  subject: string;
  subject_id?: string;
  teacher: string;
  professor_id?: string;
  roomId: string;
  classroom_id?: string;
  type: ClassType;
  class_type?: ClassType;
  notes?: string;
  is_published?: boolean;
  start_time?: string;
  end_time?: string;
}

export type HolidayType = 'holiday' | 'vacation' | 'exam' | 'sunday';

export interface Holiday {
  id: string;
  startDate: string; // "YYYY-MM-DD"
  endDate: string;   // "YYYY-MM-DD"
  start_date?: string;
  end_date?: string;
  title: string;
  type: HolidayType;
  description?: string;
  greeting?: string;
  banner_url?: string;
  is_whole_college?: boolean;
  branches?: string[];
}

export interface Announcement {
  id: string;
  title: string;
  body: string;
  kind: 'academic' | 'exam' | 'cultural' | 'administrative' | 'emergency';
  is_emergency: boolean;
  closes_college: boolean;
  branch_id?: string | null;
  starts_at: string;
  expires_at: string;
  created_at?: string;
}

// Notice alias for UI compatibility
export interface Notice {
  id: string;
  title: string;
  content: string;
  priority: 'normal' | 'urgent' | 'info';
  startDate: string;
  endDate: string;
  active: boolean;
  is_emergency?: boolean;
  closes_college?: boolean;
}

export interface CollegeSettings {
  id: string;
  college_name: string;
  logo_url?: string;
  timezone: string; // e.g. 'Asia/Kolkata'
  academic_year: string;
  working_days: string[];
  /** Opening and closing time of the college, 'HH:MM' (24-hour). */
  opening_time?: string;
  closing_time?: string;
  contact_address?: string;
  contact_phone?: string;
  contact_email?: string;
}

export interface UserProfile {
  id: string;
  email?: string;
  full_name?: string;
  role: 'student' | 'admin';
  branch_id?: string;
  semester_id?: string;
}

export interface RoomBooking {
  id: string;
  roomId: string;
  bookedBy: string;
  reason: string;
  day: DayOfWeek;
  periodId: number | string;
  date: string;
  createdAt: number;
  /** pending and approved bookings hold the room; rejected and cancelled ones do not. */
  status?: 'pending' | 'approved' | 'rejected' | 'cancelled';
}

export interface QuickOverride {
  id: string;
  type: 'mark_holiday' | 'cancel_class' | 'swap_room';
  date: string;
  targetId?: string; // timetable slot id or room id
  replacementRoomId?: string;
  note?: string;
  createdAt: number;
}

export interface DerivedRoomStatus {
  room: Room;
  status: 'occupied' | 'free' | 'maintenance' | 'closed';
  currentSlot?: TimetableSlot;
  currentClass?: TimetableSlot;
  currentBooking?: RoomBooking;
  nextFreeAt?: string;
  freeUntil?: string;
  upcomingSlots: TimetableSlot[];
}

export interface ExcelValidationError {
  sheet: string;
  row: number;
  column?: string;
  type: 'error' | 'warning';
  message: string;
  hint: string;
}

export interface UploadHistoryItem {
  id: string;
  uploaded_by?: string;
  fileName: string;
  timestamp: number;
  mode: 'replace' | 'merge';
  counts: {
    timetable: number;
    rooms: number;
    holidays: number;
    periods: number;
    subjects?: number;
    professors?: number;
  };
  previousSnapshot?: string; // serialized state for undo
}
