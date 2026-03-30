import { Router } from 'express';
import type { Request, Response } from 'express';
import multer from 'multer';
import path from 'path';
import crypto from 'crypto';
import { authenticate } from '../middleware/authenticate.js';
import * as mapService from '../services/map.service.js';

const router = Router();

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
router.post('/schools/:schoolId/buildings', authenticate, async (req: Request, res: Response) => {
	const schoolId = Number(req.params.schoolId);
	if (Number.isNaN(schoolId)) {
		res.status(400).json({ code: 'INVALID_PARAM', message: 'schoolId must be a number.' });
		return;
	}
	const { name, x, y, width, height, color } = req.body;
	if (!name || x == null || y == null || width == null || height == null || !color) {
		res.status(400).json({ code: 'MISSING_FIELDS', message: 'name, x, y, width, height, color are required.' });
		return;
	}
	const building = await mapService.upsertBuilding(schoolId, { name, x, y, width, height, color });
	res.status(201).json({ building });
});

// Auth required: update a building
router.patch('/buildings/:id', authenticate, async (req: Request, res: Response) => {
	const id = Number(req.params.id);
	if (Number.isNaN(id)) {
		res.status(400).json({ code: 'INVALID_PARAM', message: 'id must be a number.' });
		return;
	}
	const building = await mapService.updateBuilding(id, req.body);
	res.json({ building });
});

// Auth required: delete a building
router.delete('/buildings/:id', authenticate, async (req: Request, res: Response) => {
	const id = Number(req.params.id);
	if (Number.isNaN(id)) {
		res.status(400).json({ code: 'INVALID_PARAM', message: 'id must be a number.' });
		return;
	}
	await mapService.deleteBuilding(id);
	res.status(204).end();
});

// Auth required: add a room to a building
router.post('/buildings/:buildingId/rooms', authenticate, async (req: Request, res: Response) => {
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
	const { floor, type, capacity } = req.body;
	const room = await mapService.addRoom(buildingId, { name, floor, type, capacity });
	res.status(201).json({ room });
});

// Auth required: delete a room
router.delete('/rooms/:id', authenticate, async (req: Request, res: Response) => {
	const id = Number(req.params.id);
	if (Number.isNaN(id)) {
		res.status(400).json({ code: 'INVALID_PARAM', message: 'id must be a number.' });
		return;
	}
	await mapService.deleteRoom(id);
	res.status(204).end();
});

// Auth required: upload campus image
router.post('/schools/:schoolId/campus-image', authenticate, upload.single('image'), async (req: Request, res: Response) => {
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
