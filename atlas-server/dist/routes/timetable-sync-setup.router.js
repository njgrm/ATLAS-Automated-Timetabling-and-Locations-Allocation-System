import { Router } from 'express';
import { authenticate } from '../middleware/authenticate.js';
import { syncTimetableSetup } from '../services/timetable-sync-setup.service.js';
import { publishNotificationEvent } from '../services/notification-events.service.js';
const router = Router();
const PRIVILEGED_ROLES = new Set(['admin', 'officer', 'SYSTEM_ADMIN']);
function positiveInt(raw, name) {
    const n = Number(raw);
    if (!Number.isInteger(n) || n < 1)
        return `${name} must be a positive integer.`;
    return n;
}
router.post('/:schoolId/:schoolYearId/runs/:runId/sync-setup', authenticate, async (req, res, next) => {
    try {
        const role = req.user?.role;
        if (!role || !PRIVILEGED_ROLES.has(role)) {
            res.status(403).json({ code: 'FORBIDDEN', message: 'Only admin, officer, or SYSTEM_ADMIN can sync timetable setup.' });
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
        const runId = positiveInt(req.params.runId, 'runId');
        if (typeof runId === 'string') {
            res.status(400).json({ code: 'INVALID_PARAM', message: runId });
            return;
        }
        const actorId = req.user?.userId;
        if (!actorId) {
            res.status(401).json({ code: 'NO_USER', message: 'Authenticated user required.' });
            return;
        }
        const result = await syncTimetableSetup(schoolId, schoolYearId, runId, actorId);
        publishNotificationEvent({
            type: 'TIMETABLE_SETUP_SYNC_COMPLETED',
            domain: 'integration',
            severity: 'success',
            audience: 'PRIVILEGED',
            schoolId,
            schoolYearId,
            facultyId: null,
            message: 'Timetable setup was synced into the selected run.',
            metadata: {
                runId,
                actorId,
                result,
            },
        });
        res.status(200).json(result);
    }
    catch (e) {
        if (e.statusCode) {
            res.status(e.statusCode).json({ code: e.code, message: e.message });
        }
        else {
            next(e);
        }
    }
});
export default router;
//# sourceMappingURL=timetable-sync-setup.router.js.map