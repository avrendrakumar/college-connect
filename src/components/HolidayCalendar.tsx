import React, { useState } from 'react';
import { motion, AnimatePresence, useReducedMotion } from 'motion/react';
import { ChevronLeft, ChevronRight, X } from 'lucide-react';
import { Holiday } from '../types';
import { isoToZonedDate } from '../utils/dbMapping';

interface HolidayCalendarProps {
  holidays: Holiday[];
  currentDate: Date;
  /** College IANA timezone; "today" is the date in this zone (not the viewer's or UTC). */
  timeZone?: string;
}

/** Static class maps per holiday type, so Tailwind can see every class. */
const TYPE_LABEL: Record<string, string> = {
  holiday: 'Holiday',
  vacation: 'Vacation',
  exam: 'Exam',
  sunday: 'Weekly off'
};

const TYPE_STICKER: Record<string, string> = {
  holiday: 'bg-[var(--orange)] text-[#15163a]',
  vacation: 'bg-[var(--mint)] text-[#15163a]',
  exam: 'bg-[var(--blue)] text-white',
  sunday: 'bg-[var(--paper-2)] text-[var(--ink)]'
};

const TYPE_CELL: Record<string, string> = {
  holiday: 'bg-[var(--orange)]/15',
  vacation: 'bg-[var(--mint)]/15',
  exam: 'bg-[var(--blue)]/10',
  sunday: ''
};

const TYPE_SWATCH: Record<string, string> = {
  holiday: 'bg-[var(--orange)]',
  vacation: 'bg-[var(--mint)]',
  exam: 'bg-[var(--blue)]',
  sunday: 'bg-[var(--paper-2)]'
};

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export const HolidayCalendar: React.FC<HolidayCalendarProps> = ({
  holidays,
  currentDate,
  timeZone = 'Asia/Kolkata'
}) => {
  const reduceMotion = useReducedMotion();
  const todayStr = isoToZonedDate(currentDate.toISOString(), timeZone);
  const monthOfToday = () => {
    const [y, m] = todayStr.split('-').map(Number);
    return new Date(y, m - 1, 1);
  };
  const [viewDate, setViewDate] = useState<Date>(monthOfToday);
  const [direction, setDirection] = useState<1 | -1>(1);
  const [selectedDateEvents, setSelectedDateEvents] = useState<{
    dateStr: string;
    events: Holiday[];
  } | null>(null);

  const year = viewDate.getFullYear();
  const month = viewDate.getMonth();

  const monthName = viewDate.toLocaleDateString('en-US', {
    month: 'long',
    year: 'numeric'
  });
  const monthKey = `${year}-${month}`;

  // Calculate days in month
  const firstDayOfWeek = new Date(year, month, 1).getDay(); // 0 is Sunday
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  // Navigation handlers
  const handlePrevMonth = () => {
    setDirection(-1);
    setViewDate(new Date(year, month - 1, 1));
  };

  const handleNextMonth = () => {
    setDirection(1);
    setViewDate(new Date(year, month + 1, 1));
  };

  const handleResetToCurrentMonth = () => {
    const target = monthOfToday();
    setDirection(target.getTime() < viewDate.getTime() ? -1 : 1);
    setViewDate(target);
  };

  // Helper to find events on a given day
  const getEventsForDay = (dayNum: number): Holiday[] => {
    const formattedDate = `${year}-${(month + 1).toString().padStart(2, '0')}-${dayNum
      .toString()
      .padStart(2, '0')}`;
    return holidays.filter(
      (h) => formattedDate >= h.startDate && formattedDate <= h.endDate
    );
  };

  // Filter upcoming holidays for the list
  const upcomingHolidays = holidays
    .filter((h) => h.endDate >= todayStr)
    .sort((a, b) => a.startDate.localeCompare(b.startDate));

  const daysUntil = (item: Holiday) => {
    const target = new Date(item.startDate);
    return Math.ceil((target.getTime() - currentDate.getTime()) / (1000 * 60 * 60 * 24));
  };

  // The countdown is about the next actual break, so exams are skipped when something else exists.
  const nextBreak =
    upcomingHolidays.find((h) => h.type !== 'exam') ?? upcomingHolidays[0] ?? null;
  const nextBreakDiff = nextBreak ? daysUntil(nextBreak) : 0;

  const slide = reduceMotion ? 0 : 56;
  const pageVariants = {
    enter: (dir: number) => ({ opacity: 0, x: dir * slide, rotate: reduceMotion ? 0 : dir * 0.8 }),
    center: { opacity: 1, x: 0, rotate: 0 },
    exit: (dir: number) => ({ opacity: 0, x: dir * -slide, rotate: reduceMotion ? 0 : dir * -0.8 })
  };

  const navBtn =
    'btn btn--paper !p-0 w-10 h-10 shrink-0 focus-visible:outline-offset-4';

  return (
    <div className="space-y-6 min-w-0 max-w-full">
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 lg:gap-8 items-start min-w-0">
        {/* The pad: binding strip, month title, ruled grid */}
        <section
          aria-label="Academic calendar"
          className="ticket lg:col-span-8 min-w-0 overflow-hidden !rounded-[14px]"
        >
          {/* Binding strip with punched holes */}
          <div className="bg-[var(--blue)] text-white px-3 sm:px-5 pt-3 pb-4 border-b-2 border-[var(--ink)]">
            <div className="flex justify-around mb-3" aria-hidden="true">
              {Array.from({ length: 6 }).map((_, i) => (
                <span
                  key={i}
                  className="w-3 h-3 rounded-full bg-[var(--paper)] border-2 border-[var(--ink)]"
                />
              ))}
            </div>
            <div className="flex items-center justify-between gap-2 min-w-0">
              <button
                type="button"
                onClick={handlePrevMonth}
                aria-label="Previous month"
                className={navBtn}
              >
                <ChevronLeft className="w-5 h-5" aria-hidden="true" />
              </button>
              <h2
                className="text-lg sm:text-2xl font-bold text-center min-w-0 truncate text-white"
                style={{ textShadow: '0.05em 0.05em 0 var(--orange)' }}
                aria-live="polite"
              >
                {monthName}
              </h2>
              <button
                type="button"
                onClick={handleNextMonth}
                aria-label="Next month"
                className={navBtn}
              >
                <ChevronRight className="w-5 h-5" aria-hidden="true" />
              </button>
            </div>
          </div>

          {/* Weekday heads */}
          <div className="grid grid-cols-7 border-b-2 border-[var(--ink)] bg-[var(--yellow)] text-[#15163a]">
            {WEEKDAYS.map((d, i) => (
              <span
                key={d}
                className={`py-1.5 text-center text-[11px] sm:text-xs font-bold ${
                  i === 0 ? 'text-[#c2300c]' : ''
                }`}
              >
                {d}
              </span>
            ))}
          </div>

          {/* Month days, flipping page */}
          <div className="relative overflow-hidden">
            <AnimatePresence mode="wait" custom={direction} initial={false}>
              <motion.div
                key={monthKey}
                custom={direction}
                variants={pageVariants}
                initial="enter"
                animate="center"
                exit="exit"
                transition={{ duration: reduceMotion ? 0.12 : 0.22, ease: [0.3, 0.8, 0.3, 1] }}
                className="grid grid-cols-7 border-r border-[var(--ink)]/40"
              >
                {/* Blank leading days */}
                {Array.from({ length: firstDayOfWeek }).map((_, i) => (
                  <div
                    key={`empty-${i}`}
                    aria-hidden="true"
                    className="min-h-[58px] sm:min-h-[88px] border-b border-l border-[var(--ink)]/40 halftone opacity-60"
                  />
                ))}

                {/* Days of Month */}
                {Array.from({ length: daysInMonth }).map((_, i) => {
                  const dayNum = i + 1;
                  const dayOfWeekIndex = (firstDayOfWeek + i) % 7;
                  const isSunday = dayOfWeekIndex === 0;

                  const dayDateStr = `${year}-${(month + 1).toString().padStart(2, '0')}-${dayNum
                    .toString()
                    .padStart(2, '0')}`;
                  const isToday = dayDateStr === todayStr;

                  const events = getEventsForDay(dayNum);
                  const holiday = events.find((e) => e.type === 'holiday');
                  const vacation = events.find((e) => e.type === 'vacation');
                  const exam = events.find((e) => e.type === 'exam');
                  const stamped = holiday ?? vacation ?? exam;
                  const stampType = stamped ? stamped.type : '';

                  const label = [
                    `${dayDateStr}`,
                    isToday ? 'today' : '',
                    isSunday ? 'Sunday, weekly off' : '',
                    ...events.map((e) => `${TYPE_LABEL[e.type] ?? e.type}: ${e.title}`)
                  ]
                    .filter(Boolean)
                    .join(', ');

                  return (
                    <button
                      type="button"
                      key={dayNum}
                      aria-label={label}
                      aria-pressed={selectedDateEvents?.dateStr === dayDateStr}
                      onClick={() =>
                        setSelectedDateEvents({
                          dateStr: dayDateStr,
                          events: isSunday
                            ? [
                                {
                                  id: `sun-${dayDateStr}`,
                                  startDate: dayDateStr,
                                  endDate: dayDateStr,
                                  title: 'Sunday (Weekly Off)',
                                  type: 'sunday'
                                },
                                ...events
                              ]
                            : events
                        })
                      }
                      className={`relative min-w-0 min-h-[58px] sm:min-h-[88px] p-1 sm:p-1.5 border-b border-l border-[var(--ink)]/40 text-left flex flex-col justify-between overflow-hidden transition-colors hover:bg-[var(--yellow)]/40 focus-visible:z-10 focus-visible:outline-offset-[-3px] ${
                        stamped ? TYPE_CELL[stampType] : isSunday ? 'bg-[var(--ink)]/5' : ''
                      }`}
                    >
                      <span className="relative inline-flex items-center justify-center self-start w-6 h-6 sm:w-7 sm:h-7">
                        {isToday && (
                          <svg
                            viewBox="0 0 40 40"
                            className="absolute -inset-1 w-[calc(100%+8px)] h-[calc(100%+8px)] text-[var(--orange)] pointer-events-none"
                            aria-hidden="true"
                            fill="none"
                          >
                            <motion.path
                              d="M21 3.5C30.5 3 37.5 10.5 36.8 20.2C36 30.5 28.5 37 19 36.4C9.5 35.8 3 28.5 3.6 19C4.2 10 11 4.5 19.5 4.2C24 4 28 5.5 30 7.5"
                              stroke="currentColor"
                              strokeWidth="3"
                              strokeLinecap="round"
                              initial={reduceMotion ? false : { pathLength: 0 }}
                              animate={{ pathLength: 1 }}
                              transition={{ duration: 0.5, ease: 'easeOut' }}
                            />
                          </svg>
                        )}
                        <span
                          className={`relative text-xs sm:text-sm font-mono font-bold ${
                            isToday
                              ? 'text-[var(--ink)]'
                              : isSunday
                              ? 'text-[#c2300c] dark:text-[var(--orange)]'
                              : 'text-[var(--ink)]'
                          }`}
                        >
                          {dayNum}
                        </span>
                      </span>

                      {stamped && (
                        <span
                          className={`block mt-1 border-2 border-[#15163a] rounded-md sm:-rotate-2 text-[9px] sm:text-[11px] leading-tight font-bold px-0.5 sm:px-1.5 py-0 sm:py-0.5 truncate ${TYPE_STICKER[stampType]}`}
                        >
                          <span className="hidden sm:inline">{stamped.title}</span>
                          <span className="sm:hidden block h-1.5" aria-hidden="true" />
                        </span>
                      )}
                      {!stamped && isSunday && (
                        <span className="hidden sm:block text-[11px] text-[var(--ink)]/55 truncate">
                          Weekly off
                        </span>
                      )}
                    </button>
                  );
                })}
              </motion.div>
            </AnimatePresence>
          </div>

          {/* Legend as little stamps */}
          <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-xs sm:text-sm px-3 sm:px-5 py-3 border-t-2 border-[var(--ink)]">
            {(['holiday', 'vacation', 'exam'] as const).map((t) => (
              <span key={t} className="inline-flex items-center gap-1.5">
                <span
                  className={`w-4 h-4 rounded border-2 border-[#15163a] ${TYPE_SWATCH[t]}`}
                  aria-hidden="true"
                />
                <span className="font-semibold">{TYPE_LABEL[t]}</span>
              </span>
            ))}
            <span className="inline-flex items-center gap-1.5">
              <span
                className="w-4 h-4 rounded-full border-[3px] border-[var(--orange)]"
                aria-hidden="true"
              />
              <span className="font-semibold">Today</span>
            </span>
            <button
              type="button"
              onClick={handleResetToCurrentMonth}
              className="btn btn--blue !py-1 !px-3 !text-xs ml-auto"
            >
              Jump to today
            </button>
          </div>
        </section>

        {/* Right column: countdown, upcoming, selected day */}
        <div className="lg:col-span-4 space-y-6 min-w-0">
          {upcomingHolidays.length === 0 ? (
            <div className="ticket halftone p-5 min-w-0">
              <h3 className="text-base font-bold mb-2">Nothing on the calendar</h3>
              <p className="text-sm">
                No holidays have been added yet. Add them in the Admin Portal and they will show up here.
              </p>
            </div>
          ) : (
            <>
              {/* The countdown */}
              {nextBreak && (
                <div
                  className="ticket relative p-4 sm:p-5 min-w-0 overflow-hidden bg-[var(--yellow)] dark:bg-[var(--yellow)] !text-[#15163a]"
                  aria-label="Next break countdown"
                >
                  <div
                    className="absolute -right-6 -top-6 w-28 h-28 rounded-full bg-[var(--orange)] border-2 border-[#15163a] halftone"
                    aria-hidden="true"
                  />
                  <p className="relative text-sm font-bold">Next break</p>
                  <h3 className="relative text-lg sm:text-xl font-bold mt-1 break-words pr-16">
                    {nextBreak.title}
                  </h3>
                  <div className="relative flex items-end gap-3 mt-3 min-w-0">
                    {nextBreakDiff <= 0 ? (
                      <span className="inline-flex items-center gap-2 text-4xl sm:text-5xl font-display font-black leading-none">
                        <span className="live-dot text-[var(--orange)]" aria-hidden="true" />
                        On now
                      </span>
                    ) : (
                      <>
                        <span
                          className="font-display font-black text-6xl sm:text-7xl leading-[0.85] text-[var(--blue)]"
                          style={{ textShadow: '0.05em 0.05em 0 #15163a' }}
                        >
                          {nextBreakDiff}
                        </span>
                        <span className="pb-1 text-base sm:text-lg font-bold">
                          {nextBreakDiff === 1 ? 'day to go' : 'days to go'}
                        </span>
                      </>
                    )}
                  </div>
                  <p className="relative font-mono text-xs sm:text-sm mt-3 break-words">
                    {nextBreak.startDate}
                    {nextBreak.endDate !== nextBreak.startDate && ` to ${nextBreak.endDate}`}
                  </p>
                </div>
              )}

              {/* Upcoming list, ticket stubs */}
              <div className="ticket p-4 sm:p-5 min-w-0">
                <h3 className="text-base font-bold mb-3">Coming up</h3>
                <ul className="divide-y-2 divide-dashed divide-[var(--ink)]/30">
                  {upcomingHolidays.slice(0, 6).map((item) => {
                    const diff = daysUntil(item);
                    return (
                      <li key={item.id} className="py-3 first:pt-0 last:pb-0 min-w-0">
                        <div className="flex items-start justify-between gap-2 min-w-0">
                          <div className="min-w-0">
                            <h4 className="text-sm font-bold break-words">{item.title}</h4>
                            <div className="text-xs font-mono mt-0.5 break-words text-[var(--ink)]/70">
                              {item.startDate}
                              {item.endDate !== item.startDate && ` to ${item.endDate}`}
                            </div>
                          </div>
                          <span
                            className={`sticker shrink-0 ${
                              diff <= 0 ? 'sticker--orange' : 'sticker--paper'
                            } font-mono`}
                          >
                            {diff <= 0 ? 'Today / Active' : `in ${diff} days`}
                          </span>
                        </div>
                        <span
                          className={`inline-block mt-1.5 text-[11px] font-bold px-1.5 rounded border-2 border-[#15163a] ${
                            TYPE_STICKER[item.type] ?? TYPE_STICKER.sunday
                          }`}
                        >
                          {TYPE_LABEL[item.type] ?? item.type}
                        </span>
                        {item.description && (
                          <p className="text-xs mt-1 text-[var(--ink)]/70 break-words">
                            {item.description}
                          </p>
                        )}
                      </li>
                    );
                  })}
                </ul>
              </div>
            </>
          )}

          {/* Selected date, a note pinned under the pad */}
          <AnimatePresence>
            {selectedDateEvents && (
              <motion.div
                key={selectedDateEvents.dateStr}
                initial={reduceMotion ? { opacity: 0 } : { opacity: 0, y: 14, rotate: -1.5 }}
                animate={{ opacity: 1, y: 0, rotate: reduceMotion ? 0 : -0.6 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.2 }}
                className="ticket p-4 sm:p-5 min-w-0 bg-[var(--paper-2)]"
                role="region"
                aria-label={`Details for ${selectedDateEvents.dateStr}`}
              >
                <div className="flex items-center justify-between gap-2 mb-2">
                  <span className="sticker sticker--blue font-mono">
                    {selectedDateEvents.dateStr}
                  </span>
                  <button
                    type="button"
                    onClick={() => setSelectedDateEvents(null)}
                    aria-label="Close date details"
                    className="w-8 h-8 inline-flex items-center justify-center rounded-full border-2 border-[var(--ink)] hover:bg-[var(--yellow)] hover:text-[#15163a]"
                  >
                    <X className="w-4 h-4" aria-hidden="true" />
                  </button>
                </div>

                {selectedDateEvents.events.length === 0 ? (
                  <p className="text-sm">
                    Standard college working day. All regular periods &amp; labs are in session.
                  </p>
                ) : (
                  <ul className="space-y-2 mt-2">
                    {selectedDateEvents.events.map((ev) => (
                      <li
                        key={ev.id}
                        className="p-2.5 rounded-lg border-2 border-[var(--ink)] min-w-0"
                      >
                        <div className="text-sm font-bold break-words">{ev.title}</div>
                        <span
                          className={`inline-block mt-1 text-[11px] font-bold px-1.5 rounded border-2 border-[#15163a] ${
                            TYPE_STICKER[ev.type] ?? TYPE_STICKER.sunday
                          }`}
                        >
                          {TYPE_LABEL[ev.type] ?? ev.type}
                        </span>
                        {ev.description && (
                          <div className="text-xs mt-1 text-[var(--ink)]/70 break-words">
                            {ev.description}
                          </div>
                        )}
                      </li>
                    ))}
                  </ul>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
};
