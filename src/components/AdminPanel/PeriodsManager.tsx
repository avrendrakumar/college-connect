import React, { useState } from 'react';
import { timeStringToMinutes } from '../../utils/timeEngine';
import { Clock, Coffee, Edit, Plus, Trash2, X } from 'lucide-react';
import { Period } from '../../types';

interface PeriodsManagerProps {
  periods: Period[];
  onSavePeriods: (updated: Period[]) => void;
  onShowToast: (msg: string, type: 'success' | 'error' | 'info') => void;
}

export const PeriodsManager: React.FC<PeriodsManagerProps> = ({
  periods,
  onSavePeriods,
  onShowToast
}) => {
  const [showModal, setShowModal] = useState(false);
  const [editingPeriod, setEditingPeriod] = useState<Period | null>(null);

  const [order, setOrder] = useState<number>(1);
  const [start, setStart] = useState('09:00');
  const [end, setEnd] = useState('09:55');
  const [label, setLabel] = useState('Period 1');
  const [isBreak, setIsBreak] = useState(false);

  const openAdd = () => {
    setEditingPeriod(null);
    setOrder(periods.length + 1);
    setStart('09:00');
    setEnd('09:55');
    setLabel(`Period ${periods.length + 1}`);
    setIsBreak(false);
    setShowModal(true);
  };

  const openEdit = (p: Period) => {
    setEditingPeriod(p);
    setOrder(p.order);
    setStart(p.start);
    setEnd(p.end);
    setLabel(p.label);
    setIsBreak(Boolean(p.isBreak || p.is_break));
    setShowModal(true);
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    if (!start || !end || !label.trim()) return;
    const s0 = timeStringToMinutes(start);
    const e0 = timeStringToMinutes(end);
    if (s0 >= e0) {
      onShowToast('End time must be later than the start time', 'error');
      return;
    }
    const overlap = periods.find(
      (p) => p.id !== editingPeriod?.id && s0 < timeStringToMinutes(p.end) && timeStringToMinutes(p.start) < e0
    );
    if (overlap) {
      onShowToast(`Overlaps with "${overlap.label}" (${overlap.start} - ${overlap.end})`, 'error');
      return;
    }

    if (editingPeriod) {
      const updated = periods.map((p) =>
        p.id === editingPeriod.id
          ? {
              ...p,
              order: Number(order),
              start,
              end,
              label: label.trim(),
              isBreak,
              is_break: isBreak
            }
          : p
      );
      onSavePeriods(updated);
      onShowToast(`Updated ${label}`, 'success');
    } else {
      const newPeriod: Period = {
        id: `p_${Date.now()}`,
        order: Number(order),
        start,
        end,
        label: label.trim(),
        isBreak,
        is_break: isBreak
      };
      onSavePeriods([...periods, newPeriod]);
      onShowToast(`Added ${newPeriod.label}`, 'success');
    }

    setShowModal(false);
  };

  const handleDelete = (id: string | number) => {
    if (!window.confirm('Remove this period? Classes scheduled in it will need a new period.')) return;
    onSavePeriods(periods.filter((p) => p.id !== id));
    onShowToast('Period slot removed', 'info');
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <Clock className="w-5 h-5 text-indigo-500" />
            <span>Academic Periods &amp; Break Slots</span>
          </h3>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Define daily lecture timings, tea breaks, lunch breaks, and shift hours
          </p>
        </div>

        <button
          onClick={openAdd}
          className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold bg-indigo-600 hover:bg-indigo-500 text-white shadow transition"
        >
          <Plus className="w-4 h-4" />
          <span>Add Period / Break</span>
        </button>
      </div>

      <div className="overflow-x-auto rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm">
        <table className="w-full text-xs text-left">
          <thead className="bg-slate-50 dark:bg-slate-800/60 border-b border-slate-200 dark:border-slate-800 text-slate-500">
            <tr>
              <th className="py-2.5 px-4 font-bold">Slot #</th>
              <th className="py-2.5 px-4 font-bold">Label</th>
              <th className="py-2.5 px-4 font-bold">Start Time</th>
              <th className="py-2.5 px-4 font-bold">End Time</th>
              <th className="py-2.5 px-4 font-bold">Type</th>
              <th className="py-2.5 px-4 font-bold text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
            {periods.map((p) => {
              const isBrk = Boolean(p.isBreak || p.is_break);
              return (
                <tr key={p.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                  <td className="py-3 px-4 font-mono font-bold text-indigo-600 dark:text-indigo-400">
                    {p.order}
                  </td>
                  <td className="py-3 px-4 font-bold text-slate-900 dark:text-white flex items-center gap-2">
                    {isBrk && <Coffee className="w-3.5 h-3.5 text-amber-500" />}
                    <span>{p.label}</span>
                  </td>
                  <td className="py-3 px-4 font-mono">{p.start}</td>
                  <td className="py-3 px-4 font-mono">{p.end}</td>
                  <td className="py-3 px-4">
                    <span
                      className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                        isBrk
                          ? 'bg-amber-100 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300'
                          : 'bg-indigo-100 text-indigo-700 dark:bg-indigo-950/60 dark:text-indigo-300'
                      }`}
                    >
                      {isBrk ? 'Break Slot' : 'Class Period'}
                    </span>
                  </td>
                  <td className="py-3 px-4 text-right space-x-2">
                    <button
                      onClick={() => openEdit(p)}
                      className="p-1 text-slate-500 hover:text-indigo-600"
                    >
                      <Edit className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => handleDelete(p.id)}
                      className="p-1 text-slate-400 hover:text-rose-600"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm animate-fade-in">
          <div className="w-full max-w-md rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-6 shadow-2xl">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200 dark:border-slate-800">
              <h3 className="text-base font-bold text-slate-900 dark:text-white">
                {editingPeriod ? 'Edit Period Slot' : 'Add Period Slot'}
              </h3>
              <button
                onClick={() => setShowModal(false)}
                aria-label="Close"
                className="p-1 text-slate-400"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSave} className="space-y-3 my-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold mb-1">Slot Order (#)</label>
                  <input
                    type="number"
                    min="1"
                    required
                    value={order}
                    onChange={(e) => setOrder(Number(e.target.value))}
                    className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold mb-1">Is Recess / Break?</label>
                  <select
                    value={isBreak ? 'yes' : 'no'}
                    onChange={(e) => setIsBreak(e.target.value === 'yes')}
                    className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white"
                  >
                    <option value="no">Teaching Period</option>
                    <option value="yes">Break (Tea/Lunch)</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold mb-1">Label *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Period 1 or Lunch Break"
                  value={label}
                  onChange={(e) => setLabel(e.target.value)}
                  className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold mb-1">Start Time (HH:MM)</label>
                  <input
                    type="time"
                    required
                    value={start}
                    onChange={(e) => setStart(e.target.value)}
                    className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white font-mono"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold mb-1">End Time (HH:MM)</label>
                  <input
                    type="time"
                    required
                    value={end}
                    onChange={(e) => setEnd(e.target.value)}
                    className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white font-mono"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-200 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="px-3 py-2 text-xs font-semibold text-slate-500"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 text-xs font-bold rounded-xl bg-indigo-600 text-white"
                >
                  Save Slot
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
