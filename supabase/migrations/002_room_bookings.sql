-- ==============================================================================
-- College Connect: shared room bookings, hours configuration.
-- Run AFTER 001_schema.sql, in the Supabase SQL Editor. Safe to run again.
-- ==============================================================================

-- 1. Opening hours (working days already live in settings.working_days)
ALTER TABLE public.settings ADD COLUMN IF NOT EXISTS opening_time TEXT NOT NULL DEFAULT '08:30';
ALTER TABLE public.settings ADD COLUMN IF NOT EXISTS closing_time TEXT NOT NULL DEFAULT '17:00';

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_settings_hours') THEN
    ALTER TABLE public.settings ADD CONSTRAINT chk_settings_hours CHECK (
      opening_time ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'
      AND closing_time ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'
      AND opening_time < closing_time
    );
  END IF;
END $$;

-- 2. Bookings. Anyone may ask for a room (through request_room_booking below); an admin approves or rejects.
CREATE TABLE IF NOT EXISTS public.room_bookings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id TEXT NOT NULL REFERENCES public.classrooms(id) ON DELETE CASCADE,
  period_id TEXT NOT NULL REFERENCES public.periods(id) ON DELETE CASCADE,
  booking_date DATE NOT NULL,
  booked_by TEXT NOT NULL CHECK (char_length(btrim(booked_by)) BETWEEN 1 AND 80),
  reason TEXT NOT NULL CHECK (char_length(btrim(reason)) BETWEEN 1 AND 200),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'cancelled')),
  decided_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  decided_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- The database itself refuses a second pending/approved booking for the same room, period and date,
-- even when two people press "Book" at the same instant on different devices.
CREATE UNIQUE INDEX IF NOT EXISTS uq_room_bookings_active
  ON public.room_bookings (room_id, period_id, booking_date)
  WHERE status IN ('pending', 'approved');

CREATE INDEX IF NOT EXISTS idx_room_bookings_date ON public.room_bookings (booking_date, status);

DROP TRIGGER IF EXISTS trg_room_bookings_updated_at ON public.room_bookings;
CREATE TRIGGER trg_room_bookings_updated_at
  BEFORE UPDATE ON public.room_bookings
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Secret that lets the person who made a booking cancel it later from the same browser.
CREATE TABLE IF NOT EXISTS public.room_booking_tokens (
  booking_id UUID PRIMARY KEY REFERENCES public.room_bookings(id) ON DELETE CASCADE,
  token TEXT NOT NULL
);

ALTER TABLE public.room_bookings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.room_booking_tokens ENABLE ROW LEVEL SECURITY;  -- no policies: only the functions below can touch it

DROP POLICY IF EXISTS room_bookings_read ON public.room_bookings;
CREATE POLICY room_bookings_read ON public.room_bookings FOR SELECT USING (TRUE);

DROP POLICY IF EXISTS room_bookings_admin_all ON public.room_bookings;
CREATE POLICY room_bookings_admin_all ON public.room_bookings FOR ALL
  USING (public.is_admin()) WITH CHECK (public.is_admin());

REVOKE ALL ON public.room_booking_tokens FROM anon, authenticated;
-- Everyone can read bookings (the room board needs them). Writes by anyone but an admin are refused by
-- row level security; visitors book and cancel only through the functions below.
REVOKE ALL ON public.room_bookings FROM anon, authenticated;
GRANT SELECT ON public.room_bookings TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.room_bookings TO authenticated;

-- 3. Request a booking. All checks run inside the database, so no client can skip them.
CREATE OR REPLACE FUNCTION public.request_room_booking(
  p_room_id TEXT, p_period_id TEXT, p_date DATE, p_booked_by TEXT, p_reason TEXT
) RETURNS JSON
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_tz TEXT;
  v_days TEXT[];
  v_now TIMESTAMP;
  v_today DATE;
  v_dow INT;
  v_room public.classrooms%ROWTYPE;
  v_period public.periods%ROWTYPE;
  v_name TEXT := btrim(COALESCE(p_booked_by, ''));
  v_reason TEXT := btrim(COALESCE(p_reason, ''));
  v_id UUID;
  v_token TEXT;
BEGIN
  SELECT timezone, working_days INTO v_tz, v_days FROM public.settings WHERE id = 'current';
  v_tz := COALESCE(v_tz, 'Asia/Kolkata');
  v_now := now() AT TIME ZONE v_tz;
  v_today := v_now::date;

  IF char_length(v_name) NOT BETWEEN 1 AND 80 THEN RAISE EXCEPTION 'INVALID_NAME'; END IF;
  IF char_length(v_reason) NOT BETWEEN 1 AND 200 THEN RAISE EXCEPTION 'INVALID_REASON'; END IF;
  IF p_date IS NULL OR p_date < v_today OR p_date > v_today + 60 THEN RAISE EXCEPTION 'DATE_OUT_OF_RANGE'; END IF;

  SELECT * INTO v_room FROM public.classrooms WHERE id = p_room_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'ROOM_NOT_FOUND'; END IF;
  IF v_room.is_under_maintenance THEN RAISE EXCEPTION 'ROOM_UNDER_MAINTENANCE'; END IF;

  SELECT * INTO v_period FROM public.periods WHERE id = p_period_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'PERIOD_NOT_FOUND'; END IF;
  IF v_period.is_break THEN RAISE EXCEPTION 'PERIOD_IS_BREAK'; END IF;
  IF p_date = v_today AND v_now::time >= v_period.end_time THEN RAISE EXCEPTION 'PERIOD_ALREADY_OVER'; END IF;

  v_dow := EXTRACT(ISODOW FROM p_date)::INT;
  IF NOT ((ARRAY['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday','Sunday'])[v_dow] = ANY (v_days)) THEN
    RAISE EXCEPTION 'NOT_A_WORKING_DAY';
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.holidays h
    WHERE h.is_whole_college AND h.type IN ('holiday', 'vacation') AND p_date BETWEEN h.start_date AND h.end_date
  ) THEN RAISE EXCEPTION 'COLLEGE_CLOSED'; END IF;

  IF EXISTS (
    SELECT 1 FROM public.timetable_entries t
    WHERE t.classroom_id = p_room_id AND t.is_published AND t.day_of_week = v_dow
      AND t.start_time < v_period.end_time AND t.end_time > v_period.start_time
  ) THEN RAISE EXCEPTION 'ROOM_HAS_CLASS'; END IF;

  IF (SELECT count(*) FROM public.room_bookings
      WHERE status = 'pending' AND lower(btrim(booked_by)) = lower(v_name)) >= 5 THEN
    RAISE EXCEPTION 'TOO_MANY_PENDING';
  END IF;

  BEGIN
    INSERT INTO public.room_bookings (room_id, period_id, booking_date, booked_by, reason)
    VALUES (p_room_id, p_period_id, p_date, v_name, v_reason)
    RETURNING id INTO v_id;
  EXCEPTION WHEN unique_violation THEN
    RAISE EXCEPTION 'ROOM_ALREADY_BOOKED';
  END;

  v_token := replace(gen_random_uuid()::text, '-', '') || replace(gen_random_uuid()::text, '-', '');
  INSERT INTO public.room_booking_tokens (booking_id, token) VALUES (v_id, v_token);

  RETURN json_build_object('id', v_id, 'token', v_token);
END;
$$;

-- 4. Cancel: the admin, or whoever holds the secret from the original request.
CREATE OR REPLACE FUNCTION public.cancel_room_booking(p_id UUID, p_token TEXT DEFAULT NULL)
RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_admin BOOLEAN := COALESCE(public.is_admin(), FALSE);
BEGIN
  IF NOT v_admin AND NOT EXISTS (
    SELECT 1 FROM public.room_booking_tokens WHERE booking_id = p_id AND token = p_token AND p_token IS NOT NULL
  ) THEN RAISE EXCEPTION 'NOT_ALLOWED'; END IF;

  UPDATE public.room_bookings
     SET status = 'cancelled',
         decided_by = CASE WHEN v_admin THEN auth.uid() ELSE decided_by END,
         decided_at = CASE WHEN v_admin THEN now() ELSE decided_at END
   WHERE id = p_id AND status IN ('pending', 'approved');
  IF NOT FOUND THEN RAISE EXCEPTION 'BOOKING_NOT_ACTIVE'; END IF;
END;
$$;

-- 5. Approve or reject (admin only).
CREATE OR REPLACE FUNCTION public.decide_room_booking(p_id UUID, p_status TEXT)
RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT COALESCE(public.is_admin(), FALSE) THEN RAISE EXCEPTION 'NOT_ALLOWED'; END IF;
  IF p_status NOT IN ('approved', 'rejected') THEN RAISE EXCEPTION 'INVALID_STATUS'; END IF;
  UPDATE public.room_bookings
     SET status = p_status, decided_by = auth.uid(), decided_at = now()
   WHERE id = p_id AND status = 'pending';
  IF NOT FOUND THEN RAISE EXCEPTION 'BOOKING_NOT_PENDING'; END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.request_room_booking(TEXT, TEXT, DATE, TEXT, TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.cancel_room_booking(UUID, TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.decide_room_booking(UUID, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.request_room_booking(TEXT, TEXT, DATE, TEXT, TEXT) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.cancel_room_booking(UUID, TEXT) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.decide_room_booking(UUID, TEXT) TO authenticated;

-- 6. Live updates on every device
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
    CREATE PUBLICATION supabase_realtime;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'room_bookings'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.room_bookings;
  END IF;
END $$;
