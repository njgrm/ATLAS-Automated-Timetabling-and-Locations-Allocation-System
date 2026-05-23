import { Router } from 'express';
import { authenticate, authenticateWithSystemToken } from '../middleware/authenticate.js';
import { requirePrivilegedRole } from '../middleware/authorize.js';
import * as assignmentService from '../services/faculty-assignment.service.js';
import { autoFill } from '../services/teaching-load-automation.service.js';
import { fetchEnrollProActiveSchoolYear } from '../services/section-adapter.js';
const router = Router();
// Auth: GET /faculty-assignments/summary?schoolId=X&schoolYearId=Y
router.get('/summary', authenticateWithSystemToken, requirePrivilegedRole, async (req, res, next) => {
    try {
        const schoolId = Number(req.query.schoolId);
        if (!schoolId || Number.isNaN(schoolId)) {
            res.status(400).json({ code: 'INVALID_PARAM', message: 'schoolId query parameter is required.' });
            return;
        }
        const authToken = req.headers.authorization?.slice(7);
        const upstreamAuthToken = req.user?.authSource === 'system' ? undefined : authToken;
        let schoolYearId;
        if (req.query.schoolYearId !== undefined) {
            schoolYearId = Number(req.query.schoolYearId);
            if (!schoolYearId || Number.isNaN(schoolYearId)) {
                res.status(400).json({ code: 'INVALID_PARAM', message: 'schoolYearId must be a valid number when provided.' });
                return;
            }
        }
        else {
            const activeYear = await fetchEnrollProActiveSchoolYear(upstreamAuthToken);
            if (!activeYear?.id) {
                res.status(400).json({
                    code: 'ACTIVE_SCHOOL_YEAR_UNAVAILABLE',
                    message: 'Unable to resolve active school year from EnrollPro. Provide schoolYearId explicitly.',
                });
                return;
            }
            schoolYearId = activeYear.id;
        }
        const summary = await assignmentService.getAssignmentSummary(schoolId, schoolYearId, upstreamAuthToken);
        const fetchedAt = summary.faculty.length > 0 ? summary.faculty[0].fetchedAt || null : null;
        res.json({
            faculty: summary.faculty,
            ownershipIndex: summary.ownershipIndex,
            coverageTotals: summary.coverageTotals,
            integrityDiagnostics: summary.integrityDiagnostics,
            schoolYearId,
            fetchedAt,
        });
    }
    catch (err) {
        next(err);
    }
});
// Auth: GET /faculty-assignments/coverage/summary?schoolId=X&schoolYearId=Y
router.get('/coverage/summary', authenticateWithSystemToken, requirePrivilegedRole, async (req, res, next) => {
    try {
        const schoolId = Number(req.query.schoolId);
        const schoolYearId = Number(req.query.schoolYearId);
        if (!schoolId || Number.isNaN(schoolId)) {
            res.status(400).json({ code: 'INVALID_PARAM', message: 'schoolId query parameter is required.' });
            return;
        }
        if (!schoolYearId || Number.isNaN(schoolYearId)) {
            res.status(400).json({ code: 'INVALID_PARAM', message: 'schoolYearId query parameter is required.' });
            return;
        }
        const authToken = req.headers.authorization?.slice(7);
        const upstreamAuthToken = req.user?.authSource === 'system' ? undefined : authToken;
        const coverage = await assignmentService.getActiveSubjectCoverageSummary(schoolId, schoolYearId, upstreamAuthToken);
        res.json(coverage);
    }
    catch (err) {
        next(err);
    }
});
// Auth: POST /faculty-assignments/coverage/repair
// Body: { schoolId: number, schoolYearId: number, apply?: boolean, subjectCodes?: string[] }
router.post('/coverage/repair', authenticateWithSystemToken, requirePrivilegedRole, async (req, res, next) => {
    try {
        const schoolId = Number(req.body.schoolId);
        const schoolYearId = Number(req.body.schoolYearId);
        if (!schoolId || Number.isNaN(schoolId)) {
            res.status(400).json({ code: 'INVALID_PARAM', message: 'schoolId is required.' });
            return;
        }
        if (!schoolYearId || Number.isNaN(schoolYearId)) {
            res.status(400).json({ code: 'INVALID_PARAM', message: 'schoolYearId is required.' });
            return;
        }
        const subjectCodes = Array.isArray(req.body.subjectCodes)
            ? req.body.subjectCodes.filter((value) => typeof value === 'string')
            : undefined;
        const apply = req.body.apply === true;
        const authToken = req.headers.authorization?.slice(7);
        const upstreamAuthToken = req.user?.authSource === 'system' ? undefined : authToken;
        const result = await assignmentService.repairActiveSubjectCoverageWithPlaceholders({
            schoolId,
            schoolYearId,
            assignedBy: req.user?.userId ?? 0,
            authToken: upstreamAuthToken,
            subjectCodes,
            apply,
        });
        res.json(result);
    }
    catch (err) {
        next(err);
    }
});
// Auth: POST /faculty-assignments/coverage/rebalance-special-programs
// Body: { schoolId: number, schoolYearId: number, apply?: boolean, subjectCodes?: string[] }
router.post('/coverage/rebalance-special-programs', authenticateWithSystemToken, requirePrivilegedRole, async (req, res, next) => {
    try {
        const schoolId = Number(req.body.schoolId);
        const schoolYearId = Number(req.body.schoolYearId);
        if (!schoolId || Number.isNaN(schoolId)) {
            res.status(400).json({ code: 'INVALID_PARAM', message: 'schoolId is required.' });
            return;
        }
        if (!schoolYearId || Number.isNaN(schoolYearId)) {
            res.status(400).json({ code: 'INVALID_PARAM', message: 'schoolYearId is required.' });
            return;
        }
        const subjectCodes = Array.isArray(req.body.subjectCodes)
            ? req.body.subjectCodes.filter((value) => typeof value === 'string')
            : undefined;
        const apply = req.body.apply === true;
        const authToken = req.headers.authorization?.slice(7);
        const upstreamAuthToken = req.user?.authSource === 'system' ? undefined : authToken;
        const result = await assignmentService.previewOrApplySpecialProgramRedistribution({
            schoolId,
            schoolYearId,
            actorId: req.user?.userId ?? 0,
            authToken: upstreamAuthToken,
            subjectCodes,
            apply,
        });
        res.json(result);
    }
    catch (err) {
        next(err);
    }
});
// Auth: POST /faculty-assignments/coverage/recover-real-faculty
// Body: { schoolId: number, schoolYearId: number, apply?: boolean, subjectCodes?: string[] }
router.post('/coverage/recover-real-faculty', authenticateWithSystemToken, requirePrivilegedRole, async (req, res, next) => {
    try {
        const schoolId = Number(req.body.schoolId);
        const schoolYearId = Number(req.body.schoolYearId);
        if (!schoolId || Number.isNaN(schoolId)) {
            res.status(400).json({ code: 'INVALID_PARAM', message: 'schoolId is required.' });
            return;
        }
        if (!schoolYearId || Number.isNaN(schoolYearId)) {
            res.status(400).json({ code: 'INVALID_PARAM', message: 'schoolYearId is required.' });
            return;
        }
        const subjectCodes = Array.isArray(req.body.subjectCodes)
            ? req.body.subjectCodes.filter((value) => typeof value === 'string')
            : undefined;
        const apply = req.body.apply === true;
        const authToken = req.headers.authorization?.slice(7);
        const upstreamAuthToken = req.user?.authSource === 'system' ? undefined : authToken;
        const result = await assignmentService.previewOrApplyRealFacultyRecovery({
            schoolId,
            schoolYearId,
            actorId: req.user?.userId ?? 0,
            authToken: upstreamAuthToken,
            subjectCodes,
            apply,
        });
        res.json(result);
    }
    catch (err) {
        next(err);
    }
});
// Auth: POST /faculty-assignments/reset
// Body: { schoolId: number, schoolYearId: number, previewOnly?: boolean, confirmReset?: boolean, subjectId?: number }
router.post('/reset', authenticate, requirePrivilegedRole, async (req, res, next) => {
    try {
        const schoolId = Number(req.body.schoolId);
        const schoolYearId = Number(req.body.schoolYearId);
        const previewOnly = req.body.previewOnly !== false;
        const confirmReset = req.body.confirmReset === true;
        const subjectId = req.body.subjectId !== undefined ? Number(req.body.subjectId) : undefined;
        if (!schoolId || Number.isNaN(schoolId)) {
            res.status(400).json({ code: 'INVALID_PARAM', message: 'schoolId is required.' });
            return;
        }
        if (!schoolYearId || Number.isNaN(schoolYearId)) {
            res.status(400).json({ code: 'INVALID_PARAM', message: 'schoolYearId is required.' });
            return;
        }
        if (subjectId !== undefined && (!subjectId || Number.isNaN(subjectId))) {
            res.status(400).json({ code: 'INVALID_PARAM', message: 'subjectId must be a valid number when provided.' });
            return;
        }
        if (!previewOnly && !confirmReset) {
            res.status(400).json({
                code: 'CONFIRMATION_REQUIRED',
                message: 'confirmReset=true is required to apply teaching-load reset.',
            });
            return;
        }
        const authToken = req.headers.authorization?.slice(7);
        const result = await assignmentService.previewOrApplyTeachingLoadReset({
            schoolId,
            schoolYearId,
            actorId: req.user?.userId ?? 0,
            authToken,
            subjectId,
            previewOnly,
        });
        res.json(result);
    }
    catch (err) {
        next(err);
    }
});
// Auth: POST /faculty-assignments/integrity/reconcile
// Body: { schoolId: number, schoolYearId: number, previewOnly?: boolean, confirmApply?: boolean }
router.post('/integrity/reconcile', authenticate, requirePrivilegedRole, async (req, res, next) => {
    try {
        const schoolId = Number(req.body.schoolId);
        const schoolYearId = Number(req.body.schoolYearId);
        const previewOnly = req.body.previewOnly !== false;
        const confirmApply = req.body.confirmApply === true;
        if (!schoolId || Number.isNaN(schoolId)) {
            res.status(400).json({ code: 'INVALID_PARAM', message: 'schoolId is required.' });
            return;
        }
        if (!schoolYearId || Number.isNaN(schoolYearId)) {
            res.status(400).json({ code: 'INVALID_PARAM', message: 'schoolYearId is required.' });
            return;
        }
        if (!previewOnly && !confirmApply) {
            res.status(400).json({
                code: 'CONFIRMATION_REQUIRED',
                message: 'confirmApply=true is required to apply integrity reconciliation.',
            });
            return;
        }
        const authToken = req.headers.authorization?.slice(7);
        const result = await assignmentService.previewOrApplyTeachingLoadTruthReconcile({
            schoolId,
            schoolYearId,
            actorId: req.user?.userId ?? 0,
            authToken,
            previewOnly,
        });
        res.json(result);
    }
    catch (err) {
        next(err);
    }
});
// Auth: GET /faculty-assignments/:facultyId?schoolYearId=Y
router.get('/:facultyId', authenticate, requirePrivilegedRole, async (req, res, next) => {
    try {
        const facultyId = Number(req.params.facultyId);
        if (Number.isNaN(facultyId)) {
            res.status(400).json({ code: 'INVALID_PARAM', message: 'facultyId must be a number.' });
            return;
        }
        const schoolYearId = Number(req.query.schoolYearId);
        if (!schoolYearId || Number.isNaN(schoolYearId)) {
            res.status(400).json({ code: 'INVALID_PARAM', message: 'schoolYearId query parameter is required.' });
            return;
        }
        const authToken = req.headers.authorization?.slice(7);
        const assignments = await assignmentService.getAssignmentsByFaculty(facultyId, schoolYearId, authToken);
        if (!assignments) {
            res.status(404).json({ code: 'NOT_FOUND', message: 'Faculty not found.' });
            return;
        }
        res.json(assignments);
    }
    catch (err) {
        next(err);
    }
});
// Auth: PUT /faculty-assignments/:facultyId — replace all assignments for a faculty member
router.put('/:facultyId', authenticate, requirePrivilegedRole, async (req, res, next) => {
    try {
        const facultyId = Number(req.params.facultyId);
        if (Number.isNaN(facultyId)) {
            res.status(400).json({ code: 'INVALID_PARAM', message: 'facultyId must be a number.' });
            return;
        }
        const { schoolId, schoolYearId, version, assignments } = req.body;
        if (!schoolId || !schoolYearId || version === undefined || !Array.isArray(assignments)) {
            res.status(400).json({ code: 'MISSING_FIELDS', message: 'schoolId, schoolYearId, version, and assignments array are required.' });
            return;
        }
        const assignedBy = req.user.userId;
        const authToken = req.headers.authorization?.slice(7);
        const result = await assignmentService.setAssignments(facultyId, Number(schoolId), Number(schoolYearId), assignedBy, Number(version), assignments, authToken);
        if (!result.success) {
            const status = result.code === 'FACULTY_NOT_FOUND'
                ? 404
                : result.code === 'VERSION_CONFLICT' || result.code === 'DUPLICATE_SECTION_OWNERSHIP'
                    ? 409
                    : 400;
            res.status(status).json({ code: result.code, message: result.error, details: result.details });
            return;
        }
        const updated = await assignmentService.getAssignmentsByFaculty(facultyId, Number(schoolYearId), authToken);
        res.json({ version: result.version, assignments: updated?.assignments ?? [] });
    }
    catch (err) {
        next(err);
    }
});
// POST /faculty-assignments/auto-fill
// Triggers the state-preserving auto-fill algorithm for unassigned subject×section pairs.
// Body: { schoolId: number, schoolYearId: number, previewOnly?: boolean }
router.post('/auto-fill', authenticate, requirePrivilegedRole, async (req, res, next) => {
    try {
        const schoolId = Number(req.body.schoolId);
        const schoolYearId = Number(req.body.schoolYearId);
        const previewOnly = req.body.previewOnly === true || req.body.previewOnly === 'true';
        if (!schoolId || Number.isNaN(schoolId)) {
            res.status(400).json({ code: 'INVALID_PARAM', message: 'schoolId is required.' });
            return;
        }
        if (!schoolYearId || Number.isNaN(schoolYearId)) {
            res.status(400).json({ code: 'INVALID_PARAM', message: 'schoolYearId is required.' });
            return;
        }
        const authToken = req.headers.authorization?.slice(7);
        const result = await autoFill(schoolId, schoolYearId, authToken, { previewOnly });
        res.json(result);
    }
    catch (err) {
        next(err);
    }
});
// POST /faculty-assignments/report/staffing-needs
// Returns staffing shortage report based on current uncovered live pairs.
// Body: { schoolId: number, schoolYearId: number }
router.post('/report/staffing-needs', authenticate, requirePrivilegedRole, async (req, res, next) => {
    try {
        const schoolId = Number(req.body.schoolId);
        const schoolYearId = Number(req.body.schoolYearId);
        if (!schoolId || Number.isNaN(schoolId)) {
            res.status(400).json({ code: 'INVALID_PARAM', message: 'schoolId is required.' });
            return;
        }
        if (!schoolYearId || Number.isNaN(schoolYearId)) {
            res.status(400).json({ code: 'INVALID_PARAM', message: 'schoolYearId is required.' });
            return;
        }
        const authToken = req.headers.authorization?.slice(7);
        const result = await autoFill(schoolId, schoolYearId, authToken, { previewOnly: true, staffingOnly: true });
        res.json(result);
    }
    catch (err) {
        next(err);
    }
});
export default router;
//# sourceMappingURL=faculty-assignment.router.js.map