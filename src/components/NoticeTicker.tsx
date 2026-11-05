import React, { useState } from 'react';
import { Bell, Siren, X } from 'lucide-react';
import { Notice } from '../types';

interface NoticeTickerProps {
  notices: Notice[];
  /** Today's date (YYYY-MM-DD) in the college timezone; notices outside their date window are hidden. */
  todayStr?: string;
}

/** A strip of tape across the top of the page; notices scroll past and pause when pointed at. */
export const NoticeTicker: React.FC<NoticeTickerProps> = ({ notices, todayStr }) => {
  const [dismissed, setDismissed] = useState<string[]>([]);

  const active = notices.filter(
    (n) =>
      n.active &&
      !dismissed.includes(n.id) &&
      (!todayStr || ((!n.startDate || n.startDate <= todayStr) && (!n.endDate || n.endDate >= todayStr)))
  );

  if (active.length === 0) return null;

  const urgent = active.some((n) => n.priority === 'urgent');
  // Repeat the list so the loop has no gap; the second copy is hidden from assistive tech.
  const items = (copy: number) =>
    active.map((n) => (
      <span key={`${copy}-${n.id}`} className="inline-flex items-center gap-2 pr-10 whitespace-nowrap" aria-hidden={copy === 1}>
        {n.priority === 'urgent' ? <Siren className="w-4 h-4 shrink-0" /> : <Bell className="w-4 h-4 shrink-0 bell-icon" />}
        <strong className="font-bold">{n.title}</strong>
        <span>{n.content}</span>
      </span>
    ));

  return (
    <div
      role="region"
      aria-label="Notices"
      className={`relative z-30 border-b-2 border-[#15163a] text-[#15163a] text-sm no-print ${
        urgent ? 'bg-[var(--orange)]' : 'bg-[var(--yellow)]'
      }`}
    >
      <div className="max-w-7xl mx-auto flex items-stretch">
        <div className="marquee flex-1 overflow-hidden py-2 pl-4">
          <div className="marquee-track">
            <div className="flex">{items(0)}</div>
            <div className="flex">{items(1)}</div>
          </div>
        </div>
        <button
          type="button"
          onClick={() => setDismissed((prev) => [...prev, ...active.map((n) => n.id)])}
          aria-label="Dismiss notices"
          className="px-3 border-l-2 border-[#15163a] hover:bg-black/10 transition"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
};
