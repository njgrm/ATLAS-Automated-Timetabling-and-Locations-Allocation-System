import { Router } from 'express';
import type { Request, Response, NextFunction } from 'express';
import { authenticate } from '../middleware/authenticate.js';
import * as assignmentService from '../services/faculty-assignment.service.js';

const router = Router();

// Auth: GET /faculty-assignments/summary?schoolId=X&schoolYearId=Y
router.get('/summary', authenticate, async (req: Request, res: Response, next: NextFunction) => {
	try {
		const schoolId = Number(req.query.schoolId);
		if (!schoolId || Number.isNaN(schoolId)) {
			res.status(400).json({ code: 'INVALID_PARAM', message: 'schoolId query parameter is required.' });
			return;
		}
		const schoolYearId = Number(req.query.schoolYearId);
		if (!schoolYearId || Number.isNaN(schoolYearId)) {
			res.status(400).json({ code: 'INVALID_PARAM', message: 'schoolYearId query parameter is required.' });
			return;
		}
		const authToken = req.headers.authorization?.slice(7);
		const summary = await assignmentService.getAssignmentSummary(schoolId, schoolYearId, authToken);
		res.json({ faculty: summary });
	} catch (err) {
		next(err);
	}
});

// Auth: GET /faculty-assignments/:facultyId?schoolYearId=Y
router.get('/:facultyId', authenticate, async (req: Request, res: Response, next: NextFunction) => {
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
	} catch (err) {
		next(err);
	}
});

// Auth: PUT /faculty-assignments/:facultyId — replace all assignments for a faculty member
router.put('/:facultyId', authenticate, async (req: Request, res: Response, next: NextFunction) => {
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
		const assignedBy = req.user!.userId;
		const authToken = req.headers.authorization?.slice(7);
		const result = await assignmentService.setAssignments(
			facultyId,
			Number(schoolId),
			Number(schoolYearId),
			assignedBy,
			Number(version),
			assignments,
			authToken,
		);
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
	} catch (err) {
		next(err);
	}
});

export default router;
