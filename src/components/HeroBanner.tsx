import React, { useEffect, useRef, useState } from 'react';
import { motion, useReducedMotion } from 'motion/react';
import { BookOpen, DoorOpen } from 'lucide-react';
import { CollegeStatus, SCHEDULED_STATUS_DISCLAIMER } from '../utils/timeEngine';

interface HeroBannerProps {
  status: CollegeStatus;
  simulatedDate: Date;
  roomsFreeCount: number;
  classesRunningCount: number;
  nextHolidayInfo: { days: number; title: string } | null;
  onExploreRooms: () => void;
  onExploreTimetable: () => void;
  /** College IANA timezone (from Settings); dates/clock are shown in this zone, not the viewer's. */
  timeZone?: string;
}

/** The status word, stamped down one letter at a time whenever it changes. */
const StampWord: React.FC<{ word: string }> = ({ word }) => {
  const reduce = useReducedMotion();
  return (
    <span aria-hidden="true" key={word} className="inline-block whitespace-nowrap">
      {Array.from(word).map((ch, i) => (
        <span
          key={`${word}-${i}`}
          className={reduce ? 'inline-block' : 'stamp-letter'}
          style={reduce ? undefined : { animationDelay: `${i * 70}ms` }}
        >
          {ch}
        </span>
      ))}
    </span>
  );
};

/** A number that rolls to its new value instead of jumping. */
const Count: React.FC<{ value: number }> = ({ value }) => {
  const reduce = useReducedMotion();
  const [shown, setShown] = useState(value);
  const from = useRef<number>(value);

  useEffect(() => {
    if (reduce || from.current === value) {
      setShown(value);
      from.current = value;
      return;
    }
    const start = from.current;
    const t0 = performance.now();
    let raf = 0;
    const step = (now: number) => {
      const p = Math.min(1, (now - t0) / 600);
      const eased = 1 - Math.pow(1 - p, 3);
      setShown(Math.round(start + (value - start) * eased));
      if (p < 1) raf = requestAnimationFrame(step);
      else from.current = value;
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [value, reduce]);

  return <>{shown}</>;
};

const formatCountdown = (totalSeconds: number) => {
  if (totalSeconds <= 0) return '00:00';
  const mins = Math.floor(totalSeconds / 60);
  const secs = totalSeconds % 60;
  return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
};

export const HeroBanner: React.FC<HeroBannerProps> = ({
  status,
  simulatedDate,
  roomsFreeCount,
  classesRunningCount,
  nextHolidayInfo,
  onExploreRooms,
  onExploreTimetable,
  timeZone = 'Asia/Kolkata'
}) => {
  const reduce = useReducedMotion();

  const formattedDate = simulatedDate.toLocaleDateString('en-US', {
    timeZone,
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric'
  });

  const clock = status.currentTimeString.slice(0, 5);
  const word = status.isOpen ? 'OPEN' : 'SHUT';
  const nowText = status.isOpen
    ? status.activePeriod
      ? status.activePeriod.label
      : 'Between classes'
    : status.badgeType === 'holiday'
    ? 'Holiday'
    : status.badgeType === 'sunday'
    ? 'Weekly off'
    : 'Closed for the day';

  const stats = [
    {
      key: 'rooms',
      value: roomsFreeCount,
      label: roomsFreeCount === 1 ? 'room free right now' : 'rooms free right now',
      tilt: -1.6,
      tone: 'bg-[var(--mint)] text-[#15163a]',
      onClick: onExploreRooms
    },
    {
      key: 'classes',
      value: classesRunningCount,
      label: classesRunningCount === 1 ? 'class in session' : 'classes in session',
      tilt: 1.2,
      tone: 'bg-[var(--blue)] text-white',
      onClick: onExploreTimetable
    },
    {
      key: 'break',
      value: nextHolidayInfo ? nextHolidayInfo.days : 0,
      label: nextHolidayInfo ? `days until ${nextHolidayInfo.title}` : 'No break scheduled',
      tilt: -0.8,
      tone: 'bg-[var(--yellow)] text-[#15163a]',
      onClick: undefined as undefined | (() => void)
    }
  ];

  return (
    <section aria-label="Campus status" className="relative">
      <h1 className="sr-only">
        {status.isOpen ? 'College is open' : 'College is closed'}
        {status.reason ? `. ${status.reason}` : ''}
      </h1>

      <div className="grid lg:grid-cols-[1fr_auto] gap-x-10 gap-y-6 items-end">
        <div className="min-w-0">
          <p className="text-sm font-medium opacity-80">
            {formattedDate}, {timeZone}
          </p>

          <div
            className="font-display font-black leading-[0.85] tracking-tight misreg select-none mt-2"
            style={{ fontSize: 'clamp(4.5rem, 19vw, 12.5rem)' }}
          >
            <StampWord word={word} />
          </div>

          <p className="mt-5 text-lg sm:text-xl font-semibold max-w-xl">
            {status.isOpen ? (
              <>
                {nowText}
                {status.activePeriod && (
                  <span className="font-normal opacity-75">
                    , {status.activePeriod.start} to {status.activePeriod.end}
                  </span>
                )}
              </>
            ) : (
              <>
                {nowText}
                {status.reason && status.reason !== nowText && (
                  <span className="font-normal opacity-75">. {status.reason}</span>
                )}
              </>
            )}
          </p>

          {status.isOpen && status.activePeriod && (
            <div className="mt-4 max-w-md">
              <div
                className="h-5 rounded-full border-2 border-[var(--ink)] bg-[var(--paper-2)] overflow-hidden"
                role="progressbar"
                aria-label="Period progress"
                aria-valuemin={0}
                aria-valuemax={100}
                aria-valuenow={status.periodProgressPct}
              >
                <motion.div
                  className="h-full bg-[var(--orange)] hatch border-r-2 border-[var(--ink)]"
                  initial={reduce ? false : { width: 0 }}
                  animate={{ width: `${status.periodProgressPct}%` }}
                  transition={{ duration: 0.7, ease: 'easeOut' }}
                />
              </div>
              <p className="mt-1.5 text-sm opacity-80">{status.periodProgressPct}% of the period gone</p>
            </div>
          )}
        </div>

        <div className="flex flex-col items-start lg:items-end gap-4">
          <div className="ticket px-5 py-3 flex items-center gap-4 -rotate-1">
            <span className="font-mono font-medium text-4xl sm:text-5xl tabular-nums" aria-label={`Time ${clock}`}>
              {clock}
            </span>
            {status.isOpen && status.nextPeriod && (
              <span className="text-sm leading-tight border-l-2 border-dashed border-[var(--ink)] pl-4">
                <span className="block font-bold">{status.nextPeriod.label} at {status.nextPeriod.start}</span>
                <span className="block font-mono tabular-nums opacity-80">
                  in {formatCountdown(status.secondsUntilNextPeriod)}
                </span>
              </span>
            )}
          </div>

          <div className="flex flex-wrap gap-3">
            <button type="button" onClick={onExploreRooms} className="btn">
              <DoorOpen className="w-4 h-4" />
              Find a free room
            </button>
            <button type="button" onClick={onExploreTimetable} className="btn btn--paper">
              <BookOpen className="w-4 h-4" />
              Branch routine
            </button>
          </div>
        </div>
      </div>

      <div className="mt-10 grid grid-cols-1 sm:grid-cols-3 gap-5">
        {stats.map((s, i) => {
          const body = (
            <>
              <span className="font-display font-black text-6xl sm:text-7xl leading-none tabular-nums">
                <Count value={s.value} />
              </span>
              <span className="mt-2 block text-sm font-semibold leading-snug">{s.label}</span>
            </>
          );
          const cls = `ticket ${s.tone} p-5 text-left block w-full`;
          return (
            <motion.div
              key={s.key}
              initial={reduce ? false : { opacity: 0, y: 24, rotate: 0 }}
              animate={{ opacity: 1, y: 0, rotate: s.tilt }}
              transition={{ delay: 0.5 + i * 0.12, type: 'spring', stiffness: 220, damping: 18 }}
              whileHover={reduce || !s.onClick ? undefined : { rotate: 0, y: -4 }}
            >
              {s.onClick ? (
                <button type="button" onClick={s.onClick} className={cls}>
                  {body}
                </button>
              ) : (
                <div className={cls}>{body}</div>
              )}
            </motion.div>
          );
        })}
      </div>

      <p className="mt-6 text-xs opacity-70 max-w-2xl">{SCHEDULED_STATUS_DISCLAIMER}</p>
    </section>
  );
};
