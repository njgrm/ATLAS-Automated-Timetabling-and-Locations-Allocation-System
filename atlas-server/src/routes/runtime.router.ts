import { Router } from 'express';
import type { Request, Response, NextFunction } from 'express';
import { authenticate, authenticateWithSystemToken } from '../middleware/authenticate.js';
import { getUpstreamAuthToken } from '../middleware/upstream-auth.js';
import { resolveRuntimeContext } from '../services/runtime-context.service.js';
import {
	applyRolloverSync,
	applyTestYearRecovery,
	archiveAndSyncActiveYear,
	classifyRecoveryState,
	getRolloverStatus,
	previewArchiveAndSync,
	previewRolloverSync,
	previewTestYearRecovery,
	scaffoldTestYearRecoveryMirror,
	resetDummyYearAndApplyRollover,
} from '../services/enrollpro-rollover.service.js';
import { publishNotificationEvent } from '../services/notification-events.service.js';
import { getOrCreateTeachingLoadCycleSource } from '../services/teaching-load-cycle.service.js';
import { applyTermCacheSync, previewTermCacheSync } from '../services/enrollpro-term-contract.service.js';
import { getAutomationStatus, isTestModeEnabled, markSchoolYearAsTestData, withSchoolLock } from '../services/rollover-automation.service.js';

const router = Router();
const PRIVILEGED_ROLES = new Set(['admin', 'officer', 'SYSTEM_ADMIN']);

type RuntimeRouterDelegates = {
	applyRolloverSync: typeof applyRolloverSync;
	resetDummyYearAndApplyRollover: typeof resetDummyYearAndApplyRollover;
	publishNotificationEvent: typeof publishNotificationEvent;
	getOrCreateTeachingLoadCycleSource: typeof getOrCreateTeachingLoadCycleSource;
};

export type RuntimeRouterOverrides = Partial<RuntimeRouterDelegates>;

const defaultRuntimeRouterDelegates: RuntimeRouterDelegates = {
	applyRolloverSync,
	resetDummyYearAndApplyRollover,
	publishNotificationEvent,
	getOrCreateTeachingLoadCycleSource,
};

const runtimeDelegates = (req: Request): RuntimeRouterDelegates =>
	(req as Request & { runtimeRouterDelegates?: RuntimeRouterDelegates }).runtimeRouterDelegates
		?? defaultRuntimeRouterDelegates;

function isCanonicalActiveYearId(value: unknown): value is number {
	return typeof value === 'number' && Number.isSafeInteger(value) && value > 0;
}

async function requireResolvedActiveYear(
	schoolId: number,
	authToken: string | undefined,
	res: Response,
): Promise<number | null> {
	const preview = await previewRolloverSync(schoolId, authToken);
	if (isCanonicalActiveYearId(preview.enrollProActiveYear?.id)) {
		return preview.enrollProActiveYear.id;
	}
	res.status(409).json({
		code: 'ACTIVE_YEAR_UNRESOLVED',
		message: 'The EnrollPro active school year could not be resolved canonically; no rollover mutation was started.',
		mutationStarted: false,
	});
	return null;
}

function requireReturnedActiveYear(
	result: { enrollProActiveYear?: { id?: unknown } | null },
	res: Response,
): number | null {
	const schoolYearId = result.enrollProActiveYear?.id;
	if (isCanonicalActiveYearId(schoolYearId)) return schoolYearId;
	res.status(409).json({
		code: 'ROLLOVER_ACTIVE_YEAR_IDENTITY_INVALID',
		message: 'The rollover mutation result was received, but its active-year identity was invalid. Follow-on notifications and Teaching Load initialization were withheld; the rollover was not undone.',
		mutationResultReceived: true,
		followOnsWithheld: true,
		rollbackAttempted: false,
	});
	return null;
}

function parseSchoolId(raw: unknown): number | string {
	const schoolId = Number(raw ?? 1);
	if (!Number.isInteger(schoolId) || schoolId <= 0) {
		return 'schoolId must be a positive integer.';
	}
	return schoolId;
}

function isPrivilegedRole(role: unknown): boolean {
	return typeof role === 'string' && PRIVILEGED_ROLES.has(role);
}

/**
 * ACTOR-SCOPE-C01 — strict positive-integer parse for the actor-scoped runtime
 * read parameters. Unlike the shared `parseSchoolId`, a missing/malformed value
 * must NEVER default to school 1; the helper returns null so the caller emits a
 * typed 400 before any service, upstream, or database dispatch.
 */
function parseStrictSchoolId(raw: unknown): number | null {
	if (raw === undefined || raw === null || raw === '') return null;
	if (typeof raw === 'number') return Number.isSafeInteger(raw) && raw > 0 ? raw : null;
	if (typeof raw !== 'string' || !/^[1-9]\d*$/.test(raw)) return null;
	const value = Number(raw);
	return Number.isSafeInteger(value) && value > 0 ? value : null;
}

type RuntimeReadCaller = { schoolId: number; authSource: 'jwt' | 'system' };
type RuntimeMutationCaller = { schoolId: number; authSource: 'jwt' | 'system' };

/**
 * Actor/tenant authorization gate for the three runtime READ routes
 * (`/context`, `/rollover-status`, `/rollover-recovery/classify`).
 *
 * - malformed/absent/zero/negative/fractional schoolId -> 400 INVALID_PARAM;
 * - system/integration token -> allowed for any explicit positive schoolId;
 * - JWT actor school is read from the VERIFIED token; absent/non-positive
 *   -> 403 SCHOOL_SCOPE_REQUIRED; requested !== actor -> 403 CROSS_SCHOOL_DENIED;
 * - operator-only routes require a privileged role for JWT callers -> 403 FORBIDDEN.
 *
 * Every rejection returns null before any downstream dispatch.
 */
function authorizeRuntimeRead(
	req: Request,
	res: Response,
	options: { requirePrivileged: boolean },
): RuntimeReadCaller | null {
	const requestedSchoolId = parseStrictSchoolId(req.query.schoolId);
	if (requestedSchoolId == null) {
		res.status(400).json({ code: 'INVALID_PARAM', message: 'schoolId must be a present positive integer.' });
		return null;
	}

	const isSystemCaller = req.user?.authSource === 'system';
	if (!isSystemCaller && options.requirePrivileged && !isPrivilegedRole(req.user?.role)) {
		res.status(403).json({ code: 'FORBIDDEN', message: 'Only admin, officer, or SYSTEM_ADMIN can read this runtime data for a school.' });
		return null;
	}

	if (isSystemCaller) {
		return { schoolId: requestedSchoolId, authSource: 'system' };
	}

	const actorSchool = Number(req.user?.schoolId);
	if (!Number.isInteger(actorSchool) || actorSchool <= 0) {
		res.status(403).json({ code: 'SCHOOL_SCOPE_REQUIRED', message: 'Reading runtime data requires an authenticated actor school.' });
		return null;
	}
	if (actorSchool !== requestedSchoolId) {
		res.status(403).json({ code: 'CROSS_SCHOOL_DENIED', message: 'Cannot read runtime data for another school.' });
		return null;
	}
	return { schoolId: requestedSchoolId, authSource: 'jwt' };
}

/**
 * Actor/tenant authorization gate for rollover mutation routes. The target
 * school must always be explicit: system tokens may target any valid school,
 * while JWT callers must have and match their authenticated actor school.
 *
 * Every rejection returns null before locks, services, upstream calls, audit
 * writes, or notification dispatch.
 */
function authorizeRuntimeMutation(
	req: Request,
	res: Response,
	options: { requirePrivileged: boolean },
): RuntimeMutationCaller | null {
	const requestedSchoolId = parseStrictSchoolId(req.body && Object.prototype.hasOwnProperty.call(req.body, 'schoolId')
		? req.body.schoolId
		: req.query.schoolId);
	if (requestedSchoolId == null) {
		res.status(400).json({ code: 'INVALID_PARAM', message: 'schoolId must be a present positive integer.' });
		return null;
	}

	const isSystemCaller = req.user?.authSource === 'system';
	if (!isSystemCaller && options.requirePrivileged && !isPrivilegedRole(req.user?.role)) {
		res.status(403).json({ code: 'FORBIDDEN', message: 'Only admin, officer, or SYSTEM_ADMIN can mutate runtime data for a school.' });
		return null;
	}

	if (isSystemCaller) return { schoolId: requestedSchoolId, authSource: 'system' };

	const actorSchool = Number(req.user?.schoolId);
	if (!Number.isInteger(actorSchool) || actorSchool <= 0) {
		res.status(403).json({ code: 'SCHOOL_SCOPE_REQUIRED', message: 'Mutating runtime data requires an authenticated actor school.' });
		return null;
	}
	if (actorSchool !== requestedSchoolId) {
		res.status(403).json({ code: 'CROSS_SCHOOL_DENIED', message: 'Cannot mutate runtime data for another school.' });
		return null;
	}
	return { schoolId: requestedSchoolId, authSource: 'jwt' };
}

router.get('/context', authenticateWithSystemToken, async (req: Request, res: Response, next: NextFunction) => {
	try {
		const caller = authorizeRuntimeRead(req, res, { requirePrivileged: false });
		if (!caller) return;
		const schoolId = caller.schoolId;

		const verifyUpstream = req.query.verifyUpstream === 'true' || req.query.verifyUpstream === '1';
		const upstreamAuthToken = getUpstreamAuthToken(req, verifyUpstream);
		const context = await resolveRuntimeContext(schoolId, upstreamAuthToken, { verifyUpstream });

		if (!context) {
			res.status(404).json({
				code: 'NO_RUNTIME_CONTEXT',
				message: 'No ATLAS runtime context is available yet for this school. Run at least one successful sync first.',
				schoolId,
			});
			return;
		}

		res.json(context);
	} catch (err) {
		next(err);
	}
});

router.get('/rollover-status', authenticateWithSystemToken, async (req: Request, res: Response, next: NextFunction) => {
	try {
		const caller = authorizeRuntimeRead(req, res, { requirePrivileged: true });
		if (!caller) return;
		const schoolId = caller.schoolId;
		const includeCounts = req.query.includeCounts === 'true' || req.query.includeCounts === '1';
		const status = await getRolloverStatus(schoolId, getUpstreamAuthToken(req), { includeCounts });
		const automation = getAutomationStatus();
		const schoolAutomation = automation.schools.find((s) => s.schoolId === schoolId) ?? null;
		res.json({
			...status,
			testModeEnabled: isTestModeEnabled(),
			automation: {
				enabled: automation.enabled,
				testModeEnabled: isTestModeEnabled(),
				...schoolAutomation,
			},
		});
	} catch (err) {
		next(err);
	}
});

router.get('/rollover-recovery/classify', authenticateWithSystemToken, async (req: Request, res: Response, next: NextFunction) => {
	try {
		const caller = authorizeRuntimeRead(req, res, { requirePrivileged: true });
		if (!caller) return;
		const schoolId = caller.schoolId;
		const status = await getRolloverStatus(schoolId, getUpstreamAuthToken(req), { includeCounts: true });
		const classification = await classifyRecoveryState(schoolId, status);
		res.json(classification);
	} catch (err) {
		next(err);
	}
});

router.post('/rollover-recovery/mark-test-data', authenticateWithSystemToken, async (req: Request, res: Response, next: NextFunction) => {
	try {
		const caller = authorizeRuntimeMutation(req, res, { requirePrivileged: true });
		if (!caller) return;
		const schoolId = caller.schoolId;
		const schoolYearId = Number(req.body?.schoolYearId);
		if (!Number.isInteger(schoolYearId) || schoolYearId <= 0) {
			res.status(400).json({ code: 'INVALID_PARAM', message: 'schoolYearId must be a positive integer.' });
			return;
		}
		const markResult = await markSchoolYearAsTestData(schoolId, schoolYearId, req.user?.userId ?? 0);
		res.json({ marked: true, schoolId, schoolYearId, alreadyMarked: markResult.alreadyMarked });
	} catch (err) {
		next(err);
	}
});

// ─── RR-15C: privileged recovery-scaffold for legacy fixtures without a mirror ───

router.post('/rollover-recovery/scaffold', authenticateWithSystemToken, async (req: Request, res: Response, next: NextFunction) => {
	try {
		const caller = authorizeRuntimeMutation(req, res, { requirePrivileged: true });
		if (!caller) return;
		const schoolId = caller.schoolId;
		const rawYear = req.body?.schoolYearId;
		const schoolYearId = rawYear === undefined || rawYear === null ? undefined : Number(rawYear);
		if (schoolYearId !== undefined && (!Number.isInteger(schoolYearId) || schoolYearId <= 0)) {
			res.status(400).json({ code: 'INVALID_PARAM', message: 'schoolYearId must be a positive integer when provided.' });
			return;
		}
		const result = await withSchoolLock(schoolId, () => scaffoldTestYearRecoveryMirror({
			schoolId,
			schoolYearId,
			actorId: req.user?.userId ?? 0,
			authToken: getUpstreamAuthToken(req),
			acknowledgePublished: req.body?.acknowledgePublished === true,
		}));
		res.json(result);
	} catch (err) {
		next(err);
	}
});

router.get('/rollover-recovery/preview', authenticateWithSystemToken, async (req: Request, res: Response, next: NextFunction) => {
	try {
		const caller = authorizeRuntimeRead(req, res, { requirePrivileged: true });
		if (!caller) return;
		const result = await previewTestYearRecovery(caller.schoolId, getUpstreamAuthToken(req));
		res.json(result);
	} catch (err) {
		next(err);
	}
});

router.post('/rollover-recovery/apply', authenticateWithSystemToken, async (req: Request, res: Response, next: NextFunction) => {
	try {
		const caller = authorizeRuntimeMutation(req, res, { requirePrivileged: true });
		if (!caller) return;
		const schoolId = caller.schoolId;
		const result = await withSchoolLock(schoolId, () => applyTestYearRecovery({
			schoolId,
			actorId: req.user?.userId ?? 0,
			authToken: getUpstreamAuthToken(req),
			confirmClear: req.body?.confirmClear === true,
			confirmationText: typeof req.body?.confirmationText === 'string' ? req.body.confirmationText : undefined,
			acknowledgePublished: req.body?.acknowledgePublished === true,
		}));
		// RR-15: the recovery service is lifecycle-complete — it publishes the
		// lifecycle notifications itself (cleanup, sync, archive, Teaching Load
		// cycle) so this route stays transport-only and direct service callers
		// (including rollover automation) get identical behavior.
		res.json(result);
	} catch (err) {
		next(err);
	}
});

router.post('/rollover-sync/preview', authenticateWithSystemToken, async (req: Request, res: Response, next: NextFunction) => {
	try {
		const caller = authorizeRuntimeMutation(req, res, { requirePrivileged: false });
		if (!caller) return;
		const schoolId = caller.schoolId;
		const result = await previewRolloverSync(schoolId, getUpstreamAuthToken(req));
		res.json(result);
	} catch (err) {
		next(err);
	}
});

router.post('/rollover-sync/apply', authenticateWithSystemToken, async (req: Request, res: Response, next: NextFunction) => {
	try {
		const caller = authorizeRuntimeMutation(req, res, { requirePrivileged: true });
		if (!caller) return;
		const schoolId = caller.schoolId;
		const authToken = getUpstreamAuthToken(req);
		if (await requireResolvedActiveYear(schoolId, authToken, res) == null) return;
		const delegates = runtimeDelegates(req);
		const result = await withSchoolLock(schoolId, () => delegates.applyRolloverSync(schoolId, authToken, {
			actorId: req.user?.userId ?? 0,
			syncTermContract: true,
			acknowledgeReconfiguredSectionIds: Array.isArray(req.body?.acknowledgeReconfiguredSectionIds)
				? req.body.acknowledgeReconfiguredSectionIds
				: undefined,
		}));
		const schoolYearId = requireReturnedActiveYear(result, res);
		if (schoolYearId == null) return;
		delegates.publishNotificationEvent({
			type: 'ROLLOVER_SYNC_COMPLETED',
			domain: 'integration',
			severity: 'success',
			audience: 'PRIVILEGED',
			schoolId,
			schoolYearId,
			facultyId: null,
			message: `Active school year synced from EnrollPro${result.enrollProActiveYear?.yearLabel ? `: ${result.enrollProActiveYear.yearLabel}` : ''}.`,
			metadata: {
				enrollProActiveYear: result.enrollProActiveYear,
				facultyCount: result.sync.faculty?.activeCount ?? null,
				sectionCount: result.sync.sections?.count ?? null,
				policyReady: result.sync.policyReady,
			},
		});
		const teachingLoadCycle = await delegates.getOrCreateTeachingLoadCycleSource(schoolId, schoolYearId);
		delegates.publishNotificationEvent({
			type: 'TEACHING_LOAD_CHANGED',
			domain: 'integration',
			severity: 'info',
			audience: 'PRIVILEGED',
			schoolId,
			schoolYearId,
			facultyId: null,
			message: 'Teaching Load annual cycle is ready after rollover.',
			metadata: { state: teachingLoadCycle.state, version: teachingLoadCycle.version, updatedAt: teachingLoadCycle.updatedAt },
		});
		res.json(result);
	} catch (err) {
		next(err);
	}
});

router.post('/rollover-sync/reset-dummy-year', authenticateWithSystemToken, async (req: Request, res: Response, next: NextFunction) => {
	try {
		const caller = authorizeRuntimeMutation(req, res, { requirePrivileged: true });
		if (!caller) return;
		const schoolId = caller.schoolId;
		const authToken = getUpstreamAuthToken(req);
		if (await requireResolvedActiveYear(schoolId, authToken, res) == null) return;
		const delegates = runtimeDelegates(req);
		const result = await withSchoolLock(schoolId, () => delegates.resetDummyYearAndApplyRollover({
			schoolId,
			actorId: req.user?.userId ?? 0,
			authToken,
			confirmReset: req.body?.confirmReset === true,
			confirmationText: typeof req.body?.confirmationText === 'string' ? req.body.confirmationText : undefined,
		}));
		const schoolYearId = requireReturnedActiveYear(result, res);
		if (schoolYearId == null) return;
		delegates.publishNotificationEvent({
			type: result.resetApplied ? 'DUMMY_YEAR_RESET_COMPLETED' : 'DUMMY_YEAR_RESET_PREVIEWED',
			domain: 'integration',
			severity: result.resetApplied ? 'warning' : 'info',
			audience: 'PRIVILEGED',
			schoolId,
			schoolYearId,
			facultyId: null,
			message: result.resetApplied
				? 'Dummy school-year data was reset and EnrollPro rollover sync was applied.'
				: 'Dummy school-year reset preview is ready.',
			metadata: {
				enrollProActiveYear: result.enrollProActiveYear,
				resetTargetSchoolYearId: result.resetTargetSchoolYearId,
				previewOnly: result.previewOnly,
				resetApplied: result.resetApplied,
				conflictingRecordCounts: result.conflictingRecordCounts,
			},
		});
		res.json(result);
	} catch (err) {
		next(err);
	}
});

// ─── RR-09A: Non-destructive school-year archive + sync ───

router.post('/rollover-archive/preview', authenticateWithSystemToken, async (req: Request, res: Response, next: NextFunction) => {
	try {
		const caller = authorizeRuntimeMutation(req, res, { requirePrivileged: true });
		if (!caller) return;
		const schoolId = caller.schoolId;
		const result = await withSchoolLock(schoolId, () => previewArchiveAndSync(schoolId, getUpstreamAuthToken(req)));
		res.json(result);
	} catch (err) {
		next(err);
	}
});

router.post('/rollover-archive/apply', authenticateWithSystemToken, async (req: Request, res: Response, next: NextFunction) => {
	try {
		const caller = authorizeRuntimeMutation(req, res, { requirePrivileged: true });
		if (!caller) return;
		const schoolId = caller.schoolId;
		const actorId = req.user?.userId ?? 0;
		console.log(`[rollover-archive] apply school=${schoolId} actor=${actorId} (archive-and-sync, non-destructive)`);
		const result = await withSchoolLock(schoolId, () => archiveAndSyncActiveYear({
			schoolId,
			actorId,
			authToken: getUpstreamAuthToken(req),
			reason: typeof req.body?.reason === 'string' ? req.body.reason : undefined,
			acknowledgeReconfiguredSectionIds: Array.isArray(req.body?.acknowledgeReconfiguredSectionIds)
				? req.body.acknowledgeReconfiguredSectionIds
				: undefined,
		}));
		res.json(result);
	} catch (err) {
		next(err);
	}
});

// ─── RR-TERM-CACHE-C01 / C01R: narrow, actor-scoped term-authority catch-up ───
//
// Year alignment is reported separately by `/rollover-status`. This contract
// repairs ONLY a missing/stale persisted ordered-term cache; it never runs the
// broad faculty/section/Teaching Load rollover apply. Both routes are JWT-only
// privileged operator actions scoped to the authenticated actor's school.

/**
 * Strict positive-integer parse for the term-authority school parameter. Unlike
 * the shared `parseSchoolId`, a missing/malformed value must NEVER default to
 * school 1 — the catch-up workflow is an actor-scoped operator action.
 */
function parseStrictTermAuthoritySchoolId(raw: unknown): number | null {
	if (raw === undefined || raw === null || raw === '') return null;
	if (typeof raw === 'number') return Number.isSafeInteger(raw) && raw > 0 ? raw : null;
	if (typeof raw !== 'string' || !/^[1-9]\d*$/.test(raw)) return null;
	const value = Number(raw);
	return Number.isSafeInteger(value) && value > 0 ? value : null;
}

type TermAuthorityCaller = { schoolId: number; actorId: number };

/**
 * JWT-only, privileged, actor-school-scoped authority gate for BOTH
 * term-authority routes. It responds with the required typed rejection and
 * returns `null` before any service, upstream, or database dispatch when the
 * caller is not a same-school privileged operator.
 */
function authorizeTermAuthorityCaller(req: Request, res: Response): TermAuthorityCaller | null {
	if (!isPrivilegedRole(req.user?.role)) {
		res.status(403).json({ code: 'FORBIDDEN', message: 'Only admin, officer, or SYSTEM_ADMIN can preview or save ordered term authority.' });
		return null;
	}
	const actorId = Number(req.user?.userId);
	if (!Number.isInteger(actorId) || actorId <= 0) {
		res.status(403).json({ code: 'ACTOR_USER_REQUIRED', message: 'An authenticated actor identity is required to preview or save ordered term authority.' });
		return null;
	}
	const schoolId = parseStrictTermAuthoritySchoolId(req.body && Object.prototype.hasOwnProperty.call(req.body, 'schoolId')
		? req.body.schoolId
		: req.query.schoolId);
	if (schoolId == null) {
		res.status(400).json({ code: 'INVALID_PARAM', message: 'schoolId must be a present positive integer.' });
		return null;
	}
	const actorSchool = Number(req.user?.schoolId);
	if (!Number.isInteger(actorSchool) || actorSchool <= 0) {
		res.status(403).json({ code: 'SCHOOL_SCOPE_REQUIRED', message: 'Saving term authority requires an authenticated actor school.' });
		return null;
	}
	if (actorSchool !== schoolId) {
		res.status(403).json({ code: 'CROSS_SCHOOL_DENIED', message: 'Cannot operate on term authority for another school.' });
		return null;
	}
	return { schoolId, actorId };
}

router.post('/term-authority/preview', authenticate, async (req: Request, res: Response, next: NextFunction) => {
	try {
		const caller = authorizeTermAuthorityCaller(req, res);
		if (!caller) return;
		const result = await withSchoolLock(caller.schoolId, () => previewTermCacheSync({
			schoolId: caller.schoolId,
			authToken: getUpstreamAuthToken(req),
		}));
		res.json(result);
	} catch (err) {
		next(err);
	}
});

router.post('/term-authority/apply', authenticate, async (req: Request, res: Response, next: NextFunction) => {
	try {
		const caller = authorizeTermAuthorityCaller(req, res);
		if (!caller) return;
		const result = await withSchoolLock(caller.schoolId, () => applyTermCacheSync({
			schoolId: caller.schoolId,
			actorId: caller.actorId,
			authToken: getUpstreamAuthToken(req),
			confirmationText: req.body?.confirmationText,
			fingerprint: req.body?.fingerprint,
		}));
		res.json(result);
	} catch (err) {
		next(err);
	}
});

/**
 * Build a mounted runtime router with narrowly scoped rollover delegates for
 * production-path regression tests. The default export remains the production
 * router; no service, auth, or data-access dependency is overridable here.
 */
export function createRuntimeRouter(overrides: RuntimeRouterOverrides = {}) {
	const mounted = Router();
	mounted.use((req: Request, _res: Response, next: NextFunction) => {
		(req as Request & { runtimeRouterDelegates?: RuntimeRouterDelegates }).runtimeRouterDelegates = {
			...defaultRuntimeRouterDelegates,
			...overrides,
		};
		next();
	});
	mounted.use(router);
	return mounted;
}

export default router;
