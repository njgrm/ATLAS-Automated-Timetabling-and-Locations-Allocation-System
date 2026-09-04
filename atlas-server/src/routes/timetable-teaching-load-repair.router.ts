import { Router } from 'express';
import type { Request, Response, NextFunction } from 'express';

import { authenticate } from '../middleware/authenticate.js';
import {
	applyAnnualTeachingLoadChange,
	applyTeachingLoadRepair,
	previewAnnualTeachingLoadChange,
	previewTeachingLoadRepair,
	type AnnualTeachingLoadChange,
} from '../services/timetable-teaching-load-repair.service.js';
import {
	applyRunReconciliation,
	previewRunReconciliation,
} from '../services/reconciliation.service.js';
import type { ReconciliationSourceDomain } from '../services/reconciliation-classifier.js';

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

router.post(
	'/:schoolId/:schoolYearId/runs/:runId/teaching-load-repairs/preview',
	authenticate,
	async (req: Request, res: Response, next: NextFunction) => {
		try {
			if (!assertPrivileged(req, res)) return;
			const scope = parseScope(req.params as Record<string, string>);
			if (typeof scope === 'string') { res.status(400).json({ code: 'INVALID_PARAM', message: scope }); return; }
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
			if (!assertPrivileged(req, res)) return;
			const scope = parseScope(req.params as Record<string, string>);
			if (typeof scope === 'string') { res.status(400).json({ code: 'INVALID_PARAM', message: scope }); return; }
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
			if (!assertPrivileged(req, res)) return;
			const scope = parseAnnualScope(req.params as Record<string, string>);
			if (typeof scope === 'string') { res.status(400).json({ code: 'INVALID_PARAM', message: scope }); return; }
			const actorId = req.user?.userId;
			if (!actorId) { res.status(401).json({ code: 'NO_USER', message: 'Authenticated user required.' }); return; }
			const changes = parseAnnualChanges(req.body?.changes);
			if (typeof changes === 'string') { res.status(400).json({ code: 'INVALID_BODY', message: changes }); return; }
			const result = await previewAnnualTeachingLoadChange(scope.schoolId, scope.schoolYearId, actorId, changes);
			res.json(result);
		} catch (e) { next(e); }
	},
);

router.post(
	'/:schoolId/:schoolYearId/annual-teaching-load/apply',
	authenticate,
	async (req: Request, res: Response, next: NextFunction) => {
		try {
			if (!assertPrivileged(req, res)) return;
			const scope = parseAnnualScope(req.params as Record<string, string>);
			if (typeof scope === 'string') { res.status(400).json({ code: 'INVALID_PARAM', message: scope }); return; }
			const actorId = req.user?.userId;
			if (!actorId) { res.status(401).json({ code: 'NO_USER', message: 'Authenticated user required.' }); return; }
			const changes = parseAnnualChanges(req.body?.changes);
			if (typeof changes === 'string') { res.status(400).json({ code: 'INVALID_BODY', message: changes }); return; }
			const versions = (req.body?.expectedSubjectSectionOwnershipVersions ?? {}) as Record<string, number>;
			const result = await applyAnnualTeachingLoadChange(scope.schoolId, scope.schoolYearId, actorId, changes, versions);
			res.json(result);
		} catch (e) { next(e); }
	},
);

router.post(
	'/:schoolId/:schoolYearId/runs/:runId/reconciliation/preview',
	authenticate,
	async (req: Request, res: Response, next: NextFunction) => {
		try {
			if (!assertPrivileged(req, res)) return;
			const scope = parseScope(req.params as Record<string, string>);
			if (typeof scope === 'string') { res.status(400).json({ code: 'INVALID_PARAM', message: scope }); return; }
			const result = await previewRunReconciliation({ runId: scope.runId, schoolId: scope.schoolId, schoolYearId: scope.schoolYearId });
			res.json(result);
		} catch (e) { next(e); }
	},
);

router.post(
	'/:schoolId/:schoolYearId/runs/:runId/reconciliation/apply',
	authenticate,
	async (req: Request, res: Response, next: NextFunction) => {
		try {
			if (!assertPrivileged(req, res)) return;
			const scope = parseScope(req.params as Record<string, string>);
			if (typeof scope === 'string') { res.status(400).json({ code: 'INVALID_PARAM', message: scope }); return; }
			const actorId = req.user?.userId;
			if (!actorId) { res.status(401).json({ code: 'NO_USER', message: 'Authenticated user required.' }); return; }
			const expectedRunVersion = Number(req.body?.expectedRunVersion);
			const expectedFingerprint = String(req.body?.expectedFingerprint ?? '');
			if (!Number.isInteger(expectedRunVersion) || expectedRunVersion < 1) {
				res.status(400).json({ code: 'INVALID_BODY', message: 'expectedRunVersion is required.' });
				return;
			}
			if (!expectedFingerprint) {
				res.status(400).json({ code: 'INVALID_BODY', message: 'expectedFingerprint is required.' });
				return;
			}
			const result = await applyRunReconciliation({
				runId: scope.runId,
				schoolId: scope.schoolId,
				schoolYearId: scope.schoolYearId,
				actorId,
				expectedRunVersion,
				expectedFingerprint,
			});
			res.json(result);
		} catch (e) { next(e); }
	},
);

export default router;
