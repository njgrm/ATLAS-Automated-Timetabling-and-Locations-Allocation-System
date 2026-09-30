import { Flag } from 'lucide-react';

import { cn } from '@/lib/utils';
import { Badge } from '@/ui/badge';
import { Button } from '@/ui/button';
import { DraggableUnassignedPin } from '@/components/timetable/DraggablePinWrappers';
import { getUnassignedStatus } from '@/components/timetable/GeneratedUnassignedPanel';
import { deriveRowReasonStack } from '@/components/timetable/simple/SimpleQueueHelpers';
import type { LeftRailContentContext } from '@/components/timetable/timetableContexts.types';
import type { UnassignedItem } from '@/types';

/**
 * A5 (2026-09-30) — extracted verbatim from `TimetableTaskDrawer.tsx` so that
 * file stays under AGENTS.md §8's 1000-physical-line cap. Behaviour is
 * unchanged: the unassigned queue row, its status action, Details, and the
 * follow-up flag.
 */
export function SimpleUnassignedQueueRow({
	context,
	item,
	index,
	displayed,
	selected,
	onSelect,
}: {
	context: LeftRailContentContext;
	item: UnassignedItem;
	index: number;
	displayed: boolean;
	selected: boolean;
	onSelect: (item: UnassignedItem) => void;
}) {
	const {
		buildUnassignedKey,
		sectionLabel,
		subjectLabel,
		unassignedFixSuggestions,
		setDrawerUnassigned,
		setFollowUps,
		followUps,
		GRADE_BADGE,
	} = context;
	const itemKey = buildUnassignedKey(item);
	const status = getUnassignedStatus(item, unassignedFixSuggestions[itemKey]);
	const gradeBadge = item.gradeLevel ? GRADE_BADGE[item.gradeLevel] : undefined;
	const followUp = followUps.has(itemKey);
	const isCurrent = displayed || index === 0;
	const actionLabel = status.key === 'ready'
		? 'Place session'
		: status.key === 'needs-room'
			? 'Choose room'
			: status.key === 'needs-owner'
				? 'Fix owner'
				: 'Review blocker';
	const reasonStack = deriveRowReasonStack(status, item.reason);

	return (
		<div role="listitem">
			<DraggableUnassignedPin
				itemKey={itemKey}
				item={item}
				disabled={false}
				onDragStart={() => onSelect(item)}
				className={cn(
					'rounded-xl border bg-background text-xs transition-colors',
					selected ? 'border-primary ring-2 ring-primary/70' : 'border-border hover:border-primary/50',
				)}
			>
				<div
					className="grid min-h-[72px] grid-cols-[1fr_auto] gap-2 p-2"
					data-testid={isCurrent ? 'simple-current-session-card' : 'simple-next-session-card'}
					data-simple-plotting-row="true"
					aria-current={selected ? 'true' : undefined}
				>
					<Button
						type="button"
						variant="ghost"
						className="h-auto min-w-0 justify-start p-0 text-left hover:bg-transparent"
						onClick={() => onSelect(item)}
						aria-pressed={selected}
						aria-label={`${actionLabel}: ${subjectLabel(item.subjectId)} for ${sectionLabel(item.sectionId)}, session ${item.session}`}
					>
						<div className="min-w-0">
							<div className="flex min-w-0 items-center gap-1.5">
								{isCurrent ? <Badge variant="secondary" className="h-5 shrink-0 px-1.5 text-xs">{selected ? 'Selected' : 'Next'}</Badge> : null}
								{gradeBadge ? <Badge variant="outline" className={`h-5 shrink-0 px-1.5 text-xs ${gradeBadge}`}>GR{item.gradeLevel}</Badge> : null}
								<span className="truncate font-semibold text-foreground">{sectionLabel(item.sectionId)}</span>
							</div>
							<p className="mt-0.5 truncate text-xs text-muted-foreground">
								{subjectLabel(item.subjectId)} · Session {item.session}
							</p>
							<p className={cn('mt-1 inline-flex max-w-full rounded-full border px-2 py-0.5 text-xs font-semibold', status.className)}>
								<span className="truncate">{status.label}</span>
							</p>
							{isCurrent && reasonStack && reasonStack.mainIssue !== 'Needs attention' && (
								<p className="mt-1 text-xs leading-tight text-muted-foreground" data-testid="timetable-row-reason-stack">
									<span className="font-medium text-foreground/80">Main issue:</span> {reasonStack.mainIssue} · <span className="font-medium text-foreground/80">First fix:</span> {reasonStack.firstFix}
								</p>
							)}
						</div>
					</Button>
					<div className="flex min-w-[7.5rem] flex-col justify-center gap-1">
						<Button type="button" size="sm" variant={status.key === 'ready' ? 'default' : 'outline'} className="h-11 px-3 text-sm" disabled={status.key === 'blocked'} onClick={() => onSelect(item)} aria-pressed={selected}>
							<span className="truncate">{selected ? 'Selected' : actionLabel}</span>
						</Button>
						<div className="grid grid-cols-2 gap-1">
							<Button type="button" variant="ghost" size="sm" className="h-7 px-1.5 text-xs" onClick={() => setDrawerUnassigned(item)}>
								Details
							</Button>
							<Button
								type="button"
								variant="ghost"
								size="sm"
								aria-label={followUp ? 'Remove follow-up flag' : 'Flag for follow-up'}
								className={cn('h-7 px-1.5 text-xs', followUp ? 'text-amber-600' : '')}
								onClick={() => {
									setFollowUps((prev) => {
										const next = new Set(prev);
										if (next.has(itemKey)) next.delete(itemKey);
										else next.add(itemKey);
										return next;
									});
								}}
							>
								<Flag className={cn('size-3', followUp ? 'fill-amber-500' : '')} aria-hidden="true" />
							</Button>
						</div>
					</div>
				</div>
			</DraggableUnassignedPin>
		</div>
	);
}
