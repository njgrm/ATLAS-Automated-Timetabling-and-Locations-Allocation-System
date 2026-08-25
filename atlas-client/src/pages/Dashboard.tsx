import { lazy, Suspense, useState } from 'react';
import { Link } from 'react-router-dom';
import {
	BookOpen,
	UserCheck,
	GraduationCap,
	Building2,
	AlertTriangle,
	CheckCircle2,
	ChevronRight,
	ArrowRight,
	Wand2,
	CalendarRange,
	RefreshCw,
} from 'lucide-react';
import { Badge } from '@/ui/badge';
import { Button } from '@/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/ui/card';
import { Popover, PopoverContent, PopoverTrigger } from '@/ui/popover';
import { useDashboardData, type DashboardReadinessSourceState, type LifecyclePhase } from '@/hooks/useDashboardData';
import type { RolloverStatus } from '@/lib/settings';
import { RolloverGuidanceCard } from '@/components/runtime/RolloverGuidanceCard';
import { SmartHelpTrigger } from '@/components/smart/SmartPageShell';

const CampusReadinessCard = lazy(() => import('@/components/dashboard/CampusReadinessCard').then((module) => ({ default: module.CampusReadinessCard })));

type StatTone = 'brand' | 'sky' | 'violet' | 'amber';

interface StatTile {
	label: string;
	value: string;
	footer: string;
	icon: typeof BookOpen;
	tone: StatTone;
	warn?: boolean;
	href: string;
	actionLabel: string;
}

const TONE: Record<StatTone, { iconBg: string; iconRing: string; iconText: string; footer: string }> = {
	brand: {
		iconBg: 'bg-primary',
		iconRing: 'ring-primary/15',
		iconText: 'text-primary',
		footer: 'text-emerald-600',
	},
	sky: {
		iconBg: 'bg-sky-500',
		iconRing: 'ring-sky-100',
		iconText: 'text-sky-500',
		footer: 'text-sky-600',
	},
	violet: {
		iconBg: 'bg-violet-500',
		iconRing: 'ring-violet-100',
		iconText: 'text-violet-500',
		footer: 'text-violet-600',
	},
	amber: {
		iconBg: 'bg-amber-500',
		iconRing: 'ring-amber-100',
		iconText: 'text-amber-500',
		footer: 'text-amber-600',
	},
};

const LIFECYCLE_STEPS: { key: LifecyclePhase; label: string; helper: string }[] = [
	{ key: 'SETUP', label: 'Setup', helper: 'Curriculum, teachers, rooms' },
	{ key: 'PREFERENCES', label: 'Preferences', helper: 'Faculty inputs' },
	{ key: 'GENERATION', label: 'Generate', helper: 'Algorithm run' },
	{ key: 'REVIEW', label: 'Review', helper: 'Fix blockers' },
	{ key: 'PUBLISHED', label: 'Published', helper: 'Visible to faculty + students' },
];

const SOURCE_CHIP_COPY: Record<string, string> = {
	verified_live: 'Live source',
	checking_source: 'Checking source',
	using_saved_data: 'Saved source data',
	no_saved_data: 'No source data',
	partial_degraded: 'Partial source',
};

const SOURCE_CHIP_CLASS: Record<string, string> = {
	verified_live: 'border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100',
	checking_source: 'border-sky-200 bg-sky-50 text-sky-700 hover:bg-sky-100',
	using_saved_data: 'border-slate-200 bg-slate-50 text-slate-600 hover:bg-slate-100',
	no_saved_data: 'border-red-200 bg-red-50 text-red-700 hover:bg-red-100',
	partial_degraded: 'border-amber-200 bg-amber-50 text-amber-700 hover:bg-amber-100',
};

type NextStep = {
	title: string;
	body: string;
	cta: string;
	href: string;
	warn?: string;
};

type SourceDecisionTone = 'success' | 'info' | 'warning' | 'danger';

type SourceDecision = {
	label: string;
	title: string;
	sentence: string;
	helper: string;
	tone: SourceDecisionTone;
};

const SOURCE_DECISION_COPY: Record<DashboardReadinessSourceState, SourceDecision> = {
	verified_live: {
		label: 'Verified live',
		title: 'Source connection is ready',
		sentence: 'Source verified: continue setup normally.',
		helper: 'EnrollPro has been checked for this school year, so repair steps can be treated as current.',
		tone: 'success',
	},
	checking_source: {
		label: 'Checking source',
		title: 'Source connection is being checked',
		sentence: 'Checking source: review visible setup data now; wait for the check to finish before final sync.',
		helper: 'The checklist stays available so you can inspect obvious issues while the connection settles.',
		tone: 'info',
	},
	using_saved_data: {
		label: 'Using saved data',
		title: 'Source connection is unavailable',
		sentence: 'Source unavailable: review saved data now; wait for EnrollPro before final sync.',
		helper: 'Saved ATLAS data is useful for repair work, but it is not a replacement for live EnrollPro verification.',
		tone: 'warning',
	},
	no_saved_data: {
		label: 'No saved data',
		title: 'No source data is available',
		sentence: 'No saved data: reconnect EnrollPro before repairing setup.',
		helper: 'ATLAS does not have enough safe local data to guide setup repair for this school year.',
		tone: 'danger',
	},
	partial_degraded: {
		label: 'Partial data',
		title: 'Some source checks are unavailable',
		sentence: 'Source partly unavailable: fix visible setup items now; wait for EnrollPro before final sync.',
		helper: 'Use the repair links for clear local issues, then verify again before generation or publishing.',
		tone: 'warning',
	},
};

const SOURCE_DECISION_STYLE: Record<SourceDecisionTone, { icon: string; badge: string }> = {
	success: {
		icon: 'bg-emerald-600 text-white',
		badge: 'border-emerald-200 bg-white text-emerald-700',
	},
	info: {
		icon: 'bg-sky-600 text-white',
		badge: 'border-sky-200 bg-white text-sky-700',
	},
	warning: {
		icon: 'bg-amber-500 text-white',
		badge: 'border-amber-200 bg-white text-amber-700',
	},
	danger: {
		icon: 'bg-red-600 text-white',
		badge: 'border-red-200 bg-white text-red-700',
	},
};

const SOURCE_REPAIR_LINKS = [
	{ href: '/sections', label: 'Sections' },
	{ href: '/subjects', label: 'Subjects' },
	{ href: '/teachers', label: 'Teachers' },
	{ href: '/teaching-load', label: 'Teaching Load' },
	{ href: '/map', label: 'Rooms' },
] as const;

function pickNextStep(args: {
	phase: LifecyclePhase;
	subjectCount: number | null;
	facultyCount: number | null;
	sectionCount: number | null;
	unassignedSubjectCount: number | null;
	missingCoverageSubjectIds: number[] | null;
	buildingsDone: boolean;
	latestRunStatus: 'NONE' | 'IN_PROGRESS' | 'COMPLETED' | 'FAILED';
	violationCount: number | null;
}): NextStep {
	const {
		phase,
		subjectCount,
		facultyCount,
		sectionCount,
		unassignedSubjectCount,
		missingCoverageSubjectIds,
		buildingsDone,
		latestRunStatus,
		violationCount,
	} = args;

	if (phase === 'SETUP') {
		if ((subjectCount ?? 0) === 0) {
			return { title: 'Add the curriculum', body: 'Load the subject catalog before assigning teachers or generating.', cta: 'Open subjects', href: '/subjects' };
		}
		if ((facultyCount ?? 0) === 0) {
			return { title: 'Sync teachers from EnrollPro', body: 'Pull the faculty roster so subjects can be assigned.', cta: 'Open teachers', href: '/teachers' };
		}
		if ((unassignedSubjectCount ?? 0) > 0) {
			const subjectParam = missingCoverageSubjectIds?.length === 1 ? `&subjectId=${missingCoverageSubjectIds[0]}` : '';
			const coverageHref = `/teaching-load?view=subjects&filter=missing-coverage${subjectParam}`;
			return { title: 'Assign teachers to every subject', body: `${unassignedSubjectCount} subject${unassignedSubjectCount === 1 ? '' : 's'} still need teacher coverage before generation.`, cta: 'Review subject coverage', href: coverageHref };
		}
		if (sectionCount === null) {
			return { title: 'Reconnect enrollment data', body: 'EnrollPro is not reachable. Check the link before generating.', cta: 'Check sections', href: '/sections', warn: 'Enrollment unavailable' };
		}
		if ((sectionCount ?? 0) === 0) {
			return { title: 'Confirm sections for this school year', body: 'No sections were found. Verify enrollment before generating.', cta: 'Check sections', href: '/sections' };
		}
		if (!buildingsDone) {
			return { title: 'Finish campus setup', body: 'Mark every teaching room before generation so placements have rooms.', cta: 'Open campus map', href: '/map' };
		}
	}
	if (phase === 'PREFERENCES') {
		return { title: 'Generate the timetable', body: 'Setup is complete. Run the generator and review the result.', cta: 'Open timetable', href: '/timetable' };
	}
	if (phase === 'GENERATION') {
		if (latestRunStatus === 'FAILED') {
			return { title: 'Last generation run failed', body: 'Review the failure cause and retry generation.', cta: 'Open timetable', href: '/timetable', warn: 'Run failed' };
		}
		return { title: 'Generation in progress', body: 'The algorithm is still running. Open the timetable to watch progress.', cta: 'Open timetable', href: '/timetable' };
	}
	if (phase === 'REVIEW') {
		if ((violationCount ?? 0) > 0) {
			return { title: 'Resolve scheduling violations', body: `${violationCount} constraint violation${violationCount === 1 ? '' : 's'} need attention before publish.`, cta: 'Open audit', href: '/audit?focus=timetable', warn: `${violationCount} blocker${violationCount === 1 ? '' : 's'}` };
		}
		return { title: 'Review and publish the schedule', body: 'Generation finished with no hard violations. Confirm the result and publish it.', cta: 'Open schedules', href: '/schedules' };
	}
	return { title: 'Schedule is published', body: 'Faculty and students can see the timetable. Use Exceptions for in-term changes.', cta: 'Open schedules', href: '/schedules' };
}

export default function Dashboard() {
	const [showAllSetupSteps, setShowAllSetupSteps] = useState(false);
	const [rolloverStatus, setRolloverStatus] = useState<RolloverStatus | null>(null);
	const rolloverAligned = rolloverStatus?.drift.status === 'aligned';
	const rolloverBlocking = rolloverStatus !== null && !rolloverAligned;

	const {
		loading, buildings, campusImageUrl, subjectCount, facultyCount, sectionCount,
		unassignedSubjectCount, missingCoverageSubjectIds, buildingSetupStatus, teachingRoomCount,
		totalRoomCount, activeSchoolYearLabel, activeTerm, activeTermPublished,
		activeTermUnassignedCount, activeTermHardViolationCount,
		latestRunStatus, violationCount,
		lifecyclePhase, readinessSourceState, readinessSourceMessage, refreshDashboard,
	} = useDashboardData();

	const next = pickNextStep({
		phase: lifecyclePhase, subjectCount, facultyCount, sectionCount,
		unassignedSubjectCount, missingCoverageSubjectIds, buildingsDone: buildingSetupStatus.done,
		latestRunStatus, violationCount,
	});

	const stats: StatTile[] = [
		{ label: 'Sections', value: loading ? '\u2026' : sectionCount === null ? '\u2014' : `${sectionCount}`, footer: sectionCount === null ? 'Enrollment unavailable' : activeSchoolYearLabel ? `S.Y. ${activeSchoolYearLabel}` : 'Active school year', icon: GraduationCap, tone: 'violet', warn: sectionCount === null, href: '/sections', actionLabel: 'Check sections' },
		{ label: 'Subjects', value: loading ? '\u2026' : `${subjectCount ?? 0}`, footer: 'Curriculum loaded', icon: BookOpen, tone: 'brand', href: '/subjects', actionLabel: 'Review subjects' },
		{ label: 'Teachers', value: loading ? '\u2026' : `${facultyCount ?? 0}`, footer: 'Synced from EnrollPro', icon: UserCheck, tone: 'sky', href: '/teachers', actionLabel: 'Review teachers' },
		{ label: 'Teaching Rooms', value: loading ? '\u2026' : `${teachingRoomCount}/${totalRoomCount}`, footer: buildingSetupStatus.done ? 'Ready for placement' : 'Some rooms unmarked', icon: Building2, tone: buildingSetupStatus.done ? 'brand' : 'amber', warn: !buildingSetupStatus.done && !loading, href: '/map', actionLabel: 'Check rooms' },
	];

	const checklist = [
		{ label: 'Sections loaded for school year', done: (sectionCount ?? 0) > 0, href: '/sections', hint: sectionCount === null ? 'Enrollment unavailable' : undefined },
		{ label: 'Subjects added', done: (subjectCount ?? 0) > 0, href: '/subjects' },
		{ label: 'Teachers synced from EnrollPro', done: (facultyCount ?? 0) > 0, href: '/teachers' },
		{ label: 'Every subject has a teacher', done: unassignedSubjectCount === 0 && (subjectCount ?? 0) > 0, href: missingCoverageSubjectIds && missingCoverageSubjectIds.length > 0 ? `/teaching-load?view=subjects&filter=missing-coverage` : '/teaching-load', hint: unassignedSubjectCount && unassignedSubjectCount > 0 ? `${unassignedSubjectCount} unassigned` : undefined },
		{ label: 'Buildings and rooms ready', done: buildingSetupStatus.done, href: '/map', hint: buildingSetupStatus.subMessage },
		{ label: 'Timetable generated and reviewed', done: latestRunStatus === 'COMPLETED' && (violationCount ?? 0) === 0, href: '/timetable', hint: latestRunStatus === 'FAILED' ? 'The latest generation run failed' : latestRunStatus === 'IN_PROGRESS' ? 'Generation is still running' : violationCount && violationCount > 0 ? `${violationCount} review blocker${violationCount === 1 ? '' : 's'}` : undefined },
		{ label: 'Ready to publish', done: lifecyclePhase === 'PUBLISHED' || (latestRunStatus === 'COMPLETED' && (violationCount ?? 0) === 0), href: '/schedules', hint: lifecyclePhase === 'PUBLISHED' ? 'Published schedule is live' : 'Review the timetable before publishing' },
	];

	const doneCount = checklist.filter((c) => c.done).length;
	const currentIdx = LIFECYCLE_STEPS.findIndex((s) => s.key === lifecyclePhase);
	const phaseNumber = currentIdx + 1;
	const sourceDecision = SOURCE_DECISION_COPY[readinessSourceState];
	const sourceDecisionStyle = SOURCE_DECISION_STYLE[sourceDecision.tone];
	const SourceDecisionIcon = sourceDecision.tone === 'success' ? CheckCircle2 : sourceDecision.tone === 'info' ? RefreshCw : AlertTriangle;

	return (
		<div className='flex h-[calc(100svh-3.5rem)] min-h-0 flex-col overflow-hidden'>
			<div className='flex-1 min-h-0 overflow-auto scrollbar-thin'>
				<div className='max-w-[1440px] mx-auto w-full flex flex-col space-y-6 px-4 py-4 lg:px-8 lg:py-8 animate-fade-in'>

					{/* Header */}
					<div className='flex flex-col sm:flex-row sm:items-center justify-between gap-4'>
						<div>
							<div className='flex flex-wrap items-center gap-2'>
								<h1 className='text-3xl font-bold text-gray-900'>Scheduling Dashboard</h1>
								{rolloverAligned && rolloverStatus ? (
									<Popover>
										<PopoverTrigger asChild>
											<Badge variant='outline' className='h-7 cursor-help gap-1.5 rounded-full border-emerald-200 bg-emerald-50 px-2.5 text-xs font-semibold text-emerald-700 shadow-none' data-testid='dashboard-year-status-chip'>
												<CheckCircle2 className='w-3.5 h-3.5' />
												Year aligned
											</Badge>
										</PopoverTrigger>
										<PopoverContent align='end' className='w-72 rounded-xl p-3 text-sm'>
											<p className='text-xs font-bold uppercase tracking-wide text-muted-foreground'>School year status</p>
											<p className='mt-1 font-semibold text-slate-900'>{rolloverStatus.drift.message}</p>
											{rolloverStatus.enrollProActiveYear?.yearLabel ? (
												<p className='mt-1 text-xs leading-relaxed text-slate-500'>EnrollPro {rolloverStatus.enrollProActiveYear.yearLabel} is the active school year.</p>
											) : null}
										</PopoverContent>
									</Popover>
								) : null}
							</div>
							<p className='mt-1 text-sm text-muted-foreground'>Build, review, and publish the school timetable.</p>
						</div>
						<div className='flex flex-wrap items-center gap-1.5'>
							{activeTerm?.activeTerm && (
								<Popover>
									<PopoverTrigger asChild>
										<Badge
											className='border-primary/20 bg-primary/5 text-primary font-semibold gap-1.5 px-2.5 py-1.5 rounded-full cursor-pointer'
											data-testid='dashboard-active-term'
										>
											Active Term: {activeTerm.activeTerm}
										</Badge>
									</PopoverTrigger>
									<PopoverContent align='end' className='w-72 rounded-xl p-4'>
										<h3 className='text-sm font-bold text-foreground'>Current Term Readiness</h3>
										<p className='mt-1 text-xs text-muted-foreground'>Term {activeTerm.activeTerm} status from the latest generation run.</p>
										<div className='mt-3 space-y-2'>
											<div className='flex items-center justify-between text-xs'>
												<span className='text-muted-foreground'>Published schedule</span>
												{activeTermPublished === null ? (
													<span className='text-muted-foreground'>Checking...</span>
												) : activeTermPublished ? (
													<span className='text-emerald-600 font-semibold'>Available</span>
												) : (
													<span className='text-amber-600 font-semibold'>Not published</span>
												)}
											</div>
											{activeTermHardViolationCount !== null && activeTermHardViolationCount > 0 && (
												<div className='flex items-center justify-between text-xs'>
													<span className='text-muted-foreground'>Hard violations</span>
													<span className='text-rose-600 font-semibold'>{activeTermHardViolationCount}</span>
												</div>
											)}
										</div>
									</PopoverContent>
								</Popover>
							)}
							{/* Source state chip with popover */}
							<Popover>
								<PopoverTrigger asChild>
									<Badge
										className={`${SOURCE_CHIP_CLASS[readinessSourceState]} font-semibold gap-1.5 px-2.5 py-1.5 rounded-full cursor-pointer`}
										data-testid='dashboard-source-health-panel'
										data-source-decision={readinessSourceState}
									>
										{readinessSourceState === 'partial_degraded' ? (
											<AlertTriangle className='w-3.5 h-3.5' />
										) : readinessSourceState === 'checking_source' ? (
											<RefreshCw className='w-3.5 h-3.5 animate-spin' />
										) : (
											<CheckCircle2 className='w-3.5 h-3.5' />
										)}
										{SOURCE_CHIP_COPY[readinessSourceState]}
									</Badge>
								</PopoverTrigger>
								<PopoverContent align='end' className='w-80 rounded-xl p-4'>
									<div className='flex items-start gap-3'>
										<div className={`shrink-0 rounded-lg p-2 ${sourceDecisionStyle.icon}`}>
											<SourceDecisionIcon className='h-4 w-4' />
										</div>
										<div className='min-w-0'>
											<h3 className='text-sm font-bold text-slate-900'>{sourceDecision.title}</h3>
											<p data-testid='dashboard-source-decision' className='mt-1 text-sm text-slate-600'>{sourceDecision.sentence}</p>
											<p className='mt-1 text-xs text-muted-foreground leading-relaxed'>{sourceDecision.helper}</p>
										</div>
									</div>
									<div className='mt-3 flex flex-wrap gap-1.5' aria-label='Setup repair links'>
										{SOURCE_REPAIR_LINKS.map((link) => (
											<Link key={link.href} to={link.href} data-source-repair-link={link.label.toLowerCase().replace(/\s+/g, '-')}>
												<Button type='button' variant='outline' size='sm' className='h-8 rounded-lg px-2.5 text-xs font-semibold'>{link.label}</Button>
											</Link>
										))}
									</div>
								</PopoverContent>
							</Popover>

							<Button type='button' variant='outline' size='sm' className='h-9 rounded-xl bg-white gap-2 px-3 text-xs' onClick={refreshDashboard} disabled={loading} aria-label='Check dashboard readiness for updates'>
								<RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
								<span className='hidden sm:inline'>Check for updates</span>
							</Button>
							<SmartHelpTrigger
								title='How to use the dashboard'
								description='Use the dashboard to find the next setup task before opening detailed tools.'
								steps={[
									{ title: 'Check source status', body: 'Confirm whether ATLAS is using live EnrollPro data or saved setup data.', target: 'Source connection' },
									{ title: 'Follow the next step', body: 'Use the Your next step card to move scheduling forward one task at a time.', target: 'Your next step' },
									{ title: 'Review setup readiness', body: 'The checklist shows which setup areas still need attention.', target: 'Setup readiness' },
									{ title: 'Open timetable last', body: 'Create or review the timetable after setup and Teaching Load are ready.', target: 'Open Timetable' },
								]}
								className='h-9'
							/>
							<Link to='/timetable'>
								<Button className='h-9 gap-2 bg-primary px-3 text-xs font-semibold text-primary-foreground shadow-primary-glow hover:bg-primary/90'>
									<CalendarRange className='w-4 h-4' />
									Open Timetable
								</Button>
							</Link>
						</div>
					</div>

					{/* Year status guidance */}
					{rolloverStatus === null || rolloverBlocking ? (
						<RolloverGuidanceCard compact onStatus={setRolloverStatus} />
					) : null}

					{/* Stat tiles */}
					<div className='grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4'>
						{stats.map((stat) => {
							const tone = TONE[stat.tone];
							return (
								<Link key={stat.label} to={stat.href} className='block h-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2'>
									<Card className='group h-full transition-all duration-300 hover:shadow-lg hover:-translate-y-1'>
										<CardContent className='p-5 flex flex-col h-full'>
											<div className='flex items-start justify-between gap-4'>
												<div className='min-w-0'>
													<p className='text-sm font-medium text-muted-foreground'>{stat.label}</p>
													<p className='mt-1 whitespace-nowrap text-2xl font-bold tracking-tight tabular-nums text-foreground'>{stat.value}</p>
												</div>
												<div className={`h-12 w-12 rounded-xl flex items-center justify-center ${tone.iconBg}/10`}>
													<stat.icon className={`h-6 w-6 ${tone.iconText}`} />
												</div>
											</div>
											<div className='mt-auto pt-4 space-y-2 text-sm'>
												<div className='flex items-center gap-1.5'>
													{stat.warn ? (
														<>
															<AlertTriangle className='w-4 h-4 text-amber-500' />
															<span className='font-medium text-amber-600'>{stat.footer}</span>
														</>
													) : (
														<>
															<CheckCircle2 className={`w-4 h-4 ${tone.footer}`} />
															<span className={`font-medium ${tone.footer}`}>{stat.footer}</span>
														</>
													)}
												</div>
												<span className='inline-flex items-center gap-1 text-xs font-semibold text-primary'>
													{stat.actionLabel}
													<ChevronRight className='w-3.5 h-3.5' />
												</span>
											</div>
										</CardContent>
									</Card>
								</Link>
							);
						})}
					</div>

					{/* Main Content Grid */}
					<div className='grid grid-cols-1 lg:grid-cols-3 gap-6'>
						<div className='lg:col-span-2 space-y-6'>
							{/* Next step */}
							<Card data-testid='dashboard-next-step-card'>
								<CardHeader className='border-b border-slate-100 bg-zinc-50/60 px-6 py-4'>
									<div className='flex items-center justify-between'>
										<div>
											<CardTitle className='text-lg flex items-center gap-2 text-slate-900'>
												<Wand2 className='w-5 h-5 text-primary' />
												Your next step
											</CardTitle>
											<CardDescription>One action moves the whole timetable forward.</CardDescription>
										</div>
										{next.warn ? (
											<Badge className='border-0 bg-amber-100 text-amber-700 hover:bg-amber-100 gap-1.5'>
												<AlertTriangle className='w-3.5 h-3.5' />
												{next.warn}
											</Badge>
										) : null}
									</div>
								</CardHeader>
								<CardContent className='p-6'>
									<h2 className='text-xl font-bold text-slate-900'>{next.title}</h2>
									<p className='mt-2 text-sm leading-relaxed text-slate-500'>{next.body}</p>
									<p className='mt-2 text-sm font-medium text-slate-600'>{readinessSourceMessage}</p>
									<div className='mt-4'>
										<Link to={next.href} data-repair-target='next-step'>
											<Button className='h-10 gap-2 bg-primary hover:bg-primary/90 text-primary-foreground font-semibold rounded-xl shadow-primary-glow'>
												{next.cta}
												<ArrowRight className='w-4 h-4' />
											</Button>
										</Link>
									</div>
								</CardContent>
							</Card>


							{/* Scheduling lifecycle */}
							<Card>
								<CardHeader className='border-b border-slate-100 bg-zinc-50/60 px-6 py-4'>
									<div className='flex items-center justify-between'>
										<div>
											<CardTitle className='text-lg flex items-center gap-2 text-slate-900'>Scheduling lifecycle</CardTitle>
											<CardDescription>Move through every phase before students see a published schedule.</CardDescription>
										</div>
										<Badge variant='outline' className='bg-primary/5 text-primary gap-1.5 px-3 py-1.5'>
											Phase {phaseNumber}/{LIFECYCLE_STEPS.length}
										</Badge>
									</div>
								</CardHeader>
								<CardContent className='px-6 py-4'>
									{/* Two-column body on desktop */}
									<div className='grid grid-cols-1 lg:grid-cols-2 gap-5'>
										{/* Left: current phase */}
										<div className='space-y-4'>
											<div className='flex items-start gap-3'>
												<div className='shrink-0 rounded-xl bg-primary/10 p-2.5'>
													<Wand2 className='w-5 h-5 text-primary' />
												</div>
												<div className='min-w-0'>
													<p className='text-xs font-bold uppercase tracking-wider text-primary'>Current phase</p>
													<p className='text-lg font-bold text-slate-900 mt-0.5'>{LIFECYCLE_STEPS[currentIdx]?.label ?? 'Setup'}</p>
													<p className='text-sm text-slate-500 mt-1 leading-relaxed'>{LIFECYCLE_STEPS[currentIdx]?.helper}</p>
												</div>
											</div>
											<div>
												<Link to={next.href} className='inline-flex items-center gap-1.5 text-sm font-semibold text-primary hover:underline'>
													{next.cta}
													<ArrowRight className='w-4 h-4' />
												</Link>
											</div>
										</div>

										{/* Right: blocker summary */}
										<div className='space-y-2.5'>
											<p className='text-xs font-bold uppercase tracking-wider text-slate-400'>Before generation</p>
											<div className='grid grid-cols-2 gap-2.5'>
												<div className='flex items-center gap-2.5 text-sm'>
													{(unassignedSubjectCount ?? 0) > 0 ? (
														<AlertTriangle className='w-4 h-4 shrink-0 text-amber-500' />
													) : (
														<CheckCircle2 className='w-4 h-4 shrink-0 text-emerald-500' />
													)}
													<span className={(unassignedSubjectCount ?? 0) > 0 ? 'text-slate-900 font-medium' : 'text-slate-500'}>
														{(unassignedSubjectCount ?? 0) > 0 ? `${unassignedSubjectCount} unassigned` : 'Subjects assigned'}
													</span>
												</div>
												<div className='flex items-center gap-2.5 text-sm'>
													{buildingSetupStatus.done ? (
														<CheckCircle2 className='w-4 h-4 shrink-0 text-emerald-500' />
													) : (
														<AlertTriangle className='w-4 h-4 shrink-0 text-amber-500' />
													)}
													<span className={buildingSetupStatus.done ? 'text-slate-500' : 'text-slate-900 font-medium'}>Rooms ready</span>
												</div>
												<div className='flex items-center gap-2.5 text-sm'>
													{(violationCount ?? 0) > 0 ? (
														<AlertTriangle className='w-4 h-4 shrink-0 text-amber-500' />
													) : (
														<CheckCircle2 className='w-4 h-4 shrink-0 text-emerald-500' />
													)}
													<span className={(violationCount ?? 0) > 0 ? 'text-slate-900 font-medium' : 'text-slate-500'}>
														{(violationCount ?? 0) > 0 ? `${violationCount} review blocker${violationCount === 1 ? '' : 's'}` : 'No blockers'}
													</span>
												</div>
												<div className='flex items-center gap-2.5 text-sm'>
													{lifecyclePhase === 'PUBLISHED' ? (
														<CheckCircle2 className='w-4 h-4 shrink-0 text-emerald-500' />
													) : (
														<AlertTriangle className='w-4 h-4 shrink-0 text-amber-500' />
													)}
													<span className={lifecyclePhase === 'PUBLISHED' ? 'text-slate-500' : 'text-slate-900 font-medium'}>
														{lifecyclePhase === 'PUBLISHED' ? 'Published' : 'Publish locked'}
													</span>
												</div>
											</div>
										</div>
									</div>

									{/* Progress rail */}
									<div className='mt-5 pt-4 border-t border-slate-100'>
										<ol className='flex items-center gap-1'>
											{LIFECYCLE_STEPS.map((step, idx) => {
												const state = idx < currentIdx ? 'done' : idx === currentIdx ? 'active' : 'upcoming';
												return (
													<li key={step.key} className='flex-1 min-w-0 flex items-center gap-1'>
														<div className={`h-2 flex-1 rounded-full transition-colors ${state === 'done' ? 'bg-emerald-300' : state === 'active' ? 'bg-primary' : 'bg-slate-200'}`} />
														<span className={`text-xs font-medium whitespace-nowrap ${state === 'active' ? 'text-primary' : state === 'done' ? 'text-emerald-600' : 'text-slate-400'}`}>{step.label}</span>
													</li>
												);
											})}
										</ol>
									</div>
								</CardContent>
							</Card>
						</div>

						{/* Setup readiness */}
						<Card data-testid='dashboard-readiness-hub'>
								<CardHeader className='border-b border-slate-100 px-6 py-4'>
									<div className='flex items-start justify-between gap-3'>
										<div>
											<CardTitle className='text-lg text-slate-900'>Setup readiness</CardTitle>
											<CardDescription>{doneCount} of {checklist.length} ready</CardDescription>
										</div>
										<Badge className='border-0 bg-emerald-50 text-emerald-700 hover:bg-emerald-50'>
											{doneCount}/{checklist.length}
										</Badge>
									</div>
								</CardHeader>
								<CardContent className='p-2'>
									<ul className='divide-y divide-slate-100'>
										{(() => {
											const firstUncompletedIdx = checklist.findIndex((item) => !item.done);
											return checklist.map((item, idx) => {
												const isNextTask = idx === firstUncompletedIdx;
												return (
													<li key={item.label} className={!showAllSetupSteps && idx >= 3 ? 'hidden sm:block' : undefined}>
														<Link to={item.href} className={`flex items-start gap-3 rounded-xl px-3 py-2.5 transition-colors hover:bg-slate-50/80 sm:px-4 sm:py-3 ${isNextTask ? 'ring-2 ring-amber-300 bg-amber-50/20' : ''}`}>
															{item.done ? (
																<div className='mt-0.5 p-1 rounded-full bg-emerald-100'>
																	<CheckCircle2 className='w-4 h-4 text-emerald-600' />
																</div>
															) : (
																<div className='mt-0.5 p-1 rounded-full bg-slate-100'>
																	<div className='w-4 h-4 rounded-full border-2 border-slate-300' />
																</div>
															)}
															<div className='flex-1 min-w-0'>
																<p className={`text-sm font-medium ${item.done ? 'text-slate-400 line-through' : 'text-slate-900'}`}>{item.label}</p>
																{item.hint ? (
																	<p className='flex items-center gap-1 text-xs text-amber-600 mt-1'>
																		<AlertTriangle className='w-3 h-3' />
																		{item.hint}
																	</p>
																) : null}
															</div>
															<ChevronRight className='w-4 h-4 text-slate-300 mt-1' />
														</Link>
													</li>
												);
											});
										})()}
									</ul>
									{checklist.length > 3 && (
										<div className='border-t border-slate-100 px-4 py-2 sm:hidden'>
											<Button type='button' variant='ghost' size='sm' className='h-9 w-full justify-center rounded-xl text-xs font-bold' onClick={() => setShowAllSetupSteps((v) => !v)} aria-expanded={showAllSetupSteps}>
												{showAllSetupSteps ? 'Show fewer setup steps' : 'View all setup steps'}
											</Button>
										</div>
									)}
								</CardContent>
							</Card>
					</div>

					{/* Campus Map & Rooms – full-width */}
					<Suspense fallback={<Card><CardContent className='p-6 text-sm text-slate-500'>Loading campus map…</CardContent></Card>}>
						<CampusReadinessCard
							loading={loading}
							buildings={buildings}
							campusImageUrl={campusImageUrl}
							teachingRoomCount={teachingRoomCount}
							totalRoomCount={totalRoomCount}
							setupStatus={buildingSetupStatus}
						/>
					</Suspense>
				</div>
			</div>
		</div>
	);
}
