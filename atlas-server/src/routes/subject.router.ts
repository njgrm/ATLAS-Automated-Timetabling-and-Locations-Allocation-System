import { Router } from 'express';
import type { Request, Response, NextFunction } from 'express';
import { authenticate } from '../middleware/authenticate.js';
import { getUpstreamAuthToken } from '../middleware/upstream-auth.js';
import { requirePrivilegedRole } from '../middleware/authorize.js';
import * as subjectService from '../services/subject.service.js';
import { publishNotificationEvent } from '../services/notification-events.service.js';
import { prisma } from '../lib/prisma.js';

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

// Auth: POST /subjects — create a custom subject
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
// Prompt 01B: MANDATORY atomic versioned mutation — expectedUpdatedAt is
// required, and the version predicate runs inside the UPDATE transaction.
router.patch('/:id', authenticate, requirePrivilegedRole, async (req: Request, res: Response, next: NextFunction) => {
	try {
		const id = Number(req.params.id);
		if (Number.isNaN(id)) {
			res.status(400).json({ code: 'INVALID_PARAM', message: 'id must be a number.' });
			return;
		}
		const { expectedUpdatedAt, ...payload } = req.body ?? {};
		const result = await subjectService.updateSubjectAtomic({
			id,
			actorSchoolId: resolveActorSchoolId(req),
			expectedUpdatedAt,
			changes: payload,
		});
		if (!result.ok) {
			res.status(result.error.status).json({ code: result.error.code, message: result.error.message });
			return;
		}
		res.json({ subject: result.subject });
	} catch (err) {
		next(err);
	}
});

// Auth: DELETE /subjects/:id
// Prompt 01B-R: ordinary DELETE is BLOCKED until fingerprinted preview/apply
// is complete. The old path performed writes without version guards, school
// scoping in the delete predicate, or dependency enumeration.
router.delete('/:id', authenticate, requirePrivilegedRole, async (req: Request, res: Response, next: NextFunction) => {
	try {
		const id = Number(req.params.id);
		if (Number.isNaN(id)) {
			res.status(400).json({ code: 'INVALID_PARAM', message: 'id must be a number.' });
			return;
		}
		const cleanupHistorical = req.query.cleanupHistorical === 'true';
		const cleanupActive = req.query.cleanupActive === 'true';
		const cleanupAll = req.query.cleanupAll === 'true';
		if (cleanupHistorical || cleanupActive || cleanupAll) {
			res.status(400).json({
				code: 'CLEANUP_FLAGS_UNSUPPORTED',
				message: 'Legacy cleanup flags are no longer sufficient authorization. Use the fingerprinted delete preview/apply workflow.',
			});
			return;
		}
		// Prompt 01B-R: block ordinary DELETE — require preview/apply
		res.status(409).json({
			code: 'DELETE_PREVIEW_REQUIRED',
			message: 'Subject deletion requires a fingerprinted preview before apply. Use the delete preview endpoint first.',
		});
	} catch (err) {
		next(err);
	}
});

// Auth: POST /subjects/:id/delete-preview — read-only dependency enumeration
router.post('/:id/delete-preview', authenticate, requirePrivilegedRole, async (req: Request, res: Response, next: NextFunction) => {
	try {
		const id = Number(req.params.id);
		if (Number.isNaN(id)) {
			res.status(400).json({ code: 'INVALID_PARAM', message: 'id must be a number.' });
			return;
		}
		const actorSchoolId = resolveActorSchoolId(req);
		if (!actorSchoolId) {
			res.status(403).json({ code: 'SCHOOL_SCOPE_REQUIRED', message: 'Authenticated school scope is required.' });
			return;
		}
		const result = await subjectService.previewSubjectDeletion(id, actorSchoolId);
		if (!result.ok) {
			res.status(result.error.status).json({ code: result.error.code, message: result.error.message });
			return;
		}
		res.json({ preview: result.preview });
	} catch (err) {
		next(err);
	}
});

// Auth: POST /subjects/:id/delete-apply — fingerprint-bound atomic deletion
router.post('/:id/delete-apply', authenticate, requirePrivilegedRole, async (req: Request, res: Response, next: NextFunction) => {
	try {
		const id = Number(req.params.id);
		if (Number.isNaN(id)) {
			res.status(400).json({ code: 'INVALID_PARAM', message: 'id must be a number.' });
			return;
		}
		const actorSchoolId = resolveActorSchoolId(req);
		if (!actorSchoolId) {
			res.status(403).json({ code: 'SCHOOL_SCOPE_REQUIRED', message: 'Authenticated school scope is required.' });
			return;
		}
		const { expectedUpdatedAt, fingerprint } = req.body ?? {};
		if (!expectedUpdatedAt) {
			res.status(400).json({ code: 'VERSION_REQUIRED', message: 'expectedUpdatedAt is required.' });
			return;
		}
		if (!fingerprint) {
			res.status(400).json({ code: 'FINGERPRINT_REQUIRED', message: 'fingerprint from delete preview is required.' });
			return;
		}
		const result = await subjectService.applySubjectDeletion({
			subjectId: id,
			actorSchoolId,
			expectedUpdatedAt,
			fingerprint,
		});
		if (!result.ok) {
			res.status(result.error.status).json({ code: result.error.code, message: result.error.message });
			return;
		}
		res.json({ receipt: result.receipt });
	} catch (err) {
		next(err);
	}
});

// Auth: POST /subjects/:id/archive — Prompt 01B: atomic state transition with no-op conflict.
router.post('/:id/archive', authenticate, requirePrivilegedRole, async (req: Request, res: Response, next: NextFunction) => {
	try {
		const id = Number(req.params.id);
		if (Number.isNaN(id)) {
			res.status(400).json({ code: 'INVALID_PARAM', message: 'id must be a number.' });
			return;
		}
		const result = await subjectService.transitionSubjectActiveStateAtomic({
			id,
			actorSchoolId: resolveActorSchoolId(req),
			expectedUpdatedAt: req.body?.expectedUpdatedAt,
			targetActive: false,
		});
		if (!result.ok) {
			res.status(result.error.status).json({ code: result.error.code, message: result.error.message });
			return;
		}
		res.json({ subject: result.subject, archived: result.subject.isActive === false });
	} catch (err) {
		next(err);
	}
});

// Auth: POST /subjects/:id/reactivate — Prompt 01B: atomic state transition with no-op conflict.
router.post('/:id/reactivate', authenticate, requirePrivilegedRole, async (req: Request, res: Response, next: NextFunction) => {
	try {
		const id = Number(req.params.id);
		if (Number.isNaN(id)) {
			res.status(400).json({ code: 'INVALID_PARAM', message: 'id must be a number.' });
			return;
		}
		const result = await subjectService.transitionSubjectActiveStateAtomic({
			id,
			actorSchoolId: resolveActorSchoolId(req),
			expectedUpdatedAt: req.body?.expectedUpdatedAt,
			targetActive: true,
		});
		if (!result.ok) {
			res.status(result.error.status).json({ code: result.error.code, message: result.error.message });
			return;
		}
		res.json({ subject: result.subject, reactivated: result.subject.isActive === true });
	} catch (err) {
		next(err);
	}
});

// Auth: POST /subjects/seed — Prompt 01B: actor-scoped; conflicting body schoolId rejected.
router.post('/seed', authenticate, requirePrivilegedRole, async (req: Request, res: Response, next: NextFunction) => {
	try {
		const actorSchoolId = resolveActorSchoolId(req);
		if (!actorSchoolId) {
			res.status(403).json({ code: 'SCHOOL_SCOPE_REQUIRED', message: 'Authenticated school scope is required to seed subjects.' });
			return;
		}
		const bodySchoolId = req.body?.schoolId != null ? Number(req.body.schoolId) : undefined;
		if (bodySchoolId !== undefined && Number.isInteger(bodySchoolId) && bodySchoolId !== actorSchoolId) {
			res.status(403).json({ code: 'CROSS_SCHOOL_DENIED', message: `Cannot seed subjects for school ${bodySchoolId}: the authenticated actor belongs to school ${actorSchoolId}.` });
			return;
		}
		await subjectService.ensureDefaultSubjects(actorSchoolId);
		const subjects = await subjectService.getSubjectsBySchool(actorSchoolId);
		res.json({ subjects });
	} catch (err) {
		next(err);
	}
});

// Auth: POST /subjects/sync-offerings — Prompt 01B-R: BLOCKED until preview/apply exists.
// The old path directly invoked syncSubjectContractFromProgramOfferings() which
// performs bulk mutations (activate/deactivate overlays, materialize TLE, deactivate
// stale TLE) without a preview or fingerprint guard.
router.post('/sync-offerings', authenticate, requirePrivilegedRole, async (req: Request, res: Response, next: NextFunction) => {
	try {
		const actorSchoolId = resolveActorSchoolId(req);
		if (!actorSchoolId) {
			res.status(403).json({ code: 'SCHOOL_SCOPE_REQUIRED', message: 'Authenticated school scope is required to sync subject offerings.' });
			return;
		}
		const schoolYearId = Number(req.body.schoolYearId);
		if (!schoolYearId || Number.isNaN(schoolYearId)) {
			res.status(400).json({ code: 'INVALID_PARAM', message: 'schoolYearId is required.' });
			return;
		}
		const bodySchoolId = req.body?.schoolId != null ? Number(req.body.schoolId) : undefined;
		if (bodySchoolId !== undefined && Number.isInteger(bodySchoolId) && bodySchoolId !== actorSchoolId) {
			res.status(403).json({ code: 'CROSS_SCHOOL_DENIED', message: `Cannot sync offerings for school ${bodySchoolId}: the authenticated actor belongs to school ${actorSchoolId}.` });
			return;
		}
		// Verify the school year belongs to the actor's school
		const yearMirror = await prisma.enrollProSchoolYearMirror.findFirst({
			where: { schoolId: actorSchoolId, enrollProSchoolYearId: schoolYearId },
			select: { enrollProSchoolYearId: true },
		});
		if (!yearMirror) {
			res.status(403).json({ code: 'CROSS_SCHOOL_YEAR_DENIED', message: `School year ${schoolYearId} does not belong to school ${actorSchoolId}.` });
			return;
		}

		// Prompt 01B-R: block direct sync — require preview/apply
		res.status(409).json({
			code: 'SYNC_PREVIEW_REQUIRED',
			message: 'Subject sync requires a fingerprinted preview before apply. Use the sync preview endpoint first.',
		});
	} catch (err) {
		next(err);
	}
});

// Auth: POST /subjects/sync-offerings/preview — read-only sync preview
router.post('/sync-offerings/preview', authenticate, requirePrivilegedRole, async (req: Request, res: Response, next: NextFunction) => {
	try {
		const actorSchoolId = resolveActorSchoolId(req);
		if (!actorSchoolId) {
			res.status(403).json({ code: 'SCHOOL_SCOPE_REQUIRED', message: 'Authenticated school scope is required.' });
			return;
		}
		const schoolYearId = Number(req.body.schoolYearId);
		if (!schoolYearId || Number.isNaN(schoolYearId)) {
			res.status(400).json({ code: 'INVALID_PARAM', message: 'schoolYearId is required.' });
			return;
		}
		const bodySchoolId = req.body?.schoolId != null ? Number(req.body.schoolId) : undefined;
		if (bodySchoolId !== undefined && Number.isInteger(bodySchoolId) && bodySchoolId !== actorSchoolId) {
			res.status(403).json({ code: 'CROSS_SCHOOL_DENIED', message: `Cannot sync offerings for school ${bodySchoolId}: the authenticated actor belongs to school ${actorSchoolId}.` });
			return;
		}
		const yearMirror = await prisma.enrollProSchoolYearMirror.findFirst({
			where: { schoolId: actorSchoolId, enrollProSchoolYearId: schoolYearId },
			select: { enrollProSchoolYearId: true },
		});
		if (!yearMirror) {
			res.status(403).json({ code: 'CROSS_SCHOOL_YEAR_DENIED', message: `School year ${schoolYearId} does not belong to school ${actorSchoolId}.` });
			return;
		}

		const authToken = getUpstreamAuthToken(req);
		const result = await subjectService.previewSubjectSync(actorSchoolId, schoolYearId, authToken);
		// Return { preview: ... } — client consumes response.data.preview
		res.json({ preview: result.preview });
	} catch (err) {
		next(err);
	}
});

// Auth: POST /subjects/sync-offerings/apply — fingerprint-bound sync apply
router.post('/sync-offerings/apply', authenticate, requirePrivilegedRole, async (req: Request, res: Response, next: NextFunction) => {
	try {
		const actorSchoolId = resolveActorSchoolId(req);
		if (!actorSchoolId) {
			res.status(403).json({ code: 'SCHOOL_SCOPE_REQUIRED', message: 'Authenticated school scope is required.' });
			return;
		}
		const schoolYearId = Number(req.body.schoolYearId);
		if (!schoolYearId || Number.isNaN(schoolYearId)) {
			res.status(400).json({ code: 'INVALID_PARAM', message: 'schoolYearId is required.' });
			return;
		}
		const bodySchoolId = req.body?.schoolId != null ? Number(req.body.schoolId) : undefined;
		if (bodySchoolId !== undefined && Number.isInteger(bodySchoolId) && bodySchoolId !== actorSchoolId) {
			res.status(403).json({ code: 'CROSS_SCHOOL_DENIED', message: `Cannot sync offerings for school ${bodySchoolId}: the authenticated actor belongs to school ${actorSchoolId}.` });
			return;
		}
		const yearMirror = await prisma.enrollProSchoolYearMirror.findFirst({
			where: { schoolId: actorSchoolId, enrollProSchoolYearId: schoolYearId },
			select: { enrollProSchoolYearId: true },
		});
		if (!yearMirror) {
			res.status(403).json({ code: 'CROSS_SCHOOL_YEAR_DENIED', message: `School year ${schoolYearId} does not belong to school ${actorSchoolId}.` });
			return;
		}

		const { fingerprint } = req.body ?? {};
		if (!fingerprint) {
			res.status(400).json({ code: 'FINGERPRINT_REQUIRED', message: 'fingerprint from sync preview is required.' });
			return;
		}

		const authToken = getUpstreamAuthToken(req);
		const result = await subjectService.applySubjectSync({
			schoolId: actorSchoolId,
			schoolYearId,
			fingerprint,
			authToken,
		});
		if (!result.ok) {
			res.status(result.error.status).json({ code: result.error.code, message: result.error.message });
			return;
		}
		publishNotificationEvent({
			type: 'SUBJECT_OFFERINGS_SYNC_COMPLETED',
			domain: 'integration',
			severity: 'success',
			audience: 'PRIVILEGED',
			schoolId: actorSchoolId,
			schoolYearId,
			facultyId: null,
			message: 'Subject offerings refreshed from enrollment setup.',
			metadata: { report: result.report },
		});
		res.json({ report: result.report });
	} catch (err) {
		next(err);
	}
});

// Auth: GET /subjects/stats — get counts for dashboard
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
