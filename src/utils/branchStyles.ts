// Tailwind only generates classes it can see as complete strings, so every style is written out in full.
export interface BranchStyle {
  color: string;
  classes: {
    bgLight: string;
    bgDark: string;
    borderLight: string;
    borderDark: string;
    textLight: string;
    textDark: string;
  };
}

export const BRANCH_STYLES: BranchStyle[] = [
  { color: '#6366F1', classes: { bgLight: 'bg-indigo-50 text-indigo-700', bgDark: 'dark:bg-indigo-950/60 dark:text-indigo-300', borderLight: 'border-indigo-200', borderDark: 'dark:border-indigo-800', textLight: 'text-indigo-600', textDark: 'dark:text-indigo-400' } },
  { color: '#8B5CF6', classes: { bgLight: 'bg-violet-50 text-violet-700', bgDark: 'dark:bg-violet-950/60 dark:text-violet-300', borderLight: 'border-violet-200', borderDark: 'dark:border-violet-800', textLight: 'text-violet-600', textDark: 'dark:text-violet-400' } },
  { color: '#D97706', classes: { bgLight: 'bg-amber-50 text-amber-700', bgDark: 'dark:bg-amber-950/60 dark:text-amber-300', borderLight: 'border-amber-200', borderDark: 'dark:border-amber-800', textLight: 'text-amber-600', textDark: 'dark:text-amber-400' } },
  { color: '#0284C7', classes: { bgLight: 'bg-sky-50 text-sky-700', bgDark: 'dark:bg-sky-950/60 dark:text-sky-300', borderLight: 'border-sky-200', borderDark: 'dark:border-sky-800', textLight: 'text-sky-600', textDark: 'dark:text-sky-400' } },
  { color: '#059669', classes: { bgLight: 'bg-emerald-50 text-emerald-700', bgDark: 'dark:bg-emerald-950/60 dark:text-emerald-300', borderLight: 'border-emerald-200', borderDark: 'dark:border-emerald-800', textLight: 'text-emerald-600', textDark: 'dark:text-emerald-400' } },
  { color: '#E11D48', classes: { bgLight: 'bg-rose-50 text-rose-700', bgDark: 'dark:bg-rose-950/60 dark:text-rose-300', borderLight: 'border-rose-200', borderDark: 'dark:border-rose-800', textLight: 'text-rose-600', textDark: 'dark:text-rose-400' } },
  { color: '#0D9488', classes: { bgLight: 'bg-teal-50 text-teal-700', bgDark: 'dark:bg-teal-950/60 dark:text-teal-300', borderLight: 'border-teal-200', borderDark: 'dark:border-teal-800', textLight: 'text-teal-600', textDark: 'dark:text-teal-400' } },
  { color: '#C026D3', classes: { bgLight: 'bg-fuchsia-50 text-fuchsia-700', bgDark: 'dark:bg-fuchsia-950/60 dark:text-fuchsia-300', borderLight: 'border-fuchsia-200', borderDark: 'dark:border-fuchsia-800', textLight: 'text-fuchsia-600', textDark: 'dark:text-fuchsia-400' } }
];

export const branchStyleAt = (index: number): BranchStyle => BRANCH_STYLES[((index % BRANCH_STYLES.length) + BRANCH_STYLES.length) % BRANCH_STYLES.length];
