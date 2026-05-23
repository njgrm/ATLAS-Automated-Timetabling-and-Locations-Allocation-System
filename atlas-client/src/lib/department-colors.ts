/**
 * Shared department color palette for ATLAS.
 * 
 * Uses soft, professional tints rather than loud primary colors.
 * These are used across Subjects, Teachers, and Teaching Load pages
 * to provide immediate semantic context for which department a row belongs to.
 */

export type DepartmentColor = {
  bg: string;
  text: string;
  border: string;
  accent: string; // Used for icon-box tinting
};

export const DEPARTMENT_COLORS: Record<string, DepartmentColor> = {
  SCI: {
    bg: 'bg-emerald-50',
    text: 'text-emerald-700',
    border: 'border-emerald-100',
    accent: 'bg-emerald-100 text-emerald-600',
  },
  MATH: {
    bg: 'bg-blue-50',
    text: 'text-blue-700',
    border: 'border-blue-100',
    accent: 'bg-blue-100 text-blue-600',
  },
  ENG: {
    bg: 'bg-indigo-50',
    text: 'text-indigo-700',
    border: 'border-indigo-100',
    accent: 'bg-indigo-100 text-indigo-600',
  },
  FIL: {
    bg: 'bg-rose-50',
    text: 'text-rose-700',
    border: 'border-rose-100',
    accent: 'bg-rose-100 text-rose-600',
  },
  MAPEH: {
    bg: 'bg-purple-50',
    text: 'text-purple-700',
    border: 'border-purple-100',
    accent: 'bg-purple-100 text-purple-600',
  },
  AP: {
    bg: 'bg-amber-50',
    text: 'text-amber-700',
    border: 'border-amber-100',
    accent: 'bg-amber-100 text-amber-600',
  },
  ESP: {
    bg: 'bg-cyan-50',
    text: 'text-cyan-700',
    border: 'border-cyan-100',
    accent: 'bg-cyan-100 text-cyan-600',
  },
  TLE: {
    bg: 'bg-orange-50',
    text: 'text-orange-700',
    border: 'border-orange-100',
    accent: 'bg-orange-100 text-orange-600',
  },
};

export const DEFAULT_DEPARTMENT_COLOR: DepartmentColor = {
  bg: 'bg-slate-50',
  text: 'text-slate-700',
  border: 'border-slate-200',
  accent: 'bg-slate-100 text-slate-500',
};

/**
 * Resolves the appropriate color set for a department code.
 * Falls back to slate if the department is not recognized.
 */
export function getDepartmentColor(deptCode?: string | null): DepartmentColor {
  if (!deptCode) return DEFAULT_DEPARTMENT_COLOR;
  const upperCode = deptCode.toUpperCase();
  return DEPARTMENT_COLORS[upperCode] || DEFAULT_DEPARTMENT_COLOR;
}
