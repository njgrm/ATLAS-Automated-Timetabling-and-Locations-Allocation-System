import { Router } from 'express';
import { authenticate } from '../middleware/authenticate.js';
import { createPublishedScheduleRevision, listPublishedScheduleRevisions, } from '../services/published-revision.service.js';
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
        res.status(403).json({ code: 'FORBIDDEN', message: 'Only admin, officer, or SYSTEM_ADMIN can manage published schedule revisions.' });
        return false;
    }
    return true;
}
router.get('/:schoolId/:schoolYearId/runs/:runId/published-revisions', authenticate, async (req, res, next) => {
    try {
        if (!assertPrivileged(req, res))
            return;
        const scope = parseScope(req.params);
        if (typeof scope === 'string') {
            res.status(400).json({ code: 'INVALID_PARAM', message: scope });
            return;
        }
        const revisions = await listPublishedScheduleRevisions({
            schoolId: scope.schoolId,
            schoolYearId: scope.schoolYearId,
            sourceRunId: scope.runId,
        });
        res.json({ revisions, count: revisions.length });
    }
    catch (e) {
        next(e);
    }
});
router.post('/:schoolId/:schoolYearId/runs/:runId/published-revisions', authenticate, async (req, res, next) => {
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
        const { effectiveDate, reason, sourceRevisionId, changeSummary, metadata } = req.body ?? {};
        const changes = Array.isArray(req.body?.changes)
            ? req.body.changes
            : Array.isArray(req.body?.changeSet)
                ? req.body.changeSet
                : undefined;
        const result = await createPublishedScheduleRevision({
            schoolId: scope.schoolId,
            schoolYearId: scope.schoolYearId,
            sourceRunId: scope.runId,
            sourceRevisionId: sourceRevisionId ?? null,
            actorId,
            effectiveDate,
            reason,
            changes,
            changeSummary: changeSummary ?? null,
            metadata: metadata ?? null,
        });
        res.status(201).json(result);
    }
    catch (e) {
        next(e);
    }
});
export default router;
//# sourceMappingURL=published-revision.router.js.map