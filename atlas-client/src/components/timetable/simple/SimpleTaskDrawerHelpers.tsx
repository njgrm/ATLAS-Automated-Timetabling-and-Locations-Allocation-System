import { useMemo, useState } from 'react';
import { CheckCircle2, ExternalLink } from 'lucide-react';

import { Button } from '@/ui/button';
import type { Violation } from '@/types';

export type RepairOrigin = {
	reason: string;
	plainReason: string;
	groupCount: number;
};

export type BlockerGroup = {
	reason: string;
	plainLabel: string;
	count: number;
	actionLabel: string;
	actionHref: string;
	items: Array<{
		sectionName: string;
		subjectName: string;
		facultyName: string;
		reason: string;
	}>;
};

export const UNASSIGNED_GROUP_MAP: Record<string, { plainLabel: string; actionLabel: string; actionHref: string; nextStep: string }> = {
	FACULTY_OVERLOADED: { plainLabel: 'Teachers are overloaded', actionLabel: 'Review Teaching Load', actionHref: '/teaching-load', nextStep: 'Teacher workload is full. Move some classes or assign another teacher.' },
	NO_QUALIFIED_FACULTY: { plainLabel: 'No qualified teacher is assigned', actionLabel: 'Assign a qualified teacher', actionHref: '/teaching-load', nextStep: 'No qualified teacher is assigned. Build or repair Teaching Load.' },
	NO_AVAILABLE_SLOT: { plainLabel: 'No available time slot', actionLabel: 'Review timetable slots or policy', actionHref: '/timetable', nextStep: 'No allowed time slot was found. Try manual placement or review the scheduling policy.' },
	NO_COMPATIBLE_ROOM: { plainLabel: 'No compatible room found', actionLabel: 'Review room setup', actionHref: '/campus-rooms', nextStep: 'No compatible room was found. Review room setup.' },
	ROOM_CAPACITY_EXCEEDED: { plainLabel: 'Room capacity exceeded', actionLabel: 'Review room assignment', actionHref: '/campus-rooms', nextStep: 'The room is too small for this class. Choose a larger room.' },
};

export function buildBlockerGroups(
	violations: Violation[],
	sectionLabelFn: (id: number) => string,
	subjectLabelFn: (id: number) => string,
	facultyLabelFn: (id: number) => string,
): BlockerGroup[] {
	const hardViolations = violations.filter((v) => v.severity === 'HARD');
	const groups = new Map<string, BlockerGroup>();

	for (const v of hardViolations) {
		const code = v.code;
		const groupConfig = UNASSIGNED_GROUP_MAP[code];
		if (!groupConfig) continue;

		if (!groups.has(code)) {
			groups.set(code, {
				reason: code,
				plainLabel: groupConfig.plainLabel,
				count: 0,
				actionLabel: groupConfig.actionLabel,
				actionHref: groupConfig.actionHref,
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
				reason: groupConfig.nextStep,
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
	softCount,
	violations,
	sectionLabel,
	subjectLabel,
	facultyLabel,
	onPublish,
	onReviewIssues,
	onPlaceUnresolved,
}: {
	runId: number | null;
	assignedCount: number;
	unassignedCount: number;
	hardCount: number;
	softCount: number;
	violations: Violation[];
	sectionLabel: (id: number) => string;
	subjectLabel: (id: number) => string;
	facultyLabel: (id: number) => string;
	onPublish: () => void;
	onReviewIssues: () => void;
	onPlaceUnresolved: () => void;
}) {
	const blockerGroups = useMemo(
		() => buildBlockerGroups(violations, sectionLabel, subjectLabel, facultyLabel),
		[violations, sectionLabel, subjectLabel, facultyLabel],
	);

	return (
		<div className="space-y-3 p-3 text-sm">
			<div className="rounded-xl border border-border bg-muted/30 p-3" data-testid="timetable-publish-readiness-summary">
				<p className="font-semibold text-foreground">Publish checklist</p>
				{runId && (
					<p className="mt-1 text-xs text-muted-foreground">Run #{runId}</p>
				)}
				<ul className="mt-2 space-y-1.5 text-sm text-muted-foreground">
					<li>Assigned sessions: {assignedCount}</li>
					<li>Unresolved sessions: {unassignedCount}</li>
					<li>Hard blockers: {hardCount}</li>
					<li>Warnings to review: {softCount}</li>
				</ul>
			</div>

			{blockerGroups.map((group) => (
				<BlockerGroupCard key={group.reason} group={group} onNavigate={group.actionHref.includes('/teaching-load') ? onReviewIssues : onPlaceUnresolved} />
			))}

			{unassignedCount > 0 && hardCount === 0 && (
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

		{softCount > 0 && hardCount === 0 && unassignedCount === 0 && (
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

			{hardCount === 0 && unassignedCount === 0 && softCount === 0 && (
				<div className="flex items-start gap-2 rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-emerald-900">
					<CheckCircle2 className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
					<p className="text-sm">Schedule is clean and ready to publish.</p>
				</div>
			)}

			<Button
				type="button"
				className="h-11 w-full"
				disabled={hardCount > 0 || unassignedCount > 0}
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

	return (
		<div className="rounded-xl border border-red-200 bg-red-50 p-3 text-red-900" data-testid="timetable-publish-blocked-reason">
			<div className="flex items-start justify-between gap-2">
				<div className="min-w-0">
					<p className="text-sm font-semibold">{group.plainLabel}</p>
					<p className="mt-0.5 text-xs text-red-700">{group.count} session{group.count === 1 ? '' : 's'} affected</p>
				</div>
				<Button
					type="button"
					variant="outline"
					size="sm"
					className="h-7 shrink-0 gap-1 text-xs"
					onClick={onNavigate}
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
						<Button type="button" variant="ghost" size="sm" className="h-6 gap-1 text-xs text-red-700" onClick={() => setExpanded(!expanded)}>
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
					<p className="mt-0.5 text-xs text-amber-700">
						{repairOrigin.groupCount} session{repairOrigin.groupCount === 1 ? '' : 's'} affected.
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