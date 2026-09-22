/**
 * UX-P01 (R1/R5) — the pure transport reads for the Timetable data layer.
 *
 * Every function here is a thin, side-effect-free projection of one or two real
 * ATLAS endpoints and returns the parsed response payload untouched. Introducing
 * the TanStack Query cache must not alter what the components consume, so no
 * function in this module normalizes, renames, defaults, or reorders data: the
 * HTTP response body is the returned value.
 */
import atlasApi from '@/lib/api';
import { buildTimetableGenerationPath } from '@/components/timetable/timetableSchoolScope';
import type {
	Building,
	DraftBoardState,
	DraftReport,
	ExternalSection,
	FacultyMirror,
	GenerationRun,
	GradeShiftWindow,
	PolicySpecialEvent,
	RoomPreferenceDecisionStatus,
	RoomPreferenceStatus,
	RoomPreferenceSummaryResponse,
	SectionSummaryResponse,
	Subject,
	ViolationReport,
} from '@/types';

export type TimetableRunBundle = {
	draft: DraftReport;
	violations: ViolationReport;
};

export type TimetableReferenceData = {
	subjects: Subject[];
	faculty: FacultyMirror[];
	buildings: Building[];
	sections: ExternalSection[];
	sectionSummary: SectionSummaryResponse;
};

export async function fetchTimetableRuns(
	schoolId: number,
	schoolYearId: number,
): Promise<GenerationRun[]> {
	const { data } = await atlasApi.get<{ runs: GenerationRun[] }>(
		buildTimetableGenerationPath(schoolId, schoolYearId, '/runs'),
		{ params: { limit: 20 } },
	);
	return data.runs;
}

export async function fetchTimetableReadiness(
	schoolId: number,
	schoolYearId: number,
): Promise<unknown> {
	const { data } = await atlasApi.get<{ readiness?: unknown }>(
		buildTimetableGenerationPath(schoolId, schoolYearId, '/readiness/diagnostic'),
	);
	return data?.readiness;
}

export function resolveTimetableRunPath(
	schoolId: number,
	schoolYearId: number,
	runId: string | number,
): string {
	const base = `/generation/${schoolId}/${schoolYearId}/runs`;
	return runId === 'latest' ? `${base}/latest` : `${base}/${runId}`;
}

export async function fetchTimetableRunBundle(
	schoolId: number,
	schoolYearId: number,
	runId: string | number,
): Promise<TimetableRunBundle> {
	const runPath = resolveTimetableRunPath(schoolId, schoolYearId, runId);
	const [draftRes, violationsRes] = await Promise.all([
		atlasApi.get<DraftReport>(`${runPath}/draft`),
		atlasApi.get<ViolationReport>(`${runPath}/violations`),
	]);
	return { draft: draftRes.data, violations: violationsRes.data };
}

export async function fetchTimetableFollowUpEntryIds(
	schoolId: number,
	schoolYearId: number,
	numericRunId: number,
): Promise<string[]> {
	const { data } = await atlasApi.get<{ flags: Array<{ entryId: string }> }>(
		`/follow-up-flags/${schoolId}/${schoolYearId}/runs/${numericRunId}/flags`,
	);
	return data.flags.map((flag) => flag.entryId);
}

export async function fetchTimetableDraftBoard(
	schoolId: number,
	schoolYearId: number,
): Promise<DraftBoardState> {
	const { data } = await atlasApi.get<DraftBoardState>(
		`/generation/${schoolId}/${schoolYearId}/pre-generation-drafts?preferCachedSections=true`,
	);
	return data;
}

export async function fetchTimetableRoomRequestSummary(
	schoolId: number,
	schoolYearId: number,
	statusFilter: 'ALL' | RoomPreferenceStatus,
	decisionFilter: 'ALL' | RoomPreferenceDecisionStatus,
): Promise<RoomPreferenceSummaryResponse> {
	const params: Record<string, string> = {};
	if (statusFilter !== 'ALL') params.status = statusFilter;
	if (decisionFilter !== 'ALL') params.decisionStatus = decisionFilter;
	const { data } = await atlasApi.get<RoomPreferenceSummaryResponse>(
		`/room-preferences/${schoolId}/${schoolYearId}/latest/summary`,
		{ params },
	);
	return data;
}

export async function fetchTimetableReferenceData(
	schoolId: number,
	schoolYearId: number,
): Promise<TimetableReferenceData> {
	const [subjectsRes, facultyRes, buildingsRes, sectionsRes] = await Promise.all([
		atlasApi.get<{ subjects: Subject[] }>(`/subjects?schoolId=${schoolId}`),
		atlasApi.get<{ faculty: FacultyMirror[] }>(`/faculty?schoolId=${schoolId}`),
		atlasApi.get<{ buildings: Building[] }>(`/map/schools/${schoolId}/buildings`),
		atlasApi
			.get<SectionSummaryResponse>(`/sections/summary/${schoolYearId}?schoolId=${schoolId}`)
			.catch(() => ({ data: { sections: [] as ExternalSection[] } })),
	]);
	return {
		subjects: subjectsRes.data.subjects,
		faculty: facultyRes.data.faculty,
		buildings: buildingsRes.data.buildings,
		sections: sectionsRes.data.sections,
		sectionSummary: sectionsRes.data as SectionSummaryResponse,
	};
}

// ─── C2 (TIMETABLE-RELAXED-MAIN-C01) — sub-page pane policy reads ─────────────
// These three reads were issued directly by `SchedulingPolicyPane` on every
// mount. They are school/year-scoped and run/term-invariant, so they belong in
// the shared scoped query cache: a revisit (or a sibling consumer) now hits the
// cache instead of re-issuing HTTP. The endpoint, params, and the 8 s client
// timeout the pane used are preserved.

export async function fetchTimetableGradeWindows(
	schoolId: number,
	schoolYearId: number,
): Promise<{ windows: GradeShiftWindow[] }> {
	const { data } = await atlasApi.get<{ windows: GradeShiftWindow[] }>(
		`/generation/${schoolId}/${schoolYearId}/grade-windows`,
		{ timeout: 8_000 },
	);
	return data;
}

export async function fetchTimetableSectionsSummary(
	schoolId: number,
	schoolYearId: number,
): Promise<SectionSummaryResponse> {
	const { data } = await atlasApi.get<SectionSummaryResponse>(
		`/sections/summary/${schoolYearId}?schoolId=${schoolId}`,
		{ timeout: 8_000 },
	);
	return data;
}

export async function fetchTimetablePolicySpecialEvents(
	schoolId: number,
	schoolYearId: number,
): Promise<{ events: PolicySpecialEvent[] }> {
	const { data } = await atlasApi.get<{ events: PolicySpecialEvent[] }>(
		`/policies/special-events/${schoolId}/${schoolYearId}`,
		{ timeout: 8_000 },
	);
	return data;
}
