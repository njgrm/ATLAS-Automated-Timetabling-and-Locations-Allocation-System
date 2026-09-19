import { Router } from 'express';
import type { Request, Response, NextFunction } from 'express';
import { authenticate, authenticateWithSystemToken } from '../middleware/authenticate.js';
import { getUpstreamAuthToken } from '../middleware/upstream-auth.js';
import { requirePrivilegedRole } from '../middleware/authorize.js';
import * as sectionService from '../services/section.service.js';
import * as assignmentService from '../services/faculty-assignment.service.js';
import { syncSectionsFromExternal } from '../services/section.service.js';
import { sectionSourceMode, fetchEnrollProActiveSchoolYear } from '../services/section-adapter.js';
import { publishNotificationEvent } from '../services/notification-events.service.js';
import { computeAutoAssign } from '../services/home-room-auto-assign.service.js';

const router = Router();

// ---------------------------------------------------------------------------
// Actor-school authority helpers — reused by all section routes that accept a
// caller-supplied schoolId.  Extracted from the HOME-ROOM-AUTO-ASSIGN-C01
// inline guard; every sibling must go through the same gate.
// ---------------------------------------------------------------------------

function actorSchoolIdOf(req: Request): number | null {
	const schoolId = req.user?.schoolId;
	return typeof schoolId === 'number' && Number.isInteger(schoolId) && schoolId > 0 ? schoolId : null;
}

/**
 * Actor-school guard.  Returns the actor school, or writes the typed 403 and
 * returns `null` so the handler returns early.  Callers must place this after
 * parameter validation (schoolYearId, schoolId body/query) but before the
 * school-equality check and service dispatch.
 */
function requireActorSchool(req: Request, res: Response): number | null {
	const schoolId = actorSchoolIdOf(req);
	if (schoolId === null) {
		res.status(403).json({ code: 'SCHOOL_SCOPE_REQUIRED', message: 'Authenticated actor is missing a bound school scope.' });
		return null;
	}
	return schoolId;
}

function parseBooleanQueryFlag(value: unknown): boolean {
	if (typeof value === 'boolean') return value;
	if (typeof value !== 'string') return false;
	const normalized = value.trim().toLowerCase();
	return normalized === 'true' || normalized === '1' || normalized === 'yes';
}

// Auth: GET /sections/summary/:schoolYearId
router.get('/summary/:schoolYearId', authenticate, requirePrivilegedRole, async (req: Request, res: Response, next: NextFunction) => {
	try {
		const schoolYearId = Number(req.params.schoolYearId);
		if (!Number.isInteger(schoolYearId) || schoolYearId <= 0) {
			res.status(400).json({ code: 'INVALID_PARAM', message: 'schoolYearId must be a positive integer.' });
			return;
		}
		const schoolId = Number(req.query.schoolId);
		if (!Number.isInteger(schoolId) || schoolId <= 0) {
			res.status(400).json({ code: 'INVALID_PARAM', message: 'schoolId query parameter is required and must be a positive integer.' });
			return;
		}

		// SECTION-ROUTE-AUTHORITY-C02 (R2): the summary read is scoped entirely
		// by the caller-supplied `schoolId` query parameter, so an actor bound to
		// school A could otherwise read school B's mirror plus trigger an
		// external sync for it. Reject cross-school before any runtime-context
		// read, upstream verification, mirror read, or auto-sync dispatch.
		const actorSchoolId = requireActorSchool(req, res);
		if (actorSchoolId === null) return;
		if (actorSchoolId !== schoolId) {
			res.status(403).json({ code: 'CROSS_SCHOOL_DENIED', message: 'Requested school does not match the authenticated actor school.' });
			return;
		}

		const authToken = getUpstreamAuthToken(req);
		const summary = await sectionService.getSectionSummary(schoolYearId, schoolId, authToken);
		res.json({ ...summary, sourceMode: sectionSourceMode });
	} catch (err: any) {
		// If the upstream is unreachable, return explicit error (do not silently masquerade)
		if (err?.code === 'UPSTREAM_ERROR' || err?.cause?.code === 'ECONNREFUSED' || err?.message?.includes('fetch failed')) {
			res.status(503).json({
				code: 'UPSTREAM_UNAVAILABLE',
				message: 'Section data source is currently unavailable.',
				sourceMode: sectionSourceMode,
				totalSections: 0,
				byGradeLevel: {},
				sections: [],
			});
			return;
		}
		next(err);
	}
});

// Auth: GET /sections/assigned-classes?schoolId=X&schoolYearId=Y&includeDiagnostics=true
router.get('/assigned-classes', authenticateWithSystemToken, requirePrivilegedRole, async (req: Request, res: Response, next: NextFunction) => {
	try {
		const schoolId = Number(req.query.schoolId);
		const schoolYearId = Number(req.query.schoolYearId);
		if (!Number.isInteger(schoolId) || schoolId <= 0) {
			res.status(400).json({ code: 'INVALID_PARAM', message: 'schoolId query parameter is required and must be a positive integer.' });
			return;
		}
		if (!Number.isInteger(schoolYearId) || schoolYearId <= 0) {
			res.status(400).json({ code: 'INVALID_PARAM', message: 'schoolYearId query parameter is required and must be a positive integer.' });
			return;
		}

		// SECTION-ROUTE-AUTHORITY-C02 (R3, C01 Option A): a system token declares
		// its target school explicitly through the validated `schoolId` query
		// parameter and is accepted unchanged. authenticateWithSystemToken also
		// admits JWT/bridge actors, so those must be cross-checked against the
		// actor school — otherwise an actor bound to school A could read school
		// B's roster. Malformed/missing schoolId already fails closed above with
		// a typed 400 and zero dispatch.
		if (req.user?.authSource === 'system') {
			// Explicit, validated schoolId is the machine declaration of intent.
		} else {
			const actorSchoolId = requireActorSchool(req, res);
			if (actorSchoolId === null) return;
			if (actorSchoolId !== schoolId) {
				res.status(403).json({ code: 'CROSS_SCHOOL_DENIED', message: 'Requested school does not match the authenticated actor school.' });
				return;
			}
		}

		const includeDiagnostics = parseBooleanQueryFlag(req.query.includeDiagnostics);
		const upstreamAuthToken = getUpstreamAuthToken(req);
		const payload = await assignmentService.getSectionAssignedClassesIndex(schoolId, schoolYearId, upstreamAuthToken, {
			includeDiagnostics,
		});

		res.json(payload);
	} catch (err) {
		next(err);
	}
});

// Auth: GET /sections/:sectionId/assigned-classes?schoolYearId=Y&includeDiagnostics=true
router.get('/:sectionId/assigned-classes', authenticateWithSystemToken, requirePrivilegedRole, async (req: Request, res: Response, next: NextFunction) => {
	try {
		const sectionId = Number(req.params.sectionId);
		const schoolYearId = Number(req.query.schoolYearId);
		if (!Number.isInteger(sectionId) || sectionId <= 0) {
			res.status(400).json({ code: 'INVALID_PARAM', message: 'sectionId must be a positive integer.' });
			return;
		}
		if (!Number.isInteger(schoolYearId) || schoolYearId <= 0) {
			res.status(400).json({ code: 'INVALID_PARAM', message: 'schoolYearId query parameter is required and must be a positive integer.' });
			return;
		}

		const includeDiagnostics = parseBooleanQueryFlag(req.query.includeDiagnostics);
		const upstreamAuthToken = getUpstreamAuthToken(req);
		const payload = await assignmentService.getSectionAssignedClasses(sectionId, schoolYearId, upstreamAuthToken, {
			includeDiagnostics,
		});

		if (!payload) {
			res.status(404).json({ code: 'NOT_FOUND', message: 'Section not found in active school-year scope.' });
			return;
		}

		res.json(payload);
	} catch (err) {
		next(err);
	}
});

/**
 * POST /api/v1/sections/sync
 * Manually trigger a reconciliation from EnrollPro sections into ATLAS SectionMirror.
 *
 * Accepts EITHER:
 *  1. A JWT- or bridge-authenticated actor whose bound school matches the
 *     request body `schoolId` (actor-school cross-check), OR
 *  2. A valid system token (`authSource === 'system'`) with an explicit
 *     `schoolId` in the request body — the machine declares its target
 *     explicitly so intent is auditable.
 *
 * Still rejected: a system token with NO explicit schoolId (fail closed,
 * typed error, zero dispatch).  GET and PUT home-room routes keep their
 * actor-only gate unchanged.
 */
router.post('/sync', authenticateWithSystemToken, requirePrivilegedRole, async (req: Request, res: Response, next: NextFunction) => {
	try {
		const schoolId = Number(req.body.schoolId);
		if (!schoolId) {
			res.status(400).json({ code: 'INVALID_PARAM', message: 'schoolId is required' });
			return;
		}

		// ---- School-scope authority ----
		// System tokens declare their target school in the request body; the
		// explicit body.schoolId is the auditable declaration.  JWT/bridge
		// actors are cross-checked against the authenticated token school.
		if (req.user?.authSource === 'system') {
			// System token with explicit schoolId already validated above;
			// intent is auditable (body.schoolId was the machine declaration).
			// Fall through — no actor-school cross-check needed for system tokens.
		} else {
			// Actor-school authority: reject cross-school before any upstream dispatch.
			const actorSchoolId = requireActorSchool(req, res);
			if (actorSchoolId === null) return;
			if (actorSchoolId !== schoolId) {
				res.status(403).json({ code: 'CROSS_SCHOOL_DENIED', message: 'Requested school does not match the authenticated actor school.' });
				return;
			}
		}

		const upstreamAuthToken = getUpstreamAuthToken(req);

		// Resolve schoolYearId: use caller-supplied value if present, otherwise fetch from EnrollPro.
		let schoolYearId: number;
		if (req.body.schoolYearId !== undefined) {
			schoolYearId = Number(req.body.schoolYearId);
		} else {
			const activeYear = await fetchEnrollProActiveSchoolYear(upstreamAuthToken);
			schoolYearId = activeYear?.id ?? 1;
		}

		const [result, activeYear] = await Promise.all([
			syncSectionsFromExternal(schoolId, schoolYearId, upstreamAuthToken),
			fetchEnrollProActiveSchoolYear(upstreamAuthToken),
		]);
		publishNotificationEvent({
			type: 'SECTION_SYNC_COMPLETED',
			domain: 'integration',
			severity: 'success',
			audience: 'PRIVILEGED',
			schoolId,
			schoolYearId,
			facultyId: null,
			message: 'Sections synced from EnrollPro.',
			metadata: {
				source: result.source,
				count: result.count,
				removed: result.removed,
				fetchedAt: result.fetchedAt,
				enrollProActiveYear: activeYear?.yearLabel ?? null,
			},
		});
		res.json({ ...result, ...(activeYear ? { enrollProActiveYear: activeYear.yearLabel } : {}) });
	} catch (err) {
		next(err);
	}
});

// GET /sections/home-rooms/:schoolYearId?schoolId=1
router.get('/home-rooms/:schoolYearId', authenticate, requirePrivilegedRole, async (req: Request, res: Response, next: NextFunction) => {
	try {
		const schoolYearId = Number(req.params.schoolYearId);
		if (!Number.isInteger(schoolYearId) || schoolYearId <= 0) {
			res.status(400).json({ code: 'INVALID_PARAM', message: 'schoolYearId must be a positive integer.' });
			return;
		}

		const schoolId = Number(req.query.schoolId);
		if (!Number.isInteger(schoolId) || schoolId <= 0) {
			res.status(400).json({ code: 'INVALID_PARAM', message: 'schoolId query parameter is required and must be a positive integer.' });
			return;
		}

		// Actor-school authority: reject cross-school before any service read.
		const actorSchoolId = requireActorSchool(req, res);
		if (actorSchoolId === null) return;
		if (actorSchoolId !== schoolId) {
			res.status(403).json({ code: 'CROSS_SCHOOL_DENIED', message: 'Requested school does not match the authenticated actor school.' });
			return;
		}

		const payload = await sectionService.getHomeRoomControlData(schoolYearId, schoolId);
		res.json(payload);
	} catch (err) {
		next(err);
	}
});

// PUT /sections/home-rooms/:schoolYearId
router.put('/home-rooms/:schoolYearId', authenticate, requirePrivilegedRole, async (req: Request, res: Response, next: NextFunction) => {
	try {
		const schoolYearId = Number(req.params.schoolYearId);
		if (!Number.isInteger(schoolYearId) || schoolYearId <= 0) {
			res.status(400).json({ code: 'INVALID_PARAM', message: 'schoolYearId must be a positive integer.' });
			return;
		}

		const schoolId = Number(req.body.schoolId);
		if (!Number.isInteger(schoolId) || schoolId <= 0) {
			res.status(400).json({ code: 'INVALID_BODY', message: 'schoolId is required and must be a positive integer.' });
			return;
		}

		// Actor-school authority: reject cross-school before any service write.
		const actorSchoolId = requireActorSchool(req, res);
		if (actorSchoolId === null) return;
		if (actorSchoolId !== schoolId) {
			res.status(403).json({ code: 'CROSS_SCHOOL_DENIED', message: 'Requested school does not match the authenticated actor school.' });
			return;
		}

		const assignmentsRaw = Array.isArray(req.body.assignments) ? req.body.assignments : [];
		const assignments = assignmentsRaw
			.map((entry: any) => ({
				sectionId: Number(entry?.sectionId),
				homeRoomId: entry?.homeRoomId == null ? null : Number(entry.homeRoomId),
			}))
			.filter((entry: { sectionId: number; homeRoomId: number | null }) => Number.isInteger(entry.sectionId) && entry.sectionId > 0 && (entry.homeRoomId == null || (Number.isInteger(entry.homeRoomId) && entry.homeRoomId > 0)));

		if (assignments.length === 0) {
			res.status(400).json({ code: 'INVALID_BODY', message: 'assignments must include at least one valid sectionId/homeRoomId pair.' });
			return;
		}

		const result = await sectionService.updateSectionHomeRooms(schoolId, schoolYearId, assignments);
		res.json({ updated: result.updated });
	} catch (err) {
		next(err);
	}
});

// POST /sections/home-rooms/:schoolYearId/auto-assign
router.post('/home-rooms/:schoolYearId/auto-assign', authenticate, requirePrivilegedRole, async (req: Request, res: Response, next: NextFunction) => {
	try {
		const schoolYearId = Number(req.params.schoolYearId);
		if (!Number.isInteger(schoolYearId) || schoolYearId <= 0) {
			res.status(400).json({ code: 'INVALID_PARAM', message: 'schoolYearId must be a positive integer.' });
			return;
		}

		const schoolId = Number(req.body?.schoolId);
		if (!Number.isInteger(schoolId) || schoolId <= 0) {
			res.status(400).json({ code: 'INVALID_BODY', message: 'schoolId is required and must be a positive integer.' });
			return;
		}

		// Validate mode
		const rawMode = req.body?.mode;
		if (rawMode !== undefined && rawMode !== null && rawMode !== 'preview' && rawMode !== 'apply') {
			res.status(400).json({ code: 'INVALID_BODY', message: 'mode must be "preview" or "apply" when provided.' });
			return;
		}
		const mode = rawMode === 'apply' ? 'apply' : 'preview';

		// Validate overwriteExisting
		const rawOverwrite = req.body?.overwriteExisting;
		if (rawOverwrite !== undefined && rawOverwrite !== null && typeof rawOverwrite !== 'boolean') {
			res.status(400).json({ code: 'INVALID_BODY', message: 'overwriteExisting must be a boolean when provided.' });
			return;
		}
		const overwriteExisting = rawOverwrite === true;

		// Validate allowCrossGradeFallback
		const rawFallback = req.body?.allowCrossGradeFallback;
		if (rawFallback !== undefined && rawFallback !== null && typeof rawFallback !== 'boolean') {
			res.status(400).json({ code: 'INVALID_BODY', message: 'allowCrossGradeFallback must be a boolean when provided.' });
			return;
		}
		const allowCrossGradeFallback = rawFallback === true;

		// HOME-ROOM-AUTO-ASSIGN-C01 (R6): actor-school authority is enforced
		// before any service dispatch. Body validation above still wins, so a
		// malformed body is a typed 400 regardless of actor. A token without a
		// bound school, or one that disagrees with the requested school, fails
		// closed with a typed 403 and performs zero reads/writes.
		const actorSchoolId = requireActorSchool(req, res);
		if (actorSchoolId === null) return;
		if (actorSchoolId !== schoolId) {
			res.status(403).json({ code: 'CROSS_SCHOOL_DENIED', message: 'Requested school does not match the authenticated actor school.' });
			return;
		}

		const result = await computeAutoAssign({
			schoolId,
			schoolYearId,
			mode,
			overwriteExisting,
			allowCrossGradeFallback,
		});

		res.json(result);
	} catch (err) {
		next(err);
	}
});

// POST /sections/special-program-placement/overlay
router.post('/special-program-placement/overlay', authenticate, requirePrivilegedRole, async (req: Request, res: Response, next: NextFunction) => {
	try {
		const schoolId = Number(req.body.schoolId);
		if (!Number.isInteger(schoolId) || schoolId <= 0) {
			res.status(400).json({ code: 'INVALID_BODY', message: 'schoolId is required and must be a positive integer.' });
			return;
		}

		// SECTION-ROUTE-AUTHORITY-C02 (R1): this actor route takes a
		// caller-supplied body.schoolId and performs a write. Reject a
		// cross-school target before any upstream year resolution
		// (fetchEnrollProActiveSchoolYear) or mirror read/write dispatch.
		const actorSchoolId = requireActorSchool(req, res);
		if (actorSchoolId === null) return;
		if (actorSchoolId !== schoolId) {
			res.status(403).json({ code: 'CROSS_SCHOOL_DENIED', message: 'Requested school does not match the authenticated actor school.' });
			return;
		}

		let schoolYearId: number;
		if (req.body.schoolYearId !== undefined) {
			schoolYearId = Number(req.body.schoolYearId);
			if (!Number.isInteger(schoolYearId) || schoolYearId <= 0) {
				res.status(400).json({ code: 'INVALID_BODY', message: 'schoolYearId must be a positive integer when provided.' });
				return;
			}
		} else {
			const authToken = getUpstreamAuthToken(req);
			const activeYear = await fetchEnrollProActiveSchoolYear(authToken);
			schoolYearId = activeYear?.id ?? 1;
		}

		const result = await sectionService.applySpecialProgramPlacementOverlay(schoolId, schoolYearId);
		res.json({
			schoolId,
			schoolYearId,
			...result,
			contract:
				'EnrollPro remains source-of-truth for roster and program membership; ATLAS persists special-program placement overlays when upstream placement is absent.',
		});
	} catch (err) {
		next(err);
	}
});

export default router;
