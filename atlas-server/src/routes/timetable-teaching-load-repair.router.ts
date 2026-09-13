import { Router } from 'express';
import type { Request, Response, NextFunction } from 'express';

import { authenticate } from '../middleware/authenticate.js';
import {
	ANNUAL_TEACHING_LOAD_APPLY_RETIRED_CODE,
	applyTeachingLoadRepair,
	previewAnnualTeachingLoadChange,
	previewTeachingLoadRepair,
	type AnnualTeachingLoadChange,
} from '../services/timetable-teaching-load-repair.service.js';
import { previewRunReconciliation } from '../services/reconciliation.service.js';
import { assertTeachingLoadWriteAuthority } from '../services/faculty-assignment.service.js';

const router = Router();
const PRIVILEGED_ROLES: Set<string> = new Set(['admin', 'officer', 'SYSTEM_ADMIN']);

function positiveInt(raw: unknown, name: string): number | string {
	const n = Number(raw);
	if (!Number.isInteger(n) || n < 1) return `${name} must be a positive integer.`;
	return n;
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

function parseAnnualScope(params: Record<string, string>): { schoolId: number; schoolYearId: number } | string {
	const schoolId = positiveInt(params.schoolId, 'schoolId');
	if (typeof schoolId === 'string') return schoolId;
	const schoolYearId = positiveInt(params.schoolYearId, 'schoolYearId');
	if (typeof schoolYearId === 'string') return schoolYearId;
	return { schoolId, schoolYearId };
}

function parseAnnualChanges(body: unknown): AnnualTeachingLoadChange[] | string {
	if (!Array.isArray(body)) return 'Annual Teaching Load changes must be an array.';
	const changes: AnnualTeachingLoadChange[] = [];
	for (const [index, raw] of (body as unknown[]).entries()) {
		if (!raw || typeof raw !== 'object') return `Change at index ${index} is not an object.`;
		const row = raw as Record<string, unknown>;
		const subjectId = Number(row.subjectId);
		const sectionId = Number(row.sectionId);
		const toFacultyId = Number(row.toFacultyId);
		if (!Number.isInteger(subjectId) || subjectId < 1) return `Change ${index} subjectId must be a positive integer.`;
		if (!Number.isInteger(sectionId) || sectionId < 1) return `Change ${index} sectionId must be a positive integer.`;
		if (!Number.isInteger(toFacultyId) || toFacultyId < 1) return `Change ${index} toFacultyId must be a positive integer.`;
		const fromFacultyId = row.fromFacultyId == null
			? null
			: (Number.isInteger(Number(row.fromFacultyId)) && Number(row.fromFacultyId) >= 1 ? Number(row.fromFacultyId) : null);
		changes.push({ subjectId, sectionId, fromFacultyId, toFacultyId });
	}
	return changes;
}

function assertPrivileged(req: Request, res: Response): boolean {
	const role = req.user?.role;
	if (!role || !PRIVILEGED_ROLES.has(role)) {
		res.status(403).json({ code: 'FORBIDDEN', message: 'Only admin, officer, or SYSTEM_ADMIN can repair Teaching Load from timetable review.' });
		return false;
	}
	return true;
}

function actorSchoolIdOf(req: Request): number | null {
	const schoolId = req.user?.schoolId;
	return typeof schoolId === 'number' && Number.isInteger(schoolId) && schoolId > 0 ? schoolId : null;
}

/**
 * B-01 authority gate. Every Teaching Load repair / annual / reconciliation
 * route must prove, before any service call and before any write:
 *   - a privileged authenticated actor;
 *   - a positive actor school equal to the requested school;
 *   - the requested year is the school's sole active, non-archived year.
 *
 * This delegates to the canonical `assertTeachingLoadWriteAuthority` used by
 * the rest of the Teaching Load write surface so the guard is not duplicated.
 * Rejections return the canonical typed status/code and dispatch zero services.
 */
async function assertTimetableTeachingLoadAuthority(
	req: Request,
	res: Response,
	schoolId: number,
	schoolYearId: number,
): Promise<boolean> {
	if (!assertPrivileged(req, res)) return false;
	try {
		await assertTeachingLoadWriteAuthority({ schoolId, schoolYearId, actorSchoolId: actorSchoolIdOf(req) });
		return true;
	} catch (error) {
		const serviceError = error as { statusCode?: unknown; code?: unknown; message?: unknown };
		if (typeof serviceError.statusCode === 'number' && typeof serviceError.code === 'string') {
			res.status(serviceError.statusCode).json({
				code: serviceError.code,
				message: typeof serviceError.message === 'string' ? serviceError.message : 'Teaching Load authority rejected this request.',
			});
			return false;
		}
		throw error;
	}
}

router.post(
	'/:schoolId/:schoolYearId/runs/:runId/teaching-load-repairs/preview',
	authenticate,
	async (req: Request, res: Response, next: NextFunction) => {
		try {
			const scope = parseScope(req.params as Record<string, string>);
			if (typeof scope === 'string') { res.status(400).json({ code: 'INVALID_PARAM', message: scope }); return; }
			if (!(await assertTimetableTeachingLoadAuthority(req, res, scope.schoolId, scope.schoolYearId))) return;
			const result = await previewTeachingLoadRepair(scope.runId, scope.schoolId, scope.schoolYearId, req.body ?? {});
			res.json(result);
		} catch (e) { next(e); }
	},
);

router.post(
	'/:schoolId/:schoolYearId/runs/:runId/teaching-load-repairs/apply',
	authenticate,
	async (req: Request, res: Response, next: NextFunction) => {
		try {
			const scope = parseScope(req.params as Record<string, string>);
			if (typeof scope === 'string') { res.status(400).json({ code: 'INVALID_PARAM', message: scope }); return; }
			if (!(await assertTimetableTeachingLoadAuthority(req, res, scope.schoolId, scope.schoolYearId))) return;
			const actorId = req.user?.userId;
			if (!actorId) { res.status(401).json({ code: 'NO_USER', message: 'Authenticated user required.' }); return; }
			const result = await applyTeachingLoadRepair(scope.runId, scope.schoolId, scope.schoolYearId, actorId, req.body ?? {});
			res.json(result);
		} catch (e) { next(e); }
	},
);

router.post(
	'/:schoolId/:schoolYearId/annual-teaching-load/preview',
	authenticate,
	async (req: Request, res: Response, next: NextFunction) => {
		try {
			const scope = parseAnnualScope(req.params as Record<string, string>);
			if (typeof scope === 'string') { res.status(400).json({ code: 'INVALID_PARAM', message: scope }); return; }
			if (!(await assertTimetableTeachingLoadAuthority(req, res, scope.schoolId, scope.schoolYearId))) return;
			const actorId = req.user?.userId;
			if (!actorId) { res.status(401).json({ code: 'NO_USER', message: 'Authenticated user required.' }); return; }
			const changes = parseAnnualChanges(req.body?.changes);
			if (typeof changes === 'string') { res.status(400).json({ code: 'INVALID_BODY', message: changes }); return; }
			const result = await previewAnnualTeachingLoadChange(scope.schoolId, scope.schoolYearId, actorId, changes);
			res.json(result);
		} catch (e) { next(e); }
	},
);

// B-08 / requirement 5: the annual Teaching Load apply mutation has no
// production client caller and previously ignored its version parameter while
// writing ownership without actor-school/active-year authority. It is retired
// with a typed 410 that performs zero service dispatch and zero writes. The
// canonical Teaching Load reconciliation apply is the guarded replacement.
router.post(
	'/:schoolId/:schoolYearId/annual-teaching-load/apply',
	authenticate,
	async (req: Request, res: Response, next: NextFunction) => {
		try {
			const scope = parseAnnualScope(req.params as Record<string, string>);
			if (typeof scope === 'string') { res.status(400).json({ code: 'INVALID_PARAM', message: scope }); return; }
			if (!(await assertTimetableTeachingLoadAuthority(req, res, scope.schoolId, scope.schoolYearId))) return;
			res.status(410).json({
				code: ANNUAL_TEACHING_LOAD_APPLY_RETIRED_CODE,
				message: 'The annual Teaching Load change apply is retired. Use the canonical Teaching Load reconciliation preview/apply, which binds actor-school, active-year, fingerprint, and run-version authority.',
			});
		} catch (e) { next(e); }
	},
);

// B-02 / D3: the reconciliation/apply mutation is retired and removed from the
// public surface. Only the read-only, explicitly non-authorizing preview
// remains. A stale client receives a 404 here rather than an audit-only
// "APPLIED" success.
router.post(
	'/:schoolId/:schoolYearId/runs/:runId/reconciliation/preview',
	authenticate,
	async (req: Request, res: Response, next: NextFunction) => {
		try {
			const scope = parseScope(req.params as Record<string, string>);
			if (typeof scope === 'string') { res.status(400).json({ code: 'INVALID_PARAM', message: scope }); return; }
			if (!(await assertTimetableTeachingLoadAuthority(req, res, scope.schoolId, scope.schoolYearId))) return;
			const result = await previewRunReconciliation({ runId: scope.runId, schoolId: scope.schoolId, schoolYearId: scope.schoolYearId });
			res.json(result);
		} catch (e) { next(e); }
	},
);

export default router;
