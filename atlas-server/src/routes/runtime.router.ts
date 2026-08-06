import { Router } from 'express';
import type { Request, Response, NextFunction } from 'express';
import { authenticateWithSystemToken } from '../middleware/authenticate.js';
import { resolveRuntimeContext } from '../services/runtime-context.service.js';
import {
	applyRolloverSync,
	getRolloverStatus,
	previewRolloverSync,
	resetDummyYearAndApplyRollover,
} from '../services/enrollpro-rollover.service.js';

const router = Router();
const PRIVILEGED_ROLES = new Set(['admin', 'officer', 'SYSTEM_ADMIN']);

function parseSchoolId(raw: unknown): number | string {
	const schoolId = Number(raw ?? 1);
	if (!Number.isInteger(schoolId) || schoolId <= 0) {
		return 'schoolId must be a positive integer.';
	}
	return schoolId;
}

function getUpstreamAuthToken(req: Request, enabled = true): string | undefined {
	if (!enabled) return undefined;
	const authToken = req.headers.authorization?.startsWith('Bearer ')
		? req.headers.authorization.slice(7)
		: undefined;
	return req.user?.authSource === 'bridge' ? authToken : undefined;
}

function isPrivilegedRole(role: unknown): boolean {
	return typeof role === 'string' && PRIVILEGED_ROLES.has(role);
}

router.get('/context', authenticateWithSystemToken, async (req: Request, res: Response, next: NextFunction) => {
	try {
		const schoolId = parseSchoolId(req.query.schoolId);
		if (typeof schoolId === 'string') {
			res.status(400).json({ code: 'INVALID_PARAM', message: schoolId });
			return;
		}

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
		const schoolId = parseSchoolId(req.query.schoolId);
		if (typeof schoolId === 'string') {
			res.status(400).json({ code: 'INVALID_PARAM', message: schoolId });
			return;
		}
		const includeCounts = req.query.includeCounts === 'true' || req.query.includeCounts === '1';
		const status = await getRolloverStatus(schoolId, getUpstreamAuthToken(req), { includeCounts });
		res.json(status);
	} catch (err) {
		next(err);
	}
});

router.post('/rollover-sync/preview', authenticateWithSystemToken, async (req: Request, res: Response, next: NextFunction) => {
	try {
		const schoolId = parseSchoolId(req.body?.schoolId ?? req.query.schoolId);
		if (typeof schoolId === 'string') {
			res.status(400).json({ code: 'INVALID_PARAM', message: schoolId });
			return;
		}
		const result = await previewRolloverSync(schoolId, getUpstreamAuthToken(req));
		res.json(result);
	} catch (err) {
		next(err);
	}
});

router.post('/rollover-sync/apply', authenticateWithSystemToken, async (req: Request, res: Response, next: NextFunction) => {
	try {
		if (!isPrivilegedRole(req.user?.role)) {
			res.status(403).json({ code: 'FORBIDDEN', message: 'Only admin, officer, or SYSTEM_ADMIN can sync a new school year from EnrollPro.' });
			return;
		}
		const schoolId = parseSchoolId(req.body?.schoolId ?? req.query.schoolId);
		if (typeof schoolId === 'string') {
			res.status(400).json({ code: 'INVALID_PARAM', message: schoolId });
			return;
		}
		const result = await applyRolloverSync(schoolId, getUpstreamAuthToken(req));
		res.json(result);
	} catch (err) {
		next(err);
	}
});

router.post('/rollover-sync/reset-dummy-year', authenticateWithSystemToken, async (req: Request, res: Response, next: NextFunction) => {
	try {
		if (!isPrivilegedRole(req.user?.role)) {
			res.status(403).json({ code: 'FORBIDDEN', message: 'Only admin, officer, or SYSTEM_ADMIN can reset dummy school-year data.' });
			return;
		}
		const schoolId = parseSchoolId(req.body?.schoolId ?? req.query.schoolId);
		if (typeof schoolId === 'string') {
			res.status(400).json({ code: 'INVALID_PARAM', message: schoolId });
			return;
		}
		const result = await resetDummyYearAndApplyRollover({
			schoolId,
			actorId: req.user?.userId ?? 0,
			authToken: getUpstreamAuthToken(req),
			confirmReset: req.body?.confirmReset === true,
			confirmationText: typeof req.body?.confirmationText === 'string' ? req.body.confirmationText : undefined,
		});
		res.json(result);
	} catch (err) {
		next(err);
	}
});

export default router;
