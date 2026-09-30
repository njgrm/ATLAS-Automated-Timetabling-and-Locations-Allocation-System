/**
 * A6 — Teaching Load placement feasibility, client side (operator decision 14).
 *
 * "Teaching Load never saves a load the timetable cannot place." Before a save
 * or an "Apply suggested", the client asks the server's zero-write
 * `POST /faculty-assignments/placement-check`. When a class cannot fit it does
 * NOT issue the save, shows ONE plain sentence naming the section, the subject
 * and why, and offers ONE one-click replacement teacher who fits. The server's
 * typed 409 `TEACHING_LOAD_UNPLACEABLE` (race / other tab) renders the same way,
 * so a refusal is never a bare toast.
 *
 * The server owns the sentence (`verify` the wording stays one source): the
 * client renders `blocker.sentence` and never re-words it.
 */

export interface PlacementAlternative {
	facultyId: number;
	facultyName: string;
	day: string;
	startTime: string;
	endTime: string;
}

export interface PlacementLineVerdict {
	sectionId: number;
	subjectId: number;
	facultyId: number;
	sectionName: string;
	subjectName: string;
	facultyName: string;
	placeable: boolean;
	reason: string;
	sentence: string | null;
	alternatives: PlacementAlternative[];
}

export interface PlacementBlocker {
	sectionId: number;
	subjectId: number;
	facultyId: number;
	sectionName: string;
	subjectName: string;
	facultyName: string;
	sentence: string;
	alternatives: PlacementAlternative[];
}

export interface PlacementCheckLineRequest {
	sectionId: number;
	subjectId: number;
	facultyId: number;
}

export interface PlacementDraftAssignment {
	subjectId: number;
	sectionIds?: number[] | null;
}

export interface PlacementDraft {
	facultyId: number;
	version: number;
	assignments: PlacementDraftAssignment[];
}

export interface PlacementApi {
	post: (url: string, body?: unknown) => Promise<{ data: any }>;
	put: (url: string, body?: unknown) => Promise<{ data: any }>;
}

/** (subject × section × faculty) lines a draft would write. */
export function buildPlacementCheckLines(drafts: PlacementDraft[]): PlacementCheckLineRequest[] {
	const lines: PlacementCheckLineRequest[] = [];
	for (const draft of drafts) {
		for (const assignment of draft.assignments ?? []) {
			for (const sectionId of assignment.sectionIds ?? []) {
				if (Number.isInteger(sectionId) && sectionId > 0) {
					lines.push({ sectionId, subjectId: assignment.subjectId, facultyId: draft.facultyId });
				}
			}
		}
	}
	return lines;
}

/** The not-placeable lines, as the blocker list the notice renders. */
export function blockersFromVerdicts(verdicts: PlacementLineVerdict[]): PlacementBlocker[] {
	return (verdicts ?? [])
		.filter((line) => line && line.placeable === false)
		.map((line) => ({
			sectionId: line.sectionId,
			subjectId: line.subjectId,
			facultyId: line.facultyId,
			sectionName: line.sectionName,
			subjectName: line.subjectName,
			facultyName: line.facultyName,
			sentence:
				typeof line.sentence === 'string' && line.sentence.trim().length > 0
					? line.sentence
					: `${line.sectionName} cannot fit ${line.subjectName}: no free time is available for ${line.facultyName}.`,
			alternatives: Array.isArray(line.alternatives) ? line.alternatives : [],
		}));
}

/** Blockers carried by a typed 409 (race / other tab). Empty for any other error. */
export function blockersFromError(error: unknown): PlacementBlocker[] {
	const data = (error as { response?: { data?: any } } | null)?.response?.data;
	const blockers = data?.details?.blockers;
	if (!Array.isArray(blockers)) return [];
	return blockers
		.filter((blocker) => blocker && typeof blocker.sentence === 'string')
		.map((blocker) => ({
			sectionId: Number(blocker.sectionId ?? 0),
			subjectId: Number(blocker.subjectId ?? 0),
			facultyId: Number(blocker.facultyId ?? 0),
			sectionName: String(blocker.sectionName ?? ''),
			subjectName: String(blocker.subjectName ?? ''),
			facultyName: String(blocker.facultyName ?? ''),
			sentence: blocker.sentence,
			alternatives: Array.isArray(blocker.alternatives) ? blocker.alternatives : [],
		}));
}

/** ONE plain sentence (the server's own wording). */
export function describeBlocker(blocker: PlacementBlocker): string {
	return blocker.sentence;
}

/** The one teacher the notice offers to swap in, or null when none fits. */
export function firstAlternative(blocker: PlacementBlocker): PlacementAlternative | null {
	return blocker.alternatives.length > 0 ? blocker.alternatives[0]! : null;
}

/** A short, plain description of when the alternative is free. */
export function describeAlternativeSlot(alternative: PlacementAlternative): string {
	const day = alternative.day.charAt(0) + alternative.day.slice(1).toLowerCase();
	return `${day} ${alternative.startTime}`;
}

/**
 * Add or remove exactly the blocked (subject, section) pair from a teacher's
 * draft assignment list — the one-click alternative's draft mutation.
 */
export function withPlacementPair<T extends PlacementDraftAssignment>(
	assignments: T[],
	subjectId: number,
	sectionId: number,
	mode: 'add' | 'remove',
): T[] {
	const list = (assignments ?? []).map((assignment) => ({ ...assignment, sectionIds: [...(assignment.sectionIds ?? [])] })) as T[];
	const index = list.findIndex((assignment) => assignment.subjectId === subjectId);
	if (mode === 'remove') {
		if (index < 0) return list;
		const sectionIds = (list[index]!.sectionIds ?? []).filter((id) => id !== sectionId);
		if (sectionIds.length === 0) list.splice(index, 1);
		else list[index] = { ...list[index]!, sectionIds } as T;
		return list;
	}
	if (index >= 0) {
		list[index] = { ...list[index]!, sectionIds: [...new Set([...(list[index]!.sectionIds ?? []), sectionId])] } as T;
	} else {
		list.push({ subjectId, sectionIds: [sectionId] } as unknown as T);
	}
	return list;
}

/** Zero-write server check. Throws only on transport/auth failure. */
export async function checkTeachingLoadPlacement(
	api: PlacementApi,
	input: { schoolId: number; schoolYearId: number; lines: PlacementCheckLineRequest[] },
): Promise<PlacementLineVerdict[]> {
	const { data } = await api.post('/faculty-assignments/placement-check', {
		schoolId: input.schoolId,
		schoolYearId: input.schoolYearId,
		lines: input.lines,
	});
	return Array.isArray(data?.lines) ? (data.lines as PlacementLineVerdict[]) : [];
}

export type PlacementGuardedSaveOutcome =
	| { status: 'blocked'; blockers: PlacementBlocker[] }
	| { status: 'committed'; committedFacultyIds: number[] }
	| { status: 'failed'; committedFacultyIds: number[]; failedFacultyId: number; error: unknown };

/**
 * The production save path: run the placement check FIRST and issue no PUT when
 * a line cannot be placed. This is the exact loop `handleSave` used before the
 * check existed, so the success/failure semantics are unchanged.
 *
 * The check is advisory on transport failure (the server re-checks the write),
 * but authoritative on a blocked verdict.
 */
export async function runPlacementGuardedSave(deps: {
	api: PlacementApi;
	schoolId: number;
	schoolYearId: number;
	drafts: PlacementDraft[];
}): Promise<PlacementGuardedSaveOutcome> {
	const lines = buildPlacementCheckLines(deps.drafts);
	if (lines.length > 0) {
		try {
			const verdicts = await checkTeachingLoadPlacement(deps.api, {
				schoolId: deps.schoolId,
				schoolYearId: deps.schoolYearId,
				lines,
			});
			const blockers = blockersFromVerdicts(verdicts);
			if (blockers.length > 0) return { status: 'blocked', blockers };
		} catch {
			// A transport/auth failure must not wedge the save; the server gate is
			// the authority and the candidate's own session will surface its 409.
		}
	}

	const committedFacultyIds: number[] = [];
	for (const draft of deps.drafts) {
		try {
			await deps.api.put(`/faculty-assignments/${draft.facultyId}`, {
				schoolId: deps.schoolId,
				schoolYearId: deps.schoolYearId,
				version: draft.version,
				facultyId: draft.facultyId,
				assignments: draft.assignments,
			});
			committedFacultyIds.push(draft.facultyId);
		} catch (error) {
			return { status: 'failed', committedFacultyIds, failedFacultyId: draft.facultyId, error };
		}
	}
	return { status: 'committed', committedFacultyIds };
}
