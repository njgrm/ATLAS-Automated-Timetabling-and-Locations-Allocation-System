import { matchesOwnershipDepartment } from '@/lib/faculty-assignment-helpers';
import type { FacultyMirror, ManualEditBatchPreviewResult, ManualEditProposal, ScheduledEntry, Subject, TeachingLoadRepairChange } from '@/types';

export function facultyDisplayName(faculty: FacultyMirror): string {
	return `${faculty.lastName}, ${faculty.firstName}`;
}

export function ancillaryCreditHours(faculty: FacultyMirror): number {
	const rawMinutes = (faculty as FacultyMirror & { ancillaryMinutesPerWeek?: number | null }).ancillaryMinutesPerWeek;
	return typeof rawMinutes === 'number' && Number.isFinite(rawMinutes) ? rawMinutes / 60 : 0;
}

export function getFacultySubjectIds(faculty: FacultyMirror): Set<number> {
	return new Set((faculty.facultySubjects ?? []).map((assignment) => assignment.subjectId));
}

export function isEligibleFaculty(faculty: FacultyMirror, subject: Subject | undefined, selectedEntry: ScheduledEntry): boolean {
	if (!faculty.isActiveForScheduling) return false;
	if (faculty.id === selectedEntry.facultyId) return true;
	if (!subject) return false;
	if (getFacultySubjectIds(faculty).has(subject.id)) return true;
	if (matchesOwnershipDepartment(faculty.department, subject)) return true;
	return Boolean(faculty.canTeachOutsideDepartment && subject.allowedSpecializations?.includes(faculty.specialization ?? ''));
}

export function projectEntryFaculty(
	entry: ScheduledEntry,
	sandboxFacultyByEntryId: Map<string, number>,
	selectedEntryId: string | null,
	previewFacultyId: number | null,
	bulkEntryIds: Set<string>,
): ScheduledEntry {
	const committedOverride = sandboxFacultyByEntryId.get(entry.entryId);
	if (committedOverride != null) return { ...entry, facultyId: committedOverride };
	if (previewFacultyId != null && selectedEntryId && (entry.entryId === selectedEntryId || bulkEntryIds.has(entry.entryId))) {
		return { ...entry, facultyId: previewFacultyId };
	}
	return entry;
}

export function teachingHoursForFaculty(entries: ScheduledEntry[], facultyId: number): number {
	const minutes = entries.reduce((total, entry) => entry.facultyId === facultyId ? total + entry.durationMinutes : total, 0);
	return Math.round((minutes / 60) * 10) / 10;
}

export function buildFacultyTeachingMinuteIndex(
	entries: ScheduledEntry[],
	sandboxFacultyByEntryId: Map<string, number>,
): Map<number, number> {
	const minutesByFaculty = new Map<number, number>();
	for (const entry of entries) {
		const facultyId = sandboxFacultyByEntryId.get(entry.entryId) ?? entry.facultyId;
		if (facultyId == null) continue;
		minutesByFaculty.set(facultyId, (minutesByFaculty.get(facultyId) ?? 0) + entry.durationMinutes);
	}
	return minutesByFaculty;
}

export function projectedTeachingHoursForFaculty(
	facultyId: number,
	baseMinutesByFaculty: Map<number, number>,
	entriesById: Map<string, ScheduledEntry>,
	targetEntryIds: string[],
	targetFacultyId: number,
	sandboxFacultyByEntryId: Map<string, number>,
): number {
	let minutes = baseMinutesByFaculty.get(facultyId) ?? 0;
	for (const entryId of targetEntryIds) {
		const entry = entriesById.get(entryId);
		if (!entry) continue;
		const currentFacultyId = sandboxFacultyByEntryId.get(entry.entryId) ?? entry.facultyId;
		if (currentFacultyId === facultyId) minutes -= entry.durationMinutes;
		if (targetFacultyId === facultyId) minutes += entry.durationMinutes;
	}
	return Math.round((Math.max(0, minutes) / 60) * 10) / 10;
}

export function formatHours(value: number): string {
	return `${Math.round(value * 10) / 10}h`;
}

export function reviewStatusCopy(preview: ManualEditBatchPreviewResult | null, canCommitPreview: boolean): string {
	if (!preview) return 'Preview checks conflicts before save.';
	if (canCommitPreview) return 'Ready to save. No blocking schedule conflict was found.';
	return 'Choose a different teacher or remove blocked rows, then review again.';
}

export function previewErrorCopy(error: unknown): string {
	const response = (error as { response?: { data?: { code?: string; message?: string } } })?.response?.data;
	if (response?.code === 'COHORT_REPAIR_UNSUPPORTED') {
		return 'This class is part of a grouped or special-program coverage block. Use section coverage repair before changing Teaching Load from the timetable.';
	}
	if (response?.code === 'VERSION_CONFLICT') {
		return 'This schedule changed while the panel was open. Refresh schedule, review the class again, then preview.';
	}
	if (response?.code === 'FACULTY_VERSION_CONFLICT') {
		return 'Teaching Load changed while the panel was open. Refresh schedule, review the teacher, then preview.';
	}
	if (response?.code === 'RUN_ALREADY_PUBLISHED') {
		return 'This schedule is already published. Create a timetable revision instead of rewriting Teaching Load.';
	}
	return response?.message ?? (error instanceof Error ? error.message : 'Preview could not run. Check the selected class and try again.');
}

export function compactLoadStatus(candidate: { overCapHours: number; toCapHours: number }): 'Under load' | 'Near limit' | 'Over limit' {
	if (candidate.overCapHours > 0) return 'Over limit';
	if (candidate.toCapHours <= 2) return 'Near limit';
	return 'Under load';
}

export function buildFacultyChangeProposals(entries: ScheduledEntry[], sandboxFacultyByEntryId: Map<string, number>): ManualEditProposal[] {
	const proposals: ManualEditProposal[] = [];
	for (const entry of entries) {
		const facultyId = sandboxFacultyByEntryId.get(entry.entryId);
		if (facultyId == null || facultyId === entry.facultyId) continue;
		proposals.push({
			editType: 'CHANGE_FACULTY',
			entryId: entry.entryId,
			targetFacultyId: facultyId,
		});
	}
	return proposals;
}

export function findCanonicalOwner(subjectId: number | null, sectionId: number | null, facultyMap: Map<number, FacultyMirror>): FacultyMirror | null {
	if (!subjectId || !sectionId) return null;
	for (const faculty of facultyMap.values()) {
		const ownsEntry = (faculty.facultySubjects ?? []).some((assignment) =>
			assignment.subjectId === subjectId && (assignment.sectionIds ?? []).includes(sectionId),
		);
		if (ownsEntry) return faculty;
	}
	return null;
}

export function buildTeachingLoadRepairProposals(
	entries: ScheduledEntry[],
	proposals: ManualEditProposal[],
	canonicalOnlyTargets: Map<string, number>,
): ManualEditProposal[] {
	const entriesById = new Map(entries.map((entry) => [entry.entryId, entry]));
	const stagedEntryIds = new Set<string>();
	const changes: ManualEditProposal[] = [...proposals];

	for (const proposal of proposals) {
		if (proposal.editType !== 'CHANGE_FACULTY' || !proposal.entryId || typeof proposal.targetFacultyId !== 'number') continue;
		stagedEntryIds.add(proposal.entryId);
	}

	for (const [entryId, targetFacultyId] of canonicalOnlyTargets.entries()) {
		if (stagedEntryIds.has(entryId)) continue;
		const entry = entriesById.get(entryId);
		if (!entry || entry.facultyId == null || entry.facultyId !== targetFacultyId) continue;
		changes.push({
			editType: 'CHANGE_FACULTY',
			entryId,
			targetFacultyId,
		});
	}

	return changes;
}

export function buildEntryRepairChanges(entries: ScheduledEntry[], proposals: ManualEditProposal[], canonicalOnlyTargets: Map<string, number>): TeachingLoadRepairChange[] {
	const entriesById = new Map(entries.map((entry) => [entry.entryId, entry]));
	const seen = new Set<string>();
	return [...proposals, ...Array.from(canonicalOnlyTargets.entries()).map(([entryId, targetFacultyId]) => ({ editType: 'CHANGE_FACULTY' as const, entryId, targetFacultyId }))]
		.flatMap((proposal) => {
			if (proposal.editType !== 'CHANGE_FACULTY' || !proposal.entryId || typeof proposal.targetFacultyId !== 'number') return [];
			if (seen.has(proposal.entryId)) return [];
			seen.add(proposal.entryId);
			const entry = entriesById.get(proposal.entryId);
			if (!entry) return [];
			return [{
				kind: 'ENTRY' as const,
				entryId: entry.entryId,
				subjectId: entry.subjectId,
				sectionId: entry.sectionId,
				fromFacultyId: entry.facultyId,
				toFacultyId: proposal.targetFacultyId,
			}];
		});
}

export function revisionDateError(value: string): string | null {
	if (!value.trim()) return 'Choose the first school day when this revision should take effect.';
	const parsed = new Date(`${value}T00:00:00Z`);
	if (Number.isNaN(parsed.getTime())) return 'Enter a valid effective date.';

	const now = new Date();
	const todayUtc = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
	const selectedUtc = Date.UTC(parsed.getUTCFullYear(), parsed.getUTCMonth(), parsed.getUTCDate());
	if (selectedUtc <= todayUtc) return 'Choose tomorrow or a later school day. Same-day published revisions are not allowed.';
	return null;
}

export function formatSlot(entry: ScheduledEntry, formatTimeValue: (value: string) => string): string {
	return `${entry.day} ${formatTimeValue(entry.startTime)}-${formatTimeValue(entry.endTime)}`;
}

/* ------------------------------------------------------------------------- *
 * TT-TL-MODULES-C04 — focused Teaching Load mini-module helpers.
 *
 * These are pure, testable controls for the non-D1 modules reachable from the
 * Simple-first Timetable workspace. They never duplicate the canonical Teaching
 * Load editor or invent server authority: every one either builds a request the
 * canonical endpoint already accepts, gates a dispatch, or maps a canonical
 * typed refusal to truthful operator copy.
 * ------------------------------------------------------------------------- */

/** Class 5 (availability) is deferred on decision D1; no availability authority
 * exists to consume, so owned surfaces must state that plainly instead of
 * inventing a repair. */
export const AVAILABILITY_MODULE_DEFERRED_COPY =
	'Availability-driven moves are deferred: ATLAS has no persisted faculty availability authority yet, so no availability repair is offered here.';

/**
 * R8(d): the scope identity every bound repair state is keyed to. When the
 * school, year, or run changes, consumers must clear their staged/preview/
 * module state before any action can dispatch.
 */
export function workspaceScopeKey(scope: {
	schoolId: number | null | undefined;
	schoolYearId: number | null | undefined;
	runId: number | null | undefined;
}): string {
	return `${scope.schoolId ?? 'none'}:${scope.schoolYearId ?? 'none'}:${scope.runId ?? 'none'}`;
}

/**
 * TT-TL-MODULES-C04R1 (F1) — truthful departure-repair copy.
 *
 * Decision D1 defers persisted faculty availability, so there is no absence
 * window to capture. An unpublished run reassigns the affected classes of the
 * current generated run only. A published run changes nothing until an
 * effective-dated revision, and that revision effective date is the sole
 * temporal authority — the client must never imply an end-date reversion.
 */
export function describeDepartureRepairTruth(isPublished: boolean, affectedClassCount: number): string {
	const count = Number.isFinite(affectedClassCount) && affectedClassCount > 0 ? Math.floor(affectedClassCount) : 0;
	if (isPublished) {
		// LANE-C POST-PUBLISH-C01: same contract in plain words — the published
		// schedule is never rewritten, the change starts only on the chosen date,
		// and nothing reverts on an end date.
		return 'This schedule is published and stays as it is. The change takes effect only from the start date you choose; earlier dates keep the current schedule, and it does not switch back on its own.';
	}
	return `This reassigns ${count} affected class${count === 1 ? '' : 'es'} for the current generated run only. It records no absence period and does not schedule a future reversion.`;
}

/**
 * Canonical typed refusals a Timetable Teaching Load repair can return, mapped
 * to truthful inline copy. Unknown codes fall through to the server message so
 * nothing is silently swallowed.
 */
const CANONICAL_REFUSAL_COPY: Record<string, string> = {
	TEACHING_LOAD_QUALIFICATION_MISSING:
		'The selected teacher is not qualified for this subject through department, program, or specialization authority. Choose a qualified receiver, or grant authority first.',
	TEACHING_LOAD_REPAIR_STALE:
		'A covered setup input changed after this repair was reviewed. Nothing was saved; refresh the timetable and preview again.',
	FACULTY_VERSION_CONFLICT:
		'Teaching Load changed while this repair was staged. Nothing was saved; refresh the teacher record and review again.',
	RUN_ALREADY_PUBLISHED:
		'This schedule is already published. Create an effective-date revision instead of rewriting Teaching Load.',
	HARD_VIOLATION_BLOCK:
		'The repair would create a hard timetable conflict. Nothing was saved; change the receiver or placement and review again.',
	SOFT_OVERRIDE_REQUIRED:
		'The repair carries warnings that must be acknowledged before saving.',
	VERSION_CONFLICT:
		'This timetable changed while the repair was staged. Nothing was saved; refresh and review again.',
	COHORT_REPAIR_UNSUPPORTED:
		'This class is part of a grouped or special-program coverage block. Use section coverage repair before changing Teaching Load from the timetable.',
};

export type CanonicalRefusal = { code: string; message: string };

export function refusalCopy(code: string | null | undefined, fallbackMessage?: string | null): string {
	if (code && CANONICAL_REFUSAL_COPY[code]) return CANONICAL_REFUSAL_COPY[code];
	if (fallbackMessage && fallbackMessage.trim()) return fallbackMessage;
	return 'ATLAS refused the repair. Nothing was saved.';
}

/** Extract the canonical typed refusal from an axios-shaped error. */
export function canonicalRefusalFromError(error: unknown): CanonicalRefusal {
	const response = (error as { response?: { data?: { code?: unknown; message?: unknown } } })?.response?.data;
	const code = typeof response?.code === 'string' ? response.code : null;
	const message = typeof response?.message === 'string' ? response.message : null;
	return { code: code ?? 'UNKNOWN', message: refusalCopy(code, message) };
}

/* ------------------------------------------------------------------------- *
 * Overload / underload redistribution summary.
 * The Teaching Load page stays the canonical home; the Timetable card is
 * read-only and must never dispatch an apply.
 * ------------------------------------------------------------------------- */

export type RedistributionRequest = {
	schoolId: number;
	schoolYearId: number;
	previewOnly: true;
};

export type RedistributionSummary = {
	overCapCount: number;
	proposedMoveCount: number;
	movesApplied: number;
	sectionsResolved: number;
	evaluated: boolean;
	candidateRejectionCount: number;
	derivedDemandRevision: string | null;
};

export type ReadinessSummary = {
	ready: boolean;
	demandCount: number;
	ownedDemandCount: number;
	unresolvedDemandCount: number;
	blockerCodes: string[];
};

/**
 * A dispatch is allowed only when the authenticated scope is fully resolved.
 * Missing school/year must dispatch ZERO requests rather than defaulting to a
 * pilot school or year.
 */
export function redistributeDispatchAllowed(scope: { schoolId: number | null | undefined; schoolYearId: number | null | undefined }): boolean {
	return Number.isInteger(scope.schoolId) && (scope.schoolId ?? 0) > 0
		&& Number.isInteger(scope.schoolYearId) && (scope.schoolYearId ?? 0) > 0;
}

/**
 * Builds the canonical read-only redistribution preview request. It can only
 * ever emit `previewOnly: true`; there is no apply variant.
 */
export function buildRedistributionRequest(
	scope: { schoolId: number | null | undefined; schoolYearId: number | null | undefined },
): RedistributionRequest | null {
	if (!redistributeDispatchAllowed(scope)) return null;
	return { schoolId: scope.schoolId as number, schoolYearId: scope.schoolYearId as number, previewOnly: true };
}

export function summarizeRedistribution(payload: unknown): RedistributionSummary | null {
	if (!payload || typeof payload !== 'object' || Array.isArray(payload)) return null;
	const record = payload as Record<string, unknown>;
	const count = (value: unknown): number => (Array.isArray(value) ? value.length : 0);
	return {
		overCapCount: count(record.overCapFaculty),
		proposedMoveCount: count(record.proposedMoves),
		movesApplied: typeof record.movesApplied === 'number' ? record.movesApplied : 0,
		sectionsResolved: typeof record.sectionsResolved === 'number' ? record.sectionsResolved : 0,
		evaluated: record.evaluated === true,
		candidateRejectionCount: count(record.candidateRejections),
		derivedDemandRevision: typeof record.derivedDemandRevision === 'string' ? record.derivedDemandRevision : null,
	};
}

export function summarizeReadiness(payload: unknown): ReadinessSummary | null {
	if (!payload || typeof payload !== 'object' || Array.isArray(payload)) return null;
	const record = payload as Record<string, unknown>;
	const blockers = Array.isArray(record.blockers)
		? record.blockers.flatMap((entry) => {
			if (!entry || typeof entry !== 'object') return [];
			const code = (entry as Record<string, unknown>).code;
			return typeof code === 'string' ? [code] : [];
		})
		: [];
	return {
		ready: record.ready === true,
		demandCount: typeof record.demandCount === 'number' ? record.demandCount : 0,
		ownedDemandCount: typeof record.ownedDemandCount === 'number' ? record.ownedDemandCount : 0,
		unresolvedDemandCount: typeof record.unresolvedDemandCount === 'number' ? record.unresolvedDemandCount : 0,
		blockerCodes: blockers,
	};
}

/**
 * Truthful one-line status for the redistribution card, derived only from the
 * canonical read-only response. Never recomputes load authority client-side.
 */
export function describeRedistributionStatus(summary: RedistributionSummary | null, readiness: ReadinessSummary | null): string {
	if (!summary && !readiness) return 'Redistribution summary unavailable for this school year.';
	const parts: string[] = [];
	if (summary) {
		if (!summary.evaluated) parts.push('No persisted workload policy was resolved, so redistribution was not evaluated.');
		else {
			parts.push(`${summary.overCapCount} over cap`);
			parts.push(`${summary.proposedMoveCount} proposed move${summary.proposedMoveCount === 1 ? '' : 's'}`);
		}
		if (summary.candidateRejectionCount > 0) parts.push(`${summary.candidateRejectionCount} candidate rejection${summary.candidateRejectionCount === 1 ? '' : 's'}`);
	}
	if (readiness) {
		parts.push(`${readiness.ownedDemandCount}/${readiness.demandCount} demanded pairs owned`);
		if (readiness.unresolvedDemandCount > 0) parts.push(`${readiness.unresolvedDemandCount} unresolved`);
	}
	return parts.join(' · ');
}

export const REDISTRIBUTION_HOME_HREF = '/teaching-load';

/* ------------------------------------------------------------------------- *
 * Qualification / department / program authority module.
 * Preview is read-only; apply is blocked until the server issues a
 * fingerprint. The confirmation phrase is the server's, never invented here.
 * ------------------------------------------------------------------------- */

export type QualificationNodeInput = { key: string; value: string };

export type QualificationPreviewState = {
	/** The server-issued fingerprint; null before any successful preview. */
	fingerprint: string | null;
	expectedSourceRevision: unknown;
	/**
	 * TT-TL-MODULES-C04R1 (F3): the exact confirmation text the server preview
	 * returned. The client renders and requires this value; it never declares
	 * or hardcodes the phrase itself.
	 */
	confirmationText: string | null;
	conflicts: number;
	creates: number;
};

export type DepartmentAuthorityPreviewPayload = {
	schoolId: number;
	aliases: QualificationNodeInput[];
	labels: QualificationNodeInput[];
};

export type DepartmentAuthorityApplyPayload = DepartmentAuthorityPreviewPayload & {
	expectedFingerprint: string;
	expectedSourceRevision: unknown;
	confirmationText: string;
};

export function buildQualificationPreviewPayload(
	scope: { schoolId: number | null | undefined },
	aliases: QualificationNodeInput[],
	labels: QualificationNodeInput[],
): DepartmentAuthorityPreviewPayload | null {
	if (!Number.isInteger(scope.schoolId) || (scope.schoolId ?? 0) <= 0) return null;
	return {
		schoolId: scope.schoolId as number,
		aliases: aliases.filter((entry) => entry.key.trim() !== '' || entry.value.trim() !== ''),
		labels: labels.filter((entry) => entry.key.trim() !== '' || entry.value.trim() !== ''),
	};
}

/**
 * Apply requires the server-issued fingerprint from a successful preview, the
 * exact confirmation phrase the server advertises, and the preview's source
 * revision. Anything less returns null and dispatches nothing.
 */
export function buildQualificationApplyPayload(
	scope: { schoolId: number | null | undefined },
	aliases: QualificationNodeInput[],
	labels: QualificationNodeInput[],
	preview: QualificationPreviewState | null,
	confirmationText: string,
): DepartmentAuthorityApplyPayload | null {
	const base = buildQualificationPreviewPayload(scope, aliases, labels);
	if (!base) return null;
	if (!preview?.fingerprint) return null;
	// F3: the required phrase is the server-issued value from this preview.
	// There is no client-side phrase authority to drift from it.
	if (!preview.confirmationText) return null;
	if (confirmationText !== preview.confirmationText) return null;
	return {
		...base,
		expectedFingerprint: preview.fingerprint,
		expectedSourceRevision: preview.expectedSourceRevision ?? null,
		confirmationText,
	};
}

export function qualificationApplyEnabled(preview: QualificationPreviewState | null): boolean {
	return Boolean(preview?.fingerprint);
}

/** Canonical typed qualification/department-authority refusals -> truthful copy. */
const QUALIFICATION_REFUSAL_COPY: Record<string, string> = {
	FINGERPRINT_REQUIRED: 'Preview this qualification change first; the server must issue the fingerprint that authorizes apply.',
	CONFIRMATION_REQUIRED: 'Type the exact confirmation text the server preview returned to apply.',
	SOURCE_DRIFT: 'Department authority changed since the preview. Nothing was saved; preview again.',
	ACTOR_SCHOOL_REQUIRED: 'An authenticated operator school is required for this qualification change.',
	SCHOOL_MISMATCH: 'This qualification change belongs to a different school than your account.',
	INVALID_DEPARTMENT_AUTHORITY: 'Fix the highlighted alias or label before applying.',
};

export function qualificationRefusalCopy(code: string | null | undefined, fallbackMessage?: string | null): string {
	if (code && QUALIFICATION_REFUSAL_COPY[code]) return QUALIFICATION_REFUSAL_COPY[code];
	if (fallbackMessage && fallbackMessage.trim()) return fallbackMessage;
	return 'ATLAS refused the qualification change. Nothing was saved.';
}

export function buildQualificationNodes(rows: Array<{ key: string; value: string }>): QualificationNodeInput[] {
	return rows
		.map((row) => ({ key: row.key.trim(), value: row.value.trim() }))
		.filter((row) => row.key !== '' && row.value !== '');
}

/* -------------------------------------------------------------------------- *
 * F2 — bounded capability-override module (Timetable qualification entry).
 * The Timetable surface is a selected teacher/subject repair only: it previews
 * one capability override at a time against the active school year and applies
 * only with the server-issued fingerprint and server-issued confirmation text.
 * The Teaching Load page remains the canonical home for broad editing.
 * -------------------------------------------------------------------------- */

export type CapabilityOverrideDraft = {
	action: 'SET' | 'REMOVE';
	subjectCode: string;
	specializationCode: string;
	specializationLabel: string;
	note: string;
};

export type CapabilityOverridePreviewState = {
	fingerprint: string | null;
	expectedSourceRevision: unknown;
	confirmationText: string | null;
	changeAction: 'create' | 'update' | 'remove' | 'unchanged' | null;
	subjectCode: string | null;
	specializationCode: string | null;
	conflictCount: number;
};

export type CapabilityOverrideMutation = {
	action: 'SET' | 'REMOVE';
	facultyId: number;
	subjectCode: string | null;
	specializationCode: string | null;
	specializationLabel: string | null;
	note: string | null;
};

export function createEmptyCapabilityOverrideDraft(): CapabilityOverrideDraft {
	return { action: 'SET', subjectCode: '', specializationCode: '', specializationLabel: '', note: '' };
}

/** Null when no teacher is selected; dispatch stays zero until a target exists. */
export function buildCapabilityOverrideMutation(
	draft: CapabilityOverrideDraft,
	facultyId: number | null | undefined,
): CapabilityOverrideMutation | null {
	if (!Number.isInteger(facultyId) || (facultyId ?? 0) <= 0) return null;
	const subjectCode = draft.subjectCode.trim().toUpperCase();
	const specializationCode = draft.specializationCode.trim().toUpperCase();
	return {
		action: draft.action,
		facultyId: facultyId as number,
		subjectCode: subjectCode || null,
		specializationCode: specializationCode || null,
		specializationLabel: draft.specializationLabel.trim() || null,
		note: draft.note.trim() || null,
	};
}

export function capabilityOverrideApplyEnabled(preview: CapabilityOverridePreviewState | null): boolean {
	return Boolean(preview?.fingerprint && preview?.confirmationText);
}

/** Truthful one-line effect summary derived only from the server preview. */
export function describeCapabilityOverrideEffect(preview: CapabilityOverridePreviewState | null): string {
	if (!preview) return 'Preview shows the exact effect before anything is written.';
	const target = [preview.subjectCode ?? 'any subject', preview.specializationCode ?? 'any specialization'].join(' / ');
	const action = preview.changeAction === 'create'
		? 'will create'
		: preview.changeAction === 'update'
			? 'will update'
			: preview.changeAction === 'remove'
				? 'will remove'
				: 'is already current (no change)';
	return `Effect: ${action} a capability override for ${target}.`;
}

const CAPABILITY_OVERRIDE_REFUSAL_COPY: Record<string, string> = {
	INVALID_CAPABILITY_OVERRIDE: 'Choose SET or REMOVE and valid subject/specialization codes before previewing.',
	FINGERPRINT_MISMATCH: 'The capability-override preview no longer matches the source. Nothing was saved; preview again.',
	CAPABILITY_OVERRIDE_SOURCE_DRIFT: 'Capability-override inputs changed after preview. Nothing was saved; preview again.',
	CAPABILITY_OVERRIDE_CONFLICT: 'A concurrent capability-override change occurred. Nothing was saved; preview again.',
	CONFIRMATION_REQUIRED: 'Type the exact confirmation text the server preview returned to apply.',
	ACTOR_SCHOOL_REQUIRED: 'An authenticated operator school is required for this capability override.',
	SCHOOL_MISMATCH: 'This capability override belongs to a different school than your account.',
	ARCHIVED_YEAR_READ_ONLY: 'Archived school years are read-only; capability overrides cannot be changed.',
	INACTIVE_HISTORICAL_YEAR: 'Only the currently active school year can be changed for capability overrides.',
	ACTIVE_YEAR_UNAVAILABLE: 'No active, non-archived school year is available for capability overrides.',
	ACTIVE_YEAR_AMBIGUOUS: 'More than one active school year exists. Resolve school-year authority first.',
	YEAR_MIRROR_NOT_FOUND: 'No school-year mirror exists for this school and year.',
};

export function capabilityOverrideRefusalCopy(code: string | null | undefined, fallbackMessage?: string | null): string {
	if (code && CAPABILITY_OVERRIDE_REFUSAL_COPY[code]) return CAPABILITY_OVERRIDE_REFUSAL_COPY[code];
	if (fallbackMessage && fallbackMessage.trim()) return fallbackMessage;
	return 'ATLAS refused the capability override. Nothing was saved.';
}


export function buildRevisionPayloadChange(change: { entry: ScheduledEntry; targetFacultyId: number }) {
	const previous = {
		facultyId: change.entry.facultyId,
		roomId: change.entry.roomId,
		day: change.entry.day,
		startTime: change.entry.startTime,
		endTime: change.entry.endTime,
		subjectId: change.entry.subjectId,
		sectionId: change.entry.sectionId,
	};
	return {
		entryId: change.entry.entryId,
		changeType: 'CHANGE_FACULTY',
		previous,
		next: {
			...previous,
			facultyId: change.targetFacultyId,
		},
	};
}
