import { Router } from 'express';
import type { Request, Response, NextFunction } from 'express';
import { authenticate } from '../middleware/authenticate.js';
import { assertRequestSchoolScope, requestHasCapability } from '../middleware/authorize.js';
import * as manualEditService from '../services/manual-edit.service.js';

const router = Router();

// ─── Helpers ───

const PRIVILEGED_ROLES: Set<string> = new Set(['admin', 'officer', 'SYSTEM_ADMIN']);

function assertTimetableCapability(req: Request, res: Response, capability: 'timetable:edit' | 'timetable:read'): boolean {
	if (requestHasCapability(req, capability)) return true;
	res.status(403).json({ code: 'FORBIDDEN', message: `The ${capability} capability is required.` });
	return false;
}

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

/**
 * A2-TIMETABLE-CUSTODY (Part 2) — the closed `SwapStrategy` union, as an
 * EXPLICIT ALLOWLIST at the wire boundary.
 *
 * These three members are the same three declared by
 * `export type SwapStrategy` in `manual-edit.service.ts:1954`. The set is TYPED by
 * that union, so a member that is not in the union is a COMPILE error here, and
 * `S5` in `timetable-swap-custody-a2.test.ts` additionally reads both declarations
 * at runtime and fails if they ever drift. Neither the type nor the test can
 * quietly fall behind the other.
 *
 * Why it is an allowlist and not a comparison: the service's only test of the
 * value is `strategy === 'AUTO_FIX_MOVE_BLOCKING' || strategy === 'AUTO_FIX_MOVE_SOURCE'`
 * (`manual-edit.service.ts:2364`), which is FALSE for anything unknown — so an
 * unrecognised value fell through to the plain-swap branch and COMMITTED, while
 * the published message guard (`timetable-edit-message.ts`) was exclusion-based
 * and therefore also treated it as "not a direct swap", claiming a relocation
 * that never happened. One unrecognised string produced both a wrong commit and
 * a false claim. An allowlist has no such gap: a non-member cannot be admitted by
 * omission.
 */
const VALID_SWAP_STRATEGIES: ReadonlySet<manualEditService.SwapStrategy> = new Set<manualEditService.SwapStrategy>([
	'DIRECT_SWAP',
	'AUTO_FIX_MOVE_BLOCKING',
	'AUTO_FIX_MOVE_SOURCE',
]);

/**
 * Resolve the requested `strategy` into a member of the closed union.
 *
 * An ABSENT value means `DIRECT_SWAP`, and that is the pre-existing contract
 * rather than a new convenience:
 *   - `swapManualEntries` declares `strategy: SwapStrategy = 'DIRECT_SWAP'`
 *     (`manual-edit.service.ts:2341`), and a default parameter applies to an
 *     explicitly-passed `undefined` — which is exactly what this route always
 *     sent for an absent key;
 *   - `previewManualSwapEntries` recommends `'DIRECT_SWAP'` (`:2301`);
 *   - the one in-process caller passes the literal (`room-preference.service.ts:1423`);
 *   - the React caller always sends a member (`useTimetableMutations.ts:1881,1903`).
 *
 * So absence is resolved here explicitly rather than being left to a distant
 * default parameter, and a value that is PRESENT but not a member is refused.
 * A `null` is the JSON encoding of "no value" and is treated as absent, exactly
 * as it behaved before this route validated anything.
 */
function resolveSwapStrategy(raw: unknown): SwapStrategyResolution {
	if (raw === undefined || raw === null) return { strategy: 'DIRECT_SWAP' };
	// `Set.has` takes `unknown` at runtime, so a non-string (number, array,
	// object, boolean) is refused rather than coerced to a string first.
	if (typeof raw !== 'string' || !VALID_SWAP_STRATEGIES.has(raw as manualEditService.SwapStrategy)) {
		return {
			refusal: {
				code: 'INVALID_STRATEGY',
				message: `strategy must be one of: ${[...VALID_SWAP_STRATEGIES].join(', ')}`,
			},
		};
	}
	return { strategy: raw as manualEditService.SwapStrategy };
}

type SwapStrategyResolution =
	| { strategy: manualEditService.SwapStrategy }
	| { refusal: { code: string; message: string } };

// ─── POST /:schoolId/:schoolYearId/runs/:runId/manual-edits/preview ───

router.post(
	'/:schoolId/:schoolYearId/runs/:runId/manual-edits/preview',
	authenticate,
	async (req: Request, res: Response, next: NextFunction) => {
		try {
			if (!assertTimetableCapability(req, res, 'timetable:edit')) return;

			const scope = parseScope(req.params as Record<string, string>);
			if (typeof scope === 'string') { res.status(400).json({ code: 'INVALID_PARAM', message: scope }); return; }
			if (!assertRequestSchoolScope(req, res, scope.schoolId)) return;

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
			if (!assertTimetableCapability(req, res, 'timetable:edit')) return;

			const scope = parseScope(req.params as Record<string, string>);
			if (typeof scope === 'string') { res.status(400).json({ code: 'INVALID_PARAM', message: scope }); return; }
			if (!assertRequestSchoolScope(req, res, scope.schoolId)) return;

			const actorId = req.user?.userId;
			if (!actorId) { res.status(401).json({ code: 'NO_USER', message: 'Authenticated user required.' }); return; }

			const { proposal, expectedVersion, allowSoftOverride } = req.body ?? {};
			if (!proposal || !proposal.editType) {
				res.status(400).json({ code: 'INVALID_BODY', message: 'Request body must include proposal.editType.' });
				return;
			}
			if (typeof expectedVersion !== 'number') {
				res.status(400).json({ code: 'INVALID_BODY', message: 'Request body must include expectedVersion (number).' });
				return;
			}

			const result = await manualEditService.commitManualEdit(
				scope.runId, scope.schoolId, scope.schoolYearId, actorId, proposal, expectedVersion, !!allowSoftOverride,
			);
			res.json(result);
		} catch (e) { next(e); }
	},
);

// ─── POST /:schoolId/:schoolYearId/runs/:runId/manual-edits/batch/preview ───

router.post(
	'/:schoolId/:schoolYearId/runs/:runId/manual-edits/batch/preview',
	authenticate,
	async (req: Request, res: Response, next: NextFunction) => {
		try {
			if (!assertTimetableCapability(req, res, 'timetable:edit')) return;

			const scope = parseScope(req.params as Record<string, string>);
			if (typeof scope === 'string') { res.status(400).json({ code: 'INVALID_PARAM', message: scope }); return; }
			if (!assertRequestSchoolScope(req, res, scope.schoolId)) return;

			const { proposals } = req.body ?? {};
			if (!Array.isArray(proposals) || proposals.length === 0) {
				res.status(400).json({ code: 'INVALID_BODY', message: 'Request body must include at least one proposal.' });
				return;
			}

			const result = await manualEditService.previewManualEditBatch(
				scope.runId, scope.schoolId, scope.schoolYearId, proposals,
			);
			res.json(result);
		} catch (e) { next(e); }
	},
);

// ─── POST /:schoolId/:schoolYearId/runs/:runId/manual-edits/batch/commit ───

router.post(
	'/:schoolId/:schoolYearId/runs/:runId/manual-edits/batch/commit',
	authenticate,
	async (req: Request, res: Response, next: NextFunction) => {
		try {
			if (!assertTimetableCapability(req, res, 'timetable:edit')) return;

			const scope = parseScope(req.params as Record<string, string>);
			if (typeof scope === 'string') { res.status(400).json({ code: 'INVALID_PARAM', message: scope }); return; }
			if (!assertRequestSchoolScope(req, res, scope.schoolId)) return;

			const actorId = req.user?.userId;
			if (!actorId) { res.status(401).json({ code: 'NO_USER', message: 'Authenticated user required.' }); return; }

			const { proposals, expectedVersion, allowSoftOverride } = req.body ?? {};
			if (!Array.isArray(proposals) || proposals.length === 0) {
				res.status(400).json({ code: 'INVALID_BODY', message: 'Request body must include at least one proposal.' });
				return;
			}
			if (typeof expectedVersion !== 'number') {
				res.status(400).json({ code: 'INVALID_BODY', message: 'Request body must include expectedVersion (number).' });
				return;
			}

			const result = await manualEditService.commitManualEditBatch(
				scope.runId,
				scope.schoolId,
				scope.schoolYearId,
				actorId,
				proposals,
				expectedVersion,
				!!allowSoftOverride,
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
			if (!assertTimetableCapability(req, res, 'timetable:edit')) return;

			const scope = parseScope(req.params as Record<string, string>);
			if (typeof scope === 'string') { res.status(400).json({ code: 'INVALID_PARAM', message: scope }); return; }
			if (!assertRequestSchoolScope(req, res, scope.schoolId)) return;

			const actorId = req.user?.userId;
			if (!actorId) { res.status(401).json({ code: 'NO_USER', message: 'Authenticated user required.' }); return; }
			const operationId = Number(req.body.operationId);
			const expectedVersion = Number(req.body.expectedVersion);
			if (!Number.isInteger(operationId) || !Number.isInteger(expectedVersion)) {
				res.status(400).json({ code: 'INVALID_BODY', message: 'operationId and expectedVersion are required integers.' });
				return;
			}

			const result = await manualEditService.revertLastEdit(
				scope.runId, scope.schoolId, scope.schoolYearId, actorId, operationId, expectedVersion,
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
			if (!assertTimetableCapability(req, res, 'timetable:read')) return;

			const scope = parseScope(req.params as Record<string, string>);
			if (typeof scope === 'string') { res.status(400).json({ code: 'INVALID_PARAM', message: scope }); return; }
			if (!assertRequestSchoolScope(req, res, scope.schoolId)) return;

			const edits = await manualEditService.listManualEdits(
				scope.runId, scope.schoolId, scope.schoolYearId,
			);
			res.json({ edits, count: edits.length });
		} catch (e) { next(e); }
	},
);

// ─── POST /:schoolId/:schoolYearId/runs/:runId/manual-edits/swap/preview ───

router.post(
	'/:schoolId/:schoolYearId/runs/:runId/manual-edits/swap/preview',
	authenticate,
	async (req: Request, res: Response, next: NextFunction) => {
		try {
			if (!assertTimetableCapability(req, res, 'timetable:edit')) return;
			const scope = parseScope(req.params as Record<string, string>);
			if (typeof scope === 'string') { res.status(400).json({ code: 'INVALID_PARAM', message: scope }); return; }
			if (!assertRequestSchoolScope(req, res, scope.schoolId)) return;
			const { entryIdA, entryIdB } = req.body ?? {};
			if (!entryIdA || !entryIdB) {
				res.status(400).json({ code: 'INVALID_BODY', message: 'entryIdA and entryIdB are required.' });
				return;
			}
			const result = await manualEditService.previewManualSwapEntries(scope.runId, scope.schoolId, scope.schoolYearId, entryIdA, entryIdB);
			res.json(result);
		} catch (e) { next(e); }
	},
);

// ─── POST /:schoolId/:schoolYearId/runs/:runId/manual-edits/swap ───

router.post(
	'/:schoolId/:schoolYearId/runs/:runId/manual-edits/swap',
	authenticate,
	async (req: Request, res: Response, next: NextFunction) => {
		try {
			if (!assertTimetableCapability(req, res, 'timetable:edit')) return;
			const scope = parseScope(req.params as Record<string, string>);
			if (typeof scope === 'string') { res.status(400).json({ code: 'INVALID_PARAM', message: scope }); return; }
			if (!assertRequestSchoolScope(req, res, scope.schoolId)) return;
			const actorId = req.user?.userId;
			if (!actorId) { res.status(401).json({ code: 'NO_USER', message: 'Authenticated user required.' }); return; }
			const { entryIdA, entryIdB, expectedVersion, strategy, autoFixTarget } = req.body ?? {};
			if (!entryIdA || !entryIdB) { res.status(400).json({ code: 'INVALID_BODY', message: 'entryIdA and entryIdB are required.' }); return; }
			if (typeof expectedVersion !== 'number') { res.status(400).json({ code: 'INVALID_BODY', message: 'expectedVersion (number) is required.' }); return; }
			// A2-TIMETABLE-CUSTODY (Part 2): refuse an unrecognised `strategy` HERE,
			// before the service is called at all, so the refusal is a typed 4xx with
			// genuinely zero writes — no version bump, no edit row, no audit row, no
			// published event. Validated after the required fields, so a body missing
			// `entryIdA` is still reported as such.
			const resolvedStrategy = resolveSwapStrategy(strategy);
			if ('refusal' in resolvedStrategy) {
				res.status(400).json({ code: resolvedStrategy.refusal.code, message: resolvedStrategy.refusal.message });
				return;
			}
			const result = await manualEditService.swapManualEntries(
				scope.runId,
				scope.schoolId,
				scope.schoolYearId,
				actorId,
				entryIdA,
				entryIdB,
				expectedVersion,
				resolvedStrategy.strategy,
				autoFixTarget,
			);
			res.json(result);
		} catch (e) { next(e); }
	},
);

export default router;
