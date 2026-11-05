import React, { useState } from 'react';
import { Bell, Edit, Plus, Trash2, X, CheckCircle, AlertTriangle } from 'lucide-react';
import { Notice } from '../../types';
import { storageService, isoToZonedDate } from '../../services/storageService';

/** Today's date (YYYY-MM-DD) in the college timezone, not UTC. */
const collegeToday = () => isoToZonedDate(new Date().toISOString(), storageService.getSettings().timezone || 'Asia/Kolkata');

interface NoticeManagerProps {
  notices: Notice[];
  onSaveNotices: (updated: Notice[]) => void;
  onShowToast: (msg: string, type: 'success' | 'error' | 'info') => void;
}

export const NoticeManager: React.FC<NoticeManagerProps> = ({
  notices,
  onSaveNotices,
  onShowToast
}) => {
  const [showModal, setShowModal] = useState(false);
  const [editingNotice, setEditingNotice] = useState<Notice | null>(null);

  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [priority, setPriority] = useState<'normal' | 'urgent' | 'info'>('urgent');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [closesCollege, setClosesCollege] = useState(false);

  const openAdd = () => {
    setEditingNotice(null);
    setTitle('');
    setContent('');
    setPriority('urgent');
    setClosesCollege(false);
    const todayStr = collegeToday();
    setStartDate(todayStr);
    setEndDate(todayStr);
    setShowModal(true);
  };

  const openEdit = (n: Notice) => {
    setEditingNotice(n);
    setTitle(n.title);
    setContent(n.content);
    setPriority(n.priority);
    setStartDate(n.startDate);
    setEndDate(n.endDate);
    setClosesCollege(Boolean(n.closes_college));
    setShowModal(true);
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !content.trim()) return;
    if (!startDate || !endDate || endDate < startDate) {
      onShowToast('Choose a start date and an end date on or after it', 'error');
      return;
    }

    if (editingNotice) {
      const updated = notices.map((n) =>
        n.id === editingNotice.id
          ? {
              ...n,
              title: title.trim(),
              content: content.trim(),
              priority,
              startDate,
              endDate,
              is_emergency: closesCollege || priority === 'urgent',
              closes_college: closesCollege
            }
          : n
      );
      onSaveNotices(updated);
      onShowToast(`Updated notice "${title}"`, 'success');
    } else {
      const newNotice: Notice = {
        id: `notice-${Date.now()}`,
        title: title.trim(),
        content: content.trim(),
        priority,
        startDate,
        endDate,
        active: true,
        is_emergency: closesCollege || priority === 'urgent',
        closes_college: closesCollege
      };
      onSaveNotices([newNotice, ...notices]);
      onShowToast(`Posted new announcement!`, 'success');
    }

    setShowModal(false);
  };

  const toggleActive = (id: string) => {
    const today = collegeToday();
    const updated = notices.map((n) =>
      n.id === id
        ? {
            ...n,
            active: !n.active,
            // re-activating an already-expired notice must also extend it, or it expires again at once
            ...(!n.active && n.endDate < today ? { endDate: today } : {})
          }
        : n
    );
    onSaveNotices(updated);
  };

  const handleDelete = (id: string) => {
    onSaveNotices(notices.filter((n) => n.id !== id));
    onShowToast('Notice deleted', 'info');
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <Bell className="w-5 h-5 text-indigo-500" />
            <span>Campus Notice &amp; Announcement Broadcasts</span>
          </h3>
          <p className="text-xs text-slate-500">
            Posts flash alerts and announcements to the public top banner ticker
          </p>
        </div>

        <button
          onClick={openAdd}
          className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold bg-indigo-600 hover:bg-indigo-500 text-white shadow transition"
        >
          <Plus className="w-4 h-4" />
          <span>Broadcast Notice</span>
        </button>
      </div>

      <div className="space-y-3">
        {notices.map((n) => (
          <div
            key={n.id}
            className={`p-4 rounded-2xl border transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
              n.active
                ? 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 shadow-sm'
                : 'bg-slate-50/60 dark:bg-slate-900/30 border-slate-200/50 dark:border-slate-800/50 opacity-60'
            }`}
          >
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <span
                  className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded ${
                    n.priority === 'urgent'
                      ? 'bg-rose-100 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300'
                      : 'bg-indigo-100 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300'
                  }`}
                >
                  {n.priority}
                </span>
                <h4 className="text-sm font-bold text-slate-900 dark:text-white">{n.title}</h4>
              </div>
              <p className="text-xs text-slate-600 dark:text-slate-400">{n.content}</p>
              <div className="text-[11px] text-slate-400 font-mono">
                Active: {n.startDate} to {n.endDate}
              </div>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <button
                onClick={() => toggleActive(n.id)}
                className={`px-3 py-1.5 rounded-xl text-xs font-semibold border transition ${
                  n.active
                    ? 'bg-emerald-50 text-emerald-700 border-emerald-300 dark:bg-emerald-950/40 dark:text-emerald-300'
                    : 'bg-slate-100 text-slate-500 border-slate-300 dark:bg-slate-800'
                }`}
              >
                {n.active ? 'Broadcasting (Live)' : 'Paused'}
              </button>
              <button
                onClick={() => openEdit(n)}
                className="p-1.5 text-slate-500 hover:text-indigo-600"
              >
                <Edit className="w-4 h-4" />
              </button>
              <button
                onClick={() => handleDelete(n.id)}
                className="p-1.5 text-slate-400 hover:text-rose-600"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          </div>
        ))}
      </div>

      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm animate-fade-in">
          <div className="w-full max-w-md rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-6 shadow-2xl">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200 dark:border-slate-800">
              <h3 className="text-base font-bold text-slate-900 dark:text-white">
                {editingNotice ? 'Edit Notice' : 'Broadcast Announcement'}
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
                <label className="block text-xs font-semibold mb-1">Notice Headline *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Schedule Shift: Morning labs start at 10 AM"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold mb-1">Full Announcement *</label>
                <textarea
                  required
                  rows={3}
                  placeholder="Details for students and professors..."
                  value={content}
                  onChange={(e) => setContent(e.target.value)}
                  className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold mb-1">Priority</label>
                  <select
                    value={priority}
                    onChange={(e) => setPriority(e.target.value as any)}
                    className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white"
                  >
                    <option value="urgent">Urgent (Flashing Red)</option>
                    <option value="info">General Info</option>
                    <option value="normal">Standard</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold mb-1">Display Until</label>
                  <input
                    type="date"
                    required
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                    className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white"
                  />
                </div>
              </div>

              {/* Emergency Closure Option */}
              <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-900/50">
                <label className="flex items-start gap-2.5 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={closesCollege}
                    onChange={(e) => setClosesCollege(e.target.checked)}
                    className="mt-0.5 rounded border-rose-300 text-rose-600 focus:ring-rose-500"
                  />
                  <div>
                    <div className="text-xs font-bold text-rose-800 dark:text-rose-300 flex items-center gap-1.5">
                      <AlertTriangle className="w-3.5 h-3.5" />
                      <span>Emergency Closure: Closes College Immediately</span>
                    </div>
                    <div className="text-[11px] text-rose-600 dark:text-rose-400 mt-0.5">
                      Overrides the timetable and marks the college as CLOSED campus-wide with an emergency banner until resolved.
                    </div>
                  </div>
                </label>
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
                  Publish Notice
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
