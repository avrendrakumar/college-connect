import React, { useState } from 'react';
import { AlertCircle, Clock, Plus, Trash2, Zap, ArrowRightLeft, XCircle } from 'lucide-react';
import { QuickOverride, Room, TimetableSlot } from '../../types';
import { storageService, isoToZonedDate } from '../../services/storageService';

/** Today's date (YYYY-MM-DD) in the college timezone, not UTC. */
const collegeToday = () => isoToZonedDate(new Date().toISOString(), storageService.getSettings().timezone || 'Asia/Kolkata');

interface QuickOverridesManagerProps {
  overrides: QuickOverride[];
  rooms: Room[];
  timetable: TimetableSlot[];
  onAddOverride: (override: Omit<QuickOverride, 'id' | 'createdAt'>) => void;
  onDeleteOverride: (id: string) => void;
  onShowToast: (msg: string, type: 'success' | 'error' | 'info') => void;
}

export const QuickOverridesManager: React.FC<QuickOverridesManagerProps> = ({
  overrides,
  rooms,
  timetable,
  onAddOverride,
  onDeleteOverride,
  onShowToast
}) => {
  const [overrideType, setOverrideType] = useState<'mark_holiday' | 'cancel_class' | 'swap_room'>('mark_holiday');
  const [note, setNote] = useState('');
  const [selectedSlotId, setSelectedSlotId] = useState('');
  const [replacementRoomId, setReplacementRoomId] = useState('');

  const todayStr = collegeToday();

  const handleApply = (e: React.FormEvent) => {
    e.preventDefault();

    if (overrideType === 'mark_holiday') {
      onAddOverride({
        type: 'mark_holiday',
        date: todayStr,
        note: note.trim() || 'Emergency Holiday Declared by Principal'
      });
      onShowToast('Marked today as Holiday! College status updated to Closed.', 'success');
      setNote('');
    } else if (overrideType === 'cancel_class') {
      if (!selectedSlotId) {
        onShowToast('Please pick a class to cancel', 'error');
        return;
      }
      const slot = timetable.find((s) => s.id === selectedSlotId);
      onAddOverride({
        type: 'cancel_class',
        date: todayStr,
        targetId: selectedSlotId,
        note: `Cancelled: ${slot?.subject} (${slot?.branch})`
      });
      onShowToast('Class cancelled for today with "Changed Today" indicator', 'info');
    } else if (overrideType === 'swap_room') {
      if (!selectedSlotId || !replacementRoomId) {
        onShowToast('Please select both class and replacement room', 'error');
        return;
      }
      const slot = timetable.find((s) => s.id === selectedSlotId);
      onAddOverride({
        type: 'swap_room',
        date: todayStr,
        targetId: selectedSlotId,
        replacementRoomId,
        note: `Relocated ${slot?.subject} to ${replacementRoomId}`
      });
      onShowToast(`Room swapped to ${replacementRoomId} for today`, 'success');
    }
  };

  return (
    <div className="space-y-6">
      <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/20">
        <div className="flex items-center gap-2 text-amber-700 dark:text-amber-400 font-bold text-sm">
          <Zap className="w-4 h-4 text-amber-500" />
          <span>Temporary Daily Overrides (Auto-expires at Midnight)</span>
        </div>
        <p className="text-xs text-slate-600 dark:text-slate-400 mt-1">
          Apply rapid situational updates without altering base semester timetables. Marked with a "Changed today" badge on student dashboards.
        </p>
      </div>

      {/* Creation Card */}
      <form
        onSubmit={handleApply}
        className="p-5 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm space-y-4"
      >
        <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500">
          Create New Override For Today ({todayStr})
        </h4>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
          <button
            type="button"
            onClick={() => setOverrideType('mark_holiday')}
            className={`p-3 rounded-xl border text-left text-xs font-bold transition ${
              overrideType === 'mark_holiday'
                ? 'bg-rose-50 border-rose-400 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300'
                : 'bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300'
            }`}
          >
            <div className="flex items-center gap-1.5 mb-1">
              <XCircle className="w-4 h-4 text-rose-500" />
              <span>Mark Today as Holiday</span>
            </div>
            <div className="font-normal text-[11px] text-slate-500">
              Immediate full campus closure
            </div>
          </button>

          <button
            type="button"
            onClick={() => setOverrideType('cancel_class')}
            className={`p-3 rounded-xl border text-left text-xs font-bold transition ${
              overrideType === 'cancel_class'
                ? 'bg-amber-50 border-amber-400 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300'
                : 'bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300'
            }`}
          >
            <div className="flex items-center gap-1.5 mb-1">
              <Clock className="w-4 h-4 text-amber-500" />
              <span>Cancel a Single Class</span>
            </div>
            <div className="font-normal text-[11px] text-slate-500">
              Frees up room for other use
            </div>
          </button>

          <button
            type="button"
            onClick={() => setOverrideType('swap_room')}
            className={`p-3 rounded-xl border text-left text-xs font-bold transition ${
              overrideType === 'swap_room'
                ? 'bg-indigo-50 border-indigo-400 text-indigo-700 dark:bg-indigo-950/40 dark:text-indigo-300'
                : 'bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300'
            }`}
          >
            <div className="flex items-center gap-1.5 mb-1">
              <ArrowRightLeft className="w-4 h-4 text-indigo-500" />
              <span>Swap Room Today</span>
            </div>
            <div className="font-normal text-[11px] text-slate-500">
              Relocate class to free hall/lab
            </div>
          </button>
        </div>

        {overrideType === 'mark_holiday' && (
          <div>
            <label className="block text-xs font-semibold mb-1">Reason / Announcement</label>
            <input
              type="text"
              placeholder="e.g. Heavy Rain Alert / Local Civic Holiday"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white"
            />
          </div>
        )}

        {(overrideType === 'cancel_class' || overrideType === 'swap_room') && (
          <div className="space-y-3">
            <div>
              <label className="block text-xs font-semibold mb-1">Select Scheduled Class</label>
              <select
                value={selectedSlotId}
                onChange={(e) => setSelectedSlotId(e.target.value)}
                className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white"
              >
                <option value="">Choose a class...</option>
                {timetable.slice(0, 30).map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.branch} · {s.day} Period {s.periodId}: {s.subject} ({s.roomId})
                  </option>
                ))}
              </select>
            </div>

            {overrideType === 'swap_room' && (
              <div>
                <label className="block text-xs font-semibold mb-1">New Room for Today</label>
                <select
                  value={replacementRoomId}
                  onChange={(e) => setReplacementRoomId(e.target.value)}
                  className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white"
                >
                  <option value="">Choose free room...</option>
                  {rooms.map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.name} ({r.type})
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>
        )}

        <div className="flex justify-end pt-2">
          <button
            type="submit"
            className="px-4 py-2 text-xs font-bold rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white shadow"
          >
            Apply Temporary Override
          </button>
        </div>
      </form>

      {/* Active Overrides List */}
      <div className="space-y-3">
        <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500">
          Active Overrides for Today ({overrides.length})
        </h4>

        {overrides.length === 0 ? (
          <p className="text-xs text-slate-400 italic">No temporary overrides currently active</p>
        ) : (
          <div className="space-y-2">
            {overrides.map((ov) => (
              <div
                key={ov.id}
                className="p-3.5 rounded-xl border border-amber-300/60 dark:border-amber-900/40 bg-amber-50/50 dark:bg-amber-950/20 flex items-center justify-between gap-3 text-xs"
              >
                <div>
                  <span className="font-bold text-amber-800 dark:text-amber-300 uppercase mr-2">
                    {ov.type.replace('_', ' ')}:
                  </span>
                  <span className="text-slate-800 dark:text-slate-200">{ov.note}</span>
                </div>
                <button
                  onClick={() => onDeleteOverride(ov.id)}
                  className="p-1 text-slate-400 hover:text-rose-600"
                  title="Remove override"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
