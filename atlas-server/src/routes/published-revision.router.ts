import { Router } from 'express';
import type { Request, Response, NextFunction } from 'express';
import { authenticate } from '../middleware/authenticate.js';
import {
	createPublishedScheduleRevision,
	createPublishedSwapRevision,
	listPublishedScheduleRevisions,
	resolveEffectivePublishedIdentitySnapshot,
	resolveLatestPublishedSourceRevision,
	withdrawPublishedScheduleRevision,
} from '../services/published-revision.service.js';

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

function assertPrivileged(req: Request, res: Response): boolean {
	const role = req.user?.role;
	if (!role || !PRIVILEGED_ROLES.has(role)) {
		res.status(403).json({ code: 'FORBIDDEN', message: 'Only admin, officer, or SYSTEM_ADMIN can manage published schedule revisions.' });
		return false;
	}
	return true;
}

function assertActorSchool(req: Request, res: Response, schoolId: number): boolean {
	const actorSchoolId = req.user?.schoolId;
	if (!actorSchoolId) {
		res.status(403).json({ code: 'ACTOR_SCHOOL_UNRESOLVED', message: 'Published schedule revisions require an authenticated school scope.' });
		return false;
	}
	if (actorSchoolId !== schoolId) {
		res.status(403).json({ code: 'CROSS_SCHOOL_DENIED', message: 'The authenticated actor cannot manage another school\'s published schedule revisions.' });
		return false;
	}
	return true;
}

router.get(
	'/:schoolId/:schoolYearId/runs/:runId/published-revisions',
	authenticate,
	async (req: Request, res: Response, next: NextFunction) => {
		try {
			if (!assertPrivileged(req, res)) return;

			const scope = parseScope(req.params as Record<string, string>);
			if (typeof scope === 'string') { res.status(400).json({ code: 'INVALID_PARAM', message: scope }); return; }
			if (!assertActorSchool(req, res, scope.schoolId)) return;

			const revisions = await listPublishedScheduleRevisions({
				schoolId: scope.schoolId,
				schoolYearId: scope.schoolYearId,
				sourceRunId: scope.runId,
			});
			const latest = await resolveLatestPublishedSourceRevision({
				schoolId: scope.schoolId,
				schoolYearId: scope.schoolYearId,
				sourceRunId: scope.runId,
			});
			res.json({
				revisions,
				count: revisions.length,
				latestRevisionId: latest.latestRevisionId,
				baseRevisionId: latest.baseRevisionId,
			});
		} catch (e) { next(e); }
	},
);

router.post(
	'/:schoolId/:schoolYearId/runs/:runId/published-revisions',
	authenticate,
	async (req: Request, res: Response, next: NextFunction) => {
		try {
			if (!assertPrivileged(req, res)) return;

			const scope = parseScope(req.params as Record<string, string>);
			if (typeof scope === 'string') { res.status(400).json({ code: 'INVALID_PARAM', message: scope }); return; }
			if (!assertActorSchool(req, res, scope.schoolId)) return;

			const actorId = req.user?.userId;
			if (!actorId) { res.status(401).json({ code: 'NO_USER', message: 'Authenticated user required.' }); return; }

			const { effectiveDate, reason, sourceRevisionId, changeSummary, metadata } = req.body ?? {};
			const changes = Array.isArray(req.body?.changes)
				? req.body.changes
				: Array.isArray(req.body?.changeSet)
					? req.body.changeSet
					: undefined;

			const result = await createPublishedScheduleRevision({
				schoolId: scope.schoolId,
				schoolYearId: scope.schoolYearId,
				sourceRunId: scope.runId,
				sourceRevisionId: sourceRevisionId ?? null,
				actorId,
				effectiveDate,
				reason,
				changes,
				changeSummary: changeSummary ?? null,
				metadata: metadata ?? null,
			});

			res.status(201).json(result);
		} catch (e) { next(e); }
	},
);

/**
 * PUBLISHED-REVISION-AUTHORITY-C12 (R3) — the supported path for a swap on a
 * published run. Direct manual swaps stay fail-closed with 409
 * `RUN_ALREADY_PUBLISHED`; this action expresses the same two-entry timeslot
 * exchange as a `PUBLISHED_SWAP` published revision with an effective date,
 * inheriting revision shape validation, hard-constraint validation, snapshot
 * binding, and the audit row. Same privileged + actor-school gates as the
 * revision create path.
 */
router.post(
	'/:schoolId/:schoolYearId/runs/:runId/published-revisions/swap',
	authenticate,
	async (req: Request, res: Response, next: NextFunction) => {
		try {
			if (!assertPrivileged(req, res)) return;

			const scope = parseScope(req.params as Record<string, string>);
			if (typeof scope === 'string') { res.status(400).json({ code: 'INVALID_PARAM', message: scope }); return; }
			if (!assertActorSchool(req, res, scope.schoolId)) return;

			const actorId = req.user?.userId;
			if (!actorId) { res.status(401).json({ code: 'NO_USER', message: 'Authenticated user required.' }); return; }

			const { effectiveDate, reason, sourceRevisionId, entryIdA, entryIdB, changeSummary, metadata } = req.body ?? {};

			const result = await createPublishedSwapRevision({
				schoolId: scope.schoolId,
				schoolYearId: scope.schoolYearId,
				sourceRunId: scope.runId,
				sourceRevisionId: sourceRevisionId ?? null,
				actorId,
				effectiveDate,
				reason,
				entryIdA,
				entryIdB,
				changeSummary: changeSummary ?? null,
				metadata: metadata ?? null,
			});

			res.status(201).json(result);
		} catch (e) { next(e); }
	},
);

/**
 * D4 — the effective-dated identity read. Resolves the frozen base publication
 * snapshot and applies every already-effective scheduled revision
 * `identityOverrides` in effective-date order at `asOf`. Read-only; the base
 * revision bytes are never mutated. Same privileged + actor-school gates as the
 * revision write family.
 */
router.get(
	'/:schoolId/:schoolYearId/runs/:runId/published-revisions/effective-identity',
	authenticate,
	async (req: Request, res: Response, next: NextFunction) => {
		try {
			if (!assertPrivileged(req, res)) return;

			const scope = parseScope(req.params as Record<string, string>);
			if (typeof scope === 'string') { res.status(400).json({ code: 'INVALID_PARAM', message: scope }); return; }
			if (!assertActorSchool(req, res, scope.schoolId)) return;

			const asOf = typeof req.query.asOf === 'string' && req.query.asOf.length > 0 ? req.query.asOf : null;
			const result = await resolveEffectivePublishedIdentitySnapshot({
				schoolId: scope.schoolId,
				schoolYearId: scope.schoolYearId,
				sourceRunId: scope.runId,
				asOf,
			});
			res.json(result);
		} catch (e) { next(e); }
	},
);

/**
 * D4 — bounded, audited, reason-required withdraw/supersede of a scheduled
 * published revision. The immutable base revision can never be withdrawn. Same
 * privileged + actor-school gates as the revision create/swap paths.
 */
router.post(
	'/:schoolId/:schoolYearId/runs/:runId/published-revisions/:revisionId/withdraw',
	authenticate,
	async (req: Request, res: Response, next: NextFunction) => {
		try {
			if (!assertPrivileged(req, res)) return;

			const scope = parseScope(req.params as Record<string, string>);
			if (typeof scope === 'string') { res.status(400).json({ code: 'INVALID_PARAM', message: scope }); return; }
			if (!assertActorSchool(req, res, scope.schoolId)) return;

			const actorId = req.user?.userId;
			if (!actorId) { res.status(401).json({ code: 'NO_USER', message: 'Authenticated user required.' }); return; }

			const revisionId = positiveInt((req.params as Record<string, string>).revisionId, 'revisionId');
			if (typeof revisionId === 'string') { res.status(400).json({ code: 'INVALID_PARAM', message: revisionId }); return; }

			const result = await withdrawPublishedScheduleRevision({
				schoolId: scope.schoolId,
				schoolYearId: scope.schoolYearId,
				sourceRunId: scope.runId,
				revisionId,
				actorId,
				reason: req.body?.reason,
			});
			res.json(result);
		} catch (e) { next(e); }
	},
);

export default router;