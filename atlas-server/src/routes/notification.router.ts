import { Router } from 'express';
import type { NextFunction, Request, Response } from 'express';
import jwt from 'jsonwebtoken';

import { extractSseToken, type AuthPayload } from '../middleware/authenticate.js';
import { hasPrivilegedRole } from '../middleware/authorize.js';
import { resolveCanonicalFacultyFromAuthPayload } from '../services/faculty-identity.service.js';
import {
	getNotificationEventsSince,
	subscribeNotificationEvents,
	type NotificationEvent,
} from '../services/notification-events.service.js';

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

		res.setHeader('Content-Type', 'text/event-stream');
		res.setHeader('Cache-Control', 'no-cache, no-transform');
		res.setHeader('Connection', 'keep-alive');
		res.setHeader('X-Accel-Buffering', 'no');
		res.flushHeaders();
		res.write('retry: 2000\n\n');

		const send = (event: NotificationEvent) => {
			res.write(`id: ${event.id}\n`);
			res.write(`event: ${event.type}\n`);
			res.write(`data: ${JSON.stringify(event)}\n\n`);
		};

		const lastIdRaw = req.header('last-event-id') ?? (typeof req.query.lastEventId === 'string' ? req.query.lastEventId : undefined);
		const lastId = lastIdRaw ? Number(lastIdRaw) : 0;
		if (Number.isFinite(lastId) && lastId > 0) {
			const missed = getNotificationEventsSince(lastId, { schoolId, schoolYearId, facultyId: facultyScope });
			for (const event of missed) send(event);
		}

		const unsubscribe = subscribeNotificationEvents({ schoolId, schoolYearId, facultyId: facultyScope, send });
		const heartbeat = setInterval(() => {
			res.write(`event: heartbeat\ndata: ${JSON.stringify({ ts: new Date().toISOString() })}\n\n`);
		}, 15000);

		req.on('close', () => {
			clearInterval(heartbeat);
			unsubscribe();
		});
	} catch (error) {
		next(error);
	}
});

export default router;
