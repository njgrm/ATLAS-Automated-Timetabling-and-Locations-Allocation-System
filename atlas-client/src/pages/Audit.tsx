import { useState, useEffect, useMemo } from 'react';
import {
	AlertTriangle,
	ArrowRight,
	BookX,
	Box,
	CheckCircle2,
	Clock,
	Loader2,
	RefreshCw,
	Search,
	ShieldCheck,
	UserMinus,
	XCircle,
} from 'lucide-react';
import { Link, useSearchParams } from 'react-router-dom';
import { toast } from 'sonner';

import atlasApi from '@/lib/api';
import { resolveActiveSchoolYearContext } from '@/lib/enrollpro-public-settings';
import { Badge } from '@/ui/badge';
import { Button } from '@/ui/button';
import { Card, CardContent } from '@/ui/card';
import { Input } from '@/ui/input';
import { ScrollArea } from '@/ui/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/ui/tabs';

const DEFAULT_SCHOOL_ID = 1;

const AUDIT_DOMAINS = [
	'Teacher assignments',
	'Section coverage',
	'Rooms and facilities',
	'Teacher constraints',
	'Live and saved data',
];

type ActiveYearSource = 'atlas-persisted' | 'enrollpro-verified' | 'enrollpro' | 'cache';
type DataSource = 'live' | 'cached' | 'none';
type FindingSeverity = 'blocker' | 'warning' | 'info';

type Finding = {
	id: string;
	title: string;
	blockedLabel: string;
	detail: string;
	why: string;
	actionLabel: string;
	route: string;
	repairTarget: string;
	severity: FindingSeverity;
};

type FindingGroup = {
	id: string;
	label: string;
	description: string;
	icon: typeof ShieldCheck;
	findings: Finding[];
	blockedLabel: string;
	why: string;
	primaryActionLabel: string;
	primaryRoute: string;
	repairTarget: string;
	secondaryActionLabel?: string;
	secondaryRoute?: string;
	emptyTitle: string;
	emptyBody: string;
};

function severityClassName(severity: FindingSeverity): string {
	if (severity === 'blocker') return 'border-red-200 bg-red-50 text-red-700';
	if (severity === 'warning') return 'border-amber-200 bg-amber-50 text-amber-700';
	return 'border-sky-200 bg-sky-50 text-sky-700';
}

function severityLabel(severity: FindingSeverity): string {
	if (severity === 'blocker') return 'Blocks readiness';
	if (severity === 'warning') return 'Needs review';
	return 'Check source';
}

export default function Audit() {
	const [searchParams] = useSearchParams();
	const [loading, setLoading] = useState(true);
	const [faculty, setFaculty] = useState<any[]>([]);
	const [subjects, setSubjects] = useState<any[]>([]);
	const [aliases, setAliases] = useState<any[]>([]);
	const [prefAudit, setPrefAudit] = useState<any[]>([]);
	const [sections, setSections] = useState<any[]>([]);
	const [templates, setTemplates] = useState<any[]>([]);
	const [rooms, setRooms] = useState<any[]>([]);
	const [searchQuery, setSearchQuery] = useState('');
	const [activeSchoolYearId, setActiveSchoolYearId] = useState<number | null>(null);
	const [activeYearSource, setActiveYearSource] = useState<ActiveYearSource>('cache');
	const [dataSource, setDataSource] = useState<DataSource>('none');
	const [degradedReasons, setDegradedReasons] = useState<string[]>([]);

	useEffect(() => {
		resolveActiveSchoolYearContext({ allowStaleOnError: true }).then((context) => {
			if (context.activeSchoolYearId) {
				setActiveSchoolYearId(context.activeSchoolYearId);
				setActiveYearSource(context.source);
			} else {
				setLoading(false);
				toast.error('No active school year found');
			}
		}).catch(() => {
			setLoading(false);
			toast.error('No active school year found');
		});
	}, []);

	useEffect(() => {
		if (activeSchoolYearId) {
			void loadData();
		}
	}, [activeSchoolYearId]);

	const loadData = async () => {
		if (!activeSchoolYearId) return;
		setLoading(true);
		try {
			const [facRes, subRes, aliasRes, prefRes, secRes, templateRes, roomRes] = await Promise.allSettled([
				atlasApi.get('/faculty-assignments/summary', { params: { schoolId: DEFAULT_SCHOOL_ID, schoolYearId: activeSchoolYearId } }),
				atlasApi.get('/subjects', { params: { schoolId: DEFAULT_SCHOOL_ID } }),
				atlasApi.get(`/specialization-aliases?schoolId=${DEFAULT_SCHOOL_ID}`),
				atlasApi.get(`/preferences/${DEFAULT_SCHOOL_ID}/${activeSchoolYearId}/audit`),
				atlasApi.get(`/sections/summary/${activeSchoolYearId}`, { params: { schoolId: DEFAULT_SCHOOL_ID } }),
				atlasApi.get(`/class-templates?schoolId=${DEFAULT_SCHOOL_ID}`),
				atlasApi.get(`/map/schools/${DEFAULT_SCHOOL_ID}/buildings`),
			]);

			const reasons: string[] = [];

			if (facRes.status === 'fulfilled') {
				setFaculty(facRes.value.data.faculty ?? []);
			} else {
				reasons.push('Teaching load summary is unavailable.');
				setFaculty([]);
			}

			if (subRes.status === 'fulfilled') {
				setSubjects(subRes.value.data.subjects ?? []);
			} else {
				reasons.push('Subject catalog is unavailable.');
				setSubjects([]);
			}

			if (aliasRes.status === 'fulfilled') {
				setAliases(aliasRes.value.data.aliases ?? []);
			} else {
				reasons.push('Specialization aliases are unavailable.');
				setAliases([]);
			}

			if (prefRes.status === 'fulfilled') {
				setPrefAudit(prefRes.value.data.audit ?? []);
			} else {
				reasons.push('Preference audit is unavailable.');
				setPrefAudit([]);
			}

			let sectionSource: string | null = null;
			if (secRes.status === 'fulfilled') {
				setSections(secRes.value.data.sections ?? []);
				sectionSource = secRes.value.data.source ?? null;
			} else {
				reasons.push('Section summary is unavailable.');
				setSections([]);
			}

			if (templateRes.status === 'fulfilled') {
				setTemplates(templateRes.value.data.templates ?? []);
			} else {
				reasons.push('Class templates are unavailable.');
				setTemplates([]);
			}

			if (roomRes.status === 'fulfilled') {
				const allRooms = (roomRes.value.data.buildings || []).flatMap((building: any) => building.rooms || []);
				setRooms(allRooms);
			} else {
				reasons.push('Room map data is unavailable.');
				setRooms([]);
			}

			const hasLocalEvidence = facRes.status === 'fulfilled' && subRes.status === 'fulfilled' && secRes.status === 'fulfilled';

			if (!hasLocalEvidence) {
				setDataSource('none');
				setDegradedReasons(reasons);
				toast.error('Readiness report cannot run because setup evidence is incomplete.');
				return;
			}

			const isUpstreamBacked = activeYearSource === 'enrollpro' && sectionSource === 'enrollpro';
			setDataSource(isUpstreamBacked ? 'live' : 'cached');
			setDegradedReasons(reasons);
			if (!isUpstreamBacked || reasons.length > 0) {
				toast.warning('Readiness report is using saved ATLAS evidence.');
			}
		} catch {
			setDataSource('none');
			setDegradedReasons(['Failed to load readiness evidence.']);
			toast.error('Failed to load readiness evidence.');
		} finally {
			setLoading(false);
		}
	};

	const checkQualification = (facultyMember: any, subject: any) => {
		const allowed = subject.allowedSpecializations || [];
		if (allowed.length === 0) return 1;
		if (facultyMember.specialization && allowed.includes(facultyMember.specialization)) return 1;
		if (facultyMember.department && allowed.includes(facultyMember.department)) return 2;

		const facultyTerms = [facultyMember.specialization, facultyMember.department].filter(Boolean);
		for (const alias of aliases) {
			if (facultyTerms.includes(alias.alias) && allowed.includes(alias.canonical)) return 3;
		}

		return null;
	};

	const mismatches = useMemo(() => {
		const list: any[] = [];
		faculty.forEach((facultyMember) => {
			(facultyMember.assignments || []).forEach((assignment: any) => {
				const subject = subjects.find((item) => item.id === assignment.subjectId);
				if (!subject || checkQualification(facultyMember, subject)) return;

				list.push({
					facultyId: facultyMember.id,
					facultyName: `${facultyMember.lastName}, ${facultyMember.firstName}`,
					subjectId: subject.id,
					subjectName: subject.name,
					subjectCode: subject.code,
					required: (subject.allowedSpecializations || []).join(', ') || 'Listed specialization',
					actual: facultyMember.specialization || facultyMember.department || 'No department listed',
				});
			});
		});
		return list;
	}, [faculty, subjects, aliases]);

	const gaps = useMemo(() => {
		return subjects.filter((subject) => {
			const allowed = subject.allowedSpecializations || [];
			if (allowed.length === 0) return false;

			const qualifiedFaculty = faculty.filter((facultyMember) => checkQualification(facultyMember, subject));
			return qualifiedFaculty.length === 0;
		});
	}, [faculty, subjects, aliases]);

	const clashes = useMemo(() => {
		return prefAudit.filter((preference) => preference.unavailabilityPercent > 50).map((preference) => {
			const qualifiedSubjects = subjects.filter((subject) => {
				const allowed = subject.allowedSpecializations || [];
				return allowed.length > 0 && ((preference.specialization && allowed.includes(preference.specialization)) || (preference.department && allowed.includes(preference.department)));
			});
			return { ...preference, qualifiedSubjects };
		}).filter((preference) => preference.qualifiedSubjects.length > 0);
	}, [prefAudit, subjects]);

	const rosterGaps = useMemo(() => {
		const missing: any[] = [];
		sections.forEach((section) => {
			const template = templates.find((item) => item.programType === section.programCode);
			if (!template) return;

			(template.subjects ?? []).forEach((requiredSubject: any) => {
				const isAssigned = faculty.some((facultyMember) =>
					(facultyMember.assignments || []).some((assignment: any) =>
						assignment.subjectId === requiredSubject.id && (assignment.sectionIds || []).includes(section.id),
					),
				);

				if (!isAssigned) {
					missing.push({
						sectionId: section.id,
						sectionName: section.name,
						gradeLevel: section.displayOrder,
						subjectId: requiredSubject.id,
						subjectName: requiredSubject.name,
						subjectCode: requiredSubject.code,
					});
				}
			});
		});
		return missing;
	}, [sections, templates, faculty]);

	const optimizationIssues = useMemo(() => {
		const issues: any[] = [];
		faculty.forEach((specialist) => {
			const specialistSubjects = subjects.filter((subject) => checkQualification(specialist, subject) === 1);
			if (specialistSubjects.length === 0) return;

			const hasGeneralLoad = (specialist.assignments || []).some((assignment: any) => {
				const subject = subjects.find((item) => item.id === assignment.subjectId);
				const tier = subject ? checkQualification(specialist, subject) : null;
				return tier === 3 || tier === null;
			});

			if (!hasGeneralLoad) return;

			specialistSubjects.forEach((subject) => {
				const assignedToOther = faculty.some((otherFaculty) =>
					otherFaculty.id !== specialist.id &&
					(otherFaculty.assignments || []).some((assignment: any) => assignment.subjectId === subject.id) &&
					checkQualification(otherFaculty, subject) !== 1,
				);

				if (assignedToOther) {
					issues.push({
						specialistId: specialist.id,
						specialistName: `${specialist.lastName}, ${specialist.firstName}`,
						specialization: specialist.specialization || specialist.department,
						subjectName: subject.name,
						subjectCode: subject.code,
					});
				}
			});
		});
		return issues;
	}, [faculty, subjects, aliases]);

	const facilityGaps = useMemo(() => {
		return subjects.filter((subject) => subject.requiredFeatures?.length > 0).map((subject) => {
			const compatible = rooms.filter((room) =>
				room.type === subject.preferredRoomType &&
				subject.requiredFeatures.every((feature: string) => (room.features || []).includes(feature)),
			);
			return { ...subject, compatibleCount: compatible.length };
		}).filter((subject) => subject.compatibleCount === 0);
	}, [subjects, rooms]);

	const syncIssues = useMemo(() => {
		return faculty.filter((facultyMember) => !facultyMember.employeeId || facultyMember.employeeId.length !== 7).map((facultyMember) => ({
			id: facultyMember.id,
			name: `${facultyMember.lastName}, ${facultyMember.firstName}`,
			reason: !facultyMember.employeeId ? 'Missing employee ID' : 'Employee ID must be 7 digits',
		}));
	}, [faculty]);

	const assignmentFindings: Finding[] = [
		...mismatches.map((mismatch, index) => ({
			id: `assignment-mismatch-${mismatch.facultyId}-${mismatch.subjectId}-${index}`,
			title: `${mismatch.facultyName} is assigned to ${mismatch.subjectName}`,
			blockedLabel: 'Teacher assignment is not ready for scheduling.',
			detail: `Required: ${mismatch.required}. Current record: ${mismatch.actual}.`,
			why: 'Teacher-subject mismatch can create hard schedule violations during review.',
			actionLabel: 'Fix teacher assignment',
			route: `/teaching-load?facultyId=${mismatch.facultyId}&subjectId=${mismatch.subjectId}`,
			repairTarget: 'teaching-load',
			severity: 'blocker' as FindingSeverity,
		})),
		...gaps.map((subject, index) => ({
			id: `assignment-gap-${subject.id}-${index}`,
			title: `${subject.name} has no qualified teacher`,
			blockedLabel: 'Subject coverage is not ready for generation.',
			detail: `Required coverage: ${(subject.allowedSpecializations || []).join(', ') || 'listed specialization'}.`,
			why: 'ATLAS needs at least one qualified teacher before this subject can be placed reliably.',
			actionLabel: 'Review teaching load',
			route: `/teaching-load?subjectId=${subject.id}`,
			repairTarget: 'teaching-load',
			severity: 'blocker' as FindingSeverity,
		})),
		...optimizationIssues.map((issue, index) => ({
			id: `assignment-balance-${issue.specialistId}-${issue.subjectCode}-${index}`,
			title: `${issue.specialistName} may be better used for ${issue.subjectName}`,
			blockedLabel: 'Teacher capacity may be used in the wrong place.',
			detail: `${issue.specialization || 'Specialist'} capacity is being used away from a subject they directly match.`,
			why: 'Better teacher placement can reduce later manual repairs.',
			actionLabel: 'Review load balance',
			route: `/teaching-load?facultyId=${issue.specialistId}`,
			repairTarget: 'teaching-load',
			severity: 'warning' as FindingSeverity,
		})),
	];

	const sectionFindings: Finding[] = rosterGaps.map((gap, index) => ({
		id: `section-gap-${gap.sectionId}-${gap.subjectId}-${index}`,
		title: `${gap.sectionName} is missing ${gap.subjectName}`,
		blockedLabel: 'This section is not fully covered.',
		detail: `Grade ${gap.gradeLevel} section has no assigned teacher for ${gap.subjectCode}.`,
		why: 'Every section needs complete subject coverage before scheduling review is meaningful.',
		actionLabel: 'Assign teacher',
		route: `/teaching-load?sectionId=${gap.sectionId}&subjectId=${gap.subjectId}`,
		repairTarget: 'teaching-load',
		severity: 'blocker',
	}));

	const facilityFindings: Finding[] = facilityGaps.map((subject, index) => ({
		id: `facility-gap-${subject.id}-${index}`,
		title: `${subject.name} has no compatible room`,
		blockedLabel: 'Room placement is not ready for this subject.',
		detail: `Needs ${(subject.requiredFeatures || []).join(', ') || 'special room features'} and ${subject.preferredRoomType || 'a matching room type'}.`,
		why: 'Room gaps can block placement or force unsafe manual room changes.',
		actionLabel: 'Check rooms and facilities',
		route: `/map?mode=editor&subjectId=${subject.id}`,
		repairTarget: 'map',
		severity: 'blocker',
	}));

	const constraintFindings: Finding[] = clashes.map((clash, index) => ({
		id: `constraint-${clash.facultyId ?? clash.name}-${index}`,
		title: `${clash.name} has limited available time`,
		blockedLabel: 'Teacher availability may reduce placement choices.',
		detail: `${clash.unavailabilityPercent}% unavailable. Affected subjects: ${clash.qualifiedSubjects.map((subject: any) => subject.code).join(', ')}.`,
		why: 'Heavy unavailability can leave otherwise qualified subjects hard to place.',
		actionLabel: 'Check teacher record',
		route: clash.facultyId ? `/teachers?facultyId=${clash.facultyId}` : '/teachers',
		repairTarget: 'teachers',
		severity: 'warning',
	}));

	const sourceFindings: Finding[] = [
		...degradedReasons.map((reason, index) => ({
			id: `source-degraded-${index}-${reason}`,
			title: reason,
			blockedLabel: dataSource === 'none' ? 'The readiness report cannot finish.' : 'This finding may be based on saved evidence.',
			detail: dataSource === 'none' ? 'This evidence is required before ATLAS can finish the readiness report.' : 'The report is using saved ATLAS evidence for this domain.',
			why: 'Officers need to know whether a finding is backed by live data or saved data.',
			actionLabel: 'Check setup source',
			route: reason.toLowerCase().includes('subject') ? '/subjects' : reason.toLowerCase().includes('teacher') || reason.toLowerCase().includes('teaching') ? '/teachers' : '/sections',
			repairTarget: reason.toLowerCase().includes('subject') ? 'subjects' : reason.toLowerCase().includes('teacher') || reason.toLowerCase().includes('teaching') ? 'teachers' : 'sections',
			severity: dataSource === 'none' ? 'blocker' as FindingSeverity : 'info' as FindingSeverity,
		})),
		...syncIssues.map((issue, index) => ({
			id: `source-sync-${issue.id}-${index}`,
			title: `${issue.name} has a roster sync issue`,
			blockedLabel: 'Teacher identity needs review.',
			detail: issue.reason,
			why: 'Teacher identity gaps can break matching, reports, and downstream schedule review.',
			actionLabel: 'Open teacher roster',
			route: `/teachers?facultyId=${issue.id}`,
			repairTarget: 'teachers',
			severity: 'warning' as FindingSeverity,
		})),
	];

	const findingGroups: FindingGroup[] = [
		{
			id: 'teacher-assignments',
			label: 'Fix teacher assignments',
			description: 'Teacher coverage, qualifications, and load balance.',
			icon: UserMinus,
			findings: assignmentFindings,
			blockedLabel: 'Teacher coverage can block generation.',
			why: 'ATLAS needs the right teacher assigned to each subject-section pair before the timetable can be trusted.',
			primaryActionLabel: 'Fix teacher assignments',
			primaryRoute: assignmentFindings[0]?.route ?? '/teaching-load',
			repairTarget: 'teaching-load',
			secondaryActionLabel: 'Inspect teachers',
			secondaryRoute: '/teachers',
			emptyTitle: 'Teacher assignments look ready',
			emptyBody: 'No qualification gaps or teacher-assignment blockers were found in the loaded evidence.',
		},
		{
			id: 'section-gaps',
			label: 'Resolve section gaps',
			description: 'Sections missing required class coverage.',
			icon: BookX,
			findings: sectionFindings,
			blockedLabel: 'Incomplete sections can block generation.',
			why: 'A section with a missing subject-teacher pair cannot produce a complete class program.',
			primaryActionLabel: 'Assign missing coverage',
			primaryRoute: sectionFindings[0]?.route ?? '/teaching-load',
			repairTarget: 'teaching-load',
			secondaryActionLabel: 'Inspect sections',
			secondaryRoute: '/sections',
			emptyTitle: 'Sections have required coverage',
			emptyBody: 'No section-subject gaps were found in the loaded templates and assignments.',
		},
		{
			id: 'rooms-facilities',
			label: 'Check rooms and facilities',
			description: 'Room feature and facility readiness.',
			icon: Box,
			findings: facilityFindings,
			blockedLabel: 'Room setup can block placement.',
			why: 'Subjects that need specific room features need compatible teaching spaces before review and publish.',
			primaryActionLabel: 'Fix room setup',
			primaryRoute: facilityFindings[0]?.route ?? '/map',
			repairTarget: 'map',
			secondaryActionLabel: 'Inspect timetable rooms',
			secondaryRoute: '/timetable?viewMode=room',
			emptyTitle: 'Rooms match subject needs',
			emptyBody: 'No subjects with required room features are missing compatible rooms.',
		},
		{
			id: 'constraints',
			label: 'Review constraints',
			description: 'Teacher availability signals that may require review.',
			icon: Clock,
			findings: constraintFindings,
			blockedLabel: 'Teacher availability may block placement.',
			why: 'A teacher with too few available periods can leave matching subjects without workable times.',
			primaryActionLabel: 'Review teacher availability',
			primaryRoute: constraintFindings[0]?.route ?? '/teachers',
			repairTarget: 'teachers',
			secondaryActionLabel: 'Open timetable review',
			secondaryRoute: '/timetable',
			emptyTitle: 'No major constraint pressure found',
			emptyBody: 'No teacher with matching subjects is more than 50% unavailable in the loaded preference audit.',
		},
		{
			id: 'saved-live-data',
			label: 'Check saved/live data',
			description: 'Evidence freshness and roster sync health.',
			icon: RefreshCw,
			findings: sourceFindings,
			blockedLabel: 'Readiness evidence needs confirmation.',
			why: 'Officers need a clear source state before deciding whether setup is ready for generation or publish.',
			primaryActionLabel: 'Check source records',
			primaryRoute: sourceFindings[0]?.route ?? '/sections',
			repairTarget: sourceFindings[0]?.repairTarget ?? 'sections',
			secondaryActionLabel: 'Refresh report',
			secondaryRoute: '/audit',
			emptyTitle: 'Evidence source looks usable',
			emptyBody: dataSource === 'live' ? 'The report is based on live upstream-backed evidence.' : 'The report is based on saved ATLAS evidence with no missing domains reported.',
		},
	];

	const blockerCount = findingGroups.reduce((total, group) => total + group.findings.filter((finding) => finding.severity === 'blocker').length, 0);
	const warningCount = findingGroups.reduce((total, group) => total + group.findings.filter((finding) => finding.severity === 'warning').length, 0);
	const avgLoad = faculty.reduce((sum, facultyMember) => sum + (facultyMember.loadPercentage ?? 0), 0) / (faculty.length || 1);
	const sourceLabel = dataSource === 'live' ? 'Live upstream-backed' : dataSource === 'cached' ? 'ATLAS saved evidence' : 'No saved evidence';
	const defaultGroupId = (() => {
		const focus = searchParams.get('focus');
		if (focus === 'timetable') return 'constraints';
		if (focus && findingGroups.some((group) => group.id === focus)) return focus;
		const firstGroupWithFindings = findingGroups.find((group) => group.findings.length > 0);
		return firstGroupWithFindings?.id ?? 'teacher-assignments';
	})();
	const verdict = dataSource === 'none'
		? {
			label: 'Cannot check readiness yet',
			detail: 'ATLAS could not load enough setup evidence to complete this report.',
			icon: AlertTriangle,
			className: 'border-amber-200 bg-amber-50 text-amber-900',
			iconClassName: 'bg-amber-100 text-amber-700',
		}
		: blockerCount === 0
			? {
				label: 'Ready for scheduling review',
				detail: 'No readiness blockers were found in the loaded evidence. Review warnings before moving forward.',
				icon: CheckCircle2,
				className: 'border-emerald-200 bg-emerald-50 text-emerald-900',
				iconClassName: 'bg-emerald-100 text-emerald-700',
			}
			: {
				label: 'Needs fixes before scheduling',
				detail: `${blockerCount} readiness blocker${blockerCount === 1 ? '' : 's'} must be fixed before scheduling review is reliable.`,
				icon: XCircle,
				className: 'border-red-200 bg-red-50 text-red-900',
				iconClassName: 'bg-red-100 text-red-700',
			};

	const VerdictIcon = verdict.icon;

	const filterFindings = (findings: Finding[]) => {
		const query = searchQuery.trim().toLowerCase();
		if (!query) return findings;
		return findings.filter((finding) =>
			finding.title.toLowerCase().includes(query) ||
			finding.detail.toLowerCase().includes(query) ||
			finding.why.toLowerCase().includes(query),
		);
	};

	if (loading) {
		return (
			<div className="flex h-[calc(100svh-3.5rem)] flex-col bg-primary/5 px-6 py-8 lg:px-8">
				<div className="mx-auto flex h-full w-full max-w-3xl items-center justify-center">
					<Card className="w-full border-0 bg-white shadow-soft-xl">
						<CardContent className="p-6">
							<div className="flex items-start gap-4">
								<div className="flex size-12 shrink-0 items-center justify-center rounded-2xl bg-primary/10 text-primary">
									<Loader2 className="size-6 animate-spin" />
								</div>
								<div>
									<h1 className="text-2xl font-bold text-slate-900">Checking readiness...</h1>
									<p className="mt-2 text-sm text-slate-500">ATLAS is checking the setup evidence officers need before scheduling review.</p>
									<div className="mt-4 grid gap-2 sm:grid-cols-2">
										{AUDIT_DOMAINS.map((domain) => (
											<div key={domain} className="flex items-center gap-2 rounded-xl bg-slate-50 px-3 py-2 text-sm font-medium text-slate-600">
												<ShieldCheck className="size-4 text-primary" />
												{domain}
											</div>
										))}
									</div>
								</div>
							</div>
						</CardContent>
					</Card>
				</div>
			</div>
		);
	}

	return (
		<div className="flex h-[calc(100svh-3.5rem)] flex-col overflow-hidden bg-primary/5">
			<header className="shrink-0 px-6 pt-5 lg:px-8">
				<div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
					<div>
						<p className="text-[0.72rem] font-bold uppercase tracking-wide text-primary">Review and publish</p>
						<h1 className="mt-1 text-3xl font-bold text-slate-900">Audit readiness report</h1>
						<p className="mt-1 max-w-2xl text-sm leading-relaxed text-slate-500">
							See what ATLAS checked, what blocks readiness, and which setup page fixes each issue.
						</p>
					</div>
					<div className="flex flex-wrap items-center gap-2">
						<Badge variant="outline" className="rounded-full border-primary/20 bg-white px-3 py-1 text-primary">
							{sourceLabel}
						</Badge>
						<Button variant="outline" size="sm" className="h-9 rounded-xl bg-white shadow-sm" onClick={loadData}>
							<RefreshCw className="mr-1 size-3.5" />
							Refresh report
						</Button>
					</div>
				</div>

				<div className="mt-4 flex flex-wrap items-center gap-4 overflow-x-auto rounded-2xl border border-primary/10 bg-white px-4 py-3 text-sm shadow-soft scrollbar-none">
					<span className="font-semibold text-slate-900">Checked: <span className="font-normal text-slate-500">{AUDIT_DOMAINS.length} domains</span></span>
					<span className="text-slate-200">|</span>
					<span className="font-semibold text-slate-900">Blockers: <span className={blockerCount > 0 ? 'font-normal text-red-600' : 'font-normal text-emerald-600'}>{blockerCount}</span></span>
					<span className="text-slate-200">|</span>
					<span className="font-semibold text-slate-900">Warnings: <span className="font-normal text-amber-600">{warningCount}</span></span>
					<span className="text-slate-200">|</span>
					<span className="font-semibold text-slate-900">Average roster load: <span className="font-normal text-slate-500">{avgLoad.toFixed(1)}%</span></span>
				</div>
			</header>

			<div className="flex-1 min-h-0 overflow-auto px-6 pb-6 pt-4 lg:px-8">
				<div className="mx-auto flex max-w-7xl flex-col gap-4">
					<Card className={`border shadow-soft ${verdict.className}`}>
						<CardContent className="p-5">
							<div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
								<div className="flex items-start gap-4">
									<div className={`flex size-12 shrink-0 items-center justify-center rounded-2xl ${verdict.iconClassName}`}>
										<VerdictIcon className="size-6" />
									</div>
									<div>
										<h2 className="text-xl font-bold">{verdict.label}</h2>
										<p className="mt-1 text-sm leading-relaxed opacity-80">{verdict.detail}</p>
									</div>
								</div>
								<div className="flex flex-wrap gap-2">
									<Button asChild variant="outline" size="sm" className="rounded-xl bg-white/80">
										<Link to="/teaching-load">Open Teaching Load</Link>
									</Button>
									<Button asChild variant="outline" size="sm" className="rounded-xl bg-white/80">
										<Link to="/sections">Check Sections</Link>
									</Button>
								</div>
							</div>
						</CardContent>
					</Card>

					{dataSource === 'none' && (
						<div className="rounded-2xl border border-amber-200 bg-white p-5 shadow-soft">
							<div className="flex items-start gap-3">
								<AlertTriangle className="mt-0.5 size-5 shrink-0 text-amber-600" />
								<div>
									<p className="font-bold text-slate-900">No complete readiness evidence is available.</p>
									<p className="mt-1 text-sm text-slate-500">Refresh this report, then check Sections, Subjects, Teachers, and Teaching Load if evidence is still missing.</p>
									<div className="mt-3 flex flex-wrap gap-2">
										<Button asChild variant="outline" size="sm"><Link to="/subjects">Check Subjects</Link></Button>
										<Button asChild variant="outline" size="sm"><Link to="/teachers">Check Teachers</Link></Button>
										<Button asChild variant="outline" size="sm"><Link to="/map">Check Rooms</Link></Button>
									</div>
								</div>
							</div>
						</div>
					)}

					<div className="rounded-2xl bg-white p-4 shadow-soft-xl">
						<div className="mb-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
							<div>
								<h2 className="text-lg font-bold text-slate-900">Findings by next action</h2>
								<p className="text-sm text-slate-500">Open each group to see what is wrong, why it matters, and where to fix it.</p>
							</div>
							<div className="relative w-full max-w-sm">
								<Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
								<Input
									placeholder="Search findings..."
									value={searchQuery}
									onChange={(event) => setSearchQuery(event.target.value)}
									className="h-10 rounded-xl bg-slate-50 pl-9"
								/>
							</div>
						</div>

						<Tabs defaultValue={defaultGroupId} className="flex min-h-0 flex-col">
							<TabsList className="flex h-auto w-full flex-wrap justify-start gap-2 bg-slate-100 p-1">
								{findingGroups.map((group) => {
									const GroupIcon = group.icon;
									return (
										<TabsTrigger key={group.id} value={group.id} className="h-auto gap-2 rounded-xl px-3 py-2 text-xs data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
											<GroupIcon className="size-4" />
											<span>{group.label}</span>
											<Badge variant="secondary" className="h-5 rounded-full px-1.5 text-[10px]">{group.findings.length}</Badge>
										</TabsTrigger>
									);
								})}
							</TabsList>

							{findingGroups.map((group) => {
								const visibleFindings = filterFindings(group.findings);
								return (
									<TabsContent key={group.id} value={group.id} className="mt-4 focus-visible:ring-0">
										<div className="rounded-2xl border border-slate-100 bg-slate-50/70">
											<div className="border-b border-slate-100 px-4 py-3">
												<p className="font-bold text-slate-900">{group.label}</p>
												<p className="text-sm text-slate-500">{group.description}</p>
											</div>
											<div className="grid gap-3 border-b border-slate-100 bg-white px-4 py-4 lg:grid-cols-[1fr_auto] lg:items-center">
												<div className="grid gap-3 text-sm md:grid-cols-2">
													<div className="rounded-xl bg-slate-50 px-3 py-2">
														<p className="text-[0.68rem] font-bold uppercase tracking-wide text-slate-400">What is blocked</p>
														<p className="mt-1 font-semibold text-slate-900">{group.blockedLabel}</p>
													</div>
													<div className="rounded-xl bg-slate-50 px-3 py-2">
														<p className="text-[0.68rem] font-bold uppercase tracking-wide text-slate-400">Why it matters</p>
														<p className="mt-1 text-slate-600">{group.why}</p>
													</div>
												</div>
												<div className="flex flex-wrap gap-2 lg:justify-end">
													<Button asChild size="sm" className="h-9 rounded-xl gap-1.5 bg-primary text-primary-foreground hover:bg-primary/90">
														<Link to={group.primaryRoute} data-repair-target={group.repairTarget}>
															{group.primaryActionLabel}
															<ArrowRight className="size-3.5" />
														</Link>
													</Button>
													{group.secondaryActionLabel && group.secondaryRoute ? (
														<Button asChild variant="outline" size="sm" className="h-9 rounded-xl bg-white">
															<Link to={group.secondaryRoute} data-repair-target={`${group.repairTarget}-inspect`}>
																{group.secondaryActionLabel}
															</Link>
														</Button>
													) : null}
												</div>
											</div>
											<ScrollArea className="max-h-[46svh] min-h-72">
												<div className="divide-y divide-slate-100 bg-white">
													{visibleFindings.length === 0 ? (
														<div className="px-6 py-16 text-center">
															<ShieldCheck className="mx-auto mb-3 size-10 text-emerald-500/40" />
															<p className="font-bold text-slate-900">{searchQuery ? 'No matching findings' : group.emptyTitle}</p>
															<p className="mx-auto mt-1 max-w-lg text-sm text-slate-500">{searchQuery ? 'Clear the search to see the full report.' : group.emptyBody}</p>
														</div>
													) : visibleFindings.map((finding) => (
														<div key={finding.id} className="flex flex-col gap-3 px-4 py-4 lg:flex-row lg:items-center lg:justify-between">
															<div className="min-w-0 space-y-2">
																<div className="flex flex-wrap items-center gap-2">
																	<Badge variant="outline" className={`rounded-full ${severityClassName(finding.severity)}`}>{severityLabel(finding.severity)}</Badge>
																	<p className="font-bold text-slate-900">{finding.title}</p>
																</div>
																<p className="text-sm text-slate-600">{finding.detail}</p>
																<p className="text-xs font-semibold text-slate-600">What is blocked: {finding.blockedLabel}</p>
																<p className="text-xs font-medium text-slate-500">Why it matters: {finding.why}</p>
															</div>
															<Button asChild variant="outline" size="sm" className="h-9 shrink-0 rounded-xl bg-white">
																<Link to={finding.route} data-repair-target={finding.repairTarget}>
																	{finding.actionLabel}
																	<ArrowRight className="ml-1 size-3.5" />
																</Link>
															</Button>
														</div>
													))}
												</div>
											</ScrollArea>
										</div>
									</TabsContent>
								);
							})}
						</Tabs>
					</div>
				</div>
			</div>
		</div>
	);
}
