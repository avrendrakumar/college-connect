import React, { useEffect, useState } from 'react';
import {
  AlertCircle,
  Check,
  Copy,
  Edit,
  Plus,
  Trash2,
  X,
  BookOpen,
  MapPin,
  Clock,
  User
} from 'lucide-react';
import {
  Branch,
  BranchId,
  ClassType,
  DayOfWeek,
  Period,
  Room,
  Subject,
  TimetableSlot
} from '../../types';
import { DAYS_OF_WEEK } from '../../utils/timeEngine';

interface TimetableEditorProps {
  branches: Branch[];
  rooms: Room[];
  periods: Period[];
  timetable: TimetableSlot[];
  /** Subjects in the catalog, offered as suggestions (free text is still accepted). */
  subjects?: Subject[];
  onSaveTimetable: (updated: TimetableSlot[]) => void;
  onShowToast: (msg: string, type: 'success' | 'error' | 'info') => void;
}

export const TimetableEditor: React.FC<TimetableEditorProps> = ({
  branches,
  rooms,
  periods,
  timetable,
  subjects = [],
  onSaveTimetable,
  onShowToast
}) => {
  const [selectedBranchId, setSelectedBranchId] = useState<BranchId>(branches[0]?.id ?? '');
  const [selectedDay, setSelectedDay] = useState<DayOfWeek>('Monday');
  const [selectedSemester, setSelectedSemester] = useState<string>('ALL');

  // Modal State for Add / Edit
  const [editingSlot, setEditingSlot] = useState<TimetableSlot | null>(null);
  const [targetPeriod, setTargetPeriod] = useState<Period | null>(null);
  const [modalSubject, setModalSubject] = useState('');
  const [modalTeacher, setModalTeacher] = useState('');
  const [modalRoomId, setModalRoomId] = useState('');
  const [modalSemester, setModalSemester] = useState('SEM1');
  const [modalType, setModalType] = useState<ClassType>('Lecture');
  const [modalIsPublished, setModalIsPublished] = useState(true);
  const [modalNotes, setModalNotes] = useState('');

  // Copy routine modal
  const [showCopyModal, setShowCopyModal] = useState(false);
  const [copyTargetBranch, setCopyTargetBranch] = useState<BranchId>(selectedBranchId);
  const [copyTargetDay, setCopyTargetDay] = useState<DayOfWeek>('Tuesday');

  const selectedBranch = branches.find((b) => b.id === selectedBranchId) || branches[0];

  // Keep the selection valid when branches load or change (e.g. after a database sync)
  useEffect(() => {
    if (branches.length > 0 && !branches.some((b) => b.id === selectedBranchId)) {
      setSelectedBranchId(branches[0].id);
    }
    if (branches.length > 0 && !branches.some((b) => b.id === copyTargetBranch)) {
      setCopyTargetBranch(branches[0].id);
    }
  }, [branches, selectedBranchId, copyTargetBranch]);

  // Slots for active branch, semester, and day
  const currentSlots = timetable.filter((s) => {
    const matchBranch = s.branch === selectedBranchId;
    const matchDay = s.day === selectedDay;
    const matchSem = selectedSemester === 'ALL' || !s.semester || s.semester === selectedSemester;
    return matchBranch && matchDay && matchSem;
  });

  const openSlotEditor = (period: Period, existingSlot?: TimetableSlot) => {
    setTargetPeriod(period);
    if (existingSlot) {
      setEditingSlot(existingSlot);
      setModalSubject(existingSlot.subject);
      setModalTeacher(existingSlot.teacher);
      setModalRoomId(existingSlot.roomId);
      setModalSemester(existingSlot.semester || (selectedSemester === 'ALL' ? 'SEM1' : selectedSemester));
      setModalType(existingSlot.type);
      setModalIsPublished(existingSlot.is_published !== false);
      setModalNotes(existingSlot.notes || '');
    } else {
      setEditingSlot(null);
      setModalSubject('');
      setModalTeacher('');
      setModalRoomId(rooms[0]?.id || '');
      setModalSemester(selectedSemester === 'ALL' ? 'SEM1' : selectedSemester);
      setModalType('Lecture');
      setModalIsPublished(true);
      setModalNotes('');
    }
  };

  const handleSaveSlot = (e: React.FormEvent) => {
    e.preventDefault();
    if (!targetPeriod || !modalSubject.trim() || !modalRoomId) return;

    // 1. Room Clash Check: Is this room occupied by another branch on this day and period?
    const roomClash = timetable.find(
      (s) =>
        s.day === selectedDay &&
        String(s.periodId) === String(targetPeriod.id) &&
        s.roomId.toLowerCase() === modalRoomId.toLowerCase() &&
        s.id !== editingSlot?.id
    );

    if (roomClash) {
      onShowToast(
        `Room Clash! Room ${modalRoomId} is already booked by ${roomClash.branch} (${roomClash.subject})`,
        'error'
      );
      return;
    }

    // 2. Professor Clash Check: Is this professor already taking another class on this day and period?
    const cleanTeacher = modalTeacher.trim();
    if (cleanTeacher && cleanTeacher.toLowerCase() !== 'faculty') {
      const profClash = timetable.find(
        (s) =>
          s.day === selectedDay &&
          String(s.periodId) === String(targetPeriod.id) &&
          s.teacher.trim().toLowerCase() === cleanTeacher.toLowerCase() &&
          s.id !== editingSlot?.id
      );

      if (profClash) {
        onShowToast(
          `Professor Clash! ${cleanTeacher} is already teaching ${profClash.branch} (${profClash.subject}) in room ${profClash.roomId}`,
          'error'
        );
        return;
      }
    }

    if (editingSlot) {
      // Update
      const updated = timetable.map((s) =>
        s.id === editingSlot.id
          ? {
              ...s,
              subject: modalSubject.trim(),
              teacher: modalTeacher.trim() || 'Faculty',
              roomId: modalRoomId,
              semester: modalSemester,
              type: modalType,
              is_published: modalIsPublished,
              notes: modalNotes
            }
          : s
      );
      onSaveTimetable(updated);
      onShowToast('Class updated successfully', 'success');
    } else {
      // Insert
      const newSlot: TimetableSlot = {
        id: `slot-${Date.now()}`,
        branch: selectedBranchId,
        semester: modalSemester,
        day: selectedDay,
        periodId: targetPeriod.id,
        subject: modalSubject.trim(),
        teacher: modalTeacher.trim() || 'Faculty',
        roomId: modalRoomId,
        type: modalType,
        is_published: modalIsPublished,
        notes: modalNotes
      };
      onSaveTimetable([...timetable, newSlot]);
      onShowToast('New class scheduled successfully', 'success');
    }

    setTargetPeriod(null);
  };

  const handlePublishAll = () => {
    const updated = timetable.map((s) => ({ ...s, is_published: true }));
    onSaveTimetable(updated);
    onShowToast('All routine drafts published and live for students', 'success');
  };

  const handleDeleteSlot = (id: string) => {
    onSaveTimetable(timetable.filter((s) => s.id !== id));
    onShowToast('Class removed from schedule', 'info');
    setTargetPeriod(null);
  };

  const handleExecuteCopy = () => {
    // Copy currentSlots to copyTargetBranch and copyTargetDay
    if (currentSlots.length === 0) {
      onShowToast('No classes to copy from this day', 'error');
      return;
    }

    // Filter out target existing slots for that branch & day
    const filtered = timetable.filter(
      (s) => !(s.branch === copyTargetBranch && s.day === copyTargetDay)
    );

    const cloned = currentSlots.map((s, idx) => ({
      ...s,
      id: `slot-copy-${Date.now()}-${idx}`,
      branch: copyTargetBranch,
      day: copyTargetDay
    }));

    onSaveTimetable([...filtered, ...cloned]);
    onShowToast(`Copied routine to ${copyTargetBranch} (${copyTargetDay})!`, 'success');
    setShowCopyModal(false);
  };

  if (branches.length === 0 || periods.length === 0) {
    return (
      <div role="status" className="rounded-2xl border border-dashed border-slate-300 dark:border-slate-700 p-8 text-center text-xs text-slate-500">
        Add at least one branch (Rooms &amp; Master Data) and the daily periods (Periods tab) before building a timetable.
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Top Selector Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm">
        <div className="flex flex-wrap items-center gap-3">
          {/* Branch Picker */}
          <div>
            <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-1">
              Select Branch
            </label>
            <select
              value={selectedBranchId}
              onChange={(e) => setSelectedBranchId(e.target.value as BranchId)}
              className="px-3 py-1.5 text-xs font-bold rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white"
            >
              {branches.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name} ({b.code})
                </option>
              ))}
            </select>
          </div>

          {/* Semester Picker */}
          <div>
            <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-1">
              Semester
            </label>
            <select
              value={selectedSemester}
              onChange={(e) => setSelectedSemester(e.target.value)}
              className="px-3 py-1.5 text-xs font-bold rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white"
            >
              <option value="ALL">All Semesters</option>
              <option value="SEM1">Semester 1 (1st Year)</option>
              <option value="SEM2">Semester 2 (1st Year)</option>
              <option value="SEM3">Semester 3 (2nd Year)</option>
              <option value="SEM4">Semester 4 (2nd Year)</option>
              <option value="SEM5">Semester 5 (3rd Year)</option>
              <option value="SEM6">Semester 6 (3rd Year)</option>
              <option value="SEM7">Semester 7 (4th Year)</option>
              <option value="SEM8">Semester 8 (4th Year)</option>
            </select>
          </div>

          {/* Day Picker */}
          <div>
            <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-1">
              Day of Week
            </label>
            <select
              value={selectedDay}
              onChange={(e) => setSelectedDay(e.target.value as DayOfWeek)}
              className="px-3 py-1.5 text-xs font-bold rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white"
            >
              {DAYS_OF_WEEK.map((d) => (
                <option key={d} value={d}>
                  {d}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Action Buttons: Publish Drafts & Copy Routine */}
        <div className="flex items-center gap-2 self-start sm:self-auto">
          <button
            onClick={handlePublishAll}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold bg-emerald-600 hover:bg-emerald-500 text-white shadow-sm transition"
          >
            <Check className="w-3.5 h-3.5" />
            <span>Publish All Drafts</span>
          </button>

          <button
            onClick={() => setShowCopyModal(true)}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 border border-indigo-200 dark:border-indigo-800 hover:bg-indigo-100 transition"
          >
            <Copy className="w-3.5 h-3.5" />
            <span>Copy Routine</span>
          </button>
        </div>
      </div>

      {/* Editable Periods Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {periods.map((p) => {
          if (p.isBreak) {
            return (
              <div
                key={p.id}
                className="col-span-full py-2.5 px-4 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-700 dark:text-amber-400 flex items-center justify-between text-xs font-bold"
              >
                <span>☕ {p.label}</span>
                <span className="font-mono">{p.start} - {p.end}</span>
              </div>
            );
          }

          const slot = currentSlots.find((s) => String(s.periodId) === String(p.id));

          return (
            <div
              key={p.id}
              className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 shadow-sm hover:border-indigo-400 transition flex flex-col justify-between"
            >
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="font-mono font-bold text-xs text-indigo-600 dark:text-indigo-400">
                    {p.label}
                  </span>
                  <span className="font-mono text-xs text-slate-400">
                    {p.start} - {p.end}
                  </span>
                </div>

                {slot ? (
                  <div className="space-y-1.5 my-2">
                    <div className="text-sm font-bold text-slate-900 dark:text-white">
                      {slot.subject}
                    </div>
                    <div className="text-xs text-slate-500 dark:text-slate-400">
                      Faculty: {slot.teacher}
                    </div>
                    <div className="flex flex-wrap items-center gap-1.5 pt-1">
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-300">
                        {slot.roomId}
                      </span>
                      <span className="text-[10px] font-medium px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400">
                        {slot.type}
                      </span>
                      {slot.semester && (
                        <span className="text-[10px] font-semibold px-2 py-0.5 rounded bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400">
                          {slot.semester}
                        </span>
                      )}
                      {slot.is_published === false ? (
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-amber-500/20 text-amber-700 dark:text-amber-400">
                          Draft
                        </span>
                      ) : (
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-700 dark:text-emerald-400">
                          Live
                        </span>
                      )}
                    </div>
                  </div>
                ) : (
                  <div className="py-6 text-center text-xs text-slate-400 italic">
                    Unassigned slot
                  </div>
                )}
              </div>

              <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex justify-end gap-2">
                {slot && (
                  <button
                    onClick={() => handleDeleteSlot(slot.id)}
                    title="Remove class"
                    className="p-1.5 rounded-lg text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}
                <button
                  onClick={() => openSlotEditor(p, slot)}
                  className="px-3 py-1.5 text-xs font-bold rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white flex items-center gap-1 transition"
                >
                  {slot ? <Edit className="w-3.5 h-3.5" /> : <Plus className="w-3.5 h-3.5" />}
                  <span>{slot ? 'Edit' : 'Schedule'}</span>
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {/* Add / Edit Class Modal */}
      {targetPeriod && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm animate-fade-in">
          <div className="w-full max-w-md rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-6 shadow-2xl">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200 dark:border-slate-800">
              <h3 className="text-base font-bold text-slate-900 dark:text-white">
                {editingSlot ? 'Edit Class' : 'Schedule New Class'} – {targetPeriod.label}
              </h3>
              <button
                onClick={() => setTargetPeriod(null)}
                aria-label="Close"
                className="p-1 rounded text-slate-400 hover:text-slate-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveSlot} className="space-y-4 my-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Subject / Course Name *
                </label>
                <input
                  type="text"
                  required
                  placeholder="Subject name"
                  list="subject-suggestions"
                  value={modalSubject}
                  onChange={(e) => setModalSubject(e.target.value)}
                  className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-indigo-500"
                />
                <datalist id="subject-suggestions">
                  {subjects
                    .filter((x) => !x.branch_id || x.branch_id === selectedBranchId)
                    .map((x) => <option key={x.id} value={x.name} />)}
                </datalist>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Teacher / Professor
                </label>
                <input
                  type="text"
                  placeholder="Teacher name"
                  value={modalTeacher}
                  onChange={(e) => setModalTeacher(e.target.value)}
                  className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Room *
                  </label>
                  <select
                    value={modalRoomId}
                    onChange={(e) => setModalRoomId(e.target.value)}
                    className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-indigo-500"
                  >
                    {rooms.map((r) => {
                      // Check if room has clash in this slot
                      const isBooked = timetable.some(
                        (s) =>
                          s.day === selectedDay &&
                          String(s.periodId) === String(targetPeriod.id) &&
                          s.roomId === r.id &&
                          s.id !== editingSlot?.id
                      );

                      return (
                        <option
                          key={r.id}
                          value={r.id}
                          disabled={r.isMaintenance || isBooked}
                        >
                          {r.name} {isBooked ? '(Occupied)' : r.isMaintenance ? '(Maint)' : '(Free)'}
                        </option>
                      );
                    })}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Class Type
                  </label>
                  <select
                    value={modalType}
                    onChange={(e) => setModalType(e.target.value as ClassType)}
                    className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-indigo-500"
                  >
                    <option value="Lecture">Lecture</option>
                    <option value="Lab">Lab Experiment</option>
                    <option value="Tutorial">Tutorial / Seminar</option>
                  </select>
                </div>
              </div>

              {/* Semester & Publish Status */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Semester
                  </label>
                  <select
                    value={modalSemester}
                    onChange={(e) => setModalSemester(e.target.value)}
                    className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-indigo-500"
                  >
                    <option value="SEM1">Semester 1</option>
                    <option value="SEM2">Semester 2</option>
                    <option value="SEM3">Semester 3</option>
                    <option value="SEM4">Semester 4</option>
                    <option value="SEM5">Semester 5</option>
                    <option value="SEM6">Semester 6</option>
                    <option value="SEM7">Semester 7</option>
                    <option value="SEM8">Semester 8</option>
                  </select>
                </div>

                <div className="flex items-center pt-5">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={modalIsPublished}
                      onChange={(e) => setModalIsPublished(e.target.checked)}
                      className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                    />
                    <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                      Publish immediately
                    </span>
                  </label>
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-200 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setTargetPeriod(null)}
                  className="px-3 py-2 text-xs font-semibold rounded-xl text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 text-xs font-bold rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white shadow"
                >
                  Save Class
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Copy Routine Modal */}
      {showCopyModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm animate-fade-in">
          <div className="w-full max-w-md rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-6 shadow-2xl space-y-4">
            <h3 className="text-base font-bold text-slate-900 dark:text-white">
              Copy Routine from {selectedBranch.name} ({selectedDay})
            </h3>
            <p className="text-xs text-slate-500">
              Duplicate all {currentSlots.length} classes to another target branch and day:
            </p>

            <div className="space-y-3">
              <div>
                <label className="block text-xs font-semibold mb-1">Destination Branch</label>
                <select
                  value={copyTargetBranch}
                  onChange={(e) => setCopyTargetBranch(e.target.value as BranchId)}
                  className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800"
                >
                  {branches.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold mb-1">Destination Day</label>
                <select
                  value={copyTargetDay}
                  onChange={(e) => setCopyTargetDay(e.target.value as DayOfWeek)}
                  className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800"
                >
                  {DAYS_OF_WEEK.map((d) => (
                    <option key={d} value={d}>
                      {d}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-200 dark:border-slate-800">
              <button
                onClick={() => setShowCopyModal(false)}
                className="px-3 py-2 text-xs font-semibold rounded-xl text-slate-600 hover:bg-slate-100"
              >
                Cancel
              </button>
              <button
                onClick={handleExecuteCopy}
                className="px-4 py-2 text-xs font-bold rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white shadow"
              >
                Execute Copy
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
