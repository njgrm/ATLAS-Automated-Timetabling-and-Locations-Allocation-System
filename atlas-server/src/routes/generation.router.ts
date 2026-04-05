import { Router } from 'express';
import type { Request, Response, NextFunction } from 'express';
import { authenticate } from '../middleware/authenticate.js';
import * as genService from '../services/generation.service.js';
import { getFixSuggestions } from '../services/fix-suggestions.service.js';

const router = Router();

// ─── Helpers ───

const PRIVILEGED_ROLES: Set<string> = new Set(['admin', 'officer', 'SYSTEM_ADMIN']);

function positiveInt(raw: unknown, name: string): number | string {
	const n = Number(raw);
	if (!Number.isInteger(n) || n < 1) return `${name} must be a positive integer.`;
	return n;
}

// ─── POST /:schoolId/:schoolYearId/runs — trigger generation run ───

router.post(
	'/:schoolId/:schoolYearId/runs',
	authenticate,
	async (req: Request, res: Response, next: NextFunction) => {
		try {
			const role = req.user?.role;
			if (!role || !PRIVILEGED_ROLES.has(role)) {
				res.status(403).json({ code: 'FORBIDDEN', message: 'Only admin, officer, or SYSTEM_ADMIN can trigger generation runs.' });
				return;
			}

			const schoolId = positiveInt(req.params.schoolId, 'schoolId');
			if (typeof schoolId === 'string') { res.status(400).json({ code: 'INVALID_PARAM', message: schoolId }); return; }
			const schoolYearId = positiveInt(req.params.schoolYearId, 'schoolYearId');
			if (typeof schoolYearId === 'string') { res.status(400).json({ code: 'INVALID_PARAM', message: schoolYearId }); return; }

			const actorId = req.user?.userId;
			if (!actorId) { res.status(401).json({ code: 'NO_USER', message: 'Authenticated user required.' }); return; }

			const run = await genService.triggerGenerationRun(schoolId, schoolYearId, actorId);
			res.status(201).json({ run });
		} catch (e) { next(e); }
	},
);

// ─── GET /:schoolId/:schoolYearId/runs/latest — latest run ───

router.get(
	'/:schoolId/:schoolYearId/runs/latest',
	authenticate,
	async (req: Request, res: Response, next: NextFunction) => {
		try {
			const role = req.user?.role;
			if (!role || !PRIVILEGED_ROLES.has(role)) {
				res.status(403).json({ code: 'FORBIDDEN', message: 'Only admin, officer, or SYSTEM_ADMIN can view generation runs.' });
				return;
			}

			const schoolId = positiveInt(req.params.schoolId, 'schoolId');
			if (typeof schoolId === 'string') { res.status(400).json({ code: 'INVALID_PARAM', message: schoolId }); return; }
			const schoolYearId = positiveInt(req.params.schoolYearId, 'schoolYearId');
			if (typeof schoolYearId === 'string') { res.status(400).json({ code: 'INVALID_PARAM', message: schoolYearId }); return; }

			const run = await genService.getLatestRun(schoolId, schoolYearId);
			res.json({ run });
		} catch (e) { next(e); }
	},
);

// ─── GET /:schoolId/:schoolYearId/runs/latest/violations — latest run violations ───

router.get(
	'/:schoolId/:schoolYearId/runs/latest/violations',
	authenticate,
	async (req: Request, res: Response, next: NextFunction) => {
		try {
			const role = req.user?.role;
			if (!role || !PRIVILEGED_ROLES.has(role)) {
				res.status(403).json({ code: 'FORBIDDEN', message: 'Only admin, officer, or SYSTEM_ADMIN can view violation reports.' });
				return;
			}

			const schoolId = positiveInt(req.params.schoolId, 'schoolId');
			if (typeof schoolId === 'string') { res.status(400).json({ code: 'INVALID_PARAM', message: schoolId }); return; }
			const schoolYearId = positiveInt(req.params.schoolYearId, 'schoolYearId');
			if (typeof schoolYearId === 'string') { res.status(400).json({ code: 'INVALID_PARAM', message: schoolYearId }); return; }

			const report = await genService.getLatestRunViolations(schoolId, schoolYearId);
			res.json(report);
		} catch (e) { next(e); }
	},
);

// ─── GET /:schoolId/:schoolYearId/runs/latest/draft — latest run draft entries ───

router.get(
	'/:schoolId/:schoolYearId/runs/latest/draft',
	authenticate,
	async (req: Request, res: Response, next: NextFunction) => {
		try {
			const role = req.user?.role;
			if (!role || !PRIVILEGED_ROLES.has(role)) {
				res.status(403).json({ code: 'FORBIDDEN', message: 'Only admin, officer, or SYSTEM_ADMIN can view draft entries.' });
				return;
			}

			const schoolId = positiveInt(req.params.schoolId, 'schoolId');
			if (typeof schoolId === 'string') { res.status(400).json({ code: 'INVALID_PARAM', message: schoolId }); return; }
			const schoolYearId = positiveInt(req.params.schoolYearId, 'schoolYearId');
			if (typeof schoolYearId === 'string') { res.status(400).json({ code: 'INVALID_PARAM', message: schoolYearId }); return; }

			const report = await genService.getLatestRunDraft(schoolId, schoolYearId);
			res.json(report);
		} catch (e) { next(e); }
	},
);

// ─── GET /:schoolId/:schoolYearId/runs/:runId — run details ───

router.get(
	'/:schoolId/:schoolYearId/runs/:runId',
	authenticate,
	async (req: Request, res: Response, next: NextFunction) => {
		try {
			const role = req.user?.role;
			if (!role || !PRIVILEGED_ROLES.has(role)) {
				res.status(403).json({ code: 'FORBIDDEN', message: 'Only admin, officer, or SYSTEM_ADMIN can view generation runs.' });
				return;
			}

			const schoolId = positiveInt(req.params.schoolId, 'schoolId');
			if (typeof schoolId === 'string') { res.status(400).json({ code: 'INVALID_PARAM', message: schoolId }); return; }
			const schoolYearId = positiveInt(req.params.schoolYearId, 'schoolYearId');
			if (typeof schoolYearId === 'string') { res.status(400).json({ code: 'INVALID_PARAM', message: schoolYearId }); return; }
			const runId = positiveInt(req.params.runId, 'runId');
			if (typeof runId === 'string') { res.status(400).json({ code: 'INVALID_PARAM', message: runId }); return; }

			const run = await genService.getRunById(runId, schoolId, schoolYearId);
			res.json({ run });
		} catch (e) { next(e); }
	},
);

// ─── GET /:schoolId/:schoolYearId/runs/:runId/violations — run violations ───

router.get(
	'/:schoolId/:schoolYearId/runs/:runId/violations',
	authenticate,
	async (req: Request, res: Response, next: NextFunction) => {
		try {
			const role = req.user?.role;
			if (!role || !PRIVILEGED_ROLES.has(role)) {
				res.status(403).json({ code: 'FORBIDDEN', message: 'Only admin, officer, or SYSTEM_ADMIN can view violation reports.' });
				return;
			}

			const schoolId = positiveInt(req.params.schoolId, 'schoolId');
			if (typeof schoolId === 'string') { res.status(400).json({ code: 'INVALID_PARAM', message: schoolId }); return; }
			const schoolYearId = positiveInt(req.params.schoolYearId, 'schoolYearId');
			if (typeof schoolYearId === 'string') { res.status(400).json({ code: 'INVALID_PARAM', message: schoolYearId }); return; }
			const runId = positiveInt(req.params.runId, 'runId');
			if (typeof runId === 'string') { res.status(400).json({ code: 'INVALID_PARAM', message: runId }); return; }

			const report = await genService.getRunViolations(runId, schoolId, schoolYearId);
			res.json(report);
		} catch (e) { next(e); }
	},
);

// ─── GET /:schoolId/:schoolYearId/runs/:runId/draft — run draft entries ───

router.get(
	'/:schoolId/:schoolYearId/runs/:runId/draft',
	authenticate,
	async (req: Request, res: Response, next: NextFunction) => {
		try {
			const role = req.user?.role;
			if (!role || !PRIVILEGED_ROLES.has(role)) {
				res.status(403).json({ code: 'FORBIDDEN', message: 'Only admin, officer, or SYSTEM_ADMIN can view draft entries.' });
				return;
			}

			const schoolId = positiveInt(req.params.schoolId, 'schoolId');
			if (typeof schoolId === 'string') { res.status(400).json({ code: 'INVALID_PARAM', message: schoolId }); return; }
			const schoolYearId = positiveInt(req.params.schoolYearId, 'schoolYearId');
			if (typeof schoolYearId === 'string') { res.status(400).json({ code: 'INVALID_PARAM', message: schoolYearId }); return; }
			const runId = positiveInt(req.params.runId, 'runId');
			if (typeof runId === 'string') { res.status(400).json({ code: 'INVALID_PARAM', message: runId }); return; }

			const report = await genService.getRunDraft(runId, schoolId, schoolYearId);
			res.json(report);
		} catch (e) { next(e); }
	},
);

// ─── GET /:schoolId/:schoolYearId/runs — run history ───

router.get(
	'/:schoolId/:schoolYearId/runs',
	authenticate,
	async (req: Request, res: Response, next: NextFunction) => {
		try {
			const role = req.user?.role;
			if (!role || !PRIVILEGED_ROLES.has(role)) {
				res.status(403).json({ code: 'FORBIDDEN', message: 'Only admin, officer, or SYSTEM_ADMIN can view generation runs.' });
				return;
			}

			const schoolId = positiveInt(req.params.schoolId, 'schoolId');
			if (typeof schoolId === 'string') { res.status(400).json({ code: 'INVALID_PARAM', message: schoolId }); return; }
			const schoolYearId = positiveInt(req.params.schoolYearId, 'schoolYearId');
			if (typeof schoolYearId === 'string') { res.status(400).json({ code: 'INVALID_PARAM', message: schoolYearId }); return; }

			const limitRaw = req.query.limit;
			let limit = 20;
			if (limitRaw !== undefined) {
				const parsed = Number(limitRaw);
				if (!Number.isInteger(parsed) || parsed < 1 || parsed > 100) {
					res.status(400).json({ code: 'INVALID_PARAM', message: 'limit must be an integer between 1 and 100.' });
					return;
				}
				limit = parsed;
			}

			const runs = await genService.listRuns(schoolId, schoolYearId, limit);
			res.json({ runs, count: runs.length });
		} catch (e) { next(e); }
	},
);

// ─── POST /:schoolId/:schoolYearId/runs/:runId/fix-suggestions — get fix suggestions for an unassigned item ───

router.post(
	'/:schoolId/:schoolYearId/runs/:runId/fix-suggestions',
	authenticate,
	async (req: Request, res: Response, next: NextFunction) => {
		try {
			const role = req.user?.role;
			if (!role || !PRIVILEGED_ROLES.has(role)) {
				res.status(403).json({ code: 'FORBIDDEN', message: 'Only admin, officer, or SYSTEM_ADMIN can request fix suggestions.' });
				return;
			}

			const schoolId = positiveInt(req.params.schoolId, 'schoolId');
			if (typeof schoolId === 'string') { res.status(400).json({ code: 'INVALID_PARAM', message: schoolId }); return; }
			const schoolYearId = positiveInt(req.params.schoolYearId, 'schoolYearId');
			if (typeof schoolYearId === 'string') { res.status(400).json({ code: 'INVALID_PARAM', message: schoolYearId }); return; }
			const runId = positiveInt(req.params.runId, 'runId');
			if (typeof runId === 'string') { res.status(400).json({ code: 'INVALID_PARAM', message: runId }); return; }

			const { sectionId, subjectId, gradeLevel, session, reason } = req.body;
			const validReasons = ['NO_QUALIFIED_FACULTY', 'FACULTY_OVERLOADED', 'NO_AVAILABLE_SLOT', 'NO_COMPATIBLE_ROOM'];
			if (!sectionId || !subjectId || !reason || !validReasons.includes(reason)) {
				res.status(400).json({ code: 'INVALID_BODY', message: 'sectionId, subjectId, session, gradeLevel, and a valid reason are required.' });
				return;
			}

			const result = await getFixSuggestions(schoolId, schoolYearId, runId, {
				sectionId: Number(sectionId),
				subjectId: Number(subjectId),
				gradeLevel: Number(gradeLevel) || 0,
				session: Number(session) || 1,
				reason,
			});

			res.json(result);
		} catch (e) { next(e); }
	},
);

export default router;
