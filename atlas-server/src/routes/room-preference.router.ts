import { Router } from 'express';
import type { NextFunction, Request, Response } from 'express';
import type { RoomPreferenceDecisionStatus, RoomPreferenceStatus, RoomRequestAppealStatus } from '@prisma/client';
import jwt from 'jsonwebtoken';
import { authenticate } from '../middleware/authenticate.js';
import type { AuthPayload } from '../middleware/authenticate.js';
import { prisma } from '../lib/prisma.js';
import * as roomPreferenceService from '../services/room-preference.service.js';
import { hasPrivilegedRole } from '../middleware/authorize.js';
import { getRoomPreferenceEventsSince, subscribeRoomPreferenceEvents } from '../services/room-preference-events.service.js';

const router = Router();

const PRIVILEGED_ROLES: Set<string> = new Set(['admin', 'officer', 'SYSTEM_ADMIN']);
const VALID_ROOM_PREFERENCE_STATUSES: Set<string> = new Set(['DRAFT', 'SUBMITTED']);
const VALID_ROOM_PREFERENCE_DECISION_STATUSES: Set<string> = new Set(['PENDING', 'APPROVED', 'REJECTED']);
const VALID_REVIEW_DECISIONS: Set<string> = new Set(['APPROVED', 'REJECTED']);
const VALID_APPEAL_STATUSES: Set<string> = new Set(['OPEN', 'UNDER_REVIEW', 'UPHELD', 'DENIED']);

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

async function resolveRequestingFacultyId(req: Request, schoolId: number): Promise<number | null> {
	const role = req.user?.role;
	if (role && PRIVILEGED_ROLES.has(role)) return null;
	const userId = req.user?.userId;
	if (!userId) return null;
	const faculty = await prisma.facultyMirror.findFirst({
		where: { schoolId, externalId: userId },
		select: { id: true },
	});
	return faculty?.id ?? null;
}

function resolveSseUser(req: Request): AuthPayload | null {
	if (req.user) return req.user;
	const header = req.headers.authorization;
	const queryToken = typeof req.query.accessToken === 'string' ? req.query.accessToken : null;
	const token = header?.startsWith('Bearer ') ? header.slice(7) : queryToken;
	if (!token) return null;
	const secret = process.env.JWT_SECRET;
	if (!secret) return null;
	try {
		const decoded = jwt.verify(token, secret) as AuthPayload;
		return {
			...decoded,
			authSource: decoded.authSource === 'local' ? 'local' : 'bridge',
		};
	} catch {
		return null;
	}
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

async function assertRequestOwnerOrOfficer(
	req: Request,
	res: Response,
	scope: { schoolId: number; schoolYearId: number; runId: number },
	requestId: number,
) {
	const request = await prisma.facultyRoomPreference.findFirst({
		where: {
			id: requestId,
			schoolId: scope.schoolId,
			schoolYearId: scope.schoolYearId,
			runId: scope.runId,
		},
		select: { id: true, facultyId: true },
	});
	if (!request) {
		res.status(404).json({ code: 'ROOM_PREFERENCE_NOT_FOUND', message: 'Room preference request was not found in this run scope.' });
		return null;
	}
	const allowed = await assertFacultyOwnerOrOfficer(req, res, scope.schoolId, request.facultyId);
	if (!allowed) return null;
	return request;
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

router.post(
	'/:schoolId/:schoolYearId/runs/:runId/faculty/:facultyId/sync',
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

			const actions = Array.isArray(req.body?.actions) ? req.body.actions : null;
			if (!actions) {
				res.status(400).json({ code: 'INVALID_BODY', message: 'actions must be an array.' });
				return;
			}

			const result = await roomPreferenceService.processQueuedRoomPreferenceActions({
				schoolId: scope.schoolId,
				schoolYearId: scope.schoolYearId,
				runId: scope.runId,
				facultyId,
				actions,
			});

			res.json(result);
		} catch (error) {
			next(error);
		}
	},
);

router.get(
	'/:schoolId/:schoolYearId/events',
	async (req: Request, res: Response, next: NextFunction) => {
		try {
			const sseUser = resolveSseUser(req);
			if (!sseUser) {
				res.status(401).json({ code: 'INVALID_TOKEN', message: 'Valid access token is required for event streaming.' });
				return;
			}
			req.user = sseUser;

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

			const role = req.user?.role;
			const requestingFacultyId = await resolveRequestingFacultyId(req, schoolId);
			if (!hasPrivilegedRole(role) && requestingFacultyId == null) {
				res.status(403).json({ code: 'FORBIDDEN', message: 'Faculty profile mapping is required to subscribe to room request updates.' });
				return;
			}

			const facultyScope = requestingFacultyId ?? null;
			res.setHeader('Content-Type', 'text/event-stream');
			res.setHeader('Cache-Control', 'no-cache, no-transform');
			res.setHeader('Connection', 'keep-alive');
			res.setHeader('X-Accel-Buffering', 'no');
			res.flushHeaders();

			res.write('retry: 2000\n\n');

			const sendEvent = (event: ReturnType<typeof getRoomPreferenceEventsSince>[number]) => {
				res.write(`id: ${event.id}\n`);
				res.write(`event: ${event.type}\n`);
				res.write(`data: ${JSON.stringify(event)}\n\n`);
			};

			const lastEventIdHeader = req.header('last-event-id');
			const lastEventId = Number(lastEventIdHeader);
			if (Number.isFinite(lastEventId) && lastEventId > 0) {
				const missed = getRoomPreferenceEventsSince(lastEventId, {
					schoolId,
					schoolYearId,
					facultyId: facultyScope,
				});
				for (const event of missed) {
					sendEvent(event);
				}
			}

			const heartbeat = setInterval(() => {
				res.write(`event: heartbeat\ndata: ${JSON.stringify({ ts: new Date().toISOString() })}\n\n`);
			}, 15000);

			const unsubscribe = subscribeRoomPreferenceEvents({
				schoolId,
				schoolYearId,
				facultyId: facultyScope,
				send: sendEvent,
			});

			req.on('close', () => {
				clearInterval(heartbeat);
				unsubscribe();
			});
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
			if (!role) {
				res.status(401).json({ code: 'NO_USER', message: 'Authenticated user required.' });
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
			const requestedFacultyId = req.query.facultyId != null ? positiveInt(req.query.facultyId, 'facultyId') : undefined;
			const ownFacultyId = await resolveRequestingFacultyId(req, schoolId);
			if (!PRIVILEGED_ROLES.has(role) && ownFacultyId == null) {
				res.status(403).json({ code: 'FORBIDDEN', message: 'Faculty profile mapping is required to view room requests.' });
				return;
			}
			const facultyId = ownFacultyId ?? requestedFacultyId;
			if (typeof facultyId === 'string') {
				res.status(400).json({ code: 'INVALID_PARAM', message: facultyId });
				return;
			}
			if (ownFacultyId != null && requestedFacultyId != null && requestedFacultyId !== ownFacultyId) {
				res.status(403).json({ code: 'FORBIDDEN', message: 'Faculty users can only view their own room requests.' });
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
				facultyId: facultyId as number | undefined,
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
			if (!role) {
				res.status(401).json({ code: 'NO_USER', message: 'Authenticated user required.' });
				return;
			}

			const scope = parseScope(req, res);
			if (!scope) return;

			const statusQuery = req.query.status as string | undefined;
			const decisionStatusQuery = req.query.decisionStatus as string | undefined;
			const requestedFacultyId = req.query.facultyId != null ? positiveInt(req.query.facultyId, 'facultyId') : undefined;
			const ownFacultyId = await resolveRequestingFacultyId(req, scope.schoolId);
			if (!PRIVILEGED_ROLES.has(role) && ownFacultyId == null) {
				res.status(403).json({ code: 'FORBIDDEN', message: 'Faculty profile mapping is required to view room requests.' });
				return;
			}
			const facultyId = ownFacultyId ?? requestedFacultyId;
			if (typeof facultyId === 'string') {
				res.status(400).json({ code: 'INVALID_PARAM', message: facultyId });
				return;
			}
			if (ownFacultyId != null && requestedFacultyId != null && requestedFacultyId !== ownFacultyId) {
				res.status(403).json({ code: 'FORBIDDEN', message: 'Faculty users can only view their own room requests.' });
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
				facultyId: facultyId as number | undefined,
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
			const scope = parseScope(req, res);
			if (!scope) return;

			const requestId = positiveInt(req.params.requestId, 'requestId');
			if (typeof requestId === 'string') {
				res.status(400).json({ code: 'INVALID_PARAM', message: requestId });
				return;
			}
			const request = await assertRequestOwnerOrOfficer(req, res, scope, requestId);
			if (!request) return;

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
			const scope = parseScope(req, res);
			if (!scope) return;

			const requestId = positiveInt(req.params.requestId, 'requestId');
			if (typeof requestId === 'string') {
				res.status(400).json({ code: 'INVALID_PARAM', message: requestId });
				return;
			}
			const request = await assertRequestOwnerOrOfficer(req, res, scope, requestId);
			if (!request) return;

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

router.get(
	'/:schoolId/:schoolYearId/runs/:runId/requests/:requestId/appeals',
	authenticate,
	async (req: Request, res: Response, next: NextFunction) => {
		try {
			const scope = parseScope(req, res);
			if (!scope) return;
			const requestId = positiveInt(req.params.requestId, 'requestId');
			if (typeof requestId === 'string') {
				res.status(400).json({ code: 'INVALID_PARAM', message: requestId });
				return;
			}
			const request = await assertRequestOwnerOrOfficer(req, res, scope, requestId);
			if (!request) return;
			const appeals = await roomPreferenceService.listRoomRequestAppeals(scope.schoolId, scope.schoolYearId, scope.runId, requestId);
			res.json({ requestId, appeals });
		} catch (error) {
			next(error);
		}
	},
);

router.post(
	'/:schoolId/:schoolYearId/runs/:runId/requests/:requestId/appeals',
	authenticate,
	async (req: Request, res: Response, next: NextFunction) => {
		try {
			const scope = parseScope(req, res);
			if (!scope) return;
			const requestId = positiveInt(req.params.requestId, 'requestId');
			if (typeof requestId === 'string') {
				res.status(400).json({ code: 'INVALID_PARAM', message: requestId });
				return;
			}
			const request = await assertRequestOwnerOrOfficer(req, res, scope, requestId);
			if (!request) return;
			const reason = typeof req.body?.reason === 'string' ? req.body.reason : '';
			const result = await roomPreferenceService.createRoomRequestAppeal({
				schoolId: scope.schoolId,
				schoolYearId: scope.schoolYearId,
				runId: scope.runId,
				requestId,
				requesterId: request.facultyId,
				reason,
			});
			res.status(201).json(result);
		} catch (error) {
			next(error);
		}
	},
);

router.patch(
	'/:schoolId/:schoolYearId/runs/:runId/requests/:requestId/appeals/:appealId/status',
	authenticate,
	async (req: Request, res: Response, next: NextFunction) => {
		try {
			const role = req.user?.role;
			if (!role || !PRIVILEGED_ROLES.has(role)) {
				res.status(403).json({ code: 'FORBIDDEN', message: 'Only admin, officer, or SYSTEM_ADMIN can update appeal status.' });
				return;
			}
			const actorId = req.user?.userId;
			if (!actorId) {
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
			const appealId = positiveInt(req.params.appealId, 'appealId');
			if (typeof appealId === 'string') {
				res.status(400).json({ code: 'INVALID_PARAM', message: appealId });
				return;
			}
			const status = req.body?.status;
			if (typeof status !== 'string' || !VALID_APPEAL_STATUSES.has(status)) {
				res.status(400).json({ code: 'INVALID_BODY', message: `status must be one of ${[...VALID_APPEAL_STATUSES].join(', ')}.` });
				return;
			}
			const note = typeof req.body?.note === 'string' ? req.body.note : null;
			const result = await roomPreferenceService.updateRoomRequestAppealStatus({
				schoolId: scope.schoolId,
				schoolYearId: scope.schoolYearId,
				runId: scope.runId,
				requestId,
				appealId,
				actorId,
				status: status as RoomRequestAppealStatus,
				note,
			});
			res.json(result);
		} catch (error) {
			next(error);
		}
	},
);

export default router;