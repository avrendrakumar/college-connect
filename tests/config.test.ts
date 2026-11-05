import { describe, it, expect } from 'vitest';
import { evaluateCollegeStatus, getNextWorkingDay, resolveCollegeHours } from '../src/utils/timeEngine';
import { dayNameOfDate, bookingErrorMessage } from '../src/utils/bookingUtils';

const periods = [
  { id: 1, label: 'Period 1', start: '09:00', end: '10:00', isBreak: false },
  { id: 2, label: 'Period 2', start: '10:00', end: '11:00', isBreak: false }
] as any[];

// 2026-11-02 is a Monday, 2026-11-07 a Saturday, 2026-11-08 a Sunday (college zone Asia/Kolkata).
const at = (iso: string) => new Date(`${iso}+05:30`);

describe('working days from settings', () => {
  it('keeps Sunday off and Saturday on by default', () => {
    expect(evaluateCollegeStatus(at('2026-11-08T11:00:00'), periods, []).isOpen).toBe(false);
    expect(evaluateCollegeStatus(at('2026-11-07T09:30:00'), periods, []).isOpen).toBe(true);
  });

  it('closes on a day the admin removed (Saturday off)', () => {
    const hours = { workingDays: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'] };
    const s = evaluateCollegeStatus(at('2026-11-07T09:30:00'), periods, [], [], [], 'Asia/Kolkata', undefined, hours);
    expect(s.isOpen).toBe(false);
    expect(s.reason).toContain('Saturday');
  });

  it('opens on a Sunday the admin added', () => {
    const hours = { workingDays: ['Sunday', 'Monday'] };
    const s = evaluateCollegeStatus(at('2026-11-08T09:30:00'), periods, [], [], [], 'Asia/Kolkata', undefined, hours);
    expect(s.isOpen).toBe(true);
  });

  it('skips non-working days when finding the next working day', () => {
    const hours = { workingDays: ['Monday', 'Tuesday'] };
    // From Tuesday 3 Nov the next working day is Monday 9 Nov.
    const next = getNextWorkingDay(new Date(2026, 10, 3), [], hours);
    expect(next).toContain('Nov 9');
  });
});

describe('opening hours from settings', () => {
  it('uses 08:30 to 17:00 when nothing is set', () => {
    expect(resolveCollegeHours()).toEqual({ startMin: 510, endMin: 1020 });
  });

  it('applies custom hours', () => {
    const hours = { openingTime: '07:00', closingTime: '15:00' };
    const early = evaluateCollegeStatus(at('2026-11-02T07:30:00'), periods, [], [], [], 'Asia/Kolkata', undefined, hours);
    expect(early.isOpen).toBe(true);
    const late = evaluateCollegeStatus(at('2026-11-02T15:30:00'), periods, [], [], [], 'Asia/Kolkata', undefined, hours);
    expect(late.isOpen).toBe(false);
  });

  it('shows the configured opening time before hours', () => {
    const hours = { openingTime: '09:15', closingTime: '16:00' };
    const s = evaluateCollegeStatus(at('2026-11-02T08:00:00'), periods, [], [], [], 'Asia/Kolkata', undefined, hours);
    expect(s.isOpen).toBe(false);
    expect(s.reason).toContain('09:15 AM');
  });

  it('ignores an inverted or invalid pair', () => {
    expect(resolveCollegeHours({ openingTime: '18:00', closingTime: '09:00' })).toEqual({ startMin: 510, endMin: 1020 });
    expect(resolveCollegeHours({ openingTime: 'abc', closingTime: '17:00' }).startMin).toBe(510);
  });
});

describe('booking helpers', () => {
  it('finds the weekday of a date without timezone drift', () => {
    expect(dayNameOfDate('2026-11-02')).toBe('Monday');
    expect(dayNameOfDate('2026-11-08')).toBe('Sunday');
    expect(dayNameOfDate('2026-12-31')).toBe('Thursday');
  });

  it('turns database codes into plain sentences', () => {
    expect(bookingErrorMessage('ROOM_ALREADY_BOOKED')).toContain('just booked');
    expect(bookingErrorMessage('relation "public.room_bookings" does not exist')).toContain('002_room_bookings.sql');
    expect(bookingErrorMessage('weird')).toContain('weird');
  });
});
