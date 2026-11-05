import React, { useState, useRef } from 'react';
import confetti from 'canvas-confetti';
import {
  AlertTriangle,
  ArrowUpRight,
  CheckCircle2,
  Download,
  FileSpreadsheet,
  History,
  RotateCcw,
  Sparkles,
  Upload,
  XCircle
} from 'lucide-react';
import {
  generateExcelTemplate,
  exportCurrentDataToExcel,
  parseAndValidateExcel,
  ParsedExcelData
} from '../../utils/excelEngine';
import { Branch, Room, TimetableSlot, Holiday, Period, UploadHistoryItem } from '../../types';
import { storageService } from '../../services/storageService';

interface UploadZoneProps {
  branches?: Branch[];
  rooms: Room[];
  periods: Period[];
  timetable: TimetableSlot[];
  holidays: Holiday[];
  onDataImported: (data: {
    timetable: TimetableSlot[];
    rooms: Room[];
    holidays: Holiday[];
    periods: Period[];
  }) => void;
  onShowToast: (msg: string, type: 'success' | 'error' | 'info') => void;
}

export const UploadZone: React.FC<UploadZoneProps> = ({
  branches = [],
  rooms,
  periods,
  timetable,
  holidays,
  onDataImported,
  onShowToast
}) => {
  const [isDragging, setIsDragging] = useState(false);
  const [parsing, setParsing] = useState(false);
  const [parsedData, setParsedData] = useState<ParsedExcelData | null>(null);
  const [uploadFileName, setUploadFileName] = useState('');
  const [importMode, setImportMode] = useState<'replace' | 'merge'>('replace');
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [saveProgress, setSaveProgress] = useState(0);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploadHistory, setUploadHistory] = useState(() => storageService.getUploadHistory());

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const files = e.dataTransfer.files;
    if (files.length > 0) {
      processFile(files[0]);
    }
  };

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      processFile(files[0]);
    }
    e.target.value = '';
  };

  const processFile = async (file: File) => {
    if (!file.name.match(/\.(xlsx|xls|csv)$/i)) {
      onShowToast('Please upload a valid .xlsx, .xls, or .csv spreadsheet', 'error');
      return;
    }

    setParsing(true);
    setUploadFileName(file.name);
    try {
      const result = await parseAndValidateExcel(file, rooms, [], periods, branches.map((b) => b.id));
      setParsedData(result);
      if (result.errors.length === 0) {
        onShowToast(`Parsed ${result.sheetRowCounts.timetable} classes with zero errors!`, 'success');
      } else {
        onShowToast(`File has ${result.errors.length} validation errors to review`, 'error');
      }
    } catch (err: any) {
      console.error(err);
      onShowToast(`Failed to parse Excel file: ${err.message || 'Unknown error'}`, 'error');
    } finally {
      setParsing(false);
    }
  };

  const handleConfirmImport = async () => {
    if (!parsedData) return;
    setIsSaving(true);
    setShowConfirmModal(false);
    setSaveProgress(5);

    // Snapshot for UNDO (taken before anything changes)
    const snapshot = storageService.createStateSnapshot();

    let finalTimetable = timetable;
    let finalRooms = rooms;
    let finalHolidays = holidays;
    let finalPeriods = periods;

    if (importMode === 'replace') {
      if (parsedData.timetable.length > 0) finalTimetable = parsedData.timetable;
      if (parsedData.rooms.length > 0) finalRooms = parsedData.rooms;
      if (parsedData.holidays.length > 0) finalHolidays = parsedData.holidays;
      if (parsedData.periods.length > 0) finalPeriods = parsedData.periods;
    } else {
      // Merge: skip rows that already exist so re-importing the same file never duplicates data.
      const slotKey = (s: TimetableSlot) =>
        [s.branch, s.semester || '', s.day, s.start_time || s.periodId, s.roomId].join('|').toLowerCase();
      const have = new Set(timetable.map(slotKey));
      finalTimetable = [...timetable, ...parsedData.timetable.filter((s) => !have.has(slotKey(s)))];

      const existingIds = new Set(rooms.map((r) => r.id.toLowerCase()));
      finalRooms = [...rooms, ...parsedData.rooms.filter((r) => !existingIds.has(r.id.toLowerCase()))];

      const holKey = (h: Holiday) => [h.title, h.startDate || h.start_date, h.endDate || h.end_date].join('|').toLowerCase();
      const haveHol = new Set(holidays.map(holKey));
      finalHolidays = [...holidays, ...parsedData.holidays.filter((h) => !haveHol.has(holKey(h)))];

      if (parsedData.periods.length > 0) finalPeriods = parsedData.periods;
    }

    // Persist in foreign-key order and stop at the first failure.
    const steps: Array<[string, () => Promise<{ ok: boolean; error?: string }>]> = [
      ['rooms', () => storageService.saveRooms(finalRooms)],
      ['periods', () => storageService.savePeriods(finalPeriods)],
      ['timetable', () => storageService.saveTimetable(finalTimetable)],
      ['holidays', () => storageService.saveHolidays(finalHolidays)]
    ];
    let failure: string | undefined;
    for (let i = 0; i < steps.length; i++) {
      setSaveProgress(10 + Math.round((i / steps.length) * 85));
      const r = await steps[i][1]();
      if (!r.ok) {
        failure = r.error;
        break;
      }
    }

    if (failure) {
      // Put the browser and database back exactly as they were.
      await storageService.restoreSnapshot(snapshot);
      onDataImported({ timetable, rooms, holidays, periods });
      setIsSaving(false);
      setSaveProgress(0);
      onShowToast(`Import failed and was rolled back. ${failure}`, 'error');
      return;
    }

    const historyItem: UploadHistoryItem = {
      id: 'up-' + Date.now(),
      fileName: uploadFileName,
      timestamp: Date.now(),
      mode: importMode,
      counts: parsedData.sheetRowCounts,
      previousSnapshot: snapshot
    };
    const hist = await storageService.saveUploadHistory(historyItem);
    setUploadHistory(storageService.getUploadHistory());

    onDataImported({
      timetable: finalTimetable,
      rooms: finalRooms,
      holidays: finalHolidays,
      periods: finalPeriods
    });

    setIsSaving(false);
    setSaveProgress(0);
    setParsedData(null);

    try {
      confetti({ particleCount: 80, spread: 70, origin: { y: 0.6 } });
    } catch {
      // decorative only
    }

    onShowToast(
      hist.ok ? 'Data imported and saved.' : `Data imported and saved, but the history entry failed: ${hist.error}`,
      hist.ok ? 'success' : 'info'
    );
  };

  const handleUndo = async (item: UploadHistoryItem) => {
    if (!item.previousSnapshot) {
      onShowToast('No previous state available to undo', 'error');
      return;
    }
    const res = await storageService.restoreSnapshot(item.previousSnapshot);
    if (res.ok) {
      onDataImported({
        timetable: storageService.getTimetable(),
        rooms: storageService.getRooms(),
        holidays: storageService.getHolidays(),
        periods: storageService.getPeriods()
      });
      onShowToast(`Reverted changes from upload: ${item.fileName}`, 'info');
    } else {
      onShowToast(`Could not undo: ${res.error}`, 'error');
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Template & Export Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-3 p-4 rounded-2xl bg-indigo-50/60 dark:bg-indigo-950/20 border border-indigo-100 dark:border-indigo-900/40">
        <div>
          <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <FileSpreadsheet className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
            <span>Excel Batch Import / Export Engine</span>
          </h3>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Download the official multi-sheet schedule template, fill in offline, and upload with automated clash detection
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => generateExcelTemplate()}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold bg-white dark:bg-slate-900 text-indigo-600 dark:text-indigo-400 hover:bg-slate-50 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-800 shadow-sm transition"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Download Template (.xlsx)</span>
          </button>

          <button
            onClick={() => exportCurrentDataToExcel(timetable, rooms, holidays, periods)}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold bg-slate-900 hover:bg-slate-800 text-white dark:bg-slate-800 dark:hover:bg-slate-700 shadow-sm transition"
          >
            <ArrowUpRight className="w-3.5 h-3.5" />
            <span>Export Current Data</span>
          </button>
        </div>
      </div>

      {/* PDF / Scanned Image OCR Disclaimer Banner */}
      <div className="flex items-start gap-3 p-3.5 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-amber-800 dark:text-amber-300 text-xs">
        <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
        <div className="leading-relaxed">
          <span className="font-bold">Notice regarding PDF &amp; Scanned Image Timetables:</span> Directly parsing scanned paper photos or PDFs via client-side OCR is experimental and error-prone. For 100% reliable scheduling, strict foreign key validation, and automated conflict detection, please download the official 6-sheet template, transfer your routine details, and upload the spreadsheet here.
        </div>
      </div>

      {/* Drag & Drop Upload Zone */}
      <div
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={() => fileInputRef.current?.click()}
        role="button"
        tabIndex={0}
        aria-label="Choose a timetable spreadsheet to upload"
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            fileInputRef.current?.click();
          }
        }}
        className={`relative border-2 border-dashed rounded-3xl p-8 sm:p-12 text-center cursor-pointer transition-all ${
          isDragging
            ? 'border-indigo-500 bg-indigo-50/80 dark:bg-indigo-950/40 scale-[1.01]'
            : 'border-slate-300 dark:border-slate-700 hover:border-indigo-400 dark:hover:border-indigo-500 bg-white dark:bg-slate-900'
        }`}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept=".xlsx,.xls,.csv"
          onChange={handleFileInput}
          className="hidden"
        />

        <div className="max-w-md mx-auto space-y-3">
          <div className="w-14 h-14 mx-auto rounded-2xl bg-indigo-500/10 flex items-center justify-center text-indigo-600 dark:text-indigo-400">
            <Upload className="w-7 h-7" />
          </div>

          <h4 className="text-base font-bold text-slate-900 dark:text-white">
            {parsing ? 'Parsing & Validating Spreadsheet...' : 'Drop your timetable spreadsheet here'}
          </h4>

          <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
            Supports <strong className="text-slate-700 dark:text-slate-300">.xlsx</strong>,{' '}
            <strong className="text-slate-700 dark:text-slate-300">.xls</strong>, or{' '}
            <strong className="text-slate-700 dark:text-slate-300">.csv</strong>. Validates room
            clashes, professor conflicts, period constraints, and missing records.
          </p>

          <button
            type="button"
            className="px-4 py-2 rounded-xl text-xs font-bold bg-indigo-600 hover:bg-indigo-500 text-white shadow-sm transition inline-flex items-center gap-1.5"
          >
            <span>Choose File from Computer</span>
          </button>
        </div>
      </div>

      {/* Progress Bar (While Saving) */}
      {isSaving && (
        <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-indigo-200 dark:border-indigo-900 space-y-2">
          <div className="flex justify-between text-xs font-bold text-indigo-600 dark:text-indigo-400">
            <span>Applying Schedule to Database...</span>
            <span>{saveProgress}%</span>
          </div>
          <div className="w-full h-2 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
            <div
              className="h-full bg-indigo-600 transition-all duration-200"
              style={{ width: `${saveProgress}%` }}
            />
          </div>
        </div>
      )}

      {/* Parsed Results & Validation Preview */}
      {parsedData && (
        <div className="space-y-4 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 shadow-sm">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-200 dark:border-slate-800">
            <div>
              <h4 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <span>Spreadsheet Preview: {uploadFileName}</span>
              </h4>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Review row counts and automated clash detection results before applying
              </p>
            </div>

            {/* Save Buttons */}
            <div className="flex items-center gap-2">
              <button
                onClick={() => setParsedData(null)}
                className="px-3 py-1.5 text-xs font-semibold rounded-xl text-slate-600 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800"
              >
                Cancel
              </button>
              <button
                onClick={() => setShowConfirmModal(true)}
                disabled={parsedData.errors.length > 0}
                className={`px-4 py-2 rounded-xl text-xs font-bold text-white shadow transition ${
                  parsedData.errors.length > 0
                    ? 'bg-slate-400 cursor-not-allowed opacity-60'
                    : 'bg-emerald-600 hover:bg-emerald-500'
                }`}
              >
                Proceed to Save
              </button>
            </div>
          </div>

          {/* Sheet Row Counts Strip */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-800">
              <div className="text-xs text-slate-500 dark:text-slate-400">Timetable Slots</div>
              <div className="text-xl font-bold font-mono text-slate-900 dark:text-white">
                {parsedData.sheetRowCounts.timetable}
              </div>
            </div>
            <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-800">
              <div className="text-xs text-slate-500 dark:text-slate-400">Rooms Listed</div>
              <div className="text-xl font-bold font-mono text-slate-900 dark:text-white">
                {parsedData.sheetRowCounts.rooms}
              </div>
            </div>
            <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-800">
              <div className="text-xs text-slate-500 dark:text-slate-400">Holidays / Breaks</div>
              <div className="text-xl font-bold font-mono text-slate-900 dark:text-white">
                {parsedData.sheetRowCounts.holidays}
              </div>
            </div>
            <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-800">
              <div className="text-xs text-slate-500 dark:text-slate-400">Periods / Shifts</div>
              <div className="text-xl font-bold font-mono text-slate-900 dark:text-white">
                {parsedData.sheetRowCounts.periods}
              </div>
            </div>
          </div>

          {/* Errors Report (Critical) */}
          {parsedData.errors.length > 0 && (
            <div className="p-4 rounded-xl bg-rose-50 dark:bg-rose-950/30 border border-rose-300 dark:border-rose-900/60 space-y-2">
              <div className="flex items-center gap-2 text-xs font-bold text-rose-700 dark:text-rose-300 uppercase tracking-wider">
                <XCircle className="w-4 h-4 text-rose-600" />
                <span>{parsedData.errors.length} Critical Errors (Must be fixed to import)</span>
              </div>
              <div className="max-h-48 overflow-y-auto space-y-1.5 text-xs">
                {parsedData.errors.map((err, i) => (
                  <div
                    key={i}
                    className="p-2 rounded-lg bg-white dark:bg-slate-900 border border-rose-200 dark:border-rose-900/40 text-rose-900 dark:text-rose-200"
                  >
                    <div className="font-semibold flex items-center justify-between">
                      <span>
                        Sheet: {err.sheet} · Row {err.row}
                      </span>
                      {err.column && <span className="opacity-75 font-mono">Col: {err.column}</span>}
                    </div>
                    <div>{err.message}</div>
                    <div className="text-[11px] text-slate-500 dark:text-slate-400 italic mt-0.5">
                      Fix hint: {err.hint}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Warnings Report */}
          {parsedData.warnings.length > 0 && (
            <div className="p-4 rounded-xl bg-amber-50 dark:bg-amber-950/30 border border-amber-300 dark:border-amber-900/60 space-y-2">
              <div className="flex items-center gap-2 text-xs font-bold text-amber-700 dark:text-amber-300 uppercase tracking-wider">
                <AlertTriangle className="w-4 h-4 text-amber-600" />
                <span>{parsedData.warnings.length} Warnings (Non-blocking)</span>
              </div>
              <div className="max-h-32 overflow-y-auto space-y-1 text-xs">
                {parsedData.warnings.map((warn, i) => (
                  <div key={i} className="text-amber-800 dark:text-amber-300">
                    Row {warn.row}: {warn.message} ({warn.hint})
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Sample Preview Rows */}
          {parsedData.timetable.length > 0 && (
            <div className="space-y-2 pt-2">
              <span className="text-xs font-semibold text-slate-600 dark:text-slate-400">
                Sample preview rows (first 4 slots):
              </span>
              <div className="overflow-x-auto">
                <table className="w-full text-xs text-left">
                  <thead>
                    <tr className="border-b border-slate-200 dark:border-slate-800 text-slate-500">
                      <th className="py-1 px-2">Branch</th>
                      <th className="py-1 px-2">Day</th>
                      <th className="py-1 px-2">Period</th>
                      <th className="py-1 px-2">Subject</th>
                      <th className="py-1 px-2">Teacher</th>
                      <th className="py-1 px-2">Room</th>
                      <th className="py-1 px-2">Type</th>
                    </tr>
                  </thead>
                  <tbody>
                    {parsedData.timetable.slice(0, 4).map((s, idx) => (
                      <tr key={idx} className="border-b border-slate-100 dark:border-slate-800">
                        <td className="py-1.5 px-2 font-bold">{s.branch}</td>
                        <td className="py-1.5 px-2">{s.day}</td>
                        <td className="py-1.5 px-2 font-mono">{s.periodId}</td>
                        <td className="py-1.5 px-2">{s.subject}</td>
                        <td className="py-1.5 px-2">{s.teacher}</td>
                        <td className="py-1.5 px-2 font-semibold text-indigo-600">{s.roomId}</td>
                        <td className="py-1.5 px-2">{s.type}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Confirmation Modal */}
      {showConfirmModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm animate-fade-in">
          <div className="w-full max-w-md rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-6 shadow-2xl space-y-4">
            <h3 className="text-base font-bold text-slate-900 dark:text-white">
              Confirm Data Import
            </h3>

            <p className="text-xs text-slate-600 dark:text-slate-300">
              Choose how you want to apply this spreadsheet:
            </p>

            <div className="space-y-2">
              <label className="flex items-start gap-3 p-3 rounded-xl border border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer">
                <input
                  type="radio"
                  name="importMode"
                  checked={importMode === 'replace'}
                  onChange={() => setImportMode('replace')}
                  className="mt-1"
                />
                <div>
                  <div className="text-xs font-bold text-slate-900 dark:text-white">
                    Replace All Existing Schedule Data (Recommended)
                  </div>
                  <div className="text-[11px] text-slate-500">
                    Completely overwrites previous timetables with this verified clean version.
                  </div>
                </div>
              </label>

              <label className="flex items-start gap-3 p-3 rounded-xl border border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer">
                <input
                  type="radio"
                  name="importMode"
                  checked={importMode === 'merge'}
                  onChange={() => setImportMode('merge')}
                  className="mt-1"
                />
                <div>
                  <div className="text-xs font-bold text-slate-900 dark:text-white">
                    Merge / Append with Existing Data
                  </div>
                  <div className="text-[11px] text-slate-500">
                    Appends rows to the existing database without removing current classes.
                  </div>
                </div>
              </label>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-200 dark:border-slate-800">
              <button
                onClick={() => setShowConfirmModal(false)}
                className="px-3 py-2 text-xs font-semibold rounded-xl text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
              >
                Back
              </button>
              <button
                onClick={handleConfirmImport}
                className="px-4 py-2 text-xs font-bold rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white shadow"
              >
                Confirm &amp; Apply Schedule
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Upload History & Undo Section */}
      {uploadHistory.length > 0 && (
        <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 shadow-sm space-y-3">
          <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 flex items-center gap-2">
            <History className="w-4 h-4" />
            <span>Recent Upload History (Last 5 Uploads)</span>
          </h4>

          <div className="divide-y divide-slate-100 dark:divide-slate-800 text-xs">
            {uploadHistory.map((item) => (
              <div key={item.id} className="py-2.5 flex items-center justify-between gap-3">
                <div>
                  <div className="font-semibold text-slate-900 dark:text-white flex items-center gap-2">
                    <span>{item.fileName}</span>
                    <span className="text-[10px] font-mono uppercase px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400">
                      {item.mode}
                    </span>
                  </div>
                  <div className="text-[11px] text-slate-400">
                    {new Date(item.timestamp).toLocaleString()} · {item.counts.timetable} classes, {item.counts.rooms} rooms
                  </div>
                </div>

                {item.previousSnapshot && (
                  <button
                    onClick={() => handleUndo(item)}
                    className="flex items-center gap-1 px-2.5 py-1 text-xs font-semibold rounded-lg text-amber-600 dark:text-amber-400 hover:bg-amber-50 dark:hover:bg-amber-950/40 border border-amber-200 dark:border-amber-900/60 transition"
                  >
                    <RotateCcw className="w-3 h-3" />
                    <span>Undo This Upload</span>
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
