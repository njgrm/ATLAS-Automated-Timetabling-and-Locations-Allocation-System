import { Router } from 'express';
import jwt from 'jsonwebtoken';
import { resolveCanonicalFacultyFromAuthPayload } from '../services/faculty-identity.service.js';
import { getPublishedFacultySchedule, getPublishedRoomSchedule, getPublishedSchedulePayload, getPublishedSectionSchedule, } from '../services/published-schedule.service.js';
import { subscribePublishedScheduleEvents, getPublishedScheduleEventsSince, } from '../services/published-schedule-events.service.js';
const router = Router();
function positiveInt(raw, name) {
    const n = Number(raw);
    if (!Number.isInteger(n) || n < 1)
        return `${name} must be a positive integer.`;
    return n;
}
function readTermId(req) {
    if (!('termId' in req.params))
        return undefined;
    if (req.params.termId == null)
        return undefined;
    return positiveInt(req.params.termId, 'termId');
}
function readStringQuery(raw) {
    if (Array.isArray(raw))
        return readStringQuery(raw[0]);
    if (typeof raw !== 'string')
        return undefined;
    const value = raw.trim();
    return value.length > 0 ? value : undefined;
}
function readScheduleOptions(req) {
    return {
        requestedDate: readStringQuery(req.query.date) ?? readStringQuery(req.query.asOfDate),
    };
}
router.get('/schools/:schoolId/schedules/published', async (req, res, next) => {
    try {
        const schoolId = positiveInt(req.params.schoolId, 'schoolId');
        if (typeof schoolId === 'string') {
            res.status(400).json({ code: 'INVALID_PARAM', message: schoolId });
            return;
        }
        const payload = await getPublishedSchedulePayload(schoolId, undefined, readScheduleOptions(req));
        res.json(payload);
    }
    catch (error) {
        next(error);
    }
});
router.get('/schools/:schoolId/schedules/published/sections/:sectionId', async (req, res, next) => {
    try {
        const schoolId = positiveInt(req.params.schoolId, 'schoolId');
        if (typeof schoolId === 'string') {
            res.status(400).json({ code: 'INVALID_PARAM', message: schoolId });
            return;
        }
        const sectionId = positiveInt(req.params.sectionId, 'sectionId');
        if (typeof sectionId === 'string') {
            res.status(400).json({ code: 'INVALID_PARAM', message: sectionId });
            return;
        }
        const payload = await getPublishedSectionSchedule(schoolId, sectionId, undefined, readScheduleOptions(req));
        res.json(payload);
    }
    catch (error) {
        next(error);
    }
});
router.get('/schools/:schoolId/schedules/published/faculty/:facultyId', async (req, res, next) => {
    try {
        const schoolId = positiveInt(req.params.schoolId, 'schoolId');
        if (typeof schoolId === 'string') {
            res.status(400).json({ code: 'INVALID_PARAM', message: schoolId });
            return;
        }
        const facultyId = positiveInt(req.params.facultyId, 'facultyId');
        if (typeof facultyId === 'string') {
            res.status(400).json({ code: 'INVALID_PARAM', message: facultyId });
            return;
        }
        const payload = await getPublishedFacultySchedule(schoolId, facultyId, undefined, readScheduleOptions(req));
        res.json(payload);
    }
    catch (error) {
        next(error);
    }
});
router.get('/schools/:schoolId/schedules/published/rooms/:roomId', async (req, res, next) => {
    try {
        const schoolId = positiveInt(req.params.schoolId, 'schoolId');
        if (typeof schoolId === 'string') {
            res.status(400).json({ code: 'INVALID_PARAM', message: schoolId });
            return;
        }
        const roomId = positiveInt(req.params.roomId, 'roomId');
        if (typeof roomId === 'string') {
            res.status(400).json({ code: 'INVALID_PARAM', message: roomId });
            return;
        }
        const payload = await getPublishedRoomSchedule(schoolId, roomId, undefined, readScheduleOptions(req));
        res.json(payload);
    }
    catch (error) {
        next(error);
    }
});
router.get('/schools/:schoolId/schedules/published/:termId', async (req, res, next) => {
    try {
        const schoolId = positiveInt(req.params.schoolId, 'schoolId');
        if (typeof schoolId === 'string') {
            res.status(400).json({ code: 'INVALID_PARAM', message: schoolId });
            return;
        }
        const termId = readTermId(req);
        if (typeof termId === 'string') {
            res.status(400).json({ code: 'INVALID_PARAM', message: termId });
            return;
        }
        const payload = await getPublishedSchedulePayload(schoolId, termId, readScheduleOptions(req));
        res.json(payload);
    }
    catch (error) {
        next(error);
    }
});
router.get('/schools/:schoolId/schedules/published/:termId/sections/:sectionId', async (req, res, next) => {
    try {
        const schoolId = positiveInt(req.params.schoolId, 'schoolId');
        if (typeof schoolId === 'string') {
            res.status(400).json({ code: 'INVALID_PARAM', message: schoolId });
            return;
        }
        const termId = readTermId(req);
        if (typeof termId === 'string') {
            res.status(400).json({ code: 'INVALID_PARAM', message: termId });
            return;
        }
        const sectionId = positiveInt(req.params.sectionId, 'sectionId');
        if (typeof sectionId === 'string') {
            res.status(400).json({ code: 'INVALID_PARAM', message: sectionId });
            return;
        }
        const payload = await getPublishedSectionSchedule(schoolId, sectionId, termId, readScheduleOptions(req));
        res.json(payload);
    }
    catch (error) {
        next(error);
    }
});
router.get('/schools/:schoolId/schedules/published/:termId/faculty/:facultyId', async (req, res, next) => {
    try {
        const schoolId = positiveInt(req.params.schoolId, 'schoolId');
        if (typeof schoolId === 'string') {
            res.status(400).json({ code: 'INVALID_PARAM', message: schoolId });
            return;
        }
        const termId = readTermId(req);
        if (typeof termId === 'string') {
            res.status(400).json({ code: 'INVALID_PARAM', message: termId });
            return;
        }
        const facultyId = positiveInt(req.params.facultyId, 'facultyId');
        if (typeof facultyId === 'string') {
            res.status(400).json({ code: 'INVALID_PARAM', message: facultyId });
            return;
        }
        const payload = await getPublishedFacultySchedule(schoolId, facultyId, termId, readScheduleOptions(req));
        res.json(payload);
    }
    catch (error) {
        next(error);
    }
});
router.get('/schools/:schoolId/schedules/published/:termId/rooms/:roomId', async (req, res, next) => {
    try {
        const schoolId = positiveInt(req.params.schoolId, 'schoolId');
        if (typeof schoolId === 'string') {
            res.status(400).json({ code: 'INVALID_PARAM', message: schoolId });
            return;
        }
        const termId = readTermId(req);
        if (typeof termId === 'string') {
            res.status(400).json({ code: 'INVALID_PARAM', message: termId });
            return;
        }
        const roomId = positiveInt(req.params.roomId, 'roomId');
        if (typeof roomId === 'string') {
            res.status(400).json({ code: 'INVALID_PARAM', message: roomId });
            return;
        }
        const payload = await getPublishedRoomSchedule(schoolId, roomId, termId, readScheduleOptions(req));
        res.json(payload);
    }
    catch (error) {
        next(error);
    }
});
// ─── SSE: published schedule events ───
// Faculty clients subscribe scoped to their own facultyId to see changes affecting them.
// Officer clients subscribe with facultyId=null to see all updates.
// Accepts accessToken query param for EventSource compatibility.
router.get('/schools/:schoolId/:schoolYearId/schedules/published-events', async (req, res, next) => {
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
        // Auth: accept token from cookie or query param (EventSource compat)
        let token = req.cookies?.atlasAuthToken ?? req.query.accessToken;
        if (!token) {
            const authHeader = req.headers.authorization;
            if (authHeader?.startsWith('Bearer '))
                token = authHeader.slice(7);
        }
        if (!token) {
            res.status(401).json({ code: 'NO_TOKEN', message: 'Authentication required.' });
            return;
        }
        const secret = process.env.JWT_SECRET;
        if (!secret) {
            res.status(500).json({ code: 'SERVER_ERROR', message: 'JWT secret not configured.' });
            return;
        }
        let decoded = null;
        try {
            decoded = jwt.verify(token, secret);
        }
        catch {
            res.status(401).json({ code: 'INVALID_TOKEN', message: 'Invalid or expired token.' });
            return;
        }
        if (!decoded) {
            res.status(401).json({ code: 'INVALID_TOKEN', message: 'Invalid token.' });
            return;
        }
        // Determine scope: teacher users get filtered to their own events.
        const isPrivileged = decoded.role === 'admin' || decoded.role === 'officer' || decoded.role === 'SYSTEM_ADMIN';
        let scopeFacultyId = null;
        if (!isPrivileged) {
            const identity = await resolveCanonicalFacultyFromAuthPayload({ ...decoded, authSource: decoded.authSource ?? 'local' }, { schoolId, schoolYearId });
            if (!identity) {
                res.status(403).json({
                    code: 'FORBIDDEN',
                    message: 'Teacher profile mapping is required to subscribe to schedule updates.',
                });
                return;
            }
            scopeFacultyId = identity.faculty.id;
        }
        // Reconnect: replay missed events since Last-Event-ID
        const lastIdRaw = req.headers['last-event-id'];
        const lastId = lastIdRaw ? parseInt(lastIdRaw, 10) : 0;
        res.setHeader('Content-Type', 'text/event-stream');
        res.setHeader('Cache-Control', 'no-cache');
        res.setHeader('Connection', 'keep-alive');
        res.setHeader('X-Accel-Buffering', 'no');
        res.flushHeaders();
        const send = (event) => {
            res.write(`id: ${event.id}\nevent: published-schedule\ndata: ${JSON.stringify(event)}\n\n`);
        };
        // Replay missed events
        if (lastId > 0) {
            const missed = getPublishedScheduleEventsSince(lastId, { schoolId, schoolYearId, facultyId: scopeFacultyId });
            for (const ev of missed)
                send(ev);
        }
        const unsub = subscribePublishedScheduleEvents({ schoolId, schoolYearId, facultyId: scopeFacultyId, send });
        const heartbeat = setInterval(() => res.write(': heartbeat\n\n'), 15_000);
        req.on('close', () => { unsub(); clearInterval(heartbeat); });
    }
    catch (e) {
        next(e);
    }
});
export default router;
//# sourceMappingURL=published-schedule.router.js.map