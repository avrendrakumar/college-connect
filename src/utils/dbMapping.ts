import { timeStringToMinutes } from './timeEngine';

// Pure helpers that translate between the app's data and the database's column formats.

/** "01:45" (12h-style afternoon shorthand used by the sample periods) or "13:45" -> "13:45" (24h) */
export function to24h(t: string | undefined | null): string | null {
  if (!t) return null;
  const clean = String(t).trim().slice(0, 5);
  if (!/^\d{1,2}:\d{2}$/.test(clean)) return null;
  const mins = timeStringToMinutes(clean);
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  if (h > 23) return null;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

const slug = (v: string) =>
  v.trim().toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '') || 'unknown';

export const deriveSubjectId = (nameOrCode: string) => `SUB-${slug(nameOrCode).toUpperCase().replace(/_/g, '-')}`;
export const deriveProfessorId = (name: string) => `prof_${slug(name)}`;

/** Convert a wall-clock date+time in an IANA zone into a UTC ISO string. */
export function zonedToISO(date: string, time: string, timeZone: string): string {
  const [y, m, d] = date.split('-').map(Number);
  const [hh, mm, ss] = time.split(':').map(Number);
  const guess = Date.UTC(y, m - 1, d, hh, mm, ss || 0);
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    hourCycle: 'h23',
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit'
  }).formatToParts(new Date(guess));
  const g = (t: string) => Number(parts.find((p) => p.type === t)!.value);
  const asUTC = Date.UTC(g('year'), g('month') - 1, g('day'), g('hour'), g('minute'), g('second'));
  return new Date(guess - (asUTC - guess)).toISOString();
}

/** UTC ISO timestamp -> "YYYY-MM-DD" as seen on the wall clock in the given zone. */
export function isoToZonedDate(iso: string, timeZone: string): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(iso));
}
