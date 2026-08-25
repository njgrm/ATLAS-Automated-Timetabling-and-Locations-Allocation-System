import { Router } from 'express';
import jwt from 'jsonwebtoken';
import { prisma } from '../lib/prisma.js';
import { resolveCanonicalFacultyFromAuthPayload } from '../services/faculty-identity.service.js';
import { getPublishedFacultySchedule, getPublishedFacultyScheduleByExternalId, getPublishedRoomSchedule, getPublishedSchedulePayload, getPublishedSectionSchedule, } from '../services/published-schedule.service.js';
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
        termIndex: parseTermIndexQuery(req.query.termIndex),
    };
}
function parseTermIndexQuery(raw) {
    if (raw == null)
        return undefined;
    const value = String(raw).trim().toLowerCase();
    if (value === 'active')
        return 'active';
    const n = Number(value);
    if (n === 1 || n === 2 || n === 3)
        return n;
    return undefined;
}
async function resolveActiveSchoolYearId(schoolId) {
    const mirror = await prisma.enrollProSchoolYearMirror.findFirst({
        where: { schoolId, isActive: true },
        orderBy: [{ lastSyncedAt: 'desc' }, { updatedAt: 'desc' }],
        select: { enrollProSchoolYearId: true },
    });
    return mirror?.enrollProSchoolYearId ?? null;
}
router.get('/schools/:schoolId/schedules/published', async (req, res, next) => {
    try {
        const schoolId = positiveInt(req.params.schoolId, 'schoolId');
        if (typeof schoolId === 'string') {
            res.status(400).json({ code: 'INVALID_PARAM', message: schoolId });
            return;
        }
        // Resolve the current active school year from the EnrollPro mirror
        const activeMirror = await prisma.enrollProSchoolYearMirror.findFirst({
            where: { schoolId, isActive: true },
            orderBy: [{ lastSyncedAt: 'desc' }, { updatedAt: 'desc' }],
            select: { enrollProSchoolYearId: true },
        });
        if (!activeMirror) {
            res.status(404).json({
                code: 'CURRENT_PUBLISHED_RUN_NOT_FOUND',
                message: 'No active school year is configured. Cannot resolve the current published schedule.',
                actionHint: 'Configure an active school year in EnrollPro settings before AIMS syncs.',
            });
            return;
        }
        const activeSchoolYearId = activeMirror.enrollProSchoolYearId;
        try {
            const payload = await getPublishedSchedulePayload(schoolId, activeSchoolYearId, readScheduleOptions(req));
            res.json(payload);
        }
        catch (serviceError) {
            // Transform PUBLISHED_RUN_NOT_FOUND into a current-year-specific message
            if (serviceError?.code === 'PUBLISHED_RUN_NOT_FOUND') {
                res.status(404).json({
                    code: 'CURRENT_PUBLISHED_RUN_NOT_FOUND',
                    message: `No published schedule is available for the current school year (${activeSchoolYearId}) yet.`,
                    actionHint: 'Build Teaching Load, generate a timetable, and publish the current school-year schedule before AIMS syncs.',
                });
                return;
            }
            throw serviceError;
        }
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
        const activeSchoolYearId = await resolveActiveSchoolYearId(schoolId);
        if (!activeSchoolYearId) {
            res.status(404).json({
                code: 'CURRENT_PUBLISHED_RUN_NOT_FOUND',
                message: 'No active school year is configured. Cannot resolve the current published schedule.',
                actionHint: 'Configure an active school year in EnrollPro settings before AIMS syncs.',
            });
            return;
        }
        try {
            const payload = await getPublishedSectionSchedule(schoolId, sectionId, activeSchoolYearId, readScheduleOptions(req));
            res.json(payload);
        }
        catch (serviceError) {
            if (serviceError?.code === 'PUBLISHED_RUN_NOT_FOUND') {
                res.status(404).json({
                    code: 'CURRENT_PUBLISHED_RUN_NOT_FOUND',
                    message: `No published schedule is available for the current school year (${activeSchoolYearId}) yet.`,
                    actionHint: 'Build Teaching Load, generate a timetable, and publish the current school-year schedule before AIMS syncs.',
                });
                return;
            }
            throw serviceError;
        }
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
        const activeSchoolYearId = await resolveActiveSchoolYearId(schoolId);
        if (!activeSchoolYearId) {
            res.status(404).json({
                code: 'CURRENT_PUBLISHED_RUN_NOT_FOUND',
                message: 'No active school year is configured. Cannot resolve the current published schedule.',
                actionHint: 'Configure an active school year in EnrollPro settings before AIMS syncs.',
            });
            return;
        }
        try {
            const payload = await getPublishedFacultySchedule(schoolId, facultyId, activeSchoolYearId, readScheduleOptions(req));
            res.json(payload);
        }
        catch (serviceError) {
            if (serviceError?.code === 'PUBLISHED_RUN_NOT_FOUND') {
                res.status(404).json({
                    code: 'CURRENT_PUBLISHED_RUN_NOT_FOUND',
                    message: `No published schedule is available for the current school year (${activeSchoolYearId}) yet.`,
                    actionHint: 'Build Teaching Load, generate a timetable, and publish the current school-year schedule before AIMS syncs.',
                });
                return;
            }
            throw serviceError;
        }
    }
    catch (error) {
        next(error);
    }
});
router.get('/schools/:schoolId/schedules/published/faculty-external/:externalFacultyId', async (req, res, next) => {
    try {
        const schoolId = positiveInt(req.params.schoolId, 'schoolId');
        if (typeof schoolId === 'string') {
            res.status(400).json({ code: 'INVALID_PARAM', message: schoolId });
            return;
        }
        const externalFacultyId = positiveInt(req.params.externalFacultyId, 'externalFacultyId');
        if (typeof externalFacultyId === 'string') {
            res.status(400).json({ code: 'INVALID_PARAM', message: externalFacultyId });
            return;
        }
        const activeSchoolYearId = await resolveActiveSchoolYearId(schoolId);
        if (!activeSchoolYearId) {
            res.status(404).json({
                code: 'CURRENT_PUBLISHED_RUN_NOT_FOUND',
                message: 'No active school year is configured. Cannot resolve the current published schedule.',
                actionHint: 'Configure an active school year in EnrollPro settings before AIMS syncs.',
            });
            return;
        }
        try {
            const payload = await getPublishedFacultyScheduleByExternalId(schoolId, externalFacultyId, activeSchoolYearId, readScheduleOptions(req));
            res.json(payload);
        }
        catch (serviceError) {
            if (serviceError?.code === 'FACULTY_NOT_FOUND') {
                res.status(404).json({
                    code: 'FACULTY_NOT_FOUND',
                    message: `No faculty member with external ID ${externalFacultyId} found for school ${schoolId}.`,
                });
                return;
            }
            if (serviceError?.code === 'PUBLISHED_RUN_NOT_FOUND') {
                res.status(404).json({
                    code: 'CURRENT_PUBLISHED_RUN_NOT_FOUND',
                    message: `No published schedule is available for the current school year (${activeSchoolYearId}) yet.`,
                    actionHint: 'Build Teaching Load, generate a timetable, and publish the current school-year schedule before AIMS syncs.',
                });
                return;
            }
            throw serviceError;
        }
    }
    catch (error) {
        next(error);
    }
});
router.get('/schools/:schoolId/school-years/:schoolYearId/schedules/published/faculty-external/:externalFacultyId', async (req, res, next) => {
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
        const externalFacultyId = positiveInt(req.params.externalFacultyId, 'externalFacultyId');
        if (typeof externalFacultyId === 'string') {
            res.status(400).json({ code: 'INVALID_PARAM', message: externalFacultyId });
            return;
        }
        const activeSchoolYearId = await resolveActiveSchoolYearId(schoolId);
        try {
            const payload = await getPublishedFacultyScheduleByExternalId(schoolId, externalFacultyId, schoolYearId, readScheduleOptions(req));
            if (payload && typeof payload === 'object' && 'source' in payload) {
                const source = payload.source;
                source.isActiveSchoolYear = activeSchoolYearId === schoolYearId;
                source.isHistorical = activeSchoolYearId !== schoolYearId;
            }
            res.json(payload);
        }
        catch (serviceError) {
            if (serviceError?.code === 'FACULTY_NOT_FOUND') {
                res.status(404).json({
                    code: 'FACULTY_NOT_FOUND',
                    message: `No faculty member with external ID ${externalFacultyId} found for school ${schoolId}.`,
                });
                return;
            }
            throw serviceError;
        }
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
        const activeSchoolYearId = await resolveActiveSchoolYearId(schoolId);
        if (!activeSchoolYearId) {
            res.status(404).json({
                code: 'CURRENT_PUBLISHED_RUN_NOT_FOUND',
                message: 'No active school year is configured. Cannot resolve the current published schedule.',
                actionHint: 'Configure an active school year in EnrollPro settings before AIMS syncs.',
            });
            return;
        }
        try {
            const payload = await getPublishedRoomSchedule(schoolId, roomId, activeSchoolYearId, readScheduleOptions(req));
            res.json(payload);
        }
        catch (serviceError) {
            if (serviceError?.code === 'PUBLISHED_RUN_NOT_FOUND') {
                res.status(404).json({
                    code: 'CURRENT_PUBLISHED_RUN_NOT_FOUND',
                    message: `No published schedule is available for the current school year (${activeSchoolYearId}) yet.`,
                    actionHint: 'Build Teaching Load, generate a timetable, and publish the current school-year schedule before AIMS syncs.',
                });
                return;
            }
            throw serviceError;
        }
    }
    catch (error) {
        next(error);
    }
});
// ─── Explicit school-year routes ───
// AIMS uses these to request current or historical schedules intentionally.
router.get('/schools/:schoolId/school-years/:schoolYearId/schedules/published', async (req, res, next) => {
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
        const activeSchoolYearId = await resolveActiveSchoolYearId(schoolId);
        const payload = await getPublishedSchedulePayload(schoolId, schoolYearId, readScheduleOptions(req), undefined, activeSchoolYearId);
        res.json(payload);
    }
    catch (error) {
        next(error);
    }
});
router.get('/schools/:schoolId/school-years/:schoolYearId/schedules/published/sections/:sectionId', async (req, res, next) => {
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
        const sectionId = positiveInt(req.params.sectionId, 'sectionId');
        if (typeof sectionId === 'string') {
            res.status(400).json({ code: 'INVALID_PARAM', message: sectionId });
            return;
        }
        const activeSchoolYearId = await resolveActiveSchoolYearId(schoolId);
        const payload = await getPublishedSectionSchedule(schoolId, sectionId, schoolYearId, readScheduleOptions(req));
        // Attach active school year metadata to section payload
        if (payload && typeof payload === 'object' && 'source' in payload) {
            const source = payload.source;
            source.isActiveSchoolYear = activeSchoolYearId === schoolYearId;
            source.isHistorical = activeSchoolYearId !== schoolYearId;
        }
        res.json(payload);
    }
    catch (error) {
        next(error);
    }
});
router.get('/schools/:schoolId/school-years/:schoolYearId/schedules/published/faculty/:facultyId', async (req, res, next) => {
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
        const activeSchoolYearId = await resolveActiveSchoolYearId(schoolId);
        const payload = await getPublishedFacultySchedule(schoolId, facultyId, schoolYearId, readScheduleOptions(req));
        if (payload && typeof payload === 'object' && 'source' in payload) {
            const source = payload.source;
            source.isActiveSchoolYear = activeSchoolYearId === schoolYearId;
            source.isHistorical = activeSchoolYearId !== schoolYearId;
        }
        res.json(payload);
    }
    catch (error) {
        next(error);
    }
});
router.get('/schools/:schoolId/school-years/:schoolYearId/schedules/published/rooms/:roomId', async (req, res, next) => {
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
        const roomId = positiveInt(req.params.roomId, 'roomId');
        if (typeof roomId === 'string') {
            res.status(400).json({ code: 'INVALID_PARAM', message: roomId });
            return;
        }
        const activeSchoolYearId = await resolveActiveSchoolYearId(schoolId);
        const payload = await getPublishedRoomSchedule(schoolId, roomId, schoolYearId, readScheduleOptions(req));
        if (payload && typeof payload === 'object' && 'source' in payload) {
            const source = payload.source;
            source.isActiveSchoolYear = activeSchoolYearId === schoolYearId;
            source.isHistorical = activeSchoolYearId !== schoolYearId;
        }
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