/**
 * TT-SHAPE-DIAGNOSTIC-C02 — read-only timetable shape and policy contract.
 *
 * This module consumes the already-derived demand, ordered term authority,
 * canonical class-program rows, and scheduler output. It never derives a
 * second demand model and never writes. A diagnostic blocker is returned for
 * every missing or contradictory prerequisite so an empty schedule cannot be
 * mistaken for readiness.
 */

export type TimetableShapePolicyBlockerCode =
	| 'TERM_CACHE_MISSING'
	| 'TERM_AUTHORITY_STALE'
	| 'TERM_ORDER_INVALID'
	| 'SHIFT_WINDOW_MISSING'
	| 'SHIFT_WINDOW_INVALID'
	| 'CANONICAL_SLOTS_MISSING'
	| 'ROOMS_MISSING'
	| 'NON_SCHEDULABLE_SUBJECT_DEMAND'
	| 'FLAG_CEREMONY_SCOPE_INVALID'
	| 'ROTATION_TERM_INVALID'
	| 'OUTPUT_SHAPE_MISMATCH'
	| 'TERM_TEACHER_UNRESOLVED';

export interface TimetableShapePolicyBlocker {
	code: TimetableShapePolicyBlockerCode;
	message: string;
	entity: string;
	termIdentity: string | null;
	sectionId: number | null;
	subjectId: number | null;
	owningSurface: string;
}

export interface ShapeTerm {
	identity: string;
	order: number;
}

export interface ShapeSlot {
	startTime: string;
	endTime: string;
	rowKind: string;
	dayOfWeek?: string | null;
	subjectFamily?: string | null;
}

export interface ShapeDemandLine {
	sectionExternalId: number;
	subjectId: number;
	subjectCode: string;
	termIdentity: string;
	termIndex: number;
	rotationFamily: string | null;
}

export interface ShapeScheduleEntry {
	entryId?: string;
	sectionId: number;
	facultyId: number | null;
	roomId: number;
	subjectId: number;
	termIndex: number;
	startTime: string;
	endTime: string;
}

export interface ShapeOutputProjection {
	section: Array<{ key: string }>;
	teacher: Array<{ key: string }>;
	room: Array<{ key: string }>;
}

export interface TimetableShapePolicyInput {
	termAuthority: {
		format?: 'TRIMESTER' | 'QUARTERS';
		terms: ShapeTerm[];
		cachedAt?: string | Date | null;
		stale?: boolean;
		persistedRevision?: string | null;
		expectedRevision?: string | null;
	};
	validateShiftWindows?: boolean;
	shiftWindows: Array<{ gradeLevel: number; programType: string; startTime: string; endTime: string }>;
	sections: Array<{ id: number; gradeLevel: number; programType: string }>;
	shapes: Array<{ gradeLevel: number; programType: string; periodLengthMinutes: number; periodsPerDay: number; canonicalSlots?: ShapeSlot[] }>;
	rooms: Array<{ id: number; isTeachingSpace?: boolean }>;
	subjects: Array<{ id: number; code: string; schedulingDisposition?: string }>;
	demandLines?: ShapeDemandLine[];
	entries?: ShapeScheduleEntry[];
	outputProjections?: ShapeOutputProjection;
	flagCeremony?: { enabled: boolean; dayOfWeek?: string | null; startTime: string; endTime: string } | null;
}

function blocker(
	code: TimetableShapePolicyBlockerCode,
	message: string,
	entity: string,
	options: Partial<Pick<TimetableShapePolicyBlocker, 'termIdentity' | 'sectionId' | 'subjectId'>> = {},
): TimetableShapePolicyBlocker {
	return {
		code,
		message,
		entity,
		termIdentity: options.termIdentity ?? null,
		sectionId: options.sectionId ?? null,
		subjectId: options.subjectId ?? null,
		owningSurface: 'Timetable shape and policy',
	};
}

function minutes(value: string): number {
	const [hours, mins] = value.split(':').map(Number);
	return hours * 60 + mins;
}

function normalizedProgram(value: string | null | undefined): string {
	return (value ?? 'REGULAR').trim().toUpperCase() || 'REGULAR';
}

export function validateOrderedTermAuthority(authority: TimetableShapePolicyInput['termAuthority']): TimetableShapePolicyBlocker[] {
	const blockers: TimetableShapePolicyBlocker[] = [];
	if (!authority || !authority.cachedAt || authority.terms.length === 0) {
		return [blocker('TERM_CACHE_MISSING', 'No cached verified ordered-term authority is available.', 'Ordered term authority')];
	}
	if (authority.stale === true || (authority.persistedRevision && authority.expectedRevision && authority.persistedRevision !== authority.expectedRevision)) {
		blockers.push(blocker('TERM_AUTHORITY_STALE', 'The cached term authority is stale relative to the verified source revision.', 'Ordered term authority'));
	}
	const terms = [...authority.terms].sort((a, b) => a.order - b.order);
	const expectedCount = authority.format === 'QUARTERS' ? 4 : authority.format === 'TRIMESTER' ? 3 : null;
	if (expectedCount !== null && terms.length !== expectedCount) {
		blockers.push(blocker('TERM_ORDER_INVALID', `${authority.format} authority must expose exactly ${expectedCount} ordered terms; received ${terms.length}.`, 'Ordered term authority'));
	}
	const valid = terms.every((term, index) => term.order === index + 1 && term.identity.trim().length > 0)
		&& new Set(terms.map((term) => term.identity.trim().toUpperCase())).size === terms.length;
	if (!valid) {
		blockers.push(blocker('TERM_ORDER_INVALID', 'Ordered terms must have unique identities and contiguous order values beginning at 1.', 'Ordered term authority'));
	}
	return blockers;
}

export function validateTimetableShapePolicy(input: TimetableShapePolicyInput): TimetableShapePolicyBlocker[] {
	const blockers = validateOrderedTermAuthority(input.termAuthority);
	const terms = [...(input.termAuthority?.terms ?? [])].sort((a, b) => a.order - b.order);
	const termByIdentity = new Map(terms.map((term) => [term.identity, term]));
	const subjectById = new Map(input.subjects.map((subject) => [subject.id, subject]));

	if (input.rooms.filter((room) => room.isTeachingSpace !== false).length === 0) {
		blockers.push(blocker('ROOMS_MISSING', 'No teaching rooms are available for timetable placement.', 'Teaching rooms'));
	}

	for (const section of input.sections) {
		const programType = normalizedProgram(section.programType);
		const window = input.shiftWindows.find((candidate) => candidate.gradeLevel === section.gradeLevel && normalizedProgram(candidate.programType) === programType)
			?? input.shiftWindows.find((candidate) => candidate.gradeLevel === section.gradeLevel && normalizedProgram(candidate.programType) === 'ALL');
		if (input.validateShiftWindows !== false && !window) {
			blockers.push(blocker('SHIFT_WINDOW_MISSING', `No shift window covers Grade ${section.gradeLevel} ${programType}.`, `Grade ${section.gradeLevel} ${programType}`, { sectionId: section.id }));
		}
		if (window && minutes(window.startTime) >= minutes(window.endTime)) {
			blockers.push(blocker('SHIFT_WINDOW_INVALID', `Shift window ${window.startTime}-${window.endTime} is not an increasing time range.`, `Grade ${section.gradeLevel} ${programType}`, { sectionId: section.id }));
		}
		const shape = input.shapes.find((candidate) => candidate.gradeLevel === section.gradeLevel && normalizedProgram(candidate.programType) === programType);
		if (!shape || !shape.canonicalSlots || shape.canonicalSlots.filter((slot) => slot.rowKind === 'CLASS').length === 0) {
			blockers.push(blocker('CANONICAL_SLOTS_MISSING', `No canonical CLASS rows cover Grade ${section.gradeLevel} ${programType}.`, `Grade ${section.gradeLevel} ${programType}`, { sectionId: section.id }));
			continue;
		}
		for (const slot of shape.canonicalSlots) {
			if (slot.rowKind === 'CLASS' && minutes(slot.endTime) - minutes(slot.startTime) !== shape.periodLengthMinutes) {
				blockers.push(blocker('SHIFT_WINDOW_INVALID', `CLASS row ${slot.startTime}-${slot.endTime} does not match the ${shape.periodLengthMinutes}-minute period contract.`, `Grade ${section.gradeLevel} ${programType}`, { sectionId: section.id }));
			}
		}
		const classRows = shape.canonicalSlots.filter((slot) => slot.rowKind === 'CLASS');
		if (shape.periodsPerDay !== classRows.length) {
			blockers.push(blocker('OUTPUT_SHAPE_MISMATCH', `Shape declares ${shape.periodsPerDay} periods but exposes ${classRows.length} CLASS rows.`, `Grade ${section.gradeLevel} ${programType}`, { sectionId: section.id }));
		}
	}

	if (input.flagCeremony?.enabled && input.flagCeremony.dayOfWeek?.toUpperCase() !== 'MONDAY') {
		blockers.push(blocker('FLAG_CEREMONY_SCOPE_INVALID', 'Flag ceremony is restricted to Monday and cannot be represented as a five-day teaching block.', 'Flag ceremony'));
	}

	for (const line of input.demandLines ?? []) {
		const subject = subjectById.get(line.subjectId);
		if ((subject && /^(HG|ARAL)$/i.test(subject.code)) || /^(HG|ARAL)$/i.test(line.subjectCode)) {
			blockers.push(blocker('NON_SCHEDULABLE_SUBJECT_DEMAND', `${line.subjectCode} is reference/non-demand and must not create timetable demand.`, `Demand ${line.subjectCode} · section ${line.sectionExternalId}`, { sectionId: line.sectionExternalId, subjectId: line.subjectId, termIdentity: line.termIdentity }));
		}
		const term = termByIdentity.get(line.termIdentity);
		if (!term || term.order !== line.termIndex) {
			blockers.push(blocker('ROTATION_TERM_INVALID', `Demand line term ${line.termIdentity}/${line.termIndex} is outside the ordered term authority.`, `Demand ${line.subjectCode} · section ${line.sectionExternalId}`, { sectionId: line.sectionExternalId, subjectId: line.subjectId, termIdentity: line.termIdentity }));
		}
	}

	for (const entry of input.entries ?? []) {
		const section = input.sections.find((candidate) => candidate.id === entry.sectionId);
		const shape = section && input.shapes.find((candidate) => candidate.gradeLevel === section.gradeLevel && normalizedProgram(candidate.programType) === normalizedProgram(section.programType));
		const slot = shape?.canonicalSlots?.find((candidate) => candidate.startTime === entry.startTime && candidate.endTime === entry.endTime);
		if (!slot || slot.rowKind !== 'CLASS') {
			blockers.push(blocker('OUTPUT_SHAPE_MISMATCH', `Entry ${entry.startTime}-${entry.endTime} is not a CLASS row for its section shift.`, `Entry ${entry.entryId ?? `${entry.sectionId}:${entry.subjectId}`}`, { sectionId: entry.sectionId, subjectId: entry.subjectId }));
		}
		if (!termByIdentityHasOrder(terms, entry.termIndex)) {
			blockers.push(blocker('ROTATION_TERM_INVALID', `Entry term index ${entry.termIndex} is outside the ordered term authority.`, `Entry ${entry.entryId ?? `${entry.sectionId}:${entry.subjectId}`}`, { sectionId: entry.sectionId, subjectId: entry.subjectId }));
		}
	}

	if (input.outputProjections) {
		const sets = [input.outputProjections.section, input.outputProjections.teacher, input.outputProjections.room].map((rows) => new Set(rows.map((row) => row.key)));
		const [first, ...rest] = sets;
		if (rest.some((set) => set.size !== first.size || [...first].some((key) => !set.has(key)))) {
			blockers.push(blocker('OUTPUT_SHAPE_MISMATCH', 'Section, teacher, and room projections do not contain the same entry identities.', 'Schedule output projections'));
		}
	}

	return blockers;
}

function termByIdentityHasOrder(terms: ShapeTerm[], order: number): boolean {
	return terms.some((term) => term.order === order);
}

/**
 * A rotating subject may resolve to a different faculty member in each term;
 * this validator only requires one explicit teacher per demand term and never
 * collapses the resolution to a year-wide teacher.
 */
export function validateTermTeacherResolution(lines: Array<{ subjectId: number; sectionId: number; termIndex: number; facultyId?: number | null }>): TimetableShapePolicyBlocker[] {
	const blockers: TimetableShapePolicyBlocker[] = [];
	for (const line of lines) {
		if (!Number.isInteger(line.facultyId) || (line.facultyId ?? 0) <= 0) {
			blockers.push(blocker('TERM_TEACHER_UNRESOLVED', `No teacher is resolved for subject ${line.subjectId}, section ${line.sectionId}, term ${line.termIndex}.`, `Term teacher ${line.subjectId}:${line.sectionId}:${line.termIndex}`, { sectionId: line.sectionId, subjectId: line.subjectId, termIdentity: `T${line.termIndex}` }));
		}
	}
	return blockers;
}

export function validateOutputShapeParity(projections: ShapeOutputProjection): TimetableShapePolicyBlocker[] {
	return validateTimetableShapePolicy({
		termAuthority: { terms: [{ identity: 'T1', order: 1 }, { identity: 'T2', order: 2 }, { identity: 'T3', order: 3 }], cachedAt: 'contract' },
		shiftWindows: [], sections: [], shapes: [], rooms: [{ id: 1 }], subjects: [], outputProjections: projections,
	});
}
