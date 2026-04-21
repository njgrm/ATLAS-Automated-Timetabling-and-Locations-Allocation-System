import { Router } from 'express';
import type { Request, Response, NextFunction } from 'express';
import { authenticate } from '../middleware/authenticate.js';
import * as facultyService from '../services/faculty.service.js';

const router = Router();

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

// Auth: POST /faculty/sync — trigger sync from external source
router.post('/sync', authenticate, async (req: Request, res: Response, next: NextFunction) => {
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
		// Forward the bridge token to the EnrollPro adapter
		const authToken = req.headers.authorization?.slice(7);
		const result = await facultyService.syncFacultyFromExternal(schoolId, schoolYearId, authToken);
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
			activeCount: result.activeCount,
			staleCount: result.staleCount,
			deactivatedCount: result.deactivatedCount,
			isStale: result.isStale,
			staleReason: result.staleReason,
		});
	} catch (err) {
		next(err);
	}
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

export default router;
