import React, { useState } from 'react';
import { Calendar, Edit, Palmtree, Plus, Trash2, X } from 'lucide-react';
import { Branch, Holiday, HolidayType } from '../../types';
import { storageService, isoToZonedDate } from '../../services/storageService';

/** Today's date (YYYY-MM-DD) in the college timezone, not UTC. */
const collegeToday = () => isoToZonedDate(new Date().toISOString(), storageService.getSettings().timezone || 'Asia/Kolkata');

interface HolidayManagerProps {
  holidays: Holiday[];
  branches?: Branch[];
  onSaveHolidays: (updated: Holiday[]) => void;
  onShowToast: (msg: string, type: 'success' | 'error' | 'info') => void;
}

export const HolidayManager: React.FC<HolidayManagerProps> = ({
  holidays,
  branches = [],
  onSaveHolidays,
  onShowToast
}) => {
  const [showModal, setShowModal] = useState(false);
  const [editingHoliday, setEditingHoliday] = useState<Holiday | null>(null);

  const [title, setTitle] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [type, setType] = useState<HolidayType>('holiday');
  const [description, setDescription] = useState('');
  const [isWholeCollege, setIsWholeCollege] = useState(true);
  // Branch ids come from the real branch list (never a hardcoded set)
  const allBranches = branches.map((b) => b.id);
  const [selectedBranches, setSelectedBranches] = useState<string[]>([]);

  const toggleBranch = (b: string) => {
    if (selectedBranches.includes(b)) {
      setSelectedBranches(selectedBranches.filter((x) => x !== b));
    } else {
      setSelectedBranches([...selectedBranches, b]);
    }
  };

  const openAdd = () => {
    setEditingHoliday(null);
    setTitle('');
    const todayStr = collegeToday();
    setStartDate(todayStr);
    setEndDate(todayStr);
    setType('holiday');
    setDescription('');
    setIsWholeCollege(true);
    setSelectedBranches(allBranches);
    setShowModal(true);
  };

  const openEdit = (h: Holiday) => {
    setEditingHoliday(h);
    setTitle(h.title);
    setStartDate(h.startDate);
    setEndDate(h.endDate);
    setType(h.type);
    setDescription(h.description || '');
    setIsWholeCollege(h.is_whole_college !== false);
    setSelectedBranches(h.branches && h.branches.length > 0 ? h.branches : allBranches);
    setShowModal(true);
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !startDate) return;
    if (endDate && endDate < startDate) {
      onShowToast('End date cannot be before the start date', 'error');
      return;
    }
    if (!isWholeCollege && selectedBranches.length === 0) {
      onShowToast('Select at least one branch, or mark the holiday as whole-college', 'error');
      return;
    }

    const actualEnd = endDate && endDate >= startDate ? endDate : startDate;

    if (editingHoliday) {
      const updated = holidays.map((h) =>
        h.id === editingHoliday.id
          ? {
              ...h,
              title: title.trim(),
              startDate,
              endDate: actualEnd,
              type,
              description: description.trim(),
              is_whole_college: isWholeCollege,
              branches: isWholeCollege ? [] : selectedBranches
            }
          : h
      );
      onSaveHolidays(updated);
      onShowToast(`Updated ${title}`, 'success');
    } else {
      const newHoliday: Holiday = {
        id: `h-${Date.now()}`,
        title: title.trim(),
        startDate,
        endDate: actualEnd,
        type,
        description: description.trim(),
        is_whole_college: isWholeCollege,
        branches: isWholeCollege ? [] : selectedBranches
      };
      onSaveHolidays([...holidays, newHoliday]);
      onShowToast(`Added ${newHoliday.title}`, 'success');
    }

    setShowModal(false);
  };

  const handleDelete = (id: string) => {
    onSaveHolidays(holidays.filter((h) => h.id !== id));
    onShowToast('Removed from holiday schedule', 'info');
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <Palmtree className="w-5 h-5 text-amber-500" />
            <span>Vacation &amp; Holiday Calendar Manager</span>
          </h3>
          <p className="text-xs text-slate-500">
            Define festival holidays, multi-day vacation ranges, and semester exam periods
          </p>
        </div>

        <button
          onClick={openAdd}
          className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold bg-indigo-600 hover:bg-indigo-500 text-white shadow transition"
        >
          <Plus className="w-4 h-4" />
          <span>Add Holiday / Vacation</span>
        </button>
      </div>

      <div className="overflow-x-auto rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm">
        <table className="w-full text-xs text-left">
          <thead className="bg-slate-50 dark:bg-slate-800/60 border-b border-slate-200 dark:border-slate-800 text-slate-500">
            <tr>
              <th className="py-2.5 px-4 font-bold">Event Title</th>
              <th className="py-2.5 px-4 font-bold">Type</th>
              <th className="py-2.5 px-4 font-bold">Start Date</th>
              <th className="py-2.5 px-4 font-bold">End Date</th>
              <th className="py-2.5 px-4 font-bold">Description</th>
              <th className="py-2.5 px-4 font-bold text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
            {holidays.map((h) => (
              <tr key={h.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                <td className="py-3 px-4 font-bold text-slate-900 dark:text-white">
                  {h.title}
                </td>
                <td className="py-3 px-4">
                  <span
                    className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${
                      h.type === 'holiday'
                        ? 'bg-rose-100 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300'
                        : h.type === 'vacation'
                        ? 'bg-amber-100 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300'
                        : 'bg-purple-100 dark:bg-purple-950/60 text-purple-700 dark:text-purple-300'
                    }`}
                  >
                    {h.type}
                  </span>
                </td>
                <td className="py-3 px-4 font-mono">{h.startDate}</td>
                <td className="py-3 px-4 font-mono">{h.endDate}</td>
                <td className="py-3 px-4 text-slate-500">{h.description || '—'}</td>
                <td className="py-3 px-4 text-right space-x-2">
                  <button
                    onClick={() => openEdit(h)}
                    className="p-1 text-slate-500 hover:text-indigo-600"
                  >
                    <Edit className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => handleDelete(h.id)}
                    className="p-1 text-slate-400 hover:text-rose-600"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm animate-fade-in">
          <div className="w-full max-w-md rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-6 shadow-2xl">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200 dark:border-slate-800">
              <h3 className="text-base font-bold text-slate-900 dark:text-white">
                {editingHoliday ? 'Edit Break' : 'Add New Break / Exam'}
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
              <div>
                <label className="block text-xs font-semibold mb-1">Title *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Diwali Vacation"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold mb-1">Type</label>
                <select
                  value={type}
                  onChange={(e) => setType(e.target.value as HolidayType)}
                  className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white"
                >
                  <option value="holiday">Gazetted Holiday (Single/Festival)</option>
                  <option value="vacation">Vacation Range (Diwali/Winter/Summer)</option>
                  <option value="exam">Semester Examination Week</option>
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold mb-1">Start Date *</label>
                  <input
                    type="date"
                    required
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold mb-1">End Date</label>
                  <input
                    type="date"
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                    className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold mb-1">Description</label>
                <input
                  type="text"
                  placeholder="Optional notes or circular reference"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white"
                />
              </div>

              {/* Scope: Whole College vs Specific Branches */}
              <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 space-y-2">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={isWholeCollege}
                    onChange={(e) => setIsWholeCollege(e.target.checked)}
                    className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                  />
                  <span className="text-xs font-bold text-slate-900 dark:text-white">
                    Applies to Whole College (All Branches)
                  </span>
                </label>

                {!isWholeCollege && (
                  <div className="pt-2 border-t border-slate-200 dark:border-slate-700 space-y-1">
                    <span className="text-[11px] font-semibold text-slate-500">
                      Select Affected Branches:
                    </span>
                    <div className="flex flex-wrap gap-1.5 pt-1">
                      {allBranches.map((b) => {
                        const active = selectedBranches.includes(b);
                        return (
                          <button
                            type="button"
                            key={b}
                            onClick={() => toggleBranch(b)}
                            className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition ${
                              active
                                ? 'bg-indigo-600 text-white shadow-sm'
                                : 'bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300'
                            }`}
                          >
                            {b}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}
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
                  Save Entry
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
