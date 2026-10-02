import { useMemo, type ReactNode } from 'react';
import { Check } from 'lucide-react';

import { plainRuleValue } from '@/lib/plain-rule-degradation';
import { ALL_SESSIONS_PLACED_LABEL, classesNeedingTime } from '@/lib/timetable-plain-language';
import { getDefaultUnassignedReasonDetail } from '@/lib/schedule-review-helpers';
import type { UnassignedItem } from '@/types';
import { Badge } from '@/ui/badge';
import { Button } from '@/ui/button';
import type { LeftRailContentContext } from '@/components/timetable/timetableContexts.types';

type GeneratedUnassignedPanelProps = {
	context: LeftRailContentContext;
	/** Kept for the left-rail call shape; rows show a plain sentence instead. */
	renderUnassignedReasonBadge?: (reason: string) => ReactNode;
};

type StatusKey = 'needs-owner' | 'needs-room' | 'ready' | 'blocked';

/** Shared with the Simple plotting trays so the same class has one status. */
export function getUnassignedStatus(
	item: UnassignedItem,
	cachedFix: LeftRailContentContext['unassignedFixSuggestions'][string] | undefined,
): { key: StatusKey; label: string; actionLabel: string; className: string } {
	if (!item.facultyId) return { key: 'needs-owner', label: 'Needs owner', actionLabel: 'Fix teaching load', className: 'border-amber-200 bg-amber-50 text-amber-800' };
	if (!item.homeRoomId) return { key: 'needs-room', label: 'Needs room', actionLabel: 'Review room source', className: 'border-sky-200 bg-sky-50 text-sky-800' };
	if (cachedFix === null) return { key: 'blocked', label: 'Still blocked', actionLabel: 'Still blocked', className: 'border-red-200 bg-red-50 text-red-800' };
	if (cachedFix?.suggestions?.length) return { key: 'ready', label: 'Ready to place', actionLabel: 'Place session', className: 'border-emerald-200 bg-emerald-50 text-emerald-800' };
	return { key: 'ready', label: 'Check slot', actionLabel: 'Place session', className: 'border-slate-200 bg-slate-50 text-slate-700' };
}

/** Retained for the rail caller that still renders the canonical reason badge. */
export function renderUnassignedReasonBadgeFor(labels: LeftRailContentContext['UNASSIGNED_REASON_LABELS'], reason: string) {
	const known = labels[reason];
	return (
		<Badge
			variant="outline"
			className={`h-4 px-1 text-xs ${known?.className ?? 'border-gray-300 bg-gray-50 text-gray-700 dark:bg-gray-900 dark:text-gray-300 dark:border-gray-700'}`}
		>
			{plainRuleValue(labels, reason, (entry) => entry.label)}
		</Badge>
	);
}

/** The item's own ordered term; missing authority is never presented as Term 1. */
export function unassignedTermLabel(termIndex: number | null | undefined): string {
	return typeof termIndex === 'number' && Number.isInteger(termIndex) && termIndex > 0
		? `Term ${termIndex}`
		: 'All year';
}

/** The Simple layout has no left rail, so its task drawer shares this queue. */
export function SimpleUnassignedSessionsPanel({ context }: { context: LeftRailContentContext }) {
	return <GeneratedUnassignedPanel context={context} />;
}

/**
 * One calm queue grouped by section, with the same selected-term count used by
 * the header. Each class has one Place action and its own term/session identity.
 */
export function GeneratedUnassignedPanel({ context }: GeneratedUnassignedPanelProps) {
	const {
		summary,
		filteredUnassignedItems,
		UNASSIGNED_REASON_LABELS,
		sectionLabel,
		subjectLabel,
		facultyLabel,
		unassignedCountForSelectedTerm,
		buildUnassignedKey,
		setKbSelectedSource,
		setSelectedEntry,
		setSelectedViolation,
		setSelectedUnassignedForRepair,
		openTacticalSandbox,
		toast,
	} = context;

	const count = typeof unassignedCountForSelectedTerm === 'number' ? unassignedCountForSelectedTerm : 0;
	const groups = useMemo(() => {
		const bySection = new Map<number, UnassignedItem[]>();
		for (const item of filteredUnassignedItems) {
			const rows = bySection.get(item.sectionId);
			if (rows) rows.push(item);
			else bySection.set(item.sectionId, [item]);
		}
		return [...bySection.entries()]
			.map(([sectionId, items]) => ({
				sectionId,
				label: sectionLabel(sectionId),
				items: [...items].sort((a, b) => (
					subjectLabel(a.subjectId).localeCompare(subjectLabel(b.subjectId))
					|| String(a.session).localeCompare(String(b.session))
				)),
			}))
			.sort((a, b) => a.label.localeCompare(b.label));
	}, [filteredUnassignedItems, sectionLabel, subjectLabel]);

	if (!summary) {
		return (
			<div id="panel-unassigned" role="tabpanel" aria-labelledby="tab-unassigned" className="flex flex-1 min-h-0 flex-col px-3 py-6 text-center text-xs text-muted-foreground">
				No schedule to show yet
			</div>
		);
	}

	return (
		<div id="panel-unassigned" role="tabpanel" aria-labelledby="tab-unassigned" className="flex flex-1 min-h-0 flex-col">
			<div className="shrink-0 border-b border-border/70 px-3 py-2">
				<h3 className="text-sm font-semibold text-foreground" data-testid="generated-unassigned-title">
					{classesNeedingTime(count)}
				</h3>
			</div>
			{groups.length > 0 ? (
				<ul className="flex-1 min-h-0 overflow-auto scrollbar-thin px-3 pb-3 pt-2" data-testid="generated-unassigned-list" aria-label="Classes needing a time slot">
					{groups.map((group) => (
						<li key={group.sectionId} className="mb-3" data-testid="generated-unassigned-section">
							<div className="mb-1 break-words text-xs font-semibold text-muted-foreground">{group.label}</div>
							<div className="grid gap-0.5">
								{group.items.map((item) => (
									<UnassignedRow
										key={buildUnassignedKey(item)}
										item={item}
										itemKey={buildUnassignedKey(item)}
										UNASSIGNED_REASON_LABELS={UNASSIGNED_REASON_LABELS}
										sectionLabel={sectionLabel}
										subjectLabel={subjectLabel}
										facultyLabel={facultyLabel}
										onPlace={() => {
											setSelectedEntry(null);
											setSelectedViolation(null);
											if (item.facultyId == null) {
												setSelectedUnassignedForRepair(item);
												openTacticalSandbox();
												toast.info('Teaching Load repair opened. Fix the owner there, then place the class.');
												return;
											}
											setSelectedUnassignedForRepair(null);
											setKbSelectedSource({ type: 'unassigned', item });
											toast.info('Class selected. Click a highlighted grid slot to place it.');
											}}
									/>
								))}
							</div>
						</li>
					))}
				</ul>
			) : count === 0 ? (
				<div className="px-3 py-4 text-center text-xs text-muted-foreground">
					<Check className="mx-auto mb-1 size-6 text-emerald-500" />
					{ALL_SESSIONS_PLACED_LABEL}
				</div>
			) : (
				<div className="px-3 py-4 text-center text-xs text-muted-foreground">No classes to show for this filter.</div>
			)}
		</div>
	);
}

function UnassignedRow({
	item,
	itemKey,
	UNASSIGNED_REASON_LABELS,
	sectionLabel,
	subjectLabel,
	facultyLabel,
	onPlace,
}: {
	item: UnassignedItem;
	itemKey: string;
	UNASSIGNED_REASON_LABELS: LeftRailContentContext['UNASSIGNED_REASON_LABELS'];
	sectionLabel: (id: number) => string;
	subjectLabel: (id: number) => string;
	facultyLabel: (id: number) => string;
	onPlace: () => void;
}) {
	const teacherText = item.facultyId != null ? facultyLabel(item.facultyId) : 'No teacher yet';
	const reasonText = UNASSIGNED_REASON_LABELS[item.reason]
		? plainRuleValue(UNASSIGNED_REASON_LABELS, item.reason, (entry) => entry.label)
		: getDefaultUnassignedReasonDetail(item);

	return (
		<div role="group" aria-label={`Unassigned session ${itemKey}: ${unassignedTermLabel(item.termIndex)}, Session ${item.session}`} data-testid="generated-unassigned-row" className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1 border-b border-border/40 px-1 py-1.5 text-xs last:border-b-0">
			<span className="min-w-0 break-words font-medium text-foreground">{subjectLabel(item.subjectId)}</span>
			<span aria-hidden="true" className="text-muted-foreground/50">·</span>
			<span className="min-w-0 break-words text-muted-foreground">{sectionLabel(item.sectionId)}</span>
			<span aria-hidden="true" className="text-muted-foreground/50">·</span>
			<span className="min-w-0 break-words text-muted-foreground">{teacherText}</span>
			{/* One calm label carries both scope facts, without repeating either. */}
			<span aria-hidden="true" className="text-muted-foreground/50">·</span>
			<span className="min-w-0 break-words text-muted-foreground">{unassignedTermLabel(item.termIndex)} · Session {item.session}</span>
			<span aria-hidden="true" className="text-muted-foreground/50">·</span>
			<span className="min-w-0 break-words text-muted-foreground">{reasonText}</span>
			<Button type="button" variant="outline" size="sm" className="ml-auto h-7 shrink-0 px-3 text-xs" onClick={onPlace}>
				Place
			</Button>
		</div>
	);
}
