import React, { useState } from 'react';
import { Check, Copy, Database, ExternalLink, Globe, Shield, Terminal } from 'lucide-react';
import { SUPABASE_SQL_SCHEMA, isSupabaseConfigured } from '../../services/supabaseClient';

export const SupabaseDeployGuide: React.FC = () => {
  const [copied, setCopied] = useState(false);

  const handleCopySQL = () => {
    navigator.clipboard?.writeText(SUPABASE_SQL_SCHEMA).catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="space-y-8 max-w-4xl">
      {/* Status Banner */}
      <div
        className={`p-4 rounded-2xl border flex items-center justify-between gap-4 ${
          isSupabaseConfigured
            ? 'bg-emerald-50 dark:bg-emerald-950/20 border-emerald-300 dark:border-emerald-800 text-emerald-800 dark:text-emerald-300'
            : 'bg-indigo-50 dark:bg-indigo-950/20 border-indigo-200 dark:border-indigo-800 text-indigo-900 dark:text-indigo-200'
        }`}
      >
        <div className="flex items-center gap-3">
          <Database className="w-5 h-5 shrink-0" />
          <div className="text-xs">
            <span className="font-bold">
              Database Mode:{' '}
              {isSupabaseConfigured
                ? 'Supabase Cloud Postgres Connected'
                : 'Offline-First High-Speed Local Cache (Active)'}
            </span>
            <p className="opacity-80 mt-0.5">
              {isSupabaseConfigured
                ? 'All timetable updates, room bookings, and notices synchronize across devices in real-time.'
                : 'Working completely out-of-the-box offline! To synchronize multi-user shared data, follow the quick steps below.'}
            </p>
          </div>
        </div>
      </div>

      {/* Step 1: Supabase Setup & SQL Schema */}
      <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 shadow-sm space-y-4">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <span className="w-6 h-6 rounded-full bg-indigo-600 text-white flex items-center justify-center text-xs">
                1
              </span>
              <span>Supabase Cloud Database Setup (PostgreSQL + RLS)</span>
            </h3>
            <p className="text-xs text-slate-500 mt-1">
              Create a free project at supabase.com and paste this complete schema into the SQL Editor.
            </p>
          </div>

          <button
            onClick={handleCopySQL}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold bg-indigo-600 hover:bg-indigo-500 text-white shadow transition shrink-0"
          >
            {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
            <span>{copied ? 'SQL Copied!' : 'Copy SQL Schema'}</span>
          </button>
        </div>

        <div className="relative">
          <pre className="p-4 rounded-xl bg-slate-950 text-slate-200 font-mono text-[11px] overflow-x-auto max-h-72 border border-slate-800">
            {SUPABASE_SQL_SCHEMA}
          </pre>
        </div>
      </div>

      {/* Step 2: Environment Variables */}
      <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 shadow-sm space-y-3">
        <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
          <span className="w-6 h-6 rounded-full bg-indigo-600 text-white flex items-center justify-center text-xs">
            2
          </span>
          <span>Configure Environment Variables</span>
        </h3>
        <p className="text-xs text-slate-500">
          In your local <code className="text-indigo-500 font-mono">.env</code> file or deployment host, set:
        </p>

        <div className="p-3.5 rounded-xl bg-slate-950 font-mono text-xs text-teal-300 border border-slate-800 space-y-1">
          <div>VITE_SUPABASE_URL="https://sqsjgmhzrainnulcbebr.supabase.co"</div>
          <div>VITE_SUPABASE_ANON_KEY="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNxc2pnbWh6cmFpbm51bGNiZWJyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTM1NDEzMDEsImV4cCI6MjEwOTExNzMwMX0.T3dCZ3ZRHBqngAz0j7_n3CXGWjKTNRPIb3LszYrBpGM"</div>
        </div>
      </div>

      {/* Step 3: Deployment (Vercel / Netlify / Custom Domain) */}
      <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 shadow-sm space-y-4">
        <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
          <span className="w-6 h-6 rounded-full bg-indigo-600 text-white flex items-center justify-center text-xs">
            3
          </span>
          <span>Deploy for Free on Vercel or Netlify</span>
        </h3>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
          <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/40 space-y-2">
            <h4 className="font-bold text-slate-900 dark:text-white">Option A: Vercel</h4>
            <ol className="list-decimal list-inside space-y-1 text-slate-600 dark:text-slate-400">
              <li>Push repository to GitHub.</li>
              <li>Import repository into Vercel Dashboard.</li>
              <li>Build command: <code className="font-mono text-indigo-500">npm run build</code></li>
              <li>Output Directory: <code className="font-mono text-indigo-500">dist</code></li>
              <li>Add env vars: VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY.</li>
            </ol>
          </div>

          <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/40 space-y-2">
            <h4 className="font-bold text-slate-900 dark:text-white">Option B: Netlify</h4>
            <ol className="list-decimal list-inside space-y-1 text-slate-600 dark:text-slate-400">
              <li>Connect repository on Netlify.</li>
              <li>Build command: <code className="font-mono text-indigo-500">npm run build</code></li>
              <li>Publish directory: <code className="font-mono text-indigo-500">dist</code></li>
              <li>Add SPA redirect rule to <code className="font-mono">public/_redirects</code> (<code className="font-mono">/* /index.html 200</code>).</li>
            </ol>
          </div>
        </div>

        <div className="pt-2">
          <h4 className="font-bold text-xs text-slate-900 dark:text-white mb-1">
            Connecting a Custom Domain (e.g. schedule.yourcollege.edu)
          </h4>
          <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
            In Vercel or Netlify Settings &gt; Domains, add your domain. Add a CNAME record pointing <code className="font-mono text-indigo-500">schedule</code> to <code className="font-mono text-indigo-500">cname.vercel-dns.com</code>. SSL/HTTPS certificates are issued automatically for free via Let's Encrypt within 60 seconds.
          </p>
        </div>
      </div>
    </div>
  );
};
