import { memo, useState } from 'react';
import { AlertCircle, AlertTriangle, OctagonAlert } from 'lucide-react';

import { cn } from '@/lib/utils';
import { MUST_FIX_LABEL, mustFixCountLabel } from '@/lib/timetable-plain-language';
import { Button } from '@/ui/button';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/ui/tooltip';
import type { CellConflictInfo, Violation } from '@/types';

/**
 * DRAFT-UX-C01 (S3) — one severity sign per class, shared by the grid cell and
 * the session details. Must fix and warning use distinct icons and colours
 * (never colour alone); the word stays in the accessible label.
 */
export function SeveritySign({ severity, className }: { severity: 'HARD' | 'SOFT'; className?: string }) {
	return severity === 'HARD'
		? <OctagonAlert className={cn('size-3.5 shrink-0 text-red-700', className)} aria-hidden="true" data-severity-icon="must-fix" />
		: <AlertTriangle className={cn('size-3.5 shrink-0 text-amber-700', className)} aria-hidden="true" data-severity-icon="warning" />;
}

/** "1 Must fix, 2 warnings" — the plain severity summary for a class. */
export function severitySummary(hardCount: number, softCount: number): string {
	return [
		// PLAIN-LANGUAGE-J2J3-C01 (J2): this interpolated the literal "Must fix"
		// while the SAME FILE already imports MUST_FIX_LABEL and uses it twice
		// below — a fourth copy of one plain word, in the one file that owns the
		// grid's severity sign. `mustFixCountLabel` is the shared
		// count-plus-label helper and is itself defined in terms of
		// MUST_FIX_LABEL, so the string is written once in the codebase. The
		// rendered text is byte-identical to before.
		hardCount > 0 ? mustFixCountLabel(hardCount) : null,
		softCount > 0 ? `${softCount} ${softCount === 1 ? 'warning' : 'warnings'}` : null,
	].filter(Boolean).join(', ');
}

/**
 * UX-AUDIT-FINDINGS-C01 (F3) — the per-entry severity indicator: a named,
 * focusable sign whose plain-language details are disclosed through a `@/ui`
 * Tooltip on hover and keyboard focus. Never a native `title` or `<details>`
 * (AGENTS.md §8).
 *
 * DRAFT-UX-C01 (S3) — SUPERSEDED the inline "Must fix · N" / "Schedule note ·
 * N" text badge: the cell shows the compact severity sign (with the count
 * beside it only when N>1). The note text lives in the tooltip and in the
 * session details. Which violations are shown is unchanged.
 */
export const EntrySeverityIndicator = memo(function EntrySeverityIndicator({
	severity,
	reasons,
	warnings,
	formatWarningMessage,
	reviewFocused = false,
}: {
	severity: 'HARD' | 'SOFT';
	reasons: readonly string[];
	warnings?: readonly Violation[];
	formatWarningMessage?: (message: string, violation?: Violation) => string;
	reviewFocused?: boolean;
}) {
	const allWarnings = warnings?.length
		? warnings
		: reasons.map((message) => ({ severity, message }) as Violation);
	const hardCount = allWarnings.filter((warning) => warning.severity === 'HARD').length;
	const softCount = allWarnings.filter((warning) => warning.severity === 'SOFT').length;
	const warningSummary = severitySummary(hardCount, softCount);
	return (
		<TooltipProvider delayDuration={200}>
			<Tooltip>
				<TooltipTrigger asChild>
					<span
						role="img"
						aria-label={warningSummary}
						tabIndex={0}
						data-testid="timetable-entry-severity-indicator"
						data-severity={severity.toLowerCase()}
						data-review-focus={reviewFocused ? 'true' : undefined}
						className={cn(
							'inline-flex shrink-0 items-center gap-0.5 rounded px-0.5 py-0.5 text-xs font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-1',
							severity === 'HARD' ? 'bg-red-100 text-red-800' : 'bg-amber-100 text-amber-900',
						)}
					>
						<SeveritySign severity={severity} />
						{allWarnings.length > 1 ? <span aria-hidden="true">{allWarnings.length}</span> : null}
					</span>
				</TooltipTrigger>
				<TooltipContent side="bottom" className="z-100 max-w-sm space-y-1.5 p-2 text-xs" data-testid="timetable-entry-warning-tooltip">
					<p className={cn('font-semibold', severity === 'HARD' ? 'text-red-800' : 'text-amber-900')}>{warningSummary}</p>
					{allWarnings.map((warning, warningIndex) => (
						<p key={`${warning.severity}-${warningIndex}`}>
							<span className="font-semibold">{warning.severity === 'HARD' ? 'Must fix: ' : 'Warning: '}</span>
							{formatWarningMessage?.(warning.message, warning) ?? warning.message}{' '}
							<span className="font-medium">{warning.severity === 'HARD' ? 'This blocks saving and publishing.' : 'This does not block saving or publishing.'}</span>
						</p>
					))}
				</TooltipContent>
			</Tooltip>
		</TooltipProvider>
	);
});

/**
 * TIMETABLE-RELAXED-MAIN-C01 — the grid's per-cell hard/soft conflict badge,
 * extracted from `TimetableGrid.tsx` so that file stays inside the 1000-line
 * component budget. Behaviour is unchanged: the badge states the severity with
 * icon + text (never colour alone) and discloses the reasons, the displacement
 * list, and the entity navigation links through a `@/ui` Tooltip.
 *
 * LANE-C-PLAIN-LANGUAGE-C03 (J1) — the hard badge said "Blocked" while
 * `severitySummary` above said "Must fix" for the identical concept, so the
 * grid carried two names for one idea. Both now read MUST_FIX_LABEL.
 */
export const ConflictBadgeWithTooltip = memo(function ConflictBadgeWithTooltip({
	info,
	onNavToFaculty,
	onNavToSection,
	onNavToRoom,
}: {
	info: CellConflictInfo;
	onNavToFaculty: (id: number) => void;
	onNavToSection: (id: number) => void;
	onNavToRoom: (id: number) => void;
}) {
	const [isOpen, setIsOpen] = useState(false);

	const badge = (
		<div
			className={cn(
				'mb-0.5 flex h-4 cursor-default items-center gap-0.5 rounded-sm px-1 select-none',
				info.kind === 'hard' ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-700',
			)}
			onMouseEnter={() => setIsOpen(true)}
			onMouseLeave={() => setIsOpen(false)}
		>
			{info.kind === 'hard' ? (
				<AlertCircle className="size-3 shrink-0" />
			) : (
				<AlertTriangle className="size-3 shrink-0" />
			)}
			<span className="truncate text-xs leading-none font-medium">
				{info.kind === 'hard' ? MUST_FIX_LABEL : 'Warning'}
			</span>
			<span className="sr-only">
				{info.kind === 'hard' ? `${MUST_FIX_LABEL}: ` : 'Soft warning: '}
				{info.reasons.join(', ')}
			</span>
		</div>
	);

	if (!isOpen) return badge;

	return (
		<Tooltip open={isOpen} onOpenChange={setIsOpen}>
			<TooltipTrigger asChild>{badge}</TooltipTrigger>
			<TooltipContent side="right" className="z-100 max-w-64 space-y-1.5 p-2 text-xs">
				<p className={cn('font-semibold', info.kind === 'hard' ? 'text-red-700' : 'text-amber-700')}>
					{info.kind === 'hard' ? 'Must fix - fix before saving' : 'Warning - review before saving'}
				</p>
				{info.reasons.map((reason, reasonIndex) => (
					<p key={reasonIndex} className="text-muted-foreground">{reason}</p>
				))}
				{info.displaced.length > 0 && (
					<div className="space-y-0.5 border-t border-border/40 pt-1">
						<p className="font-medium text-xs">Displaces:</p>
						{info.displaced.slice(0, 3).map((displaced, displacedIndex) => (
							<p key={displacedIndex} className="text-xs text-muted-foreground">
								{displaced.subjectName} - unassigned
							</p>
						))}
					</div>
				)}
				{info.displaced.length > 0 && (
					<div className="flex flex-wrap gap-1.5 border-t border-border/40 pt-1">
						{Array.from(new Map(info.displaced.map((displaced: any) => [displaced.conflictType, displaced])).values()).map((displaced: any) => (
							<Button
								key={displaced.conflictType}
								variant="link"
								size="xs"
								className="h-auto p-0 text-xs"
								onMouseDown={(event) => {
									event.stopPropagation();
									if (displaced.conflictType === 'faculty') onNavToFaculty(displaced.entityId);
									else if (displaced.conflictType === 'section') onNavToSection(displaced.entityId);
									else onNavToRoom(displaced.entityId);
								}}
							>
								- View {displaced.conflictType === 'faculty' ? 'Teacher' : displaced.conflictType === 'section' ? 'Section' : 'Room'}
							</Button>
						))}
					</div>
				)}
			</TooltipContent>
		</Tooltip>
	);
});
