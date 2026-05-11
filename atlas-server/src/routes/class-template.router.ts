import { Router } from 'express';
import type { Request, Response, NextFunction } from 'express';
import { authenticate } from '../middleware/authenticate.js';
import { requirePrivilegedRole } from '../middleware/authorize.js';
import * as templateService from '../services/class-template.service.js';
import type { ProgramType } from '@prisma/client';

const router = Router();

const VALID_PROGRAM_TYPES = new Set<string>(['REGULAR', 'STE', 'SPS', 'SPA', 'OTHER']);

// GET /class-templates?schoolId=X
router.get('/', async (req: Request, res: Response, next: NextFunction) => {
	try {
		const schoolId = Number(req.query.schoolId);
		if (!schoolId || Number.isNaN(schoolId)) {
			res.status(400).json({ code: 'INVALID_PARAM', message: 'schoolId is required.' });
			return;
		}
		// Seed defaults on first access so callers always get a base set
		await templateService.ensureDefaultTemplates(schoolId);
		const templates = await templateService.getTemplatesBySchool(schoolId);
		res.json({ templates });
	} catch (err) {
		next(err);
	}
});

// GET /class-templates/:id
router.get('/:id', async (req: Request, res: Response, next: NextFunction) => {
	try {
		const id = Number(req.params.id);
		if (Number.isNaN(id)) {
			res.status(400).json({ code: 'INVALID_PARAM', message: 'id must be a number.' });
			return;
		}
		const template = await templateService.getTemplateById(id);
		if (!template) {
			res.status(404).json({ code: 'NOT_FOUND', message: 'Class template not found.' });
			return;
		}
		res.json({ template });
	} catch (err) {
		next(err);
	}
});

// POST /class-templates — create a custom template
router.post('/', authenticate, requirePrivilegedRole, async (req: Request, res: Response, next: NextFunction) => {
	try {
		const { schoolId, name, label, programType, gradeApplicability, periodLengthMinutes, periodsPerDay, subjectIds } = req.body;
		if (!schoolId || !name || !label || !programType || !gradeApplicability || !periodLengthMinutes || !periodsPerDay) {
			res.status(400).json({ code: 'MISSING_FIELDS', message: 'schoolId, name, label, programType, gradeApplicability, periodLengthMinutes, periodsPerDay are required.' });
			return;
		}
		if (!VALID_PROGRAM_TYPES.has(String(programType))) {
			res.status(400).json({ code: 'INVALID_PROGRAM_TYPE', message: `programType must be one of: ${[...VALID_PROGRAM_TYPES].join(', ')}` });
			return;
		}
		const template = await templateService.createTemplate(Number(schoolId), {
			name,
			label,
			programType: programType as ProgramType,
			gradeApplicability: Array.isArray(gradeApplicability) ? gradeApplicability.map(Number) : [],
			periodLengthMinutes: Number(periodLengthMinutes),
			periodsPerDay: Number(periodsPerDay),
			subjectIds: Array.isArray(subjectIds) ? subjectIds.map(Number) : undefined,
		});
		res.status(201).json({ template });
	} catch (err: any) {
		if (err?.code === 'P2002') {
			res.status(409).json({ code: 'DUPLICATE', message: 'A template for this program type already exists for this school.' });
			return;
		}
		next(err);
	}
});

// PATCH /class-templates/:id — update metadata (not subjects; use PUT /class-templates/:id/subjects)
router.patch('/:id', authenticate, requirePrivilegedRole, async (req: Request, res: Response, next: NextFunction) => {
	try {
		const id = Number(req.params.id);
		if (Number.isNaN(id)) {
			res.status(400).json({ code: 'INVALID_PARAM', message: 'id must be a number.' });
			return;
		}
		const template = await templateService.updateTemplate(id, req.body);
		if (!template) {
			res.status(404).json({ code: 'NOT_FOUND', message: 'Class template not found.' });
			return;
		}
		res.json({ template });
	} catch (err) {
		next(err);
	}
});

// PUT /class-templates/:id/subjects — replace subject bundle
router.put('/:id/subjects', authenticate, requirePrivilegedRole, async (req: Request, res: Response, next: NextFunction) => {
	try {
		const id = Number(req.params.id);
		if (Number.isNaN(id)) {
			res.status(400).json({ code: 'INVALID_PARAM', message: 'id must be a number.' });
			return;
		}
		const { subjectIds } = req.body;
		if (!Array.isArray(subjectIds) || subjectIds.length === 0) {
			res.status(400).json({ code: 'MISSING_FIELDS', message: 'subjectIds array is required and must not be empty.' });
			return;
		}
		await templateService.setTemplateSubjects(id, subjectIds.map(Number));
		const template = await templateService.getTemplateById(id);
		res.json({ template });
	} catch (err) {
		next(err);
	}
});

export default router;
