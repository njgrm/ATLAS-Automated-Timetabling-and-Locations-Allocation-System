import { Router } from 'express';
import type { NextFunction, Request, Response } from 'express';
import { authenticate } from '../middleware/authenticate.js';
import * as draftService from '../services/pre-generation-draft.service.js';

const router = Router();

const PRIVILEGED_ROLES: Set<string> = new Set(['admin', 'officer', 'SYSTEM_ADMIN']);

function positiveInt(raw: unknown, name: string): number | string {
	const value = Number(raw);
	if (!Number.isInteger(value) || value < 1) return `${name} must be a positive integer.`;
	return value;
}

function requirePrivileged(req: Request, res: Response) {
	const role = req.user?.role;
	if (!role || !PRIVILEGED_ROLES.has(role)) {
		res.status(403).json({ code: 'FORBIDDEN', message: 'Only admin, officer, or SYSTEM_ADMIN can manage pre-generation draft placements.' });
		return false;
	}
	if (!req.user?.userId) {
		res.status(401).json({ code: 'NO_USER', message: 'Authenticated user required.' });
		return false;
	}
	return true;
}

function parseScope(req: Request, res: Response) {
	const schoolId = positiveInt(req.params.schoolId, 'schoolId');
	if (typeof schoolId === 'string') {
		res.status(400).json({ code: 'INVALID_PARAM', message: schoolId });
		return null;
	}
	const schoolYearId = positiveInt(req.params.schoolYearId, 'schoolYearId');
	if (typeof schoolYearId === 'string') {
		res.status(400).json({ code: 'INVALID_PARAM', message: schoolYearId });
		return null;
	}
	return { schoolId, schoolYearId };
}

function parsePlacementBody(req: Request) {
	return {
		placementId: req.body.placementId == null ? undefined : Number(req.body.placementId),
		entryKind: req.body.entryKind,
		sectionId: Number(req.body.sectionId),
		subjectId: Number(req.body.subjectId),
		facultyId: Number(req.body.facultyId),
		roomId: Number(req.body.roomId),
		day: String(req.body.day),
		startTime: String(req.body.startTime),
		endTime: String(req.body.endTime),
		cohortCode: req.body.cohortCode == null ? null : String(req.body.cohortCode),
		notes: req.body.notes == null ? null : String(req.body.notes),
		expectedVersion: req.body.expectedVersion == null ? undefined : Number(req.body.expectedVersion),
	};
}

function toEditablePlacementInput(existing: Awaited<ReturnType<typeof draftService.getDraftPlacement>>) {
	if (existing.facultyId == null || existing.roomId == null) {
		return 'Draft placement is incomplete and cannot be edited through targeted faculty/room/timeslot routes.';
	}
	return {
		placementId: existing.id,
		entryKind: existing.entryKind,
		sectionId: existing.sectionId,
		subjectId: existing.subjectId,
		facultyId: existing.facultyId,
		roomId: existing.roomId,
		day: existing.day,
		startTime: existing.startTime,
		endTime: existing.endTime,
		cohortCode: existing.cohortCode,
		notes: existing.notes,
		expectedVersion: existing.version,
	};
}

router.get(
	'/:schoolId/:schoolYearId/pre-generation-drafts',
	authenticate,
	async (req: Request, res: Response, next: NextFunction) => {
		try {
			if (!requirePrivileged(req, res)) return;
			const scope = parseScope(req, res);
			if (!scope) return;
			const board = await draftService.listDraftBoardState(scope.schoolId, scope.schoolYearId);
			res.json(board);
		} catch (error) {
			next(error);
		}
	},
);

router.post(
	'/:schoolId/:schoolYearId/pre-generation-drafts/preview',
	authenticate,
	async (req: Request, res: Response, next: NextFunction) => {
		try {
			if (!requirePrivileged(req, res)) return;
			const scope = parseScope(req, res);
			if (!scope) return;
			const preview = await draftService.previewPlacement(scope.schoolId, scope.schoolYearId, parsePlacementBody(req));
			res.json(preview);
		} catch (error) {
			next(error);
		}
	},
);

router.post(
	'/:schoolId/:schoolYearId/pre-generation-drafts/commit',
	authenticate,
	async (req: Request, res: Response, next: NextFunction) => {
		try {
			if (!requirePrivileged(req, res)) return;
			const scope = parseScope(req, res);
			if (!scope) return;
			const result = await draftService.commitPlacement(
				scope.schoolId,
				scope.schoolYearId,
				req.user!.userId,
				parsePlacementBody(req),
				Boolean(req.body.allowSoftOverride),
			);
			res.status(201).json(result);
		} catch (error) {
			next(error);
		}
	},
);

router.post(
	'/:schoolId/:schoolYearId/pre-generation-drafts/undo',
	authenticate,
	async (req: Request, res: Response, next: NextFunction) => {
		try {
			if (!requirePrivileged(req, res)) return;
			const scope = parseScope(req, res);
			if (!scope) return;
			const board = await draftService.undoLastPlacement(scope.schoolId, scope.schoolYearId, req.user!.userId);
			res.json(board);
		} catch (error) {
			next(error);
		}
	},
);

router.post(
	'/:schoolId/:schoolYearId/pre-generation-drafts/clear',
	authenticate,
	async (req: Request, res: Response, next: NextFunction) => {
		try {
			if (!requirePrivileged(req, res)) return;
			const scope = parseScope(req, res);
			if (!scope) return;
			const board = await draftService.clearDraft(scope.schoolId, scope.schoolYearId, req.user!.userId);
			res.json(board);
		} catch (error) {
			next(error);
		}
	},
);

router.patch(
	'/:schoolId/:schoolYearId/pre-generation-drafts/:placementId/reassign-faculty',
	authenticate,
	async (req: Request, res: Response, next: NextFunction) => {
		try {
			if (!requirePrivileged(req, res)) return;
			const scope = parseScope(req, res);
			if (!scope) return;
			const placementId = positiveInt(req.params.placementId, 'placementId');
			if (typeof placementId === 'string') {
				res.status(400).json({ code: 'INVALID_PARAM', message: placementId });
				return;
			}
			const existing = await draftService.getDraftPlacement(scope.schoolId, scope.schoolYearId, placementId);
			const editable = toEditablePlacementInput(existing);
			if (typeof editable === 'string') {
				res.status(422).json({ code: 'INCOMPLETE_DRAFT_PLACEMENT', message: editable });
				return;
			}
			const result = await draftService.commitPlacement(scope.schoolId, scope.schoolYearId, req.user!.userId, {
				...editable,
				facultyId: Number(req.body.facultyId),
				expectedVersion: req.body.expectedVersion == null ? existing.version : Number(req.body.expectedVersion),
			}, Boolean(req.body.allowSoftOverride));
			res.json(result);
		} catch (error) {
			next(error);
		}
	},
);

router.patch(
	'/:schoolId/:schoolYearId/pre-generation-drafts/:placementId/change-room',
	authenticate,
	async (req: Request, res: Response, next: NextFunction) => {
		try {
			if (!requirePrivileged(req, res)) return;
			const scope = parseScope(req, res);
			if (!scope) return;
			const placementId = positiveInt(req.params.placementId, 'placementId');
			if (typeof placementId === 'string') {
				res.status(400).json({ code: 'INVALID_PARAM', message: placementId });
				return;
			}
			const existing = await draftService.getDraftPlacement(scope.schoolId, scope.schoolYearId, placementId);
			const editable = toEditablePlacementInput(existing);
			if (typeof editable === 'string') {
				res.status(422).json({ code: 'INCOMPLETE_DRAFT_PLACEMENT', message: editable });
				return;
			}
			const result = await draftService.commitPlacement(scope.schoolId, scope.schoolYearId, req.user!.userId, {
				...editable,
				roomId: Number(req.body.roomId),
				expectedVersion: req.body.expectedVersion == null ? existing.version : Number(req.body.expectedVersion),
			}, Boolean(req.body.allowSoftOverride));
			res.json(result);
		} catch (error) {
			next(error);
		}
	},
);

router.patch(
	'/:schoolId/:schoolYearId/pre-generation-drafts/:placementId/move-timeslot',
	authenticate,
	async (req: Request, res: Response, next: NextFunction) => {
		try {
			if (!requirePrivileged(req, res)) return;
			const scope = parseScope(req, res);
			if (!scope) return;
			const placementId = positiveInt(req.params.placementId, 'placementId');
			if (typeof placementId === 'string') {
				res.status(400).json({ code: 'INVALID_PARAM', message: placementId });
				return;
			}
			const existing = await draftService.getDraftPlacement(scope.schoolId, scope.schoolYearId, placementId);
			const editable = toEditablePlacementInput(existing);
			if (typeof editable === 'string') {
				res.status(422).json({ code: 'INCOMPLETE_DRAFT_PLACEMENT', message: editable });
				return;
			}
			const result = await draftService.commitPlacement(scope.schoolId, scope.schoolYearId, req.user!.userId, {
				...editable,
				day: String(req.body.day ?? existing.day),
				startTime: String(req.body.startTime),
				endTime: String(req.body.endTime),
				expectedVersion: req.body.expectedVersion == null ? existing.version : Number(req.body.expectedVersion),
			}, Boolean(req.body.allowSoftOverride));
			res.json(result);
		} catch (error) {
			next(error);
		}
	},
);

export default router;