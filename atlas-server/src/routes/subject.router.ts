import { Router } from 'express';
import type { Request, Response, NextFunction } from 'express';
import { authenticate } from '../middleware/authenticate.js';
import * as subjectService from '../services/subject.service.js';

const router = Router();

// Public: GET /subjects?schoolId=X
router.get('/', async (req: Request, res: Response, next: NextFunction) => {
	try {
		const schoolId = Number(req.query.schoolId);
		if (!schoolId || Number.isNaN(schoolId)) {
			res.status(400).json({ code: 'INVALID_PARAM', message: 'schoolId query parameter is required.' });
			return;
		}
		const subjects = await subjectService.getSubjectsBySchool(schoolId);
		res.json({ subjects });
	} catch (err) {
		next(err);
	}
});

// Public: GET /subjects/:id
router.get('/:id', async (req: Request, res: Response, next: NextFunction) => {
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
	} catch (err) {
		next(err);
	}
});

// Auth: POST /subjects — create a custom subject
router.post('/', authenticate, async (req: Request, res: Response, next: NextFunction) => {
	try {
		const { schoolId, code, name, minMinutesPerWeek, preferredRoomType, gradeLevels } = req.body;
		if (!schoolId || !code || !name || !minMinutesPerWeek || !preferredRoomType || !gradeLevels) {
			res.status(400).json({ code: 'MISSING_FIELDS', message: 'schoolId, code, name, minMinutesPerWeek, preferredRoomType, gradeLevels are required.' });
			return;
		}
		const subject = await subjectService.createSubject(Number(schoolId), {
			code,
			name,
			minMinutesPerWeek: Number(minMinutesPerWeek),
			preferredRoomType,
			gradeLevels,
		});
		res.status(201).json({ subject });
	} catch (err: any) {
		if (err?.code === 'P2002') {
			res.status(409).json({ code: 'DUPLICATE', message: 'A subject with this code already exists for this school.' });
			return;
		}
		next(err);
	}
});

// Auth: PATCH /subjects/:id
router.patch('/:id', authenticate, async (req: Request, res: Response, next: NextFunction) => {
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
	} catch (err) {
		next(err);
	}
});

// Auth: DELETE /subjects/:id
router.delete('/:id', authenticate, async (req: Request, res: Response, next: NextFunction) => {
	try {
		const id = Number(req.params.id);
		if (Number.isNaN(id)) {
			res.status(400).json({ code: 'INVALID_PARAM', message: 'id must be a number.' });
			return;
		}
		const result = await subjectService.deleteSubject(id);
		if (!result.success) {
			res.status(result.error?.includes('not found') ? 404 : 400).json({
				code: 'DELETE_BLOCKED',
				message: result.error,
			});
			return;
		}
		res.status(204).end();
	} catch (err) {
		next(err);
	}
});

// Auth: POST /subjects/seed — seed defaults for a school
router.post('/seed', authenticate, async (req: Request, res: Response, next: NextFunction) => {
	try {
		const schoolId = Number(req.body.schoolId);
		if (!schoolId || Number.isNaN(schoolId)) {
			res.status(400).json({ code: 'INVALID_PARAM', message: 'schoolId is required.' });
			return;
		}
		await subjectService.ensureDefaultSubjects(schoolId);
		const subjects = await subjectService.getSubjectsBySchool(schoolId);
		res.json({ subjects });
	} catch (err) {
		next(err);
	}
});

// Auth: GET /subjects/stats — get counts for dashboard
router.get('/stats/:schoolId', async (req: Request, res: Response, next: NextFunction) => {
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
	} catch (err) {
		next(err);
	}
});

export default router;
