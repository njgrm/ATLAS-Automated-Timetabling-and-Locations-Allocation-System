import { memo, useEffect, useMemo, useState } from 'react';
import {
	ArrowRightLeft,
	CalendarClock,
	CheckCircle2,
	ClipboardCheck,
	ExternalLink,
	Flag,
	ListChecks,
	Search,
	Send,
	SkipForward,
	X,
	type LucideIcon,
} from 'lucide-react';

import { cn } from '@/lib/utils';
import { Badge } from '@/ui/badge';
import { Button } from '@/ui/button';
import { Input } from '@/ui/input';
import { ScrollArea } from '@/ui/scroll-area';
import { LeftRailContent } from '@/components/timetable/LeftRailContent';
import { getUnassignedStatus } from '@/components/timetable/GeneratedUnassignedPanel';
import { DraggableQueuePin, DraggableUnassignedPin } from '@/components/timetable/DraggablePinWrappers';
import type { LeftRailContentContext } from '@/components/timetable/timetableContexts.types';
import type { TimetableSimpleTask } from '@/components/timetable/TimetableSimpleTypes';
import type { DraftQueueItem, UnassignedItem, Violation } from '@/types';

type TimetableTaskDrawerProps = {
	task: TimetableSimpleTask | null;
	onTaskChange: (task: TimetableSimpleTask | null) => void;
	leftRailContentContext: LeftRailContentContext;
	hardCount: number;
	softCount: number;
	unassignedCount: number;
	assignedCount: number;
	runId: number | null;
	isPreGenerationWorkspace: boolean;
	onPublish: () => void;
	violations?: Violation[];
	sectionLabel?: (id: number) => string;
	subjectLabel?: (id: number) => string;
	facultyLabel?: (id: number) => string;
};

type DrawerCopy = {
	title: string;
	description: string;
	stepOne: string;
	stepTwo: string;
	icon: LucideIcon;
};

const copyByTask: Record<TimetableSimpleTask, DrawerCopy> = {
	'place-unresolved': {
		title: 'Place unresolved sessions',
		description: 'Choose one session from the queue, then choose a green slot on the grid. ATLAS shows a review before saving.',
		stepOne: 'Choose a session',
		stepTwo: 'Choose a green grid slot',
		icon: ClipboardCheck,
	},
	'swap-sessions': {
		title: 'Swap sessions',
		description: 'Choose the first class on the grid, then choose the class to switch with it. ATLAS opens a visual swap review.',
		stepOne: 'Choose first class',
		stepTwo: 'Choose class to switch with',
		icon: ArrowRightLeft,
	},
	'review-issues': {
		title: 'Review issues',
		description: 'Start with hard blockers. Warnings can be reviewed after blockers are clear.',
		stepOne: 'Read top issue',
		stepTwo: 'Choose the suggested fix',
		icon: ListChecks,
	},
	'plan-draft': {
		title: 'Plan before generating',
		description: 'Use the draft queue to anchor sessions before generating. Nothing is saved until the review is confirmed.',
		stepOne: 'Choose draft item',
		stepTwo: 'Choose a grid slot',
		icon: CalendarClock,
	},
	publish: {
		title: 'Publish schedule',
		description: 'Publish only when hard blockers are gone. Teachers and students can then use the final schedule.',
		stepOne: 'Confirm blockers are clear',
		stepTwo: 'Publish the schedule',
		icon: Send,
	},
};

type BlockerGroup = {
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

const UNASSIGNED_GROUP_MAP: Record<string, { plainLabel: string; actionLabel: string; actionHref: string; nextStep: string }> = {
	FACULTY_OVERLOADED: { plainLabel: 'Teachers are overloaded', actionLabel: 'Review Teaching Load', actionHref: '/teaching-load', nextStep: 'Teacher workload is full. Move some classes or assign another teacher.' },
	NO_QUALIFIED_FACULTY: { plainLabel: 'No qualified teacher is assigned', actionLabel: 'Assign a qualified teacher', actionHref: '/teaching-load', nextStep: 'No qualified teacher is assigned. Build or repair Teaching Load.' },
	NO_AVAILABLE_SLOT: { plainLabel: 'No available time slot', actionLabel: 'Review timetable slots or policy', actionHref: '/timetable', nextStep: 'No allowed time slot was found. Try manual placement or review the scheduling policy.' },
	NO_COMPATIBLE_ROOM: { plainLabel: 'No compatible room found', actionLabel: 'Review room setup', actionHref: '/campus-rooms', nextStep: 'No compatible room was found. Review room setup.' },
	ROOM_CAPACITY_EXCEEDED: { plainLabel: 'Room capacity exceeded', actionLabel: 'Review room assignment', actionHref: '/campus-rooms', nextStep: 'The room is too small for this class. Choose a larger room.' },
};

function buildBlockerGroups(
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

function PublishChecklistContent({
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

function BlockerGroupCard({ group, onNavigate }: { group: BlockerGroup; onNavigate: () => void }) {
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

function TimetableTaskDrawerImpl({
	task,
	onTaskChange,
	leftRailContentContext,
	hardCount,
	softCount,
	unassignedCount,
	assignedCount,
	runId,
	isPreGenerationWorkspace,
	onPublish,
	violations = [],
	sectionLabel = (id: number) => `Section #${id}`,
	subjectLabel = (id: number) => `Subject #${id}`,
	facultyLabel = (id: number) => `Teacher #${id}`,
}: TimetableTaskDrawerProps) {
	if (!task) return null;
	const copy = copyByTask[task];
	const Icon = copy.icon;
	const shouldShowRail = task === 'review-issues';

	return (
		<aside
			className="absolute inset-x-2 bottom-2 z-20 flex max-h-[72%] min-h-72 flex-col overflow-hidden rounded-2xl border border-border bg-background/98 shadow-2xl backdrop-blur md:static md:inset-auto md:z-auto md:h-full md:max-h-none md:w-[24rem] md:rounded-none md:border-y-0 md:border-r-0 md:shadow-none"
			data-testid="timetable-task-drawer"
			aria-label={copy.title}
		>
			<div className="shrink-0 border-b border-border px-3 py-2 [@media(max-height:500px)]:py-1.5">
				<div className="flex items-start justify-between gap-3">
					<div className="flex min-w-0 items-start gap-2">
						<div className="mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
							<Icon className="size-4" aria-hidden="true" />
						</div>
						<div className="min-w-0">
							<h2 className="truncate text-sm font-semibold text-foreground">{copy.title}</h2>
							<p className="line-clamp-1 text-xs leading-relaxed text-muted-foreground [@media(max-height:500px)]:hidden">{copy.description}</p>
						</div>
					</div>
					<Button
						type="button"
						variant="ghost"
						size="sm"
						className="h-9 w-9 shrink-0 p-0"
						onClick={() => onTaskChange(null)}
						aria-label="Close task drawer"
					>
						<X className="size-4" aria-hidden="true" />
					</Button>
				</div>
				<div className="mt-1.5 grid grid-cols-2 gap-1.5 [@media(max-height:500px)]:hidden">
					<div className="rounded-lg border border-border bg-muted/30 px-2 py-1.5">
						<p className="text-[0.68rem] font-bold uppercase tracking-wide text-muted-foreground">Step 1</p>
						<p className="truncate text-xs font-semibold text-foreground">{copy.stepOne}</p>
					</div>
					<div className="rounded-lg border border-border bg-muted/30 px-2 py-1.5">
						<p className="text-[0.68rem] font-bold uppercase tracking-wide text-muted-foreground">Step 2</p>
						<p className="truncate text-xs font-semibold text-foreground">{copy.stepTwo}</p>
					</div>
				</div>
				<div className="mt-1.5 flex flex-wrap gap-1.5 [@media(max-height:500px)]:hidden" aria-label="Task summary">
					{unassignedCount > 0 && <Badge variant="outline" className="h-5 text-xs">{unassignedCount > 99 ? '99+' : unassignedCount} unresolved</Badge>}
					{hardCount > 0 && <Badge variant="destructive" className="h-5 text-xs">{hardCount} blocker{hardCount === 1 ? '' : 's'}</Badge>}
					{softCount > 0 && <Badge variant="secondary" className="h-5 text-xs">{softCount} warning{softCount === 1 ? '' : 's'}</Badge>}
					{isPreGenerationWorkspace && <Badge variant="outline" className="h-5 text-xs">Draft mode</Badge>}
				</div>
			</div>

			{task === 'place-unresolved' ? (
				<SimpleGeneratedPlottingTray context={leftRailContentContext} />
			) : task === 'plan-draft' ? (
				<SimpleDraftPlottingTray context={leftRailContentContext} />
			) : shouldShowRail ? (
				<div className="flex min-h-0 flex-1 flex-col overflow-hidden">
					<LeftRailContent context={leftRailContentContext} />
				</div>
			) : task === 'swap-sessions' ? (
				<div className="flex min-h-0 flex-1 flex-col">
					<ScrollArea className="flex-1">
						<div className="space-y-3 p-3 text-sm">
							<div className="rounded-xl border border-border bg-muted/30 p-3">
								<p className="font-semibold text-foreground">How to switch</p>
								<ol className="mt-2 list-decimal space-y-1.5 pl-4 text-sm text-muted-foreground">
									<li>Tap or click the class you want to move.</li>
									<li>Tap or click another occupied class.</li>
									<li>Review the visual swap sheet before saving.</li>
								</ol>
							</div>
							<div className="flex items-start gap-2 rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-emerald-900">
								<CheckCircle2 className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
								<p className="text-sm">Teacher ownership stays in Teaching Load. Timetable only reviews the switch.</p>
							</div>
						</div>
					</ScrollArea>
				</div>
			) : (
				<div className="flex min-h-0 flex-1 flex-col">
					<ScrollArea className="flex-1">
						<PublishChecklistContent
							runId={runId}
							assignedCount={assignedCount}
							unassignedCount={unassignedCount}
							hardCount={hardCount}
							softCount={softCount}
							violations={violations}
							sectionLabel={sectionLabel}
							subjectLabel={subjectLabel}
							facultyLabel={facultyLabel}
							onPublish={onPublish}
							onReviewIssues={() => onTaskChange('review-issues')}
							onPlaceUnresolved={() => onTaskChange('place-unresolved')}
						/>
					</ScrollArea>
				</div>
			)}
		</aside>
	);
}

export const TimetableTaskDrawer = memo(TimetableTaskDrawerImpl);

type QueueStatus = ReturnType<typeof getUnassignedStatus>;

function statusRank(status: QueueStatus) {
	if (status.key === 'ready') return 0;
	if (status.key === 'needs-room') return 1;
	if (status.key === 'needs-owner') return 2;
	return 3;
}

function sameUnassignedItem(a: UnassignedItem | null, b: UnassignedItem | null) {
	if (!a || !b) return false;
	return a.sectionId === b.sectionId
		&& a.subjectId === b.subjectId
		&& a.session === b.session
		&& (a.cohortCode ?? '') === (b.cohortCode ?? '');
}

type DraftQueueStatus = {
	key: 'ready' | 'needs-owner' | 'needs-room' | 'blocked';
	label: string;
	actionLabel: string;
	className: string;
};

function getDraftQueueStatus(
	item: DraftQueueItem,
	roomMap?: LeftRailContentContext['roomMap'],
): DraftQueueStatus {
	if (item.hasNoTeacher || item.facultyOptions.length === 0) {
		return {
			key: 'needs-owner',
			label: 'Needs owner',
			actionLabel: 'Fix owner',
			className: 'border-amber-200 bg-amber-50 text-amber-800',
		};
	}
	const rooms = roomMap ? Array.from(roomMap.values()).filter((room) => room.isTeachingSpace) : [];
	const hasPreferredRoom = rooms.some((room) => room.type === item.preferredRoomType);
	const hasFallbackRoom = rooms.length > 0;
	if (!item.preferredRoomType || !hasFallbackRoom || !hasPreferredRoom) {
		return {
			key: 'needs-room',
			label: 'Needs room',
			actionLabel: 'Choose room',
			className: 'border-sky-200 bg-sky-50 text-sky-800',
		};
	}
	return {
		key: 'ready',
		label: 'Ready to place',
		actionLabel: 'Place',
		className: 'border-emerald-200 bg-emerald-50 text-emerald-800',
	};
}

function draftStatusRank(status: DraftQueueStatus) {
	if (status.key === 'ready') return 0;
	if (status.key === 'needs-room') return 1;
	if (status.key === 'needs-owner') return 2;
	return 3;
}

function sameDraftQueueItem(a: DraftQueueItem | null, b: DraftQueueItem | null) {
	if (!a || !b) return false;
	return a.assignmentKey === b.assignmentKey && a.sessionNumber === b.sessionNumber;
}

function draftQueueKey(item: DraftQueueItem) {
	return `${item.assignmentKey}-${item.sessionNumber}`;
}

function SimpleDraftPlottingTray({ context }: { context: LeftRailContentContext }) {
	const {
		draftBoard,
		pinsSearch,
		setPinsSearch,
		pinsGradeFilter,
		setPinsGradeFilter,
		setPinsSectionFilter,
		setPinsSubjectFilter,
		preGenKbSource,
		setPreGenKbSource,
		setKbSelectedSource,
		setSelectedEntry,
		setSelectedViolation,
		setSelectedUnassignedForRepair,
		rightPanelRef,
		leftPanelRef,
		isDesktop,
		formatFacultyInitials,
		GRADE_BADGE,
		toast,
		openTacticalSandbox,
		roomMap,
	} = context;
	const [skippedKeys, setSkippedKeys] = useState<Set<string>>(new Set());
	const [activeItem, setActiveItem] = useState<DraftQueueItem | null>(null);
	const [findOpen, setFindOpen] = useState(false);

	const queue = draftBoard?.queue ?? [];
	const grades = useMemo(() => [...new Set(queue.map((item) => item.gradeLevel))].sort((a, b) => a - b), [queue]);

	const visibleQueue = useMemo(() => {
		const q = pinsSearch.trim().toLowerCase();
		return queue.filter((item) => {
			const matchesGrade = pinsGradeFilter === 'all' || item.gradeLevel === pinsGradeFilter;
			if (!matchesGrade) return false;
			if (!q) return true;
			const haystack = [
				item.sectionName,
				item.subjectCode,
				item.subjectName,
				item.cohortCode,
				`session ${item.sessionNumber}`,
			].filter(Boolean).join(' ').toLowerCase();
			return haystack.includes(q);
		});
	}, [pinsGradeFilter, pinsSearch, queue]);

	const sortedQueue = useMemo(() => {
		return [...visibleQueue].sort((a, b) => {
			const keyA = draftQueueKey(a);
			const keyB = draftQueueKey(b);
			const skippedA = skippedKeys.has(keyA) ? 10 : 0;
			const skippedB = skippedKeys.has(keyB) ? 10 : 0;
			return (draftStatusRank(getDraftQueueStatus(a, roomMap)) + skippedA) - (draftStatusRank(getDraftQueueStatus(b, roomMap)) + skippedB)
				|| a.gradeLevel - b.gradeLevel
				|| a.sectionName.localeCompare(b.sectionName)
				|| a.subjectCode.localeCompare(b.subjectCode)
				|| a.sessionNumber - b.sessionNumber;
		});
	}, [roomMap, skippedKeys, visibleQueue]);

	useEffect(() => {
		if (activeItem && sortedQueue.some((item) => sameDraftQueueItem(item, activeItem))) return;
		setActiveItem(sortedQueue[0] ?? null);
	}, [activeItem, sortedQueue]);

	const selectQueueItem = (item: DraftQueueItem) => {
		const status = getDraftQueueStatus(item, roomMap);
		setActiveItem(item);
		if (status.key === 'needs-owner') {
			setPreGenKbSource(null);
			setKbSelectedSource(null);
			setSelectedEntry(null);
			setSelectedViolation(null);
			setSelectedUnassignedForRepair(null);
			openTacticalSandbox();
			toast.info('Fix the Teaching Load owner first, then return to place this draft session.');
			return;
		}
		const source = { type: 'draftQueue' as const, item };
		setPreGenKbSource(source);
		setKbSelectedSource(source);
		setSelectedEntry(null);
		setSelectedViolation(null);
		setSelectedUnassignedForRepair(null);
		rightPanelRef.current?.expand();
		if (!isDesktop) leftPanelRef.current?.collapse();
	};

	const skipActive = () => {
		if (!activeItem) return;
		const itemKey = draftQueueKey(activeItem);
		setSkippedKeys((prev) => new Set(prev).add(itemKey));
		setActiveItem(sortedQueue.find((item) => draftQueueKey(item) !== itemKey) ?? activeItem);
		toast.info('Skipped for now. ATLAS moved it behind the next draft sessions.');
	};

	const clearFind = () => {
		setPinsSearch('');
		setPinsGradeFilter('all');
		setPinsSectionFilter('all');
		setPinsSubjectFilter('all');
	};

	const trayItems = useMemo(() => {
		const base = activeItem
			? [activeItem, ...sortedQueue.filter((item) => !sameDraftQueueItem(item, activeItem))]
			: sortedQueue;
		return base.slice(0, findOpen ? 36 : 4);
	}, [activeItem, findOpen, sortedQueue]);

	if (!draftBoard) {
		return (
			<div className="flex min-h-0 flex-1 flex-col items-center justify-center gap-2 p-4 text-center text-sm text-muted-foreground">
				<CalendarClock className="size-7 text-primary" aria-hidden="true" />
				<p className="font-semibold text-foreground">Loading draft planner.</p>
				<p>ATLAS is preparing the draft queue.</p>
			</div>
		);
	}

	if (queue.length === 0) {
		return (
			<div className="flex min-h-0 flex-1 flex-col items-center justify-center gap-2 p-4 text-center text-sm text-muted-foreground">
				<CheckCircle2 className="size-7 text-emerald-500" aria-hidden="true" />
				<p className="font-semibold text-foreground">No draft sessions left to place.</p>
				<p>Everything available for this draft is already pinned or filtered out.</p>
			</div>
		);
	}

	return (
		<div className="flex min-h-0 flex-1 flex-col" data-testid="pregen-plotting-tray">
			<div className="shrink-0 border-b border-border/70 px-3 py-2">
				<div className="flex items-center justify-between gap-2">
					<div className="min-w-0">
						<p className="text-xs font-bold uppercase tracking-wide text-muted-foreground">Draft plotting queue</p>
						<p className="truncate text-sm font-semibold text-foreground">
							{visibleQueue.length} of {queue.length} session{queue.length === 1 ? '' : 's'} shown
						</p>
					</div>
					<div className="flex shrink-0 items-center gap-1.5">
						<Button
							type="button"
							variant="outline"
							size="sm"
							className="h-9 gap-1.5 px-2 text-xs"
							onClick={() => setFindOpen((value) => !value)}
							data-testid="pregen-find-session-drawer"
						>
							<Search className="size-3.5" aria-hidden="true" />
							Find
						</Button>
						<Button type="button" variant="ghost" size="sm" className="h-9 gap-1.5 px-2 text-xs" onClick={skipActive} disabled={!activeItem}>
							<SkipForward className="size-3.5" aria-hidden="true" />
							Skip
						</Button>
					</div>
				</div>
				<p className="mt-1 text-xs text-muted-foreground">
					Current session first. Use Find for the full queue.
				</p>
				{findOpen ? (
					<div className="mt-2 space-y-2 rounded-xl border border-border bg-muted/20 p-2">
						<div className="relative" role="search">
							<Search className="pointer-events-none absolute left-2 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
							<Input
								value={pinsSearch}
								onChange={(event) => setPinsSearch(event.target.value)}
								placeholder="Find section, subject, or session..."
								aria-label="Find draft session"
								className="h-9 pl-7 pr-8 text-sm"
								data-testid="pregen-plotting-search"
							/>
							{pinsSearch ? (
								<Button
									type="button"
									variant="ghost"
									size="icon"
									aria-label="Clear draft session search"
									onClick={() => setPinsSearch('')}
									className="absolute right-1 top-1/2 size-7 -translate-y-1/2"
								>
									<X className="size-3.5" />
								</Button>
							) : null}
						</div>
						<div className="flex gap-1 overflow-x-auto pb-0.5" aria-label="Draft queue grade filters">
							<Button type="button" variant={pinsGradeFilter === 'all' ? 'default' : 'secondary'} size="sm" onClick={() => { setPinsGradeFilter('all'); setPinsSectionFilter('all'); }} className="h-7 shrink-0 rounded-full px-2.5 text-xs">
								All grades
							</Button>
							{grades.map((grade) => (
								<Button key={grade} type="button" variant={pinsGradeFilter === grade ? 'default' : 'secondary'} size="sm" onClick={() => { setPinsGradeFilter(grade); setPinsSectionFilter('all'); }} className="h-7 shrink-0 rounded-full px-2.5 text-xs">
									G{grade}
								</Button>
							))}
							<Button type="button" variant="ghost" size="sm" className="h-7 shrink-0 rounded-full px-2.5 text-xs" onClick={clearFind}>
								Clear
							</Button>
						</div>
					</div>
				) : null}
			</div>

			<div
				className="min-h-0 flex-1 overflow-auto touch-pan-y overscroll-contain"
				data-testid="pregen-plotting-scroll"
				role="list"
				aria-label="Pre-generation draft sessions"
				tabIndex={0}
			>
				<div className="grid gap-1.5 p-2" data-testid="pregen-plotting-visible-list">
					{!findOpen && trayItems.length > 0 ? (
						<p className="text-[0.68rem] font-bold uppercase tracking-wide text-muted-foreground">Current session</p>
					) : null}
					{trayItems.map((item, index) => (
						<div key={`${draftQueueKey(item)}-${index}`} className="contents">
							{!findOpen && index === 1 ? (
								<p className="mt-1 text-[0.68rem] font-bold uppercase tracking-wide text-muted-foreground">Next sessions</p>
							) : null}
							<SimpleDraftQueueRow
								context={context}
								item={item}
								index={index}
								active={sameDraftQueueItem(item, activeItem) || (preGenKbSource?.type === 'draftQueue' && sameDraftQueueItem(preGenKbSource.item, item))}
								onSelect={selectQueueItem}
								formatFacultyInitials={formatFacultyInitials}
								gradeBadge={item.gradeLevel ? GRADE_BADGE[item.gradeLevel] : undefined}
								roomMap={roomMap}
							/>
						</div>
					))}
					{trayItems.length === 0 ? (
						<div className="rounded-lg border border-dashed border-border p-4 text-center text-sm text-muted-foreground">
							No draft sessions match your filters.
						</div>
					) : null}
				</div>
			</div>
		</div>
	);
}

function SimpleDraftQueueRow({
	context,
	item,
	index,
	active,
	onSelect,
	formatFacultyInitials,
	gradeBadge,
	roomMap,
}: {
	context: LeftRailContentContext;
	item: DraftQueueItem;
	index: number;
	active: boolean;
	onSelect: (item: DraftQueueItem) => void;
	formatFacultyInitials: (id: number) => string;
	gradeBadge?: string;
	roomMap: LeftRailContentContext['roomMap'];
}) {
	const { isDesktop } = context;
	const status = getDraftQueueStatus(item, roomMap);
	const isCurrent = active || index === 0;
	const ownerLabel = item.facultyOptions[0] ? formatFacultyInitials(item.facultyOptions[0]) : 'No owner';
	const content = (
		<div className="grid min-h-[72px] grid-cols-[1fr_auto] gap-2 p-2" data-testid={isCurrent ? 'pregen-current-plotting-item' : 'pregen-next-plotting-item'}>
			<Button
				type="button"
				variant="ghost"
				className="h-auto min-w-0 justify-start p-0 text-left hover:bg-transparent"
				onClick={() => onSelect(item)}
				aria-label={`${status.actionLabel}: ${item.subjectCode} for ${item.sectionName}, session ${item.sessionNumber}`}
			>
				<div className="min-w-0">
					<div className="flex min-w-0 items-center gap-1.5">
						{isCurrent ? <Badge variant="secondary" className="h-5 shrink-0 px-1.5 text-xs">Now</Badge> : null}
						{gradeBadge ? <Badge variant="outline" className={`h-5 shrink-0 px-1.5 text-xs ${gradeBadge}`}>G{item.gradeLevel}</Badge> : null}
						<span className="truncate font-semibold text-foreground">{item.sectionName}</span>
					</div>
					<p className="mt-0.5 truncate text-xs text-muted-foreground">
						{item.subjectCode} · Session {item.sessionNumber}/{item.sessionsPerWeek} · {ownerLabel}
					</p>
					<p className={cn('mt-1 inline-flex max-w-full rounded-full border px-2 py-0.5 text-xs font-semibold', status.className)}>
						<span className="truncate">{status.label}</span>
					</p>
				</div>
			</Button>
			<div className="flex min-w-[7.5rem] flex-col justify-center gap-1">
				<Button type="button" size="sm" variant={status.key === 'ready' ? 'default' : 'outline'} className="h-8 px-2 text-xs" disabled={status.key === 'blocked'} onClick={() => onSelect(item)}>
					<span className="truncate">{status.actionLabel}</span>
				</Button>
				<p className="truncate text-center text-xs text-muted-foreground">{String(item.preferredRoomType ?? 'room').replace(/_/g, ' ').toLowerCase()}</p>
			</div>
		</div>
	);

	if (!isDesktop) {
		return (
			<div role="listitem" className={cn('rounded-xl border bg-background text-xs transition-colors', active ? 'border-primary ring-2 ring-primary/70' : 'border-border hover:border-primary/50')}>
				{content}
			</div>
		);
	}

	return (
		<div role="listitem" data-testid="simple-plotting-session-row">
			<DraggableQueuePin
				item={item}
				disabled={false}
				onClick={() => onSelect(item)}
				onKeyDown={(event) => {
					if (event.key === 'Enter' || event.key === ' ') {
						event.preventDefault();
						onSelect(item);
					}
				}}
				className={cn('rounded-xl border bg-background text-xs transition-colors', active ? 'border-primary ring-2 ring-primary/70' : 'border-border hover:border-primary/50')}
			>
				{content}
			</DraggableQueuePin>
		</div>
	);
}

function SimpleGeneratedPlottingTray({ context }: { context: LeftRailContentContext }) {
	const {
		filteredUnassignedItems,
		unassignedFixSuggestions,
		buildUnassignedKey,
		sectionLabel,
		subjectLabel,
		setSelectedEntry,
		setSelectedViolation,
		setSelectedUnassignedForRepair,
		setKbSelectedSource,
		setDrawerUnassigned,
		setFollowUps,
		followUps,
		toast,
		openTacticalSandbox,
		GRADE_BADGE,
	} = context;
	const [skippedKeys, setSkippedKeys] = useState<Set<string>>(new Set());
	const [activeItem, setActiveItem] = useState<UnassignedItem | null>(null);
	const [findOpen, setFindOpen] = useState(false);
	const [search, setSearch] = useState('');

	const sortedItems = useMemo(() => {
		return [...filteredUnassignedItems].sort((a, b) => {
			const keyA = buildUnassignedKey(a);
			const keyB = buildUnassignedKey(b);
			const statusA = getUnassignedStatus(a, unassignedFixSuggestions[keyA]);
			const statusB = getUnassignedStatus(b, unassignedFixSuggestions[keyB]);
			const skippedA = skippedKeys.has(keyA) ? 10 : 0;
			const skippedB = skippedKeys.has(keyB) ? 10 : 0;
			return (statusRank(statusA) + skippedA) - (statusRank(statusB) + skippedB)
				|| (a.gradeLevel ?? 99) - (b.gradeLevel ?? 99)
				|| sectionLabel(a.sectionId).localeCompare(sectionLabel(b.sectionId))
				|| subjectLabel(a.subjectId).localeCompare(subjectLabel(b.subjectId))
				|| String(a.session).localeCompare(String(b.session));
		});
	}, [buildUnassignedKey, filteredUnassignedItems, sectionLabel, skippedKeys, subjectLabel, unassignedFixSuggestions]);

	useEffect(() => {
		if (activeItem && sortedItems.some((item) => sameUnassignedItem(item, activeItem))) return;
		setActiveItem(sortedItems[0] ?? null);
	}, [activeItem, sortedItems]);

	useEffect(() => {
		if (!activeItem) return;
		const itemKey = buildUnassignedKey(activeItem);
		const status = getUnassignedStatus(activeItem, unassignedFixSuggestions[itemKey]);
		if (status.key !== 'ready' && status.key !== 'needs-room') return;
		setSelectedEntry(null);
		setSelectedViolation(null);
		setSelectedUnassignedForRepair(null);
		setKbSelectedSource({ type: 'unassigned', item: activeItem });
	}, [
		activeItem,
		buildUnassignedKey,
		setKbSelectedSource,
		setSelectedEntry,
		setSelectedUnassignedForRepair,
		setSelectedViolation,
		unassignedFixSuggestions,
	]);

	const selectForPlacement = (item: UnassignedItem) => {
		const itemKey = buildUnassignedKey(item);
		const status = getUnassignedStatus(item, unassignedFixSuggestions[itemKey]);
		setActiveItem(item);
		setSelectedEntry(null);
		setSelectedViolation(null);
		if (status.key === 'needs-owner') {
			setSelectedUnassignedForRepair(item);
			openTacticalSandbox();
			toast.info('Teaching Load repair opened. Fix the owner there, then place the session.');
			return;
		}
		if (status.key === 'blocked') {
			setDrawerUnassigned(item);
			toast.info('This session is blocked. Review the details first.');
			return;
		}
		setSelectedUnassignedForRepair(null);
		setKbSelectedSource({ type: 'unassigned', item });
	};

	const skipActive = () => {
		if (!activeItem) return;
		const itemKey = buildUnassignedKey(activeItem);
		setSkippedKeys((prev) => new Set(prev).add(itemKey));
		const nextItem = sortedItems.find((item) => buildUnassignedKey(item) !== itemKey) ?? activeItem;
		setActiveItem(nextItem);
		toast.info('Skipped for now. ATLAS moved it behind the next sessions.');
	};

	const visibleItems = useMemo(() => {
		const q = search.trim().toLowerCase();
		if (!q) return sortedItems;
		return sortedItems.filter((item) => {
			const haystack = [
				sectionLabel(item.sectionId),
				subjectLabel(item.subjectId),
				String(item.session),
				item.cohortCode ?? '',
			].join(' ').toLowerCase();
			return haystack.includes(q);
		});
	}, [search, sectionLabel, sortedItems, subjectLabel]);

	const trayItems = useMemo(() => {
		const base = activeItem
			? [activeItem, ...sortedItems.filter((item) => !sameUnassignedItem(item, activeItem))]
			: sortedItems;
		return base.slice(0, 4);
	}, [activeItem, sortedItems]);

	const hasLoadingNames = trayItems.some((item) => {
		const section = sectionLabel(item.sectionId).toLowerCase();
		const subject = subjectLabel(item.subjectId).toLowerCase();
		return section.startsWith('loading') || subject.startsWith('loading');
	});

	if (sortedItems.length === 0) {
		return (
			<div className="flex min-h-0 flex-1 flex-col items-center justify-center gap-2 p-4 text-center text-sm text-muted-foreground">
				<CheckCircle2 className="size-7 text-emerald-500" aria-hidden="true" />
				<p className="font-semibold text-foreground">No unresolved generated sessions.</p>
				<p>Everything currently available has been placed or filtered out.</p>
			</div>
		);
	}

	return (
		<div className="flex min-h-0 flex-1 flex-col" data-testid="simple-plotting-tray">
			<div className="shrink-0 border-b border-border/70 px-3 py-2">
				<div className="flex items-center justify-between gap-2">
					<div className="min-w-0">
						<p className="text-xs font-bold uppercase tracking-wide text-muted-foreground">Plotting queue</p>
						<p className="truncate text-sm font-semibold text-foreground">
							{sortedItems.length} session{sortedItems.length === 1 ? '' : 's'} left
						</p>
						{hasLoadingNames ? (
							<p className="text-xs text-muted-foreground">Loading names…</p>
						) : (
							<p className="text-xs text-muted-foreground">Current session first. Use Find for the full queue.</p>
						)}
					</div>
					<div className="flex shrink-0 items-center gap-1.5">
						<Button type="button" variant="outline" size="sm" className="h-9 gap-1.5 px-2 text-xs" onClick={() => setFindOpen((value) => !value)} data-testid="simple-plotting-find-session">
							<Search className="size-3.5" aria-hidden="true" />
							Find
						</Button>
						<Button type="button" variant="ghost" size="sm" className="h-9 gap-1.5 px-2 text-xs" onClick={skipActive} disabled={!activeItem}>
							<SkipForward className="size-3.5" aria-hidden="true" />
							Skip
						</Button>
					</div>
				</div>
				{findOpen ? (
					<div className="mt-2">
						<Input
							value={search}
							onChange={(event) => setSearch(event.target.value)}
							placeholder="Find section, subject, or session..."
							aria-label="Find unresolved session"
							className="h-9 text-sm"
							data-testid="simple-plotting-search"
						/>
					</div>
				) : null}
			</div>

			<div
				className="min-h-0 flex-1 overflow-auto touch-pan-y overscroll-contain"
				data-testid="simple-plotting-scroll"
				data-virtualized-rail="Unassigned generated sessions"
				role="list"
				aria-label="Unassigned generated sessions"
				tabIndex={0}
			>
				<div className="grid gap-1.5 p-2" data-testid="simple-plotting-visible-list">
					{!findOpen && trayItems.length > 0 ? (
						<p className="text-[0.68rem] font-bold uppercase tracking-wide text-muted-foreground">Current session</p>
					) : null}
					{(findOpen ? visibleItems : trayItems).map((item, index) => (
						<div key={`${buildUnassignedKey(item)}-${index}`} className="contents">
							{!findOpen && index === 1 ? (
								<p className="mt-1 text-[0.68rem] font-bold uppercase tracking-wide text-muted-foreground">Next sessions</p>
							) : null}
							<SimpleUnassignedQueueRow
								context={context}
								item={item}
								index={index}
								active={sameUnassignedItem(item, activeItem)}
								onSelect={selectForPlacement}
							/>
						</div>
					))}
					{findOpen && visibleItems.length === 0 ? (
						<div className="rounded-lg border border-dashed border-border p-4 text-center text-sm text-muted-foreground">
							No unresolved sessions match your search.
						</div>
					) : null}
				</div>
			</div>
		</div>
	);
}

function SimpleUnassignedQueueRow({
	context,
	item,
	index,
	active,
	onSelect,
}: {
	context: LeftRailContentContext;
	item: UnassignedItem;
	index: number;
	active: boolean;
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
	const isCurrent = active || index === 0;
	const actionLabel = status.key === 'ready'
		? 'Place'
		: status.key === 'needs-room'
			? 'Choose room'
			: status.key === 'needs-owner'
				? 'Fix owner'
				: 'Review blocker';

	return (
		<div role="listitem">
			<DraggableUnassignedPin
				itemKey={itemKey}
				item={item}
				disabled={false}
				className={cn(
					'rounded-xl border bg-background text-xs transition-colors',
					active ? 'border-primary ring-2 ring-primary/70' : 'border-border hover:border-primary/50',
				)}
			>
				<div
					className="grid min-h-[72px] grid-cols-[1fr_auto] gap-2 p-2"
					data-testid={isCurrent ? 'simple-current-session-card' : 'simple-next-session-card'}
					data-simple-plotting-row="true"
				>
					<Button
						type="button"
						variant="ghost"
						className="h-auto min-w-0 justify-start p-0 text-left hover:bg-transparent"
						onClick={() => onSelect(item)}
						aria-label={`${actionLabel}: ${subjectLabel(item.subjectId)} for ${sectionLabel(item.sectionId)}, session ${item.session}`}
					>
						<div className="min-w-0">
							<div className="flex min-w-0 items-center gap-1.5">
								{isCurrent ? <Badge variant="secondary" className="h-5 shrink-0 px-1.5 text-xs">Now</Badge> : null}
								{gradeBadge ? <Badge variant="outline" className={`h-5 shrink-0 px-1.5 text-xs ${gradeBadge}`}>G{item.gradeLevel}</Badge> : null}
								<span className="truncate font-semibold text-foreground">{sectionLabel(item.sectionId)}</span>
							</div>
							<p className="mt-0.5 truncate text-xs text-muted-foreground">
								{subjectLabel(item.subjectId)} · Session {item.session}
							</p>
							<p className={cn('mt-1 inline-flex max-w-full rounded-full border px-2 py-0.5 text-xs font-semibold', status.className)}>
								<span className="truncate">{status.label}</span>
							</p>
						</div>
					</Button>
					<div className="flex min-w-[7.5rem] flex-col justify-center gap-1">
						<Button type="button" size="sm" variant={status.key === 'ready' ? 'default' : 'outline'} className="h-8 px-2 text-xs" disabled={status.key === 'blocked'} onClick={() => onSelect(item)}>
							<span className="truncate">{actionLabel}</span>
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
