import { Router } from 'express';
import type { Request, Response, NextFunction } from 'express';
import { authenticate, authenticateWithSystemToken } from '../middleware/authenticate.js';
import { getUpstreamAuthToken } from '../middleware/upstream-auth.js';
import { requirePrivilegedRole } from '../middleware/authorize.js';
import * as assignmentService from '../services/faculty-assignment.service.js';
import {
	autoFill,
	COVERAGE_MODES,
	previewOrApplyOverCapRebalance,
	previewOrApplyTeachingLoadSplitBrainReconcile,
	type CoverageMode,
} from '../services/teaching-load-automation.service.js';
import {
	applyTeachingLoadSuggestionProposal,
	cancelTeachingLoadSuggestionProposal,
	createTeachingLoadSuggestionProposal,
} from '../services/teaching-load-suggestion-proposal.service.js';
import { fetchEnrollProActiveSchoolYear } from '../services/section-adapter.js';
import { publishNotificationEvent } from '../services/notification-events.service.js';
import { prisma } from '../lib/prisma.js';
import { getOrCreateTeachingLoadCycleSource, getTeachingLoadCycle } from '../services/teaching-load-cycle.service.js';

const router = Router();

function parseCoverageMode(value: unknown): CoverageMode | null {
	if (value == null) {
		return null;
	}
	if (typeof value !== 'string') {
		return null;
	}
	const normalized = value.trim().toUpperCase() as CoverageMode;
	if (!COVERAGE_MODES.includes(normalized)) {
		return null;
	}
	return normalized;
}

function parsePositiveQueryInteger(value: unknown): number | undefined {
	if (typeof value !== 'string' || value.trim() === '') {
		return undefined;
	}
	const parsed = Number(value);
	return Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : undefined;
}

async function publishTeachingLoadCycleChanged(schoolId: number, schoolYearId: number, message: string): Promise<void> {
	const source = await getOrCreateTeachingLoadCycleSource(schoolId, schoolYearId);
	publishNotificationEvent({
		type: 'TEACHING_LOAD_CHANGED',
		domain: 'integration',
		severity: 'info',
		audience: 'PRIVILEGED',
		schoolId,
		schoolYearId,
		facultyId: null,
		message,
		metadata: { schoolYearId, state: source.state, version: source.version, updatedAt: source.updatedAt },
	});
}

async function rejectUnscopedHistoricalTeachingLoad(schoolId: number, schoolYearId: number, explicitlyRequested: boolean, res: Response): Promise<boolean> {
	if (!explicitlyRequested) return false;
	const cycle = await getTeachingLoadCycle(schoolId, schoolYearId);
	if (cycle) return false;
	res.status(404).json({
		code: 'TEACHING_LOAD_CYCLE_NOT_FOUND',
		message: 'This school year has no annual Teaching Load cycle. Legacy unscoped assignments are not available as historical truth.',
	});
	return true;
}

function parseSummaryListOptions(req: Request): { requested: boolean; options: assignmentService.AssignmentSummaryListOptions } {
	const query = typeof req.query.query === 'string' ? req.query.query : undefined;
	const scheduling = typeof req.query.scheduling === 'string' ? req.query.scheduling : undefined;
	const assignment = typeof req.query.assignment === 'string' ? req.query.assignment : undefined;
	const department = typeof req.query.department === 'string' ? req.query.department : undefined;
	const sortField = typeof req.query.sortField === 'string' ? req.query.sortField : undefined;
	const sortDir = typeof req.query.sortDir === 'string' ? req.query.sortDir : undefined;
	const page = parsePositiveQueryInteger(req.query.page);
	const pageSize = parsePositiveQueryInteger(req.query.pageSize);
	const gradeLevelRaw = typeof req.query.gradeLevel === 'string' && req.query.gradeLevel.trim() !== ''
		? Number(req.query.gradeLevel)
		: undefined;
	const gradeLevel = gradeLevelRaw != null && Number.isFinite(gradeLevelRaw) ? gradeLevelRaw : undefined;
	const requested = [
		req.query.page,
		req.query.pageSize,
		req.query.query,
		req.query.scheduling,
		req.query.assignment,
		req.query.department,
		req.query.gradeLevel,
		req.query.sortField,
		req.query.sortDir,
	].some((value) => value !== undefined);

	return {
		requested,
		options: {
			page,
			pageSize,
			query,
			scheduling: scheduling as assignmentService.AssignmentSummarySchedulingFilter | undefined,
			assignment: assignment as assignmentService.AssignmentSummaryAssignmentFilter | undefined,
			department,
			gradeLevel,
			sortField: sortField as assignmentService.AssignmentSummarySortField | undefined,
			sortDir: sortDir as assignmentService.AssignmentSummarySortDir | undefined,
		},
	};
}

// Auth: GET /faculty-assignments/summary?schoolId=X&schoolYearId=Y
router.get('/summary', authenticateWithSystemToken, requirePrivilegedRole, async (req: Request, res: Response, next: NextFunction) => {
	try {
		const schoolId = Number(req.query.schoolId);
		if (!schoolId || Number.isNaN(schoolId)) {
			res.status(400).json({ code: 'INVALID_PARAM', message: 'schoolId query parameter is required.' });
			return;
		}
		const upstreamAuthToken = getUpstreamAuthToken(req);

		let schoolYearId: number;
		const explicitlyRequestedSchoolYear = req.query.schoolYearId !== undefined;
		if (explicitlyRequestedSchoolYear) {
			schoolYearId = Number(req.query.schoolYearId);
			if (!schoolYearId || Number.isNaN(schoolYearId)) {
				res.status(400).json({ code: 'INVALID_PARAM', message: 'schoolYearId must be a valid number when provided.' });
				return;
			}
		} else {
			const activeYear = await fetchEnrollProActiveSchoolYear(upstreamAuthToken);
			if (!activeYear?.id) {
				res.status(400).json({
					code: 'ACTIVE_SCHOOL_YEAR_UNAVAILABLE',
					message: 'Unable to resolve active school year from EnrollPro. Provide schoolYearId explicitly.',
				});
				return;
			}
			 schoolYearId = activeYear.id;
		}
		if (await rejectUnscopedHistoricalTeachingLoad(schoolId, schoolYearId, explicitlyRequestedSchoolYear, res)) {
			return;
		}

		const { requested: listRequested, options: listOptions } = parseSummaryListOptions(req);
		const summary = await assignmentService.getAssignmentSummary(
			schoolId,
			schoolYearId,
			upstreamAuthToken,
			listRequested ? listOptions : undefined,
		);
		const listPage = summary.listPage;
		const fetchedAt = summary.faculty.length > 0 ? (summary.faculty[0] as any).fetchedAt || null : null;
		res.json({
			faculty: listRequested ? listPage.items : summary.faculty,
			items: listPage.items,
			page: listPage.page,
			pageSize: listPage.pageSize,
			total: listPage.total,
			totalPages: listPage.totalPages,
			query: listPage.query,
			pagination: {
				page: listPage.page,
				pageSize: listPage.pageSize,
				total: listPage.total,
				totalPages: listPage.totalPages,
				query: listPage.query,
			},
			filters: listPage.filters,
			sort: listPage.sort,
			departments: listPage.departments,
			rosterStats: listPage.rosterStats,
			ownershipIndex: summary.ownershipIndex,
			coverageTotals: summary.coverageTotals,
			integrityDiagnostics: summary.integrityDiagnostics,
			source: summary.source,
			schoolYearId,
			fetchedAt,
		});
	} catch (err) {
		next(err);
	}
});

// Auth: GET /faculty-assignments/coverage/summary?schoolId=X&schoolYearId=Y
router.get('/coverage/summary', authenticateWithSystemToken, requirePrivilegedRole, async (req: Request, res: Response, next: NextFunction) => {
	try {
		const schoolId = Number(req.query.schoolId);
		const schoolYearId = Number(req.query.schoolYearId);
		if (!schoolId || Number.isNaN(schoolId)) {
			res.status(400).json({ code: 'INVALID_PARAM', message: 'schoolId query parameter is required.' });
			return;
		}
		if (!schoolYearId || Number.isNaN(schoolYearId)) {
			res.status(400).json({ code: 'INVALID_PARAM', message: 'schoolYearId query parameter is required.' });
			return;
		}

		const upstreamAuthToken = getUpstreamAuthToken(req);
		const coverage = await assignmentService.getActiveSubjectCoverageSummary(schoolId, schoolYearId, upstreamAuthToken);
		res.json(coverage);
	} catch (err) {
		next(err);
	}
});

// Auth: POST /faculty-assignments/coverage/repair
// Body: { schoolId: number, schoolYearId: number, apply?: boolean, subjectCodes?: string[] }
router.post('/coverage/repair', authenticateWithSystemToken, requirePrivilegedRole, async (req: Request, res: Response, next: NextFunction) => {
	try {
		const schoolId = Number(req.body.schoolId);
		const schoolYearId = Number(req.body.schoolYearId);
		if (!schoolId || Number.isNaN(schoolId)) {
			res.status(400).json({ code: 'INVALID_PARAM', message: 'schoolId is required.' });
			return;
		}
		if (!schoolYearId || Number.isNaN(schoolYearId)) {
			res.status(400).json({ code: 'INVALID_PARAM', message: 'schoolYearId is required.' });
			return;
		}

		const subjectCodes = Array.isArray(req.body.subjectCodes)
			? req.body.subjectCodes.filter((value: unknown): value is string => typeof value === 'string')
			: undefined;
		const apply = req.body.apply === true;
		const upstreamAuthToken = getUpstreamAuthToken(req);

		const result = await assignmentService.repairActiveSubjectCoverageWithPlaceholders({
			schoolId,
			schoolYearId,
			assignedBy: req.user?.userId ?? 0,
			authToken: upstreamAuthToken,
			subjectCodes,
			apply,
		});

		res.json(result);
	} catch (err) {
		next(err);
	}
});

// Auth: POST /faculty-assignments/coverage/rebalance-special-programs
// Body: { schoolId: number, schoolYearId: number, apply?: boolean, subjectCodes?: string[] }
router.post('/coverage/rebalance-special-programs', authenticateWithSystemToken, requirePrivilegedRole, async (req: Request, res: Response, next: NextFunction) => {
	try {
		const schoolId = Number(req.body.schoolId);
		const schoolYearId = Number(req.body.schoolYearId);
		if (!schoolId || Number.isNaN(schoolId)) {
			res.status(400).json({ code: 'INVALID_PARAM', message: 'schoolId is required.' });
			return;
		}
		if (!schoolYearId || Number.isNaN(schoolYearId)) {
			res.status(400).json({ code: 'INVALID_PARAM', message: 'schoolYearId is required.' });
			return;
		}

		const subjectCodes = Array.isArray(req.body.subjectCodes)
			? req.body.subjectCodes.filter((value: unknown): value is string => typeof value === 'string')
			: undefined;
		const apply = req.body.apply === true;
		const upstreamAuthToken = getUpstreamAuthToken(req);

		const result = await assignmentService.previewOrApplySpecialProgramRedistribution({
			schoolId,
			schoolYearId,
			actorId: req.user?.userId ?? 0,
			authToken: upstreamAuthToken,
			subjectCodes,
			apply,
		});

		res.json(result);
	} catch (err) {
		next(err);
	}
});

// Auth: POST /faculty-assignments/coverage/recover-real-faculty
// Body: { schoolId: number, schoolYearId: number, apply?: boolean, subjectCodes?: string[] }
router.post('/coverage/recover-real-faculty', authenticateWithSystemToken, requirePrivilegedRole, async (req: Request, res: Response, next: NextFunction) => {
	try {
		const schoolId = Number(req.body.schoolId);
		const schoolYearId = Number(req.body.schoolYearId);
		if (!schoolId || Number.isNaN(schoolId)) {
			res.status(400).json({ code: 'INVALID_PARAM', message: 'schoolId is required.' });
			return;
		}
		if (!schoolYearId || Number.isNaN(schoolYearId)) {
			res.status(400).json({ code: 'INVALID_PARAM', message: 'schoolYearId is required.' });
			return;
		}

		const subjectCodes = Array.isArray(req.body.subjectCodes)
			? req.body.subjectCodes.filter((value: unknown): value is string => typeof value === 'string')
			: undefined;
		const apply = req.body.apply === true;
		const upstreamAuthToken = getUpstreamAuthToken(req);

		const result = await assignmentService.previewOrApplyRealFacultyRecovery({
			schoolId,
			schoolYearId,
			actorId: req.user?.userId ?? 0,
			authToken: upstreamAuthToken,
			subjectCodes,
			apply,
		});

		res.json(result);
	} catch (err) {
		next(err);
	}
});

// Auth: POST /faculty-assignments/coverage/rebalance-over-cap
// Body: { schoolId: number, schoolYearId: number, previewOnly?: boolean, confirmApply?: boolean }
router.post('/coverage/rebalance-over-cap', authenticate, requirePrivilegedRole, async (req: Request, res: Response, next: NextFunction) => {
	try {
		const schoolId = Number(req.body.schoolId);
		const schoolYearId = Number(req.body.schoolYearId);
		const previewOnly = req.body.previewOnly !== false;
		const confirmApply = req.body.confirmApply === true;

		if (!schoolId || Number.isNaN(schoolId)) {
			res.status(400).json({ code: 'INVALID_PARAM', message: 'schoolId is required.' });
			return;
		}
		if (!schoolYearId || Number.isNaN(schoolYearId)) {
			res.status(400).json({ code: 'INVALID_PARAM', message: 'schoolYearId is required.' });
			return;
		}
		if (!previewOnly && !confirmApply) {
			res.status(400).json({
				code: 'CONFIRMATION_REQUIRED',
				message: 'confirmApply=true is required to apply over-cap rebalance.',
			});
			return;
		}

		const authToken = getUpstreamAuthToken(req);
		const result = await previewOrApplyOverCapRebalance({
			schoolId,
			schoolYearId,
			actorId: req.user?.userId ?? 0,
			authToken,
			previewOnly,
		});

		res.json(result);
	} catch (err) {
		next(err);
	}
});

// Auth: POST /faculty-assignments/reset
// Body: { schoolId: number, schoolYearId: number, previewOnly?: boolean, confirmReset?: boolean, subjectId?: number }
router.post('/reset', authenticate, requirePrivilegedRole, async (req: Request, res: Response, next: NextFunction) => {
	try {
		const schoolId = Number(req.body.schoolId);
		const schoolYearId = Number(req.body.schoolYearId);
		const previewOnly = req.body.previewOnly !== false;
		const confirmReset = req.body.confirmReset === true;
		const subjectId = req.body.subjectId !== undefined ? Number(req.body.subjectId) : undefined;

		if (!schoolId || Number.isNaN(schoolId)) {
			res.status(400).json({ code: 'INVALID_PARAM', message: 'schoolId is required.' });
			return;
		}
		if (!schoolYearId || Number.isNaN(schoolYearId)) {
			res.status(400).json({ code: 'INVALID_PARAM', message: 'schoolYearId is required.' });
			return;
		}
		if (subjectId !== undefined && (!subjectId || Number.isNaN(subjectId))) {
			res.status(400).json({ code: 'INVALID_PARAM', message: 'subjectId must be a valid number when provided.' });
			return;
		}
		if (!previewOnly && !confirmReset) {
			res.status(400).json({
				code: 'CONFIRMATION_REQUIRED',
				message: 'confirmReset=true is required to apply teaching-load reset.',
			});
			return;
		}

		const authToken = getUpstreamAuthToken(req);
		const result = await assignmentService.previewOrApplyTeachingLoadReset({
			schoolId,
			schoolYearId,
			actorId: req.user?.userId ?? 0,
			authToken,
			subjectId,
			previewOnly,
		});

		res.json(result);
	} catch (err) {
		next(err);
	}
});

// Auth: POST /faculty-assignments/integrity/reconcile
// Body: { schoolId: number, schoolYearId: number, previewOnly?: boolean, confirmApply?: boolean }
router.post('/integrity/reconcile', authenticate, requirePrivilegedRole, async (req: Request, res: Response, next: NextFunction) => {
	try {
		const schoolId = Number(req.body.schoolId);
		const schoolYearId = Number(req.body.schoolYearId);
		const previewOnly = req.body.previewOnly !== false;
		const confirmApply = req.body.confirmApply === true;

		if (!schoolId || Number.isNaN(schoolId)) {
			res.status(400).json({ code: 'INVALID_PARAM', message: 'schoolId is required.' });
			return;
		}
		if (!schoolYearId || Number.isNaN(schoolYearId)) {
			res.status(400).json({ code: 'INVALID_PARAM', message: 'schoolYearId is required.' });
			return;
		}
		if (!previewOnly && !confirmApply) {
			res.status(400).json({
				code: 'CONFIRMATION_REQUIRED',
				message: 'confirmApply=true is required to apply integrity reconciliation.',
			});
			return;
		}

		const authToken = getUpstreamAuthToken(req);
		const result = await assignmentService.previewOrApplyTeachingLoadTruthReconcile({
			schoolId,
			schoolYearId,
			actorId: req.user?.userId ?? 0,
			authToken,
			previewOnly,
		});

		res.json(result);
	} catch (err) {
		next(err);
	}
});

// Auth: POST /faculty-assignments/integrity/reconcile-stale-ownership
// Body: { schoolId: number, schoolYearId: number, previewOnly?: boolean, confirmApply?: boolean }
router.post('/integrity/reconcile-stale-ownership', authenticate, requirePrivilegedRole, async (req: Request, res: Response, next: NextFunction) => {
	try {
		const schoolId = Number(req.body.schoolId);
		const schoolYearId = Number(req.body.schoolYearId);
		const previewOnly = req.body.previewOnly !== false;
		const confirmApply = req.body.confirmApply === true;

		if (!schoolId || Number.isNaN(schoolId)) {
			res.status(400).json({ code: 'INVALID_PARAM', message: 'schoolId is required.' });
			return;
		}
		if (!schoolYearId || Number.isNaN(schoolYearId)) {
			res.status(400).json({ code: 'INVALID_PARAM', message: 'schoolYearId is required.' });
			return;
		}
		if (!previewOnly && !confirmApply) {
			res.status(400).json({
				code: 'CONFIRMATION_REQUIRED',
				message: 'confirmApply=true is required to apply stale ownership reconciliation.',
			});
			return;
		}

		const authToken = getUpstreamAuthToken(req);
		const result = await assignmentService.previewOrApplyStaleOwnershipReconcile({
			schoolId,
			schoolYearId,
			actorId: req.user?.userId ?? 0,
			authToken,
			previewOnly,
		});

		res.json(result);
	} catch (err) {
		next(err);
	}
});

// Auth: POST /faculty-assignments/integrity/reconcile-split-brain
// Body: { schoolId: number, schoolYearId: number, previewOnly?: boolean, confirmApply?: boolean }
router.post('/integrity/reconcile-split-brain', authenticate, requirePrivilegedRole, async (req: Request, res: Response, next: NextFunction) => {
	try {
		const schoolId = Number(req.body.schoolId);
		const schoolYearId = Number(req.body.schoolYearId);
		const previewOnly = req.body.previewOnly !== false;
		const confirmApply = req.body.confirmApply === true;

		if (!schoolId || Number.isNaN(schoolId)) {
			res.status(400).json({ code: 'INVALID_PARAM', message: 'schoolId is required.' });
			return;
		}
		if (!schoolYearId || Number.isNaN(schoolYearId)) {
			res.status(400).json({ code: 'INVALID_PARAM', message: 'schoolYearId is required.' });
			return;
		}
		if (!previewOnly && !confirmApply) {
			res.status(400).json({
				code: 'CONFIRMATION_REQUIRED',
				message: 'confirmApply=true is required to apply split-brain reconciliation.',
			});
			return;
		}
		if (!previewOnly) {
			res.status(409).json({
				code: 'ANNUAL_SCOPE_RECONCILE_RETIRED',
				message: 'The combined split-brain reconciliation path is retired. Resolve only the affected current-year ownership rows.',
			});
			return;
		}

		const authToken = getUpstreamAuthToken(req);
		const result = await previewOrApplyTeachingLoadSplitBrainReconcile({
			schoolId,
			schoolYearId,
			actorId: req.user?.userId ?? 0,
			authToken,
			previewOnly,
		});

		res.json(result);
	} catch (err) {
		next(err);
	}
});

// Auth: GET /faculty-assignments/capability-overrides?schoolId=X&schoolYearId=Y
router.get('/capability-overrides', authenticate, requirePrivilegedRole, async (req: Request, res: Response, next: NextFunction) => {
	try {
		const schoolId = Number(req.query.schoolId);
		const schoolYearId = Number(req.query.schoolYearId);

		if (!schoolId || Number.isNaN(schoolId)) {
			res.status(400).json({ code: 'INVALID_PARAM', message: 'schoolId query parameter is required.' });
			return;
		}
		if (!schoolYearId || Number.isNaN(schoolYearId)) {
			res.status(400).json({ code: 'INVALID_PARAM', message: 'schoolYearId query parameter is required.' });
			return;
		}

		const overrides = await assignmentService.listTeachingLoadCapabilityOverrides(schoolId, schoolYearId);
		res.json({ overrides });
	} catch (err) {
		next(err);
	}
});

// Auth: PUT /faculty-assignments/capability-overrides
// Body: { schoolId, schoolYearId, facultyId, subjectCode?, specializationCode?, specializationLabel?, note? }
router.put('/capability-overrides', authenticate, requirePrivilegedRole, async (req: Request, res: Response, next: NextFunction) => {
	try {
		const schoolId = Number(req.body.schoolId);
		const schoolYearId = Number(req.body.schoolYearId);
		const facultyId = Number(req.body.facultyId);

		if (!schoolId || Number.isNaN(schoolId)) {
			res.status(400).json({ code: 'INVALID_PARAM', message: 'schoolId is required.' });
			return;
		}
		if (!schoolYearId || Number.isNaN(schoolYearId)) {
			res.status(400).json({ code: 'INVALID_PARAM', message: 'schoolYearId is required.' });
			return;
		}
		if (!facultyId || Number.isNaN(facultyId)) {
			res.status(400).json({ code: 'INVALID_PARAM', message: 'facultyId is required.' });
			return;
		}

		const overrides = await assignmentService.upsertTeachingLoadCapabilityOverride({
			schoolId,
			schoolYearId,
			facultyId,
			subjectCode: typeof req.body.subjectCode === 'string' ? req.body.subjectCode : null,
			specializationCode: typeof req.body.specializationCode === 'string' ? req.body.specializationCode : null,
			specializationLabel: typeof req.body.specializationLabel === 'string' ? req.body.specializationLabel : null,
			note: typeof req.body.note === 'string' ? req.body.note : null,
			approvedBy: req.user?.userId ?? 0,
		});

		res.json({ overrides });
	} catch (err) {
		next(err);
	}
});

// Auth: DELETE /faculty-assignments/capability-overrides
// Body: { schoolId, schoolYearId, facultyId, subjectCode?, specializationCode? }
router.delete('/capability-overrides', authenticate, requirePrivilegedRole, async (req: Request, res: Response, next: NextFunction) => {
	try {
		const schoolId = Number(req.body.schoolId);
		const schoolYearId = Number(req.body.schoolYearId);
		const facultyId = Number(req.body.facultyId);

		if (!schoolId || Number.isNaN(schoolId)) {
			res.status(400).json({ code: 'INVALID_PARAM', message: 'schoolId is required.' });
			return;
		}
		if (!schoolYearId || Number.isNaN(schoolYearId)) {
			res.status(400).json({ code: 'INVALID_PARAM', message: 'schoolYearId is required.' });
			return;
		}
		if (!facultyId || Number.isNaN(facultyId)) {
			res.status(400).json({ code: 'INVALID_PARAM', message: 'facultyId is required.' });
			return;
		}

		const overrides = await assignmentService.deleteTeachingLoadCapabilityOverride({
			schoolId,
			schoolYearId,
			facultyId,
			subjectCode: typeof req.body.subjectCode === 'string' ? req.body.subjectCode : null,
			specializationCode: typeof req.body.specializationCode === 'string' ? req.body.specializationCode : null,
		});

		res.json({ overrides });
	} catch (err) {
		next(err);
	}
});

// POST /faculty-assignments/suggestion-proposals
// Persists a reviewed Teaching Load suggestion preview without writing Teaching Load rows.
// Body: { schoolId: number, schoolYearId: number, coverageMode?: CoverageMode }
router.post('/suggestion-proposals', authenticate, requirePrivilegedRole, async (req: Request, res: Response, next: NextFunction) => {
	try {
		const schoolId = Number(req.body.schoolId);
		const schoolYearId = Number(req.body.schoolYearId);
		const coverageMode = parseCoverageMode(req.body.coverageMode);

		if (!schoolId || Number.isNaN(schoolId)) {
			res.status(400).json({ code: 'INVALID_PARAM', message: 'schoolId is required.' });
			return;
		}
		if (!schoolYearId || Number.isNaN(schoolYearId)) {
			res.status(400).json({ code: 'INVALID_PARAM', message: 'schoolYearId is required.' });
			return;
		}
		if (req.body.coverageMode != null && !coverageMode) {
			res.status(400).json({
				code: 'INVALID_PARAM',
				message: `coverageMode must be one of: ${COVERAGE_MODES.join(', ')}`,
			});
			return;
		}

		const authToken = getUpstreamAuthToken(req);
		const result = await createTeachingLoadSuggestionProposal({
			schoolId,
			schoolYearId,
			actorId: req.user?.userId ?? 0,
			authToken,
			coverageMode: coverageMode ?? undefined,
		});
		res.status(201).json(result);
	} catch (err) {
		next(err);
	}
});

// Auth: GET /faculty-assignments/effective?schoolId=X&schoolYearId=Y
// Lean annual contract for AIMS and SMART. Legacy unscoped records are never returned.
router.get('/effective', authenticateWithSystemToken, requirePrivilegedRole, async (req: Request, res: Response, next: NextFunction) => {
	try {
		const schoolId = Number(req.query.schoolId);
		if (!schoolId || Number.isNaN(schoolId)) {
			res.status(400).json({ code: 'INVALID_PARAM', message: 'schoolId query parameter is required.' });
			return;
		}
		const upstreamAuthToken = getUpstreamAuthToken(req);
		const explicitlyRequestedSchoolYear = req.query.schoolYearId !== undefined;
		let schoolYearId = Number(req.query.schoolYearId);
		if (!schoolYearId || Number.isNaN(schoolYearId)) {
			const activeYear = await fetchEnrollProActiveSchoolYear(upstreamAuthToken);
			if (!activeYear?.id) {
				res.status(400).json({ code: 'ACTIVE_SCHOOL_YEAR_UNAVAILABLE', message: 'Unable to resolve active school year from EnrollPro. Provide schoolYearId explicitly.' });
				return;
			}
			schoolYearId = activeYear.id;
		}
		if (await rejectUnscopedHistoricalTeachingLoad(schoolId, schoolYearId, explicitlyRequestedSchoolYear, res)) {
			return;
		}
		const effective = await assignmentService.getEffectiveTeachingLoad(schoolId, schoolYearId, upstreamAuthToken);
		const activeMirror = await prisma.enrollProSchoolYearMirror.findFirst({
			where: { schoolId, enrollProSchoolYearId: schoolYearId, isActive: true },
			select: { id: true },
		});
		res.json({
			source: { ...effective.source, isActiveSchoolYear: activeMirror !== null },
			assignments: effective.assignments,
			coverageTotals: effective.coverageTotals,
		});
	} catch (err) {
		next(err);
	}
});

// POST /faculty-assignments/suggestion-proposals/:proposalId/apply
// Applies only a previously persisted pending Teaching Load suggestion proposal.
router.post('/suggestion-proposals/:proposalId/apply', authenticate, requirePrivilegedRole, async (req: Request, res: Response, next: NextFunction) => {
	try {
		const proposalId = Number(req.params.proposalId);
		if (!proposalId || Number.isNaN(proposalId)) {
			res.status(400).json({ code: 'INVALID_PARAM', message: 'proposalId must be a valid number.' });
			return;
		}

		const authToken = getUpstreamAuthToken(req);
		const result = await applyTeachingLoadSuggestionProposal({
			proposalId,
			actorId: req.user?.userId ?? 0,
			authToken,
		});
		res.json(result);
	} catch (err) {
		next(err);
	}
});

// POST /faculty-assignments/suggestion-proposals/:proposalId/cancel
// Cancels a pending reviewed Teaching Load suggestion proposal without writing Teaching Load rows.
router.post('/suggestion-proposals/:proposalId/cancel', authenticate, requirePrivilegedRole, async (req: Request, res: Response, next: NextFunction) => {
	try {
		const proposalId = Number(req.params.proposalId);
		if (!proposalId || Number.isNaN(proposalId)) {
			res.status(400).json({ code: 'INVALID_PARAM', message: 'proposalId must be a valid number.' });
			return;
		}

		const result = await cancelTeachingLoadSuggestionProposal({ proposalId });
		res.json(result);
	} catch (err) {
		next(err);
	}
});

// Auth: GET /faculty-assignments/:facultyId?schoolYearId=Y
router.get('/:facultyId', authenticate, requirePrivilegedRole, async (req: Request, res: Response, next: NextFunction) => {
	try {
		const facultyId = Number(req.params.facultyId);
		if (Number.isNaN(facultyId)) {
			res.status(400).json({ code: 'INVALID_PARAM', message: 'facultyId must be a number.' });
			return;
		}
		const schoolYearId = Number(req.query.schoolYearId);
		if (!schoolYearId || Number.isNaN(schoolYearId)) {
			res.status(400).json({ code: 'INVALID_PARAM', message: 'schoolYearId query parameter is required.' });
			return;
		}
		const authToken = getUpstreamAuthToken(req);
		const assignments = await assignmentService.getAssignmentsByFaculty(facultyId, schoolYearId, authToken);
		if (!assignments) {
			res.status(404).json({ code: 'NOT_FOUND', message: 'Faculty not found.' });
			return;
		}
		res.json(assignments);
	} catch (err) {
		next(err);
	}
});

// Auth: PUT /faculty-assignments/:facultyId — replace all assignments for a faculty member
router.put('/:facultyId', authenticate, requirePrivilegedRole, async (req: Request, res: Response, next: NextFunction) => {
	try {
		const facultyId = Number(req.params.facultyId);
		if (Number.isNaN(facultyId)) {
			res.status(400).json({ code: 'INVALID_PARAM', message: 'facultyId must be a number.' });
			return;
		}
		const { schoolId, schoolYearId, version, assignments } = req.body;
		if (!schoolId || !schoolYearId || version === undefined || !Array.isArray(assignments)) {
			res.status(400).json({ code: 'MISSING_FIELDS', message: 'schoolId, schoolYearId, version, and assignments array are required.' });
			return;
		}
		const assignedBy = req.user!.userId;
		const authToken = getUpstreamAuthToken(req);
		const result = await assignmentService.setAssignments(
			facultyId,
			Number(schoolId),
			Number(schoolYearId),
			assignedBy,
			Number(version),
			assignments,
			authToken,
		);
		if (!result.success) {
			const status = result.code === 'FACULTY_NOT_FOUND'
				? 404
				: result.code === 'VERSION_CONFLICT' || result.code === 'DUPLICATE_SECTION_OWNERSHIP'
					? 409
					: 400;
			res.status(status).json({ code: result.code, message: result.error, details: result.details });
			return;
		}
		const updated = await assignmentService.getAssignmentsByFaculty(facultyId, Number(schoolYearId), authToken);
		publishNotificationEvent({
			type: 'TEACHING_LOAD_CHANGED',
			domain: 'integration',
			severity: 'info',
			audience: 'PRIVILEGED',
			schoolId: Number(schoolId),
			schoolYearId: Number(schoolYearId),
			facultyId: null,
			message: 'Teaching Load assignments changed.',
			metadata: { facultyId, version: result.version },
		});
		res.json({ version: result.version, assignments: updated?.assignments ?? [] });
	} catch (err) {
		next(err);
	}
});

// POST /faculty-assignments/auto-fill
// Triggers the state-preserving auto-fill algorithm for unassigned subject×section pairs.
// Body: { schoolId: number, schoolYearId: number, previewOnly?: boolean, coverageMode?: CoverageMode }
router.post('/auto-fill', authenticate, requirePrivilegedRole, async (req: Request, res: Response, next: NextFunction) => {
	try {
		const schoolId = Number(req.body.schoolId);
		const schoolYearId = Number(req.body.schoolYearId);
		const previewOnly = req.body.previewOnly === true || req.body.previewOnly === 'true';
		const coverageMode = parseCoverageMode(req.body.coverageMode);

		if (!schoolId || Number.isNaN(schoolId)) {
			res.status(400).json({ code: 'INVALID_PARAM', message: 'schoolId is required.' });
			return;
		}
		if (!schoolYearId || Number.isNaN(schoolYearId)) {
			res.status(400).json({ code: 'INVALID_PARAM', message: 'schoolYearId is required.' });
			return;
		}
		if (req.body.coverageMode != null && !coverageMode) {
			res.status(400).json({
				code: 'INVALID_PARAM',
				message: `coverageMode must be one of: ${COVERAGE_MODES.join(', ')}`,
			});
			return;
		}

		const authToken = getUpstreamAuthToken(req);
		const result = await autoFill(schoolId, schoolYearId, authToken, { previewOnly, coverageMode: coverageMode ?? undefined });
		if (!previewOnly) {
			await publishTeachingLoadCycleChanged(schoolId, schoolYearId, 'Teaching Load auto-fill updated the annual assignment cycle.');
		}
		res.json(result);
	} catch (err) {
		next(err);
	}
});

// POST /faculty-assignments/report/staffing-needs
// Returns staffing shortage report based on current uncovered live pairs.
// Body: { schoolId: number, schoolYearId: number, coverageMode?: CoverageMode }
router.post('/report/staffing-needs', authenticate, requirePrivilegedRole, async (req: Request, res: Response, next: NextFunction) => {
	try {
		const schoolId = Number(req.body.schoolId);
		const schoolYearId = Number(req.body.schoolYearId);
		const coverageMode = parseCoverageMode(req.body.coverageMode);

		if (!schoolId || Number.isNaN(schoolId)) {
			res.status(400).json({ code: 'INVALID_PARAM', message: 'schoolId is required.' });
			return;
		}
		if (!schoolYearId || Number.isNaN(schoolYearId)) {
			res.status(400).json({ code: 'INVALID_PARAM', message: 'schoolYearId is required.' });
			return;
		}
		if (req.body.coverageMode != null && !coverageMode) {
			res.status(400).json({
				code: 'INVALID_PARAM',
				message: `coverageMode must be one of: ${COVERAGE_MODES.join(', ')}`,
			});
			return;
		}

		const authToken = getUpstreamAuthToken(req);
		const result = await autoFill(schoolId, schoolYearId, authToken, {
			previewOnly: true,
			staffingOnly: true,
			coverageMode: coverageMode ?? undefined,
		});
		res.json(result);
	} catch (err) {
		next(err);
	}
});

export default router;
