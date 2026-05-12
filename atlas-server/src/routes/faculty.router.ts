import { Router } from 'express';
import type { Request, Response, NextFunction } from 'express';
import { authenticate } from '../middleware/authenticate.js';
import { requirePrivilegedRole } from '../middleware/authorize.js';
import { prisma } from '../lib/prisma.js';
import * as facultyService from '../services/faculty.service.js';

const router = Router();

// Auth: GET /faculty/me?schoolId=X — resolve caller's linked faculty mirror
router.get('/me', authenticate, async (req: Request, res: Response, next: NextFunction) => {
	try {
		const userId = req.user?.userId;
		if (!userId) {
			res.status(401).json({ code: 'NO_USER', message: 'Authenticated user required.' });
			return;
		}
		const schoolId = Number(req.query.schoolId);
		if (!schoolId || Number.isNaN(schoolId)) {
			res.status(400).json({ code: 'INVALID_PARAM', message: 'schoolId query parameter is required.' });
			return;
		}

		const faculty = await prisma.facultyMirror.findFirst({
			where: { schoolId, externalId: userId },
		});
		if (!faculty) {
			res.status(404).json({ code: 'FACULTY_NOT_LINKED', message: 'No faculty profile is linked to this account for the selected school.' });
			return;
		}

		res.json({ faculty });
	} catch (err) {
		next(err);
	}
});

// All remaining /faculty routes are scheduler/admin-only.
router.use(authenticate, requirePrivilegedRole);

// Auth: GET /faculty?schoolId=X&includeStale=true|false
router.get('/', authenticate, async (req: Request, res: Response, next: NextFunction) => {
	try {
		const schoolId = Number(req.query.schoolId);
		if (!schoolId || Number.isNaN(schoolId)) {
			res.status(400).json({ code: 'INVALID_PARAM', message: 'schoolId query parameter is required.' });
			return;
		}
		const includeStale = req.query.includeStale === 'true';
		const result = await facultyService.getFacultyBySchool(schoolId, { includeStale });
		res.json({
			faculty: result.faculty,
			source: result.source,
			fetchedAt: result.fetchedAt,
			isStale: result.isStale,
			staleReason: result.staleReason,
			activeCount: result.activeCount,
			staleCount: result.staleCount,
		});
	} catch (err) {
		next(err);
	}
});

function parseSyncMode(value: unknown): facultyService.FacultySyncMode {
	if (value === 'prune') {
		return 'prune';
	}
	return 'reconcile';
}

async function handleFacultySync(req: Request, res: Response, next: NextFunction, modeOverride?: facultyService.FacultySyncMode) {
	try {
		const schoolId = Number(req.body.schoolId);
		const schoolYearId = req.body.schoolYearId !== undefined ? Number(req.body.schoolYearId) : 1;
		if (!schoolId || Number.isNaN(schoolId)) {
			res.status(400).json({ code: 'INVALID_PARAM', message: 'schoolId is required.' });
			return;
		}

		const mode = modeOverride ?? parseSyncMode(req.body.mode);
		if (mode === 'prune' && req.body.confirmPrune !== true) {
			res.status(400).json({
				code: 'PRUNE_CONFIRMATION_REQUIRED',
				message: 'confirmPrune=true is required for prune reset mode.',
			});
			return;
		}

		const authToken = req.headers.authorization?.slice(7);
		const result = await facultyService.syncFacultyFromExternal(schoolId, schoolYearId, authToken, {
			mode,
			pruneSectionAssignments: true,
			invalidateRuns: true,
		});
		if (!result.synced) {
			res.status(502).json({
				code: 'SYNC_FAILED',
				message: result.error,
				source: result.source,
				isStale: result.isStale,
				staleReason: result.staleReason,
			});
			return;
		}
		res.json({
			synced: true,
			source: result.source,
			fetchedAt: result.fetchedAt,
			mode: result.mode,
			activeCount: result.activeCount,
			staleCount: result.staleCount,
			deactivatedCount: result.deactivatedCount,
			reconciliation: result.reconciliation,
			assignmentPrune: result.assignmentPrune,
			invalidatedRuns: result.invalidatedRuns,
			seededAssignments: result.seededAssignments,
			isStale: result.isStale,
			staleReason: result.staleReason,
		});
	} catch (err) {
		next(err);
	}
}

// Auth: POST /faculty/sync — trigger sync from external source
router.post('/sync', authenticate, async (req: Request, res: Response, next: NextFunction) => {
	await handleFacultySync(req, res, next);
});

// Auth: POST /faculty/sync/reset — deterministic prune reset from source of truth
router.post('/sync/reset', authenticate, async (req: Request, res: Response, next: NextFunction) => {
	await handleFacultySync(req, res, next, 'prune');
});

// Auth: GET /faculty/advisers?schoolId=X — list advisers with homeroom info
router.get('/advisers', authenticate, async (req: Request, res: Response, next: NextFunction) => {
	try {
		const schoolId = Number(req.query.schoolId);
		if (!schoolId || Number.isNaN(schoolId)) {
			res.status(400).json({ code: 'INVALID_PARAM', message: 'schoolId query parameter is required.' });
			return;
		}
		const advisers = await facultyService.getFacultyWithAdviserInfo(schoolId);
		res.json({ advisers });
	} catch (err) {
		next(err);
	}
});

// Auth: GET /faculty/:id/homeroom-hint — get homeroom recommendation for a faculty
router.get('/:id/homeroom-hint', authenticate, async (req: Request, res: Response, next: NextFunction) => {
	try {
		const facultyId = Number(req.params.id);
		if (Number.isNaN(facultyId)) {
			res.status(400).json({ code: 'INVALID_PARAM', message: 'id must be a number.' });
			return;
		}
		const hint = await facultyService.getHomeroomRecommendation(facultyId);
		if (!hint) {
			res.json({ hasAdviserMapping: false, homeroomHint: null });
			return;
		}
		res.json(hint);
	} catch (err) {
		next(err);
	}
});

// Auth: GET /faculty/:id
router.get('/:id', authenticate, async (req: Request, res: Response, next: NextFunction) => {
	try {
		const id = Number(req.params.id);
		if (Number.isNaN(id)) {
			res.status(400).json({ code: 'INVALID_PARAM', message: 'id must be a number.' });
			return;
		}
		const faculty = await facultyService.getFacultyById(id);
		if (!faculty) {
			res.status(404).json({ code: 'NOT_FOUND', message: 'Faculty not found.' });
			return;
		}
		res.json({ faculty });
	} catch (err) {
		next(err);
	}
});

// Auth: PATCH /faculty/:id — update local notes, scheduling status, load profile fields
router.patch('/:id', authenticate, async (req: Request, res: Response, next: NextFunction) => {
	try {
		const id = Number(req.params.id);
		if (Number.isNaN(id)) {
			res.status(400).json({ code: 'INVALID_PARAM', message: 'id must be a number.' });
			return;
		}
		const {
			localNotes,
			isActiveForScheduling,
			maxHoursPerWeek,
			employmentStatus,
			isClassAdviser,
			advisoryEquivalentHours,
			canTeachOutsideDepartment,
			version,
		} = req.body;
		if (version === undefined) {
			res.status(400).json({ code: 'MISSING_FIELDS', message: 'version is required for optimistic locking.' });
			return;
		}
		const result = await facultyService.updateFacultyMirror(
			id,
			{
				localNotes,
				isActiveForScheduling,
				maxHoursPerWeek,
				employmentStatus,
				isClassAdviser,
				advisoryEquivalentHours,
				canTeachOutsideDepartment,
			},
			Number(version),
		);
		if (!result.success) {
			const status = result.error?.includes('conflict') ? 409 : 404;
			res.status(status).json({ code: status === 409 ? 'VERSION_CONFLICT' : 'NOT_FOUND', message: result.error });
			return;
		}
		res.json({ faculty: result.faculty });
	} catch (err) {
		next(err);
	}
});

// Auth: GET /faculty/specializations?schoolId=X — distinct non-stale specialization/department values
router.get('/specializations', async (req: Request, res: Response, next: NextFunction) => {
	try {
		const schoolId = Number(req.query.schoolId);
		if (!schoolId || Number.isNaN(schoolId)) {
			res.status(400).json({ code: 'INVALID_PARAM', message: 'schoolId query parameter is required.' });
			return;
		}
		
		// Fetch distinct specializations and departments
		const [specRows, deptRows] = await Promise.all([
			prisma.facultyMirror.findMany({
				where: { schoolId, isStale: false, specialization: { not: null } },
				select: { specialization: true },
				distinct: ['specialization'],
			}),
			prisma.facultyMirror.findMany({
				where: { schoolId, isStale: false, department: { not: null } },
				select: { department: true },
				distinct: ['department'],
			}),
		]);

		const specializations = Array.from(new Set([
			...specRows.map((r) => r.specialization as string),
			...deptRows.map((r) => r.department as string),
		])).sort();

		res.json({ specializations });
	} catch (err) {
		next(err);
	}
});

export default router;
