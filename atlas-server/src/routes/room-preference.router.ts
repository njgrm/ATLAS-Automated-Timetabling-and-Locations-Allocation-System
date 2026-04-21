import { Router } from 'express';
import type { NextFunction, Request, Response } from 'express';
import type { RoomPreferenceDecisionStatus, RoomPreferenceStatus } from '@prisma/client';
import { authenticate } from '../middleware/authenticate.js';
import { prisma } from '../lib/prisma.js';
import * as roomPreferenceService from '../services/room-preference.service.js';

const router = Router();

const PRIVILEGED_ROLES: Set<string> = new Set(['admin', 'officer', 'SYSTEM_ADMIN']);
const VALID_ROOM_PREFERENCE_STATUSES: Set<string> = new Set(['DRAFT', 'SUBMITTED']);
const VALID_ROOM_PREFERENCE_DECISION_STATUSES: Set<string> = new Set(['PENDING', 'APPROVED', 'REJECTED']);
const VALID_REVIEW_DECISIONS: Set<string> = new Set(['APPROVED', 'REJECTED']);

function positiveInt(raw: unknown, name: string): number | string {
	const parsed = Number(raw);
	if (!Number.isInteger(parsed) || parsed < 1) return `${name} must be a positive integer.`;
	return parsed;
}

async function assertFacultyOwnerOrOfficer(
	req: Request,
	res: Response,
	schoolId: number,
	facultyId: number,
): Promise<boolean> {
	const role = req.user?.role;
	if (role === 'admin' || role === 'officer' || role === 'SYSTEM_ADMIN') return true;

	const userId = req.user?.userId;
	if (!userId) {
		res.status(401).json({ code: 'NO_USER', message: 'Authenticated user required.' });
		return false;
	}

	const faculty = await prisma.facultyMirror.findFirst({
		where: { id: facultyId, schoolId, externalId: userId },
		select: { id: true },
	});
	if (!faculty) {
		res.status(403).json({ code: 'FORBIDDEN', message: 'You do not have permission to access this faculty room preference.' });
		return false;
	}

	return true;
}

function parseScope(req: Request, res: Response) {
	const schoolId = positiveInt(req.params.schoolId, 'schoolId');
	if (typeof schoolId === 'string') {
		res.status(400).json({ code: 'INVALID_PARAM', message: schoolId });
		return null;
	}
	const schoolYearId = positiveInt(req.params.schoolYearId, 'schoolYearId');
	if (typeof schoolYearId === 'string') {
		res.status(400).json({ code: 'INVALID_PARAM', message: schoolYearId });
		return null;
	}
	const runId = positiveInt(req.params.runId, 'runId');
	if (typeof runId === 'string') {
		res.status(400).json({ code: 'INVALID_PARAM', message: runId });
		return null;
	}
	return { schoolId, schoolYearId, runId };
}

router.get(
	'/:schoolId/:schoolYearId/latest/faculty/:facultyId',
	authenticate,
	async (req: Request, res: Response, next: NextFunction) => {
		try {
			const schoolId = positiveInt(req.params.schoolId, 'schoolId');
			if (typeof schoolId === 'string') {
				res.status(400).json({ code: 'INVALID_PARAM', message: schoolId });
				return;
			}
			const schoolYearId = positiveInt(req.params.schoolYearId, 'schoolYearId');
			if (typeof schoolYearId === 'string') {
				res.status(400).json({ code: 'INVALID_PARAM', message: schoolYearId });
				return;
			}
			const facultyId = positiveInt(req.params.facultyId, 'facultyId');
			if (typeof facultyId === 'string') {
				res.status(400).json({ code: 'INVALID_PARAM', message: facultyId });
				return;
			}

			const allowed = await assertFacultyOwnerOrOfficer(req, res, schoolId, facultyId);
			if (!allowed) return;

			const result = await roomPreferenceService.getLatestFacultyRoomPreferenceState(schoolId, schoolYearId, facultyId);
			res.json(result);
		} catch (error) {
			next(error);
		}
	},
);

router.get(
	'/:schoolId/:schoolYearId/runs/:runId/faculty/:facultyId',
	authenticate,
	async (req: Request, res: Response, next: NextFunction) => {
		try {
			const scope = parseScope(req, res);
			if (!scope) return;

			const facultyId = positiveInt(req.params.facultyId, 'facultyId');
			if (typeof facultyId === 'string') {
				res.status(400).json({ code: 'INVALID_PARAM', message: facultyId });
				return;
			}

			const allowed = await assertFacultyOwnerOrOfficer(req, res, scope.schoolId, facultyId);
			if (!allowed) return;

			const result = await roomPreferenceService.getFacultyRoomPreferenceState(
				scope.schoolId,
				scope.schoolYearId,
				scope.runId,
				facultyId,
			);
			res.json(result);
		} catch (error) {
			next(error);
		}
	},
);

router.put(
	'/:schoolId/:schoolYearId/runs/:runId/faculty/:facultyId/entries/:entryId/draft',
	authenticate,
	async (req: Request, res: Response, next: NextFunction) => {
		try {
			const scope = parseScope(req, res);
			if (!scope) return;

			const facultyId = positiveInt(req.params.facultyId, 'facultyId');
			if (typeof facultyId === 'string') {
				res.status(400).json({ code: 'INVALID_PARAM', message: facultyId });
				return;
			}

			const allowed = await assertFacultyOwnerOrOfficer(req, res, scope.schoolId, facultyId);
			if (!allowed) return;

			const requestedRoomId = positiveInt(req.body.requestedRoomId, 'requestedRoomId');
			if (typeof requestedRoomId === 'string') {
				res.status(400).json({ code: 'INVALID_BODY', message: requestedRoomId });
				return;
			}
			const entryId = typeof req.params.entryId === 'string' ? req.params.entryId : undefined;
			if (!entryId) {
				res.status(400).json({ code: 'INVALID_PARAM', message: 'entryId is required.' });
				return;
			}

			const result = await roomPreferenceService.saveRoomPreferenceDraft({
				schoolId: scope.schoolId,
				schoolYearId: scope.schoolYearId,
				runId: scope.runId,
				facultyId,
				entryId,
				requestedRoomId,
				rationale: req.body.rationale ?? null,
				expectedRunVersion: req.body.expectedRunVersion,
				requestVersion: req.body.requestVersion,
			});

			res.json(result);
		} catch (error) {
			next(error);
		}
	},
);

router.post(
	'/:schoolId/:schoolYearId/runs/:runId/faculty/:facultyId/entries/:entryId/submit',
	authenticate,
	async (req: Request, res: Response, next: NextFunction) => {
		try {
			const scope = parseScope(req, res);
			if (!scope) return;

			const facultyId = positiveInt(req.params.facultyId, 'facultyId');
			if (typeof facultyId === 'string') {
				res.status(400).json({ code: 'INVALID_PARAM', message: facultyId });
				return;
			}

			const allowed = await assertFacultyOwnerOrOfficer(req, res, scope.schoolId, facultyId);
			if (!allowed) return;

			const requestedRoomId = positiveInt(req.body.requestedRoomId, 'requestedRoomId');
			if (typeof requestedRoomId === 'string') {
				res.status(400).json({ code: 'INVALID_BODY', message: requestedRoomId });
				return;
			}
			const entryId = typeof req.params.entryId === 'string' ? req.params.entryId : undefined;
			if (!entryId) {
				res.status(400).json({ code: 'INVALID_PARAM', message: 'entryId is required.' });
				return;
			}

			const result = await roomPreferenceService.submitRoomPreference({
				schoolId: scope.schoolId,
				schoolYearId: scope.schoolYearId,
				runId: scope.runId,
				facultyId,
				entryId,
				requestedRoomId,
				rationale: req.body.rationale ?? null,
				expectedRunVersion: req.body.expectedRunVersion,
				requestVersion: req.body.requestVersion,
			});

			res.json(result);
		} catch (error) {
			next(error);
		}
	},
);

router.delete(
	'/:schoolId/:schoolYearId/runs/:runId/faculty/:facultyId/entries/:entryId',
	authenticate,
	async (req: Request, res: Response, next: NextFunction) => {
		try {
			const scope = parseScope(req, res);
			if (!scope) return;

			const facultyId = positiveInt(req.params.facultyId, 'facultyId');
			if (typeof facultyId === 'string') {
				res.status(400).json({ code: 'INVALID_PARAM', message: facultyId });
				return;
			}

			const allowed = await assertFacultyOwnerOrOfficer(req, res, scope.schoolId, facultyId);
			if (!allowed) return;

			const entryId = typeof req.params.entryId === 'string' ? req.params.entryId : undefined;
			if (!entryId) {
				res.status(400).json({ code: 'INVALID_PARAM', message: 'entryId is required.' });
				return;
			}

			const result = await roomPreferenceService.deleteRoomPreferenceDraft(
				scope.schoolId,
				scope.schoolYearId,
				scope.runId,
				facultyId,
				entryId,
				req.body?.requestVersion,
			);

			res.json(result);
		} catch (error) {
			next(error);
		}
	},
);

router.get(
	'/:schoolId/:schoolYearId/latest/summary',
	authenticate,
	async (req: Request, res: Response, next: NextFunction) => {
		try {
			const role = req.user?.role;
			if (!role || !PRIVILEGED_ROLES.has(role)) {
				res.status(403).json({ code: 'FORBIDDEN', message: 'Only admin, officer, or SYSTEM_ADMIN can view room preference summaries.' });
				return;
			}

			const schoolId = positiveInt(req.params.schoolId, 'schoolId');
			if (typeof schoolId === 'string') {
				res.status(400).json({ code: 'INVALID_PARAM', message: schoolId });
				return;
			}
			const schoolYearId = positiveInt(req.params.schoolYearId, 'schoolYearId');
			if (typeof schoolYearId === 'string') {
				res.status(400).json({ code: 'INVALID_PARAM', message: schoolYearId });
				return;
			}

			const statusQuery = req.query.status as string | undefined;
			const decisionStatusQuery = req.query.decisionStatus as string | undefined;
			const facultyId = req.query.facultyId != null ? positiveInt(req.query.facultyId, 'facultyId') : undefined;
			if (typeof facultyId === 'string') {
				res.status(400).json({ code: 'INVALID_PARAM', message: facultyId });
				return;
			}
			const requestedRoomId = req.query.requestedRoomId != null ? positiveInt(req.query.requestedRoomId, 'requestedRoomId') : undefined;
			if (typeof requestedRoomId === 'string') {
				res.status(400).json({ code: 'INVALID_PARAM', message: requestedRoomId });
				return;
			}

			if (statusQuery && !VALID_ROOM_PREFERENCE_STATUSES.has(statusQuery)) {
				res.status(400).json({ code: 'INVALID_PARAM', message: `status must be one of ${[...VALID_ROOM_PREFERENCE_STATUSES].join(', ')}.` });
				return;
			}
			if (decisionStatusQuery && !VALID_ROOM_PREFERENCE_DECISION_STATUSES.has(decisionStatusQuery)) {
				res.status(400).json({ code: 'INVALID_PARAM', message: `decisionStatus must be one of ${[...VALID_ROOM_PREFERENCE_DECISION_STATUSES].join(', ')}.` });
				return;
			}

			const result = await roomPreferenceService.getLatestRoomPreferenceSummary(schoolId, schoolYearId, {
				status: statusQuery as RoomPreferenceStatus | undefined,
				decisionStatus: decisionStatusQuery as RoomPreferenceDecisionStatus | undefined,
				facultyId,
				requestedRoomId,
			});
			res.json(result);
		} catch (error) {
			next(error);
		}
	},
);

router.get(
	'/:schoolId/:schoolYearId/runs/:runId/summary',
	authenticate,
	async (req: Request, res: Response, next: NextFunction) => {
		try {
			const role = req.user?.role;
			if (!role || !PRIVILEGED_ROLES.has(role)) {
				res.status(403).json({ code: 'FORBIDDEN', message: 'Only admin, officer, or SYSTEM_ADMIN can view room preference summaries.' });
				return;
			}

			const scope = parseScope(req, res);
			if (!scope) return;

			const statusQuery = req.query.status as string | undefined;
			const decisionStatusQuery = req.query.decisionStatus as string | undefined;
			const facultyId = req.query.facultyId != null ? positiveInt(req.query.facultyId, 'facultyId') : undefined;
			if (typeof facultyId === 'string') {
				res.status(400).json({ code: 'INVALID_PARAM', message: facultyId });
				return;
			}
			const requestedRoomId = req.query.requestedRoomId != null ? positiveInt(req.query.requestedRoomId, 'requestedRoomId') : undefined;
			if (typeof requestedRoomId === 'string') {
				res.status(400).json({ code: 'INVALID_PARAM', message: requestedRoomId });
				return;
			}

			if (statusQuery && !VALID_ROOM_PREFERENCE_STATUSES.has(statusQuery)) {
				res.status(400).json({ code: 'INVALID_PARAM', message: `status must be one of ${[...VALID_ROOM_PREFERENCE_STATUSES].join(', ')}.` });
				return;
			}
			if (decisionStatusQuery && !VALID_ROOM_PREFERENCE_DECISION_STATUSES.has(decisionStatusQuery)) {
				res.status(400).json({ code: 'INVALID_PARAM', message: `decisionStatus must be one of ${[...VALID_ROOM_PREFERENCE_DECISION_STATUSES].join(', ')}.` });
				return;
			}

			const result = await roomPreferenceService.getRoomPreferenceSummary(scope.schoolId, scope.schoolYearId, scope.runId, {
				status: statusQuery as RoomPreferenceStatus | undefined,
				decisionStatus: decisionStatusQuery as RoomPreferenceDecisionStatus | undefined,
				facultyId,
				requestedRoomId,
			});
			res.json(result);
		} catch (error) {
			next(error);
		}
	},
);

router.get(
	'/:schoolId/:schoolYearId/runs/:runId/requests/:requestId',
	authenticate,
	async (req: Request, res: Response, next: NextFunction) => {
		try {
			const role = req.user?.role;
			if (!role || !PRIVILEGED_ROLES.has(role)) {
				res.status(403).json({ code: 'FORBIDDEN', message: 'Only admin, officer, or SYSTEM_ADMIN can view room preference details.' });
				return;
			}

			const scope = parseScope(req, res);
			if (!scope) return;

			const requestId = positiveInt(req.params.requestId, 'requestId');
			if (typeof requestId === 'string') {
				res.status(400).json({ code: 'INVALID_PARAM', message: requestId });
				return;
			}

			const result = await roomPreferenceService.getRoomPreferenceDetail(scope.schoolId, scope.schoolYearId, scope.runId, requestId);
			res.json(result);
		} catch (error) {
			next(error);
		}
	},
);

router.post(
	'/:schoolId/:schoolYearId/runs/:runId/requests/:requestId/preview',
	authenticate,
	async (req: Request, res: Response, next: NextFunction) => {
		try {
			const role = req.user?.role;
			if (!role || !PRIVILEGED_ROLES.has(role)) {
				res.status(403).json({ code: 'FORBIDDEN', message: 'Only admin, officer, or SYSTEM_ADMIN can preview room preference decisions.' });
				return;
			}

			const scope = parseScope(req, res);
			if (!scope) return;

			const requestId = positiveInt(req.params.requestId, 'requestId');
			if (typeof requestId === 'string') {
				res.status(400).json({ code: 'INVALID_PARAM', message: requestId });
				return;
			}

			const result = await roomPreferenceService.previewRoomPreferenceDecision(scope.schoolId, scope.schoolYearId, scope.runId, requestId);
			res.json(result);
		} catch (error) {
			next(error);
		}
	},
);

router.patch(
	'/:schoolId/:schoolYearId/runs/:runId/requests/:requestId/review',
	authenticate,
	async (req: Request, res: Response, next: NextFunction) => {
		try {
			const role = req.user?.role;
			if (!role || !PRIVILEGED_ROLES.has(role)) {
				res.status(403).json({ code: 'FORBIDDEN', message: 'Only admin, officer, or SYSTEM_ADMIN can review room preferences.' });
				return;
			}

			const reviewerId = req.user?.userId;
			if (!reviewerId) {
				res.status(401).json({ code: 'NO_USER', message: 'Authenticated user required.' });
				return;
			}

			const scope = parseScope(req, res);
			if (!scope) return;

			const requestId = positiveInt(req.params.requestId, 'requestId');
			if (typeof requestId === 'string') {
				res.status(400).json({ code: 'INVALID_PARAM', message: requestId });
				return;
			}

			const { decisionStatus, reviewerNotes, expectedRunVersion, requestVersion, allowSoftOverride } = req.body ?? {};
			if (!decisionStatus || !VALID_REVIEW_DECISIONS.has(decisionStatus)) {
				res.status(400).json({ code: 'INVALID_BODY', message: `decisionStatus must be one of ${[...VALID_REVIEW_DECISIONS].join(', ')}.` });
				return;
			}

			const result = await roomPreferenceService.reviewRoomPreference({
				schoolId: scope.schoolId,
				schoolYearId: scope.schoolYearId,
				runId: scope.runId,
				requestId,
				reviewerId,
				decisionStatus,
				reviewerNotes: reviewerNotes ?? null,
				expectedRunVersion,
				requestVersion,
				allowSoftOverride: !!allowSoftOverride,
			});

			res.json(result);
		} catch (error) {
			next(error);
		}
	},
);

export default router;