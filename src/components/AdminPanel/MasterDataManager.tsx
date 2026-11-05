import React, { useState } from 'react';
import { BookOpen, Building, DoorOpen, Plus, Trash2, Users } from 'lucide-react';
import { Branch, Room, Professor, Subject, TimetableSlot } from '../../types';
import { RoomManager } from './RoomManager';
import { branchStyleAt } from '../../utils/branchStyles';
import { deriveSubjectId } from '../../utils/dbMapping';

const slug = (v: string) => v.trim().toUpperCase().replace(/[^A-Z0-9]+/g, '-').replace(/^-+|-+$/g, '');

interface MasterDataManagerProps {
  rooms: Room[];
  branches: Branch[];
  timetable?: TimetableSlot[];
  onSaveRooms: (rooms: Room[]) => void;
  /** Saves the full branch list. `removedId` is set when a branch was deleted (its classes go with it). */
  onSaveBranches: (branches: Branch[], removedId?: string) => void;
  /** Subjects the admin added to the catalog. */
  subjects?: Subject[];
  onAddSubject: (subject: Subject) => void;
  onDeleteSubject: (id: string) => void;
  onShowToast: (msg: string, type: 'success' | 'error' | 'info') => void;
}

export const MasterDataManager: React.FC<MasterDataManagerProps> = ({
  rooms,
  branches,
  timetable = [],
  subjects: catalogSubjects = [],
  onSaveRooms,
  onSaveBranches,
  onAddSubject,
  onDeleteSubject,
  onShowToast
}) => {
  const [newBranchName, setNewBranchName] = useState('');
  const [newBranchCode, setNewBranchCode] = useState('');
  const [newSubName, setNewSubName] = useState('');
  const [newSubCode, setNewSubCode] = useState('');
  const [newSubBranch, setNewSubBranch] = useState('');
  const [newSubSemester, setNewSubSemester] = useState('SEM1');

  const addBranch = (e: React.FormEvent) => {
    e.preventDefault();
    const name = newBranchName.trim();
    const code = slug(newBranchCode || name);
    if (!name || !code) {
      onShowToast('Enter a branch name and a short code.', 'error');
      return;
    }
    if (branches.some((b) => b.id === code || b.name.toLowerCase() === name.toLowerCase())) {
      onShowToast(`A branch named "${name}" or with code ${code} already exists.`, 'error');
      return;
    }
    const style = branchStyleAt(branches.length);
    onSaveBranches([
      ...branches,
      { id: code, name, shortName: code, short_name: code, code, color: style.color, ...style.classes }
    ]);
    setNewBranchName('');
    setNewBranchCode('');
  };

  const removeBranch = (b: Branch) => {
    const classes = timetable.filter((t) => t.branch === b.id).length;
    const ok = window.confirm(
      `Delete branch "${b.name}"?\n\nThis also permanently deletes ${classes} scheduled class(es) of this branch. This cannot be undone.`
    );
    if (!ok) return;
    onSaveBranches(branches.filter((x) => x.id !== b.id), b.id);
  };

  const addSubject = (e: React.FormEvent) => {
    e.preventDefault();
    const name = newSubName.trim();
    const code = newSubCode.trim().toUpperCase();
    if (!name) {
      onShowToast('Enter a subject name.', 'error');
      return;
    }
    const id = code ? `SUB-${slug(code)}` : deriveSubjectId(name);
    if (allSubjects.some((x) => x.id === id)) {
      onShowToast(`Subject ${code || name} already exists.`, 'error');
      return;
    }
    onAddSubject({ id, name, code: code || id, branch_id: newSubBranch || undefined, semester_id: newSubSemester || undefined });
    setNewSubName('');
    setNewSubCode('');
  };

  const removeSubject = (sub: Subject) => {
    const classes = timetable.filter((t) => (t.subject_id || deriveSubjectId(t.subject)) === sub.id || t.subject.trim().toLowerCase() === sub.name.trim().toLowerCase()).length;
    const ok = window.confirm(
      `Delete subject "${sub.name}"?\n\nThis also permanently deletes ${classes} scheduled class(es) that use it. This cannot be undone.`
    );
    if (ok) onDeleteSubject(sub.id);
  };
  const [activeSubTab, setActiveSubTab] = useState<'rooms' | 'branches' | 'professors' | 'subjects'>('rooms');

  // Faculty and subjects are derived from the real timetable (they are created automatically when a
  // class is scheduled), so these lists always reflect saved data rather than placeholder names.
  const professors: Professor[] = Array.from(
    new Map(
      timetable
        .filter((t) => t.teacher)
        .map((t) => [t.professor_id || t.teacher, { id: t.professor_id || t.teacher, name: t.teacher, department: t.branch } as Professor])
    ).values()
  ).sort((x, y) => x.name.localeCompare(y.name));

  const subjects: Subject[] = Array.from(
    new Map<string, Subject>([
      ...timetable
        .filter((t) => t.subject)
        .map((t): [string, Subject] => [
          t.subject_id || deriveSubjectId(t.subject),
          { id: t.subject_id || deriveSubjectId(t.subject), code: t.subject_id || '', name: t.subject, branch_id: t.branch, semester_id: t.semester }
        ]),
      ...catalogSubjects.map((x): [string, Subject] => [x.id, x])
    ]).values()
  ).sort((x, y) => x.name.localeCompare(y.name));
  const allSubjects = subjects;

  return (
    <div className="space-y-6">
      {/* Sub-Tabs Selector */}
      <div className="flex items-center gap-2 p-1 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm overflow-x-auto">
        <button
          onClick={() => setActiveSubTab('rooms')}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition ${
            activeSubTab === 'rooms'
              ? 'bg-indigo-600 text-white shadow-sm'
              : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
          }`}
        >
          <DoorOpen className="w-3.5 h-3.5" />
          <span>Classrooms &amp; Facilities ({rooms.length})</span>
        </button>

        <button
          onClick={() => setActiveSubTab('branches')}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition ${
            activeSubTab === 'branches'
              ? 'bg-indigo-600 text-white shadow-sm'
              : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
          }`}
        >
          <Building className="w-3.5 h-3.5" />
          <span>Branches ({branches.length})</span>
        </button>

        <button
          onClick={() => setActiveSubTab('professors')}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition ${
            activeSubTab === 'professors'
              ? 'bg-indigo-600 text-white shadow-sm'
              : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
          }`}
        >
          <Users className="w-3.5 h-3.5" />
          <span>Faculty &amp; Professors ({professors.length})</span>
        </button>

        <button
          onClick={() => setActiveSubTab('subjects')}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition ${
            activeSubTab === 'subjects'
              ? 'bg-indigo-600 text-white shadow-sm'
              : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
          }`}
        >
          <BookOpen className="w-3.5 h-3.5" />
          <span>Courses &amp; Subjects ({subjects.length})</span>
        </button>
      </div>

      {/* Sub-tab Views */}
      {activeSubTab === 'rooms' && (
        <RoomManager
          rooms={rooms}
          onSaveRooms={onSaveRooms}
          onShowToast={onShowToast}
        />
      )}

      {activeSubTab === 'branches' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h4 className="text-sm font-bold text-slate-900 dark:text-white">
              Branches &amp; Departments
            </h4>
          </div>
          <form onSubmit={addBranch} className="flex flex-col sm:flex-row gap-2 p-3 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900">
            <input aria-label="Branch name" value={newBranchName} onChange={(e) => setNewBranchName(e.target.value)} placeholder="Branch name" className="flex-1 px-3 py-2 text-xs rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-indigo-500" />
            <input aria-label="Branch short code" value={newBranchCode} onChange={(e) => setNewBranchCode(e.target.value)} placeholder="Short code" maxLength={16} className="sm:w-36 px-3 py-2 text-xs font-mono rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-indigo-500" />
            <button type="submit" className="flex items-center justify-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold bg-indigo-600 hover:bg-indigo-500 text-white"><Plus className="w-3.5 h-3.5" />Add branch</button>
          </form>
          {branches.length === 0 && <p className="text-xs text-slate-500">No branches yet. Add your first branch above.</p>}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {branches.map((b) => (
              <div
                key={b.id}
                className="p-4 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 space-y-2 shadow-sm"
              >
                <div className="flex items-center justify-between">
                  <span className="font-bold text-sm text-slate-900 dark:text-white">{b.name}</span>
                  <span className="flex items-center gap-2">
                    <span className="w-3 h-3 rounded-full" style={{ backgroundColor: b.color || '#4F46E5' }} />
                    <button type="button" onClick={() => removeBranch(b)} aria-label={`Delete branch ${b.name}`} title="Delete branch" className="p-1 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40">
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </span>
                </div>
                <div className="text-xs text-slate-500 font-mono">
                  Code: {b.code} · ID: {b.id}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {activeSubTab === 'professors' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h4 className="text-sm font-bold text-slate-900 dark:text-white">
              Faculty Directory
            </h4>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {professors.length === 0 && (
              <p className="text-xs text-slate-500 col-span-full">No faculty yet. They appear here once classes are scheduled.</p>
            )}
            {professors.map((p) => (
              <div
                key={p.id}
                className="p-4 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 space-y-1 shadow-sm"
              >
                <div className="font-bold text-sm text-slate-900 dark:text-white">{p.name}</div>
                <div className="text-xs text-slate-500">{p.email || 'Created from the timetable'}</div>
                <div className="text-[11px] font-semibold text-indigo-500 pt-1">
                  Branch: {p.department}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {activeSubTab === 'subjects' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h4 className="text-sm font-bold text-slate-900 dark:text-white">
              Courses &amp; Subjects
            </h4>
          </div>
          <form onSubmit={addSubject} className="grid grid-cols-1 sm:grid-cols-12 gap-2 p-3 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900">
            <input aria-label="Subject name" value={newSubName} onChange={(e) => setNewSubName(e.target.value)} placeholder="Subject name" className="sm:col-span-4 px-3 py-2 text-xs rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-indigo-500" />
            <input aria-label="Subject code" value={newSubCode} onChange={(e) => setNewSubCode(e.target.value)} placeholder="Code (optional)" className="sm:col-span-2 px-3 py-2 text-xs font-mono rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-indigo-500" />
            <select aria-label="Branch" value={newSubBranch} onChange={(e) => setNewSubBranch(e.target.value)} className="sm:col-span-2 px-2 py-2 text-xs rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white outline-none">
              <option value="">All branches</option>
              {branches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
            </select>
            <select aria-label="Semester" value={newSubSemester} onChange={(e) => setNewSubSemester(e.target.value)} className="sm:col-span-2 px-2 py-2 text-xs rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white outline-none">
              {[1, 2, 3, 4, 5, 6, 7, 8].map((n) => <option key={n} value={`SEM${n}`}>Semester {n}</option>)}
            </select>
            <button type="submit" className="sm:col-span-2 flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold bg-indigo-600 hover:bg-indigo-500 text-white"><Plus className="w-3.5 h-3.5" />Add subject</button>
          </form>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {subjects.length === 0 && (
              <p className="text-xs text-slate-500 col-span-full">No subjects yet. Add one above, or they appear once classes are scheduled.</p>
            )}
            {subjects.map((s) => (
              <div
                key={s.id}
                className="p-4 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 space-y-1 shadow-sm"
              >
                <div className="flex items-center justify-between">
                  <span className="font-bold text-xs font-mono text-indigo-500">{s.code}</span>
                  <span className="flex items-center gap-2">
                    <span className="text-[10px] uppercase font-bold text-slate-400">{s.branch_id || 'All'}</span>
                    <button type="button" onClick={() => removeSubject(s)} aria-label={`Delete subject ${s.name}`} title="Delete subject" className="p-1 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40">
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </span>
                </div>
                <div className="font-bold text-sm text-slate-900 dark:text-white">{s.name}</div>
                <div className="text-[11px] text-slate-500">{s.semester_id}</div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
