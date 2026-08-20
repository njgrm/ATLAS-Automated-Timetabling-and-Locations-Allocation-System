import { Router } from 'express';
import { authenticate } from '../middleware/authenticate.js';
import * as eventService from '../services/policy-special-event.service.js';
const router = Router();
const PRIVILEGED_ROLES = new Set(['admin', 'officer', 'SYSTEM_ADMIN']);
function positiveInt(raw, name) {
    const n = Number(raw);
    if (!Number.isInteger(n) || n < 1)
        return `${name} must be a positive integer.`;
    return n;
}
// ─── GET /:schoolId/:schoolYearId — list special events ───
router.get('/:schoolId/:schoolYearId', authenticate, async (req, res, next) => {
    try {
        const role = req.user?.role;
        if (!role || !PRIVILEGED_ROLES.has(role)) {
            res.status(403).json({ code: 'FORBIDDEN', message: 'Only admin, officer, or SYSTEM_ADMIN can view special events.' });
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
        const events = await eventService.listSpecialEvents(schoolId, schoolYearId);
        res.json({ events });
    }
    catch (e) {
        next(e);
    }
});
// ─── PUT /:schoolId/:schoolYearId — batch upsert special events ───
router.put('/:schoolId/:schoolYearId', authenticate, async (req, res, next) => {
    try {
        const role = req.user?.role;
        if (!role || !PRIVILEGED_ROLES.has(role)) {
            res.status(403).json({ code: 'FORBIDDEN', message: 'Only admin, officer, or SYSTEM_ADMIN can update special events.' });
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
        const { events } = req.body;
        if (!Array.isArray(events)) {
            res.status(400).json({ code: 'INVALID_BODY', message: 'Body must contain an "events" array.' });
            return;
        }
        const results = await eventService.upsertSpecialEvents(schoolId, schoolYearId, events);
        res.json({ events: results });
    }
    catch (e) {
        next(e);
    }
});
// ─── DELETE /:schoolId/:schoolYearId/:eventId — delete a single event ───
router.delete('/:schoolId/:schoolYearId/:eventId', authenticate, async (req, res, next) => {
    try {
        const role = req.user?.role;
        if (!role || !PRIVILEGED_ROLES.has(role)) {
            res.status(403).json({ code: 'FORBIDDEN', message: 'Only admin, officer, or SYSTEM_ADMIN can delete special events.' });
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
        const eventId = positiveInt(req.params.eventId, 'eventId');
        if (typeof eventId === 'string') {
            res.status(400).json({ code: 'INVALID_PARAM', message: eventId });
            return;
        }
        await eventService.deleteSpecialEvent(schoolId, schoolYearId, eventId);
        res.json({ ok: true });
    }
    catch (e) {
        next(e);
    }
});
// ─── POST /:schoolId/:schoolYearId/seed-baseline — seed default shift events ───
router.post('/:schoolId/:schoolYearId/seed-baseline', authenticate, async (req, res, next) => {
    try {
        const role = req.user?.role;
        if (!role || !PRIVILEGED_ROLES.has(role)) {
            res.status(403).json({ code: 'FORBIDDEN', message: 'Only admin, officer, or SYSTEM_ADMIN can seed baseline events.' });
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
        const events = await eventService.seedShiftBaseline(schoolId, schoolYearId);
        res.json({ events });
    }
    catch (e) {
        next(e);
    }
});
export default router;
//# sourceMappingURL=policy-special-event.router.js.map