import { Router } from 'express';
import { getPublishedFacultySchedule, getPublishedRoomSchedule, getPublishedSchedulePayload, getPublishedSectionSchedule, } from '../services/published-schedule.service.js';
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
router.get('/schools/:schoolId/schedules/published', async (req, res, next) => {
    try {
        const schoolId = positiveInt(req.params.schoolId, 'schoolId');
        if (typeof schoolId === 'string') {
            res.status(400).json({ code: 'INVALID_PARAM', message: schoolId });
            return;
        }
        const payload = await getPublishedSchedulePayload(schoolId);
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
        const payload = await getPublishedSectionSchedule(schoolId, sectionId);
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
        const payload = await getPublishedFacultySchedule(schoolId, facultyId);
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
        const payload = await getPublishedRoomSchedule(schoolId, roomId);
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
        const payload = await getPublishedSchedulePayload(schoolId, termId);
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
        const payload = await getPublishedSectionSchedule(schoolId, sectionId, termId);
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
        const payload = await getPublishedFacultySchedule(schoolId, facultyId, termId);
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
        const payload = await getPublishedRoomSchedule(schoolId, roomId, termId);
        res.json(payload);
    }
    catch (error) {
        next(error);
    }
});
export default router;
//# sourceMappingURL=published-schedule.router.js.map