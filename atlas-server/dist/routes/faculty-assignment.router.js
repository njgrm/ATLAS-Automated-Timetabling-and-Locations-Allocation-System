import { Router } from 'express';
import { authenticate } from '../middleware/authenticate.js';
import * as assignmentService from '../services/faculty-assignment.service.js';
const router = Router();
// Auth: GET /faculty-assignments/summary?schoolId=X
router.get('/summary', authenticate, async (req, res, next) => {
    try {
        const schoolId = Number(req.query.schoolId);
        if (!schoolId || Number.isNaN(schoolId)) {
            res.status(400).json({ code: 'INVALID_PARAM', message: 'schoolId query parameter is required.' });
            return;
        }
        const summary = await assignmentService.getAssignmentSummary(schoolId);
        res.json({ faculty: summary });
    }
    catch (err) {
        next(err);
    }
});
// Auth: GET /faculty-assignments/:facultyId
router.get('/:facultyId', authenticate, async (req, res, next) => {
    try {
        const facultyId = Number(req.params.facultyId);
        if (Number.isNaN(facultyId)) {
            res.status(400).json({ code: 'INVALID_PARAM', message: 'facultyId must be a number.' });
            return;
        }
        const assignments = await assignmentService.getAssignmentsByFaculty(facultyId);
        res.json({ assignments });
    }
    catch (err) {
        next(err);
    }
});
// Auth: PUT /faculty-assignments/:facultyId — replace all assignments for a faculty member
router.put('/:facultyId', authenticate, async (req, res, next) => {
    try {
        const facultyId = Number(req.params.facultyId);
        if (Number.isNaN(facultyId)) {
            res.status(400).json({ code: 'INVALID_PARAM', message: 'facultyId must be a number.' });
            return;
        }
        const { schoolId, assignments } = req.body;
        if (!schoolId || !Array.isArray(assignments)) {
            res.status(400).json({ code: 'MISSING_FIELDS', message: 'schoolId and assignments array are required.' });
            return;
        }
        const assignedBy = req.user.userId;
        const result = await assignmentService.setAssignments(facultyId, Number(schoolId), assignedBy, assignments);
        if (!result.success) {
            res.status(400).json({ code: 'ASSIGNMENT_BLOCKED', message: result.error });
            return;
        }
        // Return the updated assignments
        const updated = await assignmentService.getAssignmentsByFaculty(facultyId);
        res.json({ assignments: updated });
    }
    catch (err) {
        next(err);
    }
});
export default router;
//# sourceMappingURL=faculty-assignment.router.js.map