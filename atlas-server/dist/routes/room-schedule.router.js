import { Router } from 'express';
import { authenticate } from '../middleware/authenticate.js';
import { getRoomScheduleView } from '../services/room-schedule.service.js';
const router = Router();
// ─── Helpers ───
const ALLOWED_ROLES = new Set(['admin', 'officer', 'SYSTEM_ADMIN', 'faculty', 'FACULTY', 'teacher', 'TEACHER']);
function positiveInt(raw, name) {
    const n = Number(raw);
    if (!Number.isInteger(n) || n < 1)
        return `${name} must be a positive integer.`;
    return n;
}
// ─── GET /:schoolId/:schoolYearId/rooms/:roomId ───
router.get('/:schoolId/:schoolYearId/rooms/:roomId', authenticate, async (req, res, next) => {
    try {
        const role = req.user?.role;
        if (!role || !ALLOWED_ROLES.has(role)) {
            res.status(403).json({ code: 'FORBIDDEN', message: 'Only authenticated faculty/officer/admin roles can view room schedules.' });
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
        const roomId = positiveInt(req.params.roomId, 'roomId');
        if (typeof roomId === 'string') {
            res.status(400).json({ code: 'INVALID_PARAM', message: roomId });
            return;
        }
        // Parse source query params
        const sourceParam = req.query.source ?? 'latest';
        let source;
        if (sourceParam === 'latest') {
            source = { mode: 'LATEST' };
        }
        else if (sourceParam === 'run') {
            const runId = positiveInt(req.query.runId, 'runId');
            if (typeof runId === 'string') {
                res.status(400).json({ code: 'INVALID_PARAM', message: runId });
                return;
            }
            source = { mode: 'RUN', runId };
        }
        else if (sourceParam === 'draft') {
            source = { mode: 'DRAFT' };
        }
        else {
            res.status(400).json({ code: 'INVALID_PARAM', message: 'source must be "latest", "run", or "draft".' });
            return;
        }
        const view = await getRoomScheduleView(schoolId, schoolYearId, roomId, source);
        res.json(view);
    }
    catch (e) {
        next(e);
    }
});
export default router;
//# sourceMappingURL=room-schedule.router.js.map