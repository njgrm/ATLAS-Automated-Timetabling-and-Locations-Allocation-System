import { Router } from 'express';
import { authenticate, authenticateWithSystemToken } from '../middleware/authenticate.js';
import { requirePrivilegedRole } from '../middleware/authorize.js';
import * as sectionService from '../services/section.service.js';
import * as assignmentService from '../services/faculty-assignment.service.js';
import { syncSectionsFromExternal } from '../services/section.service.js';
import { sectionSourceMode, fetchEnrollProActiveSchoolYear } from '../services/section-adapter.js';
import { publishNotificationEvent } from '../services/notification-events.service.js';
import { computeAutoAssign } from '../services/home-room-auto-assign.service.js';
const router = Router();
function parseBooleanQueryFlag(value) {
    if (typeof value === 'boolean')
        return value;
    if (typeof value !== 'string')
        return false;
    const normalized = value.trim().toLowerCase();
    return normalized === 'true' || normalized === '1' || normalized === 'yes';
}
// Auth: GET /sections/summary/:schoolYearId
router.get('/summary/:schoolYearId', authenticate, requirePrivilegedRole, async (req, res, next) => {
    try {
        const schoolYearId = Number(req.params.schoolYearId);
        if (!Number.isInteger(schoolYearId) || schoolYearId <= 0) {
            res.status(400).json({ code: 'INVALID_PARAM', message: 'schoolYearId must be a positive integer.' });
            return;
        }
        const schoolId = Number(req.query.schoolId);
        if (!Number.isInteger(schoolId) || schoolId <= 0) {
            res.status(400).json({ code: 'INVALID_PARAM', message: 'schoolId query parameter is required and must be a positive integer.' });
            return;
        }
        const authToken = req.headers.authorization?.slice(7);
        const summary = await sectionService.getSectionSummary(schoolYearId, schoolId, authToken);
        res.json({ ...summary, sourceMode: sectionSourceMode });
    }
    catch (err) {
        // If the upstream is unreachable, return explicit error (do not silently masquerade)
        if (err?.code === 'UPSTREAM_ERROR' || err?.cause?.code === 'ECONNREFUSED' || err?.message?.includes('fetch failed')) {
            res.status(503).json({
                code: 'UPSTREAM_UNAVAILABLE',
                message: 'Section data source is currently unavailable.',
                sourceMode: sectionSourceMode,
                totalSections: 0,
                byGradeLevel: {},
                sections: [],
            });
            return;
        }
        next(err);
    }
});
// Auth: GET /sections/assigned-classes?schoolId=X&schoolYearId=Y&includeDiagnostics=true
router.get('/assigned-classes', authenticateWithSystemToken, requirePrivilegedRole, async (req, res, next) => {
    try {
        const schoolId = Number(req.query.schoolId);
        const schoolYearId = Number(req.query.schoolYearId);
        if (!Number.isInteger(schoolId) || schoolId <= 0) {
            res.status(400).json({ code: 'INVALID_PARAM', message: 'schoolId query parameter is required and must be a positive integer.' });
            return;
        }
        if (!Number.isInteger(schoolYearId) || schoolYearId <= 0) {
            res.status(400).json({ code: 'INVALID_PARAM', message: 'schoolYearId query parameter is required and must be a positive integer.' });
            return;
        }
        const includeDiagnostics = parseBooleanQueryFlag(req.query.includeDiagnostics);
        const authToken = req.headers.authorization?.slice(7);
        const upstreamAuthToken = req.user?.authSource === 'system' ? undefined : authToken;
        const payload = await assignmentService.getSectionAssignedClassesIndex(schoolId, schoolYearId, upstreamAuthToken, {
            includeDiagnostics,
        });
        res.json(payload);
    }
    catch (err) {
        next(err);
    }
});
// Auth: GET /sections/:sectionId/assigned-classes?schoolYearId=Y&includeDiagnostics=true
router.get('/:sectionId/assigned-classes', authenticateWithSystemToken, requirePrivilegedRole, async (req, res, next) => {
    try {
        const sectionId = Number(req.params.sectionId);
        const schoolYearId = Number(req.query.schoolYearId);
        if (!Number.isInteger(sectionId) || sectionId <= 0) {
            res.status(400).json({ code: 'INVALID_PARAM', message: 'sectionId must be a positive integer.' });
            return;
        }
        if (!Number.isInteger(schoolYearId) || schoolYearId <= 0) {
            res.status(400).json({ code: 'INVALID_PARAM', message: 'schoolYearId query parameter is required and must be a positive integer.' });
            return;
        }
        const includeDiagnostics = parseBooleanQueryFlag(req.query.includeDiagnostics);
        const authToken = req.headers.authorization?.slice(7);
        const upstreamAuthToken = req.user?.authSource === 'system' ? undefined : authToken;
        const payload = await assignmentService.getSectionAssignedClasses(sectionId, schoolYearId, upstreamAuthToken, {
            includeDiagnostics,
        });
        if (!payload) {
            res.status(404).json({ code: 'NOT_FOUND', message: 'Section not found in active school-year scope.' });
            return;
        }
        res.json(payload);
    }
    catch (err) {
        next(err);
    }
});
/**
 * POST /api/v1/sections/sync
 * Manually trigger a reconciliation from EnrollPro sections into ATLAS SectionMirror.
 */
router.post('/sync', authenticateWithSystemToken, requirePrivilegedRole, async (req, res, next) => {
    try {
        const schoolId = Number(req.body.schoolId);
        if (!schoolId) {
            res.status(400).json({ code: 'INVALID_PARAM', message: 'schoolId is required' });
            return;
        }
        const authToken = req.headers.authorization?.slice(7);
        const upstreamAuthToken = req.user?.authSource === 'system' ? undefined : authToken;
        // Resolve schoolYearId: use caller-supplied value if present, otherwise fetch from EnrollPro.
        let schoolYearId;
        if (req.body.schoolYearId !== undefined) {
            schoolYearId = Number(req.body.schoolYearId);
        }
        else {
            const activeYear = await fetchEnrollProActiveSchoolYear(upstreamAuthToken);
            schoolYearId = activeYear?.id ?? 1;
        }
        const [result, activeYear] = await Promise.all([
            syncSectionsFromExternal(schoolId, schoolYearId, upstreamAuthToken),
            fetchEnrollProActiveSchoolYear(upstreamAuthToken),
        ]);
        publishNotificationEvent({
            type: 'SECTION_SYNC_COMPLETED',
            domain: 'integration',
            severity: 'success',
            audience: 'PRIVILEGED',
            schoolId,
            schoolYearId,
            facultyId: null,
            message: 'Sections synced from EnrollPro.',
            metadata: {
                source: result.source,
                count: result.count,
                removed: result.removed,
                fetchedAt: result.fetchedAt,
                enrollProActiveYear: activeYear?.yearLabel ?? null,
            },
        });
        res.json({ ...result, ...(activeYear ? { enrollProActiveYear: activeYear.yearLabel } : {}) });
    }
    catch (err) {
        next(err);
    }
});
// GET /sections/home-rooms/:schoolYearId?schoolId=1
router.get('/home-rooms/:schoolYearId', authenticate, requirePrivilegedRole, async (req, res, next) => {
    try {
        const schoolYearId = Number(req.params.schoolYearId);
        if (!Number.isInteger(schoolYearId) || schoolYearId <= 0) {
            res.status(400).json({ code: 'INVALID_PARAM', message: 'schoolYearId must be a positive integer.' });
            return;
        }
        const schoolId = Number(req.query.schoolId);
        if (!Number.isInteger(schoolId) || schoolId <= 0) {
            res.status(400).json({ code: 'INVALID_PARAM', message: 'schoolId query parameter is required and must be a positive integer.' });
            return;
        }
        const payload = await sectionService.getHomeRoomControlData(schoolYearId, schoolId);
        res.json(payload);
    }
    catch (err) {
        next(err);
    }
});
// PUT /sections/home-rooms/:schoolYearId
router.put('/home-rooms/:schoolYearId', authenticate, requirePrivilegedRole, async (req, res, next) => {
    try {
        const schoolYearId = Number(req.params.schoolYearId);
        if (!Number.isInteger(schoolYearId) || schoolYearId <= 0) {
            res.status(400).json({ code: 'INVALID_PARAM', message: 'schoolYearId must be a positive integer.' });
            return;
        }
        const schoolId = Number(req.body.schoolId);
        if (!Number.isInteger(schoolId) || schoolId <= 0) {
            res.status(400).json({ code: 'INVALID_BODY', message: 'schoolId is required and must be a positive integer.' });
            return;
        }
        const assignmentsRaw = Array.isArray(req.body.assignments) ? req.body.assignments : [];
        const assignments = assignmentsRaw
            .map((entry) => ({
            sectionId: Number(entry?.sectionId),
            homeRoomId: entry?.homeRoomId == null ? null : Number(entry.homeRoomId),
        }))
            .filter((entry) => Number.isInteger(entry.sectionId) && entry.sectionId > 0 && (entry.homeRoomId == null || (Number.isInteger(entry.homeRoomId) && entry.homeRoomId > 0)));
        if (assignments.length === 0) {
            res.status(400).json({ code: 'INVALID_BODY', message: 'assignments must include at least one valid sectionId/homeRoomId pair.' });
            return;
        }
        const result = await sectionService.updateSectionHomeRooms(schoolId, schoolYearId, assignments);
        res.json({ updated: result.updated });
    }
    catch (err) {
        next(err);
    }
});
// POST /sections/home-rooms/:schoolYearId/auto-assign
router.post('/home-rooms/:schoolYearId/auto-assign', authenticate, requirePrivilegedRole, async (req, res, next) => {
    try {
        const schoolYearId = Number(req.params.schoolYearId);
        if (!Number.isInteger(schoolYearId) || schoolYearId <= 0) {
            res.status(400).json({ code: 'INVALID_PARAM', message: 'schoolYearId must be a positive integer.' });
            return;
        }
        const schoolId = Number(req.body?.schoolId);
        if (!Number.isInteger(schoolId) || schoolId <= 0) {
            res.status(400).json({ code: 'INVALID_BODY', message: 'schoolId is required and must be a positive integer.' });
            return;
        }
        const mode = req.body?.mode === 'apply' ? 'apply' : 'preview';
        const overwriteExisting = req.body?.overwriteExisting === true;
        const allowCrossGradeFallback = req.body?.allowCrossGradeFallback === true;
        const result = await computeAutoAssign({
            schoolId,
            schoolYearId,
            mode,
            overwriteExisting,
            allowCrossGradeFallback,
        });
        res.json(result);
    }
    catch (err) {
        next(err);
    }
});
// POST /sections/special-program-placement/overlay
router.post('/special-program-placement/overlay', authenticate, requirePrivilegedRole, async (req, res, next) => {
    try {
        const schoolId = Number(req.body.schoolId);
        if (!Number.isInteger(schoolId) || schoolId <= 0) {
            res.status(400).json({ code: 'INVALID_BODY', message: 'schoolId is required and must be a positive integer.' });
            return;
        }
        let schoolYearId;
        if (req.body.schoolYearId !== undefined) {
            schoolYearId = Number(req.body.schoolYearId);
            if (!Number.isInteger(schoolYearId) || schoolYearId <= 0) {
                res.status(400).json({ code: 'INVALID_BODY', message: 'schoolYearId must be a positive integer when provided.' });
                return;
            }
        }
        else {
            const authToken = req.headers.authorization?.slice(7);
            const activeYear = await fetchEnrollProActiveSchoolYear(authToken);
            schoolYearId = activeYear?.id ?? 1;
        }
        const result = await sectionService.applySpecialProgramPlacementOverlay(schoolId, schoolYearId);
        res.json({
            schoolId,
            schoolYearId,
            ...result,
            contract: 'EnrollPro remains source-of-truth for roster and program membership; ATLAS persists special-program placement overlays when upstream placement is absent.',
        });
    }
    catch (err) {
        next(err);
    }
});
export default router;
//# sourceMappingURL=section.router.js.map