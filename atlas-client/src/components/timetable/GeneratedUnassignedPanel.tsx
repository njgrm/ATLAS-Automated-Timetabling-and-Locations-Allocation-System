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

/** The row's status, shared with the Simple plotting trays (`SimpleQueueHelpers`). */
function getUnassignedStatus(
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
	/* PLAIN-LANGUAGE-J2J3-C01 R1 (B1): the fallback used to be `label: reason`, so
	 * a reason the server adds before the client learns it rendered as a raw
	 * `NO_AVAILABLE_SLOT`-shaped token on the badge; the previous round changed it
	 * to a de-snake-cased phrase, which is a FALSE label — `UnassignedReason` is a
	 * canonical code space, not free-form text, so the same reason code was
	 * getting a different sentence here than in the publish-readiness warning
	 * group. The label now comes from the ONE shared rule over the same canonical
	 * map, so an unmapped reason gets the same honest sentence on every surface
	 * and never an enum in any casing. The className default is the neutral badge
	 * style, unchanged: an unmapped reason has no severity the client knows. */
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
				<ul
					className="flex-1 min-h-0 overflow-auto scrollbar-thin px-3 pb-3 pt-2"
					data-testid="generated-unassigned-list"
					aria-label="Classes needing a time slot"
				>
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
	// The reason is a plain sentence, never the raw code: the shared label when
	// the canonical map knows it, else the honest default detail.
	const reason = item.reason;
	const reasonText = UNASSIGNED_REASON_LABELS[reason]
		? plainRuleValue(UNASSIGNED_REASON_LABELS, reason, (entry) => entry.label)
		: getDefaultUnassignedReasonDetail(item);

	return (
		<div
			role="group"
			aria-label={`Unassigned session ${itemKey}`}
			data-testid="generated-unassigned-row"
			className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1 border-b border-border/40 px-1 py-1.5 text-xs last:border-b-0"
		>
			<span className="min-w-0 break-words font-medium text-foreground">{subjectLabel(item.subjectId)}</span>
			<span aria-hidden="true" className="text-muted-foreground/50">·</span>
			<span className="min-w-0 break-words text-muted-foreground">{sectionLabel(item.sectionId)}</span>
			<span aria-hidden="true" className="text-muted-foreground/50">·</span>
			<span className="min-w-0 break-words text-muted-foreground">{teacherText}</span>
			{/* Addendum (operator, 2026-09-30): five sessions of the same
			 * subject/section/teacher must be distinguishable, so the row names
			 * its own term and session in plain words, before the reason. A2
			 * move-swap c2 item 4 folded in: the term comes from the shared
			 * `unassignedTermLabel`, so a missing term reads `All year` — never
			 * a silent omission, and never a guessed `Term 1`. */}
			<span aria-hidden="true" className="text-muted-foreground/50">·</span>
			<span className="min-w-0 break-words text-muted-foreground">{unassignedTermLabel(item.termIndex)}</span>
			<span aria-hidden="true" className="text-muted-foreground/50">·</span>
			<span className="min-w-0 break-words text-muted-foreground">{`Session ${item.session}`}</span>
			<span aria-hidden="true" className="text-muted-foreground/50">·</span>
			<span className="min-w-0 break-words text-muted-foreground">{reasonText}</span>
			<Button type="button" variant="outline" size="sm" className="ml-auto h-7 shrink-0 px-3 text-xs" onClick={onPlace}>
				Place
			</Button>
		</div>
	);
}

export { getUnassignedStatus };
