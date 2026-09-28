import { useState, useEffect, useMemo } from 'react';
import {
	AlertTriangle,
	ArrowRight,
	BookX,
	Box,
	CheckCircle2,
	Clock,
	Info,
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
import { PageHeader } from '@/components/app-shell/PageHeader';
import { resolveActiveSchoolYearContext } from '@/lib/enrollpro-public-settings';
import { useActorSchoolScope } from '@/lib/actor-scope-session';
import { assessSectionCoverage, type SectionCoverageAssessment } from '@/lib/audit-section-coverage';
import { Badge } from '@/ui/badge';
import { Button } from '@/ui/button';
import { Card, CardContent } from '@/ui/card';
import { Input } from '@/ui/input';
import { ScrollArea } from '@/ui/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/ui/tabs';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/ui/accordion';

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

/**
 * A3-C8 S1 — the three severity treatments, in the app's semantic tokens.
 *
 * Every severity carries THREE independent signals, not one: a hue, a word, and an
 * ICON. The icon is what makes the cue survive a reader who cannot separate the
 * hues, and it is rendered from this one map at both badge sites, so a fourth
 * severity can never be added without also getting a shape.
 *
 * `info` is deliberately NEUTRAL rather than a fourth hue. The obvious candidate was
 * to carry the old `sky` over, but `sky` has no token in this system, and inventing
 * one would (a) put a new colour family in a stylesheet this lane may not touch and
 * (b) risk collapsing `info` into the ready/`accent` role, which is the one hue that
 * already means "this is fine". `index.css` warns about exactly that collapse
 * ("two meanings never collapse into one shade"). A neutral grey pill plus a
 * different icon is both calmer and unambiguous.
 *
 * MEASURED CONTRAST (HSL from the merged `:root` values; see the handoff):
 *   text-warning-foreground on bg-warning-muted .... 8.415:1  AA pass (gated row)
 *   text-destructive on bg-destructive/5 over white .. 3.70:1  below AA 4.5
 *   text-muted-foreground on bg-muted .............. 4.268:1  below AA 4.5
 * The two sub-AA figures are properties of the MERGED tokens, not choices made here,
 * and both pairings are the app's own established convention (see
 * faculty-shared/PlainLanguageNotice.tsx:18 and the global --muted/--muted-foreground
 * pair). `border-warning-border` on bg-warning-muted is 2.081:1, the pinned debt, so
 * no severity here is distinguished by its border alone: border, surface and text
 * move together, and the icon moves independently.
 */
export const SEVERITY_TREATMENT: Record<FindingSeverity, { label: string; className: string; Icon: typeof ShieldCheck }> = {
	blocker: {
		label: 'Blocks readiness',
		className: 'border-destructive/30 bg-destructive/5 text-destructive',
		Icon: XCircle,
	},
	warning: {
		label: 'Needs review',
		className: 'border-warning-border bg-warning-muted text-warning-foreground',
		Icon: AlertTriangle,
	},
	info: {
		label: 'Check source',
		className: 'border-border bg-muted text-muted-foreground',
		Icon: Info,
	},
};

/**
 * The single badge renderer for severity. Both call sites use it, which is what
 * makes "every severity has a non-colour cue at every render site" structural
 * rather than a convention someone has to remember.
 *
 * The icon is `aria-hidden`: the word beside it already carries the meaning, so a
 * screen reader reads "Blocks readiness", not "circle-x Blocks readiness". It is
 * there for the sighted reader who cannot use the hue.
 */
export function SeverityBadge({ severity }: { severity: FindingSeverity }) {
	const { label, className, Icon } = SEVERITY_TREATMENT[severity];
	return (
		<Badge variant="outline" className={`rounded-full ${className}`}>
			<Icon className="size-3 shrink-0" aria-hidden="true" />
			{label}
		</Badge>
	);
}

/**
 * A3-C8 S1 — the `focus` search-param contract, extracted so it is directly testable.
 *
 * Behaviour is unchanged, including the part that is easy to lose: an unrecognised
 * `focus` still falls through to the FIRST GROUP WITH FINDINGS (not the first group
 * in the list), so `/audit` with no query still opens on something actionable.
 * `focus=timetable` still resolves to `constraints` — it is a legacy alias from
 * before the room-preferences work renamed the surface, and `/timetable` links are
 * Lane A2's, so the alias is the compatibility half of that contract.
 */
export function resolveFocusGroupId(
	focus: string | null,
	groups: ReadonlyArray<{ id: string; findings: ReadonlyArray<unknown> }>,
): string {
	if (focus === 'timetable') return 'constraints';
	if (focus && groups.some((group) => group.id === focus)) return focus;
	const firstGroupWithFindings = groups.find((group) => group.findings.length > 0);
	return firstGroupWithFindings?.id ?? 'teacher-assignments';
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
	const [sectionCoverage, setSectionCoverage] = useState<SectionCoverageAssessment | null>(null);
	const [rooms, setRooms] = useState<any[]>([]);
	const [searchQuery, setSearchQuery] = useState('');
	const [activeSchoolYearId, setActiveSchoolYearId] = useState<number | null>(null);
	const [activeYearSource, setActiveYearSource] = useState<ActiveYearSource>('cache');
	const [dataSource, setDataSource] = useState<DataSource>('none');
	const [degradedReasons, setDegradedReasons] = useState<string[]>([]);

	const { actorSchoolId } = useActorSchoolScope();

	useEffect(() => {
		if (actorSchoolId == null) {
			setActiveSchoolYearId(null);
			setLoading(false);
			return;
		}
		let cancelled = false;
		resolveActiveSchoolYearContext({ schoolId: actorSchoolId, allowStaleOnError: true }).then((context) => {
			if (cancelled) return;
			if (context.activeSchoolYearId) {
				setActiveSchoolYearId(context.activeSchoolYearId);
				setActiveYearSource(context.source);
			} else {
				setLoading(false);
				toast.error('No active school year found');
			}
		}).catch(() => {
			if (cancelled) return;
			setLoading(false);
			toast.error('No active school year found');
		});
		return () => {
			cancelled = true;
		};
	}, [actorSchoolId]);

	useEffect(() => {
		if (activeSchoolYearId) {
			void loadData();
		}
	}, [activeSchoolYearId]);

	const loadData = async () => {
		if (!activeSchoolYearId || actorSchoolId == null) return;
		const scopedSchoolId = actorSchoolId;
		setLoading(true);
		try {
			const [facRes, subRes, aliasRes, prefRes, secRes, templateRes, roomRes] = await Promise.allSettled([
				atlasApi.get('/faculty-assignments/summary', { params: { schoolId: scopedSchoolId, schoolYearId: activeSchoolYearId } }),
				atlasApi.get('/subjects', { params: { schoolId: scopedSchoolId } }),
				atlasApi.get(`/specialization-aliases?schoolId=${scopedSchoolId}`),
				atlasApi.get(`/preferences/${scopedSchoolId}/${activeSchoolYearId}/audit`),
				atlasApi.get(`/sections/summary/${activeSchoolYearId}`, { params: { schoolId: scopedSchoolId } }),
				atlasApi.get(`/class-templates?schoolId=${scopedSchoolId}`),
				atlasApi.get(`/map/schools/${scopedSchoolId}/buildings`),
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

			// A fulfilled-but-EMPTY class-template read is not proof of coverage:
			// `assessSectionCoverage` decides whether section coverage can be
			// verified at all and, when it cannot, supplies the degraded reason and
			// the non-green UNRESOLVED finding the section-coverage group must show.
			const loadedTemplates = templateRes.status === 'fulfilled' ? (templateRes.value.data.templates ?? []) : [];
			const coverage = assessSectionCoverage({
				templates: loadedTemplates,
				available: templateRes.status === 'fulfilled',
				sections: secRes.status === 'fulfilled' ? (secRes.value.data.sections ?? []) : [],
			});
			setTemplates(loadedTemplates);
			setSectionCoverage(coverage);
			if (coverage.degradedReason) {
				reasons.push(coverage.degradedReason);
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
			blockedLabel: 'Subject coverage is not ready for scheduling review.',
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

	const unresolvedCoverageFinding: Finding | null = sectionCoverage?.unresolvedFinding ?? null;

	const sectionFindings: Finding[] = [
		...(unresolvedCoverageFinding ? [unresolvedCoverageFinding] : []),
		...rosterGaps.map((gap, index) => ({
			id: `section-gap-${gap.sectionId}-${gap.subjectId}-${index}`,
			title: `${gap.sectionName} is missing ${gap.subjectName}`,
			blockedLabel: 'This section is not fully covered.',
			detail: `Grade ${gap.gradeLevel} section has no assigned teacher for ${gap.subjectCode}.`,
			why: 'Every section needs complete subject coverage before scheduling review is meaningful.',
			actionLabel: 'Assign teacher',
			route: `/teaching-load?sectionId=${gap.sectionId}&subjectId=${gap.subjectId}`,
			repairTarget: 'teaching-load',
			severity: 'blocker' as FindingSeverity,
		})),
	];

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
			detail: dataSource === 'none' ? 'This evidence is required before ATLAS can finish the readiness report.' : 'The report is using data saved in ATLAS for this domain.',
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
			blockedLabel: 'Teacher coverage can block scheduling review.',
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
			blockedLabel: 'Incomplete sections can block scheduling review.',
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
			why: 'A clear source state tells officers whether setup is ready for scheduling review.',
			primaryActionLabel: 'Check source records',
			primaryRoute: sourceFindings[0]?.route ?? '/sections',
			repairTarget: sourceFindings[0]?.repairTarget ?? 'sections',
			secondaryActionLabel: 'Refresh report',
			secondaryRoute: '/audit',
			emptyTitle: 'Evidence source looks usable',
			emptyBody: dataSource === 'live' ? 'The report is based on the latest data from EnrollPro.' : 'The report is based on data saved in ATLAS, with no missing domains reported.',
		},
	];

	const blockerCount = findingGroups.reduce((total, group) => total + group.findings.filter((finding) => finding.severity === 'blocker').length, 0);
	const warningCount = findingGroups.reduce((total, group) => total + group.findings.filter((finding) => finding.severity === 'warning').length, 0);
	const avgLoad = faculty.reduce((sum, facultyMember) => sum + (facultyMember.loadPercentage ?? 0), 0) / (faculty.length || 1);
	const sourceLabel = dataSource === 'live' ? 'Live from EnrollPro' : dataSource === 'cached' ? 'Saved in ATLAS' : 'No saved data';
	const priorityFindings = findingGroups
		.flatMap((group) => group.findings)
		.sort((left, right) => {
			const rank: Record<FindingSeverity, number> = { blocker: 0, warning: 1, info: 2 };
			return rank[left.severity] - rank[right.severity];
		})
		.slice(0, 3);
	const defaultGroupId = resolveFocusGroupId(searchParams.get('focus'), findingGroups);
	const verdict = dataSource === 'none'
		? {
			label: 'Cannot check readiness yet',
			detail: 'ATLAS could not load enough setup evidence to complete this report.',
			icon: AlertTriangle,
			// The panel's hue, tint and icon circle all come from the warning family, so the
			// card reads as the same object as a `warning` severity badge. The text colour is
			// deliberately NOT set here: Card supplies text-card-foreground, which keeps the
			// heading legible where the three deep ramp shades used to carry the meaning by
			// text colour alone. (Named deliberately, not as literals: this file's raw-amber
			// detector counts LINES, so writing a retired shade name in a comment would pin a
			// phantom occurrence.)
			className: 'border-warning-border bg-warning-muted',
			iconClassName: 'bg-warning text-warning-muted',
		}
		: blockerCount === 0
			? {
				label: 'Ready for scheduling review',
				detail: 'No readiness blockers were found in the loaded evidence. Review warnings before moving forward.',
				icon: CheckCircle2,
				// --accent-muted is a CSS var but is NOT mapped to a --color-* utility in
				// @theme inline, so bg-accent-muted emits no CSS. The alpha form does, and
				// bg-accent/10 is the same pale green the token describes.
				className: 'border-accent/30 bg-accent/10',
				iconClassName: 'bg-accent text-accent-foreground',
			}
			: {
				label: 'Needs fixes before scheduling',
				detail: `${blockerCount} readiness blocker${blockerCount === 1 ? '' : 's'} must be fixed before scheduling review is reliable.`,
				icon: XCircle,
				className: 'border-destructive/30 bg-destructive/5',
				iconClassName: 'bg-destructive text-destructive-foreground',
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
									<p className="text-2xl font-bold text-foreground">Checking readiness...</p>
									<p className="mt-2 text-sm text-muted-foreground">ATLAS is checking the setup evidence officers need before scheduling review.</p>
									<div className="mt-4 grid gap-2 sm:grid-cols-2">
										{AUDIT_DOMAINS.map((domain) => (
											<div key={domain} className="flex items-center gap-2 rounded-xl bg-muted px-3 py-2 text-sm font-medium text-slate-600">
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
				<PageHeader
					title='Audit'
					eyebrow='Readiness check'
					subtitle='See what ATLAS checked, what blocks readiness, and which setup page fixes each issue.'
					source={(
						<Badge variant="outline" className="rounded-full border-primary/20 bg-white px-3 py-1 text-primary">
							{sourceLabel}
						</Badge>
					)}
					primaryAction={(
						<Button variant="outline" size="sm" className="h-9 rounded-xl bg-white shadow-sm" onClick={loadData}>
							<RefreshCw className="mr-1 size-3.5" />
							Refresh report
						</Button>
					)}
				/>

				<div className="mt-4 flex flex-wrap items-center gap-4 overflow-x-auto rounded-2xl border border-primary/10 bg-white px-4 py-3 text-sm shadow-soft scrollbar-none">
					<span className="font-semibold text-foreground">Checked: <span className="font-normal text-muted-foreground">{AUDIT_DOMAINS.length} domains</span></span>
					<span className="text-slate-200">|</span>
					<span className="font-semibold text-foreground">Blockers: <span className={blockerCount > 0 ? 'font-normal text-destructive' : 'font-normal text-accent'}>{blockerCount}</span></span>
					<span className="text-slate-200">|</span>
					<span className="font-semibold text-foreground">Warnings: <span className="font-normal text-warning">{warningCount}</span></span>
					<span className="text-slate-200">|</span>
					<span className="font-semibold text-foreground">Average roster load: <span className="font-normal text-muted-foreground">{avgLoad.toFixed(1)}%</span></span>
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
						<div className="rounded-2xl border border-warning-border bg-white p-5 shadow-soft">
							<div className="flex items-start gap-3">
								<AlertTriangle className="mt-0.5 size-5 shrink-0 text-warning" />
								<div>
									<p className="font-bold text-foreground">No complete readiness evidence is available.</p>
									<p className="mt-1 text-sm text-muted-foreground">Refresh this report, then check Sections, Subjects, Teachers, and Teaching Load if evidence is still missing.</p>
									<div className="mt-3 flex flex-wrap gap-2">
										<Button asChild variant="outline" size="sm"><Link to="/subjects">Check Subjects</Link></Button>
										<Button asChild variant="outline" size="sm"><Link to="/teachers">Check Teachers</Link></Button>
										<Button asChild variant="outline" size="sm"><Link to="/map">Check Rooms</Link></Button>
									</div>
								</div>
							</div>
						</div>
					)}

					{priorityFindings.length > 0 && (
						<section aria-labelledby="priority-findings-heading" className="rounded-2xl border border-primary/10 bg-white p-4 shadow-soft">
							<div className="mb-3">
								<h2 id="priority-findings-heading" className="text-lg font-bold text-foreground">Fix these first</h2>
								<p className="text-sm text-muted-foreground">Start with the highest-impact issues before reviewing the full report.</p>
							</div>
							<div className="grid gap-2 lg:grid-cols-3">
								{priorityFindings.map((finding) => (
								<div key={finding.id} className="flex min-h-28 flex-col justify-between rounded-xl border border-border bg-muted p-3">
									<div>
										<SeverityBadge severity={finding.severity} />
											<p className="mt-2 text-sm font-bold text-foreground">{finding.title}</p>
										</div>
										<Button asChild variant="outline" size="sm" className="mt-3 justify-between rounded-xl bg-white">
											<Link to={finding.route} data-repair-target={`${finding.repairTarget}-priority`}>
												{finding.actionLabel}<ArrowRight className="size-3.5" />
											</Link>
										</Button>
									</div>
								))}
							</div>
						</section>
					)}

					<div className="rounded-2xl bg-white p-4 shadow-soft-xl">
						<div className="mb-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
							<div>
								<h2 className="text-lg font-bold text-foreground">Findings by next action</h2>
								<p className="text-sm text-muted-foreground">Open each group to see what is wrong, why it matters, and where to fix it.</p>
							</div>
							<div className="relative w-full max-w-sm">
								<Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
								<Input
									placeholder="Search findings..."
									value={searchQuery}
									onChange={(event) => setSearchQuery(event.target.value)}
									className="h-10 rounded-xl bg-muted pl-9"
								/>
							</div>
						</div>

						<Tabs defaultValue={defaultGroupId} className="flex min-h-0 flex-col">
							<TabsList className="flex h-auto w-full flex-wrap justify-start gap-2 bg-muted p-1">
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
										<div className="rounded-2xl border border-border bg-muted/70">
											<div className="border-b border-border px-4 py-3">
												<p className="font-bold text-foreground">{group.label}</p>
												<p className="text-sm text-muted-foreground">{group.description}</p>
											</div>
											<div className="grid gap-3 border-b border-border bg-white px-4 py-4 lg:grid-cols-[1fr_auto] lg:items-center">
												<div className="grid gap-3 text-sm md:grid-cols-2">
													<div className="rounded-xl bg-muted px-3 py-2">
														<p className="text-[0.68rem] font-bold uppercase tracking-wide text-muted-foreground">What is blocked</p>
														<p className="mt-1 font-semibold text-foreground">{group.blockedLabel}</p>
													</div>
													<div className="rounded-xl bg-muted px-3 py-2">
														<p className="text-[0.68rem] font-bold uppercase tracking-wide text-muted-foreground">Why it matters</p>
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
												<div className="divide-y divide-border bg-white">
													{visibleFindings.length === 0 ? (
														<div className="px-6 py-16 text-center">
															<ShieldCheck className="mx-auto mb-3 size-10 text-accent/40" />
															<p className="font-bold text-foreground">{searchQuery ? 'No matching findings' : group.emptyTitle}</p>
															<p className="mx-auto mt-1 max-w-lg text-sm text-muted-foreground">{searchQuery ? 'Clear the search to see the full report.' : group.emptyBody}</p>
														</div>
													) : (
														<Accordion type="single" collapsible className="w-full divide-y divide-border">
															{visibleFindings.map((finding) => (
																<AccordionItem key={finding.id} value={finding.id} className="border-b last:border-b-0">
																	<AccordionTrigger className="px-4 py-4 hover:no-underline [&[data-state=open]]:bg-muted/10">
																		<div className="flex flex-wrap items-center gap-2">
																			<SeverityBadge severity={finding.severity} />
																			<span className="font-bold text-foreground text-sm text-left">{finding.title}</span>
																		</div>
																	</AccordionTrigger>
																	<AccordionContent className="px-4 pb-4 pt-1 bg-muted/5">
																		<div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
																			<div className="space-y-1.5 max-w-2xl">
																				<p className="text-sm text-slate-600 leading-relaxed">{finding.detail}</p>
																				<p className="text-xs font-semibold text-slate-600">What is blocked: <span className="font-normal text-muted-foreground">{finding.blockedLabel}</span></p>
																				<p className="text-xs font-semibold text-slate-600">Why it matters: <span className="font-normal text-muted-foreground">{finding.why}</span></p>
																			</div>
																			<Button asChild variant="outline" size="sm" className="h-9 shrink-0 rounded-xl bg-white shadow-sm mt-2 lg:mt-0">
																				<Link to={finding.route} data-repair-target={finding.repairTarget}>
																					{finding.actionLabel}
																					<ArrowRight className="ml-1 size-3.5" />
																				</Link>
																			</Button>
																		</div>
																	</AccordionContent>
																</AccordionItem>
															))}
														</Accordion>
													)}
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
