import { Router } from 'express';
import { authenticate } from '../middleware/authenticate.js';
import * as flagService from '../services/follow-up-flag.service.js';
const router = Router();
const PRIVILEGED_ROLES = new Set(['admin', 'officer', 'SYSTEM_ADMIN']);
function positiveInt(raw, name) {
    const n = Number(raw);
    if (!Number.isInteger(n) || n < 1)
        return `${name} must be a positive integer.`;
    return n;
}
/** GET /:schoolId/:schoolYearId/runs/:runId/flags */
router.get('/:schoolId/:schoolYearId/runs/:runId/flags', authenticate, async (req, res, next) => {
    try {
        const schoolId = positiveInt(req.params.schoolId, 'schoolId');
        if (typeof schoolId === 'string') {
            res.status(400).json({ code: 'BAD_PARAM', message: schoolId });
            return;
        }
        const schoolYearId = positiveInt(req.params.schoolYearId, 'schoolYearId');
        if (typeof schoolYearId === 'string') {
            res.status(400).json({ code: 'BAD_PARAM', message: schoolYearId });
            return;
        }
        const runId = positiveInt(req.params.runId, 'runId');
        if (typeof runId === 'string') {
            res.status(400).json({ code: 'BAD_PARAM', message: runId });
            return;
        }
        if (!PRIVILEGED_ROLES.has(req.user?.role ?? '')) {
            res.status(403).json({ code: 'FORBIDDEN', message: 'Insufficient role.' });
            return;
        }
        const flags = await flagService.listByRun(runId, schoolId, schoolYearId);
        res.json({ flags });
    }
    catch (err) {
        next(err);
    }
});
/** PUT /:schoolId/:schoolYearId/runs/:runId/flags/:entryId — toggle */
router.put('/:schoolId/:schoolYearId/runs/:runId/flags/:entryId', authenticate, async (req, res, next) => {
    try {
        const schoolId = positiveInt(req.params.schoolId, 'schoolId');
        if (typeof schoolId === 'string') {
            res.status(400).json({ code: 'BAD_PARAM', message: schoolId });
            return;
        }
        const schoolYearId = positiveInt(req.params.schoolYearId, 'schoolYearId');
        if (typeof schoolYearId === 'string') {
            res.status(400).json({ code: 'BAD_PARAM', message: schoolYearId });
            return;
        }
        const runId = positiveInt(req.params.runId, 'runId');
        if (typeof runId === 'string') {
            res.status(400).json({ code: 'BAD_PARAM', message: runId });
            return;
        }
        const entryId = String(req.params.entryId);
        if (!entryId) {
            res.status(400).json({ code: 'BAD_PARAM', message: 'Invalid entryId.' });
            return;
        }
        if (!PRIVILEGED_ROLES.has(req.user?.role ?? '')) {
            res.status(403).json({ code: 'FORBIDDEN', message: 'Insufficient role.' });
            return;
        }
        const result = await flagService.toggleFlag(runId, entryId, req.user.userId, schoolId, schoolYearId);
        res.json(result);
    }
    catch (err) {
        next(err);
    }
});
/** DELETE /:schoolId/:schoolYearId/runs/:runId/flags/:entryId */
router.delete('/:schoolId/:schoolYearId/runs/:runId/flags/:entryId', authenticate, async (req, res, next) => {
    try {
        const schoolId = positiveInt(req.params.schoolId, 'schoolId');
        if (typeof schoolId === 'string') {
            res.status(400).json({ code: 'BAD_PARAM', message: schoolId });
            return;
        }
        const schoolYearId = positiveInt(req.params.schoolYearId, 'schoolYearId');
        if (typeof schoolYearId === 'string') {
            res.status(400).json({ code: 'BAD_PARAM', message: schoolYearId });
            return;
        }
        const runId = positiveInt(req.params.runId, 'runId');
        if (typeof runId === 'string') {
            res.status(400).json({ code: 'BAD_PARAM', message: runId });
            return;
        }
        const entryId = String(req.params.entryId);
        if (!entryId) {
            res.status(400).json({ code: 'BAD_PARAM', message: 'Invalid entryId.' });
            return;
        }
        if (!PRIVILEGED_ROLES.has(req.user?.role ?? '')) {
            res.status(403).json({ code: 'FORBIDDEN', message: 'Insufficient role.' });
            return;
        }
        await flagService.removeFlag(runId, entryId, schoolId, schoolYearId);
        res.status(204).end();
    }
    catch (err) {
        next(err);
    }
});
export default router;
//# sourceMappingURL=follow-up-flag.router.js.map