import {
  Branch,
  Subject,
  Room,
  Period,
  TimetableSlot,
  Holiday,
  Notice,
  CollegeSettings,
  RoomBooking,
  DayOfWeek,
  QuickOverride,
  UploadHistoryItem
} from '../types';
import { branchStyleAt } from '../utils/branchStyles';
import { dayNameOfDate, bookingErrorMessage } from '../utils/bookingUtils';
export { dayNameOfDate, bookingErrorMessage };
import { supabase, isSupabaseConfigured } from './supabaseClient';
import { timeStringToMinutes } from '../utils/timeEngine';
import { to24h, deriveSubjectId, deriveProfessorId, zonedToISO, isoToZonedDate } from '../utils/dbMapping';

/** Result of a persistence call. `ok:false` means the database did NOT accept the change. */
export interface SaveResult {
  ok: boolean;
  error?: string;
}

const OK: SaveResult = { ok: true };
const fail = (what: string, error: { message?: string } | string | null | undefined): SaveResult => ({
  ok: false,
  error: `${what}: ${typeof error === 'string' ? error : error?.message || 'unknown database error'}`
});

const DAY_TO_NUM: Record<string, number> = {
  Monday: 1, Tuesday: 2, Wednesday: 3, Thursday: 4, Friday: 5, Saturday: 6, Sunday: 7
};
const NUM_TO_DAY = ['', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

export { to24h, deriveSubjectId, deriveProfessorId, zonedToISO, isoToZonedDate };

const STORAGE_KEYS = {
  BRANCHES: 'collegeconnect_branches_v2',
  ROOMS: 'collegeconnect_rooms_v2',
  PERIODS: 'collegeconnect_periods_v2',
  TIMETABLE: 'collegeconnect_timetable_v2',
  HOLIDAYS: 'collegeconnect_holidays_v2',
  NOTICES: 'collegeconnect_notices_v2',
  SETTINGS: 'collegeconnect_settings_v2',
  SUBJECTS: 'collegeconnect_subjects_v3',
  BOOKINGS: 'collegeconnect_bookings_v3',
  BOOKING_TOKENS: 'collegeconnect_booking_tokens_v1',
  OVERRIDES: 'collegeconnect_overrides_v2',
  UPLOAD_HISTORY: 'collegeconnect_upload_history_v2'
};

// Neutral defaults only: no placeholder college details. The administrator sets the real ones in Settings.
export const DEFAULT_SETTINGS: CollegeSettings = {
  id: 'current',
  college_name: 'College Connect',
  timezone: 'Asia/Kolkata',
  academic_year: '',
  working_days: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'],
  opening_time: '08:30',
  closing_time: '17:00',
  contact_address: '',
  contact_phone: '',
  contact_email: ''
};

class StorageService {
  private getLocal<T>(key: string, fallback: T): T {
    try {
      const data = localStorage.getItem(key);
      if (!data) return fallback;
      return JSON.parse(data) as T;
    } catch {
      return fallback;
    }
  }

  private setLocal<T>(key: string, value: T): void {
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch (err) {
      console.error(`Failed to save ${key} to localStorage:`, err);
    }
  }

  // --- REMOTE HELPERS ---
  private client() {
    return isSupabaseConfigured && supabase ? supabase : null;
  }

  /**
   * Upsert `rows` into `table`, then delete rows that exist remotely but are no longer in `rows`
   * (so deletions in the admin UI really reach the database). Every step checks `{ error }`.
   */
  private async replaceRemote(table: string, rows: Array<{ id: string } & Record<string, unknown>>): Promise<SaveResult> {
    const db = this.client();
    if (!db) return OK;

    if (rows.length > 0) {
      const { error } = await db.from(table).upsert(rows);
      if (error) return fail(`Saving to ${table} failed`, error);
    }

    const { data: existing, error: listError } = await db.from(table).select('id');
    if (listError) return fail(`Reading ${table} failed`, listError);

    const keep = new Set(rows.map((r) => r.id));
    const stale = (existing || []).map((r: { id: string }) => r.id).filter((id: string) => !keep.has(id));
    if (stale.length > 0) {
      const { error: delError } = await db.from(table).delete().in('id', stale);
      if (delError) return fail(`Removing deleted rows from ${table} failed`, delError);
    }
    return OK;
  }

  // --- SETTINGS ---
  getSettings(): CollegeSettings {
    return this.getLocal<CollegeSettings>(STORAGE_KEYS.SETTINGS, DEFAULT_SETTINGS);
  }

  async saveSettings(settings: CollegeSettings): Promise<SaveResult> {
    const previous = this.getSettings();
    this.setLocal(STORAGE_KEYS.SETTINGS, settings);
    const db = this.client();
    if (!db) return OK;
    const { error } = await db.from('settings').upsert({
      id: 'current',
      college_name: settings.college_name,
      logo_url: settings.logo_url || null,
      timezone: settings.timezone || 'Asia/Kolkata',
      academic_year: settings.academic_year || '',
      working_days: settings.working_days,
      opening_time: settings.opening_time || '08:30',
      closing_time: settings.closing_time || '17:00',
      contact_address: settings.contact_address || null,
      contact_phone: settings.contact_phone || null,
      contact_email: settings.contact_email || null
    });
    if (error) {
      this.setLocal(STORAGE_KEYS.SETTINGS, previous);
      return fail('Saving settings failed', error);
    }
    return OK;
  }

  // --- BRANCHES ---
  getBranches(): Branch[] {
    return this.getLocal<Branch[]>(STORAGE_KEYS.BRANCHES, []);
  }

  async saveBranches(branches: Branch[]): Promise<SaveResult> {
    this.setLocal(STORAGE_KEYS.BRANCHES, branches);
    // Subjects of a removed branch stay in the catalog but become "all branches" (database: ON DELETE SET NULL).
    const ids = new Set(branches.map((b) => b.id));
    this.setLocal(
      STORAGE_KEYS.SUBJECTS,
      this.getSubjects().map((x) => (x.branch_id && !ids.has(x.branch_id) ? { ...x, branch_id: undefined } : x))
    );
    return this.replaceRemote(
      'branches',
      branches.map((b) => ({
        id: b.id,
        name: b.name,
        short_name: b.shortName || b.short_name || b.id,
        code: b.code || b.id,
        color: b.color || '#4F46E5'
      }))
    );
  }

  // --- ROOMS (Classrooms) ---
  getRooms(): Room[] {
    return this.getLocal<Room[]>(STORAGE_KEYS.ROOMS, []);
  }

  async saveRooms(rooms: Room[]): Promise<SaveResult> {
    this.setLocal(STORAGE_KEYS.ROOMS, rooms);
    return this.replaceRemote(
      'classrooms',
      rooms.map((r) => ({
        id: r.id,
        name: r.name,
        type: r.type,
        capacity: Number.isFinite(Number(r.capacity)) ? Number(r.capacity) : 0,
        floor: Number.isFinite(Number(r.floor)) ? Number(r.floor) : 0,
        building: r.building || null,
        is_under_maintenance: Boolean(r.isMaintenance ?? r.is_under_maintenance)
      }))
    );
  }

  // --- PERIODS ---
  getPeriods(): Period[] {
    return this.getLocal<Period[]>(STORAGE_KEYS.PERIODS, []);
  }

  async savePeriods(periods: Period[]): Promise<SaveResult> {
    this.setLocal(STORAGE_KEYS.PERIODS, periods);
    if (!this.client()) return OK;
    const rows: Array<{ id: string } & Record<string, unknown>> = [];
    for (let i = 0; i < periods.length; i++) {
      const p = periods[i];
      const start = to24h(p.start || p.start_time);
      const end = to24h(p.end || p.end_time);
      if (!start || !end) return fail('Saving periods failed', `period "${p.label}" has an invalid start/end time`);
      rows.push({
        id: String(p.id),
        period_number: p.order || p.period_number || i + 1,
        start_time: start,
        end_time: end,
        label: p.label,
        is_break: Boolean(p.isBreak ?? p.is_break)
      });
    }
    return this.replaceRemote('periods', rows);
  }

  // --- SUBJECTS (course catalog) ---
  /** The subject a class belongs to: its own id, else a catalog subject with the same name, else a derived id. */
  resolveSubjectId(slot: { subject: string; subject_id?: string }): string {
    if (slot.subject_id) return slot.subject_id;
    const name = slot.subject.trim().toLowerCase();
    const hit = this.getSubjects().find((x) => x.name.trim().toLowerCase() === name);
    return hit ? hit.id : deriveSubjectId(slot.subject);
  }

  getSubjects(): Subject[] {
    return this.getLocal<Subject[]>(STORAGE_KEYS.SUBJECTS, []);
  }

  /** Adds (or updates) one subject. The database must accept it before it is kept locally. */
  async addSubject(subject: Subject): Promise<SaveResult> {
    const db = this.client();
    if (db) {
      const semNumber = Number(String(subject.semester_id || '').replace(/\D/g, ''));
      if (subject.semester_id) {
        const { error: semError } = await db
          .from('semesters')
          .upsert({ id: subject.semester_id, name: `Semester ${semNumber}`, number: semNumber }, { onConflict: 'id', ignoreDuplicates: true });
        if (semError) return fail('Preparing the semester failed', semError);
      }
      const { error } = await db.from('subjects').upsert({
        id: subject.id,
        name: subject.name,
        code: subject.code,
        branch_id: subject.branch_id || null,
        semester_id: subject.semester_id || null
      });
      if (error) return fail('Saving the subject failed', error);
    }
    const others = this.getSubjects().filter((x) => x.id !== subject.id);
    this.setLocal(STORAGE_KEYS.SUBJECTS, [...others, subject]);
    return OK;
  }

  /** Deletes a subject. Classes that use it are deleted with it (database cascade). */
  async deleteSubject(id: string): Promise<SaveResult> {
    const db = this.client();
    if (db) {
      const { error } = await db.from('subjects').delete().eq('id', id);
      if (error) return fail('Deleting the subject failed', error);
    }
    this.setLocal(STORAGE_KEYS.SUBJECTS, this.getSubjects().filter((x) => x.id !== id));
    this.setLocal(
      STORAGE_KEYS.TIMETABLE,
      this.getTimetable().filter((t) => this.resolveSubjectId(t) !== id)
    );
    return OK;
  }

  // --- TIMETABLE ENTRIES ---
  getTimetable(): TimetableSlot[] {
    return this.getLocal<TimetableSlot[]>(STORAGE_KEYS.TIMETABLE, []);
  }

  /**
   * Persists the timetable. The database stores subject/professor/semester as foreign keys, so the
   * referenced rows are created first (never overwriting existing ones). Times come from the slot or
   * from its period; a slot whose time cannot be resolved is reported as an error instead of being
   * silently given a made-up time.
   */
  async saveTimetable(slots: TimetableSlot[]): Promise<SaveResult> {
    this.setLocal(STORAGE_KEYS.TIMETABLE, slots);
    const db = this.client();
    if (!db) return OK;

    const periods = this.getPeriods();
    const rows: Array<{ id: string } & Record<string, unknown>> = [];
    const semesters = new Map<string, { id: string; name: string; number: number }>();
    const subjects = new Map<string, Record<string, unknown>>();
    const professors = new Map<string, Record<string, unknown>>();
    const problems: string[] = [];

    for (const s of slots) {
      const label = `${s.branch} ${s.day} "${s.subject}"`;
      const period = periods.find((p) => String(p.id) === String(s.periodId));
      const start = to24h(s.start_time) || to24h(period?.start || period?.start_time);
      const end = to24h(s.end_time) || to24h(period?.end || period?.end_time);
      const semesterId = s.semester_id || s.semester;
      const semNumber = Number(String(semesterId || '').replace(/\D/g, ''));

      if (!start || !end) { problems.push(`${label}: no valid start/end time (period "${s.periodId}" not found)`); continue; }
      if (!semesterId || !(semNumber >= 1 && semNumber <= 8)) { problems.push(`${label}: semester is missing or not SEM1-SEM8`); continue; }
      if (!s.subject?.trim()) { problems.push(`${label}: subject is empty`); continue; }
      if (!s.teacher?.trim()) { problems.push(`${label}: teacher is empty`); continue; }

      const subjectId = this.resolveSubjectId(s);
      const professorId = s.professor_id || deriveProfessorId(s.teacher);
      semesters.set(semesterId, { id: semesterId, name: `Semester ${semNumber}`, number: semNumber });
      subjects.set(subjectId, {
        id: subjectId, name: s.subject.trim(), code: s.subject_id || subjectId.replace(/^SUB-/, ''),
        branch_id: s.branch_id || s.branch, semester_id: semesterId
      });
      professors.set(professorId, { id: professorId, name: s.teacher.trim() });

      rows.push({
        id: s.id,
        branch_id: s.branch_id || s.branch,
        semester_id: semesterId,
        subject_id: subjectId,
        professor_id: professorId,
        classroom_id: s.classroom_id || s.roomId,
        day_of_week: DAY_TO_NUM[s.day] || s.day_of_week || 0,
        start_time: start,
        end_time: end,
        class_type: s.class_type || s.type,
        is_published: s.is_published !== false
      });
    }

    if (problems.length > 0) {
      return fail('Timetable not saved to the database', `${problems.length} invalid row(s): ${problems.slice(0, 3).join('; ')}${problems.length > 3 ? '…' : ''}`);
    }

    // Parents first; never overwrite rows an admin may have edited.
    const ensure = async (table: string, values: Array<Record<string, unknown>>) => {
      if (values.length === 0) return OK;
      const { error } = await db.from(table).upsert(values, { onConflict: 'id', ignoreDuplicates: true });
      return error ? fail(`Preparing ${table} failed`, error) : OK;
    };
    for (const [table, map] of [['semesters', semesters], ['subjects', subjects], ['professors', professors]] as const) {
      const r = await ensure(table, [...map.values()]);
      if (!r.ok) return r;
    }

    return this.replaceRemote('timetable_entries', rows);
  }

  // --- HOLIDAYS ---
  getHolidays(): Holiday[] {
    return this.getLocal<Holiday[]>(STORAGE_KEYS.HOLIDAYS, []);
  }

  async saveHolidays(holidays: Holiday[]): Promise<SaveResult> {
    this.setLocal(STORAGE_KEYS.HOLIDAYS, holidays);
    const db = this.client();
    if (!db) return OK;

    const res = await this.replaceRemote(
      'holidays',
      holidays.map((h) => ({
        id: h.id,
        start_date: h.startDate || h.start_date,
        end_date: h.endDate || h.end_date || h.startDate,
        title: h.title,
        type: h.type === 'sunday' ? 'holiday' : h.type,
        greeting: h.greeting || h.description || null,
        banner_url: h.banner_url || null,
        is_whole_college: h.is_whole_college !== false
      }))
    );
    if (!res.ok) return res;

    // Branch-specific closures live in holiday_branches.
    if (holidays.length > 0) {
      const ids = holidays.map((h) => h.id);
      const { error: delError } = await db.from('holiday_branches').delete().in('holiday_id', ids);
      if (delError) return fail('Updating holiday branches failed', delError);
      const links = holidays
        .filter((h) => h.is_whole_college === false)
        .flatMap((h) => (h.branches || []).map((b) => ({ holiday_id: h.id, branch_id: b })));
      if (links.length > 0) {
        const { error } = await db.from('holiday_branches').insert(links);
        if (error) return fail('Saving holiday branches failed', error);
      }
    }
    return OK;
  }

  // --- NOTICES / ANNOUNCEMENTS ---
  getNotices(): Notice[] {
    return this.getLocal<Notice[]>(STORAGE_KEYS.NOTICES, []);
  }

  async saveNotices(notices: Notice[]): Promise<SaveResult> {
    this.setLocal(STORAGE_KEYS.NOTICES, notices);
    if (!this.client()) return OK;
    const tz = this.getSettings().timezone || 'Asia/Kolkata';
    const rows: Array<{ id: string } & Record<string, unknown>> = [];
    for (const n of notices) {
      if (!n.endDate) {
        return fail('Saving announcements failed', `"${n.title}" needs an end date (the database requires an expiry)`);
      }
      rows.push({
        id: n.id,
        title: n.title,
        body: n.content,
        kind: n.is_emergency || n.priority === 'urgent' ? 'emergency' : 'academic',
        is_emergency: Boolean(n.is_emergency || n.priority === 'urgent'),
        closes_college: Boolean(n.closes_college),
        starts_at: zonedToISO(n.startDate || isoToZonedDate(new Date().toISOString(), tz), '00:00:00', tz),
        // "inactive" is stored as already-expired, because the table has no separate active flag
        expires_at: n.active === false ? new Date(Date.now() - 1000).toISOString() : zonedToISO(n.endDate, '23:59:59', tz)
      });
    }
    return this.replaceRemote('announcements', rows);
  }

  // --- ROOM BOOKINGS (shared through Supabase; the browser only keeps a read cache) ---
  private dateDaysAgo(days: number): string {
    const today = this.todayInCollegeZone();
    const [y, m, d] = today.split('-').map(Number);
    return new Date(Date.UTC(y, m - 1, d - days)).toISOString().slice(0, 10);
  }

  getBookings(): RoomBooking[] {
    return this.getLocal<RoomBooking[]>(STORAGE_KEYS.BOOKINGS, []);
  }

  /** Secrets for bookings made in this browser; they allow cancelling them later without logging in. */
  private getBookingTokens(): Record<string, string> {
    return this.getLocal<Record<string, string>>(STORAGE_KEYS.BOOKING_TOKENS, {});
  }

  /** Ids of the bookings this browser made (so the person can cancel their own). */
  getMyBookingIds(): string[] {
    return Object.keys(this.getBookingTokens());
  }

  /**
   * Asks the database for a room. Every rule (free room, working day, no class, no clash) is enforced
   * there, so a booking that succeeds is the same booking every other device sees.
   */
  async requestBooking(input: {
    roomId: string;
    periodId: string | number;
    date: string;
    bookedBy: string;
    reason: string;
  }): Promise<SaveResult & { booking?: RoomBooking }> {
    const db = this.client();
    if (!db) return { ok: false, error: bookingErrorMessage('NO_DATABASE') };
    const { data, error } = await db.rpc('request_room_booking', {
      p_room_id: input.roomId,
      p_period_id: String(input.periodId),
      p_date: input.date,
      p_booked_by: input.bookedBy,
      p_reason: input.reason
    });
    if (error) return { ok: false, error: bookingErrorMessage(error.message) };
    const created = data as { id: string; token: string } | null;
    if (!created?.id) return { ok: false, error: 'The database did not confirm the booking.' };

    this.setLocal(STORAGE_KEYS.BOOKING_TOKENS, { ...this.getBookingTokens(), [created.id]: created.token });
    const booking: RoomBooking = {
      id: created.id,
      roomId: input.roomId,
      periodId: String(input.periodId),
      date: input.date,
      day: dayNameOfDate(input.date),
      bookedBy: input.bookedBy.trim(),
      reason: input.reason.trim(),
      status: 'pending',
      createdAt: Date.now()
    };
    this.setLocal(STORAGE_KEYS.BOOKINGS, [booking, ...this.getBookings().filter((b) => b.id !== booking.id)]);
    return { ok: true, booking };
  }

  /** Cancels a booking: the admin can cancel any; anyone else only the ones this browser made. */
  async cancelBooking(id: string): Promise<SaveResult> {
    const db = this.client();
    if (!db) return { ok: false, error: bookingErrorMessage('NO_DATABASE') };
    const { error } = await db.rpc('cancel_room_booking', { p_id: id, p_token: this.getBookingTokens()[id] ?? null });
    if (error) return { ok: false, error: bookingErrorMessage(error.message) };
    this.patchLocalBooking(id, 'cancelled');
    return OK;
  }

  /** Admin only: approve or reject a pending booking. */
  async decideBooking(id: string, status: 'approved' | 'rejected'): Promise<SaveResult> {
    const db = this.client();
    if (!db) return { ok: false, error: bookingErrorMessage('NO_DATABASE') };
    const { error } = await db.rpc('decide_room_booking', { p_id: id, p_status: status });
    if (error) return { ok: false, error: bookingErrorMessage(error.message) };
    this.patchLocalBooking(id, status);
    return OK;
  }

  private patchLocalBooking(id: string, status: NonNullable<RoomBooking['status']>): void {
    this.setLocal(
      STORAGE_KEYS.BOOKINGS,
      this.getBookings().map((b) => (b.id === id ? { ...b, status } : b))
    );
  }

  // --- QUICK OVERRIDES (Timetable Exceptions) ---
  private todayInCollegeZone(): string {
    return isoToZonedDate(new Date().toISOString(), this.getSettings().timezone || 'Asia/Kolkata');
  }

  /** Overrides that apply to today's date in the college timezone (not the browser's/UTC date). */
  getQuickOverrides(): QuickOverride[] {
    const today = this.todayInCollegeZone();
    const all = this.getLocal<QuickOverride[]>(STORAGE_KEYS.OVERRIDES, []);
    return all.filter((o) => o.date === today);
  }

  async addQuickOverride(
    override: Omit<QuickOverride, 'id' | 'createdAt'>
  ): Promise<{ override: QuickOverride; result: SaveResult }> {
    const full: QuickOverride = {
      ...override,
      id: 'ov-' + Date.now() + '-' + Math.random().toString(36).slice(2, 6),
      createdAt: Date.now()
    };
    const previous = this.getLocal<QuickOverride[]>(STORAGE_KEYS.OVERRIDES, []);
    this.setLocal(STORAGE_KEYS.OVERRIDES, [full, ...previous]);

    const db = this.client();
    // Only class-specific overrides map to timetable_exceptions; a "mark college holiday" override
    // is a browser-local convenience (create a real Holiday for a database-backed closure).
    if (db && override.targetId && (override.type === 'cancel_class' || override.type === 'swap_room')) {
      const { error } = await db.from('timetable_exceptions').insert({
        id: full.id,
        timetable_entry_id: override.targetId,
        exception_date: override.date,
        action: override.type === 'swap_room' ? 'room_swap' : 'cancelled',
        new_classroom_id: override.replacementRoomId || null,
        reason: override.note || null
      });
      if (error) {
        this.setLocal(STORAGE_KEYS.OVERRIDES, previous);
        return { override: full, result: fail('Saving the override failed', error) };
      }
    }
    return { override: full, result: OK };
  }

  async deleteQuickOverride(id: string): Promise<SaveResult> {
    const current = this.getLocal<QuickOverride[]>(STORAGE_KEYS.OVERRIDES, []);
    const db = this.client();
    if (db) {
      const { error } = await db.from('timetable_exceptions').delete().eq('id', id);
      if (error) return fail('Removing the override failed', error);
    }
    this.setLocal(STORAGE_KEYS.OVERRIDES, current.filter((o) => o.id !== id));
    return OK;
  }

  // --- UPLOAD HISTORY & SNAPSHOTS ---
  getUploadHistory(): UploadHistoryItem[] {
    return this.getLocal<UploadHistoryItem[]>(STORAGE_KEYS.UPLOAD_HISTORY, []);
  }

  async saveUploadHistory(item: UploadHistoryItem): Promise<SaveResult> {
    const current = this.getUploadHistory();
    this.setLocal(STORAGE_KEYS.UPLOAD_HISTORY, [item, ...current].slice(0, 5));

    const db = this.client();
    if (!db) return OK;
    let snapshot: unknown = null;
    try {
      snapshot = item.previousSnapshot ? JSON.parse(item.previousSnapshot) : null;
    } catch {
      snapshot = null;
    }
    const { data: auth } = await db.auth.getUser();
    const { error } = await db.from('upload_history').insert({
      id: item.id,
      uploaded_by: auth.user?.id ?? null,
      file_name: item.fileName,
      row_counts: item.counts,
      status: 'success',
      snapshot
    });
    return error ? fail('Recording upload history failed', error) : OK;
  }

  createStateSnapshot(): string {
    return JSON.stringify({
      timetable: this.getTimetable(),
      rooms: this.getRooms(),
      holidays: this.getHolidays(),
      periods: this.getPeriods(),
      notices: this.getNotices(),
      branches: this.getBranches()
    });
  }

  /** Restores a snapshot locally AND remotely, in foreign-key order, stopping at the first failure. */
  async restoreSnapshot(snapshotString: string): Promise<SaveResult> {
    let data: Record<string, any>;
    try {
      data = JSON.parse(snapshotString);
    } catch (err) {
      return fail('Snapshot is corrupt', String(err));
    }
    const steps: Array<[string, (() => Promise<SaveResult>) | null]> = [
      ['branches', data.branches ? () => this.saveBranches(data.branches) : null],
      ['rooms', data.rooms ? () => this.saveRooms(data.rooms) : null],
      ['periods', data.periods ? () => this.savePeriods(data.periods) : null],
      ['timetable', data.timetable ? () => this.saveTimetable(data.timetable) : null],
      ['holidays', data.holidays ? () => this.saveHolidays(data.holidays) : null],
      ['notices', data.notices ? () => this.saveNotices(data.notices) : null]
    ];
    for (const [, run] of steps) {
      if (!run) continue;
      const r = await run();
      if (!r.ok) return r;
    }
    return OK;
  }

  // --- SYNC FROM SUPABASE TO LOCALSTORAGE ---
  /**
   * Loads everything from Supabase and makes it the source of truth in this browser. A table that
   * loads successfully replaces the local copy even when it is empty (so deletions propagate and
   * sample data is not shown as live data). A table that fails to load keeps its local copy and is
   * reported in `errors`.
   */
  async syncFromSupabase(): Promise<{ ok: boolean; errors: string[] }> {
    const db = this.client();
    if (!db) return { ok: false, errors: ['Supabase is not configured'] };

    const errors: string[] = [];
    try {
      const [settingsRes, branchesRes, classroomsRes, periodsRes, timetableRes, holidaysRes, holidayBranchesRes,
        announcementsRes, exceptionsRes, subjectsRes, professorsRes, bookingsRes] = await Promise.all([
        db.from('settings').select('*').eq('id', 'current').maybeSingle(),
        db.from('branches').select('*'),
        db.from('classrooms').select('*'),
        db.from('periods').select('*').order('period_number', { ascending: true }),
        db.from('timetable_entries').select('*'),
        db.from('holidays').select('*'),
        db.from('holiday_branches').select('*'),
        db.from('announcements').select('*'),
        db.from('timetable_exceptions').select('*'),
        db.from('subjects').select('*'),
        db.from('professors').select('id,name'),
        db.from('room_bookings').select('*').gte('booking_date', this.dateDaysAgo(2))
      ]);

      const check = (name: string, res: { error: { message: string } | null }) => {
        if (res.error) errors.push(`${name}: ${res.error.message}`);
        return !res.error;
      };

      let tz = this.getSettings().timezone || 'Asia/Kolkata';

      if (check('settings', settingsRes) && settingsRes.data) {
        const s = settingsRes.data;
        tz = s.timezone || tz;
        this.setLocal(STORAGE_KEYS.SETTINGS, {
          id: s.id,
          college_name: s.college_name,
          logo_url: s.logo_url,
          timezone: s.timezone || 'Asia/Kolkata',
          academic_year: s.academic_year || '',
          working_days: s.working_days || DEFAULT_SETTINGS.working_days,
          opening_time: s.opening_time || '08:30',
          closing_time: s.closing_time || '17:00',
          contact_address: s.contact_address,
          contact_phone: s.contact_phone,
          contact_email: s.contact_email
        });
      }

      if (check('branches', branchesRes)) {
        this.setLocal(
          STORAGE_KEYS.BRANCHES,
          (branchesRes.data || []).map((b: any, i: number) => ({
            id: b.id,
            name: b.name,
            shortName: b.short_name || b.id,
            short_name: b.short_name || b.id,
            code: b.code || b.id,
            color: b.color || branchStyleAt(i).color,
            ...branchStyleAt(i).classes
          }))
        );
      }

      if (check('classrooms', classroomsRes)) {
        this.setLocal(
          STORAGE_KEYS.ROOMS,
          (classroomsRes.data || []).map((c: any) => ({
            id: c.id,
            name: c.name,
            type: c.type,
            capacity: c.capacity,
            floor: c.floor,
            building: c.building,
            isMaintenance: Boolean(c.is_under_maintenance),
            is_under_maintenance: Boolean(c.is_under_maintenance)
          }))
        );
      }

      let periods: Period[] = this.getPeriods();
      if (check('periods', periodsRes)) {
        periods = (periodsRes.data || []).map((p: any) => ({
          id: p.id,
          order: p.period_number,
          period_number: p.period_number,
          start: String(p.start_time || '').slice(0, 5),
          end: String(p.end_time || '').slice(0, 5),
          start_time: p.start_time,
          end_time: p.end_time,
          label: p.label,
          isBreak: Boolean(p.is_break),
          is_break: Boolean(p.is_break)
        }));
        this.setLocal(STORAGE_KEYS.PERIODS, periods);
      }

      const okSubjects = check('subjects', subjectsRes);
      if (okSubjects) {
        this.setLocal(
          STORAGE_KEYS.SUBJECTS,
          (subjectsRes.data || []).map((x: any) => ({
            id: x.id, name: x.name, code: x.code, branch_id: x.branch_id || undefined, semester_id: x.semester_id || undefined
          }))
        );
      }
      const okProfs = check('professors', professorsRes);
      const subjectName = new Map<string, string>((subjectsRes.data || []).map((x: any) => [x.id, x.name]));
      const profName = new Map<string, string>((professorsRes.data || []).map((x: any) => [x.id, x.name]));

      if (check('timetable_entries', timetableRes)) {
        this.setLocal(
          STORAGE_KEYS.TIMETABLE,
          (timetableRes.data || []).map((t: any) => {
            const start = String(t.start_time || '').slice(0, 5);
            const end = String(t.end_time || '').slice(0, 5);
            const startMin = timeStringToMinutes(start);
            // Match the period by its time window (a slot's own id is NOT a period id).
            const period =
              periods.find((p) => !p.isBreak && to24h(p.start) === start && to24h(p.end) === end) ||
              periods.find((p) => !p.isBreak && timeStringToMinutes(p.start) <= startMin && startMin < timeStringToMinutes(p.end));
            return {
              id: t.id,
              branch: t.branch_id,
              branch_id: t.branch_id,
              semester: t.semester_id,
              semester_id: t.semester_id,
              day: (NUM_TO_DAY[t.day_of_week] || 'Monday') as TimetableSlot['day'],
              day_of_week: t.day_of_week,
              periodId: period ? period.id : `t_${start}_${end}`,
              subject: okSubjects ? subjectName.get(t.subject_id) || t.subject_id : t.subject_id,
              subject_id: t.subject_id,
              teacher: okProfs ? profName.get(t.professor_id) || t.professor_id : t.professor_id,
              professor_id: t.professor_id,
              roomId: t.classroom_id,
              classroom_id: t.classroom_id,
              type: t.class_type,
              class_type: t.class_type,
              start_time: start,
              end_time: end,
              is_published: t.is_published
            };
          })
        );
      }

      if (check('holidays', holidaysRes)) {
        const branchLinks = new Map<string, string[]>();
        if (check('holiday_branches', holidayBranchesRes)) {
          for (const l of holidayBranchesRes.data || []) {
            branchLinks.set(l.holiday_id, [...(branchLinks.get(l.holiday_id) || []), l.branch_id]);
          }
        }
        this.setLocal(
          STORAGE_KEYS.HOLIDAYS,
          (holidaysRes.data || []).map((h: any) => ({
            id: h.id,
            startDate: h.start_date,
            endDate: h.end_date,
            start_date: h.start_date,
            end_date: h.end_date,
            title: h.title,
            type: h.type,
            description: h.greeting || '',
            greeting: h.greeting || '',
            banner_url: h.banner_url || undefined,
            is_whole_college: h.is_whole_college,
            branches: branchLinks.get(h.id) || []
          }))
        );
      }

      if (check('announcements', announcementsRes)) {
        this.setLocal(
          STORAGE_KEYS.NOTICES,
          (announcementsRes.data || []).map((a: any) => ({
            id: a.id,
            title: a.title,
            content: a.body,
            priority: a.is_emergency ? 'urgent' : 'normal',
            startDate: isoToZonedDate(a.starts_at, tz),
            endDate: isoToZonedDate(a.expires_at, tz),
            active: Date.parse(a.expires_at) > Date.now(),
            is_emergency: a.is_emergency,
            closes_college: a.closes_college
          }))
        );
      }

      if (check('room_bookings', bookingsRes)) {
        this.setLocal(
          STORAGE_KEYS.BOOKINGS,
          (bookingsRes.data || []).map((b: any): RoomBooking => ({
            id: b.id,
            roomId: b.room_id,
            periodId: b.period_id,
            date: b.booking_date,
            day: dayNameOfDate(b.booking_date),
            bookedBy: b.booked_by,
            reason: b.reason,
            status: b.status,
            createdAt: Date.parse(b.created_at) || Date.now()
          }))
        );
      }

      if (check('timetable_exceptions', exceptionsRes)) {
        const remote: QuickOverride[] = (exceptionsRes.data || [])
          .filter((e: any) => e.action === 'cancelled' || e.action === 'room_swap')
          .map((e: any) => ({
            id: e.id,
            type: e.action === 'room_swap' ? 'swap_room' : 'cancel_class',
            date: e.exception_date,
            targetId: e.timetable_entry_id,
            replacementRoomId: e.new_classroom_id || undefined,
            note: e.reason || undefined,
            createdAt: Date.parse(e.created_at) || Date.now()
          }));
        // Keep browser-local "mark holiday" overrides; everything class-specific comes from the DB.
        const localOnly = this.getLocal<QuickOverride[]>(STORAGE_KEYS.OVERRIDES, []).filter((o) => o.type === 'mark_holiday');
        this.setLocal(STORAGE_KEYS.OVERRIDES, [...remote, ...localOnly]);
      }
    } catch (err) {
      errors.push(err instanceof Error ? err.message : String(err));
    }

    if (errors.length > 0) console.warn('Supabase sync problems:', errors);
    return { ok: errors.length === 0, errors };
  }

  /** Realtime subscription; `onUpdate` fires after local data has been refreshed from the database. */
  setupRealtimeSubscription(onUpdate: () => void): () => void {
    const db = this.client();
    if (!db) return () => {};

    const tables = ['timetable_entries', 'timetable_exceptions', 'holidays', 'holiday_branches', 'announcements',
      'periods', 'classrooms', 'branches', 'settings', 'room_bookings'];
    let timer: ReturnType<typeof setTimeout> | undefined;
    const refresh = () => {
      // Debounce bursts (a bulk import emits one event per row).
      clearTimeout(timer);
      timer = setTimeout(() => { this.syncFromSupabase().then(onUpdate).catch(() => {}); }, 400);
    };

    let channel = db.channel('collegeconnect_realtime');
    for (const table of tables) {
      channel = channel.on('postgres_changes', { event: '*', schema: 'public', table }, refresh);
    }
    channel.subscribe();

    return () => {
      clearTimeout(timer);
      void db.removeChannel(channel);
    };
  }

  /** Put a previous value back into the local cache (used to roll back a change the database rejected). */
  restoreLocal(kind: 'branches' | 'rooms' | 'periods' | 'timetable' | 'holidays' | 'notices', value: unknown): void {
    this.setLocal(STORAGE_KEYS[kind.toUpperCase() as keyof typeof STORAGE_KEYS], value);
  }

  /** Restore a snapshot into the local cache only (rollback after the database rejected a change). */
  restoreLocalOnly(snapshotString: string): void {
    const data = JSON.parse(snapshotString);
    if (data.timetable) this.setLocal(STORAGE_KEYS.TIMETABLE, data.timetable);
    if (data.rooms) this.setLocal(STORAGE_KEYS.ROOMS, data.rooms);
    if (data.holidays) this.setLocal(STORAGE_KEYS.HOLIDAYS, data.holidays);
    if (data.periods) this.setLocal(STORAGE_KEYS.PERIODS, data.periods);
    if (data.notices) this.setLocal(STORAGE_KEYS.NOTICES, data.notices);
    if (data.branches) this.setLocal(STORAGE_KEYS.BRANCHES, data.branches);
  }

  resetToDefaults(): void {
    try {
      localStorage.removeItem(STORAGE_KEYS.BRANCHES);
      localStorage.removeItem(STORAGE_KEYS.ROOMS);
      localStorage.removeItem(STORAGE_KEYS.PERIODS);
      localStorage.removeItem(STORAGE_KEYS.TIMETABLE);
      localStorage.removeItem(STORAGE_KEYS.HOLIDAYS);
      localStorage.removeItem(STORAGE_KEYS.NOTICES);
      localStorage.removeItem(STORAGE_KEYS.SUBJECTS);
      localStorage.removeItem(STORAGE_KEYS.BOOKINGS);
      localStorage.removeItem(STORAGE_KEYS.OVERRIDES);
      localStorage.removeItem(STORAGE_KEYS.UPLOAD_HISTORY);
      localStorage.removeItem(STORAGE_KEYS.SETTINGS);
    } catch (e) {
      console.warn('Error clearing localStorage defaults', e);
    }
  }
}

export const storageService = new StorageService();
