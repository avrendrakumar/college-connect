import { describe, it, expect } from 'vitest';
import {
  evaluateCollegeStatus,
  deriveAllRoomStatuses,
  timeStringToMinutes,
  minutesToTimeString,
  getDayName,
  getCollegeZonedTime,
  getDaysUntilNextHoliday
} from '../src/utils/timeEngine';
import { Period, Room, TimetableSlot, Holiday, Notice } from '../src/types';
import { to24h, zonedToISO, isoToZonedDate, deriveSubjectId, deriveProfessorId } from '../src/utils/dbMapping';

// Standard test periods
const mockPeriods: Period[] = [
  { id: 1, order: 1, start: '09:00', end: '09:55', label: 'Period 1', isBreak: false },
  { id: 2, order: 2, start: '09:55', end: '10:50', label: 'Period 2', isBreak: false },
  { id: 3, order: 3, start: '10:50', end: '11:10', label: 'Tea Break', isBreak: true },
  { id: 4, order: 4, start: '11:10', end: '12:05', label: 'Period 3', isBreak: false },
  { id: 5, order: 5, start: '12:05', end: '01:00', label: 'Period 4', isBreak: false },
  { id: 6, order: 6, start: '01:00', end: '01:45', label: 'Lunch Break', isBreak: true },
  { id: 7, order: 7, start: '01:45', end: '02:40', label: 'Period 5', isBreak: false },
  { id: 8, order: 8, start: '02:40', end: '03:35', label: 'Period 6', isBreak: false },
  { id: 9, order: 9, start: '03:35', end: '04:30', label: 'Period 7', isBreak: false }
];

const mockRooms: Room[] = [
  { id: 'R101', name: 'Room 101', type: 'classroom', capacity: 60, floor: 1 },
  { id: 'R102', name: 'Room 102', type: 'classroom', capacity: 60, floor: 1 },
  { id: 'Lab-AI', name: 'AI & GPU Lab', type: 'lab', capacity: 40, floor: 2 },
  { id: 'Seminar', name: 'Main Seminar Hall', type: 'hall', capacity: 200, floor: 0 }
];

const mockTimetable: TimetableSlot[] = [
  {
    id: 's1',
    branch: 'CSE',
    day: 'Monday',
    periodId: 1,
    subject: 'Distributed Systems',
    teacher: 'Dr. Ramesh Sharma',
    roomId: 'R101',
    type: 'Lecture',
    is_published: true
  },
  {
    id: 's2',
    branch: 'CSE-AI',
    day: 'Monday',
    periodId: 1,
    subject: 'Deep Learning',
    teacher: 'Prof. Arvind Rao',
    roomId: 'Lab-AI',
    type: 'Lab',
    is_published: true
  },
  {
    id: 's3',
    branch: 'Civil',
    day: 'Monday',
    periodId: 2,
    subject: 'Structural Mechanics',
    teacher: 'Dr. H. P. Joshi',
    roomId: 'R102',
    type: 'Lecture',
    is_published: true
  }
];

describe('1. Time Engine & Status at Different Times', () => {
  it('converts time strings correctly including 12-hour afternoon hours', () => {
    expect(timeStringToMinutes('09:00')).toBe(540);
    expect(timeStringToMinutes('09:55')).toBe(595);
    expect(timeStringToMinutes('12:00')).toBe(720);
    expect(timeStringToMinutes('01:00')).toBe(780); // 13:00
    expect(timeStringToMinutes('01:45')).toBe(825); // 13:45
    expect(timeStringToMinutes('04:30')).toBe(990); // 16:30
    expect(minutesToTimeString(540)).toBe('09:00 AM');
    expect(minutesToTimeString(780)).toBe('01:00 PM');
  });

  it('evaluates status before college hours (07:30 AM on a Monday)', () => {
    // 07:30 AM on a Monday
    const mondayMorning = new Date('2026-10-12T07:30:00+05:30');
    const status = evaluateCollegeStatus(mondayMorning, mockPeriods, []);
    expect(status.isOpen).toBe(false);
    expect(status.badgeType).toBe('closed');
    expect(status.reason?.toLowerCase()).toContain('opens at');
  });

  it('evaluates status during Period 1 (09:20 AM on a Monday)', () => {
    const mondayPeriod1 = new Date('2026-10-12T09:20:00+05:30');
    const status = evaluateCollegeStatus(mondayPeriod1, mockPeriods, []);
    expect(status.isOpen).toBe(true);
    expect(status.badgeType).toBe('open');
    expect(status.activePeriod?.id).toBe(1);
    expect(status.activePeriod?.label).toBe('Period 1');
  });

  it('evaluates status during Lunch Break (01:20 PM on a Monday)', () => {
    const mondayLunch = new Date('2026-10-12T13:20:00+05:30');
    const status = evaluateCollegeStatus(mondayLunch, mockPeriods, []);
    expect(status.isOpen).toBe(true);
    expect(status.activePeriod?.label).toBe('Lunch Break');
    expect(status.activePeriod?.isBreak).toBe(true);
  });

  it('evaluates status after college hours (06:00 PM on a Monday)', () => {
    const mondayEvening = new Date('2026-10-12T18:00:00+05:30');
    const status = evaluateCollegeStatus(mondayEvening, mockPeriods, []);
    expect(status.isOpen).toBe(false);
    expect(status.badgeType).toBe('closed');
    expect(status.reason?.toLowerCase()).toContain('closed');
  });

  it('handles Sunday correctly', () => {
    // 2026-10-18 is a Sunday
    const sundayNoon = new Date('2026-10-18T12:00:00+05:30');
    const status = evaluateCollegeStatus(sundayNoon, mockPeriods, []);
    expect(status.isOpen).toBe(false);
    expect(['sunday', 'holiday']).toContain(status.badgeType);
    expect(status.reason).toContain('Sunday');
  });

  it('handles midnight boundary smoothly (23:59 vs 00:01)', () => {
    const midnightBefore = new Date('2026-10-12T23:59:00+05:30');
    const statusBefore = evaluateCollegeStatus(midnightBefore, mockPeriods, []);
    expect(statusBefore.isOpen).toBe(false);

    const midnightAfter = new Date('2026-10-13T00:01:00+05:30');
    const statusAfter = evaluateCollegeStatus(midnightAfter, mockPeriods, []);
    expect(statusAfter.isOpen).toBe(false);
  });
});

describe('2. Holidays: Multi-day & Branch-Specific', () => {
  const multiDayHoliday: Holiday = {
    id: 'diwali-2026',
    title: 'Diwali & Deepavali Vacation',
    startDate: '2026-11-05',
    endDate: '2026-11-12',
    type: 'vacation',
    is_whole_college: true
  };

  const branchSpecificHoliday: Holiday = {
    id: 'mech-symposium',
    title: 'Mechanical Workshop & Industry Visit',
    startDate: '2026-10-14',
    endDate: '2026-10-14',
    type: 'holiday',
    is_whole_college: false,
    branches: ['Mechanical']
  };

  it('detects college closed during multi-day vacation range', () => {
    // 2026-11-06 is a Friday within Diwali range
    const duringDiwali = new Date('2026-11-06T10:00:00+05:30');
    const status = evaluateCollegeStatus(duringDiwali, mockPeriods, [multiDayHoliday]);
    expect(status.isOpen).toBe(false);
    expect(status.badgeType).toBe('holiday');
    expect(status.reason).toContain('Diwali & Deepavali Vacation');
  });

  it('branch-specific holiday only affects targeted branches', () => {
    const isHolidayForCSE = branchSpecificHoliday.is_whole_college || branchSpecificHoliday.branches?.includes('CSE');
    const isHolidayForMech = branchSpecificHoliday.is_whole_college || branchSpecificHoliday.branches?.includes('Mechanical');

    expect(isHolidayForCSE).toBe(false);
    expect(isHolidayForMech).toBe(true);
  });
});

describe('3. Emergency Closure Announcements', () => {
  const emergencyNotice: Notice = {
    id: 'em-1',
    title: 'Severe Weather Warning: Campus Closed',
    content: 'All academic activities suspended immediately due to city-wide red alert.',
    priority: 'urgent',
    startDate: '2026-10-12',
    endDate: '2026-10-12',
    active: true,
    is_emergency: true,
    closes_college: true
  };

  it('immediately marks college CLOSED when an emergency closure notice is active', () => {
    // Normal Monday 10:00 AM class hours
    const mondayDuringClass = new Date('2026-10-12T10:00:00+05:30');
    const status = evaluateCollegeStatus(mondayDuringClass, mockPeriods, [], [], [emergencyNotice]);
    expect(status.isOpen).toBe(false);
    expect(status.isEmergency).toBe(true);
    expect(status.badgeType).toBe('emergency');
    expect(status.reason).toContain('Severe Weather Warning');
  });
});

describe('4. Room & Professor Conflict Detection', () => {
  it('detects room clash when two branches attempt booking the same room at the same time', () => {
    const existingSlot: TimetableSlot = {
      id: 'existing-1',
      branch: 'CSE',
      day: 'Monday',
      periodId: 1,
      subject: 'Operating Systems',
      teacher: 'Dr. Ramesh Sharma',
      roomId: 'R101',
      type: 'Lecture'
    };

    const conflictingSlot: TimetableSlot = {
      id: 'candidate-2',
      branch: 'Mechanical',
      day: 'Monday',
      periodId: 1,
      subject: 'Fluid Dynamics',
      teacher: 'Dr. V. K. Bansal',
      roomId: 'R101', // Same room
      type: 'Lecture'
    };

    const hasRoomClash =
      existingSlot.day === conflictingSlot.day &&
      existingSlot.periodId === conflictingSlot.periodId &&
      existingSlot.roomId.toLowerCase() === conflictingSlot.roomId.toLowerCase();

    expect(hasRoomClash).toBe(true);
  });

  it('detects professor clash when the same professor is booked in different rooms at the same time', () => {
    const existingSlot: TimetableSlot = {
      id: 'existing-1',
      branch: 'CSE',
      day: 'Monday',
      periodId: 1,
      subject: 'Operating Systems',
      teacher: 'Dr. Ramesh Sharma',
      roomId: 'R101',
      type: 'Lecture'
    };

    const conflictingSlot: TimetableSlot = {
      id: 'candidate-3',
      branch: 'CSE-AI',
      day: 'Monday',
      periodId: 1,
      subject: 'Advanced Algorithms',
      teacher: 'Dr. Ramesh Sharma', // Same professor in different room!
      roomId: 'Lab-AI',
      type: 'Lecture'
    };

    const hasProfClash =
      existingSlot.day === conflictingSlot.day &&
      existingSlot.periodId === conflictingSlot.periodId &&
      existingSlot.teacher.toLowerCase() === conflictingSlot.teacher.toLowerCase() &&
      existingSlot.teacher.toLowerCase() !== 'faculty';

    expect(hasProfClash).toBe(true);
  });
});

describe('5. Room Availability Derivation', () => {
  it('correctly reports occupied vs free rooms during active period', () => {
    const statuses = deriveAllRoomStatuses(
      mockRooms,
      mockTimetable,
      [],
      mockPeriods,
      'Monday',
      560, // 09:20 AM
      true
    );

    const r101 = statuses.find((s) => s.room.id === 'R101');
    const r102 = statuses.find((s) => s.room.id === 'R102');

    // R101 has CSE class in Period 1
    expect(r101?.status).toBe('occupied');
    expect(r101?.currentClass?.subject).toBe('Distributed Systems');

    // R102 has class in Period 2, so in Period 1 it is free
    expect(r102?.status).toBe('free');
  });
});

describe('6. Regression tests for audited bugs', () => {
  const closure: Notice = {
    id: 'em-old', title: 'Old closure', content: 'x', priority: 'urgent',
    startDate: '2026-10-01', endDate: '2026-10-02', active: true, is_emergency: true, closes_college: true
  };

  it('an expired emergency closure no longer closes the college', () => {
    const monday = new Date('2026-10-12T10:00:00+05:30');
    const status = evaluateCollegeStatus(monday, mockPeriods, [], [], [closure]);
    expect(status.isOpen).toBe(true);
  });

  it('an urgent notice that is not flagged "closes college" does not close it', () => {
    const monday = new Date('2026-10-12T10:00:00+05:30');
    const notice: Notice = { ...closure, id: 'u', startDate: '2026-10-12', endDate: '2026-10-12', closes_college: false };
    expect(evaluateCollegeStatus(monday, mockPeriods, [], [], [notice]).isOpen).toBe(true);
  });

  it('a branch-specific holiday does not close the whole college', () => {
    const h: Holiday = {
      id: 'b', title: 'Mech visit', startDate: '2026-10-12', endDate: '2026-10-12',
      type: 'holiday', is_whole_college: false, branches: ['Mechanical']
    };
    const monday = new Date('2026-10-12T10:00:00+05:30');
    expect(evaluateCollegeStatus(monday, mockPeriods, [h]).isOpen).toBe(true);
    expect(evaluateCollegeStatus(monday, mockPeriods, [h], [], [], 'Asia/Kolkata', 'Mechanical').isOpen).toBe(false);
    expect(evaluateCollegeStatus(monday, mockPeriods, [h], [], [], 'Asia/Kolkata', 'CSE').isOpen).toBe(true);
  });

  it('uses the college timezone, not the viewer timezone', () => {
    // 20:30 UTC Sunday is already 02:00 Monday in Kolkata
    const z = getCollegeZonedTime(new Date('2026-10-11T20:30:00Z'), 'Asia/Kolkata');
    expect(z.dayName).toBe('Monday');
    expect(z.dateStr).toBe('2026-10-12');
  });

  it('days until next holiday is exact calendar days', () => {
    const h: Holiday = { id: 'x', title: 'Diwali', startDate: '2026-11-08', endDate: '2026-11-13', type: 'vacation' };
    expect(getDaysUntilNextHoliday(new Date('2026-11-02T14:00:00+05:30'), [h])?.days).toBe(6);
    expect(getDaysUntilNextHoliday(new Date('2026-11-08T00:05:00+05:30'), [h])?.days).toBe(0);
  });

  it('cancelled classes free the room, room swaps move the class, drafts and closed branches are hidden', () => {
    const at = (overrides: any[] = [], closed: string[] = [], tt = mockTimetable) =>
      deriveAllRoomStatuses(mockRooms, tt, [], mockPeriods, 'Monday', 560, true, overrides, closed);
    expect(at([{ id: 'o', type: 'cancel_class', date: 'd', targetId: 's1', createdAt: 0 }]).find((r) => r.room.id === 'R101')?.status).toBe('free');
    const swapped = at([{ id: 'o', type: 'swap_room', date: 'd', targetId: 's1', replacementRoomId: 'R102', createdAt: 0 }]);
    expect(swapped.find((r) => r.room.id === 'R101')?.status).toBe('free');
    expect(swapped.find((r) => r.room.id === 'R102')?.status).toBe('occupied');
    expect(at([], ['CSE']).find((r) => r.room.id === 'R101')?.status).toBe('free');
    const drafts = mockTimetable.map((s) => ({ ...s, is_published: false }));
    expect(at([], [], drafts).find((r) => r.room.id === 'R101')?.status).toBe('free');
  });

  it('slots loaded from the database (24h start_time, no matching period id) still match periods', () => {
    const dbSlot: TimetableSlot = { ...mockTimetable[0], id: 'db1', periodId: 'unknown', start_time: '09:00', end_time: '09:55' };
    const r = deriveAllRoomStatuses(mockRooms, [dbSlot], [], mockPeriods, 'Monday', 560, true);
    expect(r.find((x) => x.room.id === 'R101')?.status).toBe('occupied');
    const afternoon: TimetableSlot = { ...mockTimetable[0], id: 'db2', periodId: 'unknown', start_time: '13:45', end_time: '14:40' };
    const r2 = deriveAllRoomStatuses(mockRooms, [afternoon], [], mockPeriods, 'Monday', 13 * 60 + 50, true);
    expect(r2.find((x) => x.room.id === 'R101')?.status).toBe('occupied');
  });
});

describe('7. Database mapping helpers', () => {
  it('to24h converts the sample periods\' afternoon shorthand and keeps 24h values', () => {
    expect(to24h('09:00')).toBe('09:00');
    expect(to24h('01:45')).toBe('13:45');
    expect(to24h('13:45:00')).toBe('13:45');
    expect(to24h('garbage')).toBe(null);
    expect(to24h('')).toBe(null);
  });

  it('zonedToISO interprets a date+time in the college zone (end of day stays on that day)', () => {
    // 23:59:59 IST (UTC+05:30) on 2026-11-20 is 18:29:59 UTC the same day
    expect(zonedToISO('2026-11-20', '23:59:59', 'Asia/Kolkata')).toBe('2026-11-20T18:29:59.000Z');
    expect(zonedToISO('2026-11-20', '00:00:00', 'Asia/Kolkata')).toBe('2026-11-19T18:30:00.000Z');
    expect(zonedToISO('2026-11-20', '12:00:00', 'UTC')).toBe('2026-11-20T12:00:00.000Z');
  });

  it('isoToZonedDate returns the wall-clock date in the zone, not the UTC date', () => {
    expect(isoToZonedDate('2026-11-19T18:30:00.000Z', 'Asia/Kolkata')).toBe('2026-11-20');
    expect(isoToZonedDate('2026-11-19T18:30:00.000Z', 'UTC')).toBe('2026-11-19');
  });

  it('derives stable subject/professor ids from names', () => {
    expect(deriveSubjectId('Distributed Systems')).toBe('SUB-DISTRIBUTED-SYSTEMS');
    expect(deriveProfessorId('Dr. Ramesh Sharma')).toBe('prof_dr_ramesh_sharma');
    expect(deriveProfessorId('Dr. Ramesh Sharma')).toBe(deriveProfessorId('  dr. ramesh sharma '));
  });
});
