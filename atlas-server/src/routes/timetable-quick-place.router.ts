import { Router } from 'express';
import type { Request, Response, NextFunction } from 'express';

import { authenticate } from '../middleware/authenticate.js';
import { prisma } from '../lib/prisma.js';
import { assertTeachingLoadWriteAuthority } from '../services/faculty-assignment.service.js';
import {
	solveQuickPlace,
	applyQuickPlace,
} from '../services/timetable-quick-place.service.js';

const router = Router();
const PRIVILEGED_ROLES: Set<string> = new Set(['admin', 'officer', 'SYSTEM_ADMIN']);

function positiveInt(raw: unknown, name: string): number | string {
	const n = Number(raw);
	if (!Number.isInteger(n) || n < 1) return `${name} must be a positive integer.`;
	return n;
}

function actorSchoolIdOf(req: Request): number | null {
	const schoolId = req.user?.schoolId;
	return typeof schoolId === 'number' && Number.isInteger(schoolId) && schoolId > 0 ? schoolId : null;
}

function parseScope(params: Record<string, string>): { schoolId: number; schoolYearId: number; runId: number } | string {
	const schoolId = positiveInt(params.schoolId, 'schoolId');
	if (typeof schoolId === 'string') return schoolId;
	const schoolYearId = positiveInt(params.schoolYearId, 'schoolYearId');
	if (typeof schoolYearId === 'string') return schoolYearId;
	const runId = positiveInt(params.runId, 'runId');
	if (typeof runId === 'string') return runId;
	return { schoolId, schoolYearId, runId };
}

function assertPrivileged(req: Request, res: Response): boolean {
	const role = req.user?.role;
	if (!role || !PRIVILEGED_ROLES.has(role)) {
		res.status(403).json({ code: 'FORBIDDEN', message: 'Only admin, officer, or SYSTEM_ADMIN can trigger quick place auto-allocation.' });
		return false;
	}
	return true;
}

/**
 * SOURCE-FRESHNESS C04 / actor-scope pattern: Quick Place is an authority-bearing
 * mutation surface. Before ANY service dispatch it must fail closed on a missing
 * actor school, a cross-school actor, an archived/non-active school year, or a
 * run that does not belong to the requested (school, year). The canonical
 * Teaching Load actor-school/active-year guard is reused rather than duplicated;
 * its typed rejections (403 ACTOR_SCHOOL_REQUIRED / SCHOOL_MISMATCH, 409
 * ARCHIVED_YEAR_READ_ONLY / INACTIVE_HISTORICAL_YEAR) propagate to the error
 * handler with zero downstream service/DB dispatch.
 */
async function assertQuickPlaceScope(
	req: Request,
	res: Response,
	schoolId: number,
	schoolYearId: number,
	runId: number,
): Promise<boolean> {
	await assertTeachingLoadWriteAuthority({
		schoolId,
		schoolYearId,
		actorSchoolId: actorSchoolIdOf(req),
	});
	const run = await prisma.generationRun.findFirst({
		where: { id: runId, schoolId, schoolYearId },
		select: { id: true },
	});
	if (!run) {
		res.status(404).json({ code: 'RUN_NOT_FOUND', message: 'Generation run not found in this school/year scope.' });
		return false;
	}
	return true;
}

router.post(
	'/:schoolId/:schoolYearId/runs/:runId/quick-place/preview',
	authenticate,
	async (req: Request, res: Response, next: NextFunction) => {
		try {
			if (!assertPrivileged(req, res)) return;
			const scope = parseScope(req.params as Record<string, string>);
			if (typeof scope === 'string') { res.status(400).json({ code: 'INVALID_PARAM', message: scope }); return; }
			if (!(await assertQuickPlaceScope(req, res, scope.schoolId, scope.schoolYearId, scope.runId))) return;
			
			const result = await solveQuickPlace(scope.runId, scope.schoolId, scope.schoolYearId);
			res.json(result);
		} catch (e) { next(e); }
	},
);

router.post(
	'/:schoolId/:schoolYearId/runs/:runId/quick-place/apply',
	authenticate,
	async (req: Request, res: Response, next: NextFunction) => {
		try {
			if (!assertPrivileged(req, res)) return;
			const scope = parseScope(req.params as Record<string, string>);
			if (typeof scope === 'string') { res.status(400).json({ code: 'INVALID_PARAM', message: scope }); return; }
			
			const actorId = req.user?.userId;
			if (!actorId) { res.status(401).json({ code: 'NO_USER', message: 'Authenticated user required.' }); return; }

			const expectedVersion = Number(req.body.expectedRunVersion);
			if (Number.isNaN(expectedVersion)) {
				res.status(400).json({ code: 'INVALID_PARAM', message: 'expectedRunVersion is required.' });
				return;
			}

			if (!(await assertQuickPlaceScope(req, res, scope.schoolId, scope.schoolYearId, scope.runId))) return;
			const result = await applyQuickPlace(scope.runId, scope.schoolId, scope.schoolYearId, actorId, expectedVersion);
			res.json(result);
		} catch (e) { next(e); }
	},
);

export default router;
