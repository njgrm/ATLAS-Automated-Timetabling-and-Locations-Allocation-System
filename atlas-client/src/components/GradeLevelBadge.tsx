/**
 * GradeLevelBadge — Small grade-level chip using DepEd semantic colors.
 * GR7 = Green, GR8 = Yellow, GR9 = Red, GR10 = Blue.
 * Falls back to neutral styling for unknown grades.
 */

import { cn } from '@/lib/utils';

export interface GradeLevelBadgeProps {
	grade: number | null | undefined;
	size?: 'xs' | 'sm';
	className?: string;
	prefix?: string;
}

const GRADE_STYLES: Record<number, string> = {
	7: 'bg-green-100 text-green-800 border-green-300 dark:bg-green-900/40 dark:text-green-200 dark:border-green-700',
	8: 'bg-yellow-100 text-yellow-800 border-yellow-300 dark:bg-yellow-900/40 dark:text-yellow-200 dark:border-yellow-700',
	9: 'bg-red-100 text-red-800 border-red-300 dark:bg-red-900/40 dark:text-red-200 dark:border-red-700',
	10: 'bg-blue-100 text-blue-800 border-blue-300 dark:bg-blue-900/40 dark:text-blue-200 dark:border-blue-700',
};

export function GradeLevelBadge({ grade, size = 'xs', className, prefix = 'GR' }: GradeLevelBadgeProps) {
	if (grade == null || !Number.isFinite(grade)) return null;
	const style = GRADE_STYLES[grade] ?? 'bg-muted text-muted-foreground border-border';
	const sizing = size === 'sm'
		? 'px-1.5 py-0.5 text-[10px]'
		: 'px-1 py-0 text-[9px]';
	return (
		<span
			className={cn(
				'inline-flex items-center rounded-md border font-bold uppercase tracking-wider leading-none',
				sizing,
				style,
				className,
			)}
		>
			{prefix}{grade}
		</span>
	);
}

/** Extract a grade level (7-10) from a section name like "7-Rizal" or "Grade 8 - Mabini". */
export function parseGradeFromSectionName(name: string | null | undefined): number | null {
	if (!name) return null;
	const m = name.match(/(?:grade\s*)?(\d{1,2})\b/i);
	if (!m) return null;
	const n = Number(m[1]);
	return Number.isFinite(n) && n >= 7 && n <= 12 ? n : null;
}
