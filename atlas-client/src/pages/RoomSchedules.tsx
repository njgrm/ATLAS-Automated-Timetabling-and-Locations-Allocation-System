import { useEffect, useState, useMemo, useCallback } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import {
	AlertTriangle,
	CalendarX,
	ChevronDown,
	DoorOpen,
	Download,
	FileSpreadsheet,
	Info,
	Layers3,
	MoreHorizontal,
	Printer,
	RefreshCw,
	ServerOff,
	Users,
} from 'lucide-react';

import atlasApi from '@/lib/api';
import { resolveActiveSchoolYearContext } from '@/lib/enrollpro-public-settings';
import { UNVERIFIED_TERM_BODY } from '@/lib/room-schedule-term-copy';
import { useActorSchoolScope } from '@/lib/actor-scope-session';
import { pivotDraftToView } from '@/lib/schedule-pivot';
import { buildScheduleSourceSentence, formatScheduleMadeOn } from '@/lib/schedule-source-sentence';
import { resolveScheduleEmptyState, type ScheduleEmptyNextStep, type ScheduleEmptyReason } from '@/lib/schedule-empty-state';
import { Badge } from '@/ui/badge';
import { Button } from '@/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/ui/popover';
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
} from '@/ui/dropdown-menu';
import { SearchableSelect } from '@/ui/searchable-select';
import { FilterBar } from '@/ui/filter-bar';
import { pickerTriggerClass } from '@/ui/picker-trigger';
import { Skeleton } from '@/ui/skeleton';
import { TooltipProvider } from '@/ui/tooltip';
import { ConflictInspectorSheet, type ConflictInspectorData } from '@/components/ConflictInspectorSheet';
import { OccupancyTemplatePreview } from '@/components/room-schedules/OccupancyTemplatePreview';
import { ScheduleSourceBand } from '@/components/room-schedules/ScheduleSourceBand';
import { ScheduleTimetableGrid } from '@/components/room-schedules/ScheduleTimetableGrid';
import { ScheduleMobileCards } from '@/components/room-schedules/ScheduleMobileCards';
import { exportScheduleToCsv } from '@/components/room-schedules/schedule-export';
import { SchedulerPrintDialog } from '@/components/timetable/simple/SchedulerPrintDialog';
import { academicTermDisplayLabel, isTermIndexWithinTerms, isVerifiedOrderedActiveTerm, type AcademicTermOption, type OrderedAcademicTerm } from '@/lib/academic-term';
import { SmartSourceStatusChip } from '@/components/smart/SmartPageShell';
import { LOOKUP_PRINT_LABEL } from '@/components/app-shell/navigation';
import type { Building, Room, Subject, FacultyMirror, RoomScheduleView, SectionSummaryResponse, DraftReport, GenerationRun } from '@/types';
import type { ViewMode, SectionInfo } from '@/components/room-schedules/schedule-types';

const MODE_COPY: Record<ViewMode, { label: string; emptyTitle: string; emptyBody: string; icon: typeof DoorOpen }> = {
	rooms: {
		label: 'Rooms',
		emptyTitle: 'Choose a room',
		emptyBody: 'Pick a room to see its week, in plain words: which class meets there, with which teacher.',
		icon: DoorOpen,
	},
	teachers: {
		label: 'Teachers',
		emptyTitle: 'Choose a teacher',
		emptyBody: 'Pick a teacher to see where they teach each day and in which room.',
		icon: Users,
	},
	sections: {
		label: 'Sections',
		emptyTitle: 'Choose a section',
		emptyBody: 'Pick a section to see the week its students follow.',
		icon: Layers3,
	},
};

const VIEW_MODES: ViewMode[] = ['rooms', 'teachers', 'sections'];

/** How many past timetables the dated disclosure may offer. */
const OLDER_RUN_LIMIT = 12;

type FetchState =
	| { status: 'idle' }
	| { status: 'loading' }
	| { status: 'ok'; data: RoomScheduleView }
	/**
	 * A5 C5 CORRECTION ROUND 1 (F1) — `reason` is REQUIRED, not optional. Four producers refuse
	 * here and only ONE of them is "no timetable exists"; a single shared heading made three of
	 * them lie on screen. Making the reason part of the variant means a fifth producer cannot be
	 * added without declaring which of the four it is.
	 */
	| { status: 'empty'; reason: ScheduleEmptyReason; message: string }
	| { status: 'error'; message: string };

/**
 * A5 C5 (2026-09-29) — the page.
 *
 * The operator reported Room Schedules as confusing, and the cause was not the grid: the page
 * asked a scheduler to speak a database's language before it would show them a week. A
 * `Generation run ID` number box with a `Use a whole number above 0.` error, a Latest/Run toggle
 * inside a `Tools` popover, a `How to browse schedules` panel, a *second* term picker used only by
 * a download, and a stat banner ending `Run #412 · COMPLETED` were all on the way to one week.
 *
 * THE CONTRACT, in the operator's three questions. Rooms is the default mode, so "what is in Room
 * 101 on Tuesday" is ONE click; "where is this teacher" and "what is this section's week" are TWO
 * (switch, pick). The timetable on screen is always the latest usable one for the active term,
 * chosen automatically and named in one quiet sentence in words.
 *
 * WHY THE RUN ID IS GONE RATHER THAN MOVED. It is not a thing a scheduler types or reads. It is
 * carried in `pinnedRunId` only where a request genuinely needs it, and a *dated* disclosure
 * ("Show an older timetable") keeps history reachable without a key on screen.
 *
 * SUBTRACT FIRST (`AGENTS.md` §8). Deleted, not reworded: the `How to browse` panel, the whole
 * `Tools` popover, the run-id input and its error, the separate download-term picker, the
 * full-width `Export CSV` button, the `Occupancy`/`Refresh` buttons in the filter row, the
 * `Schedules` eyebrow, the `Showing {term}` chip (it restated the term picker — two controls for
 * one fact) and the `12 rooms available.` sentence under the picker. `Refresh`, `Export this view
 * as CSV`, the official Word/Excel download and the room occupancy sheet moved behind `More`.
 *
 * §8 "One look per control": both pickers wear `pickerTriggerClass` from `@/ui/picker-trigger`,
 * the A5 c4 shared chrome, replacing this page's own
 * `triggerClassName="h-10 text-sm w-full rounded-xl bg-white shadow-sm"`.
 */
export default function RoomSchedules() {
	const [searchParams] = useSearchParams();
	const queryRoomId = searchParams.get('roomId');

	const [rooms, setRooms] = useState<(Room & { buildingName: string })[]>([]);
	const [facultyList, setFacultyList] = useState<FacultyMirror[]>([]);
	const [sectionList, setSectionList] = useState<{ id: number; name: string; gradeLevelName: string }[]>([]);
	const [subjectMap, setSubjectMap] = useState<Map<number, string>>(new Map());
	const [facultyMap, setFacultyMap] = useState<Map<number, string>>(new Map());
	const [sectionMap, setSectionMap] = useState<Map<number, SectionInfo>>(new Map());
	const [schoolYearId, setSchoolYearId] = useState<number | null>(null);
	const [schoolYearLabel, setSchoolYearLabel] = useState<string | null>(null);
	const [roomsLoading, setRoomsLoading] = useState(true);
	const [lookupError, setLookupError] = useState(false);

	const [viewMode, setViewMode] = useState<ViewMode>('rooms');
	const [selectedRoomId, setSelectedRoomId] = useState<string>('');
	const [selectedTeacherId, setSelectedTeacherId] = useState<string>('');
	const [selectedSectionId, setSelectedSectionId] = useState<string>('');
	const [presentationMode, setPresentationMode] = useState<'schedule' | 'occupancy'>('schedule');
	const [templateVariant, setTemplateVariant] = useState<'11x6' | '13x6'>('11x6');
	const [downloadSchedulesOpen, setDownloadSchedulesOpen] = useState(false);

	/**
	 * A5 C5 — the ONLY place a run id exists in this page, and it is never rendered. `null` means
	 * "the latest usable timetable", the default; a number means a scheduler chose a *date* from
	 * the disclosure below. It travels into the fetch and the print/download request, the one
	 * request that genuinely needs it.
	 */
	const [pinnedRunId, setPinnedRunId] = useState<number | null>(null);
	/** Completed timetables, newest first, labelled by DATE for the older-timetable disclosure. */
	const [pastRuns, setPastRuns] = useState<{ id: number; madeOn: string | null }[]>([]);

	// ROOM-SCHEDULES-TERM-C01 — the ONE selected term for every on-screen view. A weekly grid built
	// from three merged terms shows the same class three times in one slot, and the grid then
	// counts that as a room conflict: the page reported 10 conflicts for a room that had none. Term
	// scope is an invariant of the view, not a display filter. `orderedTerms` and the active index
	// come from the ONE existing authority (`resolveActiveTermAuthority` +
	// `isVerifiedOrderedActiveTerm`), so this surface cannot develop a second opinion. There is
	// deliberately no "All terms" option: null `viewTerm` means "prove the term", never "fall
	// back to Term 1".
	const [orderedTerms, setOrderedTerms] = useState<OrderedAcademicTerm[] | null>(null);
	const [verifiedActiveTermIndex, setVerifiedActiveTermIndex] = useState<number | null>(null);
	const [viewTerm, setViewTerm] = useState<number | null>(null);

	const termVerified = verifiedActiveTermIndex != null && viewTerm != null;

	const viewTermOptions = useMemo<AcademicTermOption[]>(() => {
		const ordered = orderedTerms && orderedTerms.length > 0
			? [...orderedTerms].sort((a, b) => a.order - b.order)
			: [];
		// The shared builder's leading "All terms" entry is forbidden in a schedule view, so the
		// option LIST is built here; the labels still come from the shared authority.
		return ordered
			.filter((term) => isTermIndexWithinTerms(term.order, ordered))
			.map((term) => ({ value: String(term.order), label: academicTermDisplayLabel(ordered, term.order) }));
	}, [orderedTerms]);

	const [state, setState] = useState<FetchState>({ status: 'idle' });
	const [conflictData, setConflictData] = useState<ConflictInspectorData | null>(null);

	const roomMap = useMemo(() => {
		const m = new Map<number, string>();
		for (const r of rooms) m.set(r.id, r.name);
		return m;
	}, [rooms]);

	const sectionNameMap = useMemo(() => {
		const m = new Map<number, string>();
		for (const [id, info] of sectionMap) m.set(id, info.name);
		return m;
	}, [sectionMap]);

	const selectedEntityId =
		viewMode === 'rooms' ? selectedRoomId
			: viewMode === 'teachers' ? selectedTeacherId
				: selectedSectionId;
	const setSelectedEntityId =
		viewMode === 'rooms' ? setSelectedRoomId
			: viewMode === 'teachers' ? setSelectedTeacherId
				: setSelectedSectionId;

	const { actorSchoolId } = useActorSchoolScope();

	/**
	 * A5 C5 R2 (2026-09-29) B1 — the ONE recovery the `term-unverified` empty state offers.
	 *
	 * WHY THIS EXISTS. The retry used to call `fetchSchedule()`, which is inert for this reason:
	 * `viewTerm` is null, so that function returns the same `term-unverified` state BEFORE any
	 * request, and `resolveActiveTermAuthority` below runs once per `actorSchoolId` with no
	 * reload path. The body told a scheduler to "retry once the term is confirmed" and the button
	 * could not ask whether it had been. A button that cannot do what it says is not a next step.
	 *
	 * The fix is a counter, not a refactor: the resolver effect below keys on it, so a retry is a
	 * SECOND read of the term authority. If an administrator has re-synced the year in the
	 * meantime the term resolves, `viewTerm` becomes non-null, and the existing fetch effect
	 * re-runs and proceeds on its own. If the term is still unresolved the same refusal is still
	 * on screen, which is the honest outcome.
	 */
	const [termAuthorityRetryToken, setTermAuthorityRetryToken] = useState(0);

	useEffect(() => {
		if (actorSchoolId == null) {
			setSchoolYearId(null);
			setLookupError(false);
			setRoomsLoading(false);
			return;
		}
		const scopedSchoolId = actorSchoolId;
		(async () => {
			try {
				setLookupError(false);
				// A2-C14 — this page asks for upstream verification exactly ONCE per
				// read, and it needs no fast unverified read first: it cannot use an
				// unverified term at all, so the extra round trip bought nothing and
				// broke A5-C5's "the year context is read exactly once on mount"
				// control. `forceRefresh` is what makes this a real dispatch — without
				// it the school-keyed cache short-circuit returned the UNVERIFIED
				// entry written moments earlier by TeacherConcerns, so the requested
				// verification was never issued at all (root cause:
				// docs/reviews/a2-c14-root-cause/root-cause.md §Term 3).
				// `isVerifiedOrderedActiveTerm` below stays exactly as it is — the gate
				// is unchanged, only who asks is.
				const yearContext = await resolveActiveSchoolYearContext({
					schoolId: scopedSchoolId,
					allowStaleOnError: true,
					allowEnrollProFallback: false,
					forceRefresh: true,
					verifyUpstream: true,
				});
				const activeSchoolYearId = yearContext.activeSchoolYearId;

				const [buildingsRes, subjectsRes, facultyRes] = await Promise.all([
					atlasApi.get<{ buildings: Building[] }>(`/map/schools/${scopedSchoolId}/buildings`),
					atlasApi.get<{ subjects: Subject[] }>(`/subjects?schoolId=${scopedSchoolId}`).catch(() => ({ data: { subjects: [] as Subject[] } })),
					atlasApi.get<{ faculty: FacultyMirror[] }>(`/faculty?schoolId=${scopedSchoolId}`).catch(() => ({ data: { faculty: [] as FacultyMirror[] } })),
				]);

				setSchoolYearId(activeSchoolYearId);
				setSchoolYearLabel(yearContext.activeSchoolYearLabel ?? null);

				// ROOM-SCHEDULES-TERM-C01 — capture the term authority that was already being
				// fetched and discarded, through the SAME predicate the main workspace uses, so
				// this surface cannot develop a second opinion about "the active term".
				const activeTerm = yearContext.activeTerm ?? null;
				if (isVerifiedOrderedActiveTerm(activeTerm)) {
					const terms = activeTerm?.orderedTerms ?? [];
					setOrderedTerms(terms.length > 0 ? terms : null);
					setVerifiedActiveTermIndex(activeTerm?.termIndex ?? null);
					setViewTerm((current) => (
						current != null && isTermIndexWithinTerms(current, terms) ? current : activeTerm?.termIndex ?? null
					));
				} else {
					// Unresolved authority. Clear rather than default: the view must not read,
					// and must not claim, a term it cannot prove.
					setOrderedTerms(null);
					setVerifiedActiveTermIndex(null);
					setViewTerm(null);
				}

				if (activeSchoolYearId) {
					// A5 C5 — the DATED history behind "Show an older timetable". Best-effort: the
					// default (latest) needs no history, so a failure here must not affect the
					// page. Only COMPLETED runs are offered; an unfinished run is not a timetable.
					atlasApi.get<{ runs: GenerationRun[] }>(
						`/generation/${scopedSchoolId}/${activeSchoolYearId}/runs?limit=${OLDER_RUN_LIMIT}`,
					).then((r) => {
						setPastRuns((r.data.runs ?? [])
							.filter((run) => run.status === 'COMPLETED')
							.map((run) => ({
								id: run.id,
								madeOn: formatScheduleMadeOn(run.finishedAt ?? run.createdAt ?? null),
							})));
					}).catch(() => { /* the disclosure is optional; the default view is not */ });

					atlasApi.get<SectionSummaryResponse>(`/sections/summary/${activeSchoolYearId}?schoolId=${scopedSchoolId}`)
						.then((r) => {
							const secMap = new Map<number, SectionInfo>();
							const list: { id: number; name: string; gradeLevelName: string }[] = [];
							for (const s of r.data.sections) {
								const grade = s.gradeLevelName ? Number(s.gradeLevelName.replace(/\D/g, '')) || null : null;
								secMap.set(s.id, { name: s.name, gradeLevel: grade });
								list.push({ id: s.id, name: s.name, gradeLevelName: s.gradeLevelName });
							}
							setSectionMap(secMap);
							setSectionList(list);
						})
						.catch(() => { /* best-effort */ });
				}

				const allRooms: (Room & { buildingName: string })[] = [];
				for (const b of buildingsRes.data.buildings) {
					for (const r of b.rooms ?? []) {
						if (r.isTeachingSpace) allRooms.push({ ...r, buildingName: b.name });
					}
				}
				allRooms.sort((a, b) => a.name.localeCompare(b.name));
				setRooms(allRooms);

				if (queryRoomId && allRooms.some((r) => String(r.id) === queryRoomId)) {
					setSelectedRoomId(queryRoomId);
				}

				const sMap = new Map<number, string>();
				for (const s of subjectsRes.data.subjects) {
					sMap.set(s.id, s.displayCode ?? s.code ?? s.name);
				}
				setSubjectMap(sMap);

				const fMap = new Map<number, string>();
				const activeFaculty: FacultyMirror[] = [];
				for (const f of facultyRes.data.faculty) {
					fMap.set(f.id, `${f.lastName}, ${f.firstName.charAt(0)}.`);
					if (f.isActiveForScheduling !== false) activeFaculty.push(f);
				}
				setFacultyMap(fMap);
				setFacultyList(activeFaculty);
			} catch {
				setLookupError(true);
			} finally {
				setRoomsLoading(false);
			}
		})();
	}, [actorSchoolId, termAuthorityRetryToken]);

	const selectedModeCopy = MODE_COPY[viewMode];
	const SelectedModeIcon = selectedModeCopy.icon;

	const fetchSchedule = useCallback(async () => {
		if (!selectedEntityId || !schoolYearId) return;
		if (actorSchoolId == null) {
			setState({ status: 'empty', reason: 'scope-unverified', message: 'Your school scope could not be verified. Sign in again, then retry.' });
			return;
		}
		const scopedSchoolId = actorSchoolId;

		// ROOM-SCHEDULES-TERM-C01 — fail closed BEFORE any request. An unverified term is
		// unresolved authority: this surface must neither read an all-term draft nor silently
		// adopt Term 1. The message is an operator action, and it never claims the schedule is empty.
		if (viewTerm == null) {
			setState({ status: 'empty', reason: 'term-unverified', message: UNVERIFIED_TERM_BODY });
			return;
		}
		const selectedTermForView = viewTerm;

		setState({ status: 'loading' });
		try {
			if (viewMode === 'rooms') {
				// A5 C5: `source` is `latest` unless a DATED older timetable was chosen. There is no
			// third option, and no way to reach one by typing a number.
			const params = new URLSearchParams(pinnedRunId == null
				? { source: 'latest' }
				: { source: 'run', runId: String(pinnedRunId) });
				// ROOM-SCHEDULES-TERM-C01 — send the ONE selected term. The server
				// endpoint already accepts an explicit termIndex and fails closed
				// with 501 TERM_FILTER_NOT_READY rather than merging; it was only
				// ever omitted here, which is what produced the invented conflicts.
				params.set('termIndex', String(selectedTermForView));

				const { data } = await atlasApi.get<RoomScheduleView>(
					`/room-schedules/${scopedSchoolId}/${schoolYearId}/rooms/${selectedEntityId}?${params}`,
				);
				setState({ status: 'ok', data });
			} else {
				const url = pinnedRunId == null
					? `/generation/${scopedSchoolId}/${schoolYearId}/runs/latest/timetable`
					: `/generation/${scopedSchoolId}/${schoolYearId}/runs/${pinnedRunId}/timetable`;

				const { data: report } = await atlasApi.get<DraftReport>(url);

				const entityId = Number(selectedEntityId);
				let entity: { id: number; name: string; subtitle?: string };
				if (viewMode === 'teachers') {
					const f = facultyList.find((x) => x.id === entityId);
					entity = {
						id: entityId,
						name: f ? `${f.lastName}, ${f.firstName}` : 'Teacher not listed',
						subtitle: f?.department ?? undefined,
					};
				} else {
					const s = sectionList.find((x) => x.id === entityId);
					entity = {
						id: entityId,
						name: s?.name ?? 'Section not listed',
						subtitle: s?.gradeLevelName,
					};
				}

				const result = pivotDraftToView(report, viewMode, entityId, entity, selectedTermForView, subjectMap);
				if (!result.ok) {
					// Fail closed for the same reason the server refuses: an entry with no term
					// identity cannot be placed in one term, and merging is what this exists to stop.
					setState({
						status: 'empty',
						reason: 'draft-untermable',
						message: 'Some sessions in this draft have no verified term, so they cannot be shown for one term. Regenerate the draft, then retry.',
					});
					return;
				}
				setState({ status: 'ok', data: result.view });
			}
		} catch (e: unknown) {
			const resp = (e as { response?: { data?: { code?: string; message?: string } } })?.response;
			const code = resp?.data?.code;
			const msg = resp?.data?.message ?? 'Failed to load schedule.';
			if (code === 'NO_RUNS') {
				setState({ status: 'empty', reason: 'no-runs', message: msg });
			} else {
				setState({ status: 'error', message: msg });
			}
		}
	}, [actorSchoolId, viewMode, selectedEntityId, schoolYearId, pinnedRunId, facultyList, sectionList, subjectMap, viewTerm]);

	/**
	 * A5 C5 R2 (2026-09-29) B1 — performs the retry the empty state NAMED, and nothing else.
	 *
	 * The next step declares its own recovery (`recheck`), so this dispatch is a switch on that
	 * declaration rather than a guess from the current state. A `term-authority` retry re-runs the
	 * year-context effect above; a schedule refetch is the fallback for any other recovery a
	 * future reason might add, and it is deliberately the CONSERVATIVE one (it cannot invent
	 * authority), so an unrecognised retry can never resolve a term that is still unresolved.
	 */
	const runEmptyStateNextStep = useCallback((nextStep: ScheduleEmptyNextStep) => {
		if (nextStep.kind !== 'retry') return;
		if (nextStep.recheck === 'term-authority') {
			setTermAuthorityRetryToken((token) => token + 1);
			return;
		}
		void fetchSchedule();
	}, [fetchSchedule]);

	useEffect(() => {
		if (!selectedEntityId || !schoolYearId) return;
		void fetchSchedule();
	}, [selectedEntityId, schoolYearId, pinnedRunId, fetchSchedule]);

	useEffect(() => {
		if (!selectedEntityId) {
			setState({ status: 'idle' });
		}
	}, [viewMode, selectedEntityId]);

	const roomGroups = useMemo(() => {
		const byBuilding = new Map<string, { value: string; label: string }[]>();
		for (const r of rooms) {
			const key = r.buildingName || 'Building not listed';
			const list = byBuilding.get(key) ?? [];
			list.push({ value: String(r.id), label: `${r.name} (F${r.floor})` });
			byBuilding.set(key, list);
		}
		return Array.from(byBuilding.entries())
			.sort((a, b) => a[0].localeCompare(b[0]))
			.map(([label, items]) => ({ label, items }));
	}, [rooms]);

	const teacherGroups = useMemo(() => {
		const byDept = new Map<string, { value: string; label: string }[]>();
		const sorted = [...facultyList].sort(
			(a, b) => a.lastName.localeCompare(b.lastName) || a.firstName.localeCompare(b.firstName),
		);
		for (const f of sorted) {
			const key = f.department || 'Unassigned';
			const list = byDept.get(key) ?? [];
			list.push({ value: String(f.id), label: `${f.lastName}, ${f.firstName}` });
			byDept.set(key, list);
		}
		return Array.from(byDept.entries())
			.sort((a, b) => a[0].localeCompare(b[0]))
			.map(([label, items]) => ({ label, items }));
	}, [facultyList]);

	const sectionGroups = useMemo(() => {
		const byGrade = new Map<string, { value: string; label: string }[]>();
		const sorted = [...sectionList].sort(
			(a, b) => a.gradeLevelName.localeCompare(b.gradeLevelName) || a.name.localeCompare(b.name),
		);
		for (const s of sorted) {
			const key = s.gradeLevelName || 'Other';
			const list = byGrade.get(key) ?? [];
			list.push({ value: String(s.id), label: s.name });
			byGrade.set(key, list);
		}
		return Array.from(byGrade.entries())
			.sort((a, b) => a[0].localeCompare(b[0]))
			.map(([label, items]) => ({ label, items }));
	}, [sectionList]);

	/** The one picker: its option list, and the name of what it lists. */
	const activeSelector = useMemo(() => {
		if (viewMode === 'rooms') return { groups: roomGroups, placeholder: 'Choose a room', noun: 'room' };
		if (viewMode === 'teachers') return { groups: teacherGroups, placeholder: 'Choose a teacher', noun: 'teacher' };
		return { groups: sectionGroups, placeholder: 'Choose a section', noun: 'section' };
	}, [viewMode, roomGroups, teacherGroups, sectionGroups]);

	const selectedName = useMemo(() => {
		if (viewMode === 'rooms') {
			const r = rooms.find((x) => String(x.id) === selectedEntityId);
			return r?.name ?? 'room';
		}
		if (viewMode === 'teachers') {
			const f = facultyList.find((x) => String(x.id) === selectedEntityId);
			return f ? `${f.lastName}_${f.firstName}` : 'teacher';
		}
		const s = sectionList.find((x) => String(x.id) === selectedEntityId);
		return s?.name ?? 'section';
	}, [viewMode, selectedEntityId, rooms, facultyList, sectionList]);

	const handleExport = useCallback(() => {
		if (state.status !== 'ok') return;
		exportScheduleToCsv(state.data, viewMode, selectedName, subjectMap, facultyMap, sectionMap, roomMap);
	}, [state, viewMode, selectedName, subjectMap, facultyMap, sectionMap, roomMap]);

	/**
	 * A5 C5 — the ONE quiet line naming the timetable on screen. It reads the date the loaded view
	 * itself carries (`source.generatedAt`, set by both the server's room read and
	 * `pivotDraftToView`), so it always describes what is rendered rather than what was intended.
	 * There is deliberately no run id in this string, and no code path that could add one.
	 */
	const sourceSentence = useMemo(() => {
		if (state.status !== 'ok') return null;
		return buildScheduleSourceSentence({
			madeAt: state.data.source.generatedAt,
			termIndex: viewTerm,
			orderedTerms,
			isOlder: pinnedRunId != null,
		});
	}, [state, viewTerm, orderedTerms, pinnedRunId]);

	/**
	 * A5 C5 CORRECTION ROUND 1 (F1) — the ONE place the empty state's wording is decided. Both the
	 * title and the next step come from the refusal's reason, so a heading and an action can never
	 * describe different problems. `null` while the page is not refusing, which is the only state
	 * in which the block below is not rendered.
	 */
	const emptyState = useMemo(
		() => (state.status === 'empty' ? resolveScheduleEmptyState(state.reason, state.message) : null),
		[state],
	);

	const conflictHandler = useCallback((day: string, dayLabel: string, startTime: string, endTime: string, entries: Parameters<NonNullable<Parameters<typeof ScheduleTimetableGrid>[0]['onConflictClick']>>[4]) => {
		if (state.status !== 'ok') return;
		setConflictData({
			day,
			dayLabel,
			startTime,
			endTime,
			roomName: state.data.room.name,
			roomId: viewMode === 'rooms' ? Number(selectedEntityId) : 0,
			runId: state.data.source.runId ?? 0,
			runStatus: state.data.source.status,
			sourceMadeOn: formatScheduleMadeOn(state.data.source.generatedAt),
			entries,
		});
	}, [state, viewMode, selectedEntityId]);

	return (
		<TooltipProvider delayDuration={200}>
		<div className="flex h-[calc(100svh-3.5rem)] flex-col bg-primary/5">
			{/* §8 HEADER BUDGET — row 1: title, ONE status chip, the primary action, `More`.
			    Row 2: the three questions, the one name picker, the term control when the year
			    warrants one, and the quiet line naming the timetable. Nothing else.

			    A5 C5 PROOF FIX (2026-09-29) D1 — THE CHIP IS THE SCHEDULE'S, NOT THE NAME LIST'S.
			    A real render showed this chip reading `Choose a name` while the picker DIRECTLY
			    BELOW it read `Choose a room` — a room was already chosen. Two faults at once: it
			    was wired to `state.status`, which is `'empty'` whenever staging has no finished
			    timetable, so it told all three modes to choose a name they had already chosen; and
			    it duplicated the picker's own instruction, which §8 forbids. It also reported the
			    NAME LIST (`roomsLoading` -> `Loading names`), which is the picker's business.

			    So it now reports only the schedule, and it never tells the user to use another
			    control. `roomsLoading` is no longer an input: the chip is about what is on screen,
			    and when nothing is on screen the empty state BELOW says why in a heading and
			    offers the next step as a real action. SUBTRACT FIRST: the honest answer in the
			    idle/empty/error states is to render no chip at all, and that is what this does. */}
			<div className="shrink-0 px-3 pt-2 lg:px-5">
				<div className="flex flex-wrap items-center gap-2 rounded-xl border border-primary/10 bg-white px-3 py-2 shadow-soft">
					{/* A5 C5 PROOF FIX (2026-09-29) D3 — ONE NAME. This heading used to hardcode
					    `Schedules`, a THIRD name for `/room-schedules`: the sidebar label and the
					    chrome title both already resolve to `LOOKUP_PRINT_LABEL` through
					    `resolveRouteChrome`. A7 C6 item 1 is "one destination, ONE name"; the page
					    was carrying the duplicate-name defect A7 removed from the menu. Rendering
					    the imported constant — the same pattern `a2-c13-one-place-name` pins for
					    `/timetable` and the `a3-canonical-page-title-c1` rendered-h1 contract
					    requires — means the three surfaces cannot drift apart again. This page
					    owns one `h1` in a compact header strip, like `Sections`/`Subjects`/
					    `Faculty`; `navigation.ts` is untouched. */}
					<h1 className="text-base font-bold text-foreground">{LOOKUP_PRINT_LABEL}</h1>
					{(state.status === 'ok' || state.status === 'loading') && (
						<SmartSourceStatusChip
							label={state.status === 'ok' ? 'Ready' : 'Loading schedule'}
							tone={state.status === 'ok' ? 'live' : 'checking'}
							testId="schedules-readiness-chip"
						/>
					)}
					<div className="ml-auto flex items-center gap-1.5">
						<Button
							type="button"
							variant="default"
							size="sm"
							className="h-9 gap-1.5"
							disabled={state.status !== 'ok'}
							onClick={() => window.print()}
							data-testid="schedules-print-current"
						>
							<Printer className="size-3.5" />
							Print this schedule
						</Button>
						<DropdownMenu>
							<DropdownMenuTrigger asChild>
								<Button type="button" variant="outline" size="sm" className="h-9 gap-1.5" data-testid="schedules-more-trigger">
									<MoreHorizontal className="size-3.5" />
									More
									<ChevronDown className="size-3" />
								</Button>
							</DropdownMenuTrigger>
							<DropdownMenuContent align="end" className="w-64">
								<DropdownMenuItem onSelect={() => { void fetchSchedule(); }} data-testid="schedules-more-refresh">
									<RefreshCw className="size-4" />
									Refresh
								</DropdownMenuItem>
								<DropdownMenuItem
									onSelect={() => handleExport()}
									disabled={state.status !== 'ok'}
									data-testid="schedules-more-export-csv"
								>
									<FileSpreadsheet className="size-4" />
									Export this view as CSV
								</DropdownMenuItem>
								<DropdownMenuItem onSelect={() => setDownloadSchedulesOpen(true)} data-testid="schedules-more-download">
									<Download className="size-4" />
									Download official Word or Excel schedules
								</DropdownMenuItem>
								{viewMode === 'rooms' && (
									<>
										<DropdownMenuSeparator />
										<DropdownMenuItem
											onSelect={() => setPresentationMode(presentationMode === 'occupancy' ? 'schedule' : 'occupancy')}
											data-testid="schedules-more-occupancy"
										>
											<DoorOpen className="size-4" />
											{presentationMode === 'occupancy' ? 'Back to the week grid' : 'Room occupancy sheet'}
										</DropdownMenuItem>
									</>
								)}
							</DropdownMenuContent>
						</DropdownMenu>
					</div>
				</div>

				<div className="mt-1.5 flex flex-wrap items-center gap-2" data-testid="schedule-browser-selector">
					<span className="text-xs font-medium text-muted-foreground">Show:</span>
					{VIEW_MODES.map((mode) => {
						const Icon = MODE_COPY[mode].icon;
						return (
							<Button
								key={mode}
								type="button"
								variant={viewMode === mode ? 'default' : 'outline'}
								size="sm"
								aria-pressed={viewMode === mode}
								onClick={() => {
									setViewMode(mode);
									if (mode !== 'rooms' || presentationMode === 'occupancy') setPresentationMode('schedule');
								}}
								className="h-9 gap-1.5"
								data-testid={`schedule-mode-${mode}`}
							>
								<Icon className="size-3.5" />
								{MODE_COPY[mode].label}
							</Button>
						);
					})}
					{/* A5 c8 (2026-09-29) — THE ENTITY PICKER IS THE ONE SHARED BAR'S CHILD.
					    * It is the only FILTER on this page; the three mode buttons above it
					    * choose WHAT is listed rather than narrowing a list, so they stay
					    * where they are, and `ScheduleSourceBand` beside it is a status band,
					    * not a filter.
					    * WHAT CHANGED: `width="fill"` inside a `min-w-40 flex-1` wrapper is
					    * gone. `fill` claims a layout SLOT, so the trigger stretched to the
					    * slot's width and the sweep recorded "the very wide `Choose a room`
					    * select" as this page looking different from its peers. The shared
					    * `auto` variant is BOUNDED (`min-w-32 max-w-[22rem]`) and its face
					    * WRAPS, so a long room name grows the control instead of making it
					    * 600px wide.
					    * WHAT MOVED: the face now NAMES ITSELF — `Room: …`, `Teacher: …`,
					    * `Section: …` — so it is never confused with the `Term` / `Year`
					    * pickers elsewhere, and it is no longer a bare `Choose a room`
					    * placeholder with nothing to say what it filters.
					    * WHAT IS UNCHANGED: the three option lists, the grouping by grade,
					    * the `ariaLabel`, the `schedules-entity-picker` `data-testid`, and
					    * the skeleton while rooms load. */}
					<FilterBar dataTestId="room-schedules-filter-bar">
						{roomsLoading ? (
							<Skeleton className="h-9 w-56 shrink-0 rounded-lg" />
						) : (
							<SearchableSelect
								value={selectedEntityId}
								onValueChange={setSelectedEntityId}
								groups={activeSelector.groups}
								placeholder={activeSelector.placeholder}
								ariaLabel={`Schedule for ${activeSelector.noun}`}
								triggerLabelPrefix={activeSelector.noun === 'room' ? 'Room' : activeSelector.noun === 'teacher' ? 'Teacher' : 'Section'}
								triggerLabelValue={
									selectedEntityId
										? activeSelector.groups.flatMap((group) => group.items).find((item) => item.value === String(selectedEntityId))?.label
										: undefined
								}
								// A5 c4 shared picker chrome; the page's previous
								// `h-10 text-sm w-full rounded-xl bg-white shadow-sm` restated it locally.
								triggerClassName={pickerTriggerClass('auto')}
								triggerTestId="schedules-entity-picker"
							/>
						)}
					</FilterBar>
					<ScheduleSourceBand
						termOptions={viewTermOptions}
						orderedTerms={orderedTerms}
						viewTerm={viewTerm}
						termVerified={termVerified}
						onTermChange={(value) => {
							const parsed = Number(value);
							if (isTermIndexWithinTerms(parsed, orderedTerms)) setViewTerm(parsed);
						}}
						sentence={sourceSentence}
						pastRuns={pastRuns}
						pinnedRunId={pinnedRunId}
						onPinnedChange={setPinnedRunId}
					/>
				</div>
			</div>

			{viewMode === 'rooms' && presentationMode === 'occupancy' && (
				<div className="flex shrink-0 items-center gap-1.5 px-3 pt-2 lg:px-5">
					<Button variant={templateVariant === '11x6' ? 'default' : 'outline'} size="sm" className="h-9 px-3 text-xs" onClick={() => setTemplateVariant('11x6')}>11x6</Button>
					<Button variant={templateVariant === '13x6' ? 'default' : 'outline'} size="sm" className="h-9 px-3 text-xs" onClick={() => setTemplateVariant('13x6')}>13x6</Button>
				</div>
			)}

			{state.status === 'ok' && presentationMode === 'schedule' && (
				<div className="shrink-0 px-3 pt-2 lg:px-5">
					<div className="flex flex-wrap items-center gap-3 rounded-lg border border-border bg-card px-3 py-1.5 text-sm">
						<span className="font-semibold text-foreground">
							Utilization: <span className="font-normal text-muted-foreground">{state.data.summary.utilizationPercent}%</span>
						</span>
						<span className="text-xs text-muted-foreground">
							Occupied: <span className="font-normal text-muted-foreground">{state.data.summary.occupiedMinutes} of {state.data.summary.availableMinutes} min</span>
						</span>
						{state.data.summary.conflictCount > 0 ? (
							<Badge variant="destructive" className="text-xs">
								<AlertTriangle className="mr-1 size-3" />
								{state.data.summary.conflictCount} conflict{state.data.summary.conflictCount !== 1 ? 's' : ''}
							</Badge>
						) : (
							<span className="text-xs text-muted-foreground">Conflicts: <span className="font-semibold text-green-700">0</span></span>
						)}
					</div>
				</div>
			)}

			<SchedulerPrintDialog
				open={downloadSchedulesOpen}
				onOpenChange={setDownloadSchedulesOpen}
				schoolId={actorSchoolId ?? 0}
				schoolYearId={schoolYearId}
				runId={state.status === 'ok' ? state.data.source.runId : null}
				termIndex={viewTerm ?? 'all'}
				yearLabel={schoolYearLabel}
				viewMode={viewMode === 'rooms' ? 'room' : viewMode === 'teachers' ? 'faculty' : 'section'}
				entityFilter={selectedEntityId}
			/>

			<div className="flex-1 min-h-0 overflow-auto px-4 pb-4 pt-2 lg:px-5">
				{state.status === 'idle' && (
					<div className="flex h-full items-center justify-center rounded-2xl border border-dashed border-primary/20 bg-white p-8 text-center text-muted-foreground shadow-soft">
						<div className="max-w-md">
							<div className="mx-auto mb-4 flex size-14 items-center justify-center rounded-2xl bg-primary/10 text-primary">
								<SelectedModeIcon className="size-7" />
							</div>
							<p className="text-base font-bold text-foreground">{lookupError ? 'Names could not be loaded' : selectedModeCopy.emptyTitle}</p>
							<p className="mt-2 text-sm leading-relaxed text-muted-foreground">
								{lookupError
									? 'ATLAS could not load the active school year or the name lists. Refresh when the connection is stable.'
									: selectedModeCopy.emptyBody}
							</p>
						</div>
					</div>
				)}

				{state.status === 'loading' && (
					<div className="space-y-1 pt-2">
						<Skeleton className="h-9 w-full rounded" />
						{Array.from({ length: 8 }).map((_, i) => (
							<Skeleton key={i} className="h-14 w-full rounded" />
						))}
					</div>
				)}

				{/* The guard is `emptyState`, not `state.status === 'empty'`. Both are equivalent
				    (the memo is non-null exactly when the state is empty), but only this one lets
				    TypeScript narrow the resolved state inside the branch — narrowing on the fetch
				    state cannot prove a DERIVED value non-null. */}
				{emptyState && (
					<div className="flex h-full items-center justify-center rounded-2xl border border-dashed border-border bg-white p-8 text-center text-muted-foreground shadow-soft">
						<div className="max-w-md">
							<CalendarX className="mx-auto mb-3 size-10 text-muted-foreground/60" />
							{/* A5 C5 CORRECTION ROUND 1 (F1). The title AND the next step both come
							    from ONE resolver keyed by the refusal's reason, because they are one
							    claim about one condition. The first candidate hardcoded "No timetable
							    to show yet" + "Build one on the Timetable page" for all four refusals,
							    so the unverified-term case contradicted its own body ("NOT a missing
							    timetable") and the untermable-draft case told a scheduler to build a
							    timetable that exists, when the answer is to regenerate the draft. Three
							    of the four refusals are UNCHANGED: each still refuses before any
							    request, exactly as QA confirmed. Only the wording was wrong. */}
							<p
								className="text-base font-bold text-foreground"
								data-testid="schedules-empty-title"
							>
								{emptyState.title}
							</p>
							<p className="mt-2 text-sm leading-relaxed text-muted-foreground">{emptyState.body}</p>
							{/* A5 C5 PROOF FIX (2026-09-29) D2 — the server's own sentence, MOVED and
							    not deleted. The `no-runs` body used to BE that string, so a browser
							    render showed `No completed generation runs found for this school/year.`
							    as the first thing a user reads on this page. The plain sentence above
							    is now the primary read, and the evidence sits behind this `Help`
							    popover — the same affordance, the same plain word `Help`, and the same
							    `Technical detail` / `Server message` shape that A5 c4 established on
							    the `TERM_CACHE_INVALID` chip. `AGENTS.md` §8 forbids the `title`
							    attribute and requires an `@/ui` primitive, which is what this is.

							    Rendered ONLY when the resolver supplied a raw detail, so a server that
							    stops explaining itself removes the control instead of leaving a dead
							    one. The trigger's visible label is the word `Help`, never the code
							    (§11 rule 3), and the `aria-label` carries the detail for a screen
							    reader. */}
							{emptyState.rawDetail && (
								<Popover>
									<PopoverTrigger asChild>
										<Button
											type="button"
											variant="ghost"
											size="sm"
											className="mx-auto mt-2 h-7 gap-1 px-1.5 text-xs font-semibold text-primary hover:underline"
											data-testid="schedules-empty-detail"
											aria-label="Technical detail"
										>
											<Info className="size-3" />
											<span>Help</span>
										</Button>
									</PopoverTrigger>
									<PopoverContent align="center" className="w-80 space-y-2 p-3 text-xs leading-relaxed">
										<p className="font-semibold uppercase tracking-wide text-muted-foreground">Technical detail</p>
										<p><span className="font-semibold">Server message</span> · {emptyState.rawDetail}</p>
									</PopoverContent>
								</Popover>
							)}
							{emptyState.nextStep.kind === 'retry' ? (
								<Button
									variant="outline"
									size="sm"
									className="mt-4"
									onClick={() => { runEmptyStateNextStep(emptyState.nextStep); }}
									data-testid={emptyState.testId}
								>
									<RefreshCw className="mr-1.5 size-3.5" />
									{emptyState.nextStep.label}
								</Button>
							) : (
								<Button
									variant="outline"
									size="sm"
									className="mt-4"
									asChild
									data-testid={emptyState.testId}
								>
									<Link to={emptyState.nextStep.to}>{emptyState.nextStep.label}</Link>
								</Button>
							)}
						</div>
					</div>
				)}

				{state.status === 'error' && (
					<div className="flex h-full items-center justify-center rounded-2xl border border-destructive/20 bg-white p-8 text-center text-destructive shadow-soft">
						<div className="max-w-md">
							<ServerOff className="mx-auto mb-3 size-10 opacity-60" />
							<p className="text-base font-bold">The schedule could not be loaded</p>
							<p className="mt-2 text-sm leading-relaxed opacity-80">{state.message}</p>
							<Button variant="outline" size="sm" className="mt-4" onClick={() => { void fetchSchedule(); }}>
								<RefreshCw className="mr-1.5 size-3.5" /> Try again
							</Button>
						</div>
					</div>
				)}

				{state.status === 'ok' && presentationMode === 'schedule' && (
					<>
						<div className="hidden lg:block">
							<ScheduleTimetableGrid
								view={state.data}
								viewMode={viewMode}
								subjectMap={subjectMap}
								facultyMap={facultyMap}
								sectionMap={sectionMap}
								roomMap={roomMap}
								onConflictClick={conflictHandler}
							/>
						</div>
						<div className="lg:hidden">
							<ScheduleMobileCards
								view={state.data}
								viewMode={viewMode}
								subjectMap={subjectMap}
								facultyMap={facultyMap}
								sectionMap={sectionMap}
								roomMap={roomMap}
								onConflictClick={conflictHandler}
							/>
						</div>
					</>
				)}

				{state.status === 'ok' && presentationMode === 'occupancy' && viewMode === 'rooms' && (
					<OccupancyTemplatePreview
						view={state.data}
						variant={templateVariant}
						subjectMap={subjectMap}
						facultyMap={facultyMap}
						sectionMap={sectionNameMap}
						onPrint={() => window.print()}
					/>
				)}
			</div>

			<ConflictInspectorSheet
				open={!!conflictData}
				data={conflictData}
				onClose={() => setConflictData(null)}
				subjectMap={subjectMap}
				facultyMap={facultyMap}
				sectionMap={sectionNameMap}
			/>
		</div>
		</TooltipProvider>
	);
}
