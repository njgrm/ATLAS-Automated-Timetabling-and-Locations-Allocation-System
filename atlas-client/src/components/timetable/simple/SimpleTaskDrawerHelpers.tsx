import { useMemo, useState } from 'react';
import { CheckCircle2, ExternalLink } from 'lucide-react';

import { Button } from '@/ui/button';
import { Badge } from '@/ui/badge';
import { ALL_SERIOUS_PROBLEMS_LABEL, HARD_COUNT_RELATIONSHIP_NOTE, MUST_FIX_LABEL, plainScopeLabel } from '@/lib/timetable-plain-language';
import { isBlockingHardViolation, resolveBlockerDestination } from '@/components/timetable/simplePublishReadiness';
import type { Violation } from '@/types';

export type RepairOrigin = {
	reason: string;
	plainReason: string;
	/**
	 * C1-a — the affected-session count of the blocker group the operator
	 * actually followed, carried from `BlockerGroupRow` through the shared
	 * repair dispatch. It was hard-coded to `0` at its only producer, so the
	 * banner printed "0 sessions affected" above a promise it could not keep.
	 *
	 * It is deliberately optional: the shared dispatcher has a second caller
	 * (`/timetable/setup`) that has no blocker group. `null`/`undefined` means
	 * "not known here", and the banner then omits the affected-sessions clause
	 * entirely rather than printing a zero or a guess.
	 */
	groupCount?: number | null;
};

export type BlockerGroupScope = 'run-wide' | 'selected-term';

export type BlockerGroup = {
	reason: string;
	plainLabel: string;
	count: number;
	actionLabel: string;
	actionHref: string;
	scope: BlockerGroupScope;
	items: Array<{
		sectionName: string;
		subjectName: string;
		facultyName: string;
		nextStep: string;
	}>;
};

/** Unassigned reason keys that actually occur on the wire. */
export const UNASSIGNED_GROUP_MAP: Record<string, { plainLabel: string; actionLabel: string; actionHref: string; nextStep: string }> = {
	FACULTY_OVERLOADED: { plainLabel: 'Teachers are overloaded', actionLabel: 'Review Teaching Load', actionHref: '/teaching-load', nextStep: 'Teacher workload is full. Move some classes or assign another teacher.' },
	NO_QUALIFIED_FACULTY: { plainLabel: 'No qualified teacher is assigned', actionLabel: 'Assign a qualified teacher', actionHref: '/teaching-load', nextStep: 'No qualified teacher is assigned. Build or repair Teaching Load.' },
	NO_AVAILABLE_SLOT: { plainLabel: 'No available time slot', actionLabel: 'Review timetable slots or policy', actionHref: '/timetable', nextStep: 'No allowed time slot was found. Try manual placement or review the scheduling policy.' },
	NO_COMPATIBLE_ROOM: { plainLabel: 'No compatible room found', actionLabel: 'Review room setup', actionHref: '/map', nextStep: 'No compatible room was found. Review room setup.' },
	ROOM_CAPACITY_EXCEEDED: { plainLabel: 'Room capacity exceeded', actionLabel: 'Review room assignment', actionHref: '/map', nextStep: 'The room is too small for this class. Choose a larger room.' },
	UNASSIGNED_SECTION: { plainLabel: 'Session needs placement', actionLabel: 'Place this session', actionHref: '/timetable', nextStep: 'This session was not placed. Review the unresolved reason.' },
};

/**
 * Real production HARD violation codes (C07B/B6). Grouping by the actual code
 * means a structural blocker is never silently dropped for lacking a reason-key
 * entry. Only allowlisted (publication-blocking) codes are grouped.
 */
export const HARD_VIOLATION_GROUP_MAP: Record<string, { plainLabel: string; actionLabel: string; actionHref: string; nextStep: string }> = {
	FACULTY_TIME_CONFLICT: { plainLabel: 'Teacher double-booked', actionLabel: 'Open in review', actionHref: '/timetable', nextStep: 'This teacher is booked in two classes at once. Move one class to another slot.' },
	ROOM_TIME_CONFLICT: { plainLabel: 'Room double-booked', actionLabel: 'Open in review', actionHref: '/timetable', nextStep: 'Two classes share this room at the same time. Move one to a different slot or room.' },
	SECTION_TIME_CONFLICT: { plainLabel: 'Section double-booked', actionLabel: 'Open in review', actionHref: '/timetable', nextStep: 'This section has overlapping classes. Move one class so students are not double-booked.' },
	FACULTY_OVERLOAD: { plainLabel: 'Teacher overloaded', actionLabel: 'Open Teaching Load', actionHref: '/teaching-load', nextStep: 'This teacher exceeds their weekly maximum. Reassign some classes.' },
	FACULTY_SUBJECT_NOT_QUALIFIED: { plainLabel: 'Teacher not qualified for subject', actionLabel: 'Open Teaching Load', actionHref: '/teaching-load', nextStep: 'This teaching-load assignment does not cover the subject. Repair Teaching Load.' },
	LACKING_FACULTY: { plainLabel: 'Missing faculty coverage', actionLabel: 'Open Teaching Load', actionHref: '/teaching-load', nextStep: 'No teacher covers this subject/grade. Assign a qualified teacher.' },
	INCOMPLETE_MODULAR_GROUP: { plainLabel: 'Incomplete modular group', actionLabel: 'Open in review', actionHref: '/timetable', nextStep: 'A modular group is missing sessions. Complete the group before publishing.' },
	ROOM_TYPE_MISMATCH: { plainLabel: 'Room type mismatch', actionLabel: 'Review rooms', actionHref: '/map', nextStep: 'The subject needs a specific room type. Move it or update the room.' },
	ROOM_FEATURE_MISMATCH: { plainLabel: 'Room missing a required feature', actionLabel: 'Review rooms', actionHref: '/map', nextStep: 'The assigned room lacks a required feature. Move the class or update the room.' },
	FACULTY_DAILY_MAX_EXCEEDED: { plainLabel: 'Daily maximum exceeded', actionLabel: 'Open Teaching Load', actionHref: '/teaching-load', nextStep: 'This teacher exceeds the daily maximum. Move a class to another day.' },
	UNASSIGNED_SECTION: { plainLabel: 'Session needs placement', actionLabel: 'Place this session', actionHref: '/timetable', nextStep: 'This session was not placed. Review the unresolved reason and place it.' },
};

const GROUP_CONFIG: Record<string, { plainLabel: string; actionLabel: string; actionHref: string; nextStep: string }> = {
	...UNASSIGNED_GROUP_MAP,
	...HARD_VIOLATION_GROUP_MAP,
};

const DEFAULT_GROUP_CONFIG = {
	plainLabel: 'Needs review',
	actionLabel: 'Open in review',
	actionHref: '/timetable',
	nextStep: 'Open the review rail and resolve this issue before publishing.',
};

function isGroupableBlocker(violation: Violation): boolean {
	// A group is only a publication blocker when the server allowlist says so,
	// or when the entry carries an explicit unassigned reason key.
	return isBlockingHardViolation(violation) || Boolean(UNASSIGNED_GROUP_MAP[violation.code]);
}

export function buildBlockerGroups(
	violations: Violation[],
	sectionLabelFn: (id: number) => string,
	subjectLabelFn: (id: number) => string,
	facultyLabelFn: (id: number) => string,
	scope: BlockerGroupScope = 'run-wide',
): BlockerGroup[] {
	const hardViolations = violations.filter((v) => v.severity === 'HARD' && isGroupableBlocker(v));
	const groups = new Map<string, BlockerGroup>();

	for (const v of hardViolations) {
		const code = v.code;
		const groupConfig = GROUP_CONFIG[code] ?? DEFAULT_GROUP_CONFIG;

		if (!groups.has(code)) {
			groups.set(code, {
				reason: code,
				plainLabel: groupConfig.plainLabel,
				count: 0,
				actionLabel: groupConfig.actionLabel,
				actionHref: groupConfig.actionHref,
				scope,
				items: [],
			});
		}

		const group = groups.get(code)!;
		group.count += 1;

		const sectionName = v.entities.sectionId != null ? sectionLabelFn(v.entities.sectionId) : '';
		const subjectName = v.entities.subjectId != null ? subjectLabelFn(v.entities.subjectId) : '';
		const facultyName = v.entities.facultyId != null ? facultyLabelFn(v.entities.facultyId) : '';

		if (sectionName || subjectName) {
			group.items.push({
				sectionName: sectionName || 'Unknown section',
				subjectName: subjectName || 'Unknown subject',
				facultyName: facultyName || 'No teacher assigned',
				nextStep: groupConfig.nextStep,
			});
		}
	}

	return Array.from(groups.values()).sort((a, b) => b.count - a.count);
}

export function PublishChecklistContent({
	runId,
	assignedCount,
	unassignedCount,
	hardCount,
	blockingHardCount,
	softCount,
	violationScopeLabel,
	violations,
	sectionLabel,
	subjectLabel,
	facultyLabel,
	onPublish,
	onReviewIssues,
	onPlaceUnresolved,
	onOpenTeachingLoad,
	onOpenRoomSetup,
	onSelectViolation,
}: {
	runId: number | null;
	assignedCount: number;
	unassignedCount: number;
	hardCount: number;
	/** Run-wide allowlist-filtered HARD count — the real publish gate (C07B/B6). */
	blockingHardCount?: number;
	softCount: number;
	/** Term scope of the `violations` list, labelled explicitly (C07B/B2). */
	violationScopeLabel?: string;
	violations: Violation[];
	sectionLabel: (id: number) => string;
	subjectLabel: (id: number) => string;
	facultyLabel: (id: number) => string;
	onPublish: () => void;
	onReviewIssues: () => void;
	onPlaceUnresolved: () => void;
	onOpenTeachingLoad?: (href: string) => void;
	onOpenRoomSetup?: () => void;
	onSelectViolation?: (violation: Violation) => void;
}) {
	const scopeLabel = violationScopeLabel ?? plainScopeLabel('selected-term');
	const blockerGroups = useMemo(
		() => buildBlockerGroups(violations, sectionLabel, subjectLabel, facultyLabel, 'selected-term'),
		[violations, sectionLabel, subjectLabel, facultyLabel],
	);
	// Fail-closed: when the run-wide allowlist count is unavailable, fall back to
	// the total HARD count so an unknown code can never silently become publishable.
	const runWideBlocking = typeof blockingHardCount === 'number' ? blockingHardCount : hardCount;
	const publishDisabled = runId == null || runWideBlocking > 0 || unassignedCount > 0;

	const navigateGroup = (group: BlockerGroup) => {
		// B3 — resolve through the one shared destination resolver.
		const destination = resolveBlockerDestination(group.reason, group.actionHref);
		if (destination.kind === 'teaching-load' && onOpenTeachingLoad) {
			onOpenTeachingLoad(destination.href ?? group.actionHref);
			return;
		}
		if (destination.kind === 'rooms' && onOpenRoomSetup) {
			onOpenRoomSetup();
			return;
		}
		if (destination.kind === 'placement') {
			onPlaceUnresolved();
			return;
		}
		if (destination.kind === 'review') {
			const match = destination.code
				? violations.find((v) => v.code === destination.code && v.severity === 'HARD')
					?? violations.find((v) => v.code === destination.code)
				: undefined;
			if (match) onSelectViolation?.(match);
			onReviewIssues();
			return;
		}
		onReviewIssues();
	};

	return (
		<div className="space-y-3 p-3 text-sm">
			<div className="rounded-xl border border-border bg-muted/30 p-3" data-testid="timetable-publish-readiness-summary">
				<p className="font-semibold text-foreground">Publish checklist</p>
				{runId && (
					<p className="mt-1 text-xs text-muted-foreground">Run #{runId}</p>
				)}
				<ul className="mt-2 space-y-1.5 text-sm text-muted-foreground">
					<li>Assigned sessions: {assignedCount}</li>
					{/* J1r (QA F3/F6) — `unassignedCount` is SESSIONS. The unresolved
					    queue holds placement obligations for a (session, term) pair,
					    and five other consumers of the same field already say so:
					    `ScheduleReviewWorkspaceHeader`, `SimpleSetupSharedControls`,
					    `TimetableTaskDrawer`, `GeneratedUnassignedPanel` and
					    `useTimetableMutations`. `classesProcessed` is a separate,
					    already-shown field on the line above, so calling this
					    "classes" was not plainer — it was wrong, and it
					    contradicted the "N sessions need placement" line a few lines
					    below. One count, one unit. */}
					<li>{unassignedCount} session{unassignedCount === 1 ? '' : 's'} still to place (whole year)</li>
					<li>{MUST_FIX_LABEL} (whole year): {runWideBlocking}</li>
					<li>{ALL_SERIOUS_PROBLEMS_LABEL} (whole year): {hardCount}</li>
					<li>Warnings to review (whole year): {softCount}</li>
				</ul>
				<p className="mt-1 text-[0.6875rem] text-muted-foreground" data-testid="timetable-publish-scope-note">
					{/* J1r (QA F11's tag-tolerant row found this one): the note said
					    "Blockers listed below", so a count and the retired noun sat
					    one element apart. It is routed through the shared vocabulary
					    and the plain scope word like every other line here. */}
					Problems listed below are scoped to {scopeLabel}; the publish gate above is always the {plainScopeLabel('run-wide').toLowerCase()}.
				</p>
				{/* LANE-C-PLAIN-LANGUAGE-C03 (J1): this checklist is the one Simple
				    surface that shows more than one "hard" number, so the reason the
				    two figures can differ is stated here once, in plain words. */}
				<p className="mt-1 text-[0.6875rem] text-muted-foreground" data-testid="timetable-hard-count-relationship">
					{HARD_COUNT_RELATIONSHIP_NOTE}
				</p>
			</div>

			{blockerGroups.map((group) => (
				<BlockerGroupCard key={group.reason} group={group} onNavigate={() => navigateGroup(group)} />
			))}

			{unassignedCount > 0 && runWideBlocking === 0 && (
				<div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-amber-900">
					<p className="text-sm font-semibold">Sessions still unresolved</p>
					<p className="mt-1 text-xs">{unassignedCount} session{unassignedCount === 1 ? '' : 's'} need placement before publishing.</p>
<Button
					type="button"
					variant="outline"
					size="sm"
					className="mt-2 h-8 text-xs"
					onClick={onPlaceUnresolved}
				>
					Place unresolved sessions
				</Button>
			</div>
		)}

		{softCount > 0 && runWideBlocking === 0 && unassignedCount === 0 && (
			<div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-amber-900">
				<p className="text-sm font-semibold">Warnings to review</p>
				<p className="mt-1 text-xs">{softCount} warning{softCount === 1 ? '' : 's'} must be acknowledged before publish.</p>
				<Button
					type="button"
					variant="outline"
					size="sm"
					className="mt-2 h-8 text-xs"
					onClick={onReviewIssues}
				>
					Review warnings
				</Button>
			</div>
		)}

			{runId == null && (
				<div className="rounded-xl border border-slate-200 bg-muted/30 p-3 text-foreground" data-testid="timetable-publish-no-run">
					<p className="text-sm font-semibold">No timetable generated yet</p>
					<p className="mt-1 text-xs text-muted-foreground">Generate a timetable before reviewing publish readiness. Preview and readiness checks alone cannot be published.</p>
				</div>
			)}

			{runWideBlocking === 0 && unassignedCount === 0 && softCount === 0 && runId != null && (
				<div className="flex items-start gap-2 rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-emerald-900">
					<CheckCircle2 className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
					<p className="text-sm">Schedule is clean and ready to publish.</p>
				</div>
			)}

			<Button
				type="button"
				className="h-11 w-full"
				disabled={publishDisabled}
				onClick={onPublish}
			>
				Publish schedule
			</Button>
		</div>
	);
}

export function BlockerGroupCard({ group, onNavigate }: { group: BlockerGroup; onNavigate: () => void }) {
	const [expanded, setExpanded] = useState(false);
	const visibleItems = expanded ? group.items : group.items.slice(0, 3);
	const whyItMatters = group.items[0]?.nextStep ?? 'Fix this group before the schedule can be published.';
	const scopeLabel = plainScopeLabel(group.scope);
	const destination = resolveBlockerDestination(group.reason, group.actionHref);

	return (
		<div className="rounded-xl border border-red-200 bg-red-50 p-3 text-red-900" data-testid="timetable-publish-blocked-reason" data-blocker-scope={group.scope}>
			<div className="flex items-start justify-between gap-2">
				<div className="min-w-0">
					<p className="text-sm font-semibold">{group.plainLabel}</p>
					<p className="mt-0.5 text-xs text-red-700">
						<Badge variant="outline" className="mr-1 h-4 px-1 text-[0.625rem] font-normal">{scopeLabel}</Badge>
						{group.count} session{group.count === 1 ? '' : 's'} affected
					</p>
					<p className="mt-1 text-xs text-red-700">Why it matters: {whyItMatters}</p>
				</div>
				<Button
					type="button"
					variant="outline"
					size="sm"
					className="h-11 shrink-0 gap-1 px-3 text-xs"
					onClick={onNavigate}
					data-testid="timetable-publish-blocker-action"
					data-blocker-reason={group.reason}
					data-action-kind={destination.kind}
					data-action-href={destination.href ?? ''}
					aria-label={`${group.actionLabel}: ${group.plainLabel}, ${group.count} sessions affected`}
				>
					{group.actionLabel}
					<ExternalLink className="size-3" aria-hidden="true" />
				</Button>
			</div>

			{group.items.length > 0 && (
				<div className="mt-2 space-y-1.5">
					{visibleItems.map((item, index) => (
						<div key={index} className="rounded-lg border border-red-100 bg-white/60 px-2 py-1.5 text-xs">
							<p className="font-medium text-red-800">{item.sectionName} · {item.subjectName}</p>
							<p className="text-red-600">{item.facultyName}</p>
						</div>
					))}
					{group.items.length > 3 && (
						<Button type="button" variant="ghost" size="sm" className="h-11 gap-1 px-2 text-xs text-red-700" onClick={() => setExpanded(!expanded)} aria-expanded={expanded}>
							{expanded ? 'Show less' : `Show ${group.items.length - 3} more`}
						</Button>
					)}
				</div>
			)}
		</div>
	);
}

export function RepairContextBanner({
	repairOrigin,
	onBackToBlockerSummary,
	onClearFilter,
}: {
	repairOrigin: RepairOrigin;
	onBackToBlockerSummary?: () => void;
	onClearFilter?: () => void;
}) {
	// C1-a — an unknown count is not a zero. The clause renders only for a known
	// positive count, so the literal "0 sessions affected" is unreachable in
	// rendered output by construction, not by convention.
	const affectedSessionsClause = typeof repairOrigin.groupCount === 'number' && repairOrigin.groupCount > 0
		? `${repairOrigin.groupCount} session${repairOrigin.groupCount === 1 ? '' : 's'} affected. `
		: '';
	return (
		<div
			className="shrink-0 border-b border-amber-200 bg-amber-50 px-3 py-2"
			data-testid="timetable-repair-context-banner"
			role="status"
			aria-label={`Repairing: ${repairOrigin.plainReason}`}
		>
			<div className="flex items-start justify-between gap-2">
				<div className="min-w-0">
					<p className="text-xs font-semibold text-amber-900">
						Fixing publish blockers → {repairOrigin.plainReason}
					</p>
					<p className="mt-0.5 text-xs text-amber-700" data-testid="timetable-repair-affected-sessions">
						{affectedSessionsClause}
						ATLAS cannot test slots until this is resolved.
					</p>
				</div>
			</div>
			<div className="mt-1.5 flex gap-1.5">
				{onBackToBlockerSummary && (
					<Button
						type="button"
						variant="outline"
						size="sm"
						className="h-7 gap-1 text-xs"
						onClick={onBackToBlockerSummary}
						data-testid="timetable-repair-back-to-blockers"
					>
						<ExternalLink className="size-3" aria-hidden="true" />
						Back to blocker summary
					</Button>
				)}
				{onClearFilter && (
					<Button
						type="button"
						variant="ghost"
						size="sm"
						className="h-7 gap-1 text-xs text-amber-700"
						onClick={onClearFilter}
						data-testid="timetable-repair-clear-filter"
					>
						Clear filter
					</Button>
				)}
			</div>
		</div>
	);
}