import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  AlertCircle,
  CheckCircle2,
  Clock,
  Info,
  WifiOff,
  X
} from 'lucide-react';
import {
  Branch,
  DayOfWeek,
  Holiday,
  CollegeSettings,
  Notice,
  Period,
  QuickOverride,
  Room,
  RoomBooking,
  TimetableSlot
} from './types';
import { storageService } from './services/storageService';
import {
  DAYS_OF_WEEK,
  deriveAllRoomStatuses,
  evaluateCollegeStatus,
  getCollegeZonedTime,
  getDaysUntilNextHoliday
} from './utils/timeEngine';
import { TopNav } from './components/TopNav';
import { NoticeTicker } from './components/NoticeTicker';
import { HeroBanner } from './components/HeroBanner';
import { TimeMachineModal } from './components/TimeMachineModal';
import { BranchTimetable } from './components/BranchTimetable';
import { RoomAvailability } from './components/RoomAvailability';
import { HolidayCalendar } from './components/HolidayCalendar';
import { AdminLayout } from './components/AdminPanel/AdminLayout';
import { SetupChecker } from './components/SetupChecker';
import { checkDatabaseSetup, SetupStatus, isSupabaseConfigured } from './services/supabaseClient';

export default function App() {
  // Theme state: defaults to dark mode per design guidelines
  const [darkMode, setDarkMode] = useState<boolean>(() => {
    try {
      const saved = localStorage.getItem('collegeconnect_theme') || localStorage.getItem('campuspulse_theme');
      if (saved) return saved === 'dark';
    } catch {
      // storage unavailable: fall through to default
    }
    return true; // Default dark
  });

  // Core Data State
  const [branches, setBranches] = useState<Branch[]>(() => storageService.getBranches());
  const [rooms, setRooms] = useState<Room[]>(() => storageService.getRooms());
  const [periods, setPeriods] = useState<Period[]>(() => storageService.getPeriods());
  const [timetable, setTimetable] = useState<TimetableSlot[]>(() => storageService.getTimetable());
  const [holidays, setHolidays] = useState<Holiday[]>(() => storageService.getHolidays());
  const [notices, setNotices] = useState<Notice[]>(() => storageService.getNotices());
  const [bookings, setBookings] = useState<RoomBooking[]>(() => storageService.getBookings());
  const [quickOverrides, setQuickOverrides] = useState<QuickOverride[]>(() => storageService.getQuickOverrides());
  const [settings, setSettings] = useState<CollegeSettings>(() => storageService.getSettings());
  const [syncing, setSyncing] = useState<boolean>(isSupabaseConfigured);
  const [syncError, setSyncError] = useState<string>('');

  /** Re-read everything from local storage (which sync keeps in step with the database). */
  const reloadFromStorage = useCallback(() => {
    setBranches(storageService.getBranches());
    setRooms(storageService.getRooms());
    setPeriods(storageService.getPeriods());
    setTimetable(storageService.getTimetable());
    setHolidays(storageService.getHolidays());
    setNotices(storageService.getNotices());
    setQuickOverrides(storageService.getQuickOverrides());
    setSettings(storageService.getSettings());
    setBookings(storageService.getBookings());
  }, []);

  // Active View Tab
  const [activeTab, setActiveTab] = useState<'today' | 'timetable' | 'rooms' | 'calendar' | 'admin'>(() => {
    if (window.location.pathname === '/admin') return 'admin';
    return 'today';
  });

  // Keep the address bar in step with the tab so /admin can be bookmarked and shared
  useEffect(() => {
    const target = activeTab === 'admin' ? '/admin' : '/';
    if (window.location.pathname !== target && (activeTab === 'admin' || window.location.pathname === '/admin')) {
      window.history.pushState({}, '', target);
    }
  }, [activeTab]);

  useEffect(() => {
    const onPop = () => setActiveTab(window.location.pathname === '/admin' ? 'admin' : 'today');
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, []);

  // Clock & Time Machine State
  const [isSimulated, setIsSimulated] = useState(false);
  const [simulatedDate, setSimulatedDate] = useState<Date>(new Date());
  const [showTimeMachine, setShowTimeMachine] = useState(false);

  // Setup Checker state for Supabase database validation
  const [setupStatus, setSetupStatus] = useState<SetupStatus | null>(null);
  const [isCheckingSetup, setIsCheckingSetup] = useState(false);
  const [bypassSetupChecker, setBypassSetupChecker] = useState(false);

  const runDatabaseProbe = async () => {
    setIsCheckingSetup(true);
    try {
      const res = await checkDatabaseSetup();
      setSetupStatus(res);
      if (res.isReady) {
        setBypassSetupChecker(true);
      }
    } catch {
      // Handled gracefully
    } finally {
      setIsCheckingSetup(false);
    }
  };

  useEffect(() => {
    if (activeTab === 'admin' && isSupabaseConfigured) {
      runDatabaseProbe();
    }
  }, [activeTab]);

  // Online / Offline Detection
  const [isOnline, setIsOnline] = useState<boolean>(typeof navigator !== 'undefined' ? navigator.onLine : true);

  // Toast System
  const [toasts, setToasts] = useState<Array<{ id: string; msg: string; type: 'success' | 'error' | 'info' }>>([]);

  const showToast = (msg: string, type: 'success' | 'error' | 'info' = 'info') => {
    const id = 't-' + Date.now() + Math.random().toString(36).substr(2, 4);
    setToasts((prev) => [...prev, { id, msg, type }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 4000);
  };

  // Sync theme with HTML document element
  useEffect(() => {
    if (darkMode) {
      document.documentElement.classList.add('dark');
      try { localStorage.setItem('collegeconnect_theme', 'dark'); } catch { /* storage unavailable */ }
    } else {
      document.documentElement.classList.remove('dark');
      try { localStorage.setItem('collegeconnect_theme', 'light'); } catch { /* storage unavailable */ }
    }
  }, [darkMode]);

  // Online status listeners
  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // Load from Supabase (source of truth when configured), keep it live via realtime, and refresh
  // when the tab regains focus or the connection comes back.
  useEffect(() => {
    if (!isSupabaseConfigured) return;
    let cancelled = false;
    const run = async () => {
      const res = await storageService.syncFromSupabase();
      if (cancelled) return;
      reloadFromStorage();
      setSyncing(false);
      setSyncError(res.ok ? '' : res.errors[0] || 'Could not load data from the database');
    };
    run();
    const unsubscribe = storageService.setupRealtimeSubscription(reloadFromStorage);
    const onFocus = () => { run(); };
    window.addEventListener('focus', onFocus);
    window.addEventListener('online', onFocus);
    const poll = setInterval(run, 5 * 60 * 1000); // fallback if realtime is not enabled
    return () => {
      cancelled = true;
      unsubscribe();
      window.removeEventListener('focus', onFocus);
      window.removeEventListener('online', onFocus);
      clearInterval(poll);
    };
  }, [reloadFromStorage]);

  // Live Clock Ticker
  useEffect(() => {
    const interval = setInterval(() => {
      if (!isSimulated) {
        setSimulatedDate(new Date());
      } else {
        // Advance simulated time by 1 second
        setSimulatedDate((prev) => new Date(prev.getTime() + 1000));
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [isSimulated]);

  // Derive Current Day of Week for Timetable
  const collegeTimeZone = settings.timezone || 'Asia/Kolkata';
  // Wall-clock "now" in the COLLEGE timezone (not the viewer's browser timezone)
  const zoned = getCollegeZonedTime(simulatedDate, collegeTimeZone);
  const currentDayName = zoned.dayName;
  const [activeDay, setActiveDay] = useState<DayOfWeek>(() => {
    if (DAYS_OF_WEEK.includes(currentDayName as DayOfWeek)) {
      return currentDayName as DayOfWeek;
    }
    return 'Monday';
  });

  // When simulated day changes, auto-select if Mon–Sat
  useEffect(() => {
    if (DAYS_OF_WEEK.includes(currentDayName as DayOfWeek)) {
      setActiveDay(currentDayName as DayOfWeek);
    }
  }, [currentDayName]);

  // Working days and opening hours come from the settings the admin saved.
  const hoursConfig = {
    workingDays: settings.working_days,
    openingTime: settings.opening_time,
    closingTime: settings.closing_time
  };

  // Only pending and approved bookings for today hold a room right now.
  const todaysHeldBookings = bookings.filter(
    (b) => b.date === zoned.dateStr && (!b.status || b.status === 'pending' || b.status === 'approved')
  );

  // College status evaluation
  const collegeStatus = evaluateCollegeStatus(
    simulatedDate,
    periods,
    holidays,
    quickOverrides,
    notices,
    collegeTimeZone,
    undefined,
    hoursConfig
  );

  const currentMinutes = zoned.currentMinutes;

  // Next Holiday Info
  const nextHolidayInfo = getDaysUntilNextHoliday(zoned.date, holidays);

  // Branches closed today by a branch-specific holiday/vacation (inclusive date range, college timezone)
  const closedBranchIds = holidays
    .filter((h) => {
      const start = h.start_date || h.startDate;
      const end = h.end_date || h.endDate || start;
      return h.is_whole_college === false && h.type !== 'exam' && zoned.dateStr >= start && zoned.dateStr <= end;
    })
    .flatMap((h) => h.branches || []);

  // Derived Room Availability
  const derivedRooms = deriveAllRoomStatuses(
    rooms,
    timetable,
    todaysHeldBookings,
    periods,
    activeDay,
    currentMinutes,
    collegeStatus.isOpen,
    quickOverrides,
    closedBranchIds
  );

  // Statistics
  const roomsFreeCount = derivedRooms.filter((r) => r.status === 'free').length;

  const currentActivePeriod = collegeStatus.activePeriod;
  const classesRunningCount =
    collegeStatus.isOpen && currentActivePeriod && !currentActivePeriod.isBreak
      ? timetable.filter(
          (s) =>
            s.day === activeDay &&
            String(s.periodId) === String(currentActivePeriod.id) &&
            s.is_published !== false &&
            !closedBranchIds.includes(s.branch) &&
            !quickOverrides.some((o) => o.type === 'cancel_class' && o.targetId === s.id)
        ).length
      : 0;

  // Room booking handlers: the database decides, every device then sees the same result.
  const handleBookRoom = async (input: {
    roomId: string;
    periodId: string | number;
    date: string;
    bookedBy: string;
    reason: string;
  }) => {
    const result = await storageService.requestBooking(input);
    setBookings(storageService.getBookings());
    if (result.ok) showToast('Booking request sent. It is held until an admin approves it.', 'success');
    return result;
  };

  const handleCancelBooking = async (id: string) => {
    const result = await storageService.cancelBooking(id);
    setBookings(storageService.getBookings());
    showToast(result.ok ? 'Booking cancelled' : result.error || 'Could not cancel the booking', result.ok ? 'success' : 'error');
    return result;
  };

  const handleDecideBooking = async (id: string, status: 'approved' | 'rejected') => {
    const result = await storageService.decideBooking(id, status);
    setBookings(storageService.getBookings());
    showToast(
      result.ok ? (status === 'approved' ? 'Booking approved' : 'Booking rejected') : result.error || 'Could not save the decision',
      result.ok ? 'success' : 'error'
    );
    return result;
  };

  const toastStyle = {
    success: 'bg-[var(--mint)] text-[#15163a]',
    error: 'bg-[var(--orange)] text-[#15163a]',
    info: 'bg-[var(--yellow)] text-[#15163a]'
  } as const;

  const bannerClass = 'border-b-2 border-[#15163a] text-[#15163a] text-sm font-semibold py-2 px-4 text-center';

  return (
    <div className="min-h-screen flex flex-col font-sans">
      <NoticeTicker notices={notices} todayStr={zoned.dateStr} />

      <TopNav
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        darkMode={darkMode}
        setDarkMode={setDarkMode}
        isSimulated={isSimulated}
        onOpenTimeMachine={() => setShowTimeMachine(true)}
      />

      {!isOnline && (
        <div role="status" className={`${bannerClass} bg-[var(--orange)] flex items-center justify-center gap-2 mt-3`}>
          <WifiOff className="w-4 h-4" />
          <span>You are offline. Showing the last saved timetable and rooms.</span>
        </div>
      )}

      {syncing && (
        <div role="status" className={`${bannerClass} bg-[var(--paper-2)] !text-[var(--ink)] mt-3`}>
          Loading the latest timetable…
        </div>
      )}
      {syncError && !syncing && (
        <div role="alert" className={`${bannerClass} bg-[var(--orange)] mt-3`}>
          Could not fully load from the database ({syncError}). Showing the last copy saved in this browser.
        </div>
      )}

      {isSimulated && (
        <div className={`${bannerClass} bg-[var(--yellow)] mt-3`}>
          <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-center gap-x-4 gap-y-1">
            <span className="flex items-center gap-2">
              <Clock className="w-4 h-4" />
              Time machine is on: {currentDayName}, {zoned.timeString} ({zoned.dateStr}, {collegeTimeZone})
            </span>
            <button
              type="button"
              onClick={() => {
                setIsSimulated(false);
                setSimulatedDate(new Date());
                showToast('Back to the real clock', 'info');
              }}
              className="font-bold underline underline-offset-2 hover:no-underline"
            >
              Back to real time
            </button>
          </div>
        </div>
      )}

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-10 space-y-8 mb-28 md:mb-8">
        {activeTab === 'today' && (
          <div className="space-y-12 animate-fade-in">
            <HeroBanner
              status={collegeStatus}
              simulatedDate={zoned.date}
              roomsFreeCount={roomsFreeCount}
              classesRunningCount={classesRunningCount}
              nextHolidayInfo={nextHolidayInfo}
              onExploreRooms={() => setActiveTab('rooms')}
              onExploreTimetable={() => setActiveTab('timetable')}
              timeZone={collegeTimeZone}
            />

            <section aria-labelledby="today-routine" className="space-y-5">
              <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3">
                <div>
                  <h2 id="today-routine" className="text-2xl sm:text-3xl font-black">
                    {activeDay} routine
                  </h2>
                  <p className="text-sm opacity-75 mt-1">
                    Every branch, period by period. The class running now is outlined in orange.
                  </p>
                </div>
                <button type="button" onClick={() => setActiveTab('timetable')} className="btn btn--paper self-start">
                  Open the full week
                </button>
              </div>

              <BranchTimetable
                branches={branches}
                periods={periods}
                timetable={timetable}
                activeDay={activeDay}
                setActiveDay={setActiveDay}
                activePeriod={collegeStatus.activePeriod}
                currentMinutes={currentMinutes}
                isOpen={collegeStatus.isOpen}
              />
            </section>
          </div>
        )}

        {activeTab === 'timetable' && (
          <div className="animate-fade-in space-y-4">
            <BranchTimetable
              branches={branches}
              periods={periods}
              timetable={timetable}
              activeDay={activeDay}
              setActiveDay={setActiveDay}
              activePeriod={collegeStatus.activePeriod}
              currentMinutes={currentMinutes}
              isOpen={collegeStatus.isOpen}
            />
          </div>
        )}

        {activeTab === 'rooms' && (
          <div className="animate-fade-in space-y-4">
            <RoomAvailability
              roomStatuses={derivedRooms}
              rooms={rooms}
              periods={periods}
              timetable={timetable}
              activeDay={activeDay}
              onBookRoom={handleBookRoom}
              onCancelBooking={handleCancelBooking}
              bookings={bookings}
              todayStr={zoned.dateStr}
              myBookingIds={storageService.getMyBookingIds()}
              bookingsEnabled={isSupabaseConfigured}
            />
          </div>
        )}

        {activeTab === 'calendar' && (
          <div className="animate-fade-in space-y-4">
            <HolidayCalendar holidays={holidays} currentDate={simulatedDate} timeZone={collegeTimeZone} />
          </div>
        )}

        {activeTab === 'admin' && (
          <div className="animate-fade-in">
            {isSupabaseConfigured && setupStatus && (!setupStatus.isReady || (setupStatus.currentUser && !setupStatus.isAdmin)) && !bypassSetupChecker ? (
              <SetupChecker
                status={setupStatus}
                onRefresh={runDatabaseProbe}
                onProceedDemo={() => setBypassSetupChecker(true)}
                isChecking={isCheckingSetup}
              />
            ) : (
              <AdminLayout
                branches={branches}
                rooms={rooms}
                periods={periods}
                timetable={timetable}
                holidays={holidays}
                notices={notices}
                quickOverrides={quickOverrides}
                bookings={bookings}
                onDecideBooking={handleDecideBooking}
                onCancelBooking={handleCancelBooking}
                onDataUpdated={(updated) => {
                  if (updated.branches) setBranches(updated.branches);
                  if (updated.rooms) setRooms(updated.rooms);
                  if (updated.periods) setPeriods(updated.periods);
                  if (updated.timetable) setTimetable(updated.timetable);
                  if (updated.holidays) setHolidays(updated.holidays);
                  if (updated.notices) setNotices(updated.notices);
                  if (updated.quickOverrides) setQuickOverrides(updated.quickOverrides);
                }}
                onSettingsUpdated={setSettings}
                onExitAdmin={() => setActiveTab('today')}
                onShowToast={showToast}
              />
            )}
          </div>
        )}
      </main>

      <TimeMachineModal
        isOpen={showTimeMachine}
        onClose={() => setShowTimeMachine(false)}
        simulatedDate={simulatedDate}
        timeZone={collegeTimeZone}
        holidays={holidays}
        onUpdateSimulatedDate={(d) => {
          setIsSimulated(true);
          setSimulatedDate(d);
          const z = getCollegeZonedTime(d, collegeTimeZone);
          showToast(`Jumped to ${z.dayName}, ${z.timeString}`, 'info');
        }}
        onResetToRealTime={() => {
          setIsSimulated(false);
          setSimulatedDate(new Date());
          showToast('Back to the real clock', 'info');
        }}
        isSimulated={isSimulated}
      />

      <div className="fixed bottom-24 md:bottom-6 right-4 z-50 flex flex-col gap-3 max-w-sm pointer-events-none" aria-live="polite">
        <AnimatePresence>
          {toasts.map((t) => (
            <motion.div
              key={t.id}
              initial={{ opacity: 0, x: 60, rotate: 3 }}
              animate={{ opacity: 1, x: 0, rotate: -1 }}
              exit={{ opacity: 0, x: 60, rotate: 3 }}
              transition={{ type: 'spring', stiffness: 320, damping: 24 }}
              className={`ticket !rounded-xl !shadow-[3px_3px_0_var(--hard)] p-3.5 pointer-events-auto flex items-start gap-3 ${toastStyle[t.type]}`}
            >
              {t.type === 'success' ? (
                <CheckCircle2 className="w-5 h-5 shrink-0" />
              ) : t.type === 'error' ? (
                <AlertCircle className="w-5 h-5 shrink-0" />
              ) : (
                <Info className="w-5 h-5 shrink-0" />
              )}
              <div className="text-sm font-bold leading-snug">{t.msg}</div>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>

      <footer className="mt-auto border-t-2 border-dashed border-[var(--ink)] py-6 text-sm no-print mb-20 md:mb-0">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div>
            <p className="font-bold">{settings.college_name}</p>
            <p className="opacity-75">Status comes from the published timetable. It is not measured by sensors.</p>
            {(settings.contact_email || settings.contact_phone || settings.contact_address) && (
              <p className="opacity-75 mt-1">
                {[settings.contact_address, settings.contact_phone, settings.contact_email].filter(Boolean).join(', ')}
              </p>
            )}
          </div>
          <div className="flex items-center gap-4 font-bold">
            <button type="button" onClick={() => setActiveTab('admin')} className="underline underline-offset-4 hover:text-[var(--orange)]">
              Admin
            </button>
            <button type="button" onClick={() => setShowTimeMachine(true)} className="underline underline-offset-4 hover:text-[var(--orange)]">
              Time machine
            </button>
          </div>
        </div>
      </footer>
    </div>
  );
}
