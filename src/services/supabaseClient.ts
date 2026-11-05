import { createClient, SupabaseClient, User } from '@supabase/supabase-js';
import { UserProfile } from '../types';

const getStoredConfig = () => {
  const envUrl = import.meta.env.VITE_SUPABASE_URL as string | undefined;
  const envKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

  let localUrl = '';
  let localKey = '';
  try {
    localUrl = localStorage.getItem('collegeconnect_supabase_url') || '';
    localKey = localStorage.getItem('collegeconnect_supabase_anon_key') || '';
  } catch {
    // ignore
  }

  const effectiveUrl = (envUrl && !envUrl.includes('your-project') && !envUrl.includes('placeholder'))
    ? envUrl
    : localUrl;

  const effectiveKey = (envKey && !envKey.includes('your-anon') && !envKey.includes('placeholder'))
    ? envKey
    : localKey;

  return {
    url: effectiveUrl ? effectiveUrl.trim() : '',
    anonKey: effectiveKey ? effectiveKey.trim() : '',
    isCustom: Boolean(localUrl && (!envUrl || envUrl.includes('your-project')))
  };
};

const activeConfig = getStoredConfig();

export let isSupabaseConfigured = Boolean(
  activeConfig.url && 
  activeConfig.anonKey && 
  activeConfig.url.trim() !== '' && 
  activeConfig.anonKey.trim() !== '' &&
  !activeConfig.url.includes('placeholder') &&
  !activeConfig.url.includes('your-project')
);

export let supabase: SupabaseClient | null = isSupabaseConfigured
  ? createClient(activeConfig.url, activeConfig.anonKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true
      }
    })
  : null;

export function saveCustomSupabaseConfig(url: string, anonKey: string): boolean {
  try {
    localStorage.setItem('collegeconnect_supabase_url', url.trim());
    localStorage.setItem('collegeconnect_supabase_anon_key', anonKey.trim());
    isSupabaseConfigured = true;
    supabase = createClient(url.trim(), anonKey.trim(), {
      auth: {
        persistSession: true,
        autoRefreshToken: true
      }
    });
    return true;
  } catch (err) {
    console.error('Failed to save Supabase config in localStorage', err);
    return false;
  }
}

export function clearCustomSupabaseConfig(): void {
  try {
    localStorage.removeItem('collegeconnect_supabase_url');
    localStorage.removeItem('collegeconnect_supabase_anon_key');
    const fallback = getStoredConfig();
    if (fallback.url && fallback.anonKey) {
      supabase = createClient(fallback.url, fallback.anonKey);
      isSupabaseConfigured = true;
    } else {
      supabase = null;
      isSupabaseConfigured = false;
    }
  } catch (err) {
    console.error('Failed to clear Supabase config', err);
  }
}

export function getActiveSupabaseConfig() {
  return getStoredConfig();
}


export const REQUIRED_TABLES = [
  'settings',
  'branches',
  'semesters',
  'professors',
  'subjects',
  'classrooms',
  'periods',
  'timetable_entries',
  'timetable_exceptions',
  'holidays',
  'holiday_branches',
  'announcements',
  'room_bookings',
  'upload_history',
  'notification_preferences',
  'profiles'
];

export interface SetupStatus {
  isConfigured: boolean;
  missingEnvVars: string[];
  missingTables: string[];
  checkedTables: string[];
  isReady: boolean;
  error?: string;
  currentUser?: User | null;
  currentProfile?: UserProfile | null;
  isAdmin: boolean;
}

// Import the raw schema for 1-click clipboard copying in SetupChecker and SupabaseDeployGuide
// @ts-ignore
import rawSchema from '../../supabase/migrations/001_schema.sql?raw';
// @ts-ignore
import rawBookings from '../../supabase/migrations/002_room_bookings.sql?raw';
// Both scripts, in order, so "Copy SQL" gives the complete database setup.
export const SUPABASE_SQL_SCHEMA: string = `${rawSchema || ''}\n\n${rawBookings || ''}`;

export async function checkDatabaseSetup(): Promise<SetupStatus> {
  const current = getStoredConfig();
  const missingEnvVars: string[] = [];
  if (!current.url || current.url.trim() === '' || current.url.includes('your-project')) {
    missingEnvVars.push('VITE_SUPABASE_URL');
  }
  if (!current.anonKey || current.anonKey.trim() === '' || current.anonKey.includes('your-anon')) {
    missingEnvVars.push('VITE_SUPABASE_ANON_KEY');
  }

  if (missingEnvVars.length > 0 || !supabase) {
    return {
      isConfigured: false,
      missingEnvVars,
      missingTables: REQUIRED_TABLES,
      checkedTables: [],
      isReady: false,
      isAdmin: false
    };
  }

  const missingTables: string[] = [];
  const checkedTables: string[] = [];
  let probeError: string | undefined;

  // Probe each required table concurrently
  await Promise.all(
    REQUIRED_TABLES.map(async (table) => {
      try {
        const { error } = await supabase!
          .from(table)
          .select('*', { count: 'exact', head: true })
          .limit(1);

        if (error) {
          // Check for PostgREST / Postgres "relation does not exist" or permission issue
          const msg = (error.message || '').toLowerCase();
          const details = (error.details || '').toLowerCase();
          if (
            error.code === '42P01' ||
            msg.includes('does not exist') ||
            details.includes('does not exist') ||
            error.code === 'PGRST205'
          ) {
            missingTables.push(table);
          } else {
            // Table might exist but is empty or restricted
            checkedTables.push(table);
          }
        } else {
          checkedTables.push(table);
        }
      } catch (err: any) {
        probeError = err.message;
        missingTables.push(table);
      }
    })
  );

  // Check auth and current profile role
  let currentUser: User | null = null;
  let currentProfile: UserProfile | null = null;
  let isAdmin = false;

  try {
    const { data: { user } } = await supabase.auth.getUser();
    currentUser = user;
    if (user) {
      const { data: profile } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .maybeSingle();

      if (profile) {
        currentProfile = profile as UserProfile;
        isAdmin = profile.role === 'admin';
      }
    }
  } catch {
    // Auth check error handled gracefully
  }

  const isReady = missingTables.length === 0;

  return {
    isConfigured: true,
    missingEnvVars: [],
    missingTables,
    checkedTables,
    isReady,
    error: probeError,
    currentUser,
    currentProfile,
    isAdmin
  };
}
