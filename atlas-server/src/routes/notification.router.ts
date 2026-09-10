import { Router } from 'express';
import type { NextFunction, Request, Response } from 'express';
import jwt from 'jsonwebtoken';

import { extractSseToken, type AuthPayload } from '../middleware/authenticate.js';
import { hasPrivilegedRole } from '../middleware/authorize.js';
import { resolveCanonicalFacultyFromAuthPayload } from '../services/faculty-identity.service.js';
import {
	getNotificationEventsSince,
	getSchoolNotificationEventsSince,
	subscribeSchoolNotificationEvents,
	subscribeNotificationEvents,
	type NotificationEvent,
} from '../services/notification-events.service.js';
import { attachSseErrorGuard, registerSseCleanup, sseWrite } from '../lib/sse.js';

const router = Router();

function positiveInt(raw: unknown, name: string): number | string {
	const n = Number(raw);
	if (!Number.isInteger(n) || n < 1) return `${name} must be a positive integer.`;
	return n;
}

function resolveSseUser(req: Request): AuthPayload | null {
	if (req.user) return req.user;
	const token = extractSseToken(req);
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

function actorSchoolId(user: AuthPayload): number | null {
	return typeof user.schoolId === 'number' && Number.isInteger(user.schoolId) && user.schoolId > 0
		? user.schoolId
		: null;
}

function prepareSse(res: Response): void {
	res.setHeader('Content-Type', 'text/event-stream');
	res.setHeader('Cache-Control', 'no-cache, no-transform');
	res.setHeader('Connection', 'keep-alive');
	res.setHeader('X-Accel-Buffering', 'no');
	res.flushHeaders();
	attachSseErrorGuard(res);
	sseWrite(res, 'retry: 2000\n\n');
}

function notificationSender(res: Response) {
	return (event: NotificationEvent) => {
		sseWrite(res, `id: ${event.id}\n`);
		sseWrite(res, `event: ${event.type}\n`);
		sseWrite(res, `data: ${JSON.stringify(event)}\n\n`);
	};
}

function requestedLastEventId(req: Request): number {
	const raw = req.header('last-event-id') ?? (typeof req.query.lastEventId === 'string' ? req.query.lastEventId : undefined);
	const parsed = raw ? Number(raw) : 0;
	return Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
}

function registerStreamLifecycle(req: Request, res: Response, unsubscribe: () => void): void {
	const heartbeat = setInterval(() => {
		sseWrite(res, `event: heartbeat\ndata: ${JSON.stringify({ ts: new Date().toISOString() })}\n\n`);
	}, 15000);
	registerSseCleanup(req, res, () => {
		clearInterval(heartbeat);
		unsubscribe();
	});
}

// Privileged school-level integration stream. It intentionally has no school-year
// segment so an officer who still has the old year open receives the event that
// announces the new active year.
router.get('/:schoolId/events', async (req: Request, res: Response, next: NextFunction) => {
	try {
		const sseUser = resolveSseUser(req);
		if (!sseUser) {
			res.status(401).json({ code: 'INVALID_TOKEN', message: 'Valid access token is required for event streaming.' });
			return;
		}
		if (!hasPrivilegedRole(sseUser.role)) {
			res.status(403).json({ code: 'FORBIDDEN', message: 'School-level integration notifications are restricted to scheduler officers and administrators.' });
			return;
		}
		const requestedSchoolId = positiveInt(req.params.schoolId, 'schoolId');
		if (typeof requestedSchoolId === 'string') {
			res.status(400).json({ code: 'INVALID_PARAM', message: requestedSchoolId });
			return;
		}
		const scopedSchoolId = actorSchoolId(sseUser);
		if (scopedSchoolId == null) {
			res.status(403).json({ code: 'SCHOOL_SCOPE_REQUIRED', message: 'Authenticated actor school scope is required.' });
			return;
		}
		if (scopedSchoolId !== requestedSchoolId) {
			res.status(403).json({ code: 'SCHOOL_SCOPE_MISMATCH', message: 'Request school does not match the authenticated actor school.' });
			return;
		}

		req.user = sseUser;
		prepareSse(res);
		const send = notificationSender(res);
		const lastId = requestedLastEventId(req);
		if (lastId > 0) {
			for (const event of getSchoolNotificationEventsSince(lastId, scopedSchoolId)) send(event);
		}
		registerStreamLifecycle(req, res, subscribeSchoolNotificationEvents({ schoolId: scopedSchoolId, send }));
	} catch (error) {
		next(error);
	}
});

router.get('/:schoolId/:schoolYearId/events', async (req: Request, res: Response, next: NextFunction) => {
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
		const scopedSchoolId = actorSchoolId(sseUser);
		if (scopedSchoolId == null) {
			res.status(403).json({ code: 'SCHOOL_SCOPE_REQUIRED', message: 'Authenticated actor school scope is required.' });
			return;
		}
		if (scopedSchoolId !== schoolId) {
			res.status(403).json({ code: 'SCHOOL_SCOPE_MISMATCH', message: 'Request school does not match the authenticated actor school.' });
			return;
		}

		let facultyScope: number | null = null;
		if (!hasPrivilegedRole(req.user.role)) {
			const identity = await resolveCanonicalFacultyFromAuthPayload(req.user, { schoolId, schoolYearId });
			if (!identity) {
				res.status(403).json({
					code: 'FORBIDDEN',
					message: 'Teacher profile mapping is required to subscribe to notifications.',
				});
				return;
			}
			facultyScope = identity.faculty.id;
		}

		prepareSse(res);
		const send = notificationSender(res);
		const lastId = requestedLastEventId(req);
		if (lastId > 0) {
			const missed = getNotificationEventsSince(lastId, { schoolId, schoolYearId, facultyId: facultyScope });
			for (const event of missed) send(event);
		}

		const unsubscribe = subscribeNotificationEvents({ schoolId, schoolYearId, facultyId: facultyScope, send });
		registerStreamLifecycle(req, res, unsubscribe);
	} catch (error) {
		next(error);
	}
});

export default router;
