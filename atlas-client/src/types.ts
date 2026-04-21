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

export type SessionPattern = 'MWF' | 'TTH' | 'ANY';

export type Subject = {
	id: number;
	schoolId: number;
	code: string;
	name: string;
	minMinutesPerWeek: number;
	preferredRoomType: RoomType;
	sessionPattern: SessionPattern;
	gradeLevels: number[];
	isActive: boolean;
	isSeedable: boolean;
	interSectionEnabled: boolean;
	interSectionGradeLevels: number[];
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
	employmentStatus: string;
	contactInfo: string | null;
	localNotes: string | null;
	isActiveForScheduling: boolean;
	isClassAdviser: boolean;
	advisoryEquivalentHours: number;
	canTeachOutsideDepartment: boolean;
	maxHoursPerWeek: number;
	lastSyncedAt: string;
	version: number;
	advisedSectionId?: number | null;
	advisedSectionName?: string | null;
	facultySubjects?: FacultySubject[];
};

export interface HomeroomHintResponse {
	hasAdviserMapping: boolean;
	advisedSectionId?: number | null;
	advisedSectionName?: string | null;
	homeroomHint: string | null;
}

export type FacultySubject = {
	id: number;
	facultyId: number;
	subjectId: number;
	schoolId: number;
	gradeLevels: number[];
	sectionIds: number[];
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
	| 'ROOM_CAPACITY_EXCEEDED'
	| 'FACULTY_SUBJECT_NOT_QUALIFIED'
	| 'FACULTY_CONSECUTIVE_LIMIT_EXCEEDED'
	| 'FACULTY_BREAK_REQUIREMENT_VIOLATED'
	| 'FACULTY_DAILY_MAX_EXCEEDED'
	| 'FACULTY_EXCESSIVE_TRAVEL_DISTANCE'
	| 'FACULTY_EXCESSIVE_BUILDING_TRANSITIONS'
	| 'FACULTY_INSUFFICIENT_TRANSITION_BUFFER'
	| 'FACULTY_EXCESSIVE_IDLE_GAP'
	| 'FACULTY_EARLY_START_PREFERENCE'
	| 'FACULTY_LATE_END_PREFERENCE'
	| 'FACULTY_INSUFFICIENT_DAILY_VACANT'
	| 'SECTION_OVERCOMPRESSED'
	| 'SESSION_PATTERN_VIOLATED';

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
	lockWarnings?: string[];
	cohortCount?: number;
	cohortizedClassCount?: number;
	contractWarnings?: string[];
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
	entryKind?: 'SECTION' | 'COHORT';
	programType?: string | null;
	programCode?: string | null;
	programName?: string | null;
	cohortCode?: string | null;
	cohortName?: string | null;
	cohortMemberSectionIds?: number[];
	cohortExpectedEnrollment?: number | null;
	adviserId?: number | null;
	adviserName?: string | null;
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
	entryKind?: 'SECTION' | 'COHORT';
	programType?: string | null;
	programCode?: string | null;
	programName?: string | null;
	cohortCode?: string | null;
	cohortName?: string | null;
	cohortMemberSectionIds?: number[];
	cohortExpectedEnrollment?: number | null;
	adviserId?: number | null;
	adviserName?: string | null;
}

export interface DraftReport {
	runId: number;
	status: string;
	entries: ScheduledEntry[];
	unassignedItems: UnassignedItem[];
	summary: RunSummary | null;
	version: number;
	finishedAt: string | null;
	createdAt: string;
}

/* ─── Manual Edit types ─── */

export type ManualEditType =
	| 'PLACE_UNASSIGNED'
	| 'MOVE_ENTRY'
	| 'CHANGE_ROOM'
	| 'CHANGE_FACULTY'
	| 'CHANGE_TIMESLOT'
	| 'REVERT';

export interface ManualEditProposal {
	editType: ManualEditType;
	sectionId?: number;
	subjectId?: number;
	session?: number;
	entryId?: string;
	targetDay?: string;
	targetStartTime?: string;
	targetEndTime?: string;
	targetRoomId?: number;
	targetFacultyId?: number;
}

export interface PreviewResult {
	allowed: boolean;
	hardViolations: Violation[];
	softViolations: Violation[];
	violationDelta: {
		hardBefore: number;
		hardAfter: number;
		softBefore: number;
		softAfter: number;
	};
	humanConflicts: HumanConflict[];
	affectedEntries: AffectedEntry[];
	policyImpactSummary: PolicyImpact[];
}

export interface HumanConflict {
	code: string;
	severity: 'HARD' | 'SOFT';
	humanTitle: string;
	humanDetail: string;
	delta?: string;
}

export interface AffectedEntry {
	entryId: string;
	subjectId: number;
	sectionId: number;
	facultyId: number;
	roomId: number;
	day: string;
	startTime: string;
	endTime: string;
	phase: 'before' | 'after';
	entryKind?: 'SECTION' | 'COHORT';
	cohortCode?: string | null;
	cohortName?: string | null;
	programType?: string | null;
	programCode?: string | null;
	programName?: string | null;
}

export interface PolicyImpact {
	code: string;
	label: string;
	summary: string;
	severity: 'HARD' | 'SOFT';
}

export interface CommitResult {
	editId: number;
	draft: DraftReport;
	violationDelta: PreviewResult['violationDelta'];
	warnings: Violation[];
	newVersion: number;
}

export interface ManualEditRecord {
	id: number;
	runId: number;
	actorId: number;
	editType: string;
	beforePayload: unknown;
	afterPayload: unknown;
	validationSummary: unknown;
	createdAt: string;
}

/* ─── Locked Session types ─── */

export interface LockedSession {
	id: number;
	schoolId: number;
	schoolYearId: number;
	sectionId: number;
	subjectId: number;
	facultyId: number | null;
	roomId: number | null;
	day: string;
	startTime: string;
	endTime: string;
	createdBy: number;
	createdAt: string;
}

export interface LockedSessionInput {
	sectionId: number;
	subjectId: number;
	facultyId: number;
	roomId: number;
	day: string;
	startTime: string;
	endTime: string;
}

/* ─── Grade Shift Window types ─── */

export interface GradeShiftWindow {
	id: number;
	schoolId: number;
	schoolYearId: number;
	gradeLevel: number;
	startTime: string;
	endTime: string;
	createdAt: string;
	updatedAt: string;
}

export interface GradeShiftWindowInput {
	gradeLevel: number;
	startTime: string;
	endTime: string;
}

/* ─── Section types (from enrollment adapter) ─── */

export interface ExternalSection {
	id: number;
	name: string;
	maxCapacity: number;
	enrolledCount: number;
	gradeLevelId: number;
	gradeLevelName: string;
	displayOrder: number;
	programType?: 'REGULAR' | 'STE' | 'SPS' | 'SPA' | 'SPJ' | 'SPFL' | 'SPTVE' | 'OTHER' | null;
	programCode?: string | null;
	programName?: string | null;
	upstreamProgramType?: string | null;
	isSpecialProgram?: boolean;
	adviserId?: number | null;
	adviserName?: string | null;
}

export interface SectionSummaryResponse {
	schoolId: number;
	schoolYearId: number;
	totalSections: number;
	totalEnrolled: number;
	byGradeLevel: Record<number, number>;
	enrolledByGradeLevel: Record<number, number>;
	sections: ExternalSection[];
	source?: 'enrollpro' | 'stub' | 'cached-enrollpro';
	sourceMode?: 'stub' | 'enrollpro' | 'auto';
	fallbackReason?: string;
	contractWarnings?: string[];
}

/* ─── Scheduling Policy types ─── */

export interface ConstraintOverride {
	enabled: boolean;
	weight: number;
	treatAsHard: boolean;
}

export interface SchedulingPolicy {
	id: number;
	schoolId: number;
	schoolYearId: number;
	maxConsecutiveTeachingMinutesBeforeBreak: number;
	minBreakMinutesAfterConsecutiveBlock: number;
	maxTeachingMinutesPerDay: number;
	earliestStartTime: string;
	latestEndTime: string;
	enforceConsecutiveBreakAsHard: boolean;
	enableTravelWellbeingChecks: boolean;
	maxWalkingDistanceMetersPerTransition: number;
	maxBuildingTransitionsPerDay: number;
	maxBackToBackTransitionsWithoutBuffer: number;
	maxIdleGapMinutesPerDay: number;
	avoidEarlyFirstPeriod: boolean;
	avoidLateLastPeriod: boolean;
	enableVacantAwareConstraints: boolean;
	targetFacultyDailyVacantMinutes: number;
	targetSectionDailyVacantPeriods: number;
	maxCompressedTeachingMinutesPerDay: number;
	lunchStartTime: string;
	lunchEndTime: string;
	enforceLunchWindow: boolean;
	enableTleTwoPassPriority: boolean;
	allowFlexibleSubjectAssignment: boolean;
	allowConsecutiveLabSessions: boolean;
	constraintConfig: Record<string, ConstraintOverride> | null;
	createdAt: string;
	updatedAt: string;
}

/* ─── Fix Suggestion types ─── */

export type UnassignedReason = 'NO_QUALIFIED_FACULTY' | 'FACULTY_OVERLOADED' | 'NO_AVAILABLE_SLOT' | 'NO_COMPATIBLE_ROOM';

export type FixActionType =
	| 'ASSIGN_CANDIDATE_FACULTY'
	| 'SUGGEST_COMPATIBLE_ROOM'
	| 'PLACE_NEXT_BEST_SLOT'
	| 'OPEN_POLICY_SUGGESTION'
	| 'CONVERT_TO_FOLLOW_UP';

export interface FixSuggestion {
	action: FixActionType;
	label: string;
	description: string;
	proposal?: ManualEditProposal;
	policyHint?: string;
}

export interface UnassignedExplanation {
	reason: UnassignedReason;
	humanLabel: string;
	humanDetail: string;
	impact: 'PUBLISH_BLOCKER' | 'WARNING';
	suggestions: FixSuggestion[];
}

export interface FixSuggestionsResponse {
	item: UnassignedItem;
	explanation: UnassignedExplanation;
}

/* ─── Tutorial step type ─── */

export interface TutorialStep {
	target: string;
	title: string;
	content: string;
	roles?: string[];
}
