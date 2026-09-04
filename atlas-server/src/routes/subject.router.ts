import { Router } from 'express';
import type { Request, Response, NextFunction } from 'express';
import { authenticate } from '../middleware/authenticate.js';
import { getUpstreamAuthToken } from '../middleware/upstream-auth.js';
import { requirePrivilegedRole } from '../middleware/authorize.js';
import * as subjectService from '../services/subject.service.js';
import { publishNotificationEvent } from '../services/notification-events.service.js';

const router = Router();

/**
 * Prompt 01A: authenticated school scoping for subject mutations.
 *
 * The actor's school scope comes from the authenticated token (`req.user.schoolId`),
 * never from a client-supplied body/query value. A caller may only mutate
 * subjects belonging to their own school; cross-school subject IDs are rejected
 * with 403 before any write. The public GET routes remain school-explicit
 * (unauthenticated catalog reads) but subject lookups by id stay read-only.
 */
function resolveActorSchoolId(req: Request): number {
	const schoolId = Number(req.user?.schoolId);
	if (!Number.isInteger(schoolId) || schoolId <= 0) {
		// Scheduler-role tokens must carry a school scope; deny rather than default.
		return 0;
	}
	return schoolId;
}

// Public: GET /subjects?schoolId=X
router.get('/', async (req: Request, res: Response, next: NextFunction) => {
	try {
		const schoolId = Number(req.query.schoolId);
		if (!schoolId || Number.isNaN(schoolId)) {
			res.status(400).json({ code: 'INVALID_PARAM', message: 'schoolId query parameter is required.' });
			return;
		}
		const includeSte = req.query.includeSte !== 'false';
		const includeSpa = req.query.includeSpa !== 'false';
		const subjects = await subjectService.getSubjectsBySchool(schoolId, { includeSte, includeSpa });
		res.json({ subjects });
	} catch (err) {
		next(err);
	}
});

// Public: GET /subjects/:id
router.get('/:id', async (req: Request, res: Response, next: NextFunction) => {
	try {
		const id = Number(req.params.id);
		if (Number.isNaN(id)) {
			res.status(400).json({ code: 'INVALID_PARAM', message: 'id must be a number.' });
			return;
		}
		const subject = await subjectService.getSubjectById(id);
		if (!subject) {
			res.status(404).json({ code: 'NOT_FOUND', message: 'Subject not found.' });
			return;
		}
		res.json({ subject });
	} catch (err) {
		next(err);
	}
});

// Auth: POST /subjects â€” create a custom subject
router.post('/', authenticate, requirePrivilegedRole, async (req: Request, res: Response, next: NextFunction) => {
	try {
		const actorSchoolId = resolveActorSchoolId(req);
		if (!actorSchoolId) {
			res.status(403).json({ code: 'SCHOOL_SCOPE_REQUIRED', message: 'Authenticated school scope is required to create subjects.' });
			return;
		}
		const {
			code,
			name,
			minMinutesPerWeek,
			preferredRoomType,
			gradeLevels,
			isSeedable,
			interSectionEnabled,
			interSectionGradeLevels,
			modularGroupId,
			modularOrder,
			termGroupId,
			termCount,
			programScopes,
			allowedSpecializations,
			requiredFeatures,
			allowedOwnerDepartments,
			isActive,
			ownerDepartment,
			qualificationPriority,
			rotationFamily,
			outputLabel,
			isSystemManaged,
		} = req.body;
		if (!code || !name || !minMinutesPerWeek || !preferredRoomType || !gradeLevels) {
			res.status(400).json({ code: 'MISSING_FIELDS', message: 'code, name, minMinutesPerWeek, preferredRoomType, gradeLevels are required.' });
			return;
		}
		// Prompt 01A: mutation ownership comes from the actor, never the body.
		const subject = await subjectService.createSubject(actorSchoolId, {
			code,
			name,
			minMinutesPerWeek: Number(minMinutesPerWeek),
			preferredRoomType,
			gradeLevels,
			isSeedable,
			interSectionEnabled,
			interSectionGradeLevels,
			modularGroupId,
			modularOrder,
			termGroupId,
			termCount,
			programScopes,
			allowedSpecializations,
			requiredFeatures,
			allowedOwnerDepartments,
			isActive,
			ownerDepartment,
			qualificationPriority,
			rotationFamily,
			outputLabel,
			isSystemManaged,
		});
		res.status(201).json({ subject });
	} catch (err: any) {
		if (err?.code === 'P2002') {
			res.status(409).json({ code: 'DUPLICATE', message: 'A subject with this code already exists for this school.' });
			return;
		}
		next(err);
	}
});

// Auth: PATCH /subjects/:id
router.patch('/:id', authenticate, requirePrivilegedRole, async (req: Request, res: Response, next: NextFunction) => {
	try {
		const id = Number(req.params.id);
		if (Number.isNaN(id)) {
			res.status(400).json({ code: 'INVALID_PARAM', message: 'id must be a number.' });
			return;
		}
		// Prompt 01A: cross-school denial + optimistic concurrency.
		const scope = await subjectService.assertSchoolScopeAndVersion(id, resolveActorSchoolId(req), req.body?.expectedUpdatedAt);
		if (!scope.ok) {
			res.status(scope.error.status).json({ code: scope.error.code, message: scope.error.message });
			return;
			}
		const { expectedUpdatedAt, ...payload } = req.body ?? {};
		const subject = await subjectService.updateSubject(id, payload);
		if (!subject) {
			res.status(404).json({ code: 'NOT_FOUND', message: 'Subject not found.' });
			return;
		}
		res.json({ subject });
	} catch (err) {
		next(err);
	}
});

// Auth: DELETE /subjects/:id
router.delete('/:id', authenticate, requirePrivilegedRole, async (req: Request, res: Response, next: NextFunction) => {
	try {
		const id = Number(req.params.id);
		if (Number.isNaN(id)) {
			res.status(400).json({ code: 'INVALID_PARAM', message: 'id must be a number.' });
			return;
		}
		// Prompt 01A: cross-school denial + optimistic concurrency guard.
		const scope = await subjectService.assertSchoolScopeAndVersion(id, resolveActorSchoolId(req), (req.query.expectedUpdatedAt as string | undefined) ?? undefined);
		if (!scope.ok) {
			res.status(scope.error.status).json({ code: scope.error.code, message: scope.error.message });
			return;
			}
		const cleanupHistorical = req.query.cleanupHistorical === 'true';
		const cleanupActive = req.query.cleanupActive === 'true';
		const cleanupAll = req.query.cleanupAll === 'true';
		const result = await subjectService.deleteSubject(id, { cleanupHistorical, cleanupActive, cleanupAll });
		if (!result.success) {
			const status = result.code === 'NOT_FOUND'
				? 404
				: (result.code === 'ACTIVE_ASSIGNMENTS' || result.code === 'HISTORICAL_ASSIGNMENTS' ? 409 : 400);
			res.status(status).json({
				code: 'DELETE_BLOCKED',
				message: result.error,
				reason: result.code,
				details: result.details,
			});
			return;
		}
		res.status(200).json({
			deletedSubjectId: result.deletedSubjectId,
			cleanedHistoricalAssignments: result.cleanedHistoricalAssignments,
		});
	} catch (err) {
		next(err);
	}
});

// Auth: POST /subjects/:id/archive â€” explicit archive action for safe cleanup workflows
router.post('/:id/archive', authenticate, requirePrivilegedRole, async (req: Request, res: Response, next: NextFunction) => {
	try {
		const id = Number(req.params.id);
		if (Number.isNaN(id)) {
			res.status(400).json({ code: 'INVALID_PARAM', message: 'id must be a number.' });
			return;
		}
		const scope = await subjectService.assertSchoolScopeAndVersion(id, resolveActorSchoolId(req), req.body?.expectedUpdatedAt);
		if (!scope.ok) {
			res.status(scope.error.status).json({ code: scope.error.code, message: scope.error.message });
			return;
			}
		const subject = await subjectService.updateSubject(id, { isActive: false });
		if (!subject) {
			res.status(404).json({ code: 'NOT_FOUND', message: 'Subject not found.' });
			return;
		}
		// Prompt 01A: a success response must reflect persisted state â€” no false
		// success when the subject was already inactive.
		res.json({ subject, archived: subject.isActive === false });
	} catch (err) {
		next(err);
	}
});

// Auth: POST /subjects/:id/reactivate â€” explicit reactivation action for archived subjects
router.post('/:id/reactivate', authenticate, requirePrivilegedRole, async (req: Request, res: Response, next: NextFunction) => {
	try {
		const id = Number(req.params.id);
		if (Number.isNaN(id)) {
			res.status(400).json({ code: 'INVALID_PARAM', message: 'id must be a number.' });
			return;
		}
		const scope = await subjectService.assertSchoolScopeAndVersion(id, resolveActorSchoolId(req), req.body?.expectedUpdatedAt);
		if (!scope.ok) {
			res.status(scope.error.status).json({ code: scope.error.code, message: scope.error.message });
			return;
			}
		const subject = await subjectService.updateSubject(id, { isActive: true });
		if (!subject) {
			res.status(404).json({ code: 'NOT_FOUND', message: 'Subject not found.' });
			return;
		}
		res.json({ subject, reactivated: subject.isActive === true });
	} catch (err) {
		next(err);
	}
});

// Auth: POST /subjects/seed â€” seed defaults for a school
router.post('/seed', authenticate, requirePrivilegedRole, async (req: Request, res: Response, next: NextFunction) => {
	try {
		const schoolId = Number(req.body.schoolId);
		if (!schoolId || Number.isNaN(schoolId)) {
			res.status(400).json({ code: 'INVALID_PARAM', message: 'schoolId is required.' });
			return;
		}
		await subjectService.ensureDefaultSubjects(schoolId);
		const subjects = await subjectService.getSubjectsBySchool(schoolId);
		res.json({ subjects });
	} catch (err) {
		next(err);
	}
});

// Auth: POST /subjects/sync-offerings â€” refresh special-program subject state from upstream offerings + mirrored demand
router.post('/sync-offerings', authenticate, requirePrivilegedRole, async (req: Request, res: Response, next: NextFunction) => {
	try {
		const schoolId = Number(req.body.schoolId);
		const schoolYearId = Number(req.body.schoolYearId);
		if (!schoolId || Number.isNaN(schoolId) || !schoolYearId || Number.isNaN(schoolYearId)) {
			res.status(400).json({ code: 'INVALID_PARAM', message: 'schoolId and schoolYearId are required.' });
			return;
		}

		const authToken = getUpstreamAuthToken(req);
		const report = await subjectService.syncSubjectContractFromProgramOfferings(schoolId, schoolYearId, authToken);
		publishNotificationEvent({
			type: 'SUBJECT_OFFERINGS_SYNC_COMPLETED',
			domain: 'integration',
			severity: 'success',
			audience: 'PRIVILEGED',
			schoolId,
			schoolYearId,
			facultyId: null,
			message: 'Subject offerings refreshed from enrollment setup.',
			metadata: { report },
		});
		res.json({ report });
	} catch (err) {
		next(err);
	}
});

// Auth: GET /subjects/stats â€” get counts for dashboard
router.get('/stats/:schoolId', authenticate, requirePrivilegedRole, async (req: Request, res: Response, next: NextFunction) => {
	try {
		const schoolId = Number(req.params.schoolId);
		if (Number.isNaN(schoolId)) {
			res.status(400).json({ code: 'INVALID_PARAM', message: 'schoolId must be a number.' });
			return;
		}
		const [count, unassigned] = await Promise.all([
			subjectService.getSubjectCountBySchool(schoolId),
			subjectService.getSubjectsWithoutFaculty(schoolId),
		]);
		// Return both unassignedCount (number) and unassigned (array) for compatibility
		res.json({ count, unassignedCount: unassigned.length, unassigned });
	} catch (err) {
		next(err);
	}
});

export default router;
