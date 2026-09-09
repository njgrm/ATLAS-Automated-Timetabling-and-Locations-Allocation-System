/** Pure invariant checks shared by timetable construction, validation/repair, and preview. */

export type CandidateInvariantReason =
	| 'INVALID_IDENTIFIER'
	| 'INVALID_INTERVAL'
	| 'HG_FORBIDDEN'
	| 'NON_TEACHING_ROOM'
	| 'ROOM_SCOPE_MISMATCH'
	| 'ROOM_TYPE_MISMATCH'
	| 'ROOM_CAPACITY_EXCEEDED'
	| 'FACULTY_TIME_CONFLICT'
	| 'SECTION_TIME_CONFLICT'
	| 'ROOM_TIME_CONFLICT';

export interface CandidateInterval {
	day: string;
	startTime: string;
	endTime: string;
}

export interface CandidateRoomInvariant {
	id: number;
	type: string;
	capacity: number | null;
	isTeachingSpace: boolean;
	isSharedFacility?: boolean;
	buildingGradeScope?: number[];
}

export interface TimetableCandidateInvariantInput extends CandidateInterval {
	facultyId: number;
	sectionId: number;
	roomId: number;
	subjectCode: string;
	enrolledCount: number;
	room: CandidateRoomInvariant;
	gradeLevel: number;
	allowedRoomTypes: string[];
	occupied?: Array<CandidateInterval & { facultyId: number; sectionId: number; roomId: number }>;
}

export interface CandidateInvariantVerdict {
	accepted: boolean;
	reasons: CandidateInvariantReason[];
}

const TIME_PATTERN = /^(?:[01]\d|2[0-3]):[0-5]\d$/;

export function timeToCandidateMinutes(value: string): number | null {
	if (!TIME_PATTERN.test(value)) return null;
	const [hours, minutes] = value.split(':').map(Number);
	return hours * 60 + minutes;
}

export function isValidCandidateIdentity(value: number): boolean {
	return Number.isInteger(value) && value > 0;
}

export function isValidCandidateInterval(interval: CandidateInterval): boolean {
	if (interval.day.trim().length === 0) return false;
	const start = timeToCandidateMinutes(interval.startTime);
	const end = timeToCandidateMinutes(interval.endTime);
	return start !== null && end !== null && start < end;
}

/** Half-open interval overlap: [start, end), scoped to the same day. */
export function intervalsOverlap(left: CandidateInterval, right: CandidateInterval): boolean {
	if (left.day !== right.day || !isValidCandidateInterval(left) || !isValidCandidateInterval(right)) return false;
	const leftStart = timeToCandidateMinutes(left.startTime) as number;
	const leftEnd = timeToCandidateMinutes(left.endTime) as number;
	const rightStart = timeToCandidateMinutes(right.startTime) as number;
	const rightEnd = timeToCandidateMinutes(right.endTime) as number;
	return leftStart < rightEnd && rightStart < leftEnd;
}

export function roomCanFitEnrollment(roomCapacity: number | null, enrolledCount: number): boolean {
	return roomCapacity == null || roomCapacity >= enrolledCount;
}

export function isRoomInTeachingScope(room: CandidateRoomInvariant, gradeLevel: number): boolean {
	if (!room.isTeachingSpace || room.isSharedFacility === true) return false;
	return isRoomGradeScopeCompatible(room, gradeLevel);
}

export function isRoomGradeScopeCompatible(room: Pick<CandidateRoomInvariant, 'buildingGradeScope'>, gradeLevel: number): boolean {
	const scope = room.buildingGradeScope ?? [];
	return scope.length === 0 || scope.includes(gradeLevel);
}

export function isHomeroomGuidanceCandidate(subjectCode: string | null | undefined): boolean {
	return (subjectCode ?? '').trim().toUpperCase() === 'HG';
}

export function evaluateCandidateInvariants(
	input: TimetableCandidateInvariantInput,
	options: { occupancyResources?: Array<'facultyId' | 'sectionId' | 'roomId'> } = {},
): CandidateInvariantVerdict {
	const reasons: CandidateInvariantReason[] = [];
	if (![input.facultyId, input.sectionId, input.roomId].every(isValidCandidateIdentity)) reasons.push('INVALID_IDENTIFIER');
	if (!isValidCandidateInterval(input)) reasons.push('INVALID_INTERVAL');
	if (isHomeroomGuidanceCandidate(input.subjectCode)) reasons.push('HG_FORBIDDEN');
	if (!input.room.isTeachingSpace || input.room.isSharedFacility === true) reasons.push('NON_TEACHING_ROOM');
	else if (!isRoomInTeachingScope(input.room, input.gradeLevel)) reasons.push('ROOM_SCOPE_MISMATCH');
	if (!input.allowedRoomTypes.includes(input.room.type)) reasons.push('ROOM_TYPE_MISMATCH');
	if (!roomCanFitEnrollment(input.room.capacity, input.enrolledCount)) reasons.push('ROOM_CAPACITY_EXCEEDED');

	const occupied = input.occupied ?? [];
	for (const resource of options.occupancyResources ?? ['facultyId', 'sectionId', 'roomId']) {
		if (occupied.some((entry) => entry[resource] === input[resource] && intervalsOverlap(input, entry))) {
			reasons.push(resource === 'facultyId'
				? 'FACULTY_TIME_CONFLICT'
				: resource === 'sectionId'
					? 'SECTION_TIME_CONFLICT'
					: 'ROOM_TIME_CONFLICT');
		}
	}

	return { accepted: reasons.length === 0, reasons };
}
