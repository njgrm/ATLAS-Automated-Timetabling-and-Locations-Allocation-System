import { Router } from 'express';
import type { Request, Response, NextFunction } from 'express';
import { authenticate } from '../middleware/authenticate.js';
import * as manualEditService from '../services/manual-edit.service.js';

const router = Router();

// ─── Helpers ───

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

// ─── POST /:schoolId/:schoolYearId/runs/:runId/manual-edits/preview ───

router.post(
	'/:schoolId/:schoolYearId/runs/:runId/manual-edits/preview',
	authenticate,
	async (req: Request, res: Response, next: NextFunction) => {
		try {
			const role = req.user?.role;
			if (!role || !PRIVILEGED_ROLES.has(role)) {
				res.status(403).json({ code: 'FORBIDDEN', message: 'Only admin, officer, or SYSTEM_ADMIN can preview manual edits.' });
				return;
			}

			const scope = parseScope(req.params as Record<string, string>);
			if (typeof scope === 'string') { res.status(400).json({ code: 'INVALID_PARAM', message: scope }); return; }

			const proposal = req.body;
			if (!proposal || !proposal.editType) {
				res.status(400).json({ code: 'INVALID_BODY', message: 'Request body must include editType.' });
				return;
			}

			const result = await manualEditService.previewManualEdit(
				scope.runId, scope.schoolId, scope.schoolYearId, proposal,
			);
			res.json(result);
		} catch (e) { next(e); }
	},
);

// ─── POST /:schoolId/:schoolYearId/runs/:runId/manual-edits/commit ───

router.post(
	'/:schoolId/:schoolYearId/runs/:runId/manual-edits/commit',
	authenticate,
	async (req: Request, res: Response, next: NextFunction) => {
		try {
			const role = req.user?.role;
			if (!role || !PRIVILEGED_ROLES.has(role)) {
				res.status(403).json({ code: 'FORBIDDEN', message: 'Only admin, officer, or SYSTEM_ADMIN can commit manual edits.' });
				return;
			}

			const scope = parseScope(req.params as Record<string, string>);
			if (typeof scope === 'string') { res.status(400).json({ code: 'INVALID_PARAM', message: scope }); return; }

			const actorId = req.user?.userId;
			if (!actorId) { res.status(401).json({ code: 'NO_USER', message: 'Authenticated user required.' }); return; }

			const { proposal, expectedVersion } = req.body ?? {};
			if (!proposal || !proposal.editType) {
				res.status(400).json({ code: 'INVALID_BODY', message: 'Request body must include proposal.editType.' });
				return;
			}
			if (typeof expectedVersion !== 'number') {
				res.status(400).json({ code: 'INVALID_BODY', message: 'Request body must include expectedVersion (number).' });
				return;
			}

			const result = await manualEditService.commitManualEdit(
				scope.runId, scope.schoolId, scope.schoolYearId, actorId, proposal, expectedVersion,
			);
			res.json(result);
		} catch (e) { next(e); }
	},
);

// ─── POST /:schoolId/:schoolYearId/runs/:runId/manual-edits/revert ───

router.post(
	'/:schoolId/:schoolYearId/runs/:runId/manual-edits/revert',
	authenticate,
	async (req: Request, res: Response, next: NextFunction) => {
		try {
			const role = req.user?.role;
			if (!role || !PRIVILEGED_ROLES.has(role)) {
				res.status(403).json({ code: 'FORBIDDEN', message: 'Only admin, officer, or SYSTEM_ADMIN can revert manual edits.' });
				return;
			}

			const scope = parseScope(req.params as Record<string, string>);
			if (typeof scope === 'string') { res.status(400).json({ code: 'INVALID_PARAM', message: scope }); return; }

			const actorId = req.user?.userId;
			if (!actorId) { res.status(401).json({ code: 'NO_USER', message: 'Authenticated user required.' }); return; }

			const result = await manualEditService.revertLastEdit(
				scope.runId, scope.schoolId, scope.schoolYearId, actorId,
			);
			res.json(result);
		} catch (e) { next(e); }
	},
);

// ─── GET /:schoolId/:schoolYearId/runs/:runId/manual-edits ───

router.get(
	'/:schoolId/:schoolYearId/runs/:runId/manual-edits',
	authenticate,
	async (req: Request, res: Response, next: NextFunction) => {
		try {
			const role = req.user?.role;
			if (!role || !PRIVILEGED_ROLES.has(role)) {
				res.status(403).json({ code: 'FORBIDDEN', message: 'Only admin, officer, or SYSTEM_ADMIN can view manual edit history.' });
				return;
			}

			const scope = parseScope(req.params as Record<string, string>);
			if (typeof scope === 'string') { res.status(400).json({ code: 'INVALID_PARAM', message: scope }); return; }

			const edits = await manualEditService.listManualEdits(
				scope.runId, scope.schoolId, scope.schoolYearId,
			);
			res.json({ edits, count: edits.length });
		} catch (e) { next(e); }
	},
);

export default router;
