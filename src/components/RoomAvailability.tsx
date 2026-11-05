import React, { useState } from 'react';
import { motion, AnimatePresence, useReducedMotion } from 'motion/react';
import {
  CheckCircle2,
  Clock,
  DoorOpen,
  Grid3X3,
  Layers,
  Search,
  User,
  Users,
  Wrench,
  X
} from 'lucide-react';
import {
  DerivedRoomStatus,
  Period,
  Room,
  RoomBooking,
  RoomType,
  TimetableSlot,
  DayOfWeek
} from '../types';
import { DAYS_OF_WEEK } from '../utils/timeEngine';
import { dayNameOfDate } from '../utils/bookingUtils';

/** pending and approved bookings hold a room; rejected and cancelled ones do not. */
const holdsRoom = (b: RoomBooking) => !b.status || b.status === 'pending' || b.status === 'approved';

const addDaysTo = (dateStr: string, days: number): string => {
  const [y, m, d] = dateStr.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d + days)).toISOString().slice(0, 10);
};

/** The next date (today included) that falls on the given weekday. */
const nextDateForDay = (todayStr: string, day: DayOfWeek): string => {
  for (let i = 0; i < 7; i++) {
    const candidate = addDaysTo(todayStr, i);
    if (dayNameOfDate(candidate) === day) return candidate;
  }
  return todayStr;
};

interface RoomAvailabilityProps {
  roomStatuses: DerivedRoomStatus[];
  rooms: Room[];
  periods: Period[];
  timetable: TimetableSlot[];
  activeDay: DayOfWeek;
  /** Asks the database for the room; resolves with ok or a plain-language error. */
  onBookRoom: (booking: {
    roomId: string;
    periodId: string | number;
    date: string;
    bookedBy: string;
    reason: string;
  }) => Promise<{ ok: boolean; error?: string }>;
  onCancelBooking: (id: string) => Promise<{ ok: boolean; error?: string }>;
  bookings: RoomBooking[];
  /** Today's date (YYYY-MM-DD) in the college timezone. */
  todayStr: string;
  /** Ids of the bookings made from this browser (the only ones a visitor can cancel). */
  myBookingIds?: string[];
  /** False when no database is connected: bookings are shared, so they need one. */
  bookingsEnabled?: boolean;
}

const STATUS_OPTIONS: { id: 'all' | 'free' | 'occupied'; label: string; on: string }[] = [
  { id: 'all', label: 'All rooms', on: 'sticker--blue' },
  { id: 'free', label: 'Free now', on: 'sticker--mint' },
  { id: 'occupied', label: 'Occupied', on: 'sticker--orange' }
];

const FIELD =
  'w-full min-h-[44px] rounded-xl border-2 border-[var(--ink)] bg-[var(--paper-2)] px-3 py-2 text-sm text-[var(--ink)] placeholder:text-slate-500 dark:placeholder:text-slate-400 focus-visible:outline-3 focus-visible:outline-[var(--orange)]';

const HATCH_STYLE = {
  backgroundImage:
    'repeating-linear-gradient(-45deg, rgb(21 22 58 / 0.16) 0 7px, transparent 7px 14px)'
};

export const RoomAvailability: React.FC<RoomAvailabilityProps> = ({
  roomStatuses,
  rooms,
  periods,
  timetable,
  activeDay,
  onBookRoom,
  onCancelBooking,
  bookings,
  todayStr,
  myBookingIds = [],
  bookingsEnabled = true
}) => {
  const reduce = useReducedMotion();

  const [statusFilter, setStatusFilter] = useState<'all' | 'free' | 'occupied'>('all');
  const [typeFilter, setTypeFilter] = useState<string>('all');
  const [floorFilter, setFloorFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [viewMode, setViewMode] = useState<'cards' | 'heatmap'>('cards');

  // "Find a free room for a time slot" picker state
  const [slotPickerDay, setSlotPickerDay] = useState<DayOfWeek>(activeDay);
  const [slotPickerPeriodId, setSlotPickerPeriodId] = useState<string | number>('all');

  // Booking Modal State
  const [bookingRoom, setBookingRoom] = useState<Room | null>(null);
  const [bookedByName, setBookedByName] = useState('');
  const [bookingReason, setBookingReason] = useState('');
  const [bookingPeriodId, setBookingPeriodId] = useState<string | number>(1);
  const [bookingSuccessMsg, setBookingSuccessMsg] = useState(false);
  const [bookingDate, setBookingDate] = useState(todayStr);
  const [bookingError, setBookingError] = useState('');
  const [bookingBusy, setBookingBusy] = useState(false);
  const [cancelError, setCancelError] = useState('');

  const activeBookings = bookings.filter(holdsRoom);
  const dateOfActiveDay = nextDateForDay(todayStr, activeDay);
  const dateOfPickerDay = nextDateForDay(todayStr, slotPickerDay);
  const myActive = activeBookings
    .filter((b) => myBookingIds.includes(b.id) && b.date >= todayStr)
    .sort((a, b) => a.date.localeCompare(b.date));

  const openBooking = (room: Room, periodId?: string | number, date?: string) => {
    setBookingRoom(room);
    if (periodId !== undefined) setBookingPeriodId(periodId);
    setBookingDate(date || dateOfActiveDay);
    setBookingError('');
  };

  // Teaching periods (exclude breaks for booking/picker)
  const teachingPeriods = periods.filter((p) => !p.isBreak);

  // Filter rooms
  const filteredStatuses = roomStatuses.filter((item) => {
    // Status Filter
    if (statusFilter === 'free' && item.status !== 'free') return false;
    if (statusFilter === 'occupied' && item.status !== 'occupied') return false;

    // Type Filter
    if (typeFilter !== 'all' && item.room.type !== typeFilter) return false;

    // Floor Filter
    if (floorFilter !== 'all' && String(item.room.floor) !== floorFilter) return false;

    // Search Query
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matchName = item.room.name.toLowerCase().includes(q);
      const matchSubject = item.currentSlot?.subject.toLowerCase().includes(q);
      const matchTeacher = item.currentSlot?.teacher.toLowerCase().includes(q);
      if (!matchName && !matchSubject && !matchTeacher) return false;
    }

    // Time Slot Picker Filter (if active)
    if (slotPickerPeriodId !== 'all') {
      // Check if room is booked or has a class in this specific day + period
      const hasClass = timetable.some(
        (t) =>
          t.roomId === item.room.id &&
          t.day === slotPickerDay &&
          String(t.periodId) === String(slotPickerPeriodId)
      );
      const hasBooking = activeBookings.some(
        (b) =>
          b.roomId === item.room.id &&
          b.date === dateOfPickerDay &&
          String(b.periodId) === String(slotPickerPeriodId)
      );
      if (hasClass || hasBooking) return false; // Show only free rooms
    }

    return true;
  });

  const freeCount = roomStatuses.filter((s) => s.status === 'free').length;

  const handleConfirmBooking = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!bookingRoom || !bookedByName.trim() || !bookingReason.trim() || bookingBusy) return;
    setBookingBusy(true);
    setBookingError('');
    const result = await onBookRoom({
      roomId: bookingRoom.id,
      bookedBy: bookedByName.trim(),
      reason: bookingReason.trim(),
      periodId: bookingPeriodId,
      date: bookingDate
    });
    setBookingBusy(false);
    if (!result.ok) {
      setBookingError(result.error || 'The booking was not saved.');
      return;
    }
    setBookingSuccessMsg(true);
    setTimeout(() => {
      setBookingSuccessMsg(false);
      setBookingRoom(null);
      setBookedByName('');
      setBookingReason('');
    }, 1800);
  };

  const handleCancel = async (id: string) => {
    setCancelError('');
    const result = await onCancelBooking(id);
    if (!result.ok) setCancelError(result.error || 'The booking could not be cancelled.');
  };

  const noRoomsAtAll = roomStatuses.length === 0 && rooms.length === 0;

  const emptyState = (
    <div
      className="ticket halftone p-6 sm:p-8 text-center max-w-xl mx-auto"
      role="status"
    >
      <DoorOpen className="w-10 h-10 mx-auto mb-3 text-[var(--blue)] dark:text-[var(--yellow)]" aria-hidden="true" />
      {noRoomsAtAll ? (
        <>
          <h3 className="text-lg font-bold">No rooms on the board yet</h3>
          <p className="mt-2 text-sm">
            Add your classrooms, labs and halls in the Admin Portal and they will show up here with live status.
          </p>
        </>
      ) : (
        <>
          <h3 className="text-lg font-bold">No room fits these filters</h3>
          <p className="mt-2 text-sm">
            Clear the search box, set the type and floor back to all, or switch the free-slot finder to any slot. If a room should exist but is missing, add it in the Admin Portal.
          </p>
        </>
      )}
    </div>
  );

  const pop = reduce
    ? { initial: { opacity: 0 }, animate: { opacity: 1 }, exit: { opacity: 0 } }
    : {
        initial: { opacity: 0, scale: 0.85, rotate: -3 },
        animate: { opacity: 1, scale: 1, rotate: 0 },
        exit: { opacity: 0, scale: 0.85, rotate: 2 }
      };

  const popTransition = reduce
    ? { duration: 0.01 }
    : { type: 'spring' as const, stiffness: 420, damping: 24 };

  return (
    <div className="space-y-6 min-w-0">
      {/* Headline: the free-room count */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="min-w-0">
          <div className="flex items-end gap-3">
            <motion.span
              key={freeCount}
              initial={reduce ? false : { scale: 1.4, rotate: -6, opacity: 0 }}
              animate={{ scale: 1, rotate: 0, opacity: 1 }}
              transition={popTransition}
              className="font-display text-7xl sm:text-8xl font-black leading-[0.85] misreg inline-block"
              aria-hidden="true"
            >
              {freeCount}
            </motion.span>
            <h2 className="text-xl sm:text-2xl font-bold leading-tight pb-1">
              <span className="sr-only">{freeCount} </span>
              {freeCount === 1 ? 'room is free' : 'rooms are free'}
              <br />
              right now
            </h2>
          </div>
          <p className="mt-3 text-sm max-w-md">
            Worked out from the timetables, exams and bookings for {activeDay}. Tap a free room to hold it.
          </p>
        </div>

        {/* View toggle */}
        <div className="flex flex-wrap gap-2" role="group" aria-label="Choose a view">
          <button
            type="button"
            onClick={() => setViewMode('cards')}
            aria-pressed={viewMode === 'cards'}
            className={`sticker min-h-[40px] px-3.5 cursor-pointer ${
              viewMode === 'cards' ? 'sticker--blue' : 'sticker--paper'
            }`}
          >
            <Grid3X3 className="w-4 h-4" aria-hidden="true" />
            <span>Door signs</span>
          </button>
          <button
            type="button"
            onClick={() => setViewMode('heatmap')}
            aria-pressed={viewMode === 'heatmap'}
            className={`sticker min-h-[40px] px-3.5 cursor-pointer ${
              viewMode === 'heatmap' ? 'sticker--blue' : 'sticker--paper'
            }`}
          >
            <Layers className="w-4 h-4" aria-hidden="true" />
            <span>Day grid</span>
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="ticket p-4 space-y-4">
        <div className="flex flex-wrap gap-2" role="group" aria-label="Filter by status">
          {STATUS_OPTIONS.map((opt) => {
            const active = statusFilter === opt.id;
            return (
              <button
                key={opt.id}
                type="button"
                onClick={() => setStatusFilter(opt.id)}
                aria-pressed={active}
                className={`sticker min-h-[40px] px-4 cursor-pointer ${
                  active ? opt.on : 'sticker--paper'
                }`}
              >
                {opt.label}
              </button>
            );
          })}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          <label className="relative block sm:col-span-2 lg:col-span-2">
            <span className="sr-only">Search rooms, subjects or teachers</span>
            <Search
              className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 dark:text-slate-400"
              aria-hidden="true"
            />
            <input
              type="text"
              placeholder="Search room, subject or teacher"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className={`${FIELD} pl-9`}
            />
          </label>

          <select
            aria-label="Filter by room type"
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
            className={FIELD}
          >
            <option value="all">All room types</option>
            <option value="classroom">Classrooms</option>
            <option value="lab">Laboratories</option>
            <option value="hall">Halls &amp; studios</option>
            <option value="workshop">Workshops</option>
          </select>

          <select
            aria-label="Filter by floor"
            value={floorFilter}
            onChange={(e) => setFloorFilter(e.target.value)}
            className={FIELD}
          >
            <option value="all">All floors</option>
            <option value="0">Ground floor</option>
            <option value="1">1st floor</option>
            <option value="2">2nd floor</option>
            <option value="3">3rd floor</option>
          </select>
        </div>

        {/* Free-slot finder */}
        <div className="rounded-xl border-2 border-dashed border-[var(--ink)] p-3">
          <p className="text-sm font-bold mb-2">Need a room at a certain time?</p>
          <div className="grid grid-cols-1 min-[420px]:grid-cols-[7rem_1fr] gap-2">
            <select
              aria-label="Day for the free-room finder"
              value={slotPickerDay}
              onChange={(e) => setSlotPickerDay(e.target.value as DayOfWeek)}
              className={FIELD}
            >
              {DAYS_OF_WEEK.map((d) => (
                <option key={d} value={d}>{d.slice(0, 3)}</option>
              ))}
            </select>
            <select
              aria-label="Period for the free-room finder"
              value={slotPickerPeriodId}
              onChange={(e) =>
                setSlotPickerPeriodId(
                  e.target.value === 'all'
                    ? 'all'
                    : isNaN(Number(e.target.value))
                    ? e.target.value
                    : Number(e.target.value)
                )
              }
              className={`${FIELD} ${
                slotPickerPeriodId !== 'all' ? 'bg-[var(--yellow)] text-[#15163a] font-bold' : ''
              }`}
            >
              <option value="all">Any slot</option>
              {teachingPeriods.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.label} ({p.start})
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Main view */}
      {viewMode === 'cards' ? (
        filteredStatuses.length === 0 ? (
          emptyState
        ) : (
          <ul className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-6 list-none p-0 m-0">
            <AnimatePresence mode="popLayout">
              {filteredStatuses.map(({ room, status, currentSlot, currentBooking, nextFreeAt, freeUntil }) => {
                const isFree = status === 'free';
                const isOccupied = status === 'occupied';
                const isMaintenance = status === 'maintenance';

                return (
                  <motion.li
                    key={room.id}
                    layout={!reduce}
                    {...pop}
                    transition={popTransition}
                    whileHover={reduce ? undefined : { rotate: -1, y: -2 }}
                    className={`ticket relative flex flex-col justify-between gap-4 p-4 pt-5 text-[#15163a] ${
                      isFree
                        ? 'bg-[var(--mint)]'
                        : isOccupied
                        ? 'bg-[var(--orange)]'
                        : isMaintenance
                        ? 'bg-slate-300'
                        : 'bg-slate-200'
                    }`}
                    style={!isFree && !isOccupied ? HATCH_STYLE : undefined}
                  >
                    {/* key-tag hole */}
                    <span
                      aria-hidden="true"
                      className="absolute right-4 top-3 h-4 w-4 rounded-full border-2 border-[#15163a] bg-[var(--paper)]"
                    />

                    <div className="space-y-3 min-w-0">
                      <div className="pr-8 min-w-0">
                        <h3 className="text-2xl font-black leading-tight break-words">
                          {room.name}
                        </h3>
                        <p className="text-sm font-medium mt-0.5">
                          {room.building || 'Academic Wing'},{' '}
                          {room.floor === 0 ? 'ground floor' : `floor ${room.floor}`}
                        </p>
                      </div>

                      <div className="flex flex-wrap items-center gap-2">
                        <span className="sticker sticker--paper !text-[#15163a] !bg-white">
                          {isFree ? (
                            <span className="live-dot text-[var(--mint)]" aria-hidden="true" />
                          ) : null}
                          {isFree
                            ? 'Free'
                            : isOccupied
                            ? 'Occupied'
                            : isMaintenance
                            ? 'Maintenance'
                            : 'Closed'}
                        </span>
                        <span className="sticker sticker--paper !text-[#15163a] !bg-white">
                          <Users className="w-3.5 h-3.5" aria-hidden="true" />
                          {room.capacity} seats
                        </span>
                        <span className="sticker sticker--paper !text-[#15163a] !bg-white capitalize">
                          {room.type}
                        </span>
                      </div>

                      {isFree && (
                        <div>
                          <p className="text-sm font-bold">Free until</p>
                          <p className="font-mono text-4xl font-bold leading-none mt-1">
                            {freeUntil}
                          </p>
                        </div>
                      )}

                      {isOccupied && (
                        <div className="space-y-2">
                          <div>
                            <p className="text-sm font-bold">Free again at</p>
                            <p className="font-mono text-4xl font-bold leading-none mt-1">
                              {nextFreeAt}
                            </p>
                          </div>

                          {currentSlot && (
                            <div className="rounded-xl border-2 border-[#15163a] bg-white/90 p-3 text-sm space-y-1">
                              <p className="font-bold leading-tight">{currentSlot.subject}</p>
                              <p className="flex items-center gap-1.5">
                                <User className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
                                <span className="min-w-0 break-words">
                                  {currentSlot.teacher}, {currentSlot.branch}
                                </span>
                              </p>
                            </div>
                          )}

                          {currentBooking && !currentSlot && (
                            <div className="rounded-xl border-2 border-[#15163a] bg-[var(--yellow)] p-3 text-sm space-y-1">
                              <p className="font-bold">Special reservation</p>
                              <p className="break-words">
                                {currentBooking.reason}, booked by {currentBooking.bookedBy}
                              </p>
                            </div>
                          )}
                        </div>
                      )}

                      {isMaintenance && (
                        <div className="flex items-center gap-2 rounded-xl border-2 border-[#15163a] bg-white/90 p-3 text-sm font-medium">
                          <Wrench className="w-4 h-4 shrink-0" aria-hidden="true" />
                          <span>Equipment servicing in progress. Not bookable.</span>
                        </div>
                      )}
                    </div>

                    {isFree && (
                      <button
                        type="button"
                        onClick={() => openBooking(room)}
                        aria-label={`Book ${room.name}`}
                        className="btn btn--blue w-full min-h-[44px]"
                      >
                        <Clock className="w-4 h-4" aria-hidden="true" />
                        <span>Book this room</span>
                      </button>
                    )}
                  </motion.li>
                );
              })}
            </AnimatePresence>
          </ul>
        )
      ) : rooms.length === 0 ? (
        emptyState
      ) : (
        /* Day grid (rooms x periods) */
        <div className="ticket p-4 overflow-x-auto">
          <div className="min-w-[760px]">
            <div className="flex flex-wrap items-center justify-between gap-2 pb-3 mb-3 border-b-2 border-[var(--ink)]">
              <h3 className="text-base font-bold">Every room, every period on {activeDay}</h3>
              <div className="flex items-center gap-2">
                <span className="sticker sticker--mint">Free</span>
                <span className="sticker sticker--orange">Class</span>
                <span className="sticker">Reserved</span>
                <span className="sticker sticker--paper">Break or maintenance</span>
              </div>
            </div>

            <table className="w-full border-collapse text-left">
              <thead>
                <tr className="border-b-2 border-[var(--ink)]">
                  <th scope="col" className="py-2 px-3 text-sm font-bold w-36">
                    Room
                  </th>
                  {periods.map((p) => (
                    <th
                      scope="col"
                      key={p.id}
                      className="py-2 px-2 text-center text-xs font-bold"
                    >
                      <div>{p.label}</div>
                      <div className="font-mono text-[11px] font-normal">
                        {p.start}
                      </div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rooms.map((room) => (
                  <tr key={room.id} className="border-b border-[var(--ink)]/25">
                    <th scope="row" className="py-2.5 px-3 text-sm font-bold text-left">
                      <div>{room.name}</div>
                      <div className="text-xs font-normal capitalize">
                        {room.type}, floor {room.floor}
                      </div>
                    </th>

                    {periods.map((p) => {
                      if (p.isBreak) {
                        return (
                          <td key={p.id} className="p-1 text-center" title={p.label}>
                            <div
                              style={HATCH_STYLE}
                              className="h-9 rounded-lg border-2 border-dashed border-[var(--ink)]/50 flex items-center justify-center font-mono text-[10px]"
                            >
                              <span className="sr-only">{p.label}</span>
                              brk
                            </div>
                          </td>
                        );
                      }

                      if (room.isMaintenance) {
                        return (
                          <td key={p.id} className="p-1">
                            <div
                              style={HATCH_STYLE}
                              className="h-9 rounded-lg border-2 border-[var(--ink)] bg-slate-300 text-[#15163a] flex items-center justify-center text-[10px] font-bold"
                            >
                              Maint
                            </div>
                          </td>
                        );
                      }

                      // Find scheduled class
                      const slot = timetable.find(
                        (s) =>
                          s.roomId === room.id &&
                          s.day === activeDay &&
                          String(s.periodId) === String(p.id)
                      );

                      const booking = activeBookings.find(
                        (b) =>
                          b.roomId === room.id &&
                          b.date === dateOfActiveDay &&
                          String(b.periodId) === String(p.id)
                      );

                      if (slot) {
                        return (
                          <td key={p.id} className="p-1">
                            <div
                              title={`${slot.branch}: ${slot.subject} (${slot.teacher})`}
                              className="h-9 px-1.5 rounded-lg border-2 border-[#15163a] bg-[var(--orange)] text-[#15163a] flex flex-col justify-center text-[10px] font-bold"
                            >
                              <span className="truncate">{slot.branch}</span>
                              <span className="truncate font-medium">{slot.subject}</span>
                            </div>
                          </td>
                        );
                      }

                      if (booking) {
                        return (
                          <td key={p.id} className="p-1">
                            <div
                              title={`${booking.status === 'approved' ? 'Approved' : 'Waiting for approval'}: ${booking.reason} by ${booking.bookedBy}`}
                              className={`h-9 px-1 rounded-lg border-2 border-[#15163a] text-[#15163a] flex items-center justify-center text-[10px] font-bold ${
                                booking.status === 'approved' ? 'bg-[var(--yellow)]' : 'bg-[var(--paper-2)] border-dashed'
                              }`}
                            >
                              <span className="truncate">{booking.bookedBy}{booking.status === 'approved' ? '' : ' (pending)'}</span>
                            </div>
                          </td>
                        );
                      }

                      return (
                        <td key={p.id} className="p-1">
                          <button
                            type="button"
                            onClick={() => openBooking(room, p.id, dateOfActiveDay)}
                            title={`Book ${room.name} for ${p.label}`}
                            aria-label={`Book ${room.name} for ${p.label}`}
                            className="w-full h-9 rounded-lg border-2 border-[#15163a] bg-[var(--mint)] hover:bg-[var(--yellow)] text-[#15163a] flex items-center justify-center text-xs font-bold transition-colors"
                          >
                            Free
                          </button>
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {!bookingsEnabled && (
        <p role="status" className="ticket p-4 text-sm font-bold">
          Booking is switched off because this site is not connected to a database.
        </p>
      )}

      {myActive.length > 0 && (
        <section aria-labelledby="my-bookings" className="ticket p-4 sm:p-5 space-y-3">
          <h3 id="my-bookings" className="text-base font-black">Your bookings</h3>
          {cancelError && (
            <p role="alert" className="rounded-xl border-2 border-[#15163a] bg-[var(--orange)] text-[#15163a] px-3 py-2 text-sm font-bold">
              {cancelError}
            </p>
          )}
          <ul className="space-y-2">
            {myActive.map((b) => {
              const room = rooms.find((r) => r.id === b.roomId);
              const period = periods.find((p) => String(p.id) === String(b.periodId));
              return (
                <li key={b.id} className="flex flex-wrap items-center justify-between gap-3 border-2 border-[var(--ink)] rounded-xl px-3 py-2">
                  <div className="min-w-0 text-sm">
                    <p className="font-bold truncate">
                      {room?.name || b.roomId}, {period?.label || 'period'} on {b.date}
                    </p>
                    <p className="opacity-80 truncate">{b.reason}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={`sticker ${b.status === 'approved' ? 'sticker--mint' : ''}`}>
                      {b.status === 'approved' ? 'Approved' : 'Waiting for approval'}
                    </span>
                    <button type="button" onClick={() => handleCancel(b.id)} className="btn btn--paper !py-1.5 min-h-[40px]">
                      Cancel booking
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>
        </section>
      )}

      {/* Booking dialog */}
      <AnimatePresence>
        {bookingRoom && (
          <motion.div
            key="booking-overlay"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: reduce ? 0.01 : 0.18 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#15163a]/75 overflow-y-auto"
          >
            <motion.div
              role="dialog"
              aria-modal="true"
              aria-labelledby="booking-title"
              {...pop}
              transition={popTransition}
              className="ticket w-full max-w-md p-5 sm:p-6 my-auto"
            >
              <div className="flex items-start justify-between gap-3 pb-3 border-b-2 border-[var(--ink)]">
                <div className="min-w-0">
                  <h3 id="booking-title" className="text-xl font-black leading-tight break-words">
                    <span className="misreg">Book {bookingRoom.name}</span>
                  </h3>
                  <p className="text-sm mt-1">
                    Request it for an extra lecture, a remedial session or a lab experiment. An admin approves it.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setBookingRoom(null)}
                  aria-label="Close"
                  className="btn btn--paper !p-2 min-h-[44px] min-w-[44px] shrink-0"
                >
                  <X className="w-5 h-5" aria-hidden="true" />
                </button>
              </div>

              {bookingSuccessMsg ? (
                <motion.div
                  initial={reduce ? false : { scale: 0.6, rotate: -8, opacity: 0 }}
                  animate={{ scale: 1, rotate: 0, opacity: 1 }}
                  transition={popTransition}
                  className="py-8 text-center space-y-2"
                  role="status"
                >
                  <CheckCircle2 className="w-14 h-14 mx-auto text-[var(--mint)]" aria-hidden="true" />
                  <h4 className="text-lg font-black">Request sent</h4>
                  <p className="text-sm">
                    {bookingRoom.name} is held for you on {bookingDate} until an admin approves it.
                  </p>
                </motion.div>
              ) : (
                <form onSubmit={handleConfirmBooking} className="space-y-4 mt-4">
                  <div>
                    <label htmlFor="booking-name" className="block text-sm font-bold mb-1">
                      Faculty / organizer name *
                    </label>
                    <input
                      id="booking-name"
                      type="text"
                      required
                      placeholder="e.g. Dr. Priya Mehta (CSE)"
                      value={bookedByName}
                      onChange={(e) => setBookedByName(e.target.value)}
                      className={FIELD}
                    />
                  </div>

                  <div>
                    <label htmlFor="booking-reason" className="block text-sm font-bold mb-1">
                      Purpose / subject *
                    </label>
                    <input
                      id="booking-reason"
                      type="text"
                      required
                      placeholder="e.g. Extra class: Algorithms doubt solving"
                      value={bookingReason}
                      onChange={(e) => setBookingReason(e.target.value)}
                      className={FIELD}
                    />
                  </div>

                  <div className="grid grid-cols-1 min-[420px]:grid-cols-2 gap-3">
                    <div>
                      <label htmlFor="booking-date" className="block text-sm font-bold mb-1">
                        Date
                      </label>
                      <input
                        id="booking-date"
                        type="date"
                        required
                        min={todayStr}
                        max={addDaysTo(todayStr, 60)}
                        value={bookingDate}
                        onChange={(e) => setBookingDate(e.target.value)}
                        className={FIELD}
                      />
                    </div>

                    <div>
                      <label htmlFor="booking-period" className="block text-sm font-bold mb-1">
                        Time slot
                      </label>
                      <select
                        id="booking-period"
                        value={bookingPeriodId}
                        onChange={(e) =>
                          setBookingPeriodId(
                            isNaN(Number(e.target.value))
                              ? e.target.value
                              : Number(e.target.value)
                          )
                        }
                        className={FIELD}
                      >
                        {teachingPeriods.map((p) => (
                          <option key={p.id} value={p.id}>
                            {p.label} ({p.start})
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  {bookingError && (
                    <p role="alert" className="rounded-xl border-2 border-[#15163a] bg-[var(--orange)] text-[#15163a] px-3 py-2 text-sm font-bold">
                      {bookingError}
                    </p>
                  )}

                  <div className="flex flex-wrap items-center justify-end gap-3 pt-4 border-t-2 border-[var(--ink)]">
                    <button
                      type="button"
                      onClick={() => setBookingRoom(null)}
                      className="btn btn--paper min-h-[44px]"
                    >
                      Cancel
                    </button>
                    <button type="submit" disabled={bookingBusy} className="btn btn--blue min-h-[44px] disabled:opacity-60">
                      {bookingBusy ? 'Sending…' : 'Request this room'}
                    </button>
                  </div>
                </form>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
