import * as XLSX from 'xlsx';
import {
  TimetableSlot,
  Room,
  Holiday,
  Period,
  Subject,
  Professor,
  Semester,
  BranchId,
  DayOfWeek,
  ClassType,
  HolidayType,
  ExcelValidationError
} from '../types';
import { timeStringToMinutes } from './timeEngine';

export interface ParsedExcelData {
  timetable: TimetableSlot[];
  rooms: Room[];
  holidays: Holiday[];
  periods: Period[];
  subjects: Subject[];
  professors: Professor[];
  errors: ExcelValidationError[];
  warnings: ExcelValidationError[];
  sheetRowCounts: {
    timetable: number;
    rooms: number;
    holidays: number;
    periods: number;
    subjects: number;
    professors: number;
  };
}

const VALID_DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const VALID_ROOM_TYPES = ['classroom', 'lab', 'hall', 'workshop'];
const VALID_CLASS_TYPES = ['Lecture', 'Lab', 'Tutorial'];
const VALID_HOLIDAY_TYPES = ['holiday', 'vacation', 'exam'];

// Helper to convert time strings "HH:MM"
export function isValidTime(t: string): boolean {
  return /^([01]\d|2[0-3]):([0-5]\d)$/.test(t.trim());
}

// Minutes since midnight for a validated 24h "HH:MM" string
function toMin(timeStr: string): number {
  const [h, m] = timeStr.trim().split(':');
  return (parseInt(h, 10) || 0) * 60 + (parseInt(m, 10) || 0);
}

const toMin24 = (t: string) => timeStringToMinutes(t);
const pad2 = (n: number) => String(n).padStart(2, '0');

/** Excel cell (text, Date, or day-fraction number) -> "HH:MM", or '' when it is not a time. */
function cellToTime(v: unknown): string {
  if (v instanceof Date && !isNaN(v.getTime())) {
    const d = new Date(v.getTime() + 30000); // SheetJS time cells carry seconds noise; round to the minute
    return `${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
  }
  if (typeof v === 'number' && v >= 0 && v < 1) {
    const total = Math.round(v * 24 * 60);
    return `${pad2(Math.floor(total / 60))}:${pad2(total % 60)}`;
  }
  const t = String(v ?? '').trim();
  const m = t.match(/^(\d{1,2}):(\d{2})(?::\d{2})?$/);
  return m ? `${pad2(Number(m[1]))}:${m[2]}` : t;
}

/** Excel cell (text, Date or serial number) -> "YYYY-MM-DD", or the trimmed text when unparseable. */
function cellToDate(v: unknown): string {
  if (v instanceof Date && !isNaN(v.getTime())) {
    const d = new Date(v.getTime() + 12 * 3600 * 1000); // midday avoids timezone edge shifts
    return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
  }
  return String(v ?? '').trim();
}

function isValidDate(s: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
  const d = new Date(s + 'T00:00:00Z');
  return !isNaN(d.getTime()) && d.toISOString().slice(0, 10) === s;
}

const slugId = (v: string) => v.trim().toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '');

// Intervals overlap if max(start1, start2) < min(end1, end2)
function intervalsOverlap(s1: string, e1: string, s2: string, e2: string): boolean {
  const start1 = toMin(s1);
  const end1 = toMin(e1);
  const start2 = toMin(s2);
  const end2 = toMin(e2);
  return Math.max(start1, start2) < Math.min(end1, end2);
}

// 1. Generate & download a headers-only 6-sheet Excel template (no sample rows).
export function generateExcelTemplate(): void {
  const wb = XLSX.utils.book_new();
  const sheets: Array<[string, string[]]> = [
    ['Timetable', ['Branch', 'Semester', 'Day', 'Start', 'End', 'Subject Code', 'Teacher', 'Room', 'Type']],
    ['Rooms', ['Room', 'Name', 'Type', 'Capacity', 'Floor', 'Building', 'Maintenance']],
    ['Periods', ['Period', 'Start', 'End', 'Label', 'IsBreak']],
    ['Holidays', ['Start Date', 'End Date', 'Title', 'Type', 'Greeting', 'Whole College']],
    ['Subjects', ['Subject Code', 'Name', 'Branch', 'Semester']],
    ['Professors', ['ID', 'Name', 'Email', 'Department']]
  ];
  for (const [name, headers] of sheets) {
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([headers]), name);
  }
  XLSX.writeFile(wb, 'CollegeConnect_Schedule_Template.xlsx');
}

// 2. Export current active data to multi-sheet Excel
export function exportCurrentDataToExcel(
  timetable: TimetableSlot[],
  rooms: Room[],
  holidays: Holiday[],
  periods: Period[]
): void {
  const wb = XLSX.utils.book_new();

  // Timetable
  const periodFor = (id: string | number) => periods.find((p) => String(p.id) === String(id));
  const timetableExport = timetable.map((s) => ({
    Branch: s.branch,
    Semester: s.semester || '',
    Day: s.day,
    Start: s.start_time || periodFor(s.periodId)?.start || '',
    End: s.end_time || periodFor(s.periodId)?.end || '',
    'Subject Code': s.subject,
    Teacher: s.teacher,
    Room: s.roomId,
    Type: s.type,
    Published: s.is_published !== false ? 'Yes' : 'No'
  }));
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(timetableExport), 'Timetable');

  // Rooms
  const roomsExport = rooms.map((r) => ({
    Room: r.id,
    Name: r.name,
    Type: r.type,
    Capacity: r.capacity,
    Floor: r.floor,
    Building: r.building || '',
    Maintenance: r.isMaintenance || r.is_under_maintenance ? 'Yes' : 'No'
  }));
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(roomsExport), 'Rooms');

  // Periods
  const periodsExport = periods.map((p) => ({
    Period: p.order,
    Start: p.start,
    End: p.end,
    Label: p.label,
    IsBreak: p.isBreak || p.is_break ? 'Yes' : 'No'
  }));
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(periodsExport), 'Periods');

  // Holidays
  const holidaysExport = holidays.map((h) => ({
    'Start Date': h.startDate || h.start_date,
    'End Date': h.endDate || h.end_date,
    Title: h.title,
    Type: h.type,
    Greeting: h.greeting || h.description || '',
    'Whole College': h.is_whole_college !== false ? 'Yes' : 'No'
  }));
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(holidaysExport), 'Holidays');

  XLSX.writeFile(wb, `CollegeConnect_Export_${new Date().toISOString().split('T')[0]}.xlsx`);
}

// 3. Strict Parser and Clash Validator for Excel/CSV
export async function parseAndValidateExcel(
  file: File,
  existingRooms: Room[],
  existingTimetable: TimetableSlot[] = [],
  existingPeriods: Period[] = [],
  knownBranchIds: string[] = []
): Promise<ParsedExcelData> {
  const buffer = await file.arrayBuffer();
  const wb = XLSX.read(buffer, { type: 'array', cellDates: true });

  const errors: ExcelValidationError[] = [];
  const warnings: ExcelValidationError[] = [];

  const parsedRooms: Room[] = [];
  const parsedTimetable: TimetableSlot[] = [];
  const parsedHolidays: Holiday[] = [];
  const parsedPeriods: Period[] = [];
  const parsedSubjects: Subject[] = [];
  const parsedProfessors: Professor[] = [];
  void existingTimetable; // reserved for merge-mode clash checks against saved data (enforced by DB constraints)

  const sheetNames = wb.SheetNames;

  // 1. Parse Rooms
  const roomSheetName = sheetNames.find((s) => s.toLowerCase().includes('room'));
  if (roomSheetName && wb.Sheets[roomSheetName]) {
    const rows = XLSX.utils.sheet_to_json<any>(wb.Sheets[roomSheetName]);
    rows.forEach((row, idx) => {
      const rowNum = idx + 2;
      const roomId = String(row.Room || row.id || row.RoomId || '').trim();
      const type = String(row.Type || row.type || 'classroom').trim().toLowerCase();
      const capacity = parseInt(row.Capacity || row.capacity, 10);
      const floor = parseInt(row.Floor || row.floor, 10);
      const maint = String(row.Maintenance || row.is_under_maintenance || '').toLowerCase();

      if (!roomId) {
        errors.push({
          sheet: roomSheetName,
          row: rowNum,
          column: 'Room',
          type: 'error',
          message: 'Room identifier is empty',
          hint: 'Provide a valid unique room ID (e.g. a short unique code)'
        });
        return;
      }

      parsedRooms.push({
        id: roomId.toUpperCase(),
        name: row.Name || roomId,
        type: (VALID_ROOM_TYPES.includes(type) ? type : 'classroom') as any,
        capacity: isNaN(capacity) ? 60 : capacity,
        floor: isNaN(floor) ? 0 : floor,
        building: row.Building || 'Academic Wing',
        isMaintenance: maint === 'yes' || maint === 'true',
        is_under_maintenance: maint === 'yes' || maint === 'true'
      });
    });
  }

  // Combined room map for reference
  const roomSet = new Set<string>();
  existingRooms.forEach((r) => roomSet.add(r.id.toLowerCase()));
  parsedRooms.forEach((r) => roomSet.add(r.id.toLowerCase()));

  // 2. Parse Periods
  const periodSheetName = sheetNames.find((s) => s.toLowerCase().includes('period'));
  if (periodSheetName && wb.Sheets[periodSheetName]) {
    const rows = XLSX.utils.sheet_to_json<any>(wb.Sheets[periodSheetName]);
    rows.forEach((row, idx) => {
      const rowNum = idx + 2;
      const periodOrder = parseInt(row.Period || row.period || row.order || (idx + 1), 10);
      const start = cellToTime(row.Start ?? row.start);
      const end = cellToTime(row.End ?? row.end);
      const label = String(row.Label || row.label || `Period ${periodOrder}`).trim();
      const isBreak = String(row.IsBreak || row.is_break || '').toLowerCase() === 'yes';

      if (!start || !end) {
        errors.push({
          sheet: periodSheetName,
          row: rowNum,
          type: 'error',
          message: 'Missing Start or End time',
          hint: 'Format must be HH:MM (e.g. 09:00)'
        });
        return;
      }

      if (!/^\d{1,2}:\d{2}$/.test(start) || !/^\d{1,2}:\d{2}$/.test(end) || timeStringToMinutes(start) >= timeStringToMinutes(end)) {
        errors.push({
          sheet: periodSheetName,
          row: rowNum,
          type: 'error',
          message: `Invalid period time range "${start}" - "${end}"`,
          hint: 'Use HH:MM and make End later than Start'
        });
        return;
      }

      parsedPeriods.push({
        id: `p_${periodOrder}`,
        order: periodOrder,
        start,
        end,
        label,
        isBreak,
        is_break: isBreak
      });
    });
  }

  // 3. Parse Holidays
  const holidaySheetName = sheetNames.find((s) => s.toLowerCase().includes('holiday'));
  if (holidaySheetName && wb.Sheets[holidaySheetName]) {
    const rows = XLSX.utils.sheet_to_json<any>(wb.Sheets[holidaySheetName]);
    rows.forEach((row, idx) => {
      const rowNum = idx + 2;
      const startDate = cellToDate(row['Start Date'] ?? row.StartDate ?? row.start);
      const endDate = cellToDate(row['End Date'] ?? row.EndDate ?? row.end ?? startDate) || startDate;
      const title = String(row.Title || row.title || '').trim();
      const type = String(row.Type || row.type || 'holiday').trim().toLowerCase();
      const whole = String(row['Whole College'] || row.is_whole_college || 'yes').toLowerCase() !== 'no';

      if (!title || !startDate) {
        errors.push({
          sheet: holidaySheetName,
          row: rowNum,
          type: 'error',
          message: 'Missing Title or Start Date',
          hint: 'Fill in Title and Start Date (YYYY-MM-DD)'
        });
        return;
      }

      if (!isValidDate(startDate) || !isValidDate(endDate) || endDate < startDate) {
        errors.push({
          sheet: holidaySheetName,
          row: rowNum,
          column: 'Start Date / End Date',
          type: 'error',
          message: `Invalid date range "${startDate}" to "${endDate}"`,
          hint: 'Use YYYY-MM-DD and make End Date the same as or after Start Date'
        });
        return;
      }

      parsedHolidays.push({
        id: `hol_${slugId(title)}_${startDate}`,
        startDate,
        endDate: endDate || startDate,
        title,
        type: (VALID_HOLIDAY_TYPES.includes(type) ? type : 'holiday') as any,
        greeting: row.Greeting || '',
        description: row.Greeting || '',
        is_whole_college: whole
      });
    });
  }

  // 4. Parse Subjects
  const subjectSheetName = sheetNames.find((s) => s.toLowerCase().includes('subject'));
  if (subjectSheetName && wb.Sheets[subjectSheetName]) {
    const rows = XLSX.utils.sheet_to_json<any>(wb.Sheets[subjectSheetName]);
    rows.forEach((row) => {
      const code = String(row['Subject Code'] || row.code || row.id || '').trim();
      const name = String(row.Name || row.name || code).trim();
      if (code) {
        parsedSubjects.push({
          id: code,
          code,
          name,
          branch_id: row.Branch || row.branch_id,
          semester_id: row.Semester || row.semester_id
        });
      }
    });
  }

  // 5. Parse Professors
  const profSheetName = sheetNames.find((s) => s.toLowerCase().includes('prof'));
  if (profSheetName && wb.Sheets[profSheetName]) {
    const rows = XLSX.utils.sheet_to_json<any>(wb.Sheets[profSheetName]);
    rows.forEach((row) => {
      const name = String(row.Name || row.name || '').trim();
      const id = String(row.ID || row.id || name.toLowerCase().replace(/\s+/g, '_')).trim();
      if (name) {
        parsedProfessors.push({
          id,
          name,
          email: row.Email || row.email,
          department: row.Department || row.department
        });
      }
    });
  }

  // 6. Parse Timetable with Overlap & Clash Detection
  const timetableSheetName =
    sheetNames.find((s) => s.toLowerCase().includes('timetable') || s.toLowerCase().includes('schedule')) ||
    sheetNames[0];

  if (timetableSheetName && wb.Sheets[timetableSheetName]) {
    const rows = XLSX.utils.sheet_to_json<any>(wb.Sheets[timetableSheetName]);

    // Clash Tracking Structures:
    // Room clash: day -> list of { rowNum, start, end, roomId, branch, subject }
    const roomBookingList: Array<{ rowNum: number; day: string; start: string; end: string; roomId: string; branch: string; subject: string }> = [];
    // Professor clash: day -> list of { rowNum, start, end, teacher, branch, roomId }
    const profBookingList: Array<{ rowNum: number; day: string; start: string; end: string; teacher: string; branch: string; roomId: string }> = [];

    rows.forEach((row, idx) => {
      const rowNum = idx + 2;
      const branch = String(row.Branch || row.branch || '').trim();
      const semester = String(row.Semester || row.semester || '').trim();
      const day = String(row.Day || row.day || '').trim();
      const start = cellToTime(row.Start ?? row.start ?? row.start_time);
      const end = cellToTime(row.End ?? row.end ?? row.end_time);
      const subject = String(row['Subject Code'] || row.Subject || row.subject || '').trim();
      const teacher = String(row.Teacher || row.Professor || row.teacher || '').trim();
      const roomId = String(row.Room || row.Classroom || row.room || '').trim().toUpperCase();
      const type = String(row.Type || row.type || 'Lecture').trim();

      // Required fields check
      if (!branch || !semester || !day || !subject || !roomId || !teacher) {
        errors.push({
          sheet: timetableSheetName,
          row: rowNum,
          type: 'error',
          message: 'Missing required class fields',
          hint: 'Required columns: Branch, Semester (e.g. SEM1), Day, Subject Code, Teacher, Room'
        });
        return;
      }

      // Times must be real 24h HH:MM values with End after Start (no silent defaults)
      if (!isValidTime(start) || !isValidTime(end) || toMin(start) >= toMin(end)) {
        errors.push({
          sheet: timetableSheetName,
          row: rowNum,
          column: 'Start / End',
          type: 'error',
          message: `Invalid time range "${start}" - "${end}"`,
          hint: 'Use 24-hour HH:MM (e.g. 13:45) and make End later than Start'
        });
        return;
      }

      // Check valid day
      const normDay = VALID_DAYS.find((d) => d.toLowerCase() === day.toLowerCase());
      if (!normDay) {
        errors.push({
          sheet: timetableSheetName,
          row: rowNum,
          column: 'Day',
          type: 'error',
          message: `Invalid day "${day}"`,
          hint: 'Day must be one of: Monday, Tuesday, Wednesday, Thursday, Friday, Saturday'
        });
        return;
      }

      // Check valid branch
      const knownBranches = knownBranchIds || [];
      const normBranch = knownBranches.find((b) => b.toLowerCase() === branch.toLowerCase());
      if (!normBranch) {
        errors.push({
          sheet: timetableSheetName,
          row: rowNum,
          column: 'Branch',
          type: 'error',
          message: `Unknown branch "${branch}"`,
          hint: knownBranches.length ? `Use one of: ${knownBranches.join(', ')}` : 'No branches exist yet. Add branches in Master Data first.'
        });
        return;
      }

      // Check room recognition: the database requires every room to exist
      if (!roomSet.has(roomId.toLowerCase())) {
        errors.push({
          sheet: timetableSheetName,
          row: rowNum,
          column: 'Room',
          type: 'error',
          message: `Room "${roomId}" is not registered in the system`,
          hint: 'Add this room in the Rooms sheet or the Rooms & Master Data tab'
        });
        return;
      }

      // --- CLASH 1: ROOM OVERLAP ---
      const roomClash = roomBookingList.find(
        (b) =>
          b.day.toLowerCase() === normDay.toLowerCase() &&
          b.roomId.toLowerCase() === roomId.toLowerCase() &&
          intervalsOverlap(b.start, b.end, start, end)
      );

      if (roomClash) {
        errors.push({
          sheet: timetableSheetName,
          row: rowNum,
          column: 'Room',
          type: 'error',
          message: `ROOM CLASH: Room "${roomId}" is already booked by ${roomClash.branch} (${roomClash.subject}) from ${roomClash.start} to ${roomClash.end} (Row ${roomClash.rowNum})!`,
          hint: 'Two classes cannot use the same room at the same time. Assign another classroom or adjust times.'
        });
      } else {
        roomBookingList.push({ rowNum, day: normDay, start, end, roomId, branch: normBranch, subject });
      }

      // --- CLASH 2: PROFESSOR OVERLAP ---
      if (teacher && teacher.toLowerCase() !== 'tbd' && teacher.toLowerCase() !== 'industry expert') {
        const profClash = profBookingList.find(
          (p) =>
            p.day.toLowerCase() === normDay.toLowerCase() &&
            p.teacher.toLowerCase() === teacher.toLowerCase() &&
            intervalsOverlap(p.start, p.end, start, end)
        );

        if (profClash) {
          errors.push({
            sheet: timetableSheetName,
            row: rowNum,
            column: 'Teacher',
            type: 'error',
            message: `PROFESSOR CLASH: "${teacher}" is scheduled in TWO rooms simultaneously: ${profClash.roomId} (Row ${profClash.rowNum}) and ${roomId} on ${normDay} (${start}-${end})!`,
            hint: 'A professor cannot teach two overlapping classes. Reassign instructor or reschedule slot.'
          });
        } else {
          profBookingList.push({ rowNum, day: normDay, start, end, teacher, branch: normBranch, roomId });
        }
      }

      // Resolve the period by its time window (parsed sheet first, then existing periods)
      const periodPool = parsedPeriods.length > 0 ? parsedPeriods : existingPeriods;
      const matchedPeriod = periodPool.find(
        (p) => !p.isBreak && toMin24(p.start) === toMin(start) && toMin24(p.end) === toMin(end)
      );
      if (periodPool.length > 0 && !matchedPeriod) {
        errors.push({
          sheet: timetableSheetName,
          row: rowNum,
          column: 'Start / End',
          type: 'error',
          message: `No period matches ${start}-${end}`,
          hint: 'Class times must equal a period in the Periods sheet (or the periods already configured)'
        });
        return;
      }

      const subjectInfo = parsedSubjects.find((x) => x.code.toLowerCase() === subject.toLowerCase());
      const profInfo = parsedProfessors.find((x) => x.name.toLowerCase() === teacher.toLowerCase());

      parsedTimetable.push({
        id: `slot_${slugId([normBranch, semester, normDay, start, roomId].join('_'))}`,
        branch: normBranch,
        branch_id: normBranch,
        semester,
        semester_id: semester,
        day: normDay as DayOfWeek,
        periodId: matchedPeriod ? matchedPeriod.id : `t_${start}_${end}`,
        start_time: start,
        end_time: end,
        subject: subjectInfo?.name || subject,
        subject_id: subjectInfo?.id,
        teacher,
        professor_id: profInfo?.id,
        roomId,
        classroom_id: roomId,
        type: (VALID_CLASS_TYPES.includes(type) ? type : 'Lecture') as ClassType,
        class_type: (VALID_CLASS_TYPES.includes(type) ? type : 'Lecture') as ClassType,
        is_published: true
      });
    });
  }

  return {
    timetable: parsedTimetable,
    rooms: parsedRooms,
    holidays: parsedHolidays,
    periods: parsedPeriods,
    subjects: parsedSubjects,
    professors: parsedProfessors,
    errors,
    warnings,
    sheetRowCounts: {
      timetable: parsedTimetable.length,
      rooms: parsedRooms.length,
      holidays: parsedHolidays.length,
      periods: parsedPeriods.length,
      subjects: parsedSubjects.length,
      professors: parsedProfessors.length
    }
  };
}
