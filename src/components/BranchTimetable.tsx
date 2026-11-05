import React, { useState } from 'react';
import { motion, useReducedMotion } from 'motion/react';
import {
  Clock,
  Coffee,
  Download,
  LayoutGrid,
  List,
  MapPin,
  Printer,
  User
} from 'lucide-react';
import { Branch, BranchId, DayOfWeek, Period, TimetableSlot } from '../types';
import { DAYS_OF_WEEK, timeStringToMinutes } from '../utils/timeEngine';

interface BranchTimetableProps {
  branches: Branch[];
  periods: Period[];
  timetable: TimetableSlot[];
  activeDay: DayOfWeek;
  setActiveDay: (day: DayOfWeek) => void;
  activePeriod?: Period;
  currentMinutes: number;
  isOpen: boolean;
}

export const BranchTimetable: React.FC<BranchTimetableProps> = ({
  branches,
  periods,
  timetable,
  activeDay,
  setActiveDay,
  activePeriod,
  currentMinutes,
  isOpen
}) => {
  const [pickedBranchId, setSelectedBranchId] = useState<BranchId>('');
  const [semesterFilter, setSemesterFilter] = useState<string>('ALL');
  // Fall back to the first real branch when nothing (or a removed branch) is selected
  const selectedBranchId: BranchId = branches.some((b) => b.id === pickedBranchId) ? pickedBranchId : branches[0]?.id ?? '';
  const [viewMode, setViewMode] = useState<'grid' | 'timeline'>('grid');
  const reduceMotion = useReducedMotion();

  const selectedBranch = branches.find((b) => b.id === selectedBranchId) || branches[0];

  // Filter slots for active branch and day
  // Students only see published classes
  const publishedForBranch = timetable.filter(
    (slot) => slot.branch === selectedBranchId && slot.is_published !== false
  );
  const semesterOptions = Array.from(new Set(publishedForBranch.map((s) => s.semester).filter(Boolean) as string[])).sort();
  const activeSemester = semesterOptions.includes(semesterFilter) ? semesterFilter : 'ALL';
  const branchSlots = publishedForBranch.filter(
    (slot) => slot.day === activeDay && (activeSemester === 'ALL' || !slot.semester || slot.semester === activeSemester)
  );

  const sortedPeriods = [...periods].sort(
    (a, b) => timeStringToMinutes(a.start) - timeStringToMinutes(b.start)
  );

  // Print timetable handler
  const handlePrint = () => {
    window.print();
  };

  // Export CSV
  const handleDownloadCSV = () => {
    const headers = ['Branch', 'Day', 'Period', 'Time', 'Subject', 'Teacher', 'Room', 'Type'];
    const rows = sortedPeriods.map((p) => {
      if (p.isBreak) {
        return [selectedBranch.name, activeDay, p.label, `${p.start} - ${p.end}`, 'BREAK', '-', '-', '-'];
      }
      const slot = branchSlots.find((s) => String(s.periodId) === String(p.id));
      return [
        selectedBranch.name,
        activeDay,
        p.label,
        `${p.start} - ${p.end}`,
        slot ? slot.subject : 'Free / Self Study',
        slot ? slot.teacher : '-',
        slot ? slot.roomId : '-',
        slot ? slot.type : '-'
      ];
    });

    // Quote every cell, double embedded quotes, and neutralise spreadsheet formulas (=, +, -, @)
    const cell = (val: unknown) => {
      let t = String(val ?? '');
      if (/^[=+\-@\t\r]/.test(t)) t = "'" + t;
      return `"${t.replace(/"/g, '""')}"`;
    };
    const csvContent = [headers.join(','), ...rows.map((e) => e.map(cell).join(','))].join('\n');
    const blobUrl = URL.createObjectURL(new Blob(['﻿' + csvContent], { type: 'text/csv;charset=utf-8' }));
    const link = document.createElement('a');
    link.setAttribute('href', blobUrl);
    link.setAttribute('download', `${selectedBranch.id}_Timetable_${activeDay}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(blobUrl);
  };

  if (branches.length === 0) {
    return (
      <div
        role="status"
        className="halftone rounded-2xl border-2 border-dashed border-[var(--ink)] bg-[var(--paper-2)] p-8 text-center"
      >
        <p className="font-bold text-base text-[var(--ink)]">No branches yet.</p>
        <p className="mt-1 text-sm text-[var(--ink)]/75">
          Add branches and periods in the Admin Portal, then publish a timetable and it will show up here.
        </p>
      </div>
    );
  }

  // Per-period state derived from the same time logic as before
  const stateFor = (period: Period) => {
    const pStartMin = timeStringToMinutes(period.start);
    const pEndMin = timeStringToMinutes(period.end);
    const isCurrent =
      isOpen &&
      activePeriod?.id === period.id &&
      currentMinutes >= pStartMin &&
      currentMinutes < pEndMin;
    const isPast = isOpen && currentMinutes >= pEndMin;
    const span = pEndMin - pStartMin;
    const pct = span > 0 ? Math.min(100, Math.max(0, ((currentMinutes - pStartMin) / span) * 100)) : 0;
    return { isCurrent, isPast, pct };
  };

  const typeSticker = (type: string) =>
    type === 'Lab' ? 'sticker sticker--blue' : type === 'Tutorial' ? 'sticker sticker--mint' : 'sticker sticker--paper';

  const slotFor = (period: Period) => branchSlots.find((s) => String(s.periodId) === String(period.id));

  const renderProgress = (pct: number, end: string) => (
    <div className="mt-4">
      <div
        role="progressbar"
        aria-label="Time elapsed in this class"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(pct)}
        className="h-3 w-full overflow-hidden rounded-full border-2 border-[var(--ink)] bg-[var(--paper)]"
      >
        <div className="hatch h-full" style={{ width: `${pct}%`, backgroundColor: 'var(--orange)' }} />
      </div>
      <p className="mt-1.5 text-xs font-bold text-[var(--ink)]">
        Ends at <span className="font-mono tabular-nums">{end}</span>
      </p>
    </div>
  );

  const hasPeriods = sortedPeriods.length > 0;
  const hasSlots = branchSlots.length > 0;

  const tabTransition = reduceMotion ? { duration: 0 } : { type: 'spring' as const, stiffness: 520, damping: 38 };

  return (
    <div className="space-y-5 min-w-0">
      <div className="flex flex-col gap-4 no-print">
        {semesterOptions.length > 1 && (
          <div className="flex items-center gap-2 text-sm">
            <label htmlFor="semester-filter" className="font-bold text-[var(--ink)]">Semester</label>
            <select
              id="semester-filter"
              value={activeSemester}
              onChange={(e) => setSemesterFilter(e.target.value)}
              className="rounded-xl border-2 border-[var(--ink)] bg-[var(--paper-2)] px-3 py-1.5 font-semibold text-[var(--ink)]"
            >
              <option value="ALL">All semesters</option>
              {semesterOptions.map((sem) => (
                <option key={sem} value={sem}>{sem}</option>
              ))}
            </select>
          </div>
        )}

        {/* Branch stickers: each picks up its own branch colour when selected */}
        <div role="group" aria-label="Branch" className="flex items-center gap-2.5 overflow-x-auto px-1 pt-1 pb-2">
          {branches.map((branch) => {
            const isSelected = branch.id === selectedBranchId;
            return (
              <button
                key={branch.id}
                type="button"
                aria-pressed={isSelected}
                onClick={() => setSelectedBranchId(branch.id)}
                className={`flex shrink-0 items-center gap-2 whitespace-nowrap rounded-2xl border-2 border-[var(--ink)] px-4 py-2 text-sm font-bold transition-transform active:translate-x-[2px] active:translate-y-[2px] ${
                  isSelected
                    ? 'text-white shadow-[3px_3px_0_var(--ink)] -rotate-1'
                    : 'bg-[var(--paper-2)] text-[var(--ink)] hover:-translate-y-0.5'
                }`}
                style={{ backgroundColor: isSelected ? branch.color : undefined }}
              >
                <span>{branch.name}</span>
                <span
                  className={`rounded-md px-1.5 py-0.5 font-mono text-[11px] ${
                    isSelected ? 'bg-black/25' : 'bg-[var(--ink)]/10'
                  }`}
                >
                  {branch.code}
                </span>
              </button>
            );
          })}
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3">
          {/* Day tab strip with a sliding sticker behind the active day */}
          <div
            role="tablist"
            aria-label="Day of the week"
            className="flex max-w-full items-center gap-1 overflow-x-auto rounded-2xl border-2 border-[var(--ink)] bg-[var(--paper-2)] p-1"
          >
            {DAYS_OF_WEEK.map((day) => {
              const isSelected = day === activeDay;
              return (
                <button
                  key={day}
                  type="button"
                  role="tab"
                  aria-selected={isSelected}
                  onClick={() => setActiveDay(day)}
                  className={`relative shrink-0 whitespace-nowrap rounded-xl px-3.5 py-2 text-sm font-bold transition-colors ${
                    isSelected ? 'text-[#15163a]' : 'text-[var(--ink)]/70 hover:text-[var(--ink)]'
                  }`}
                >
                  {isSelected && (
                    <motion.span
                      layoutId="branch-day-indicator"
                      transition={tabTransition}
                      className="absolute inset-0 rounded-xl border-2 border-[#15163a] bg-[var(--yellow)] shadow-[2px_2px_0_#15163a]"
                    />
                  )}
                  <span className="relative">
                    {day.slice(0, 3)}
                    <span className="hidden sm:inline">{day.slice(3)}</span>
                  </span>
                </button>
              );
            })}
          </div>

          <div className="flex items-center gap-2">
            <div role="group" aria-label="Layout" className="flex items-center gap-1 rounded-xl border-2 border-[var(--ink)] bg-[var(--paper-2)] p-1">
              <button
                type="button"
                onClick={() => setViewMode('grid')}
                aria-pressed={viewMode === 'grid'}
                aria-label="Grid view"
                title="Grid view"
                className={`rounded-lg p-1.5 transition-colors ${
                  viewMode === 'grid' ? 'bg-[var(--blue)] text-white' : 'text-[var(--ink)] hover:bg-[var(--ink)]/10'
                }`}
              >
                <LayoutGrid className="h-4 w-4" />
              </button>
              <button
                type="button"
                onClick={() => setViewMode('timeline')}
                aria-pressed={viewMode === 'timeline'}
                aria-label="Timeline view"
                title="Timeline view"
                className={`rounded-lg p-1.5 transition-colors ${
                  viewMode === 'timeline' ? 'bg-[var(--blue)] text-white' : 'text-[var(--ink)] hover:bg-[var(--ink)]/10'
                }`}
              >
                <List className="h-4 w-4" />
              </button>
            </div>

            <button type="button" onClick={handlePrint} aria-label="Print routine" title="Print routine" className="btn btn--paper">
              <Printer className="h-4 w-4" />
              <span className="hidden sm:inline">Print</span>
            </button>

            <button type="button" onClick={handleDownloadCSV} aria-label="Download timetable as CSV" title="Download timetable" className="btn btn--paper">
              <Download className="h-4 w-4" />
              <span className="hidden sm:inline">CSV</span>
            </button>
          </div>
        </div>
      </div>

      <div className="print-area">
        <div className="hidden print:block mb-4 text-center">
          <h2 className="text-xl font-bold">{selectedBranch.name} ({selectedBranch.shortName})</h2>
          <p className="text-sm text-gray-600">{activeDay} Daily Schedule</p>
        </div>

        <motion.div
          key={`${selectedBranchId}-${activeDay}-${viewMode}`}
          role="tabpanel"
          aria-label={`${selectedBranch.name} schedule for ${activeDay}`}
          initial={reduceMotion ? false : { opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.18 }}
        >
          {!hasPeriods ? (
            <div role="status" className="halftone rounded-2xl border-2 border-dashed border-[var(--ink)] bg-[var(--paper-2)] p-8 text-center">
              <p className="font-bold text-base text-[var(--ink)]">No periods yet.</p>
              <p className="mt-1 text-sm text-[var(--ink)]/75">
                Add the daily periods in the Admin Portal and the timetable will fill in here.
              </p>
            </div>
          ) : !hasSlots ? (
            <div role="status" className="halftone rounded-2xl border-2 border-dashed border-[var(--ink)] bg-[var(--paper-2)] p-8 text-center">
              <p className="font-bold text-base text-[var(--ink)]">
                No classes for {selectedBranch.name} on {activeDay}.
              </p>
              <p className="mt-1 text-sm text-[var(--ink)]/75">
                Add classes in the Admin Portal and publish them to show them here. Try another day in the meantime.
              </p>
            </div>
          ) : viewMode === 'grid' ? (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {sortedPeriods.map((period) => {
                const slot = slotFor(period);
                const { isCurrent, isPast, pct } = stateFor(period);

                if (period.isBreak) {
                  return (
                    <div
                      key={period.id}
                      className="halftone col-span-full flex items-center justify-between gap-3 rounded-xl border-2 border-dashed border-[var(--ink)]/50 px-4 py-2.5"
                    >
                      <div className="flex items-center gap-2.5 font-bold text-sm text-[var(--ink)]">
                        <Coffee className="h-4 w-4" />
                        <span>{period.label}</span>
                      </div>
                      <span className="font-mono tabular-nums text-xs font-medium text-[var(--ink)]">
                        {period.start} - {period.end}
                      </span>
                    </div>
                  );
                }

                return (
                  <div
                    key={period.id}
                    className={`relative min-w-0 overflow-hidden rounded-2xl p-5 pl-6 ${
                      isCurrent
                        ? 'ticket'
                        : `border-2 border-[var(--ink)]/30 bg-[var(--paper-2)] text-[var(--ink)] ${isPast ? 'opacity-60' : ''}`
                    }`}
                    style={isCurrent ? { borderColor: 'var(--orange)', borderWidth: 3, boxShadow: '6px 6px 0 var(--orange)' } : undefined}
                    aria-current={isCurrent ? 'true' : undefined}
                  >
                    <span
                      aria-hidden="true"
                      className="absolute inset-y-0 left-0 w-2"
                      style={{ backgroundColor: selectedBranch.color }}
                    />
                    <div className="mb-3 flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-sm font-bold">{period.label}</span>
                        {isCurrent && (
                          <span className="sticker sticker--orange">
                            <span className="live-dot" aria-hidden="true" />
                            Live now
                          </span>
                        )}
                      </div>
                      {slot && <span className={typeSticker(slot.type)}>{slot.type}</span>}
                    </div>

                    <div className="mb-2 flex items-center gap-1.5 font-mono text-xs tabular-nums text-[var(--ink)]/70">
                      <Clock className="h-3.5 w-3.5" />
                      <span>{period.start} - {period.end}</span>
                    </div>

                    {slot ? (
                      <div>
                        <h3 className="text-base font-bold leading-snug break-words">{slot.subject}</h3>
                        <div className="mt-3 space-y-1.5 text-sm">
                          <div className="flex items-center gap-2">
                            <User className="h-3.5 w-3.5 shrink-0" />
                            <span className="truncate">{slot.teacher}</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <MapPin className="h-3.5 w-3.5 shrink-0" />
                            <span className="font-bold">{slot.roomId}</span>
                          </div>
                        </div>
                      </div>
                    ) : (
                      <p className="py-5 text-sm text-[var(--ink)]/60">Free period. No class scheduled.</p>
                    )}

                    {isCurrent && renderProgress(pct, period.end)}
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="relative my-2 space-y-5 border-l-[3px] border-[var(--ink)] pl-6 sm:pl-8">
              {sortedPeriods.map((period) => {
                const slot = slotFor(period);
                const { isCurrent, isPast, pct } = stateFor(period);

                if (period.isBreak) {
                  return (
                    <div key={period.id} className="relative">
                      <span
                        aria-hidden="true"
                        className="absolute -left-[34px] top-1/2 h-3.5 w-3.5 -translate-y-1/2 rotate-45 border-2 border-[var(--ink)] bg-[var(--paper-2)] sm:-left-[42px]"
                      />
                      <div className="halftone flex items-center justify-between gap-3 rounded-xl border-2 border-dashed border-[var(--ink)]/50 px-4 py-2">
                        <div className="flex items-center gap-2 text-sm font-bold text-[var(--ink)]">
                          <Coffee className="h-4 w-4" />
                          <span>{period.label}</span>
                        </div>
                        <span className="font-mono text-xs font-medium tabular-nums text-[var(--ink)]">
                          {period.start} - {period.end}
                        </span>
                      </div>
                    </div>
                  );
                }

                return (
                  <div key={period.id} className="relative">
                    <span
                      aria-hidden="true"
                      className={`absolute top-5 h-4 w-4 border-2 border-[var(--ink)] ${
                        isCurrent
                          ? '-left-[35px] sm:-left-[43px] rounded-full bg-[var(--orange)]'
                          : '-left-[34px] sm:-left-[42px] rounded-sm bg-[var(--paper-2)]'
                      }`}
                    />
                    <div
                      className={`relative min-w-0 overflow-hidden rounded-2xl p-4 pl-6 sm:p-5 sm:pl-7 ${
                        isCurrent
                          ? 'ticket'
                          : `border-2 border-[var(--ink)]/30 bg-[var(--paper-2)] text-[var(--ink)] ${isPast ? 'opacity-60' : ''}`
                      }`}
                      style={isCurrent ? { borderColor: 'var(--orange)', borderWidth: 3, boxShadow: '6px 6px 0 var(--orange)' } : undefined}
                      aria-current={isCurrent ? 'true' : undefined}
                    >
                      <span
                        aria-hidden="true"
                        className="absolute inset-y-0 left-0 w-2"
                        style={{ backgroundColor: selectedBranch.color }}
                      />
                      <div className="mb-2 flex flex-col justify-between gap-2 sm:flex-row sm:items-center">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-mono text-sm font-bold tabular-nums">
                            {period.label} ({period.start} - {period.end})
                          </span>
                          {isCurrent && (
                            <span className="sticker sticker--orange">
                              <span className="live-dot" aria-hidden="true" />
                              Current class
                            </span>
                          )}
                        </div>
                        {slot && <span className={`${typeSticker(slot.type)} self-start`}>{slot.type}</span>}
                      </div>

                      {slot ? (
                        <div className="mt-2 flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
                          <div className="min-w-0">
                            <h3 className="text-base font-bold break-words">{slot.subject}</h3>
                            <p className="mt-0.5 text-sm text-[var(--ink)]/70">Instructor: {slot.teacher}</p>
                          </div>
                          <div className="flex shrink-0 items-center gap-2 self-start rounded-xl border-2 border-[var(--ink)] bg-[var(--paper)] px-3 py-1.5 text-sm font-bold sm:self-auto">
                            <MapPin className="h-3.5 w-3.5" />
                            <span>{slot.roomId}</span>
                          </div>
                        </div>
                      ) : (
                        <p className="text-sm text-[var(--ink)]/60">Free period. No class scheduled.</p>
                      )}

                      {isCurrent && renderProgress(pct, period.end)}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </motion.div>
      </div>
    </div>
  );
};
