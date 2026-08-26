import { Router } from 'express';
import type { Request, Response, NextFunction } from 'express';
import multer from 'multer';
import path from 'path';
import crypto from 'crypto';
import { authenticate } from '../middleware/authenticate.js';
import { requirePrivilegedRole } from '../middleware/authorize.js';
import * as mapService from '../services/map.service.js';

const router = Router();
const BUILDING_SHORT_CODE_MAX = 20;
const VALID_GRADE_LEVELS = new Set([7, 8, 9, 10]);

function normalizeGradeScope(raw: unknown): number[] {
	if (!Array.isArray(raw)) return [];
	const unique = [...new Set(raw.map(Number).filter((n) => VALID_GRADE_LEVELS.has(n)))];
	return unique.sort((a, b) => a - b);
}

// Configure multer for campus image uploads
const storage = multer.diskStorage({
	destination: path.resolve(import.meta.dirname, '../../uploads'),
	filename: (_req, file, cb) => {
		const ext = path.extname(file.originalname);
		cb(null, `campus-${crypto.randomUUID()}${ext}`);
	},
});

const ALLOWED_MIME = ['image/png', 'image/jpeg', 'image/webp'];

const upload = multer({
	storage,
	limits: { fileSize: 5 * 1024 * 1024 }, // 5 MB
	fileFilter: (_req, file, cb) => {
		if (ALLOWED_MIME.includes(file.mimetype)) {
			cb(null, true);
		} else {
			cb(new Error('Only PNG, JPEG, and WebP images are allowed.'));
		}
	},
});

// Public: get buildings for a school
router.get('/schools/:schoolId/buildings', async (req: Request, res: Response) => {
	const schoolId = Number(req.params.schoolId);
	if (Number.isNaN(schoolId)) {
		res.status(400).json({ code: 'INVALID_PARAM', message: 'schoolId must be a number.' });
		return;
	}
	const buildings = await mapService.getBuildingsBySchool(schoolId);
	res.json({ buildings });
});

// Auth required: create a building
router.post('/schools/:schoolId/buildings', authenticate, requirePrivilegedRole, async (req: Request, res: Response) => {
	const schoolId = Number(req.params.schoolId);
	if (Number.isNaN(schoolId)) {
		res.status(400).json({ code: 'INVALID_PARAM', message: 'schoolId must be a number.' });
		return;
	}
	const { name, x, y, width, height, color, rotation, floorCount, isTeachingBuilding, shortCode, gradeScope } = req.body;
	if (!name || x == null || y == null || width == null || height == null || !color) {
		res.status(400).json({ code: 'MISSING_FIELDS', message: 'name, x, y, width, height, color are required.' });
		return;
	}
	if (typeof shortCode === 'string' && shortCode.length > BUILDING_SHORT_CODE_MAX) {
		res.status(400).json({ code: 'INVALID_SHORT_CODE', message: `shortCode must be ${BUILDING_SHORT_CODE_MAX} characters or fewer.` });
		return;
	}
	if (gradeScope !== undefined && gradeScope !== null) {
		const rawArr = Array.isArray(gradeScope) ? gradeScope : [gradeScope];
		const invalid = rawArr.filter((v: unknown) => !VALID_GRADE_LEVELS.has(Number(v)));
		if (invalid.length > 0) {
			res.status(400).json({ code: 'INVALID_GRADE_SCOPE', message: `Invalid grade levels: ${invalid.join(', ')}. Allowed: 7, 8, 9, 10.` });
			return;
		}
	}
	const normalizedGradeScope = normalizeGradeScope(gradeScope);
	const building = await mapService.upsertBuilding(schoolId, { name, x, y, width, height, color, rotation, floorCount, isTeachingBuilding, shortCode, gradeScope: normalizedGradeScope });
	res.status(201).json({ building });
});

// Auth required: update a building
router.patch('/buildings/:id', authenticate, requirePrivilegedRole, async (req: Request, res: Response) => {
	const id = Number(req.params.id);
	if (Number.isNaN(id)) {
		res.status(400).json({ code: 'INVALID_PARAM', message: 'id must be a number.' });
		return;
	}
	if (typeof req.body?.shortCode === 'string' && req.body.shortCode.length > BUILDING_SHORT_CODE_MAX) {
		res.status(400).json({ code: 'INVALID_SHORT_CODE', message: `shortCode must be ${BUILDING_SHORT_CODE_MAX} characters or fewer.` });
		return;
	}
	if (req.body?.gradeScope !== undefined && req.body.gradeScope !== null) {
		const rawArr = Array.isArray(req.body.gradeScope) ? req.body.gradeScope : [req.body.gradeScope];
		const invalid = rawArr.filter((v: unknown) => !VALID_GRADE_LEVELS.has(Number(v)));
		if (invalid.length > 0) {
			res.status(400).json({ code: 'INVALID_GRADE_SCOPE', message: `Invalid grade levels: ${invalid.join(', ')}. Allowed: 7, 8, 9, 10.` });
			return;
		}
		req.body.gradeScope = normalizeGradeScope(req.body.gradeScope);
	}
	const building = await mapService.updateBuilding(id, req.body);
	res.json({ building });
});

// Auth required: delete a building
router.delete('/buildings/:id', authenticate, requirePrivilegedRole, async (req: Request, res: Response) => {
	const id = Number(req.params.id);
	if (Number.isNaN(id)) {
		res.status(400).json({ code: 'INVALID_PARAM', message: 'id must be a number.' });
		return;
	}
	await mapService.deleteBuilding(id);
	res.status(204).end();
});

// Auth required: add a room to a building
router.post('/buildings/:buildingId/rooms', authenticate, requirePrivilegedRole, async (req: Request, res: Response, next: NextFunction) => {
	try {
		const buildingId = Number(req.params.buildingId);
		if (Number.isNaN(buildingId)) {
			res.status(400).json({ code: 'INVALID_PARAM', message: 'buildingId must be a number.' });
			return;
		}
		const { name } = req.body;
		if (!name) {
			res.status(400).json({ code: 'MISSING_FIELDS', message: 'name is required.' });
			return;
		}
		const { floor, type, capacity, isTeachingSpace, floorPosition } = req.body;
		const room = await mapService.addRoom(buildingId, { name, floor, type, capacity, isTeachingSpace, floorPosition });
		res.status(201).json({ room });
	} catch (err) {
		next(err);
	}
});

// Auth required: delete a room
router.delete('/rooms/:id', authenticate, requirePrivilegedRole, async (req: Request, res: Response) => {
	const id = Number(req.params.id);
	if (Number.isNaN(id)) {
		res.status(400).json({ code: 'INVALID_PARAM', message: 'id must be a number.' });
		return;
	}
	await mapService.deleteRoom(id);
	res.status(204).end();
});

// Auth required: update a room
router.patch('/rooms/:id', authenticate, requirePrivilegedRole, async (req: Request, res: Response, next: NextFunction) => {
	try {
		const id = Number(req.params.id);
		if (Number.isNaN(id)) {
			res.status(400).json({ code: 'INVALID_PARAM', message: 'id must be a number.' });
			return;
		}
		const room = await mapService.updateRoom(id, req.body);
		res.json({ room });
	} catch (err) {
		next(err);
	}
});

// Auth required: upload campus image
router.post('/schools/:schoolId/campus-image', authenticate, requirePrivilegedRole, upload.single('image'), async (req: Request, res: Response) => {
	const schoolId = Number(req.params.schoolId);
	if (Number.isNaN(schoolId)) {
		res.status(400).json({ code: 'INVALID_PARAM', message: 'schoolId must be a number.' });
		return;
	}
	if (!req.file) {
		res.status(400).json({ code: 'MISSING_FILE', message: 'An image file is required.' });
		return;
	}
	const imageUrl = `/uploads/${req.file.filename}`;
	await mapService.setCampusImage(schoolId, imageUrl);
	res.json({ campusImageUrl: imageUrl });
});

// Auth required: remove campus image
router.delete('/schools/:schoolId/campus-image', authenticate, requirePrivilegedRole, async (req: Request, res: Response) => {
	const schoolId = Number(req.params.schoolId);
	if (Number.isNaN(schoolId)) {
		res.status(400).json({ code: 'INVALID_PARAM', message: 'schoolId must be a number.' });
		return;
	}
	await mapService.removeCampusImage(schoolId);
	res.status(204).end();
});

// Public: get campus image URL
router.get('/schools/:schoolId/campus-image', async (req: Request, res: Response) => {
	const schoolId = Number(req.params.schoolId);
	if (Number.isNaN(schoolId)) {
		res.status(400).json({ code: 'INVALID_PARAM', message: 'schoolId must be a number.' });
		return;
	}
	const campusImageUrl = await mapService.getCampusImage(schoolId);
	res.json({ campusImageUrl });
});

export default router;
