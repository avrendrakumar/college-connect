import React, { useState } from 'react';
import { CalendarCheck, Check, X } from 'lucide-react';
import { Period, Room, RoomBooking } from '../../types';

interface BookingsManagerProps {
  bookings: RoomBooking[];
  rooms: Room[];
  periods: Period[];
  /** Today's date (YYYY-MM-DD) in the college timezone. */
  todayStr: string;
  onDecide: (id: string, status: 'approved' | 'rejected') => Promise<{ ok: boolean; error?: string }>;
  onCancel: (id: string) => Promise<{ ok: boolean; error?: string }>;
}

const STATUS_LABEL: Record<NonNullable<RoomBooking['status']>, string> = {
  pending: 'Waiting',
  approved: 'Approved',
  rejected: 'Rejected',
  cancelled: 'Cancelled'
};

const STATUS_STYLE: Record<NonNullable<RoomBooking['status']>, string> = {
  pending: 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300',
  approved: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300',
  rejected: 'bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300',
  cancelled: 'bg-slate-200 text-slate-700 dark:bg-slate-800 dark:text-slate-300'
};

export const BookingsManager: React.FC<BookingsManagerProps> = ({
  bookings,
  rooms,
  periods,
  todayStr,
  onDecide,
  onCancel
}) => {
  const [busyId, setBusyId] = useState('');
  const [showPast, setShowPast] = useState(false);

  const roomName = (id: string) => rooms.find((r) => r.id === id)?.name || id;
  const periodLabel = (id: string | number) => {
    const p = periods.find((x) => String(x.id) === String(id));
    return p ? `${p.label} (${p.start} to ${p.end})` : String(id);
  };

  const sorted = [...bookings].sort(
    (a, b) => a.date.localeCompare(b.date) || String(a.periodId).localeCompare(String(b.periodId))
  );
  const pending = sorted.filter((b) => b.status === 'pending' && b.date >= todayStr);
  const upcoming = sorted.filter((b) => b.status === 'approved' && b.date >= todayStr);
  const past = sorted.filter((b) => b.date < todayStr || b.status === 'rejected' || b.status === 'cancelled');

  const run = async (id: string, action: () => Promise<unknown>) => {
    setBusyId(id);
    try {
      await action();
    } finally {
      setBusyId('');
    }
  };

  const row = (b: RoomBooking, actions: 'decide' | 'cancel' | 'none') => {
    const status = b.status || 'approved';
    const busy = busyId === b.id;
    return (
      <li
        key={b.id}
        className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3.5 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900"
      >
        <div className="min-w-0 text-sm">
          <p className="font-bold text-slate-900 dark:text-white">
            {roomName(b.roomId)}, {periodLabel(b.periodId)}
          </p>
          <p className="text-xs text-slate-600 dark:text-slate-400">
            {b.date} ({b.day}) by {b.bookedBy}
          </p>
          <p className="text-xs text-slate-500 dark:text-slate-400 break-words">{b.reason}</p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <span className={`px-2 py-0.5 rounded-lg text-[11px] font-bold ${STATUS_STYLE[status]}`}>{STATUS_LABEL[status]}</span>
          {actions === 'decide' && (
            <>
              <button
                type="button"
                disabled={busy}
                onClick={() => run(b.id, () => onDecide(b.id, 'approved'))}
                className="flex items-center gap-1 px-3 py-1.5 rounded-xl text-xs font-bold bg-emerald-600 hover:bg-emerald-500 text-white disabled:opacity-50"
              >
                <Check className="w-3.5 h-3.5" /> Approve
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={() => run(b.id, () => onDecide(b.id, 'rejected'))}
                className="flex items-center gap-1 px-3 py-1.5 rounded-xl text-xs font-bold bg-rose-600 hover:bg-rose-500 text-white disabled:opacity-50"
              >
                <X className="w-3.5 h-3.5" /> Reject
              </button>
            </>
          )}
          {actions === 'cancel' && (
            <button
              type="button"
              disabled={busy}
              onClick={() => {
                if (window.confirm(`Cancel the booking by ${b.bookedBy}? The room becomes free for others.`)) {
                  void run(b.id, () => onCancel(b.id));
                }
              }}
              className="px-3 py-1.5 rounded-xl text-xs font-bold border border-slate-300 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-50"
            >
              Cancel booking
            </button>
          )}
        </div>
      </li>
    );
  };

  return (
    <div className="space-y-6 max-w-4xl">
      <div className="pb-3 border-b border-slate-200 dark:border-slate-800">
        <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
          <CalendarCheck className="w-5 h-5 text-indigo-500" />
          Room bookings
        </h3>
        <p className="text-xs text-slate-500">
          A waiting booking already holds its room, so nobody else can take it. Approve it to confirm, or reject it to free the room.
        </p>
      </div>

      <section aria-labelledby="bk-pending" className="space-y-3">
        <h4 id="bk-pending" className="text-sm font-bold text-slate-900 dark:text-white">
          Waiting for a decision ({pending.length})
        </h4>
        {pending.length === 0 ? (
          <p className="text-xs text-slate-500">Nothing is waiting. New requests appear here by themselves.</p>
        ) : (
          <ul className="space-y-2">{pending.map((b) => row(b, 'decide'))}</ul>
        )}
      </section>

      <section aria-labelledby="bk-upcoming" className="space-y-3">
        <h4 id="bk-upcoming" className="text-sm font-bold text-slate-900 dark:text-white">
          Approved and coming up ({upcoming.length})
        </h4>
        {upcoming.length === 0 ? (
          <p className="text-xs text-slate-500">No approved bookings ahead.</p>
        ) : (
          <ul className="space-y-2">{upcoming.map((b) => row(b, 'cancel'))}</ul>
        )}
      </section>

      <section aria-labelledby="bk-past" className="space-y-3">
        <button
          type="button"
          id="bk-past"
          onClick={() => setShowPast((v) => !v)}
          aria-expanded={showPast}
          className="text-sm font-bold text-indigo-600 dark:text-indigo-400 hover:underline"
        >
          {showPast ? 'Hide' : 'Show'} past, rejected and cancelled ({past.length})
        </button>
        {showPast && <ul className="space-y-2">{past.map((b) => row(b, 'none'))}</ul>}
      </section>
    </div>
  );
};
