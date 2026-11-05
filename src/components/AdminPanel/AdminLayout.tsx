import React, { useCallback, useEffect, useState } from 'react';
import {
  Bell,
  Calendar,
  CalendarCheck,
  Clock,
  Database,
  DoorOpen,
  FileSpreadsheet,
  History,
  LogOut,
  RotateCcw,
  Settings,
  ShieldCheck,
  Table2,
  Zap,
  ArrowLeft
} from 'lucide-react';
import { UploadZone } from './UploadZone';
import { TimetableEditor } from './TimetableEditor';
import { MasterDataManager } from './MasterDataManager';
import { PeriodsManager } from './PeriodsManager';
import { SettingsManager } from './SettingsManager';
import { BookingsManager } from './BookingsManager';
import { HolidayManager } from './HolidayManager';
import { NoticeManager } from './NoticeManager';
import { QuickOverridesManager } from './QuickOverridesManager';
import { SupabaseDeployGuide } from './SupabaseDeployGuide';
import {
  Branch,
  Holiday,
  Notice,
  Period,
  QuickOverride,
  Room,
  RoomBooking,
  TimetableSlot
} from '../../types';
import { storageService, SaveResult } from '../../services/storageService';
import { supabase, isSupabaseConfigured } from '../../services/supabaseClient';

interface AdminLayoutProps {
  branches: Branch[];
  rooms: Room[];
  periods: Period[];
  timetable: TimetableSlot[];
  holidays: Holiday[];
  notices: Notice[];
  quickOverrides: QuickOverride[];
  bookings: RoomBooking[];
  onDecideBooking: (id: string, status: 'approved' | 'rejected') => Promise<{ ok: boolean; error?: string }>;
  onCancelBooking: (id: string) => Promise<{ ok: boolean; error?: string }>;
  onDataUpdated: (data: {
    branches?: Branch[];
    rooms?: Room[];
    periods?: Period[];
    timetable?: TimetableSlot[];
    holidays?: Holiday[];
    notices?: Notice[];
    quickOverrides?: QuickOverride[];
  }) => void;
  onExitAdmin: () => void;
  onSettingsUpdated?: (settings: ReturnType<typeof storageService.getSettings>) => void;
  onShowToast: (msg: string, type: 'success' | 'error' | 'info') => void;
}

type AuthState = 'checking' | 'unconfigured' | 'signed_out' | 'not_admin' | 'admin';

export const AdminLayout: React.FC<AdminLayoutProps> = ({
  branches,
  rooms,
  periods,
  timetable,
  holidays,
  notices,
  quickOverrides,
  bookings,
  onDecideBooking,
  onCancelBooking,
  onDataUpdated,
  onExitAdmin,
  onSettingsUpdated,
  onShowToast
}) => {
  // Real authorization only. Access requires a Supabase session whose profile has role = 'admin'
  // (the same check the database RLS policies enforce). There is no sign-up here and no bypass:
  // without Supabase configured the panel stays locked. Admin accounts are created by the owner
  // in the Supabase dashboard (Authentication > Users) and promoted with SQL (see README).
  const [authState, setAuthState] = useState<AuthState>(isSupabaseConfigured ? 'checking' : 'unconfigured');
  const [authError, setAuthError] = useState('');
  const [signedInEmail, setSignedInEmail] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [authLoading, setAuthLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<
    'upload' | 'timetable' | 'master_data' | 'periods' | 'holidays' | 'notices' | 'bookings' | 'settings' | 'history' | 'overrides' | 'deploy'
  >('upload');
  const [collegeSettings, setCollegeSettings] = useState(() => storageService.getSettings());
  const todayStr = new Date().toLocaleDateString('en-CA', { timeZone: collegeSettings.timezone || 'Asia/Kolkata' });
  const pendingBookings = bookings.filter((b) => b.status === 'pending' && b.date >= todayStr).length;
  const [subjects, setSubjects] = useState(() => storageService.getSubjects());
  const [uploadHistory, setUploadHistory] = useState(() => storageService.getUploadHistory());

  const isAuthenticated = authState === 'admin';

  const verifyAdmin = useCallback(async () => {
    if (!isSupabaseConfigured || !supabase) {
      setAuthState('unconfigured');
      return;
    }
    const { data, error } = await supabase.auth.getSession();
    const user = data.session?.user;
    if (error || !user) {
      setAuthState('signed_out');
      return;
    }
    setSignedInEmail(user.email || '');
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .maybeSingle();
    if (profileError) {
      setAuthError(`Could not verify your role: ${profileError.message}`);
      setAuthState('not_admin');
      return;
    }
    setAuthState(profile?.role === 'admin' ? 'admin' : 'not_admin');
  }, []);

  useEffect(() => {
    if (!isSupabaseConfigured || !supabase) return;
    void verifyAdmin();
    const { data: sub } = supabase.auth.onAuthStateChange(() => {
      void verifyAdmin();
    });
    return () => sub.subscription.unsubscribe();
  }, [verifyAdmin]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!supabase) return;
    setAuthError('');
    if (password.length < 6) {
      setAuthError('Password must be at least 6 characters.');
      return;
    }
    setAuthLoading(true);
    try {
      const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
      if (error) {
        setAuthError(error.message);
      } else {
        await verifyAdmin();
      }
    } catch (err) {
      setAuthError(err instanceof Error ? err.message : 'Authentication failed');
    } finally {
      setAuthLoading(false);
    }
  };

  const handleLogout = async () => {
    if (supabase) {
      const { error } = await supabase.auth.signOut();
      if (error) {
        onShowToast(`Sign out failed: ${error.message}`, 'error');
        return;
      }
    }
    setAuthState(isSupabaseConfigured ? 'signed_out' : 'unconfigured');
    setPassword('');
    onShowToast('Signed out of admin portal', 'info');
  };

  /** Re-read everything from storage into React state. */
  const readAll = () => ({
    branches: storageService.getBranches(),
    rooms: storageService.getRooms(),
    periods: storageService.getPeriods(),
    timetable: storageService.getTimetable(),
    holidays: storageService.getHolidays(),
    notices: storageService.getNotices(),
    quickOverrides: storageService.getQuickOverrides()
  });

  /**
   * Run a save. On failure the database is the source of truth: local state is rolled back to the
   * snapshot taken before the change, and the real error is shown.
   */
  const persist = async (run: () => Promise<SaveResult>, rollback: () => void) => {
    const before = storageService.createStateSnapshot();
    const result = await run();
    if (!result.ok) {
      storageService.restoreLocalOnly(before);
      rollback();
      onShowToast(`Change was NOT saved to the database. ${result.error}`, 'error');
    }
    return result;
  };

  const handleResetOrRefresh = async () => {
    const res = await storageService.syncFromSupabase();
    onDataUpdated(readAll());
    setSubjects(storageService.getSubjects());
    setCollegeSettings(storageService.getSettings());
    onShowToast(res.ok ? 'Reloaded the latest data from the database' : `Reload incomplete: ${res.errors.join('; ')}`, res.ok ? 'success' : 'error');
  };

  if (authState === 'checking') {
    return <div className="min-h-[50vh] flex items-center justify-center text-xs text-slate-500">Verifying administrator access…</div>;
  }

  if (authState === 'unconfigured') {
    return (
      <div className="min-h-[60vh] flex items-center justify-center p-4">
        <div role="alert" className="w-full max-w-md rounded-3xl bg-white dark:bg-slate-900 border border-amber-300 dark:border-amber-800 shadow-xl p-8 space-y-4 text-center">
          <div className="w-12 h-12 rounded-2xl bg-amber-500/10 flex items-center justify-center text-amber-600 mx-auto">
            <ShieldCheck className="w-6 h-6" />
          </div>
          <h2 className="text-lg font-bold text-slate-900 dark:text-white">Admin portal is locked</h2>
          <p className="text-xs text-slate-600 dark:text-slate-400">
            This site is not connected to a database, so administrator sign-in is unavailable. Set
            <code className="mx-1">VITE_SUPABASE_URL</code> and <code className="mx-1">VITE_SUPABASE_ANON_KEY</code>
            (in <code>.env.local</code>, or in the Vercel project settings) and redeploy.
          </p>
          <button onClick={onExitAdmin} className="text-xs font-medium text-indigo-600 dark:text-indigo-400 hover:underline">
            Return to Public Student Schedule
          </button>
        </div>
      </div>
    );
  }

  // Auth gate (real Supabase auth)
  if (!isAuthenticated) {
    const notAdmin = authState === 'not_admin';
    return (
      <div className="min-h-[75vh] flex items-center justify-center p-4">
        <div className="w-full max-w-md rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xl p-8 space-y-6">
          <div className="text-center space-y-2">
            <div className="w-12 h-12 rounded-2xl bg-indigo-600/10 flex items-center justify-center text-indigo-600 dark:text-indigo-400 mx-auto">
              <ShieldCheck className="w-6 h-6" />
            </div>
            <h2 className="text-xl font-bold text-slate-900 dark:text-white">
              {notAdmin ? 'Administrator Access Required' : 'Administrator Sign In'}
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              {notAdmin
                ? `${signedInEmail || 'This account'} is signed in but does not have the admin role. The site owner must promote it in the database (see README).`
                : 'Only accounts granted the admin role can sign in. Accounts are created by the site owner, not here.'}
            </p>
          </div>

          {notAdmin ? (
            <div className="space-y-2">
              {authError && <div role="alert" className="text-xs text-rose-600 dark:text-rose-400">{authError}</div>}
              <button onClick={() => void verifyAdmin()} className="w-full py-2.5 rounded-xl text-xs font-bold bg-indigo-600 hover:bg-indigo-500 text-white">
                Re-check my access
              </button>
              <button onClick={() => void handleLogout()} className="w-full py-2.5 rounded-xl text-xs font-semibold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200">
                Sign out
              </button>
            </div>
          ) : (
            <form onSubmit={handleLogin} className="space-y-4">
              <div>
                <label htmlFor="admin-email" className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">Email</label>
                <input
                  id="admin-email"
                  type="email"
                  required
                  autoComplete="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full px-3.5 py-2.5 text-xs rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
              <div>
                <label htmlFor="admin-password" className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">Password</label>
                <input
                  id="admin-password"
                  type="password"
                  required
                  minLength={6}
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full px-3.5 py-2.5 text-xs rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
              {authError && <div role="alert" className="text-xs text-rose-600 dark:text-rose-400">{authError}</div>}
              <button
                type="submit"
                disabled={authLoading}
                className="w-full py-2.5 rounded-xl text-xs font-bold bg-indigo-600 hover:bg-indigo-500 disabled:opacity-60 text-white shadow-lg shadow-indigo-500/20 transition"
              >
                {authLoading ? 'Please wait…' : 'Sign In'}
              </button>
            </form>
          )}

          <div className="pt-2 text-center border-t border-slate-100 dark:border-slate-800">
            <button
              onClick={onExitAdmin}
              className="text-xs font-medium text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 flex items-center gap-1.5 mx-auto"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Return to Public Student Schedule</span>
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Admin Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-200 dark:border-slate-800">
        <div>
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
            <h2 className="text-xl font-bold text-slate-900 dark:text-white">
              Academic Administration Portal
            </h2>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Manage course timetables, room assignments, holiday notices and bulk Excel synchronization
          </p>
        </div>

        <div className="flex items-center gap-2">
          {/* Reset To Factory Defaults */}
          <button
            onClick={handleResetOrRefresh}
            title="Reload the latest data from Supabase"
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold text-slate-600 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 transition"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Reload from DB</span>
          </button>

          {/* Sign Out */}
          <button
            onClick={handleLogout}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-950/40 hover:bg-rose-100 transition"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span>Sign Out</span>
          </button>
        </div>
      </div>

      {/* Tab Navigation */}
      <div className="flex items-center gap-1.5 overflow-x-auto pb-2 border-b border-slate-200 dark:border-slate-800 scrollbar-none">
        <button
          onClick={() => setActiveTab('upload')}
          className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition ${
            activeTab === 'upload'
              ? 'bg-indigo-600 text-white shadow-sm'
              : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
          }`}
        >
          <FileSpreadsheet className="w-4 h-4" />
          <span>Upload</span>
        </button>

        <button
          onClick={() => setActiveTab('timetable')}
          className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition ${
            activeTab === 'timetable'
              ? 'bg-indigo-600 text-white shadow-sm'
              : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
          }`}
        >
          <Table2 className="w-4 h-4" />
          <span>Timetable</span>
        </button>

        <button
          onClick={() => setActiveTab('master_data')}
          className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition ${
            activeTab === 'master_data'
              ? 'bg-indigo-600 text-white shadow-sm'
              : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
          }`}
        >
          <DoorOpen className="w-4 h-4" />
          <span>Rooms &amp; Master Data</span>
        </button>

        <button
          onClick={() => setActiveTab('periods')}
          className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition ${
            activeTab === 'periods'
              ? 'bg-indigo-600 text-white shadow-sm'
              : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
          }`}
        >
          <Clock className="w-4 h-4" />
          <span>Periods</span>
        </button>

        <button
          onClick={() => setActiveTab('holidays')}
          className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition ${
            activeTab === 'holidays'
              ? 'bg-indigo-600 text-white shadow-sm'
              : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
          }`}
        >
          <Calendar className="w-4 h-4" />
          <span>Holidays &amp; Vacation</span>
        </button>

        <button
          onClick={() => setActiveTab('notices')}
          className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition ${
            activeTab === 'notices'
              ? 'bg-indigo-600 text-white shadow-sm'
              : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
          }`}
        >
          <Bell className="w-4 h-4" />
          <span>Notices</span>
        </button>

        <button
          onClick={() => setActiveTab('bookings')}
          className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition ${
            activeTab === 'bookings'
              ? 'bg-indigo-600 text-white shadow-sm'
              : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
          }`}
        >
          <CalendarCheck className="w-4 h-4" />
          <span>Room Bookings{pendingBookings > 0 ? ` (${pendingBookings})` : ''}</span>
        </button>

        <button
          onClick={() => setActiveTab('settings')}
          className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition ${
            activeTab === 'settings'
              ? 'bg-indigo-600 text-white shadow-sm'
              : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
          }`}
        >
          <Settings className="w-4 h-4" />
          <span>Settings</span>
        </button>

        <button
          onClick={() => setActiveTab('history')}
          className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition ${
            activeTab === 'history'
              ? 'bg-indigo-600 text-white shadow-sm'
              : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
          }`}
        >
          <History className="w-4 h-4" />
          <span>Upload History</span>
        </button>

        <button
          onClick={() => setActiveTab('overrides')}
          className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition ${
            activeTab === 'overrides'
              ? 'bg-indigo-600 text-white shadow-sm'
              : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
          }`}
        >
          <Zap className="w-4 h-4" />
          <span>Overrides</span>
        </button>

        <button
          onClick={() => setActiveTab('deploy')}
          className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition ${
            activeTab === 'deploy'
              ? 'bg-indigo-600 text-white shadow-sm'
              : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
          }`}
        >
          <Database className="w-4 h-4" />
          <span>Database SQL</span>
        </button>
      </div>

      {/* Tab Panels */}
      <div>
        {activeTab === 'upload' && (
          <UploadZone
            branches={branches}
            rooms={rooms}
            periods={periods}
            timetable={timetable}
            holidays={holidays}
            onDataImported={(data) => {
              onDataUpdated(data);
              setUploadHistory(storageService.getUploadHistory());
            }}
            onShowToast={onShowToast}
          />
        )}

        {activeTab === 'timetable' && (
          <TimetableEditor
            subjects={subjects}
            branches={branches}
            rooms={rooms}
            periods={periods}
            timetable={timetable}
            onSaveTimetable={(updated) => {
              const prev = timetable;
              onDataUpdated({ timetable: updated });
              void persist(() => storageService.saveTimetable(updated), () => {
                storageService.saveTimetable(prev).catch(() => {});
                onDataUpdated({ timetable: prev });
              });
            }}
            onShowToast={onShowToast}
          />
        )}

        {activeTab === 'master_data' && (
          <MasterDataManager
            timetable={timetable}
            rooms={rooms}
            branches={branches}
            subjects={subjects}
            onAddSubject={(subject) => {
              const prev = subjects;
              setSubjects([...prev.filter((x) => x.id !== subject.id), subject]);
              void persist(() => storageService.addSubject(subject), () => setSubjects(prev)).then((r) => {
                if (r.ok) onShowToast(`Subject "${subject.name}" added`, 'success');
              });
            }}
            onDeleteSubject={(id) => {
              const prev = subjects;
              const prevTimetable = timetable;
              setSubjects(prev.filter((x) => x.id !== id));
              onDataUpdated({ timetable: timetable.filter((t) => storageService.resolveSubjectId(t) !== id) });
              void persist(() => storageService.deleteSubject(id), () => {
                setSubjects(prev);
                onDataUpdated({ timetable: prevTimetable });
              }).then((r) => {
                if (r.ok) onShowToast('Subject deleted', 'success');
              });
            }}
            onSaveRooms={(updated) => {
              const prev = rooms;
              onDataUpdated({ rooms: updated });
              void persist(() => storageService.saveRooms(updated), () => {
                storageService.saveRooms(prev).catch(() => {});
                onDataUpdated({ rooms: prev });
              });
            }}
            onSaveBranches={(updated, removedId) => {
              const prev = branches;
              const prevTimetable = timetable;
              onDataUpdated(
                removedId
                  ? { branches: updated, timetable: timetable.filter((t) => t.branch !== removedId) }
                  : { branches: updated }
              );
              void persist(() => storageService.saveBranches(updated), () => {
                onDataUpdated({ branches: prev, timetable: prevTimetable });
              }).then((r) => {
                if (!r.ok) return;
                if (removedId) {
                  storageService.restoreLocal('timetable', storageService.getTimetable().filter((t) => t.branch !== removedId));
                  setSubjects(storageService.getSubjects());
                }
                onShowToast(removedId ? 'Branch deleted' : 'Branch added', 'success');
              });
            }}
            onShowToast={onShowToast}
          />
        )}

        {activeTab === 'periods' && (
          <PeriodsManager
            periods={periods}
            onSavePeriods={(updated) => {
              const prev = periods;
              onDataUpdated({ periods: updated });
              void persist(() => storageService.savePeriods(updated), () => {
                storageService.savePeriods(prev).catch(() => {});
                onDataUpdated({ periods: prev });
              });
            }}
            onShowToast={onShowToast}
          />
        )}

        {activeTab === 'holidays' && (
          <HolidayManager
            holidays={holidays}
            branches={branches}
            onSaveHolidays={(updated) => {
              const prev = holidays;
              onDataUpdated({ holidays: updated });
              void persist(() => storageService.saveHolidays(updated), () => {
                storageService.saveHolidays(prev).catch(() => {});
                onDataUpdated({ holidays: prev });
              });
            }}
            onShowToast={onShowToast}
          />
        )}

        {activeTab === 'notices' && (
          <NoticeManager
            notices={notices}
            onSaveNotices={(updated) => {
              const prev = notices;
              onDataUpdated({ notices: updated });
              void persist(() => storageService.saveNotices(updated), () => {
                storageService.saveNotices(prev).catch(() => {});
                onDataUpdated({ notices: prev });
              });
            }}
            onShowToast={onShowToast}
          />
        )}

        {activeTab === 'bookings' && (
          <BookingsManager
            bookings={bookings}
            rooms={rooms}
            periods={periods}
            todayStr={todayStr}
            onDecide={onDecideBooking}
            onCancel={onCancelBooking}
          />
        )}

        {activeTab === 'settings' && (
          <SettingsManager
            settings={collegeSettings}
            onSaveSettings={(updated) => {
              const prev = collegeSettings;
              setCollegeSettings(updated);
              onSettingsUpdated?.(updated);
              void persist(() => storageService.saveSettings(updated), () => {
                setCollegeSettings(prev);
                onSettingsUpdated?.(prev);
              });
            }}
            onShowToast={onShowToast}
          />
        )}

        {activeTab === 'history' && (
          <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 shadow-sm space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200 dark:border-slate-800">
              <div>
                <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                  <History className="w-5 h-5 text-indigo-500" />
                  <span>Upload History &amp; 1-Click Rollback (Last 5 Uploads)</span>
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Inspect every Excel synchronization and instantly undo any of the last 5 uploads to restore database snapshots.
                </p>
              </div>
              <button
                onClick={() => setUploadHistory(storageService.getUploadHistory())}
                className="px-3 py-1.5 rounded-xl text-xs font-semibold bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200"
              >
                Refresh Log
              </button>
            </div>

            {uploadHistory.length === 0 ? (
              <div className="py-12 text-center text-xs text-slate-400">
                No uploads recorded yet. Upload an Excel spreadsheet from the "Upload" tab to see history and rollback snapshots here.
              </div>
            ) : (
              <div className="divide-y divide-slate-100 dark:divide-slate-800 text-xs">
                {uploadHistory.map((item) => (
                  <div key={item.id} className="py-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div>
                      <div className="font-semibold text-slate-900 dark:text-white flex items-center gap-2">
                        <span>{item.fileName}</span>
                        <span className="text-[10px] font-mono uppercase px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
                          Mode: {item.mode}
                        </span>
                        <span className="text-[10px] font-semibold px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
                          Synced
                        </span>
                      </div>
                      <div className="text-[11px] text-slate-400 mt-1">
                        {new Date(item.timestamp).toLocaleString()} · {item.counts.timetable} classes, {item.counts.rooms} rooms, {item.counts.holidays} holidays, {item.counts.periods} periods
                      </div>
                    </div>

                    {item.previousSnapshot && (
                      <button
                        onClick={() => {
                          if (window.confirm(`Undo upload "${item.fileName}" and revert data to previous snapshot?`)) {
                            void storageService.restoreSnapshot(item.previousSnapshot!).then((res) => {
                            if (res.ok) {
                              onDataUpdated({
                                timetable: storageService.getTimetable(),
                                rooms: storageService.getRooms(),
                                holidays: storageService.getHolidays(),
                                periods: storageService.getPeriods(),
                                notices: storageService.getNotices(),
                                branches: storageService.getBranches()
                              });
                              setUploadHistory(storageService.getUploadHistory());
                              onShowToast(`Successfully reverted database to snapshot before "${item.fileName}"`, 'success');
                            } else {
                              onShowToast(`Failed to revert snapshot: ${res.error}`, 'error');
                            }
                            });
                          }
                        }}
                        className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-xl text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/40 hover:bg-amber-100 border border-amber-200 dark:border-amber-900/60 transition self-start sm:self-auto"
                      >
                        <RotateCcw className="w-3.5 h-3.5" />
                        <span>Undo This Upload</span>
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {activeTab === 'overrides' && (
          <QuickOverridesManager
            overrides={quickOverrides}
            rooms={rooms}
            timetable={timetable}
            onAddOverride={(item) => {
              void storageService.addQuickOverride(item).then(({ result }) => {
                onDataUpdated({ quickOverrides: storageService.getQuickOverrides() });
                if (!result.ok) onShowToast(`NOT saved to the database. ${result.error}`, 'error');
              });
            }}
            onDeleteOverride={(id) => {
              void storageService.deleteQuickOverride(id).then((result) => {
                onDataUpdated({ quickOverrides: storageService.getQuickOverrides() });
                if (!result.ok) onShowToast(`NOT removed from the database. ${result.error}`, 'error');
              });
            }}
            onShowToast={onShowToast}
          />
        )}

        {activeTab === 'deploy' && <SupabaseDeployGuide />}
      </div>
    </div>
  );
};
