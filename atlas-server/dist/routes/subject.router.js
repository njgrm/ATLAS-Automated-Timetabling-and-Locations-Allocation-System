import { Router } from 'express';
import { authenticate } from '../middleware/authenticate.js';
import { requirePrivilegedRole } from '../middleware/authorize.js';
import * as subjectService from '../services/subject.service.js';
const router = Router();
// Public: GET /subjects?schoolId=X
router.get('/', async (req, res, next) => {
    try {
        const schoolId = Number(req.query.schoolId);
        if (!schoolId || Number.isNaN(schoolId)) {
            res.status(400).json({ code: 'INVALID_PARAM', message: 'schoolId query parameter is required.' });
            return;
        }
        const includeSte = req.query.includeSte !== 'false';
        const includeSpa = req.query.includeSpa !== 'false';
        const subjects = await subjectService.getSubjectsBySchool(schoolId, { includeSte, includeSpa });
        res.json({ subjects });
    }
    catch (err) {
        next(err);
    }
});
// Public: GET /subjects/:id
router.get('/:id', async (req, res, next) => {
    try {
        const id = Number(req.params.id);
        if (Number.isNaN(id)) {
            res.status(400).json({ code: 'INVALID_PARAM', message: 'id must be a number.' });
            return;
        }
        const subject = await subjectService.getSubjectById(id);
        if (!subject) {
            res.status(404).json({ code: 'NOT_FOUND', message: 'Subject not found.' });
            return;
        }
        res.json({ subject });
    }
    catch (err) {
        next(err);
    }
});
// Auth: POST /subjects — create a custom subject
router.post('/', authenticate, requirePrivilegedRole, async (req, res, next) => {
    try {
        const { schoolId, code, name, minMinutesPerWeek, preferredRoomType, gradeLevels, sessionPattern, isSeedable, interSectionEnabled, interSectionGradeLevels, modularGroupId, modularOrder, termGroupId, termCount, programScopes, allowedSpecializations, requiredFeatures, isActive, ownerDepartment, qualificationPriority, rotationFamily, outputLabel, isSystemManaged, } = req.body;
        if (!schoolId || !code || !name || !minMinutesPerWeek || !preferredRoomType || !gradeLevels) {
            res.status(400).json({ code: 'MISSING_FIELDS', message: 'schoolId, code, name, minMinutesPerWeek, preferredRoomType, gradeLevels are required.' });
            return;
        }
        const subject = await subjectService.createSubject(Number(schoolId), {
            code,
            name,
            minMinutesPerWeek: Number(minMinutesPerWeek),
            preferredRoomType,
            sessionPattern,
            gradeLevels,
            isSeedable,
            interSectionEnabled,
            interSectionGradeLevels,
            modularGroupId,
            modularOrder,
            termGroupId,
            termCount,
            programScopes,
            allowedSpecializations,
            requiredFeatures,
            isActive,
            ownerDepartment,
            qualificationPriority,
            rotationFamily,
            outputLabel,
            isSystemManaged,
        });
        res.status(201).json({ subject });
    }
    catch (err) {
        if (err?.code === 'P2002') {
            res.status(409).json({ code: 'DUPLICATE', message: 'A subject with this code already exists for this school.' });
            return;
        }
        next(err);
    }
});
// Auth: PATCH /subjects/:id
router.patch('/:id', authenticate, requirePrivilegedRole, async (req, res, next) => {
    try {
        const id = Number(req.params.id);
        if (Number.isNaN(id)) {
            res.status(400).json({ code: 'INVALID_PARAM', message: 'id must be a number.' });
            return;
        }
        const subject = await subjectService.updateSubject(id, req.body);
        if (!subject) {
            res.status(404).json({ code: 'NOT_FOUND', message: 'Subject not found.' });
            return;
        }
        res.json({ subject });
    }
    catch (err) {
        next(err);
    }
});
// Auth: DELETE /subjects/:id
router.delete('/:id', authenticate, requirePrivilegedRole, async (req, res, next) => {
    try {
        const id = Number(req.params.id);
        if (Number.isNaN(id)) {
            res.status(400).json({ code: 'INVALID_PARAM', message: 'id must be a number.' });
            return;
        }
        const cleanupHistorical = req.query.cleanupHistorical === 'true';
        const cleanupActive = req.query.cleanupActive === 'true';
        const cleanupAll = req.query.cleanupAll === 'true';
        const result = await subjectService.deleteSubject(id, { cleanupHistorical, cleanupActive, cleanupAll });
        if (!result.success) {
            const status = result.code === 'NOT_FOUND'
                ? 404
                : (result.code === 'ACTIVE_ASSIGNMENTS' || result.code === 'HISTORICAL_ASSIGNMENTS' ? 409 : 400);
            res.status(status).json({
                code: 'DELETE_BLOCKED',
                message: result.error,
                reason: result.code,
                details: result.details,
            });
            return;
        }
        res.status(200).json({
            deletedSubjectId: result.deletedSubjectId,
            cleanedHistoricalAssignments: result.cleanedHistoricalAssignments,
        });
    }
    catch (err) {
        next(err);
    }
});
// Auth: POST /subjects/:id/archive — explicit archive action for safe cleanup workflows
router.post('/:id/archive', authenticate, requirePrivilegedRole, async (req, res, next) => {
    try {
        const id = Number(req.params.id);
        if (Number.isNaN(id)) {
            res.status(400).json({ code: 'INVALID_PARAM', message: 'id must be a number.' });
            return;
        }
        const subject = await subjectService.updateSubject(id, { isActive: false });
        if (!subject) {
            res.status(404).json({ code: 'NOT_FOUND', message: 'Subject not found.' });
            return;
        }
        res.json({ subject, archived: true });
    }
    catch (err) {
        next(err);
    }
});
// Auth: POST /subjects/seed — seed defaults for a school
router.post('/seed', authenticate, requirePrivilegedRole, async (req, res, next) => {
    try {
        const schoolId = Number(req.body.schoolId);
        if (!schoolId || Number.isNaN(schoolId)) {
            res.status(400).json({ code: 'INVALID_PARAM', message: 'schoolId is required.' });
            return;
        }
        await subjectService.ensureDefaultSubjects(schoolId);
        const subjects = await subjectService.getSubjectsBySchool(schoolId);
        res.json({ subjects });
    }
    catch (err) {
        next(err);
    }
});
// Auth: POST /subjects/sync-offerings — refresh special-program subject state from upstream offerings + mirrored demand
router.post('/sync-offerings', authenticate, requirePrivilegedRole, async (req, res, next) => {
    try {
        const schoolId = Number(req.body.schoolId);
        const schoolYearId = Number(req.body.schoolYearId);
        if (!schoolId || Number.isNaN(schoolId) || !schoolYearId || Number.isNaN(schoolYearId)) {
            res.status(400).json({ code: 'INVALID_PARAM', message: 'schoolId and schoolYearId are required.' });
            return;
        }
        const authToken = req.headers.authorization?.slice(7);
        const report = await subjectService.syncSubjectContractFromProgramOfferings(schoolId, schoolYearId, authToken);
        res.json({ report });
    }
    catch (err) {
        next(err);
    }
});
// Auth: GET /subjects/stats — get counts for dashboard
router.get('/stats/:schoolId', authenticate, requirePrivilegedRole, async (req, res, next) => {
    try {
        const schoolId = Number(req.params.schoolId);
        if (Number.isNaN(schoolId)) {
            res.status(400).json({ code: 'INVALID_PARAM', message: 'schoolId must be a number.' });
            return;
        }
        const [count, unassigned] = await Promise.all([
            subjectService.getSubjectCountBySchool(schoolId),
            subjectService.getSubjectsWithoutFaculty(schoolId),
        ]);
        // Return both unassignedCount (number) and unassigned (array) for compatibility
        res.json({ count, unassignedCount: unassigned.length, unassigned });
    }
    catch (err) {
        next(err);
    }
});
export default router;
//# sourceMappingURL=subject.router.js.map