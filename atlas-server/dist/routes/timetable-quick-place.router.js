import { Router } from 'express';
import { authenticate } from '../middleware/authenticate.js';
import { solveQuickPlace, applyQuickPlace, } from '../services/timetable-quick-place.service.js';
const router = Router();
const PRIVILEGED_ROLES = new Set(['admin', 'officer', 'SYSTEM_ADMIN']);
function positiveInt(raw, name) {
    const n = Number(raw);
    if (!Number.isInteger(n) || n < 1)
        return `${name} must be a positive integer.`;
    return n;
}
function parseScope(params) {
    const schoolId = positiveInt(params.schoolId, 'schoolId');
    if (typeof schoolId === 'string')
        return schoolId;
    const schoolYearId = positiveInt(params.schoolYearId, 'schoolYearId');
    if (typeof schoolYearId === 'string')
        return schoolYearId;
    const runId = positiveInt(params.runId, 'runId');
    if (typeof runId === 'string')
        return runId;
    return { schoolId, schoolYearId, runId };
}
function assertPrivileged(req, res) {
    const role = req.user?.role;
    if (!role || !PRIVILEGED_ROLES.has(role)) {
        res.status(403).json({ code: 'FORBIDDEN', message: 'Only admin, officer, or SYSTEM_ADMIN can trigger quick place auto-allocation.' });
        return false;
    }
    return true;
}
router.post('/:schoolId/:schoolYearId/runs/:runId/quick-place/preview', authenticate, async (req, res, next) => {
    try {
        if (!assertPrivileged(req, res))
            return;
        const scope = parseScope(req.params);
        if (typeof scope === 'string') {
            res.status(400).json({ code: 'INVALID_PARAM', message: scope });
            return;
        }
        const result = await solveQuickPlace(scope.runId, scope.schoolId, scope.schoolYearId);
        res.json(result);
    }
    catch (e) {
        next(e);
    }
});
router.post('/:schoolId/:schoolYearId/runs/:runId/quick-place/apply', authenticate, async (req, res, next) => {
    try {
        if (!assertPrivileged(req, res))
            return;
        const scope = parseScope(req.params);
        if (typeof scope === 'string') {
            res.status(400).json({ code: 'INVALID_PARAM', message: scope });
            return;
        }
        const actorId = req.user?.userId;
        if (!actorId) {
            res.status(401).json({ code: 'NO_USER', message: 'Authenticated user required.' });
            return;
        }
        const expectedVersion = Number(req.body.expectedRunVersion);
        if (Number.isNaN(expectedVersion)) {
            res.status(400).json({ code: 'INVALID_PARAM', message: 'expectedRunVersion is required.' });
            return;
        }
        const result = await applyQuickPlace(scope.runId, scope.schoolId, scope.schoolYearId, actorId, expectedVersion);
        res.json(result);
    }
    catch (e) {
        next(e);
    }
});
export default router;
//# sourceMappingURL=timetable-quick-place.router.js.map