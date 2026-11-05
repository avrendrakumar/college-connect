-- Removes ALL timetable data, rooms, subjects, faculty, branches, holidays and notices from your database.
-- Run this once in the Supabase SQL Editor ONLY if you previously loaded sample data and want an empty start.
-- It does NOT touch user accounts, profiles or admin roles. Semesters (SEM1-SEM8) and the settings row are kept.
-- This cannot be undone.

BEGIN;
DELETE FROM public.timetable_entries;
DELETE FROM public.holiday_branches;
DELETE FROM public.holidays;
DELETE FROM public.announcements;
DELETE FROM public.subjects;
DELETE FROM public.professors;
DELETE FROM public.classrooms;
DELETE FROM public.branches;
UPDATE public.settings
   SET college_name = 'College Connect', academic_year = '',
       contact_address = NULL, contact_phone = NULL, contact_email = NULL
 WHERE id = 'current';
COMMIT;
