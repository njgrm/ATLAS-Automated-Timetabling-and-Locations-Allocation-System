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
	features: string[];
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
	authSource?: 'bridge' | 'local';
	schoolId?: number;
	accountId?: number;
};

export type Subject = {
	id: number;
	schoolId: number;
	code: string;
	outputLabel?: string | null;
	displayCode?: string;
	ownerDepartment?: string | null;
	allowedOwnerDepartments?: string[];
	qualificationPriority?: 'DEPARTMENT_FIRST' | 'SPECIALIZATION_PRIMARY';
	rotationFamily?: string | null;
	rotationTermRank?: number | null;
	rotationTermLabel?: string | null;
	rotationTermGroupId?: string | null;
	rotationTermCount?: number | null;
	specializationSource?: 'REFERENCE_METADATA' | 'NONE';
	isSystemManaged?: boolean;
	name: string;
	programType?: 'REGULAR' | 'STE' | 'SPS' | 'SPA' | 'SPJ' | 'SPFL' | 'SPTVE' | 'OTHER' | null;
	minMinutesPerWeek: number;
	preferredRoomType: RoomType;
	gradeLevels: number[];
	isActive: boolean;
	isSeedable: boolean;
	interSectionEnabled: boolean;
	interSectionGradeLevels: number[];
	programScopes: string[];
	allowedSpecializations: string[];
	modularGroupId?: string | null;
	modularOrder?: number | null;
	termGroupId?: string | null;
	termCount?: number | null;
	requiredFeatures: string[];
	createdAt: string;
	updatedAt: string;
};

export type ClassTemplate = {
	id: number;
	schoolId: number;
	name: string;
	label: string;
	programType: string;
	gradeApplicability: number[];
	periodLengthMinutes: number;
	periodsPerDay: number;
	isActive: boolean;
	isDefault: boolean;
	subjects: Array<{ id: number; code: string; name: string; programScopes: string[] }>;
	createdAt: string;
	updatedAt: string;
};

export type ExternalFaculty = {
	id: number;
	externalId: number;
	firstName: string;
	lastName: string;
	department: string | null;
	specialization: string | null;
	employmentStatus: string;
	isActiveForScheduling: boolean;
	isClassAdviser: boolean;
	advisoryEquivalentHours: number;
	ancillaryMinutesPerWeek?: number | null;
	ancillaryLoadSource?: 'HR' | 'LOCAL' | 'NONE';
	canTeachOutsideDepartment: boolean;
	isPlaceholder?: boolean;
	maxHoursPerWeek: number;
	version: number;
	subjectCount: number;
	sectionCount: number;
	subjectHours: number;
	loadPercentage: number;
	assignments: FacultyAssignmentDraft[];
};

export type FacultyAssignmentDraft = {
	subjectId: number;
	gradeLevels: number[];
	sectionIds: number[];
	sections?: ExternalSection[];
};

export type SpecializationAlias = {
	id: number;
	schoolId: number;
	canonical: string;
	alias: string;
	createdAt: string;
	updatedAt: string;
};

export type SpecializationCatalogItem = {
	specialization: string;
	departmentCode: string | null;
	departmentName: string | null;
	mappedSubjectCodes: string[];
	mappedSubjects: Array<{ code: string; name: string }>;
	status: 'mapped' | 'partially_mapped' | 'unmapped';
};

export type SpecializationCatalogDepartment = {
	departmentCode: string | null;
	departmentName: string;
	specializationCount: number;
	items: SpecializationCatalogItem[];
};

export type SpecializationCatalogResponse = {
	departments: SpecializationCatalogDepartment[];
	orphans: string[];
	totalSpecializations: number;
	totalDepartments: number;
};

export type FacultyAssignmentRecord = {
	id: number;
	subjectId: number;
	gradeLevels: number[];
	sectionIds: number[];
	assignmentKind?: 'REAL_OWNERSHIP' | 'BASELINE_ONLY' | 'MISSING_OWNERSHIP';
	storedCurrentYearSectionCount?: number;
	ownedCurrentYearSectionCount?: number;
	missingOwnershipSectionCount?: number;
	ownershipWithoutScopeSectionCount?: number;
	sections: ExternalSection[];
	subject: {
		id: number;
		name: string;
		code: string;
		modularGroupId?: string | null;
		modularOrder?: number | null;
		termGroupId?: string | null;
		termCount?: number | null;
		minMinutesPerWeek: number;
		rotationFamily?: string | null;
		rotationTermRank?: number | null;
		rotationTermLabel?: string | null;
		rotationTermGroupId?: string | null;
		rotationTermCount?: number | null;
	};
};

export type RotationFamilyLoadDetail = {
	family: string;
	rawHours: number;
	creditedHours: number;
	overcountHours: number;
	unitCount: number;
	dominantTermRank?: number | null;
	dominantTermLabel?: string | null;
	termGroupId?: string | null;
	termCount?: number | null;
	termBuckets?: Array<{
		termRank: number | null;
		termLabel: string | null;
		termGroupId: string | null;
		termCount: number | null;
		creditedHours: number;
		unitCount: number;
		subjectCodes: string[];
		subjectIds: number[];
	}>;
	subjectCodes: string[];
	subjectIds: number[];
};

export type RotationTermBucketBreakdown = {
	termRank: number | null;
	termLabel: string | null;
	termGroupId: string | null;
	termCount: number | null;
	rawMinutesPerWeek: number;
	creditedMinutesPerWeek: number;
	isPeakTerm: boolean;
	sectionIds: number[];
	sectionNames: string[];
	subjectCodes: string[];
	subjectIds: number[];
};

export type RotationFamilyTermBreakdown = {
	family: string;
	rawMinutesPerWeek: number;
	peakTermMinutesPerWeek: number;
	peakTermRank: number | null;
	peakTermLabel: string | null;
	termGroupId: string | null;
	termCount: number | null;
	termBuckets: RotationTermBucketBreakdown[];
};

export type FacultySummary = {
	id: number;
	externalId: number;
	employeeId: string | null;
	firstName: string;
	lastName: string;
	department: string | null;
	specialization: string | null;
	employmentStatus: string;
	isActiveForScheduling: boolean;
	isPlaceholder: boolean;
	isClassAdviser: boolean;
	advisedSectionId: number | null;
	advisedSectionName: string | null;
	advisoryEquivalentHours: number;
	ancillaryMinutesPerWeek: number;
	canTeachOutsideDepartment: boolean;
	maxHoursPerWeek: number;
	version: number;
	subjectCount: number;
	sectionCount: number;
	baselineSubjectCount?: number;
	missingOwnershipSubjectCount?: number;
	ownershipWithoutScopeSubjectCount?: number;
	subjectHours: number;
	sectionTeachingHours: number;
	sectionTeachingHoursRaw?: number;
	rotationFamilyOvercountHours?: number;
	rotationFamilyLoadDetails?: RotationFamilyLoadDetail[];
	rotationTermBreakdown?: RotationFamilyTermBreakdown[];
	gradeTeachingHours: number;
	advisoryHours: number;
	ancillaryHours: number;
	policyCreditedHours: number;
	policyLoadPercentage: number;
	syntheticCoverageHours: number;
	loadSignalMode: 'STANDARD' | 'SYNTHETIC_PLACEHOLDER';
	assignments: FacultyAssignmentRecord[];
};

export type TeachingLoadCoverageTotals = {
	assignedPairs: number;
	activeAssignedPairs?: number;
	realFacultyAssignedPairs: number;
	syntheticPlaceholderPairs: number;
	rawAssignedPairs?: number;
	totalPairs: number;
	unassignedPairs: number;
	rawUnassignedPairs?: number;
};

export type TeachingLoadIntegrityDiagnosticRow = {
	facultyId: number;
	facultyName: string;
	subjectId: number;
	subjectCode: string;
	sectionCount: number;
};

export type TeachingLoadStaleOwnershipSample = {
	facultyId: number;
	facultyName: string;
	isPlaceholder: boolean;
	subjectId: number;
	subjectCode: string;
	sectionId: number;
};

export type TeachingLoadIntegrityDiagnostics = {
	emptySectionRows: number;
	currentYearRowsMissingOwnership: number;
	currentYearOwnershipWithoutMatchingScope: number;
	currentYearMissingOwnershipPairs: number;
	currentYearOwnershipWithoutMatchingScopePairs: number;
	currentYearOutOfSubjectScopeRows?: number;
	currentYearOutOfSubjectScopePairs?: number;
	staleOwnershipRowCount: number;
	staleOwnedCurrentYearPairCount: number;
	stalePlaceholderPairCount: number;
	staleNonPlaceholderPairCount: number;
	emptySectionSamples: TeachingLoadIntegrityDiagnosticRow[];
	missingOwnershipSamples: TeachingLoadIntegrityDiagnosticRow[];
	ownershipWithoutScopeSamples: TeachingLoadIntegrityDiagnosticRow[];
	outOfSubjectScopeSamples?: TeachingLoadIntegrityDiagnosticRow[];
	staleOwnershipSamples: TeachingLoadStaleOwnershipSample[];
	quarantinedZombieCount?: number;
	quarantinedZombieSamples?: TeachingLoadIntegrityDiagnosticRow[];
	staleAdvisoryCount?: number;
	staleAdvisorySamples?: TeachingLoadIntegrityDiagnosticRow[];
};

export type TeachingLoadSplitBrainReasonCode =
	| 'ASSIGNED_PAIR_MISMATCH'
	| 'UNASSIGNED_PAIR_MISMATCH'
	| 'TOTAL_PAIR_MISMATCH'
	| 'FACULTY_LOAD_OUTLIER'
	| 'FACULTY_LOAD_REVIEW_REQUIRED'
	| 'INTEGRITY_MISSING_OWNERSHIP'
	| 'INTEGRITY_OWNERSHIP_WITHOUT_SCOPE'
	| 'INTEGRITY_OUT_OF_SUBJECT_SCOPE'
	| 'STALE_OWNERSHIP_PRESENT'
	| 'TRUTH_RECONCILE_PENDING'
	| 'REAL_FACULTY_RECOVERY_PENDING'
	| 'REAL_FACULTY_RECOVERY_BLOCKERS'
	| 'SPECIAL_PROGRAM_APPROVAL_REQUIRED';

export type TeachingLoadSplitBrainOutlierFacultyRow = {
	facultyId: number;
	facultyName: string;
	policyCreditedHours: number;
	maxHoursPerWeek: number;
	overloadHours: number;
	subjectCodes: string[];
};

export type TeachingLoadSplitBrainIntegrityDetailRow = {
	facultyId: number;
	facultyName: string;
	subjectId: number;
	subjectCode: string;
	sectionCount: number;
};

export type TeachingLoadSplitBrainRecoveryBlocker = {
	subjectCode: string;
	sectionId: number;
	category:
		| 'TRUE_DEPARTMENT_SHORTAGE'
		| 'SKEWED_ASSIGNMENT_TOPOLOGY'
		| 'UNRESOLVED_AUTOMATION_SEED_BIAS'
		| 'ROTATION_FAMILY_MODELING_GAP'
		| 'SUBJECT_CONTRACT_GAP';
	reason: string;
};

export type TeachingLoadSplitBrainApprovalRequiredCandidate = {
	subjectCode: string;
	subjectName: string;
	facultyId: number;
	facultyName: string;
	department: string | null;
	specialization: string | null;
	currentTotalAssignedPairs: number;
	requiredSpecializationCodes: string[];
	reason: string;
};

export type TeachingLoadSplitBrainReconcileResult = {
	applied: boolean;
	schoolId: number;
	schoolYearId: number;
	quarantine: {
		required: boolean;
		severity: 'NONE' | 'WARNING' | 'BLOCKING';
		reasonCodes: TeachingLoadSplitBrainReasonCode[];
		message: string;
	};
	counters: {
		summaryAssignedPairs: number;
		summaryUnassignedPairs: number;
		summaryTotalPairs: number;
		coverageAssignedPairs: number;
		coverageUnassignedPairs: number;
		coverageTotalPairs: number;
		assignmentPairDelta: number;
		unassignedPairDelta: number;
		totalPairDelta: number;
		integrityMissingOwnershipPairs: number;
		integrityOwnershipWithoutScopePairs: number;
		integrityOutOfSubjectScopePairs?: number;
		staleOwnedCurrentYearPairs: number;
		overloadedFacultyRows: number;
		trueLoadOutlierRows?: number;
		loadReviewRows?: number;
		approvalLinkedLoadRows?: number;
		truthRowsToUpdate: number;
		realFacultyMovesPlanned: number;
		realFacultyBlockers: number;
		specialProgramApprovalCandidates: number;
	};
	repairPreview: {
		truthReconcile: {
			rowsToUpdate: number;
			updatedRows: number;
			rowsWithOutOfSubjectScope?: number;
			outOfSubjectScopePairCount?: number;
		};
		staleReconcile: {
			staleOwnedCurrentYearPairCount: number;
			deletedOwnershipRows: number;
		};
		realFacultyRecovery: {
			placeholderMovesPlanned: number;
			placeholderMovesApplied: number;
			blockerCount: number;
			blockers?: TeachingLoadSplitBrainRecoveryBlocker[];
		};
		integrity?: {
			missingOwnershipSamples: TeachingLoadSplitBrainIntegrityDetailRow[];
			ownershipWithoutScopeSamples: TeachingLoadSplitBrainIntegrityDetailRow[];
			outOfSubjectScopeSamples: TeachingLoadSplitBrainIntegrityDetailRow[];
		};
		loadOutliers?: {
			rows: TeachingLoadSplitBrainOutlierFacultyRow[];
		};
	};
	specialProgramApprovalQueue: TeachingLoadSplitBrainApprovalRequiredCandidate[];
};

export type SpecialProgramApprovalRequiredCandidate = {
	facultyId: number;
	facultyName: string;
	department: string | null;
	specialization: string | null;
	currentTotalAssignedPairs: number;
	requiredSpecializationCodes: string[];
	reason: string;
};

export type SpecialProgramRedistributionInsight = {
	subjectId: number;
	subjectCode: string;
	subjectName: string;
	approvalRequiredCandidates: SpecialProgramApprovalRequiredCandidate[];
};

export type SpecialProgramRebalancePreviewResult = {
	redistributionInsights: SpecialProgramRedistributionInsight[];
};

export type FacultyMirror = {
	id: number;
	externalId: number;
	schoolId: number;
	employeeId?: string | null;
	firstName: string;
	lastName: string;
	department: string | null;
	specialization: string | null;
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
	// Well-being preference toggles
	pregnancySupport: boolean;
	physicalAilmentSupport: boolean;
	minimizeTravelTime: boolean;
	avoidUpperFloors: boolean;
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
	wellbeing: {
		pregnancySupport: boolean;
		physicalAilmentSupport: boolean;
		minimizeTravelTime: boolean;
		avoidUpperFloors: boolean;
	} | null;
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
	subjectDisplayLabel?: string;
	sectionId: number;
	facultyId: number | null;
	startTime: string;
	endTime: string;
	durationMinutes: number;
	termIndex: 1 | 2 | 3;
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
		mode: 'LATEST' | 'RUN' | 'DRAFT';
		runId: number | null;
		status: string;
		generatedAt?: string;
	};
	timeSlots: Array<{ startTime: string; endTime: string; eventLabel?: string | null; isSpecialEvent?: boolean }>;
	days: string[];
	grid: Array<{
		timeSlot: { startTime: string; endTime: string; eventLabel?: string | null; isSpecialEvent?: boolean };
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

/* ─── Room Preference types ─── */

export type RoomPreferenceStatus = 'DRAFT' | 'SUBMITTED';
export type RoomPreferenceDecisionStatus = 'PENDING' | 'APPROVED' | 'REJECTED';
export type RoomPreferenceActionType = 'ROOM_CHANGE' | 'MOVE_TO_EMPTY_SLOT' | 'SWAP_WITH_OCCUPIED' | 'TIME_AND_ROOM_CHANGE';

export type FacultyRoomPreferenceEntry = {
	entryId: string;
	subjectId: number;
	sectionId: number;
	facultyId: number;
	currentRoomId: number;
	currentRoomName: string;
	requestedRoomId: number | null;
	requestedRoomName: string | null;
	day: DayOfWeek;
	startTime: string;
	endTime: string;
	durationMinutes: number;
	status: RoomPreferenceStatus | null;
	decisionStatus: RoomPreferenceDecisionStatus | null;
	rationale: string | null;
	submittedAt: string | null;
	version: number | null;
	subjectCode: string;
	subjectDisplayLabel?: string;
	subjectName: string;
	sectionName: string;
	requestId: number | null;
	reviewerNotes: string | null;
	reviewedAt: string | null;
	entryKind?: 'SECTION' | 'COHORT';
	cohortCode?: string | null;
	cohortName?: string | null;
	programCode?: string | null;
	programName?: string | null;
	actionType?: RoomPreferenceActionType | null;
	targetDay?: DayOfWeek | null;
	targetStartTime?: string | null;
	targetEndTime?: string | null;
	targetEntryId?: string | null;
	/** True when the requested room type differs from the subject's preferred room type. Warning-only. */
	roomTypeOverride?: boolean;
};

export type FacultyGlobalDraftEntry = {
	entryId: string;
	facultyId: number;
	facultyName: string;
	sectionId: number;
	sectionName: string;
	subjectId: number;
	subjectCode: string;
	subjectDisplayLabel?: string;
	subjectName: string;
	roomId: number;
	roomName: string;
	day: DayOfWeek;
	startTime: string;
	endTime: string;
	durationMinutes: number;
	owned: boolean;
	entryKind?: 'SECTION' | 'COHORT';
	cohortCode?: string | null;
	cohortName?: string | null;
	programCode?: string | null;
	programName?: string | null;
};

export type FacultyRoomPreferenceState = {
	runId: number;
	runVersion: number;
	runGeneratedAt: string | null;
	entries: FacultyRoomPreferenceEntry[];
	globalEntries: FacultyGlobalDraftEntry[];
};

export type GenerationGateStatus = {
	blocked: boolean;
	openCount: number;
	runId: number | null;
};

export type CollaborationViewMode = 'FACULTY_ACTIVE_DRAFT' | 'SCHEDULER_REVIEW' | 'SCHEDULER_QUEUE';

export type CollaborationPresence = {
	connectionId: string;
	userId: number;
	role: string;
	email: string | null;
	schoolId: number;
	schoolYearId: number;
	runId: number;
	viewMode: CollaborationViewMode;
	lastActive: string;
};

export type CollaborationSelection = {
	schoolId: number;
	schoolYearId: number;
	runId: number;
	day?: DayOfWeek;
	startTime?: string;
	endTime?: string;
	entryId?: string;
	source?: 'GRID_CELL' | 'REQUEST_CARD' | 'SESSION';
};

export type RoomPreferenceLiveEventType =
	| 'ROOM_REQUEST_DRAFT_SAVED'
	| 'ROOM_REQUEST_SUBMITTED'
	| 'ROOM_REQUEST_DELETED'
	| 'ROOM_REQUEST_REVIEWED'
	| 'ROOM_REQUEST_SYNC_COMPLETED';

export type RoomPreferenceEvent = {
	id: number;
	type: RoomPreferenceLiveEventType;
	timestamp: string;
	schoolId: number;
	schoolYearId: number;
	runId: number;
	facultyId: number | null;
	requestId: number | null;
	entryId: string | null;
	message: string;
	metadata?: Record<string, unknown>;
};

export type RoomPreferenceSummaryItem = {
	id: number;
	runId: number;
	entryId: string;
	facultyId: number;
	facultyName: string;
	subjectId: number;
	subjectCode: string;
	subjectDisplayLabel?: string;
	subjectName: string;
	sectionId: number;
	sectionName: string;
	currentRoomId: number;
	currentRoomName: string;
	requestedRoomId: number;
	requestedRoomName: string;
	day: DayOfWeek;
	startTime: string;
	endTime: string;
	status: RoomPreferenceStatus;
	decisionStatus: RoomPreferenceDecisionStatus;
	rationale: string | null;
	submittedAt: string | null;
	version: number;
	reviewerId: number | null;
	reviewerNotes: string | null;
	reviewedAt: string | null;
	entryKind?: 'SECTION' | 'COHORT';
	cohortCode?: string | null;
	cohortName?: string | null;
	programCode?: string | null;
	programName?: string | null;
	appealCount: number;
	openAppealCount: number;
	latestAppealStatus: RoomRequestAppealStatus | null;
	latestAppealUpdatedAt: string | null;
};

export type RoomPreferenceSummaryResponse = {
	runId: number;
	counts: {
		total: number;
		draft: number;
		submitted: number;
		pending: number;
		approved: number;
		rejected: number;
	};
	requests: RoomPreferenceSummaryItem[];
	runVersion: number;
};

export type RoomPreferencePreviewResponse = {
	request: RoomPreferenceSummaryItem;
	runVersion: number;
	appeals?: RoomRequestAppeal[];
	preview: PreviewResult;
};

export type RoomRequestAppealStatus = 'OPEN' | 'UNDER_REVIEW' | 'UPHELD' | 'DENIED';
export type RoomRequestAppealHistoryAction = 'CREATED' | 'STATUS_CHANGED' | 'NOTE_ADDED' | 'DECISION_RECORDED';

export type RoomRequestAppealHistory = {
	id: number;
	actorId: number;
	actorName: string;
	action: RoomRequestAppealHistoryAction;
	fromStatus: RoomRequestAppealStatus | null;
	toStatus: RoomRequestAppealStatus | null;
	note: string | null;
	createdAt: string;
};

export type RoomRequestAppeal = {
	id: number;
	requestId: number;
	requesterId: number;
	requesterName: string;
	reason: string;
	status: RoomRequestAppealStatus;
	createdAt: string;
	updatedAt: string;
	history: RoomRequestAppealHistory[];
};

/* ─── Generation / Review types ─── */

export type GenerationRunStatus = 'QUEUED' | 'RUNNING' | 'COMPLETED' | 'FAILED';

export type ViolationCode =
	| 'FACULTY_TIME_CONFLICT'
	| 'ROOM_TIME_CONFLICT'
	| 'SECTION_TIME_CONFLICT'
	| 'FACULTY_OVERLOAD'
	| 'ROOM_TYPE_MISMATCH'
	| 'ROOM_CAPACITY_EXCEEDED'
	| 'FACULTY_SUBJECT_NOT_QUALIFIED'
	| 'FACULTY_CONSECUTIVE_LIMIT_EXCEEDED'
	| 'FACULTY_BREAK_REQUIREMENT_VIOLATED'
	| 'FACULTY_DAILY_STANDARD_EXCEEDED'
	| 'FACULTY_DAILY_MAX_EXCEEDED'
	| 'FACULTY_EXCESSIVE_TRAVEL_DISTANCE'
	| 'FACULTY_EXCESSIVE_BUILDING_TRANSITIONS'
	| 'FACULTY_INSUFFICIENT_TRANSITION_BUFFER'
	| 'FACULTY_EXCESSIVE_IDLE_GAP'
	| 'FACULTY_EARLY_START_PREFERENCE'
	| 'FACULTY_LATE_END_PREFERENCE'
	| 'FACULTY_INSUFFICIENT_DAILY_VACANT'
	| 'SPECIALIZED_ROOM_UNAVAILABLE'
	| 'UNASSIGNED_SECTION'
	| 'ZONE_IMBALANCE_WARNING'
	| 'SECTION_OVERCOMPRESSED'
	| 'LACKING_FACULTY'
	| 'INCOMPLETE_MODULAR_GROUP';

export type ViolationSeverity = 'HARD' | 'SOFT';

export type ProgramFilter = 'all' | 'REGULAR' | 'SPECIAL' | 'STE' | 'SPA' | 'SPS' | 'SPJ' | 'SPFL' | 'SPTVE' | 'OTHER';
export type EntryKindFilter = 'all' | 'section' | 'cohort';

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
	roomerStrategy?: 'UNIVERSAL' | 'HOME_ROOM_FIRST';
	homeRoomAttemptedCount?: number;
	homeRoomAssignedCount?: number;
	homeRoomSuccessRate?: number;
	policyBlockedCount: number;
	hardViolationCount: number;
	prePlacedCount?: number;
	invalidPrePlacedCount?: number;
	skippedPrePlacedReasons?: string[];
	violationCounts?: Record<string, number>;
	lockWarnings?: string[];
	cohortCount?: number;
	contractWarnings?: string[];
	hybridEnabled?: boolean;
	selectedSeedProfile?: string;
	seedQuality?: Array<{
		profileId: string;
		profileLabel: string;
		assignedCount: number;
		unassignedCount: number;
		policyBlockedCount: number;
		fitnessScore: number;
		completionRate: number;
	}>;
	repairImpact?: {
		attemptsTotal: number;
		conflictsResolved: number;
		conflictsUnresolved: number;
		unresolvedByReason?: {
			lockedOrMissing: number;
			noFeasibleSlot: number;
			attemptCapReached: number;
		};
	};
	resourceDiagnostics?: {
		qualifiedFacultyCoverageBySubject: Array<{
			subjectId: number;
			subjectCode: string;
			requiredAssignments: number;
			qualifiedAssignments: number;
			coveragePercent: number;
		}>;
		slotSaturationByInterval: Array<{
			day: string;
			startTime: string;
			endTime: string;
			assigned: number;
			capacity: number;
			saturationPercent: number;
		}>;
		unassignedBySubjectGrade: Array<{
			subjectId: number;
			subjectCode: string;
			gradeLevel: number;
			count: number;
			reasons: Record<string, number>;
		}>;
		roomAssignmentReasonCounts?: Record<string, number>;
		zoneDistributionByTerm?: Array<{
			termIndex: 1 | 2 | 3;
			total: number;
			byZone: Record<string, { count: number; percent: number }>;
		}>;
	};
	shiftWindowPolicy?: 'ENFORCED' | 'DISABLED';
	configuredShiftWindowCount?: number;
	termCounts?: {
		term1: number;
		term2: number;
		term3: number;
	};
	timetableShapeContracts?: Array<{
		gradeLevel: number;
		programType: string;
		startTime: string;
		endTime: string;
		periodLengthMinutes: number;
		periodsPerDay: number;
		periodSlots: Array<{ startTime: string; endTime: string }>;
		displaySlots: Array<{ startTime: string; endTime: string; isSpecialEvent?: boolean; eventName?: string }>;
	}>;
	timetableDisplaySlots?: Array<{ startTime: string; endTime: string; isSpecialEvent?: boolean; eventName?: string }>;
}

export interface ScheduledEntry {
	entryId: string;
	facultyId: number | null;
	roomId: number;
	subjectId: number;
	sectionId: number;
	day: string;
	startTime: string;
	endTime: string;
	durationMinutes: number;
	termIndex?: 1 | 2 | 3;
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
	metadata?: {
		modularGroupId?: string;
		modularAssignments?: Array<{
			termIndex: 1 | 2 | 3;
			facultyId: number;
			subjectCode: string;
		}>;
	};
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
	reason: 'NO_QUALIFIED_FACULTY' | 'FACULTY_OVERLOADED' | 'NO_AVAILABLE_SLOT' | 'NO_COMPATIBLE_ROOM' | 'ROOM_CAPACITY_EXCEEDED';
	roomAssignmentReason?:
		| 'LOCKED_ENTRY'
		| 'HOME_ROOM_ASSIGNED'
		| 'HOME_ROOM_UNAVAILABLE'
		| 'SPECIALIZED_ROOM'
		| 'SPECIALIZED_ROOM_UNAVAILABLE'
		| 'GENERAL_POOL_ASSIGNED'
		| 'MODULAR_POOL_ASSIGNED'
		| 'FALLBACK_UNRESOLVED';
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
	homeRoomId?: number | null;
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
	| 'SWAP_ENTRIES'
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
	/** Daily teaching load band for the faculty on the target day (pre-gen only) */
	dailyLoadBand?: 'ok' | 'soft' | 'hard';
	/** Total minutes after this placement on the target day (pre-gen only) */
	dailyMinutesAfter?: number;
	/** Faculty teaching minutes per day from DRAFT placements + candidate (pre-gen only) */
	facultyWeeklyMinutes?: Record<string, number>;
}

export interface HumanConflict {
	code: string;
	severity: 'HARD' | 'SOFT';
	humanTitle: string;
	humanDetail: string;
	delta?: string;
}

/** Stage 2: per-cell conflict state for the live conflict inspector overlay */
export interface CellConflictInfo {
	kind: 'hard' | 'soft' | 'clean' | 'self';
	reasons: string[];
	displaced: Array<{
		entryId: string;
		subjectName: string;
		entityName: string;
		/** Numeric ID of the conflicting entity (faculty/section/room) for quick-nav */
		entityId: number;
		conflictType: 'faculty' | 'section' | 'room';
	}>;
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
	entryKind?: 'SECTION' | 'COHORT';
	sectionId: number;
	subjectId: number;
	facultyId: number | null;
	roomId: number | null;
	day: string;
	startTime: string;
	endTime: string;
	cohortCode?: string | null;
	status?: 'DRAFT' | 'LOCKED_FOR_RUN' | 'ARCHIVED';
	lockedRunId?: number | null;
	notes?: string | null;
	version?: number;
	createdBy: number;
	createdAt: string;
	updatedAt?: string;
}

export interface LockedSessionInput {
	entryKind?: 'SECTION' | 'COHORT';
	sectionId: number;
	subjectId: number;
	facultyId: number;
	roomId: number;
	day: string;
	startTime: string;
	endTime: string;
	cohortCode?: string | null;
	notes?: string | null;
	expectedVersion?: number;
}

export interface DraftPlacement extends LockedSession {
	entryKind: 'SECTION' | 'COHORT';
	status: 'DRAFT' | 'LOCKED_FOR_RUN' | 'ARCHIVED';
	lockedRunId: number | null;
	notes: string | null;
	version: number;
	updatedAt: string;
}

export interface FacultyOptionEnriched {
	id: number;
	name: string;
	department: string | null;
	canTeachOutsideDepartment: boolean;
	dailyMinutesByDay: Record<string, number>;
}

export interface DraftQueueItem {
	assignmentKey: string;
	entryKind: 'SECTION' | 'COHORT';
	sectionId: number;
	sectionName: string;
	gradeLevel: number;
	subjectId: number;
	subjectCode: string;
	subjectName: string;
	sessionNumber: number;
	sessionsPerWeek: number;
	preferredRoomType: RoomType;
	cohortCode: string | null;
	cohortName: string | null;
	programCode: string | null;
	programName: string | null;
	expectedEnrollment: number | null;
	facultyOptions: number[];
	/** Enriched faculty options with daily load context */
	facultyOptionsEnriched: FacultyOptionEnriched[];
	/** True when no faculty is assigned in teaching load for this session */
	hasNoTeacher: boolean;
}

export interface PeriodSlot {
	startTime: string;
	endTime: string;
	isSpecialEvent?: boolean;
	eventName?: string;
}

export interface DraftBoardState {
	placements: DraftPlacement[];
	queue: DraftQueueItem[];
	periodSlots: PeriodSlot[];
	classPeriodSlots?: PeriodSlot[];
	counts: {
		draft: number;
		lockedForRun: number;
		archived: number;
		unscheduled: number;
	};
	filters: {
		grades: number[];
		departments: string[];
		buildings: Array<{ id: number; name: string; shortCode: string | null }>;
	};
}

export interface DraftPlacementCommitResult {
	placement: DraftPlacement;
	preview: PreviewResult;
	board: DraftBoardState;
}

export interface DraftPlacementSwapPreview {
	allowed: boolean;
	hardViolations: Violation[];
	softViolations: Violation[];
	violationDelta: PreviewResult['violationDelta'];
	humanConflicts: HumanConflict[];
	policyImpactSummary: PolicyImpact[];
	dailyLoads: {
		source: {
			placementId: number;
			facultyId: number;
			day: string;
			dailyLoadBand: 'ok' | 'soft' | 'hard';
			dailyMinutesAfter: number;
			facultyWeeklyMinutes: Record<string, number>;
		};
		target: {
			placementId: number;
			facultyId: number;
			day: string;
			dailyLoadBand: 'ok' | 'soft' | 'hard';
			dailyMinutesAfter: number;
			facultyWeeklyMinutes: Record<string, number>;
		};
	};
}

export interface DraftPlacementSwapResult {
	placements: {
		source: DraftPlacement;
		target: DraftPlacement;
	};
	preview: DraftPlacementSwapPreview;
	board: DraftBoardState;
}

/* ─── Grade Shift Window types ─── */

export interface GradeShiftWindow {
	id: number;
	schoolId: number;
	schoolYearId: number;
	gradeLevel: number;
	programType?: 'REGULAR' | 'STE' | 'SPS' | 'SPA' | 'SPJ' | 'SPFL' | 'SPTVE' | 'OTHER' | null;
	startTime: string;
	endTime: string;
	createdAt: string;
	updatedAt: string;
}

export interface GradeShiftWindowInput {
	gradeLevel: number;
	programType?: 'REGULAR' | 'STE' | 'SPS' | 'SPA' | 'SPJ' | 'SPFL' | 'SPTVE' | 'OTHER' | null;
	startTime: string;
	endTime: string;
}

/* ─── Section types (from enrollment adapter) ─── */

export interface ExternalSection {
	mirrorId?: number;
	id: number;
	name: string;
	maxCapacity: number;
	enrolledCount: number;
	gradeLevelId: number;
	gradeLevelName: string;
	displayOrder: number;
	homeRoomId?: number | null;
	buildingZoneId?: string | null;
	programType?: 'REGULAR' | 'STE' | 'SPS' | 'SPA' | 'SPJ' | 'SPFL' | 'SPTVE' | 'OTHER' | null;
	programCode?: string | null;
	programName?: string | null;
	upstreamProgramType?: string | null;
	isSpecialProgram?: boolean;
	tleProgramId?: number | null;
	tleSpecialization?: string | null;
	tleProgramCategory?: string | null;
	adviserId?: number | null;
	adviserName?: string | null;
	assignmentSpecializationCode?: string | null;
	assignmentSpecializationLabel?: string | null;
	assignmentRotationFamily?: string | null;
	assignmentRotationLaneId?: string | null;
	assignmentRotationTermRank?: number | null;
	assignmentRotationTermLabel?: string | null;
	assignmentRotationTermGroupId?: string | null;
	assignmentRotationTermCount?: number | null;
	assignmentRawMinutesPerWeek?: number | null;
	assignmentConcurrentDeltaMinutesPerWeek?: number | null;
	assignmentExpandsConcurrentDemand?: boolean | null;
}

export type FacultyTeachingAssignmentIdentity = {
	subjectId: number;
	subjectCode: string;
	subjectName: string;
	subjectDisplayLabel: string;
	sectionId: number;
	sectionName: string;
	gradeLevel: number;
	specializationCode: string | null;
	specializationLabel: string | null;
};

export interface SectionsByGrade {
	gradeLevelId: number;
	gradeLevelName: string;
	displayOrder: number;
	sections: ExternalSection[];
}

export interface SectionSummaryResponse {
	schoolId: number;
	schoolYearId: number;
	totalSections: number;
	totalEnrolled: number;
	byGradeLevel: Record<number, number>;
	enrolledByGradeLevel: Record<number, number>;
	sections: ExternalSection[];
	gradeLevels?: SectionsByGrade[];
	source?: 'enrollpro' | 'stub' | 'cached-enrollpro' | 'atlas-mirror';
	sourceMode?: 'stub' | 'enrollpro' | 'auto';
	fallbackReason?: string;
	contractWarnings?: string[];
}

export interface SectionAssignedClassRow {
	subjectId: number;
	subjectCode: string;
	subjectName: string;
	subjectDisplayLabel: string;
	minMinutesPerWeek: number;
	rotationFamily: string | null;
	rotationTermRank: number | null;
	rotationTermLabel: string | null;
	rotationTermGroupId: string | null;
	rotationTermCount: number | null;
	facultyId: number;
	facultyName: string;
	facultyDepartment: string | null;
	facultySpecialization: string | null;
	assignmentKind: 'REAL_OWNERSHIP';
	specializationCode: string | null;
	specializationLabel: string | null;
}

export interface SectionUnassignedExpectedClassRow {
	subjectId: number;
	subjectCode: string;
	subjectName: string;
	subjectDisplayLabel: string;
	minMinutesPerWeek: number;
	rotationFamily: string | null;
	rotationTermRank: number | null;
	rotationTermLabel: string | null;
	rotationTermGroupId: string | null;
	rotationTermCount: number | null;
}

export interface SectionAssignedClassesTotals {
	assignedClassCount: number;
	rotationFamilyClassCount: number;
	unassignedClassCount: number;
}

export interface SectionAssignedClassesResult {
	sectionId: number;
	sectionName: string;
	gradeLevel: number;
	programType: string;
	schoolYearId: number;
	classes: SectionAssignedClassRow[];
	totals: SectionAssignedClassesTotals;
	staleOwnership?: Array<{
		subjectId: number;
		subjectCode: string;
		subjectName: string;
		sectionId: number;
		facultyId: number;
		facultyName: string;
		reason: 'STALE_OWNERSHIP' | 'INACTIVE_OWNERSHIP';
	}>;
	unassignedExpectedClasses?: SectionUnassignedExpectedClassRow[];
}

export interface SectionAssignedClassesIndexResult {
	schoolId: number;
	schoolYearId: number;
	sections: SectionAssignedClassesResult[];
	fetchedAt: string;
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
	teacherMoveEnabled: boolean;
	periodLengthMinutes: number;
	periodsPerDay: number;
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
	showSpecialEventsInGrid: boolean;
	enableFlagCeremony: boolean;
	flagCeremonyStartTime: string;
	flagCeremonyEndTime: string;
	enableRecess: boolean;
	recessStartTime: string;
	recessEndTime: string;
	enableLunchWindow: boolean;
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

export type CoverageMode =
	| 'REAL_FACULTY_STANDARD'
	| 'REAL_FACULTY_HARD_CAP'
	| 'REAL_FACULTY_THEN_TEACHER_X';

export type StaffingCrossTrainee = {
	department: string;
	availableTeachers: number;
	totalSpareHours: number;
	qualifiedRecoveryHoursPerWeek?: number;
};

export type StaffingTruthBucket = {
	shortageRows: number;
	shortageConcurrentHoursPerWeek: number;
	shortageConcurrentMinutesPerWeek: number;
	rowsClosedByRealFaculty: number;
	rowsClosedByTeacherX: number;
};

export type StaffingTruthComparison = {
	baseline: {
		totalTeachableRows: number;
		realCoveredRows: number;
		syntheticCoveredRows: number;
		unassignedRows: number;
	};
	realOnly: StaffingTruthBucket;
	hardCap: StaffingTruthBucket;
	teacherX: StaffingTruthBucket;
};

export type StaffingReport = {
	department: string;
	dominantShortageDepartment?: string;
	unassignedSections: number;
	missingHoursPerWeek: number;
	concurrentUnassignedSections?: number;
	concurrentMissingHoursPerWeek?: number;
	recoverableConcurrentRows?: number;
	recoverableConcurrentMissingHoursPerWeek?: number;
	recoverableConcurrentMissingMinutesPerWeek?: number;
	constrainedConcurrentRows?: number;
	constrainedConcurrentMissingHoursPerWeek?: number;
	constrainedConcurrentMissingMinutesPerWeek?: number;
	recommendedNewHires: number;
	internalCrossTrainees: StaffingCrossTrainee[];
	missingMinutesPerWeek: number;
	concurrentMissingMinutesPerWeek?: number;
	rotationAdjustedMinutesPerWeek?: number;
	shortages: Array<{
		department: string;
		count: number;
		missingMinutesPerWeek: number;
		concurrentCount?: number;
		concurrentMissingMinutesPerWeek?: number;
		recoverableConcurrentCount?: number;
		recoverableConcurrentMissingMinutesPerWeek?: number;
		constrainedConcurrentCount?: number;
		constrainedConcurrentMissingMinutesPerWeek?: number;
		rotationAdjustedMinutesPerWeek?: number;
		sections: Array<{
			subjectId: number;
			subjectCode: string;
			subjectName: string;
			sectionId: number;
			sectionName: string;
			programType: string;
		}>;
	}>;
};

export type AutoFillSummaryResult = {
	preserved: number;
	created: number;
	assignmentsCreated: number;
	uniqueTeachersAffected: number;
	unresolved: number;
	coverageMode?: CoverageMode;
	warnings: string[];
	sectionSource?: 'enrollpro' | 'stub' | 'cached-enrollpro' | 'atlas-mirror';
	sectionFallbackReason?: string | null;
	staffingReport: StaffingReport;
	staffingTruth?: StaffingTruthComparison;
	teacherXResolution?: {
		applied: boolean;
		rowsClosedByTeacherX: number;
		createdPlaceholders: number;
		reusedPlaceholders: number;
		placeholderAssignmentsUpserted: number;
		resolvedSubjectCodes: string[];
		stillUncoveredSubjectCodes: string[];
	};
	specialProgramApprovalQueue?: {
		subjectCode: string;
		subjectName: string;
		facultyId: number;
		facultyName: string;
		department: string | null;
		specialization: string | null;
		currentTotalAssignedPairs: number;
		requiredSpecializationCodes: string[];
		reason: string;
	}[];
};

export type LoadStatus = 'below-standard' | 'compliant' | 'overload-allowed' | 'over-cap';

export type LoadBreakdownItem = {
	subjectId: number;
	subjectName: string;
	subjectCode: string;
	rotationFamily: string | null;
	rotationTermRank: number | null;
	rotationTermLabel: string | null;
	rotationTermGroupId: string | null;
	rotationTermCount: number | null;
	isRotationDuplicate: boolean;
	sectionId: number;
	sectionName: string;
	gradeLevel: number;
	minutesPerWeek: number;
	totalMinutes: number;
};

export type RotationFamilyBreakdownItem = {
	family: string;
	rawHours: number;
	creditedHours: number;
	overcountHours: number;
	unitCount: number;
	dominantTermRank?: number | null;
	dominantTermLabel?: string | null;
	termGroupId?: string | null;
	termCount?: number | null;
	termBuckets: {
		termRank: number | null;
		termLabel: string | null;
		termGroupId: string | null;
		termCount: number | null;
		creditedMinutes: number;
		unitCount: number;
		subjectCodes: string[];
	}[];
	subjectCodes: string[];
};

export type LoadProfile = {
	actualTeachingHours: number;
	rawTeachingHours: number;
	rotationOvercountHours: number;
	equivalentHours: number;
	creditedTotalHours: number;
	overloadHours: number;
	overCapHours: number;
	status: LoadStatus;
	statusLabel: string;
	rotationFamilies: RotationFamilyBreakdownItem[];
	breakdown: LoadBreakdownItem[];
};

export type FacultyOwnershipState = {
	facultyId: number;
	facultyName: string;
	source: 'saved' | 'pending';
};

export type SubjectSectionOwnershipIndexEntry = {
	subjectId: number;
	sectionId: number;
	facultyId: number;
	facultyName: string;
};


