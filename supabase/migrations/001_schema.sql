-- ==============================================================================
-- College Connect: Unified Idempotent Database Schema & Security Migration
-- File: supabase/migrations/001_schema.sql
-- Run this ONCE in the Supabase Dashboard -> SQL Editor
-- ==============================================================================

-- 1. EXTENSIONS
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "btree_gist";

-- Helper function for updated_at timestamps
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

-- 2. BRANCHES TABLE
CREATE TABLE IF NOT EXISTS public.branches (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  short_name TEXT NOT NULL,
  code TEXT NOT NULL,
  color TEXT NOT NULL DEFAULT '#4F46E5',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

DROP TRIGGER IF EXISTS trg_branches_updated_at ON public.branches;
CREATE TRIGGER trg_branches_updated_at
  BEFORE UPDATE ON public.branches
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- 3. SEMESTERS TABLE
CREATE TABLE IF NOT EXISTS public.semesters (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  number INT NOT NULL CHECK (number >= 1 AND number <= 8),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

DROP TRIGGER IF EXISTS trg_semesters_updated_at ON public.semesters;
CREATE TRIGGER trg_semesters_updated_at
  BEFORE UPDATE ON public.semesters
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- 4. PROFILES TABLE (Linked to auth.users)
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT,
  role TEXT NOT NULL CHECK (role IN ('student', 'admin')) DEFAULT 'student',
  branch_id TEXT REFERENCES public.branches(id) ON DELETE SET NULL,
  semester_id TEXT REFERENCES public.semesters(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_profiles_role ON public.profiles(role);

DROP TRIGGER IF EXISTS trg_profiles_updated_at ON public.profiles;
CREATE TRIGGER trg_profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- 5. COLLEGE SETTINGS TABLE (Single configuration row)
CREATE TABLE IF NOT EXISTS public.settings (
  id TEXT PRIMARY KEY DEFAULT 'current' CHECK (id = 'current'),
  college_name TEXT NOT NULL DEFAULT 'College Connect',
  logo_url TEXT,
  timezone TEXT NOT NULL DEFAULT 'Asia/Kolkata',
  academic_year TEXT NOT NULL DEFAULT '',
  working_days TEXT[] NOT NULL DEFAULT ARRAY['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'],
  contact_address TEXT,
  contact_phone TEXT,
  contact_email TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

DROP TRIGGER IF EXISTS trg_settings_updated_at ON public.settings;
CREATE TRIGGER trg_settings_updated_at
  BEFORE UPDATE ON public.settings
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- 6. PROFESSORS TABLE
CREATE TABLE IF NOT EXISTS public.professors (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT,
  department TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

DROP TRIGGER IF EXISTS trg_professors_updated_at ON public.professors;
CREATE TRIGGER trg_professors_updated_at
  BEFORE UPDATE ON public.professors
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- 7. SUBJECTS TABLE
CREATE TABLE IF NOT EXISTS public.subjects (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  code TEXT NOT NULL,
  branch_id TEXT REFERENCES public.branches(id) ON DELETE CASCADE,
  semester_id TEXT REFERENCES public.semesters(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

DROP TRIGGER IF EXISTS trg_subjects_updated_at ON public.subjects;
CREATE TRIGGER trg_subjects_updated_at
  BEFORE UPDATE ON public.subjects
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- 8. CLASSROOMS TABLE
CREATE TABLE IF NOT EXISTS public.classrooms (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('classroom', 'lab', 'hall', 'workshop')),
  capacity INT NOT NULL DEFAULT 60,
  floor INT NOT NULL DEFAULT 0,
  building TEXT DEFAULT 'Academic Block A',
  is_under_maintenance BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

DROP TRIGGER IF EXISTS trg_classrooms_updated_at ON public.classrooms;
CREATE TRIGGER trg_classrooms_updated_at
  BEFORE UPDATE ON public.classrooms
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- 9. PERIODS TABLE (Customizable schedule slots and breaks)
CREATE TABLE IF NOT EXISTS public.periods (
  id TEXT PRIMARY KEY,
  period_number INT NOT NULL,
  start_time TIME NOT NULL,
  end_time TIME NOT NULL,
  label TEXT NOT NULL,
  is_break BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_periods_number ON public.periods(period_number);

DROP TRIGGER IF EXISTS trg_periods_updated_at ON public.periods;
CREATE TRIGGER trg_periods_updated_at
  BEFORE UPDATE ON public.periods
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- 10. TIMETABLE ENTRIES TABLE (Core routine with DB exclusion constraints)
CREATE TABLE IF NOT EXISTS public.timetable_entries (
  id TEXT PRIMARY KEY DEFAULT ('tte_' || uuid_generate_v4()::text),
  branch_id TEXT NOT NULL REFERENCES public.branches(id) ON DELETE CASCADE,
  semester_id TEXT NOT NULL REFERENCES public.semesters(id) ON DELETE CASCADE,
  subject_id TEXT NOT NULL REFERENCES public.subjects(id) ON DELETE CASCADE,
  professor_id TEXT NOT NULL REFERENCES public.professors(id) ON DELETE CASCADE,
  classroom_id TEXT NOT NULL REFERENCES public.classrooms(id) ON DELETE CASCADE,
  day_of_week INT NOT NULL CHECK (day_of_week >= 1 AND day_of_week <= 7), -- 1=Mon ... 7=Sun
  start_time TIME NOT NULL,
  end_time TIME NOT NULL,
  class_type TEXT NOT NULL CHECK (class_type IN ('Lecture', 'Lab', 'Tutorial')),
  is_published BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT chk_time_order CHECK (start_time < end_time)
);

CREATE INDEX IF NOT EXISTS idx_tte_branch_sem_day ON public.timetable_entries(branch_id, semester_id, day_of_week);
CREATE INDEX IF NOT EXISTS idx_tte_classroom ON public.timetable_entries(classroom_id, day_of_week);
CREATE INDEX IF NOT EXISTS idx_tte_professor ON public.timetable_entries(professor_id, day_of_week);

-- Database-enforced Exclusion Constraints for room and professor clashes
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'no_classroom_overlap'
  ) THEN
    ALTER TABLE public.timetable_entries
    ADD CONSTRAINT no_classroom_overlap
    EXCLUDE USING gist (
      classroom_id WITH =,
      day_of_week WITH =,
      tsrange(('2000-01-01'::date + start_time), ('2000-01-01'::date + end_time)) WITH &&
    ) WHERE (is_published = TRUE);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'no_professor_overlap'
  ) THEN
    ALTER TABLE public.timetable_entries
    ADD CONSTRAINT no_professor_overlap
    EXCLUDE USING gist (
      professor_id WITH =,
      day_of_week WITH =,
      tsrange(('2000-01-01'::date + start_time), ('2000-01-01'::date + end_time)) WITH &&
    ) WHERE (is_published = TRUE);
  END IF;
END $$;

DROP TRIGGER IF EXISTS trg_timetable_entries_updated_at ON public.timetable_entries;
CREATE TRIGGER trg_timetable_entries_updated_at
  BEFORE UPDATE ON public.timetable_entries
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- 11. TIMETABLE EXCEPTIONS TABLE (Temporary single-date overrides/swaps)
CREATE TABLE IF NOT EXISTS public.timetable_exceptions (
  id TEXT PRIMARY KEY DEFAULT ('tex_' || uuid_generate_v4()::text),
  timetable_entry_id TEXT NOT NULL REFERENCES public.timetable_entries(id) ON DELETE CASCADE,
  exception_date DATE NOT NULL,
  action TEXT NOT NULL CHECK (action IN ('cancelled', 'rescheduled', 'room_swap')),
  new_classroom_id TEXT REFERENCES public.classrooms(id) ON DELETE SET NULL,
  new_start_time TIME,
  new_end_time TIME,
  reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_tte_exceptions_date ON public.timetable_exceptions(exception_date);

DROP TRIGGER IF EXISTS trg_timetable_exceptions_updated_at ON public.timetable_exceptions;
CREATE TRIGGER trg_timetable_exceptions_updated_at
  BEFORE UPDATE ON public.timetable_exceptions
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- 12. HOLIDAYS TABLE
CREATE TABLE IF NOT EXISTS public.holidays (
  id TEXT PRIMARY KEY DEFAULT ('hol_' || uuid_generate_v4()::text),
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  title TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('holiday', 'vacation', 'exam')),
  greeting TEXT,
  banner_url TEXT,
  is_whole_college BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT chk_holiday_date_order CHECK (start_date <= end_date)
);

CREATE INDEX IF NOT EXISTS idx_holidays_dates ON public.holidays(start_date, end_date);

DROP TRIGGER IF EXISTS trg_holidays_updated_at ON public.holidays;
CREATE TRIGGER trg_holidays_updated_at
  BEFORE UPDATE ON public.holidays
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- 13. HOLIDAY BRANCHES (For branch-specific holidays)
CREATE TABLE IF NOT EXISTS public.holiday_branches (
  holiday_id TEXT NOT NULL REFERENCES public.holidays(id) ON DELETE CASCADE,
  branch_id TEXT NOT NULL REFERENCES public.branches(id) ON DELETE CASCADE,
  PRIMARY KEY (holiday_id, branch_id)
);

-- 14. ANNOUNCEMENTS TABLE (Urgent notices, emergency closures)
CREATE TABLE IF NOT EXISTS public.announcements (
  id TEXT PRIMARY KEY DEFAULT ('ann_' || uuid_generate_v4()::text),
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  kind TEXT NOT NULL CHECK (kind IN ('academic', 'exam', 'cultural', 'administrative', 'emergency')) DEFAULT 'academic',
  is_emergency BOOLEAN NOT NULL DEFAULT FALSE,
  closes_college BOOLEAN NOT NULL DEFAULT FALSE,
  branch_id TEXT REFERENCES public.branches(id) ON DELETE SET NULL, -- NULL = All branches
  starts_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_announcements_time ON public.announcements(starts_at, expires_at);

DROP TRIGGER IF EXISTS trg_announcements_updated_at ON public.announcements;
CREATE TRIGGER trg_announcements_updated_at
  BEFORE UPDATE ON public.announcements
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- 15. UPLOAD HISTORY TABLE (Audit log + snapshot for 5-level undo)
CREATE TABLE IF NOT EXISTS public.upload_history (
  id TEXT PRIMARY KEY DEFAULT ('up_' || uuid_generate_v4()::text),
  uploaded_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  file_name TEXT NOT NULL,
  row_counts JSONB NOT NULL DEFAULT '{}'::jsonb,
  status TEXT NOT NULL CHECK (status IN ('success', 'failed', 'reverted')) DEFAULT 'success',
  snapshot JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 16. NOTIFICATION PREFERENCES TABLE
CREATE TABLE IF NOT EXISTS public.notification_preferences (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  notify_timetable_changes BOOLEAN NOT NULL DEFAULT TRUE,
  notify_emergencies BOOLEAN NOT NULL DEFAULT TRUE,
  notify_holidays BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ==============================================================================
-- 17. SECURITY DEFINER FUNCTIONS & TRIGGERS
-- ==============================================================================

-- Admin check function used by all RLS policies
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN LANGUAGE sql SECURITY DEFINER SET search_path = public STABLE AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND role = 'admin'
  );
$$;

-- Trigger: Automatically create a student profile on new auth signup
-- CRITICAL: Role defaults strictly to 'student', never trusting client metadata.
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, role)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', SPLIT_PART(NEW.email, '@', 1)),
    'student'
  )
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO public.notification_preferences (id)
  VALUES (NEW.id)
  ON CONFLICT (id) DO NOTHING;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Trigger: Guard profiles.role from being escalated by students
CREATE OR REPLACE FUNCTION public.protect_profile_role()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.role <> OLD.role THEN
    -- If called through an active client session that is not already admin, reject
    IF auth.uid() IS NOT NULL AND NOT public.is_admin() THEN
      RAISE EXCEPTION 'Access Denied: Only administrators can modify user roles';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_guard_profile_role ON public.profiles;
CREATE TRIGGER trg_guard_profile_role
  BEFORE UPDATE OF role ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.protect_profile_role();

-- ==============================================================================
-- 18. ROW LEVEL SECURITY (RLS) POLICIES
-- ==============================================================================

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.branches ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.semesters ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.professors ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subjects ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.classrooms ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.periods ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.timetable_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.timetable_exceptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.holidays ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.holiday_branches ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.announcements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.upload_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notification_preferences ENABLE ROW LEVEL SECURITY;

-- Drop all existing policies to allow clean re-runs
DROP POLICY IF EXISTS "Public can view published profiles" ON public.profiles;
DROP POLICY IF EXISTS "Users can view own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can update own profile name and branch" ON public.profiles;
DROP POLICY IF EXISTS "Admins have full access to profiles" ON public.profiles;

DROP POLICY IF EXISTS "Public can read settings" ON public.settings;
DROP POLICY IF EXISTS "Admins can update settings" ON public.settings;

DROP POLICY IF EXISTS "Public can read branches" ON public.branches;
DROP POLICY IF EXISTS "Admins can manage branches" ON public.branches;

DROP POLICY IF EXISTS "Public can read semesters" ON public.semesters;
DROP POLICY IF EXISTS "Admins can manage semesters" ON public.semesters;

DROP POLICY IF EXISTS "Public can read professors" ON public.professors;
DROP POLICY IF EXISTS "Admins can manage professors" ON public.professors;

DROP POLICY IF EXISTS "Public can read subjects" ON public.subjects;
DROP POLICY IF EXISTS "Admins can manage subjects" ON public.subjects;

DROP POLICY IF EXISTS "Public can read classrooms" ON public.classrooms;
DROP POLICY IF EXISTS "Admins can manage classrooms" ON public.classrooms;

DROP POLICY IF EXISTS "Public can read periods" ON public.periods;
DROP POLICY IF EXISTS "Admins can manage periods" ON public.periods;

DROP POLICY IF EXISTS "Public can view published timetable" ON public.timetable_entries;
DROP POLICY IF EXISTS "Admins can manage timetable entries" ON public.timetable_entries;

DROP POLICY IF EXISTS "Public can read timetable exceptions" ON public.timetable_exceptions;
DROP POLICY IF EXISTS "Admins can manage timetable exceptions" ON public.timetable_exceptions;

DROP POLICY IF EXISTS "Public can read holidays" ON public.holidays;
DROP POLICY IF EXISTS "Admins can manage holidays" ON public.holidays;

DROP POLICY IF EXISTS "Public can read holiday branches" ON public.holiday_branches;
DROP POLICY IF EXISTS "Admins can manage holiday branches" ON public.holiday_branches;

DROP POLICY IF EXISTS "Public can read active announcements" ON public.announcements;
DROP POLICY IF EXISTS "Admins can manage announcements" ON public.announcements;

DROP POLICY IF EXISTS "Admins can manage upload history" ON public.upload_history;

DROP POLICY IF EXISTS "Users can manage own notification preferences" ON public.notification_preferences;
DROP POLICY IF EXISTS "Admins can view notification preferences" ON public.notification_preferences;

-- --- Policies Implementation ---

-- Profiles:
CREATE POLICY "Users can view own profile"
  ON public.profiles FOR SELECT
  USING (auth.uid() = id OR public.is_admin());

CREATE POLICY "Users can update own profile name and branch"
  ON public.profiles FOR UPDATE
  USING (auth.uid() = id OR public.is_admin())
  WITH CHECK (auth.uid() = id OR public.is_admin());

CREATE POLICY "Admins have full access to profiles"
  ON public.profiles FOR ALL
  TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- Settings:
CREATE POLICY "Public can read settings"
  ON public.settings FOR SELECT
  USING (true);

CREATE POLICY "Admins can update settings"
  ON public.settings FOR ALL
  TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- Master Data:
CREATE POLICY "Public can read branches" ON public.branches FOR SELECT USING (true);
CREATE POLICY "Admins can manage branches" ON public.branches FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());

CREATE POLICY "Public can read semesters" ON public.semesters FOR SELECT USING (true);
CREATE POLICY "Admins can manage semesters" ON public.semesters FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());

CREATE POLICY "Public can read professors" ON public.professors FOR SELECT USING (true);
CREATE POLICY "Admins can manage professors" ON public.professors FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());

CREATE POLICY "Public can read subjects" ON public.subjects FOR SELECT USING (true);
CREATE POLICY "Admins can manage subjects" ON public.subjects FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());

CREATE POLICY "Public can read classrooms" ON public.classrooms FOR SELECT USING (true);
CREATE POLICY "Admins can manage classrooms" ON public.classrooms FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());

CREATE POLICY "Public can read periods" ON public.periods FOR SELECT USING (true);
CREATE POLICY "Admins can manage periods" ON public.periods FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());

-- Timetable entries: Everyone can read published timetable entries, admins can see drafts and manage
CREATE POLICY "Public can view published timetable"
  ON public.timetable_entries FOR SELECT
  USING (is_published = TRUE OR public.is_admin());

CREATE POLICY "Admins can manage timetable entries"
  ON public.timetable_entries FOR ALL
  TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- Timetable exceptions:
CREATE POLICY "Public can read timetable exceptions" ON public.timetable_exceptions FOR SELECT USING (true);
CREATE POLICY "Admins can manage timetable exceptions" ON public.timetable_exceptions FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());

-- Holidays:
CREATE POLICY "Public can read holidays" ON public.holidays FOR SELECT USING (true);
CREATE POLICY "Admins can manage holidays" ON public.holidays FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());

CREATE POLICY "Public can read holiday branches" ON public.holiday_branches FOR SELECT USING (true);
CREATE POLICY "Admins can manage holiday branches" ON public.holiday_branches FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());

-- Announcements:
CREATE POLICY "Public can read active announcements" ON public.announcements FOR SELECT
  USING ((starts_at <= NOW() AND expires_at > NOW()) OR public.is_admin());
CREATE POLICY "Admins can manage announcements" ON public.announcements FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());

-- Upload history:
CREATE POLICY "Admins can manage upload history" ON public.upload_history FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());

-- Notification preferences:
CREATE POLICY "Users can manage own notification preferences"
  ON public.notification_preferences FOR ALL
  TO authenticated
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- ==============================================================================
-- 19. REALTIME PUBLICATION
-- ==============================================================================
DO $$
DECLARE
  t TEXT;
BEGIN
  -- Supabase projects ship with this publication; create it only on plain Postgres.
  IF NOT EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
    CREATE PUBLICATION supabase_realtime;
  END IF;

  -- Add each table only if it is not already published, so the script can be re-run safely.
  FOREACH t IN ARRAY ARRAY['timetable_entries','timetable_exceptions','holidays','holiday_branches',
                           'announcements','periods','classrooms','branches','settings']
  LOOP
    IF NOT EXISTS (
      SELECT 1 FROM pg_publication_tables
      WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = t
    ) THEN
      EXECUTE format('ALTER PUBLICATION supabase_realtime ADD TABLE public.%I', t);
    END IF;
  END LOOP;
END $$;

-- ==============================================================================
-- 20. REFERENCE DATA ONLY (settings row + semester list the schema needs).
--     No sample branches, rooms, subjects, faculty or timetable are created. Add your own in the Admin Portal.
-- ==============================================================================

-- Settings
INSERT INTO public.settings (id, college_name, timezone, academic_year)
VALUES ('current', 'College Connect', 'Asia/Kolkata', '')
ON CONFLICT (id) DO UPDATE SET updated_at = NOW();

-- Semesters
INSERT INTO public.semesters (id, name, number) VALUES
  ('SEM1', 'Semester 1', 1),
  ('SEM2', 'Semester 2', 2),
  ('SEM3', 'Semester 3', 3),
  ('SEM4', 'Semester 4', 4),
  ('SEM5', 'Semester 5', 5),
  ('SEM6', 'Semester 6', 6),
  ('SEM7', 'Semester 7', 7),
  ('SEM8', 'Semester 8', 8)
ON CONFLICT (id) DO NOTHING;


-- ==============================================================================
-- INSTRUCTIONS TO CREATE YOUR FIRST ADMIN USER:
-- ==============================================================================
-- 1. Sign up a new user via the College Connect App (or Supabase Dashboard -> Authentication -> Users -> Add User).
-- 2. Run this command in the Supabase SQL editor:
--
--    UPDATE public.profiles
--    SET role = 'admin'
--    WHERE id = (SELECT id FROM auth.users WHERE email = 'your_admin_email@example.com');
--
-- 3. You can verify your admin status with:
--    SELECT id, full_name, role FROM public.profiles WHERE role = 'admin';
-- ==============================================================================
