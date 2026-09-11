import { Router } from 'express';
import type { NextFunction, Request, Response } from 'express';

import { authenticate } from '../middleware/authenticate.js';
import { requirePrivilegedRole } from '../middleware/authorize.js';
import { parseStrictPositiveInt } from '../services/department-authority.service.js';
import {
	applyTeachingLoadCarryForward,
	previewTeachingLoadCarryForward,
} from '../services/teaching-load-carry-forward.service.js';

const router = Router();

function actorSchoolIdOf(req: Request): number | null {
	const schoolId = req.user?.schoolId;
	return typeof schoolId === 'number' && Number.isInteger(schoolId) && schoolId > 0 ? schoolId : null;
}

/**
 * Strict positive authenticated actor user id. Missing, zero, negative,
 * fractional, or non-number ids return null and are rejected before any
 * service/DB access.
 */
function actorUserIdOf(req: Request): number | null {
	const userId = req.user?.userId;
	return typeof userId === 'number' && Number.isInteger(userId) && userId > 0 ? userId : null;
}

type StrictBodyResult =
	| { ok: true; body: Record<string, unknown> }
	| { ok: false; statusCode: number; code: string; message: string };

/**
 * Strict body reader: rejects non-objects, arrays, and any key outside the
 * declared allow-list. Runs before any service/DB access so malformed input
 * produces zero reads and zero writes.
 */
export function readStrictBody(raw: unknown, allowedKeys: readonly string[]): StrictBodyResult {
	if (raw == null || typeof raw !== 'object' || Array.isArray(raw)) {
		return { ok: false, statusCode: 400, code: 'INVALID_BODY', message: 'A JSON object body is required.' };
	}
	const body = raw as Record<string, unknown>;
	const allowed = new Set(allowedKeys);
	for (const key of Object.keys(body)) {
		if (!allowed.has(key)) {
			return { ok: false, statusCode: 400, code: 'INVALID_BODY', message: `Unexpected field "${key}" is not allowed.` };
		}
	}
	return { ok: true, body };
}

function parsePositiveIntField(body: Record<string, unknown>, field: string): number {
	return parseStrictPositiveInt(body[field], field);
}

// Auth: POST /teaching-load/carry-forward/preview (operator JWT only, zero-write).
// Returns the archived-year carry-forward plan bound by a fingerprint.
router.post('/carry-forward/preview', authenticate, requirePrivilegedRole, async (req: Request, res: Response, next: NextFunction) => {
	try {
		const parsed = readStrictBody(req.body, ['schoolId', 'targetSchoolYearId', 'sourceSchoolYearId']);
		if (!parsed.ok) {
			res.status(parsed.statusCode).json({ code: parsed.code, message: parsed.message });
			return;
		}
		let schoolId: number;
		let targetSchoolYearId: number;
		let sourceSchoolYearId: number;
		try {
			schoolId = parsePositiveIntField(parsed.body, 'schoolId');
			targetSchoolYearId = parsePositiveIntField(parsed.body, 'targetSchoolYearId');
			sourceSchoolYearId = parsePositiveIntField(parsed.body, 'sourceSchoolYearId');
		} catch (error: any) {
			res.status(error?.statusCode ?? 400).json({ code: error?.code ?? 'INVALID_PARAM', message: error?.message ?? 'schoolId, targetSchoolYearId, and sourceSchoolYearId must be positive integers.' });
			return;
		}
		res.json(await previewTeachingLoadCarryForward(schoolId, targetSchoolYearId, sourceSchoolYearId, actorSchoolIdOf(req)));
	} catch (error) {
		next(error);
	}
});

// Auth: POST /teaching-load/carry-forward/apply (operator JWT only).
// Implemented but never invoked against live Teaching Load by TL-RR01. Requires
// the exact fingerprint/revisions/confirmation and runs inside one Serializable
// transaction that aborts atomically on any drift.
router.post('/carry-forward/apply', authenticate, requirePrivilegedRole, async (req: Request, res: Response, next: NextFunction) => {
	try {
		// Strict actor user id BEFORE body parsing or any service invocation, so a
		// malformed identity performs zero reads and zero writes.
		const actorUserId = actorUserIdOf(req);
		if (actorUserId == null) {
			res.status(403).json({ code: 'ACTOR_USER_REQUIRED', message: 'A strict positive authenticated actor user id is required to apply carry-forward.' });
			return;
		}
		const parsed = readStrictBody(req.body, [
			'schoolId',
			'targetSchoolYearId',
			'sourceSchoolYearId',
			'expectedFingerprint',
			'expectedSourceRevision',
			'expectedTargetRevision',
			'confirmationText',
		]);
		if (!parsed.ok) {
			res.status(parsed.statusCode).json({ code: parsed.code, message: parsed.message });
			return;
		}
		let schoolId: number;
		let targetSchoolYearId: number;
		let sourceSchoolYearId: number;
		try {
			schoolId = parsePositiveIntField(parsed.body, 'schoolId');
			targetSchoolYearId = parsePositiveIntField(parsed.body, 'targetSchoolYearId');
			sourceSchoolYearId = parsePositiveIntField(parsed.body, 'sourceSchoolYearId');
		} catch (error: any) {
			res.status(error?.statusCode ?? 400).json({ code: error?.code ?? 'INVALID_PARAM', message: error?.message ?? 'schoolId, targetSchoolYearId, and sourceSchoolYearId must be positive integers.' });
			return;
		}
		res.json(await applyTeachingLoadCarryForward({
			actorSchoolId: actorSchoolIdOf(req),
			actorId: actorUserId,
			schoolId,
			targetSchoolYearId,
			sourceSchoolYearId,
			expectedFingerprint: parsed.body.expectedFingerprint,
			expectedSourceRevision: parsed.body.expectedSourceRevision,
			expectedTargetRevision: parsed.body.expectedTargetRevision,
			confirmationText: parsed.body.confirmationText,
		}));
	} catch (error) {
		next(error);
	}
});

export default router;
