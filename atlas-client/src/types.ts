export type RoomType =
	| 'CLASSROOM'
	| 'LABORATORY'
	| 'COMPUTER_LAB'
	| 'TLE_WORKSHOP'
	| 'LIBRARY'
	| 'GYMNASIUM'
	| 'FACULTY_ROOM'
	| 'OFFICE'
	| 'OTHER';

export type Room = {
	id: number;
	name: string;
	floor: number;
	type: RoomType;
	capacity: number | null;
	isTeachingSpace: boolean;
	floorPosition: number;
	buildingId: number;
};

export type Building = {
	id: number;
	name: string;
	shortCode: string | null;
	x: number;
	y: number;
	width: number;
	height: number;
	rotation: number;
	color: string;
	floorCount: number;
	isTeachingBuilding: boolean;
	rooms: Room[];
};

export type BridgeUser = {
	userId: number;
	role: string;
	mustChangePassword?: boolean;
};

export type Subject = {
	id: number;
	schoolId: number;
	code: string;
	name: string;
	minMinutesPerWeek: number;
	preferredRoomType: RoomType;
	gradeLevels: number[];
	isActive: boolean;
	isSeedable: boolean;
	createdAt: string;
	updatedAt: string;
};

export type FacultyMirror = {
	id: number;
	externalId: number;
	schoolId: number;
	firstName: string;
	lastName: string;
	department: string | null;
	contactInfo: string | null;
	localNotes: string | null;
	isActiveForScheduling: boolean;
	maxHoursPerWeek: number;
	lastSyncedAt: string;
	version: number;
	facultySubjects?: FacultySubject[];
};

export type FacultySubject = {
	id: number;
	facultyId: number;
	subjectId: number;
	schoolId: number;
	gradeLevels: number[];
	assignedBy: number;
	assignedAt: string;
	version: number;
	subject?: Subject;
};

/* ─── Preference types ─── */

export type DayOfWeek = 'MONDAY' | 'TUESDAY' | 'WEDNESDAY' | 'THURSDAY' | 'FRIDAY';
export type TimeSlotPreference = 'PREFERRED' | 'AVAILABLE' | 'UNAVAILABLE';
export type PreferenceStatus = 'DRAFT' | 'SUBMITTED';

export type PreferenceTimeSlot = {
	id: number;
	preferenceId: number;
	day: DayOfWeek;
	startTime: string;
	endTime: string;
	preference: TimeSlotPreference;
	createdAt: string;
};

export type FacultyPreference = {
	id: number;
	schoolId: number;
	schoolYearId: number;
	facultyId: number;
	status: PreferenceStatus;
	notes: string | null;
	submittedAt: string | null;
	version: number;
	createdAt: string;
	updatedAt: string;
	timeSlots: PreferenceTimeSlot[];
};

export type OfficerSummaryFaculty = {
	facultyId: number;
	firstName: string;
	lastName: string;
	department: string | null;
	preferenceStatus: 'SUBMITTED' | 'DRAFT' | 'MISSING';
	submittedAt: string | null;
};

export type OfficerSummaryCounts = {
	total: number;
	submitted: number;
	draft: number;
	missing: number;
};

export type OfficerSummaryResponse = {
	counts: OfficerSummaryCounts;
	faculty: OfficerSummaryFaculty[];
};

export type ReminderResponse = {
	reminded: number;
	auditId: number;
	timestamp: string;
	note: string;
};

/* ─── Review types ─── */

export type ReviewStatus = 'PENDING' | 'REVIEWED' | 'NEEDS_FOLLOW_UP';

export type PreferenceReview = {
	id: number;
	preferenceId: number;
	reviewerId: number;
	reviewStatus: ReviewStatus;
	reviewerNotes: string | null;
	reviewedAt: string | null;
	createdAt: string;
	updatedAt: string;
};

export type OfficerSummaryFacultyWithReview = OfficerSummaryFaculty & {
	reviewStatus: ReviewStatus | null;
	reviewedAt: string | null;
};

export type OfficerSummaryWithReviewsResponse = {
	counts: OfficerSummaryCounts;
	faculty: OfficerSummaryFacultyWithReview[];
};

export type PreferenceDetail = FacultyPreference & {
	review: PreferenceReview | null;
	faculty: {
		firstName: string;
		lastName: string;
		department: string | null;
	};
};

export type DevBulkSubmitResponse = {
	converted: number;
	auditId: number | null;
};

/* ─── Room Schedule types ─── */

export type RoomScheduleEntry = {
	entryId: string;
	subjectId: number;
	sectionId: number;
	facultyId: number;
	startTime: string;
	endTime: string;
	durationMinutes: number;
};

export type RoomScheduleCell = {
	day: string;
	occupied: boolean;
	entries: RoomScheduleEntry[];
	conflict: boolean;
};

export type RoomScheduleView = {
	room: {
		id: number;
		name: string;
		type: string;
		buildingId?: number;
		buildingName?: string;
		floor?: number;
	};
	source: {
		mode: 'LATEST' | 'RUN';
		runId: number;
		status: string;
		generatedAt?: string;
	};
	timeSlots: Array<{ startTime: string; endTime: string }>;
	days: string[];
	grid: Array<{
		timeSlot: { startTime: string; endTime: string };
		cells: RoomScheduleCell[];
	}>;
	summary: {
		occupiedMinutes: number;
		availableMinutes: number;
		utilizationPercent: number;
		entryCount: number;
		conflictCount: number;
	};
};

/* ─── Generation / Review types ─── */

export type GenerationRunStatus = 'QUEUED' | 'RUNNING' | 'COMPLETED' | 'FAILED';

export type ViolationCode =
	| 'FACULTY_TIME_CONFLICT'
	| 'ROOM_TIME_CONFLICT'
	| 'FACULTY_OVERLOAD'
	| 'ROOM_TYPE_MISMATCH'
	| 'FACULTY_SUBJECT_NOT_QUALIFIED'
	| 'FACULTY_CONSECUTIVE_LIMIT_EXCEEDED'
	| 'FACULTY_BREAK_REQUIREMENT_VIOLATED'
	| 'FACULTY_DAILY_MAX_EXCEEDED'
	| 'FACULTY_EXCESSIVE_TRAVEL_DISTANCE'
	| 'FACULTY_EXCESSIVE_BUILDING_TRANSITIONS'
	| 'FACULTY_INSUFFICIENT_TRANSITION_BUFFER';

export type ViolationSeverity = 'HARD' | 'SOFT';

export interface GenerationRun {
	id: number;
	schoolId: number;
	schoolYearId: number;
	triggeredBy: number;
	status: GenerationRunStatus;
	startedAt: string | null;
	finishedAt: string | null;
	durationMs: number | null;
	summary: RunSummary | null;
	error: string | null;
	createdAt: string;
	updatedAt: string;
}

export interface RunSummary {
	classesProcessed: number;
	assignedCount: number;
	unassignedCount: number;
	policyBlockedCount: number;
	hardViolationCount: number;
	violationCounts?: Record<string, number>;
}

export interface ScheduledEntry {
	entryId: string;
	facultyId: number;
	roomId: number;
	subjectId: number;
	sectionId: number;
	day: string;
	startTime: string;
	endTime: string;
	durationMinutes: number;
}

export interface Violation {
	code: ViolationCode;
	severity: ViolationSeverity;
	message: string;
	schoolId: number;
	schoolYearId: number;
	runId: number;
	entities: {
		facultyId?: number;
		roomId?: number;
		subjectId?: number;
		sectionId?: number;
		day?: string;
		startTime?: string;
		endTime?: string;
		entryIds?: string[];
	};
	meta?: Record<string, unknown>;
}

export interface ViolationReport {
	runId: number;
	status: string;
	violations: Violation[];
	counts: {
		total: number;
		byCode: Record<string, number>;
	};
}

export interface UnassignedItem {
	sectionId: number;
	subjectId: number;
	gradeLevel: number;
	session: number;
	reason: 'NO_QUALIFIED_FACULTY' | 'FACULTY_OVERLOADED' | 'NO_AVAILABLE_SLOT' | 'NO_COMPATIBLE_ROOM';
}

export interface DraftReport {
	runId: number;
	status: string;
	entries: ScheduledEntry[];
	unassignedItems: UnassignedItem[];
	summary: RunSummary | null;
	finishedAt: string | null;
	createdAt: string;
}

/* ─── Section types (from enrollment adapter) ─── */

export interface ExternalSection {
	id: number;
	name: string;
	maxCapacity: number;
	enrolledCount: number;
	gradeLevelId: number;
	gradeLevelName: string;
}

export interface SectionSummaryResponse {
	schoolId: number;
	schoolYearId: number;
	totalSections: number;
	totalEnrolled: number;
	byGradeLevel: Record<number, number>;
	enrolledByGradeLevel: Record<number, number>;
	sections: ExternalSection[];
}
