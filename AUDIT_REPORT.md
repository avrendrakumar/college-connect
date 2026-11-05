# College Connect: audit report

## What could and could not be verified in this environment
The package registry was blocked here, so `npm install`, `vite build`, `vitest` and a browser could not be run.
What WAS run:
- Logic tests: `tests/schedule.test.ts`, 24 tests, all passing under `tsx` (node:test shim for the vitest API), with the process timezone set to Asia/Kolkata, America/Los_Angeles and UTC.
- Type check: `tsc` 6.0.3 in strict mode over `src` and `tests`, with minimal stub typings for react, lucide, motion, supabase and xlsx. No type errors remain. Only unused-import warnings (not enabled in your tsconfig) and errors caused by the stubs themselves (implicit-any on component props) are left, so component prop typing is NOT fully verified.
NOT verified: production build, vitest itself, the UI in a browser (layout, console, responsive), any real Supabase call (no credentials), and the SQL migration (no Postgres server available; reviewed statically only).
Run `npm install && npm run typecheck && npm test && npm run build` on your machine to confirm.

## 1. Bugs found
Security
1. Admin login was fake: any email/password was accepted, the form was pre-filled with `admin@college.edu` / `admin123`, and access was a `localStorage` flag.
2. A personal email address was hard-coded in the setup helper's SQL snippet.
3. `announcements` RLS policy named "active" returned every row, including expired and future ones.
Data and persistence
4. Every Supabase write swallowed errors (supabase-js returns `{error}`, it does not throw), so the UI reported success for failed saves.
5. Deletes were never sent to Supabase (upsert only).
6. Timetable writes sent subject/teacher names into foreign-key columns and invented fallbacks (`SEM5`, `09:00`, `09:55`); real databases rejected them.
7. Data loaded from Supabase showed ids instead of names; the slot id was used as the period id, so loaded classes never matched a period.
8. Remote data never reached React state after the first render; realtime was written but never started.
9. Holiday branch lists were never written or read; announcements expired at the start of their last day (UTC midnight).
10. Upload import ran in the wrong FK order, ignored the Subjects/Professors sheets, and Excel times/dates (Date or serial cells) were mis-parsed.
11. Snapshot restore did not await its saves; undo could report success early.
12. Quick overrides used the UTC date and were never read back.
Logic
13. Emergency notices were never passed to the status engine; any "urgent" notice would have closed the college, and expired closures stayed active.
14. Branch-specific holidays closed the whole college.
15. "Now", the weekday and the calendar's "today" used the browser clock or UTC instead of the college timezone; the Time Machine had the same problem and hard-coded 2026 dates.
16. Days-until-holiday could be off by one; cancelled/swapped classes, drafts and closed branches were not applied to room status.
Quality and config
17. Notice ticker showed expired notices; slot finder had no day selector (its setter was unused); Timetable editor semester default had an operator-precedence bug.
18. Leftover AI Studio items: unused deps (`express`, `dotenv`, `@google/genai`, `esbuild`, `tsx`, `autoprefixer`, `@types/express`), `GEMINI_API_KEY` in `.env.example`, DISABLE_HMR config, "CampusPulse" branding, `vite` listed as a runtime dependency; the service worker cached non-GET requests; the SQL realtime section failed on re-run; sample data was seeded into the live schema.

## 2. Fixed
All items above, with these deliberate limits:
- The "mark whole college as holiday today" quick override stays browser-local (no matching table); use a Holiday or a closing Notice for a shared closure.
- `working_days` and the 08:30-17:00 opening hours are still fixed in the engine (documented in README, "Known limits").
- The 12h-style period shorthand (`01:45` meaning 13:45) is kept because the sample data uses it, and it is converted to 24h before saving.
- Admin access is now checked against `profiles.role` in Supabase. Without Supabase the app runs in a clearly labelled local mode.

## 3. Files modified
`src/App.tsx`, `src/services/storageService.ts` (largely rewritten), `src/services/supabaseClient.ts`, `src/utils/timeEngine.ts`, `src/utils/excelEngine.ts`, `src/utils/dbMapping.ts` (new), `src/components/{AdminPanel/*, BranchTimetable, HeroBanner, HolidayCalendar, NoticeTicker, RoomAvailability, SetupChecker, TimeMachineModal}.tsx`, `tests/schedule.test.ts`, `supabase/migrations/001_schema.sql`, `supabase/seed/sample_data.sql` (new, optional), `package.json`, `vite.config.ts`, `tsconfig.json`, `vercel.json`, `index.html`, `public/{sw.js,manifest.json}`, `.env.example`, `metadata.json`, `README.md`.

## 4. Dependencies
Removed: `express`, `dotenv`, `@google/genai`, `esbuild`, `tsx`, `autoprefixer`, `@types/express`. `vite` moved to devDependencies. Package renamed to `college-connect`; `typecheck` script added. No packages added. `bun.lock` is stale: run `npm install` to regenerate a lockfile.

## 5. Needs external configuration
- A Supabase project: run `supabase/migrations/001_schema.sql`, set `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`, then promote the first admin with the SQL in the README. Optional demo data: `supabase/seed/sample_data.sql`.
- Email confirmation / SMTP for sign-up; Supabase Realtime must be enabled for live updates (the app also refreshes every 5 minutes and on focus).
- Not implemented (need external services): push notifications, PDF/image timetable OCR, banner/logo file upload.
- `xlsx` 0.18.x has published advisories: prefer CSV for untrusted files, or use the SheetJS CDN build.

## 6. Test results
See the top of this file: 24/24 logic tests pass; strict typecheck clean apart from the noted items; build, vitest, browser and live-database checks are still to do on your machine.

## Update: admin lockdown, sample data removal, branch/subject management

- **Admin login**: removed the in-app sign-up form and the "local mode" that let the admin portal open without any login. The portal now opens only for a Supabase session whose `profiles.role = 'admin'`; with Supabase unconfigured it stays locked. Disable "Allow new users to sign up" in Supabase so nobody can create accounts through the API either (README, Step 3).
- **Sample data**: deleted `src/data/initialData.ts` and `supabase/seed/`; the Excel template is headers-only; no hardcoded branches/`SEM5` defaults; settings defaults are neutral; SQL no longer seeds a sample college name/year. `supabase/cleanup_sample_data.sql` empties a database that already has sample data.
- **Branches and subjects**: add and delete in Master Data (confirm dialog states how many classes will be deleted with them); subjects feed suggestions in the timetable editor.
- Verified: 24 unit tests pass in UTC, Asia/Kolkata and America/Los_Angeles; strict typecheck shows no real errors (only stub-typing noise and pre-existing unused icon imports).
- NOT verified here (registry blocked): `npm run build`, running in a browser, live Supabase calls, and executing the SQL.

## Update: visual redesign
- New identity: cool paper and ink palette, chalkboard-green action colour, Bricolage Grotesque with Barlow Condensed for times, flat crisp shadows and smaller radii (set once as theme tokens in `src/index.css`, so admin pages follow too).
- Hero is a split-flap departure board (`src/components/FlapBoard.tsx`): it flips on load and only the changed cells flip afterwards. Nav underline slides between tabs. Reduced-motion is respected.
- Not verified here: `vite build` and Tailwind output (registry blocked), fonts loading, and a full in-browser pass. Only the board CSS was rendered in a browser.

## Update: new look and animation

Complete rewrite of `index.css`, `TopNav`, `HeroBanner`, `NoticeTicker`, `TimeMachineModal`, `BranchTimetable`, `RoomAvailability`, `HolidayCalendar` and the page layout in `App.tsx` (screen-printed campus poster style: two inks, hard offset shadows, Unbounded + Familjen Grotesk fonts). The old flip-board (`FlapBoard.tsx`) is removed. The admin panel keeps its structure and inherits the new colours, fonts, corners and shadows through the theme tokens. Animation: letter-by-letter stamp of OPEN/SHUT, rolling counters, sliding nav pill, scrolling notice tape, direction-aware month flip, spring dialogs; all respect reduced-motion. Not verified here: rendering in a browser (layout at 360px, dark-mode contrast, animation feel), and `npm run build`.


## Update: Phase 1, shared room bookings and opening hours

- New `supabase/migrations/002_room_bookings.sql`: `room_bookings` table with a unique index on pending/approved (room, period, date), RLS, secret-token table, `request_room_booking` / `cancel_room_booking` / `decide_room_booking` functions, realtime, and `settings.opening_time/closing_time`.
- App: bookings load from and save to Supabase (the old browser-only bookings are gone), update on every device through realtime, show pending vs approved, and can be cancelled; admin tab **Room Bookings** approves, rejects and cancels. The room board now matches bookings by date (before, a booking showed on every same weekday).
- Settings: working days (including removing Saturday or adding Sunday) and opening/closing time now drive the public status; they were previously hard-coded to Sunday off and 08:30 to 17:00.
- Verified: both SQL files run cleanly (and 002 re-runs) on PostgreSQL 16 with stubbed Supabase roles; tested there: 8 simultaneous requests for one slot gave 1 success and 7 refusals; rules for working day, past date, class in room, maintenance, break, holiday, blank name; cancel with wrong/no/right token; approve by admin, refusal for visitors and non-admins; direct table writes refused. 34 unit tests pass in UTC, Asia/Kolkata and America/Los_Angeles; stub typecheck clean.
- NOT verified: real Supabase (grants and realtime were reasoned about, not run), `npm run build`, the UI in a browser.
- NOT built (the pasted roadmap marks these done, they are not): student login and dashboard, faculty login, attendance, analytics, PDF/image extraction and PDF export. These are the next phases.
