import { VIOLATION_CODES, VIOLATION_COPY, type Violation, type ViolationCode } from './constraint-validator.js';
import { getRunById } from './generation.service.js';
import { previewManualEdit, type ManualEditProposal, type PreviewResult } from './manual-edit.service.js';

export type ViolationRepairLocator = {
	code: ViolationCode;
	termIndex: 1 | 2 | 3 | 4;
	entryIds: string[];
	facultyId?: number;
	roomId?: number;
	sectionId?: number;
	subjectId?: number;
	day?: string;
	startTime?: string;
	endTime?: string;
};

type Run = Awaited<ReturnType<typeof getRunById>>;

function repairError(statusCode: number, code: string, message: string): Error & { statusCode: number; code: string } {
	return Object.assign(new Error(message), { statusCode, code });
}

function positiveIdentity(value: unknown): value is number {
	return typeof value === 'number' && Number.isSafeInteger(value) && value > 0;
}

export function parseViolationRepairLocator(value: unknown): ViolationRepairLocator | null {
	if (value === null || typeof value !== 'object' || Array.isArray(value)) return null;
	const body = value as Record<string, unknown>;
	if (typeof body.code !== 'string' || !(VIOLATION_CODES as readonly string[]).includes(body.code)) return null;
	if (typeof body.termIndex !== 'number' || !Number.isInteger(body.termIndex) || body.termIndex < 1 || body.termIndex > 4) return null;
	if (!Array.isArray(body.entryIds) || body.entryIds.some((id) => typeof id !== 'string' || id.trim() === '')) return null;
	const ids = body.entryIds as string[];
	if (new Set(ids).size !== ids.length) return null;
	for (const key of ['facultyId', 'roomId', 'sectionId', 'subjectId'] as const) {
		if (body[key] !== undefined && !positiveIdentity(body[key])) return null;
	}
	for (const key of ['day', 'startTime', 'endTime'] as const) {
		if (body[key] !== undefined && (typeof body[key] !== 'string' || body[key].trim() === '')) return null;
	}
	if (ids.length === 0 && !['facultyId', 'roomId', 'sectionId', 'subjectId', 'day', 'startTime', 'endTime'].some((key) => body[key] !== undefined)) return null;
	return {
		code: body.code as ViolationCode,
		termIndex: body.termIndex as 1 | 2 | 3 | 4,
		entryIds: [...ids].sort(),
		...(body.facultyId === undefined ? {} : { facultyId: body.facultyId as number }),
		...(body.roomId === undefined ? {} : { roomId: body.roomId as number }),
		...(body.sectionId === undefined ? {} : { sectionId: body.sectionId as number }),
		...(body.subjectId === undefined ? {} : { subjectId: body.subjectId as number }),
		...(body.day === undefined ? {} : { day: body.day as string }),
		...(body.startTime === undefined ? {} : { startTime: body.startTime as string }),
		...(body.endTime === undefined ? {} : { endTime: body.endTime as string }),
	};
}

function violationEntryIds(violation: Violation): string[] {
	return [...(violation.entities?.entryIds ?? [])].sort();
}

function matchesCanonicalLocator(violation: Violation, locator: ViolationRepairLocator): boolean {
	if (violation.code !== locator.code || violation.meta?.termIndex !== locator.termIndex) return false;
	const canonicalIds = violationEntryIds(violation);
	if (canonicalIds.length !== locator.entryIds.length || canonicalIds.some((id, index) => id !== locator.entryIds[index])) return false;
	for (const key of ['facultyId', 'roomId', 'sectionId', 'subjectId', 'day', 'startTime', 'endTime'] as const) {
		if (locator[key] !== undefined && violation.entities?.[key] !== locator[key]) return false;
	}
	return true;
}

function candidateStillHasTarget(violation: Violation, locator: ViolationRepairLocator): boolean {
	if (violation.code !== locator.code) return false;
	for (const key of ['facultyId', 'roomId', 'sectionId', 'subjectId', 'day', 'startTime', 'endTime'] as const) {
		if (locator[key] !== undefined && violation.entities?.[key] !== locator[key]) return false;
	}
	if (locator.entryIds.length) {
		const remaining = new Set(violation.entities?.entryIds ?? []);
		return locator.entryIds.every((id) => remaining.has(id));
	}
	return true;
}

function hardViolationSignature(violation: Violation): string {
	return JSON.stringify({ code: violation.code, entities: violation.entities, termIndex: violation.meta?.termIndex });
}

function getTimeSlots(run: Run): Array<{ startTime: string; endTime: string }> {
	const summary = run.summary && typeof run.summary === 'object' && !Array.isArray(run.summary)
		? run.summary as Record<string, unknown>
		: {};
	const persisted = Array.isArray(summary.timetableDisplaySlots) ? summary.timetableDisplaySlots : [];
	const slots = persisted.flatMap((slot) => {
		if (!slot || typeof slot !== 'object' || Array.isArray(slot)) return [];
		const candidate = slot as Record<string, unknown>;
		if (candidate.isSpecialEvent === true || typeof candidate.startTime !== 'string' || typeof candidate.endTime !== 'string') return [];
		return [{ startTime: candidate.startTime, endTime: candidate.endTime }];
	});
	if (slots.length) return slots;
	const entries = Array.isArray(run.draftEntries) ? run.draftEntries as Array<Record<string, unknown>> : [];
	return [...new Map(entries.flatMap((entry) => typeof entry.startTime === 'string' && typeof entry.endTime === 'string'
		? [[`${entry.startTime}|${entry.endTime}`, { startTime: entry.startTime, endTime: entry.endTime }] as const]
		: [])).values()];
}

function optionId(proposal: ManualEditProposal): string {
	return [proposal.editType, proposal.entryId, proposal.targetDay, proposal.targetStartTime, proposal.targetEndTime].filter(Boolean).join(':');
}

function containsNewHardViolation(preRun: Violation[], preview: PreviewResult): boolean {
	const previous = new Set(preRun.filter((v) => v.severity === 'HARD').map(hardViolationSignature));
	return preview.hardViolations.some((violation) => !previous.has(hardViolationSignature(violation)));
}

function isPolicyFamily(code: ViolationCode): boolean {
	return code.startsWith('FACULTY_') && !['FACULTY_TIME_CONFLICT'].includes(code)
		|| code === 'FACULTY_SUBJECT_NOT_QUALIFIED'
		|| code === 'LACKING_FACULTY'
		|| code === 'SPECIALIZED_ROOM_UNAVAILABLE'
		|| code === 'INCOMPLETE_MODULAR_GROUP'
		|| code === 'SECTION_OVERCOMPRESSED';
}

export type RepairOption = {
	id: string;
	label: string;
	explanation: string;
	affectedEntryIds: string[];
	proposal: ManualEditProposal;
	projectedDelta: { targetIssuesBefore: number; targetIssuesAfter: number; hardBefore: number; hardAfter: number; softBefore: number; softAfter: number };
};

export async function getViolationRepairOptions(
	schoolId: number,
	schoolYearId: number,
	runId: number,
	locator: ViolationRepairLocator,
	dependencies: {
		loadRun: typeof getRunById;
		preview: typeof previewManualEdit;
		now: () => Date;
	} = { loadRun: getRunById, preview: previewManualEdit, now: () => new Date() },
) {
	const run = await dependencies.loadRun(runId, schoolId, schoolYearId);
	if (run.status !== 'COMPLETED') throw repairError(422, 'RUN_NOT_COMPLETED', 'Repair guidance is available only for a completed schedule.');
	const canonicalViolations = Array.isArray(run.violations) ? run.violations as unknown as Violation[] : [];
	const matches = canonicalViolations.filter((violation) => matchesCanonicalLocator(violation, locator));
	if (matches.length === 0) throw repairError(404, 'VIOLATION_NOT_FOUND', 'That issue is no longer present in this schedule. Refresh the issue list and try again.');
	if (matches.length > 1) throw repairError(409, 'AMBIGUOUS_VIOLATION', 'More than one saved issue matches this selection. Refresh the issue list before continuing.');
	const violation = matches[0];
	const entries = Array.isArray(run.draftEntries) ? run.draftEntries as Array<{
		entryId: string; sectionId: number; subjectId: number; facultyId: number | null; roomId: number; day: string; startTime: string; endTime: string; durationMinutes: number; termIndex?: number;
	}> : [];
	const affectedEntries = entries.filter((entry) => locator.entryIds.includes(entry.entryId));
	const copy = VIOLATION_COPY[violation.code];
	const slots = getTimeSlots(run);
	const days = ['MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY'];
	const proposals: ManualEditProposal[] = [];
	for (const entry of affectedEntries) {
		if (entry.termIndex !== locator.termIndex) continue;
		for (const day of days) {
			for (const slot of slots) {
				const duration = (time: string) => { const [h, m] = time.split(':').map(Number); return h * 60 + m; };
				if (duration(slot.endTime) - duration(slot.startTime) !== entry.durationMinutes) continue;
				if (day === entry.day && slot.startTime === entry.startTime && slot.endTime === entry.endTime) continue;
				proposals.push({ editType: 'CHANGE_TIMESLOT', entryId: entry.entryId, targetDay: day, targetStartTime: slot.startTime, targetEndTime: slot.endTime });
				if (proposals.length >= 48) break;
			}
			if (proposals.length >= 48) break;
		}
		if (proposals.length >= 48) break;
	}
	const options: RepairOption[] = [];
	const blockers = new Set<string>();
	for (const proposal of proposals) {
		let preview: PreviewResult;
		try {
			preview = await dependencies.preview(runId, schoolId, schoolYearId, proposal);
		} catch (error) {
			blockers.add(error instanceof Error ? error.message : 'The saved schedule could not validate this option.');
			continue;
		}
		if (containsNewHardViolation(canonicalViolations, preview)) {
			for (const conflict of preview.humanConflicts) if (conflict.severity === 'HARD') blockers.add(conflict.humanDetail);
			continue;
		}
		const after = [...preview.hardViolations, ...preview.softViolations];
		const stillPresent = after.some((candidate) => candidateStillHasTarget(candidate, locator));
		if (stillPresent || preview.violationDelta.hardAfter > preview.violationDelta.hardBefore) continue;
		const entry = affectedEntries.find((candidate) => candidate.entryId === proposal.entryId)!;
		options.push({
			id: optionId(proposal),
			label: `Move this session to ${proposal.targetDay!.toLowerCase()} ${proposal.targetStartTime}–${proposal.targetEndTime}`,
			explanation: `${copy.title}: this preview removes the selected issue without adding a hard conflict.`,
			affectedEntryIds: [entry.entryId],
			proposal,
			projectedDelta: {
				targetIssuesBefore: 1,
				targetIssuesAfter: 0,
				hardBefore: preview.violationDelta.hardBefore,
				hardAfter: preview.violationDelta.hardAfter,
				softBefore: preview.violationDelta.softBefore,
				softAfter: preview.violationDelta.softAfter,
			},
		});
	}
	options.sort((a, b) => (a.projectedDelta.softAfter - a.projectedDelta.softBefore) - (b.projectedDelta.softAfter - b.projectedDelta.softBefore)
		|| a.label.localeCompare(b.label));
	const ranked = options.slice(0, 3);
	return {
		violation: { code: violation.code, severity: violation.severity, message: violation.message, entities: violation.entities, meta: violation.meta },
		evidence: affectedEntries.map(({ entryId, sectionId, subjectId, facultyId, roomId, day, startTime, endTime, termIndex }) => ({ entryId, sectionId, subjectId, facultyId, roomId, day, startTime, endTime, termIndex })),
		status: ranked.length ? 'REPAIRABLE' as const : isPolicyFamily(violation.code) ? 'POLICY_CHANGE_REQUIRED' as const : 'NO_SAFE_REPAIR' as const,
		verifiedAt: dependencies.now().toISOString(),
		options: ranked,
		blockers: ranked.length ? [] : [...blockers].slice(0, 4).length ? [...blockers].slice(0, 4) : [copy.action || copy.meaning],
	};
}
