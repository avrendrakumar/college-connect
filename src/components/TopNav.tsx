import React from 'react';
import { motion } from 'motion/react';
import {
  BellRing,
  CalendarDays,
  Clock,
  DoorOpen,
  Download,
  Moon,
  ShieldCheck,
  SlidersHorizontal,
  Sun,
  Table2
} from 'lucide-react';
import { usePWAInstall } from '../hooks/usePWAInstall';

type Tab = 'today' | 'timetable' | 'rooms' | 'calendar' | 'admin';

interface TopNavProps {
  activeTab: Tab;
  setActiveTab: (tab: Tab) => void;
  darkMode: boolean;
  setDarkMode: (val: boolean) => void;
  isSimulated: boolean;
  onOpenTimeMachine: () => void;
}

const TABS: Array<{ id: Tab; label: string; short: string; Icon: React.ComponentType<{ className?: string }> }> = [
  { id: 'today', label: 'Today', short: 'Today', Icon: Clock },
  { id: 'timetable', label: 'Timetable', short: 'Routine', Icon: Table2 },
  { id: 'rooms', label: 'Free rooms', short: 'Rooms', Icon: DoorOpen },
  { id: 'calendar', label: 'Holidays', short: 'Breaks', Icon: CalendarDays },
  { id: 'admin', label: 'Admin', short: 'Admin', Icon: ShieldCheck }
];

export const TopNav: React.FC<TopNavProps> = ({
  activeTab,
  setActiveTab,
  darkMode,
  setDarkMode,
  isSimulated,
  onOpenTimeMachine
}) => {
  const { isInstallable, install } = usePWAInstall();

  return (
    <header className="sticky top-0 z-40 px-3 sm:px-6 pt-3 no-print">
      <div className="ticket max-w-7xl mx-auto flex items-center justify-between gap-3 px-3 sm:px-4 py-2 !rounded-2xl !shadow-[4px_4px_0_var(--hard)]">
        <button
          type="button"
          onClick={() => setActiveTab('today')}
          className="bell flex items-center gap-2.5 shrink-0 text-left"
          aria-label="College Connect, go to Today"
        >
          <span className="w-10 h-10 rounded-xl border-2 border-[#15163a] bg-[var(--yellow)] text-[#15163a] flex items-center justify-center shadow-[2px_2px_0_#15163a]">
            <BellRing className="w-5 h-5 bell-icon" />
          </span>
          <span className="font-display font-black text-base sm:text-lg leading-none tracking-tight">
            college
            <br />
            <span className="text-[var(--blue)] dark:text-[var(--yellow)]">connect</span>
          </span>
        </button>

        <nav aria-label="Main" className="hidden md:flex items-center gap-1">
          {TABS.map(({ id, label, Icon }) => {
            const active = activeTab === id;
            return (
              <button
                key={id}
                type="button"
                onClick={() => setActiveTab(id)}
                aria-current={active ? 'page' : undefined}
                className={`relative px-3.5 py-2 rounded-xl text-sm font-bold flex items-center gap-1.5 transition-colors ${
                  active ? 'text-white' : 'hover:bg-[var(--yellow)] hover:text-[#15163a]'
                }`}
              >
                {active && (
                  <motion.span
                    layoutId="nav-pill"
                    className="absolute inset-0 rounded-xl bg-[var(--blue)] border-2 border-[#15163a] shadow-[2px_2px_0_#15163a]"
                    transition={{ type: 'spring', stiffness: 420, damping: 32 }}
                  />
                )}
                <span className="relative flex items-center gap-1.5">
                  <Icon className="w-4 h-4" />
                  {label}
                </span>
              </button>
            );
          })}
        </nav>

        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={onOpenTimeMachine}
            title="Time Machine: look at any day and hour"
            className={`btn !py-2 !px-3 ${isSimulated ? '!bg-[var(--orange)]' : 'btn--paper'}`}
          >
            <Clock className={`w-4 h-4 ${isSimulated ? 'animate-spin' : ''}`} style={{ animationDuration: '6s' }} />
            <span className="hidden sm:inline">{isSimulated ? 'Simulated time' : 'Time machine'}</span>
            <SlidersHorizontal className="w-3.5 h-3.5 hidden sm:block" />
          </button>

          {isInstallable && (
            <button type="button" onClick={install} className="btn btn--blue !py-2 !px-3 hidden lg:inline-flex">
              <Download className="w-4 h-4" />
              Install
            </button>
          )}

          <button
            type="button"
            onClick={() => setDarkMode(!darkMode)}
            aria-label={darkMode ? 'Switch to light mode' : 'Switch to dark mode'}
            className="w-10 h-10 rounded-xl border-2 border-current flex items-center justify-center hover:bg-[var(--yellow)] hover:text-[#15163a] hover:border-[#15163a] transition-colors"
          >
            {darkMode ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
          </button>
        </div>
      </div>

      {/* Phone bottom bar */}
      <nav
        aria-label="Main"
        className="md:hidden fixed bottom-3 left-3 right-3 z-50 ticket !rounded-2xl !shadow-[4px_4px_0_var(--hard)] flex justify-around p-1.5"
      >
        {TABS.map(({ id, short, Icon }) => {
          const active = activeTab === id;
          return (
            <button
              key={id}
              type="button"
              onClick={() => setActiveTab(id)}
              aria-current={active ? 'page' : undefined}
              className={`relative flex-1 flex flex-col items-center gap-0.5 py-1.5 rounded-xl text-[11px] font-bold ${
                active ? 'text-white' : ''
              }`}
            >
              {active && (
                <motion.span
                  layoutId="nav-pill-mobile"
                  className="absolute inset-0 rounded-xl bg-[var(--blue)] border-2 border-[#15163a]"
                  transition={{ type: 'spring', stiffness: 420, damping: 32 }}
                />
              )}
              <Icon className="w-4 h-4 relative" />
              <span className="relative">{short}</span>
            </button>
          );
        })}
      </nav>
    </header>
  );
};
