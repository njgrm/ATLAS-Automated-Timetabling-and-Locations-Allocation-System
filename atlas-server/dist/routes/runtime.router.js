import { Router } from 'express';
import { authenticateWithSystemToken } from '../middleware/authenticate.js';
import { resolveRuntimeContext } from '../services/runtime-context.service.js';
import { applyRolloverSync, getRolloverStatus, previewRolloverSync, resetDummyYearAndApplyRollover, } from '../services/enrollpro-rollover.service.js';
import { publishNotificationEvent } from '../services/notification-events.service.js';
const router = Router();
const PRIVILEGED_ROLES = new Set(['admin', 'officer', 'SYSTEM_ADMIN']);
function parseSchoolId(raw) {
    const schoolId = Number(raw ?? 1);
    if (!Number.isInteger(schoolId) || schoolId <= 0) {
        return 'schoolId must be a positive integer.';
    }
    return schoolId;
}
function getUpstreamAuthToken(req, enabled = true) {
    if (!enabled)
        return undefined;
    const authToken = req.headers.authorization?.startsWith('Bearer ')
        ? req.headers.authorization.slice(7)
        : undefined;
    return req.user?.authSource === 'bridge' ? authToken : undefined;
}
function isPrivilegedRole(role) {
    return typeof role === 'string' && PRIVILEGED_ROLES.has(role);
}
router.get('/context', authenticateWithSystemToken, async (req, res, next) => {
    try {
        const schoolId = parseSchoolId(req.query.schoolId);
        if (typeof schoolId === 'string') {
            res.status(400).json({ code: 'INVALID_PARAM', message: schoolId });
            return;
        }
        const verifyUpstream = req.query.verifyUpstream === 'true' || req.query.verifyUpstream === '1';
        const upstreamAuthToken = getUpstreamAuthToken(req, verifyUpstream);
        const context = await resolveRuntimeContext(schoolId, upstreamAuthToken, { verifyUpstream });
        if (!context) {
            res.status(404).json({
                code: 'NO_RUNTIME_CONTEXT',
                message: 'No ATLAS runtime context is available yet for this school. Run at least one successful sync first.',
                schoolId,
            });
            return;
        }
        res.json(context);
    }
    catch (err) {
        next(err);
    }
});
router.get('/rollover-status', authenticateWithSystemToken, async (req, res, next) => {
    try {
        const schoolId = parseSchoolId(req.query.schoolId);
        if (typeof schoolId === 'string') {
            res.status(400).json({ code: 'INVALID_PARAM', message: schoolId });
            return;
        }
        const includeCounts = req.query.includeCounts === 'true' || req.query.includeCounts === '1';
        const status = await getRolloverStatus(schoolId, getUpstreamAuthToken(req), { includeCounts });
        res.json(status);
    }
    catch (err) {
        next(err);
    }
});
router.post('/rollover-sync/preview', authenticateWithSystemToken, async (req, res, next) => {
    try {
        const schoolId = parseSchoolId(req.body?.schoolId ?? req.query.schoolId);
        if (typeof schoolId === 'string') {
            res.status(400).json({ code: 'INVALID_PARAM', message: schoolId });
            return;
        }
        const result = await previewRolloverSync(schoolId, getUpstreamAuthToken(req));
        res.json(result);
    }
    catch (err) {
        next(err);
    }
});
router.post('/rollover-sync/apply', authenticateWithSystemToken, async (req, res, next) => {
    try {
        if (!isPrivilegedRole(req.user?.role)) {
            res.status(403).json({ code: 'FORBIDDEN', message: 'Only admin, officer, or SYSTEM_ADMIN can sync a new school year from EnrollPro.' });
            return;
        }
        const schoolId = parseSchoolId(req.body?.schoolId ?? req.query.schoolId);
        if (typeof schoolId === 'string') {
            res.status(400).json({ code: 'INVALID_PARAM', message: schoolId });
            return;
        }
        const result = await applyRolloverSync(schoolId, getUpstreamAuthToken(req));
        const schoolYearId = Number(result.enrollProActiveYear?.id ?? 1);
        publishNotificationEvent({
            type: 'ROLLOVER_SYNC_COMPLETED',
            domain: 'integration',
            severity: 'success',
            audience: 'PRIVILEGED',
            schoolId,
            schoolYearId,
            facultyId: null,
            message: `Active school year synced from EnrollPro${result.enrollProActiveYear?.yearLabel ? `: ${result.enrollProActiveYear.yearLabel}` : ''}.`,
            metadata: {
                enrollProActiveYear: result.enrollProActiveYear,
                facultyCount: result.sync.faculty?.activeCount ?? null,
                sectionCount: result.sync.sections?.count ?? null,
                policyReady: result.sync.policyReady,
            },
        });
        res.json(result);
    }
    catch (err) {
        next(err);
    }
});
router.post('/rollover-sync/reset-dummy-year', authenticateWithSystemToken, async (req, res, next) => {
    try {
        if (!isPrivilegedRole(req.user?.role)) {
            res.status(403).json({ code: 'FORBIDDEN', message: 'Only admin, officer, or SYSTEM_ADMIN can reset dummy school-year data.' });
            return;
        }
        const schoolId = parseSchoolId(req.body?.schoolId ?? req.query.schoolId);
        if (typeof schoolId === 'string') {
            res.status(400).json({ code: 'INVALID_PARAM', message: schoolId });
            return;
        }
        const result = await resetDummyYearAndApplyRollover({
            schoolId,
            actorId: req.user?.userId ?? 0,
            authToken: getUpstreamAuthToken(req),
            confirmReset: req.body?.confirmReset === true,
            confirmationText: typeof req.body?.confirmationText === 'string' ? req.body.confirmationText : undefined,
        });
        const schoolYearId = Number(result.enrollProActiveYear?.id ?? result.rolloverApply?.enrollProActiveYear?.id ?? result.resetTargetSchoolYearId ?? 1);
        publishNotificationEvent({
            type: result.resetApplied ? 'DUMMY_YEAR_RESET_COMPLETED' : 'DUMMY_YEAR_RESET_PREVIEWED',
            domain: 'integration',
            severity: result.resetApplied ? 'warning' : 'info',
            audience: 'PRIVILEGED',
            schoolId,
            schoolYearId,
            facultyId: null,
            message: result.resetApplied
                ? 'Dummy school-year data was reset and EnrollPro rollover sync was applied.'
                : 'Dummy school-year reset preview is ready.',
            metadata: {
                enrollProActiveYear: result.enrollProActiveYear,
                resetTargetSchoolYearId: result.resetTargetSchoolYearId,
                previewOnly: result.previewOnly,
                resetApplied: result.resetApplied,
                conflictingRecordCounts: result.conflictingRecordCounts,
            },
        });
        res.json(result);
    }
    catch (err) {
        next(err);
    }
});
export default router;
//# sourceMappingURL=runtime.router.js.map