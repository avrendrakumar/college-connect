import type { DayOfWeek } from '../types';

const WEEKDAY_NAMES: DayOfWeek[] = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'] as DayOfWeek[];

/** Weekday of a calendar date (YYYY-MM-DD); pure date arithmetic, no timezone involved. */
export function dayNameOfDate(dateStr: string): DayOfWeek {
  const [y, m, d] = dateStr.split('-').map(Number);
  return WEEKDAY_NAMES[new Date(Date.UTC(y, m - 1, d)).getUTCDay()];
}

const BOOKING_ERROR_TEXT: Record<string, string> = {
  NO_DATABASE: 'Room booking needs the database. Connect Supabase first.',
  ROOM_ALREADY_BOOKED: 'Someone has just booked this room for that period. Pick another period or room.',
  ROOM_HAS_CLASS: 'A class is scheduled in this room at that time.',
  ROOM_UNDER_MAINTENANCE: 'This room is under maintenance.',
  ROOM_NOT_FOUND: 'This room no longer exists.',
  PERIOD_NOT_FOUND: 'This period no longer exists.',
  PERIOD_IS_BREAK: 'Rooms cannot be booked during a break.',
  PERIOD_ALREADY_OVER: 'That period is already over.',
  DATE_OUT_OF_RANGE: 'Pick a date from today up to 60 days ahead.',
  NOT_A_WORKING_DAY: 'The college is closed on that day of the week.',
  COLLEGE_CLOSED: 'The college is on holiday on that date.',
  INVALID_NAME: 'Enter your name (up to 80 characters).',
  INVALID_REASON: 'Enter a reason (up to 200 characters).',
  TOO_MANY_PENDING: 'You already have 5 bookings waiting for approval.',
  NOT_ALLOWED: 'You can only cancel bookings made from this browser, unless you are an admin.',
  BOOKING_NOT_ACTIVE: 'This booking is already cancelled or rejected.',
  BOOKING_NOT_PENDING: 'This booking was already decided by someone else.',
  INVALID_STATUS: 'Invalid decision.'
};

/** Turns a database error code into a sentence a person can act on. */
export function bookingErrorMessage(raw: string): string {
  const code = Object.keys(BOOKING_ERROR_TEXT).find((k) => raw.includes(k));
  if (code) return BOOKING_ERROR_TEXT[code];
  if (/does not exist|schema cache|PGRST20/i.test(raw)) {
    return 'The booking tables are missing. Run supabase/migrations/002_room_bookings.sql in the Supabase SQL Editor.';
  }
  return `Booking failed: ${raw}`;
}

