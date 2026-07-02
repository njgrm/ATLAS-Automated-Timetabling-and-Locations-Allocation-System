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
	Layers,
	Wand2,
	ClipboardList,
	CalendarRange,
	RefreshCw,
	Sparkles,
} from 'lucide-react';
import { Badge } from '@/ui/badge';
import { Button } from '@/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/ui/card';
import { useDashboardData, type LifecyclePhase } from '@/hooks/useDashboardData';
import { CampusReadinessCard } from '@/components/dashboard/CampusReadinessCard';

// Tone vocabulary — only `brand` is school-token-driven; the others are reserved
// for semantic meaning (info/students/warning) and must stay independent of the
// school brand color so they continue to read as their own categories.
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
	blockerCopy: string;
	repairTarget: string;
}

const TONE: Record<StatTone, { iconBg: string; iconRing: string; footer: string }> = {
	brand: {
		iconBg: 'bg-primary',
		iconRing: 'ring-primary/15',
		// Footer line is the "this is good" confirmation under each stat tile, so it
		// stays emerald — universal correctness signal — even though the icon chip
		// itself carries the school's brand color.
		footer: 'text-emerald-600',
	},
	sky: {
		iconBg: 'bg-sky-500',
		iconRing: 'ring-sky-100',
		footer: 'text-sky-600',
	},
	violet: {
		iconBg: 'bg-violet-500',
		iconRing: 'ring-violet-100',
		footer: 'text-violet-600',
	},
	amber: {
		iconBg: 'bg-amber-500',
		iconRing: 'ring-amber-100',
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

const PHASE_LABEL: Record<LifecyclePhase, string> = {
	SETUP: 'Setup phase',
	PREFERENCES: 'Preference phase',
	GENERATION: 'Generation phase',
	REVIEW: 'Review phase',
	PUBLISHED: 'Published',
};

const SOURCE_BADGE_COPY: Record<string, string> = {
	verified_live: 'Verified live',
	checking_source: 'Checking source',
	using_saved_data: 'Using saved data',
	no_saved_data: 'No saved data',
	partial_degraded: 'Partial data',
};

const SOURCE_BADGE_CLASS: Record<string, string> = {
	verified_live: 'border-0 bg-emerald-50 text-emerald-700 hover:bg-emerald-50',
	checking_source: 'border-0 bg-sky-50 text-sky-700 hover:bg-sky-50',
	using_saved_data: 'border-0 bg-sky-50 text-sky-700 hover:bg-sky-50',
	no_saved_data: 'border-0 bg-slate-100 text-slate-600 hover:bg-slate-100',
	partial_degraded: 'border-0 bg-amber-100 text-amber-700 hover:bg-amber-100',
};

type NextStep = {
	title: string;
	body: string;
	cta: string;
	href: string;
	warn?: string;
};

function pickNextStep(args: {
	phase: LifecyclePhase;
	subjectCount: number | null;
	facultyCount: number | null;
	sectionCount: number | null;
	unassignedSubjectCount: number | null;
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
		buildingsDone,
		latestRunStatus,
		violationCount,
	} = args;

	if (phase === 'SETUP') {
		if ((subjectCount ?? 0) === 0) {
			return {
				title: 'Add the curriculum',
				body: 'Load the subject catalog before assigning teachers or generating.',
				cta: 'Open subjects',
				href: '/subjects',
			};
		}
		if ((facultyCount ?? 0) === 0) {
			return {
				title: 'Sync teachers from EnrollPro',
				body: 'Pull the faculty roster so subjects can be assigned.',
				cta: 'Open teachers',
				href: '/teachers',
			};
		}
		if ((unassignedSubjectCount ?? 0) > 0) {
			return {
				title: 'Assign teachers to every subject',
				body: `${unassignedSubjectCount} subject${unassignedSubjectCount === 1 ? '' : 's'} still need a teacher before generation.`,
				cta: 'Open teaching load',
				href: '/teaching-load',
			};
		}
		if (sectionCount === null) {
			return {
				title: 'Reconnect enrollment data',
				body: 'EnrollPro is not reachable. Check the link before generating.',
				cta: 'Check sections',
				href: '/sections',
				warn: 'Enrollment unavailable',
			};
		}
		if ((sectionCount ?? 0) === 0) {
			return {
				title: 'Confirm sections for this school year',
				body: 'No sections were found. Verify enrollment before generating.',
				cta: 'Check sections',
				href: '/sections',
			};
		}
		if (!buildingsDone) {
			return {
				title: 'Finish campus setup',
				body: 'Mark every teaching room before generation so placements have rooms.',
				cta: 'Open campus map',
				href: '/map',
			};
		}
	}
	if (phase === 'PREFERENCES') {
		return {
			title: 'Generate the timetable',
			body: 'Setup is complete. Run the generator and review the result.',
			cta: 'Open timetable',
			href: '/timetable',
		};
	}
	if (phase === 'GENERATION') {
		if (latestRunStatus === 'FAILED') {
			return {
				title: 'Last generation run failed',
				body: 'Review the failure cause and retry generation.',
				cta: 'Open timetable',
				href: '/timetable',
				warn: 'Run failed',
			};
		}
		return {
			title: 'Generation in progress',
			body: 'The algorithm is still running. Open the timetable to watch progress.',
			cta: 'Open timetable',
			href: '/timetable',
		};
	}
	if (phase === 'REVIEW') {
		if ((violationCount ?? 0) > 0) {
			return {
				title: 'Resolve scheduling violations',
				body: `${violationCount} constraint violation${violationCount === 1 ? '' : 's'} need attention before publish.`,
				cta: 'Open audit',
				href: '/audit?focus=timetable',
				warn: `${violationCount} blocker${violationCount === 1 ? '' : 's'}`,
			};
		}
		return {
			title: 'Review and publish the schedule',
			body: 'Generation finished with no hard violations. Confirm the result and publish it.',
			cta: 'Open schedules',
			href: '/schedules',
		};
	}
	return {
		title: 'Schedule is published',
		body: 'Faculty and students can see the timetable. Use Exceptions for in-term changes.',
		cta: 'Open schedules',
		href: '/schedules',
	};
}

export default function Dashboard() {
	const {
		loading,
		buildings,
		campusImageUrl,
		subjectCount,
		facultyCount,
		sectionCount,
		unassignedSubjectCount,
		buildingSetupStatus,
		teachingRoomCount,
		totalRoomCount,
		activeSchoolYearLabel,
		latestRunStatus,
		violationCount,
		lifecyclePhase,
		readinessSourceState,
		readinessSourceMessage,
		refreshDashboard,
	} = useDashboardData();

	const next = pickNextStep({
		phase: lifecyclePhase,
		subjectCount,
		facultyCount,
		sectionCount,
		unassignedSubjectCount,
		buildingsDone: buildingSetupStatus.done,
		latestRunStatus,
		violationCount,
	});

	const stats: StatTile[] = [
		{
			label: 'Sections',
			value: loading ? '…' : sectionCount === null ? '—' : `${sectionCount}`,
			footer: sectionCount === null
				? 'Enrollment unavailable'
				: activeSchoolYearLabel
					? `S.Y. ${activeSchoolYearLabel}`
					: 'Active school year',
			icon: GraduationCap,
			tone: 'violet',
			warn: sectionCount === null,
			href: '/sections',
			actionLabel: 'Check sections',
			blockerCopy: sectionCount === null
				? 'Generation needs the current school-year sections before it can build classes.'
				: 'Section setup controls which classes must appear in the timetable.',
			repairTarget: 'sections',
		},
		{
			label: 'Subjects',
			value: loading ? '…' : `${subjectCount ?? 0}`,
			footer: 'Curriculum loaded',
			icon: BookOpen,
			tone: 'brand',
			href: '/subjects',
			actionLabel: 'Review subjects',
			blockerCopy: 'Curriculum gaps can leave sections without required classes.',
			repairTarget: 'subjects',
		},
		{
			label: 'Teachers',
			value: loading ? '…' : `${facultyCount ?? 0}`,
			footer: 'Synced from EnrollPro',
			icon: UserCheck,
			tone: 'sky',
			href: '/teachers',
			actionLabel: 'Review teachers',
			blockerCopy: 'Teacher roster gaps can stop subject coverage and schedule placement.',
			repairTarget: 'teachers',
		},
		{
			label: 'Teaching Rooms',
			value: loading ? '…' : `${teachingRoomCount}/${totalRoomCount}`,
			footer: buildingSetupStatus.done ? 'Ready for placement' : 'Some rooms unmarked',
			icon: Building2,
			tone: buildingSetupStatus.done ? 'brand' : 'amber',
			warn: !buildingSetupStatus.done && !loading,
			href: '/map',
			actionLabel: 'Check rooms',
			blockerCopy: 'Room setup tells ATLAS which spaces are safe to use for classes.',
			repairTarget: 'map',
		},
	];

	// Checklist order matches the operator chronology codified in the audit:
	// Sections → Subjects → Teachers → Every subject has a teacher → Rooms ready.
	const checklist = [
		{
			label: 'Sections loaded for school year',
			done: (sectionCount ?? 0) > 0,
			href: '/sections',
			hint: sectionCount === null ? 'Enrollment unavailable' : undefined,
		},
		{ label: 'Subjects added', done: (subjectCount ?? 0) > 0, href: '/subjects' },
		{ label: 'Teachers synced from EnrollPro', done: (facultyCount ?? 0) > 0, href: '/teachers' },
		{
			label: 'Every subject has a teacher',
			done: unassignedSubjectCount === 0 && (subjectCount ?? 0) > 0,
			href: '/teaching-load',
			hint: unassignedSubjectCount && unassignedSubjectCount > 0
				? `${unassignedSubjectCount} unassigned`
				: undefined,
		},
		{
			label: 'Buildings and rooms ready',
			done: buildingSetupStatus.done,
			href: '/map',
			hint: buildingSetupStatus.subMessage,
		},
	];

	const doneCount = checklist.filter((c) => c.done).length;
	const currentIdx = LIFECYCLE_STEPS.findIndex((s) => s.key === lifecyclePhase);
	const phaseNumber = currentIdx + 1;

	return (
		<div className='h-[calc(100svh-3.5rem)] overflow-auto scrollbar-thin'>
			<div className='max-w-7xl mx-auto px-6 lg:px-8 py-8 space-y-8 animate-fade-in'>
				{/* Header */}
				<div className='flex flex-col lg:flex-row lg:items-end lg:justify-between gap-4'>
					<div>
						<h1 className='text-3xl font-bold text-slate-900'>Scheduling Dashboard</h1>
						<p className='text-slate-500 mt-1.5'>
							Build, review, and publish the school timetable.
						</p>
					</div>
					<div className='flex flex-wrap items-center gap-2'>
						<Badge className={`${SOURCE_BADGE_CLASS[readinessSourceState]} font-semibold gap-1.5 px-3 py-1.5 rounded-full`}>
							{readinessSourceState === 'partial_degraded' ? (
								<AlertTriangle className='w-3.5 h-3.5' />
							) : (
								<CheckCircle2 className='w-3.5 h-3.5' />
							)}
							{SOURCE_BADGE_COPY[readinessSourceState]}
						</Badge>
						<Button
							type='button'
							variant='outline'
							size='sm'
							className='h-9 rounded-xl bg-white gap-2'
							onClick={refreshDashboard}
							disabled={loading}
							aria-label='Check dashboard readiness for updates'
						>
							<RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
							Check for updates
						</Button>
						<Badge className='border-0 bg-primary/10 text-primary hover:bg-primary/10 font-semibold gap-1.5 px-3 py-1.5 rounded-full'>
							<Sparkles className='w-3.5 h-3.5' />
							{PHASE_LABEL[lifecyclePhase]}
						</Badge>
						<Link to='/timetable'>
							<Button className='gap-2 bg-primary hover:bg-primary/90 text-primary-foreground font-semibold rounded-xl shadow-primary-glow'>
								<CalendarRange className='w-4 h-4' />
								Open Timetable
							</Button>
						</Link>
					</div>
				</div>

				{/* Stat tiles */}
				<div className='grid grid-cols-2 lg:grid-cols-4 gap-4 lg:gap-6'>
					{stats.map((stat) => {
						const tone = TONE[stat.tone];
						return (
							<Link
								key={stat.label}
								to={stat.href}
								data-repair-target={stat.repairTarget}
								aria-label={`${stat.actionLabel}: ${stat.blockerCopy}`}
								className='block h-full rounded-2xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2'
							>
								<Card className='group h-full border-0 shadow-soft hover:shadow-soft-xl transition-all duration-300 bg-white rounded-2xl overflow-hidden p-0'>
									<CardContent className='p-6 flex flex-col h-full'>
										<div className='flex items-start justify-between gap-4'>
											<div className='min-w-0'>
												<p className='text-sm font-medium text-slate-500'>{stat.label}</p>
												<p className='text-3xl font-bold text-slate-900 mt-2 tabular-nums'>
													{stat.value}
												</p>
											</div>
											<div
												className={`p-3 rounded-xl text-primary-foreground shadow-lg ring-4 ${tone.iconBg} ${tone.iconRing} group-hover:scale-110 transition-transform`}
											>
												<stat.icon className='w-5 h-5' />
											</div>
										</div>
										<div className='mt-5 pt-4 border-t border-slate-100 space-y-2 text-sm'>
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
											<p className='text-xs leading-relaxed text-slate-500'>{stat.blockerCopy}</p>
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

				{/* Inline workflow status cards */}
				<div className='grid grid-cols-1 md:grid-cols-2 gap-4'>
					<Card className='border-0 shadow-soft rounded-2xl bg-white p-0'>
						<CardContent className='p-5'>
							<div className='flex items-center justify-between'>
								<div className='flex items-center gap-3'>
									<div className='p-2.5 rounded-xl bg-primary/10'>
										<Layers className='w-5 h-5 text-primary' />
									</div>
									<div>
										<p className='text-sm font-medium text-slate-500'>Current phase</p>
										<p className='text-xl font-bold text-primary'>
											{LIFECYCLE_STEPS[currentIdx]?.label ?? 'Setup'}
										</p>
									</div>
								</div>
								<Badge className='border-0 bg-primary/10 text-primary hover:bg-primary/10'>
									Step {phaseNumber} of {LIFECYCLE_STEPS.length}
								</Badge>
							</div>
						</CardContent>
					</Card>
					<Card className='border-0 shadow-soft rounded-2xl bg-white p-0'>
						<CardContent className='p-5'>
							<div className='flex items-center justify-between'>
								<div className='flex items-center gap-3'>
									<div
										className={`p-2.5 rounded-xl ${
											unassignedSubjectCount && unassignedSubjectCount > 0
												? 'bg-amber-50'
												: 'bg-primary/10'
										}`}
									>
										<ClipboardList
											className={`w-5 h-5 ${
												unassignedSubjectCount && unassignedSubjectCount > 0
													? 'text-amber-600'
													: 'text-primary'
											}`}
										/>
									</div>
									<div>
										<p className='text-sm font-medium text-slate-500'>Unassigned subjects</p>
										<p
											className={`text-xl font-bold ${
												unassignedSubjectCount && unassignedSubjectCount > 0
													? 'text-amber-600'
													: 'text-primary'
											}`}
										>
											{loading ? '…' : unassignedSubjectCount ?? 0}
										</p>
										<p className='mt-1 text-xs text-slate-500'>
											Every subject needs a teacher before generation can place classes reliably.
										</p>
									</div>
								</div>
								<Link to='/teaching-load' data-repair-target='teaching-load'>
									<Button
										variant='ghost'
										size='sm'
										className='rounded-lg text-slate-500 hover:text-slate-900 gap-1'
									>
										Open
										<ChevronRight className='w-4 h-4' />
									</Button>
								</Link>
							</div>
						</CardContent>
					</Card>
				</div>

				{/* Next step + setup checklist */}
				<div className='grid grid-cols-1 lg:grid-cols-3 gap-6'>
					<Card className='lg:col-span-2 border-0 shadow-soft-xl rounded-2xl bg-white overflow-hidden p-0'>
						<CardHeader className='border-b border-slate-100 px-6 py-4 bg-primary/5'>
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
							<p className='text-slate-500 mt-2 leading-relaxed'>{next.body}</p>
							<p className='mt-2 text-sm font-medium text-slate-600'>{readinessSourceMessage}</p>
							<div className='mt-6'>
								<Link to={next.href} data-repair-target='next-step'>
									<Button className='gap-2 bg-primary hover:bg-primary/90 text-primary-foreground font-semibold rounded-xl shadow-primary-glow'>
										{next.cta}
										<ArrowRight className='w-4 h-4' />
									</Button>
								</Link>
							</div>
						</CardContent>
					</Card>

					<Card className='border-0 shadow-soft-xl rounded-2xl bg-white p-0 overflow-hidden'>
						<CardHeader className='border-b border-slate-100 px-6 py-4'>
							<div className='flex items-center justify-between'>
								<div>
									<CardTitle className='text-lg text-slate-900'>Setup readiness</CardTitle>
									<CardDescription>
										{doneCount} of {checklist.length} ready
									</CardDescription>
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
											<li key={item.label}>
												<Link
													to={item.href}
													className={`flex items-start gap-3 px-4 py-3 rounded-xl hover:bg-slate-50/80 transition-colors ${
														isNextTask ? 'ring-2 ring-amber-300 bg-amber-50/20' : ''
													}`}
												>
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
														<p
															className={`text-sm font-medium ${
																item.done ? 'text-slate-400 line-through' : 'text-slate-900'
															}`}
														>
															{item.label}
														</p>
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
						</CardContent>
					</Card>
				</div>

				{/* Lifecycle banner — token-driven gradient so HNHS maroon, EnrollPro custom
				    brand, or default emerald all render as the school's own banner. */}
				<Card
					className='border-0 shadow-soft-xl rounded-2xl overflow-hidden p-0 text-primary-foreground'
					style={{
						background:
							'linear-gradient(135deg, hsl(var(--primary)) 0%, hsl(var(--primary) / 0.92) 55%, hsl(var(--primary) / 0.78) 100%)',
					}}
				>
					<CardContent className='p-6 lg:p-8'>
						<div className='flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 mb-6'>
							<div>
								<p className='text-xs font-bold uppercase tracking-wider text-primary-foreground/70'>
									Scheduling lifecycle
								</p>
								<h3 className='text-xl lg:text-2xl font-bold mt-1'>Where the school year stands</h3>
								<p className='text-primary-foreground/80 text-sm mt-1'>
									Move through every phase before students see a published schedule.
								</p>
							</div>
							<Badge className='border-0 bg-white/15 text-primary-foreground hover:bg-white/15 backdrop-blur gap-1.5 px-3 py-1.5 self-start lg:self-auto'>
								<Layers className='w-3.5 h-3.5' />
								Phase {phaseNumber} of {LIFECYCLE_STEPS.length}: {LIFECYCLE_STEPS[currentIdx]?.label}
							</Badge>
						</div>
						<ol className='grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3'>
							{LIFECYCLE_STEPS.map((step, idx) => {
								const state = idx < currentIdx ? 'done' : idx === currentIdx ? 'active' : 'upcoming';
								return (
									<li
										key={step.key}
										className={`rounded-xl p-4 border transition-colors ${
											state === 'active'
												? 'bg-white text-slate-900 border-white shadow-lg'
												: state === 'done'
												? 'bg-white/15 text-primary-foreground border-emerald-300/40 backdrop-blur'
													: 'bg-white/5 text-primary-foreground/70 border-white/10'
										}`}
									>
										<div className='flex items-center gap-2'>
											<span
												className={`flex items-center justify-center w-6 h-6 rounded-full text-xs font-bold ${
													state === 'active'
														? 'bg-primary text-primary-foreground'
														: state === 'done'
															? 'bg-emerald-400 text-white'
															: 'bg-white/15 text-primary-foreground/80'
												}`}
											>
												{idx + 1}
											</span>
											<p className='font-semibold text-sm'>{step.label}</p>
										</div>
										<p
											className={`text-xs mt-2 ${
												state === 'active' ? 'text-slate-500' : 'text-primary-foreground/70'
											}`}
										>
											{step.helper}
										</p>
									</li>
								);
							})}
						</ol>
					</CardContent>
				</Card>

				<CampusReadinessCard
					loading={loading}
					buildings={buildings}
					campusImageUrl={campusImageUrl}
					teachingRoomCount={teachingRoomCount}
					totalRoomCount={totalRoomCount}
					setupStatus={buildingSetupStatus}
				/>
			</div>
		</div>
	);
}
