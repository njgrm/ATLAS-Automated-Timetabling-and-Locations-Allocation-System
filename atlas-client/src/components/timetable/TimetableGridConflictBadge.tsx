import { memo, useState } from 'react';
import { AlertCircle, AlertTriangle } from 'lucide-react';

import { cn } from '@/lib/utils';
import { Button } from '@/ui/button';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/ui/tooltip';
import type { CellConflictInfo } from '@/types';

/**
 * TIMETABLE-RELAXED-MAIN-C01 — the grid's per-cell hard/soft conflict badge,
 * extracted from `TimetableGrid.tsx` so that file stays inside the 1000-line
 * component budget. Behaviour is unchanged: the badge states "Blocked"/"Warning"
 * with icon + text (never colour alone) and discloses the reasons, the
 * displacement list, and the entity navigation links through a `@/ui` Tooltip.
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
				{info.kind === 'hard' ? 'Blocked' : 'Warning'}
			</span>
			<span className="sr-only">
				{info.kind === 'hard' ? 'Hard conflict: ' : 'Soft warning: '}
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
					{info.kind === 'hard' ? 'Blocked - fix before saving' : 'Warning - review before saving'}
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
