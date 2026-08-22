import { Router } from 'express';
import type { Request, Response, NextFunction } from 'express';
import { authenticate, authenticateWithSystemToken } from '../middleware/authenticate.js';
import { requirePrivilegedRole } from '../middleware/authorize.js';
import { prisma } from '../lib/prisma.js';
import { resolveCanonicalFacultyFromAuthPayload } from '../services/faculty-identity.service.js';
import * as facultyService from '../services/faculty.service.js';
import { fetchEnrollProActiveSchoolYear } from '../services/section-adapter.js';
import { validateAncillaryLoadImmutable } from '../services/scheduling-policy.service.js';
import { publishNotificationEvent } from '../services/notification-events.service.js';

const router = Router();

// Auth: GET /faculty/me?schoolId=X — resolve caller's linked faculty mirror
router.get('/me', authenticate, async (req: Request, res: Response, next: NextFunction) => {
	try {
		const schoolId = Number(req.query.schoolId);
		if (!schoolId || Number.isNaN(schoolId)) {
			res.status(400).json({ code: 'INVALID_PARAM', message: 'schoolId query parameter is required.' });
			return;
		}

		const identity = await resolveCanonicalFacultyFromAuthPayload(req.user, { schoolId });
		const faculty = identity
			? await prisma.facultyMirror.findUnique({ where: { id: identity.faculty.id } })
			: null;
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
// Allow either a normal JWT or the static ATLAS_SYSTEM_TOKEN.
router.use(authenticateWithSystemToken, requirePrivilegedRole);

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
		const upstreamAuthToken = req.user?.authSource === 'system' ? undefined : authToken;

		// Resolve schoolYearId: use caller-supplied value if present, otherwise fetch from EnrollPro.
		let schoolYearId: number;
		if (req.body.schoolYearId !== undefined) {
			schoolYearId = Number(req.body.schoolYearId);
		} else {
			const activeYear = await fetchEnrollProActiveSchoolYear(upstreamAuthToken);
			schoolYearId = activeYear?.id ?? 1;
		}

		const [result, activeYear] = await Promise.all([
			facultyService.syncFacultyFromExternal(schoolId, schoolYearId, upstreamAuthToken, {
				mode,
				pruneSectionAssignments: true,
				invalidateRuns: true,
			}),
			fetchEnrollProActiveSchoolYear(upstreamAuthToken),
		]);
		if (!result.synced) {
			publishNotificationEvent({
				type: 'FACULTY_SYNC_FAILED',
				domain: 'integration',
				severity: 'error',
				audience: 'PRIVILEGED',
				schoolId,
				schoolYearId,
				facultyId: null,
				message: 'Faculty sync from EnrollPro failed.',
				metadata: {
					source: result.source,
					error: result.error,
					staleReason: result.staleReason,
					mode,
				},
			});
			res.status(502).json({
				code: 'SYNC_FAILED',
				message: result.error,
				source: result.source,
				isStale: result.isStale,
				staleReason: result.staleReason,
			});
			return;
		}
		publishNotificationEvent({
			type: 'FACULTY_SYNC_COMPLETED',
			domain: 'integration',
			severity: result.isStale ? 'warning' : 'success',
			audience: 'PRIVILEGED',
			schoolId,
			schoolYearId,
			facultyId: null,
			message: result.isStale
				? 'Faculty sync completed using saved or stale EnrollPro data.'
				: 'Faculty roster synced from EnrollPro.',
			metadata: {
				source: result.source,
				mode: result.mode,
				activeCount: result.activeCount,
				staleCount: result.staleCount,
				deactivatedCount: result.deactivatedCount,
				seededAssignments: result.seededAssignments,
				invalidatedRuns: result.invalidatedRuns,
				enrollProActiveYear: activeYear?.yearLabel ?? null,
			},
		});
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
			...(activeYear ? { enrollProActiveYear: activeYear.yearLabel } : {}),
		});
	} catch (err) {
		next(err);
	}
}

// Auth: POST /faculty/sync — trigger sync from external source
router.post('/sync', authenticateWithSystemToken, async (req: Request, res: Response, next: NextFunction) => {
	await handleFacultySync(req, res, next);
});

// Auth: POST /faculty/sync/reset — deterministic prune reset from source of truth
router.post('/sync/reset', authenticateWithSystemToken, async (req: Request, res: Response, next: NextFunction) => {
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

// Auth: GET /faculty/specializations?schoolId=X — distinct non-stale specialization/department values
router.get('/specializations', async (req: Request, res: Response, next: NextFunction) => {
	try {
		const schoolId = Number(req.query.schoolId);
		if (!schoolId || Number.isNaN(schoolId)) {
			res.status(400).json({ code: 'INVALID_PARAM', message: 'schoolId query parameter is required.' });
			return;
		}

		const terms = await facultyService.listSpecializationTermsBySchool(schoolId);
		res.json(terms);
	} catch (err) {
		next(err);
	}
});

// Auth: GET /faculty/specialization-catalog?schoolId=X — department-grouped specialization catalog with mapping status
router.get('/specialization-catalog', async (req: Request, res: Response, next: NextFunction) => {
	try {
		const schoolId = Number(req.query.schoolId);
		if (!schoolId || Number.isNaN(schoolId)) {
			res.status(400).json({ code: 'INVALID_PARAM', message: 'schoolId query parameter is required.' });
			return;
		}

		const catalog = await facultyService.getSpecializationCatalogBySchool(schoolId);
		res.json(catalog);
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

// Auth: POST /faculty/placeholders — create explicit Teacher X placeholder faculty
router.post('/placeholders', authenticate, requirePrivilegedRole, async (req: Request, res: Response, next: NextFunction) => {
	try {
		const schoolId = Number(req.body.schoolId);
		if (!schoolId || Number.isNaN(schoolId)) {
			res.status(400).json({ code: 'INVALID_PARAM', message: 'schoolId is required.' });
			return;
		}

		const placeholder = await facultyService.createPlaceholderFaculty({
			schoolId,
			firstName: typeof req.body.firstName === 'string' ? req.body.firstName : 'Teacher',
			lastName: typeof req.body.lastName === 'string' ? req.body.lastName : 'X',
			department: typeof req.body.department === 'string' ? req.body.department : null,
			specialization: typeof req.body.specialization === 'string' ? req.body.specialization : null,
			maxHoursPerWeek: req.body.maxHoursPerWeek,
			canTeachOutsideDepartment: req.body.canTeachOutsideDepartment,
			localNotes: typeof req.body.localNotes === 'string' ? req.body.localNotes : null,
		});

		res.status(201).json({ faculty: placeholder });
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
			firstName,
			lastName,
			department,
			specialization,
			localNotes,
			isActiveForScheduling,
			maxHoursPerWeek,
			employmentStatus,
			isClassAdviser,
			advisoryEquivalentHours,
			canTeachOutsideDepartment,
			ancillaryMinutesPerWeek,
			ancillaryLoadSource,
			version,
		} = req.body;
		if (version === undefined) {
			res.status(400).json({ code: 'MISSING_FIELDS', message: 'version is required for optimistic locking.' });
			return;
		}
		await validateAncillaryLoadImmutable(
			id,
			ancillaryMinutesPerWeek,
			ancillaryLoadSource,
		);

		const result = await facultyService.updateFacultyMirror(
			id,
			{
				firstName,
				lastName,
				department,
				specialization,
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

// Auth: DELETE /faculty/:id — delete local placeholder faculty profile
router.delete('/:id', authenticate, requirePrivilegedRole, async (req: Request, res: Response, next: NextFunction) => {
	try {
		const id = Number(req.params.id);
		if (Number.isNaN(id)) {
			res.status(400).json({ code: 'INVALID_PARAM', message: 'id must be a number.' });
			return;
		}

		const schoolId = Number(req.query.schoolId ?? req.body.schoolId ?? 1);
		const result = await facultyService.deletePlaceholderFaculty(id, schoolId);
		if (!result.success) {
			res.status(400).json({ code: 'DELETE_FAILED', message: result.error });
			return;
		}

		res.json({ success: true, message: 'Placeholder faculty profile deleted successfully.' });
	} catch (err) {
		next(err);
	}
});

export default router;
