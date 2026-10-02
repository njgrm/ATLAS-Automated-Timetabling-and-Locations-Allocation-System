import { useMemo, type ReactNode } from 'react';
import { Check } from 'lucide-react';

import { plainRuleValue } from '@/lib/plain-rule-degradation';
import { ALL_SESSIONS_PLACED_LABEL, classesNeedingTime } from '@/lib/timetable-plain-language';
import { getDefaultUnassignedReasonDetail } from '@/lib/schedule-review-helpers';
import type { UnassignedItem } from '@/types';
import { Badge } from '@/ui/badge';
import { Button } from '@/ui/button';
import type { LeftRailContentContext } from '@/components/timetable/timetableContexts.types';
/**
 * A2 move-swap c2 item 4 — the item's OWN ordered term, in the one vocabulary the
 * rest of the timetable uses (`Term N`), or `All year` when the item carries no
 * ordered term. A missing term identity is NEVER turned into Term 1
 * (AGENTS.md §7 / `agent-timetable-invariants`).
 */
export function unassignedTermLabel(termIndex: number | null | undefined): string {
	return typeof termIndex === 'number' && Number.isInteger(termIndex) && termIndex > 0 ? `Term ${termIndex}` : 'All year';
}

type GeneratedUnassignedPanelProps = {
	context: LeftRailContentContext;
	/** Kept for `LeftRailContent`'s call shape; the row renders a plain sentence. */
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

/** The rail's unresolved-reason badge (kept for `LeftRailContent`). */
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

/**
 * A5 (2026-09-30) — the Simple layout has no left rail, so its task drawer
 * renders this same panel: ONE list grouped by section, one calm line per class,
 * and one `Place` action.
 */
export function SimpleUnassignedSessionsPanel({ context }: { context: LeftRailContentContext }) {
	return <GeneratedUnassignedPanel context={context} />;
}

/**
 * A5 (2026-09-30) — the operator's acceptance for the Unassigned sessions panel:
 *
 *   the panel title says `N classes need a time slot`; ONE list grouped by
 *   section, each row one line: subject, section, teacher, why it could not be
 *   placed in plain words, and one button `Place` that opens the free slots for
 *   that class highlighted in the grid; no raw codes, no counts that disagree
 *   with the header, no nested scroll traps.
 *
 * `N` is `context.unassignedCountForSelectedTerm` — the SAME selected-term count
 * the More-menu item (`SimpleUnassignedSessionsItem`) is handed, derived once in
 * the workspace hook. A second count would be a defect.
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
			const existing = bySection.get(item.sectionId);
			if (existing) existing.push(item);
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
				{/* PLAIN-LANGUAGE-J2J3-C01 (J3): "draft data" is engine vocabulary. */}
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
				<ul className="flex-1 min-h-0 overflow-auto scrollbar-thin px-3 pb-2 pt-1" data-testid="generated-unassigned-list" aria-label="Classes needing a time slot">
					{groups.map((group) => (
						<li key={group.sectionId} className="mb-2 last:mb-0" data-testid="generated-unassigned-section">
							<div className="mb-0.5 break-words text-xs font-semibold leading-4 text-muted-foreground">{group.label}</div>
							<div className="grid gap-0">
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
												// No owner: the only honest next step is the Teaching
												// Load repair, not a grid slot that cannot be tested.
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
					{/* PLAIN-LANGUAGE-J2J3-C01 (J3): was "All classes assigned
					 * successfully" — wrong unit and an unearned promise. */}
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
	// The reason is plain language from the canonical map or its honest fallback.
	const reasonText = UNASSIGNED_REASON_LABELS[item.reason]
		? plainRuleValue(UNASSIGNED_REASON_LABELS, item.reason, (entry) => entry.label)
		: getDefaultUnassignedReasonDetail(item);

	return (
		<div role="group" aria-label={`Unassigned session ${itemKey}: ${unassignedTermLabel(item.termIndex)}, Session ${item.session}`} data-testid="generated-unassigned-row" className="grid min-w-0 grid-cols-[minmax(0,1fr)_auto] items-center gap-2 border-b border-border/40 px-1 py-1 text-xs last:border-b-0">
			<div className="min-w-0 space-y-0.5">
				<div className="flex min-w-0 flex-wrap items-baseline gap-x-1.5 leading-4">
					<span className="min-w-0 break-words font-medium text-foreground">{subjectLabel(item.subjectId)}</span>
					<span className="min-w-0 break-words text-muted-foreground">{sectionLabel(item.sectionId)}</span>
					<span className="min-w-0 break-words text-muted-foreground">{teacherText}</span>
				</div>
				{/* Scope facts and the reason stay readable in a compact second line. */}
				<div className="flex min-w-0 flex-wrap items-baseline gap-x-1.5 text-[11px] leading-4 text-muted-foreground">
					<span>{unassignedTermLabel(item.termIndex)} · Session {item.session}</span>
					<span className="break-words">{reasonText}</span>
				</div>
			</div>
			<Button type="button" variant="outline" size="sm" className="h-7 shrink-0 px-2 text-xs" onClick={onPlace}>
				Place
			</Button>
		</div>
	);
}
