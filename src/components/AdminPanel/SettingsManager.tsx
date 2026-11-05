import React, { useState } from 'react';
import { Building2, Check, Globe, Mail, MapPin, Phone, Save, Sliders } from 'lucide-react';
import { CollegeSettings } from '../../types';

interface SettingsManagerProps {
  settings: CollegeSettings;
  onSaveSettings: (settings: CollegeSettings) => void;
  onShowToast: (msg: string, type: 'success' | 'error' | 'info') => void;
}

export const SettingsManager: React.FC<SettingsManagerProps> = ({
  settings,
  onSaveSettings,
  onShowToast
}) => {
  const [collegeName, setCollegeName] = useState(settings.college_name || '');
  const [logoUrl, setLogoUrl] = useState(settings.logo_url || '');
  const [timezone, setTimezone] = useState(settings.timezone || 'Asia/Kolkata');
  const [academicYear, setAcademicYear] = useState(settings.academic_year || '');
  const [contactAddress, setContactAddress] = useState(settings.contact_address || '');
  const [contactPhone, setContactPhone] = useState(settings.contact_phone || '');
  const [contactEmail, setContactEmail] = useState(settings.contact_email || '');
  const [openingTime, setOpeningTime] = useState(settings.opening_time || '08:30');
  const [closingTime, setClosingTime] = useState(settings.closing_time || '17:00');
  const [workingDays, setWorkingDays] = useState<string[]>(settings.working_days || ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']);

  const allDays = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

  const toggleDay = (day: string) => {
    if (workingDays.includes(day)) {
      setWorkingDays(workingDays.filter((d) => d !== day));
    } else {
      setWorkingDays([...workingDays, day]);
    }
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    try {
      new Intl.DateTimeFormat('en-US', { timeZone: timezone.trim() });
    } catch {
      onShowToast(`"${timezone}" is not a valid IANA timezone (example: Asia/Kolkata)`, 'error');
      return;
    }
    if (!collegeName.trim()) {
      onShowToast('College name is required', 'error');
      return;
    }
    if (workingDays.length === 0) {
      onShowToast('Pick at least one working day.', 'error');
      return;
    }
    if (!openingTime || !closingTime || openingTime >= closingTime) {
      onShowToast('Opening time must be earlier than closing time.', 'error');
      return;
    }
    const updated: CollegeSettings = {
      id: 'current',
      college_name: collegeName.trim(),
      logo_url: logoUrl.trim() || undefined,
      timezone: timezone.trim(),
      academic_year: academicYear.trim(),
      working_days: allDays.filter((d) => workingDays.includes(d)),
      opening_time: openingTime,
      closing_time: closingTime,
      contact_address: contactAddress.trim(),
      contact_phone: contactPhone.trim(),
      contact_email: contactEmail.trim()
    };
    onSaveSettings(updated);
    onShowToast('College settings saved', 'success');
  };

  return (
    <form onSubmit={handleSave} className="space-y-6 max-w-4xl">
      <div className="flex items-center justify-between pb-3 border-b border-slate-200 dark:border-slate-800">
        <div>
          <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <Sliders className="w-5 h-5 text-indigo-500" />
            <span>Institute Configuration &amp; Settings</span>
          </h3>
          <p className="text-xs text-slate-500">
            Configure institute profile, official timezone, academic year, and contact details
          </p>
        </div>

        <button
          type="submit"
          className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold bg-indigo-600 hover:bg-indigo-500 text-white shadow transition"
        >
          <Save className="w-3.5 h-3.5" />
          <span>Save Configuration</span>
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* College Name */}
        <div className="p-5 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 space-y-3">
          <label className="block text-xs font-bold uppercase tracking-wider text-slate-500">
            College Name *
          </label>
          <input
            type="text"
            required
            value={collegeName}
            onChange={(e) => setCollegeName(e.target.value)}
            className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white"
          />
          <p className="text-[11px] text-slate-400">
            Rendered on public banners, timetable headers, and print layouts.
          </p>
        </div>

        {/* Timezone */}
        <div className="p-5 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 space-y-3">
          <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
            <Globe className="w-3.5 h-3.5 text-indigo-500" />
            <span>Campus Timezone *</span>
          </label>
          <select
            value={timezone}
            onChange={(e) => setTimezone(e.target.value)}
            className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white font-mono"
          >
            <option value="Asia/Kolkata">Asia/Kolkata (IST +5:30) [Default]</option>
            <option value="UTC">UTC (Coordinated Universal Time)</option>
            <option value="America/New_York">America/New_York (EST/EDT)</option>
            <option value="America/Los_Angeles">America/Los_Angeles (PST/PDT)</option>
            <option value="Europe/London">Europe/London (GMT/BST)</option>
            <option value="Asia/Singapore">Asia/Singapore (SGT)</option>
            <option value="Asia/Dubai">Asia/Dubai (GST)</option>
          </select>
          <p className="text-[11px] text-slate-400">
            Schedule timers and room availability calculate relative to this timezone.
          </p>
        </div>

        {/* Academic Year */}
        <div className="p-5 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 space-y-3">
          <label className="block text-xs font-bold uppercase tracking-wider text-slate-500">
            Academic Year
          </label>
          <input
            type="text"
            placeholder="e.g. 2026-2027"
            value={academicYear}
            onChange={(e) => setAcademicYear(e.target.value)}
            className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white"
          />
        </div>

        {/* Logo URL */}
        <div className="p-5 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 space-y-3">
          <label className="block text-xs font-bold uppercase tracking-wider text-slate-500">
            Custom Logo URL (Optional)
          </label>
          <input
            type="text"
            placeholder="https://example.com/logo.png"
            value={logoUrl}
            onChange={(e) => setLogoUrl(e.target.value)}
            className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white"
          />
        </div>
      </div>

      {/* Working Days */}
      <div className="p-5 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 space-y-3">
        <label className="block text-xs font-bold uppercase tracking-wider text-slate-500">
          Official College Working Days
        </label>
        <div className="flex flex-wrap gap-2">
          {allDays.map((d) => {
            const active = workingDays.includes(d);
            return (
              <button
                type="button"
                key={d}
                onClick={() => toggleDay(d)}
                className={`px-3 py-1.5 rounded-xl text-xs font-semibold border transition ${
                  active
                    ? 'bg-indigo-600 text-white border-indigo-600'
                    : 'bg-slate-50 dark:bg-slate-800 text-slate-500 border-slate-200 dark:border-slate-700'
                }`}
              >
                {d}
              </button>
            );
          })}
        </div>
      </div>

      {/* Opening hours */}
      <div className="p-5 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 space-y-3">
        <label className="block text-xs font-bold text-slate-500">Opening hours</label>
        <p className="text-[11px] text-slate-500">
          Outside these hours (24-hour clock, college timezone) the public page shows the college as closed. Classes still follow your periods.
        </p>
        <div className="grid grid-cols-2 gap-3 max-w-sm">
          <div>
            <label htmlFor="opening-time" className="text-[11px] text-slate-400 block mb-1">Opens at</label>
            <input
              id="opening-time"
              type="time"
              required
              value={openingTime}
              onChange={(e) => setOpeningTime(e.target.value)}
              className="w-full px-3 py-2 text-sm font-mono rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>
          <div>
            <label htmlFor="closing-time" className="text-[11px] text-slate-400 block mb-1">Closes at</label>
            <input
              id="closing-time"
              type="time"
              required
              value={closingTime}
              onChange={(e) => setClosingTime(e.target.value)}
              className="w-full px-3 py-2 text-sm font-mono rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>
        </div>
      </div>

      {/* Contact Details (Address, Phone, Email) */}
      <div className="p-5 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 space-y-3">
        <label className="block text-xs font-bold uppercase tracking-wider text-slate-500">
          Public Contact &amp; Campus Registry Details
        </label>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div>
            <span className="text-[11px] text-slate-400 block mb-1">Campus Address</span>
            <input
              type="text"
              value={contactAddress}
              onChange={(e) => setContactAddress(e.target.value)}
              className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white"
            />
          </div>

          <div>
            <span className="text-[11px] text-slate-400 block mb-1">Telephone</span>
            <input
              type="text"
              value={contactPhone}
              onChange={(e) => setContactPhone(e.target.value)}
              className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white font-mono"
            />
          </div>

          <div>
            <span className="text-[11px] text-slate-400 block mb-1">Registrar Email</span>
            <input
              type="email"
              value={contactEmail}
              onChange={(e) => setContactEmail(e.target.value)}
              className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white"
            />
          </div>
        </div>
      </div>
    </form>
  );
};
