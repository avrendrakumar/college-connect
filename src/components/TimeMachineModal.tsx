import React from 'react';
import { motion, useReducedMotion } from 'motion/react';
import { Clock, RotateCcw, X, Zap } from 'lucide-react';
import { Holiday } from '../types';
import { isoToZonedDate, zonedToISO } from '../utils/dbMapping';
import { getCollegeZonedTime } from '../utils/timeEngine';

interface TimeMachineModalProps {
  isOpen: boolean;
  onClose: () => void;
  simulatedDate: Date;
  onUpdateSimulatedDate: (newDate: Date) => void;
  onResetToRealTime: () => void;
  isSimulated: boolean;
  /** College IANA timezone: the date/time fields below are wall-clock values in this zone. */
  timeZone?: string;
  /** Used to offer a one-click jump to the next real holiday in the calendar. */
  holidays?: Holiday[];
}

/** Add whole days to a YYYY-MM-DD string (pure calendar arithmetic, no timezone involved). */
const addDays = (dateStr: string, days: number): string => {
  const [y, m, d] = dateStr.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d + days)).toISOString().slice(0, 10);
};

/** Next date (today included) that falls on the given weekday (0 = Sunday). */
const nextWeekday = (todayStr: string, weekday: number): string => {
  const [y, m, d] = todayStr.split('-').map(Number);
  const current = new Date(Date.UTC(y, m - 1, d)).getUTCDay();
  return addDays(todayStr, (weekday - current + 7) % 7);
};

export const TimeMachineModal: React.FC<TimeMachineModalProps> = ({
  isOpen,
  onClose,
  simulatedDate,
  onUpdateSimulatedDate,
  onResetToRealTime,
  isSimulated,
  timeZone = 'Asia/Kolkata',
  holidays = []
}) => {
  const reduce = useReducedMotion();
  if (!isOpen) return null;

  const zoned = getCollegeZonedTime(simulatedDate, timeZone);
  const currentDateInput = zoned.dateStr;
  const currentTimeInput = zoned.timeString.slice(0, 5);

  const apply = (dateStr: string, hour: number, minute: number) => {
    const iso = zonedToISO(dateStr, `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}:00`, timeZone);
    onUpdateSimulatedDate(new Date(iso));
  };

  const handleDateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    if (!val) return;
    const [h, m] = currentTimeInput.split(':').map(Number);
    apply(val, h, m);
  };

  const handleTimeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    if (!val) return;
    const [h, m] = val.split(':').map(Number);
    apply(currentDateInput, h, m);
  };

  // Presets are relative to today (in the college zone), so they never go stale.
  const todayStr = isoToZonedDate(new Date().toISOString(), timeZone);
  const nextMonday = nextWeekday(todayStr, 1);
  const nextSunday = nextWeekday(todayStr, 0);
  const upcomingHoliday = holidays
    .filter((h) => h.is_whole_college !== false && (h.endDate || h.end_date || '') >= todayStr)
    .sort((a, b) => (a.startDate || '').localeCompare(b.startDate || ''))[0];
  const holidayDate = upcomingHoliday
    ? ((upcomingHoliday.startDate || '') > todayStr ? upcomingHoliday.startDate : todayStr)
    : '';

  const presetClass =
    'px-3 py-2.5 text-left rounded-xl border-2 border-[var(--ink)] bg-[var(--paper-2)] shadow-[2px_2px_0_var(--hard)] hover:-translate-x-px hover:-translate-y-px hover:bg-[var(--yellow)] hover:text-[#15163a] active:translate-x-0.5 active:translate-y-0.5 active:shadow-none transition disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-[var(--paper-2)] disabled:hover:translate-x-0 disabled:hover:translate-y-0';
  const inputClass =
    'w-full px-3 py-2 text-sm rounded-xl border-2 border-[var(--ink)] bg-[var(--paper-2)] text-[var(--ink)] outline-none focus:ring-4 focus:ring-[var(--orange)]/40';

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#15163a]/70"
      role="dialog"
      aria-modal="true"
      aria-labelledby="tm-title"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <motion.div
        initial={reduce ? false : { opacity: 0, scale: 0.9, rotate: -2, y: 24 }}
        animate={{ opacity: 1, scale: 1, rotate: 0, y: 0 }}
        transition={{ type: 'spring', stiffness: 300, damping: 22 }}
        className="ticket w-full max-w-lg p-6 max-h-[92vh] overflow-y-auto"
      >
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-3">
            <span className="w-11 h-11 rounded-xl border-2 border-[#15163a] bg-[var(--yellow)] text-[#15163a] flex items-center justify-center shadow-[2px_2px_0_#15163a]">
              <Clock className="w-5 h-5" />
            </span>
            <div>
              <h2 id="tm-title" className="text-lg font-black leading-tight">Time machine</h2>
              <p className="text-sm opacity-75">See the campus on any day and hour.</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="w-9 h-9 rounded-xl border-2 border-current flex items-center justify-center hover:bg-[var(--orange)] hover:text-[#15163a] hover:border-[#15163a] transition"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 my-6">
          <div>
            <label htmlFor="tm-date" className="block text-sm font-bold mb-1.5">Date</label>
            <input id="tm-date" type="date" value={currentDateInput} onChange={handleDateChange} className={inputClass} />
          </div>
          <div>
            <label htmlFor="tm-time" className="block text-sm font-bold mb-1.5">Time ({timeZone})</label>
            <input id="tm-time" type="time" value={currentTimeInput} onChange={handleTimeChange} className={`${inputClass} font-mono`} />
          </div>
        </div>

        <div className="mb-6">
          <div className="flex items-center gap-1.5 text-sm font-bold mb-2">
            <Zap className="w-4 h-4 text-[var(--orange)]" />
            Jump to
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            <button type="button" onClick={() => apply(nextMonday, 10, 15)} className={presetClass}>
              <div className="font-bold text-sm">Monday 10:15</div>
              <div className="text-xs opacity-70">Morning classes</div>
            </button>
            <button type="button" onClick={() => apply(nextMonday, 13, 15)} className={presetClass}>
              <div className="font-bold text-sm">Monday 13:15</div>
              <div className="text-xs opacity-70">Lunch hour</div>
            </button>
            <button type="button" onClick={() => apply(nextMonday, 14, 30)} className={presetClass}>
              <div className="font-bold text-sm">Monday 14:30</div>
              <div className="text-xs opacity-70">Afternoon classes</div>
            </button>
            <button type="button" onClick={() => apply(nextMonday, 18, 0)} className={presetClass}>
              <div className="font-bold text-sm">Monday 18:00</div>
              <div className="text-xs opacity-70">After closing</div>
            </button>
            <button type="button" onClick={() => apply(nextSunday, 11, 0)} className={presetClass}>
              <div className="font-bold text-sm">Sunday 11:00</div>
              <div className="text-xs opacity-70">Weekly off</div>
            </button>
            <button
              type="button"
              onClick={() => holidayDate && apply(holidayDate, 11, 0)}
              disabled={!upcomingHoliday}
              title={upcomingHoliday ? undefined : 'No upcoming whole-college holiday in the calendar'}
              className={presetClass}
            >
              <div className="font-bold text-sm truncate">{upcomingHoliday ? upcomingHoliday.title : 'Next holiday'}</div>
              <div className="text-xs opacity-70">{upcomingHoliday ? holidayDate : 'None scheduled'}</div>
            </button>
          </div>
        </div>

        <div className="flex items-center justify-between gap-3 pt-4 border-t-2 border-dashed border-[var(--ink)]">
          <button
            type="button"
            onClick={() => {
              onResetToRealTime();
              onClose();
            }}
            disabled={!isSimulated}
            className="inline-flex items-center gap-1.5 text-sm font-bold px-3 py-2 rounded-xl hover:bg-[var(--orange)] hover:text-[#15163a] disabled:opacity-40 disabled:hover:bg-transparent transition"
          >
            <RotateCcw className="w-4 h-4" />
            Back to real time
          </button>
          <button type="button" onClick={onClose} className="btn btn--blue">
            Show this time
          </button>
        </div>
      </motion.div>
    </div>
  );
};
