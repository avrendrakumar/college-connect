import React, { useState } from 'react';
import {
  AlertTriangle,
  Check,
  Copy,
  Database,
  ExternalLink,
  KeyRound,
  Link,
  Play,
  RefreshCw,
  ShieldAlert,
  Terminal,
  Trash2,
  UserCheck
} from 'lucide-react';
import {
  SetupStatus,
  SUPABASE_SQL_SCHEMA,
  saveCustomSupabaseConfig,
  clearCustomSupabaseConfig,
  getActiveSupabaseConfig
} from '../services/supabaseClient';

interface SetupCheckerProps {
  status: SetupStatus;
  onRefresh: () => void;
  onProceedDemo?: () => void;
  isChecking: boolean;
  requiredForAdminOnly?: boolean;
}

export const SetupChecker: React.FC<SetupCheckerProps> = ({
  status,
  onRefresh,
  onProceedDemo,
  isChecking,
  requiredForAdminOnly = false
}) => {
  const [copiedSQL, setCopiedSQL] = useState(false);
  const [copiedAdminSQL, setCopiedAdminSQL] = useState(false);
  const currentConfig = getActiveSupabaseConfig();
  const [inputUrl, setInputUrl] = useState(currentConfig.url || '');
  const [inputKey, setInputKey] = useState(currentConfig.anonKey || '');
  const [saveSuccess, setSaveSuccess] = useState(false);

  const adminEmail = status.currentUser?.email || 'YOUR_EMAIL@EXAMPLE.COM';
  const makeAdminSQL = `UPDATE public.profiles SET role = 'admin' WHERE id = (SELECT id FROM auth.users WHERE email = '${adminEmail.replace(/'/g, "''")}');`;

  const copyMigrationPath = () => {
    navigator.clipboard?.writeText(SUPABASE_SQL_SCHEMA).catch(() => {});
    setCopiedSQL(true);
    setTimeout(() => setCopiedSQL(false), 2000);
  };

  const copyAdminCommand = () => {
    navigator.clipboard?.writeText(makeAdminSQL).catch(() => {});
    setCopiedAdminSQL(true);
    setTimeout(() => setCopiedAdminSQL(false), 2000);
  };

  const handleSaveCredentials = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputUrl.trim() || !inputKey.trim()) return;
    saveCustomSupabaseConfig(inputUrl.trim(), inputKey.trim());
    setSaveSuccess(true);
    setTimeout(() => setSaveSuccess(false), 2500);
    onRefresh();
  };

  const handleClearCredentials = () => {
    clearCustomSupabaseConfig();
    setInputUrl('');
    setInputKey('');
    onRefresh();
  };

  return (
    <div className="min-h-[85vh] flex items-center justify-center p-4">
      <div className="w-full max-w-2xl rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xl p-6 sm:p-8 space-y-6">
        {/* Header */}
        <div className="flex items-start gap-4">
          <div className="w-12 h-12 rounded-2xl bg-amber-500/15 flex items-center justify-center text-amber-500 shrink-0">
            {status.missingEnvVars.length > 0 ? (
              <KeyRound className="w-6 h-6" />
            ) : status.currentUser && !status.isAdmin ? (
              <ShieldAlert className="w-6 h-6 text-rose-500" />
            ) : (
              <Database className="w-6 h-6" />
            )}
          </div>
          <div className="flex-1">
            <h2 className="text-xl font-bold text-slate-900 dark:text-white">
              {status.missingEnvVars.length > 0
                ? 'Supabase Connection Setup Required'
                : status.currentUser && !status.isAdmin
                ? 'Administrator Privileges Required'
                : 'Supabase Database Schema Missing'}
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 leading-relaxed">
              {status.missingEnvVars.length > 0
                ? 'Connect your Supabase project using the instant form below or via your .env file.'
                : status.currentUser && !status.isAdmin
                ? `You are currently authenticated as "${adminEmail}" with the role "student". Database Row Level Security (RLS) requires "admin" role to make changes.`
                : 'Your Supabase project is connected, but the required tables and Row Level Security policies have not been created yet.'}
            </p>
          </div>
        </div>

        {/* Quick Connect Form */}
        <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-800 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-xs font-bold text-slate-800 dark:text-slate-200">
              <Link className="w-4 h-4 text-indigo-500" />
              <span>Connect Supabase Project (Instant In-Browser Setup)</span>
            </div>
            {currentConfig.isCustom && (
              <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                Connected via Browser
              </span>
            )}
          </div>

          <form onSubmit={handleSaveCredentials} className="space-y-3">
            <div>
              <label className="block text-[11px] font-medium text-slate-600 dark:text-slate-400 mb-1">
                Project URL (from Supabase Dashboard &gt; Project Settings &gt; API)
              </label>
              <input
                type="text"
                placeholder="https://your-project-id.supabase.co"
                value={inputUrl}
                onChange={(e) => setInputUrl(e.target.value)}
                className="w-full px-3 py-2 rounded-xl text-xs font-mono bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>

            <div>
              <label className="block text-[11px] font-medium text-slate-600 dark:text-slate-400 mb-1">
                Project Anon Key (public "anon" key)
              </label>
              <input
                type="password"
                placeholder="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
                value={inputKey}
                onChange={(e) => setInputKey(e.target.value)}
                className="w-full px-3 py-2 rounded-xl text-xs font-mono bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>

            <div className="flex items-center justify-between pt-1">
              <div className="flex items-center gap-2">
                <button
                  type="submit"
                  className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-bold bg-indigo-600 hover:bg-indigo-500 text-white shadow-sm transition"
                >
                  {saveSuccess ? <Check className="w-3.5 h-3.5" /> : <Link className="w-3.5 h-3.5" />}
                  <span>{saveSuccess ? 'Saved & Connected!' : 'Save & Connect'}</span>
                </button>

                {currentConfig.isCustom && (
                  <button
                    type="button"
                    onClick={handleClearCredentials}
                    className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl text-xs text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/30 transition"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Clear</span>
                  </button>
                )}
              </div>

              <span className="text-[11px] text-slate-500 dark:text-slate-400">
                Or set in <code className="font-mono text-indigo-500 font-semibold">.env</code>
              </span>
            </div>
          </form>
        </div>


        {/* Missing Tables List */}
        {status.missingTables.length > 0 && status.missingEnvVars.length === 0 && (
          <div className="space-y-3">
            <div className="flex items-center justify-between text-xs">
              <span className="font-bold text-slate-700 dark:text-slate-300">
                Missing Tables ({status.missingTables.length} of {status.missingTables.length + status.checkedTables.length}):
              </span>
              <span className="text-[11px] text-rose-500 font-semibold">Not found in database</span>
            </div>

            <div className="p-3 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-800 max-h-40 overflow-y-auto">
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {status.missingTables.map((tbl) => (
                  <div
                    key={tbl}
                    className="flex items-center gap-1.5 text-[11px] font-mono text-rose-600 dark:text-rose-400"
                  >
                    <span className="w-1.5 h-1.5 rounded-full bg-rose-500" />
                    <span>{tbl}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Instruction on how to run schema */}
            <div className="p-4 rounded-2xl bg-indigo-50/70 dark:bg-indigo-950/40 border border-indigo-200 dark:border-indigo-900/60 space-y-2.5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-indigo-900 dark:text-indigo-200">
                  How to create all tables with 1 click:
                </span>
                <span className="text-[11px] font-mono text-indigo-600 dark:text-indigo-400 font-semibold">
                  supabase/migrations/001_schema.sql
                </span>
              </div>
              <ol className="list-decimal list-inside text-xs text-slate-700 dark:text-slate-300 space-y-1 leading-relaxed">
                <li>Open your <strong>Supabase Dashboard</strong> &gt; <strong>SQL Editor</strong> &gt; <strong>New Query</strong>.</li>
                <li>Open the file <code className="font-mono text-indigo-600 dark:text-indigo-300 font-bold">supabase/migrations/001_schema.sql</code> created in your project.</li>
                <li>Paste the entire content and click <strong>Run</strong>.</li>
              </ol>
            </div>
          </div>
        )}

        {/* Not Admin Guidance */}
        {status.currentUser && !status.isAdmin && (
          <div className="p-4 rounded-2xl bg-amber-50 dark:bg-amber-950/30 border border-amber-300 dark:border-amber-900/60 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-xs font-bold text-amber-800 dark:text-amber-300">
                <UserCheck className="w-4 h-4" />
                <span>Granting Administrator Access:</span>
              </div>
              <button
                onClick={copyAdminCommand}
                className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-bold bg-amber-600 hover:bg-amber-500 text-white shadow-sm transition"
              >
                {copiedAdminSQL ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copiedAdminSQL ? 'Copied SQL!' : 'Copy SQL Command'}</span>
              </button>
            </div>

            <p className="text-xs text-slate-600 dark:text-slate-400">
              Run this single command in the <strong>Supabase SQL Editor</strong> to promote your account to administrator:
            </p>

            <pre className="p-3 rounded-xl bg-slate-950 text-amber-300 font-mono text-[11px] overflow-x-auto border border-slate-800">
              {makeAdminSQL}
            </pre>
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex flex-wrap items-center justify-between gap-3 pt-4 border-t border-slate-200 dark:border-slate-800">
          <div className="flex items-center gap-2">
            <button
              onClick={onRefresh}
              disabled={isChecking}
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold bg-indigo-600 hover:bg-indigo-500 text-white shadow transition"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isChecking ? 'animate-spin' : ''}`} />
              <span>{isChecking ? 'Checking Database...' : 'Re-check Database Status'}</span>
            </button>

            <a
              href="https://supabase.com/dashboard"
              target="_blank"
              rel="noreferrer"
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-700 transition"
            >
              <span>Open Supabase Dashboard</span>
              <ExternalLink className="w-3.5 h-3.5" />
            </a>
          </div>

          {onProceedDemo && (
            <button
              onClick={onProceedDemo}
              className="flex items-center gap-1 px-3 py-2 rounded-xl text-xs font-semibold text-slate-500 hover:text-slate-900 dark:hover:text-white transition"
            >
              <Play className="w-3 h-3" />
              <span>Continue anyway (admin sign-in still required)</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
