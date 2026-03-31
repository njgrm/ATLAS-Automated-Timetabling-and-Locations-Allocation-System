import { Router } from 'express';
import type { Request, Response, NextFunction } from 'express';
import { authenticate } from '../middleware/authenticate.js';
import * as prefService from '../services/preference.service.js';
import type { DayOfWeek, TimeSlotPreference } from '@prisma/client';

const router = Router();

// ─── Helpers ───

/** Verify the authenticated user owns the faculty record or is an officer/admin. */
async function assertFacultyOwnerOrOfficer(
	req: Request,
	res: Response,
	schoolId: number,
	facultyId: number,
): Promise<boolean> {
	const role = req.user?.role;
	if (role === 'admin' || role === 'officer' || role === 'SYSTEM_ADMIN') return true;

	// For faculty role, userId must map to the requested facultyId via externalId
	const userId = req.user?.userId;
	if (!userId) { res.status(401).json({ code: 'NO_USER', message: 'Authenticated user required.' }); return false; }

	const { prisma } = await import('../lib/prisma.js');
	const faculty = await prisma.facultyMirror.findFirst({
		where: { id: facultyId, schoolId, externalId: userId },
		select: { id: true },
	});
	if (!faculty) {
		res.status(403).json({ code: 'FORBIDDEN', message: 'You do not have permission to access this faculty preference.' });
		return false;
	}
	return true;
}

function positiveInt(value: unknown, name: string): number | string {
	const n = Number(value);
	if (!Number.isInteger(n) || n <= 0) return `${name} must be a positive integer.`;
	return n;
}

const VALID_DAYS: Set<string> = new Set(['MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY']);
const VALID_PREFS: Set<string> = new Set(['PREFERRED', 'AVAILABLE', 'UNAVAILABLE']);
const VALID_STATUSES: Set<string> = new Set(['DRAFT', 'SUBMITTED', 'MISSING']);

function validateTimeSlots(slots: unknown): prefService.TimeSlotInput[] | string {
	if (!Array.isArray(slots)) return 'timeSlots must be an array.';
	for (let i = 0; i < slots.length; i++) {
		const s = slots[i];
		if (!s || typeof s !== 'object') return `timeSlots[${i}] is invalid.`;
		if (!VALID_DAYS.has(s.day)) return `timeSlots[${i}].day must be one of ${[...VALID_DAYS].join(', ')}.`;
		if (typeof s.startTime !== 'string' || !/^\d{2}:\d{2}$/.test(s.startTime))
			return `timeSlots[${i}].startTime must be HH:MM format.`;
		if (typeof s.endTime !== 'string' || !/^\d{2}:\d{2}$/.test(s.endTime))
			return `timeSlots[${i}].endTime must be HH:MM format.`;
		if (s.startTime >= s.endTime) return `timeSlots[${i}].startTime must be before endTime.`;
		if (s.preference && !VALID_PREFS.has(s.preference))
			return `timeSlots[${i}].preference must be one of ${[...VALID_PREFS].join(', ')}.`;
	}
	return slots.map((s: any) => ({
		day: s.day as DayOfWeek,
		startTime: s.startTime as string,
		endTime: s.endTime as string,
		preference: (s.preference ?? 'AVAILABLE') as TimeSlotPreference,
	}));
}

// v1 phase constant — will become dynamic per school+year in future
const CURRENT_PHASE = process.env.ATLAS_LIFECYCLE_PHASE ?? 'SETUP';

// ─── Faculty self: GET preference ───

router.get(
	'/:schoolId/:schoolYearId/faculty/:facultyId',
	authenticate,
	async (req: Request, res: Response, next: NextFunction) => {
		try {
			const schoolId = positiveInt(req.params.schoolId, 'schoolId');
			if (typeof schoolId === 'string') { res.status(400).json({ code: 'INVALID_PARAM', message: schoolId }); return; }
			const schoolYearId = positiveInt(req.params.schoolYearId, 'schoolYearId');
			if (typeof schoolYearId === 'string') { res.status(400).json({ code: 'INVALID_PARAM', message: schoolYearId }); return; }
			const facultyId = positiveInt(req.params.facultyId, 'facultyId');
			if (typeof facultyId === 'string') { res.status(400).json({ code: 'INVALID_PARAM', message: facultyId }); return; }

			// Auth guard: faculty can only access own preference
			const allowed = await assertFacultyOwnerOrOfficer(req, res, schoolId, facultyId);
			if (!allowed) return;

			const pref = await prefService.getPreference(schoolId, schoolYearId, facultyId);
			res.json({ preference: pref });
		} catch (e) { next(e); }
	},
);

// ─── Faculty self: save draft ───

router.put(
	'/:schoolId/:schoolYearId/faculty/:facultyId/draft',
	authenticate,
	async (req: Request, res: Response, next: NextFunction) => {
		try {
			const schoolId = positiveInt(req.params.schoolId, 'schoolId');
			if (typeof schoolId === 'string') { res.status(400).json({ code: 'INVALID_PARAM', message: schoolId }); return; }
			const schoolYearId = positiveInt(req.params.schoolYearId, 'schoolYearId');
			if (typeof schoolYearId === 'string') { res.status(400).json({ code: 'INVALID_PARAM', message: schoolYearId }); return; }
			const facultyId = positiveInt(req.params.facultyId, 'facultyId');
			if (typeof facultyId === 'string') { res.status(400).json({ code: 'INVALID_PARAM', message: facultyId }); return; }

			// Auth guard: faculty can only save own draft
			const allowed = await assertFacultyOwnerOrOfficer(req, res, schoolId, facultyId);
			if (!allowed) return;

			// Lifecycle guard
			const windowCheck = prefService.checkPreferenceWindow(CURRENT_PHASE);
			if (windowCheck) { res.status(windowCheck.statusCode).json({ code: windowCheck.code, message: windowCheck.message }); return; }

			const slots = validateTimeSlots(req.body.timeSlots);
			if (typeof slots === 'string') { res.status(400).json({ code: 'INVALID_BODY', message: slots }); return; }

			const result = await prefService.saveDraft({
				schoolId,
				schoolYearId,
				facultyId,
				notes: req.body.notes ?? null,
				timeSlots: slots,
				version: req.body.version,
			});
			res.json({ preference: result });
		} catch (e) { next(e); }
	},
);

// ─── Faculty self: submit ───

router.post(
	'/:schoolId/:schoolYearId/faculty/:facultyId/submit',
	authenticate,
	async (req: Request, res: Response, next: NextFunction) => {
		try {
			const schoolId = positiveInt(req.params.schoolId, 'schoolId');
			if (typeof schoolId === 'string') { res.status(400).json({ code: 'INVALID_PARAM', message: schoolId }); return; }
			const schoolYearId = positiveInt(req.params.schoolYearId, 'schoolYearId');
			if (typeof schoolYearId === 'string') { res.status(400).json({ code: 'INVALID_PARAM', message: schoolYearId }); return; }
			const facultyId = positiveInt(req.params.facultyId, 'facultyId');
			if (typeof facultyId === 'string') { res.status(400).json({ code: 'INVALID_PARAM', message: facultyId }); return; }

			// Auth guard: faculty can only submit own preference
			const allowed = await assertFacultyOwnerOrOfficer(req, res, schoolId, facultyId);
			if (!allowed) return;

			// Lifecycle guard
			const windowCheck = prefService.checkPreferenceWindow(CURRENT_PHASE);
			if (windowCheck) { res.status(windowCheck.statusCode).json({ code: windowCheck.code, message: windowCheck.message }); return; }

			const slots = validateTimeSlots(req.body.timeSlots);
			if (typeof slots === 'string') { res.status(400).json({ code: 'INVALID_BODY', message: slots }); return; }

			const version = Number(req.body.version);
			if (!Number.isInteger(version) || version < 1) {
				res.status(400).json({ code: 'INVALID_BODY', message: 'version is required and must be a positive integer.' });
				return;
			}

			const result = await prefService.submitPreference({
				schoolId,
				schoolYearId,
				facultyId,
				notes: req.body.notes ?? null,
				timeSlots: slots,
				version,
			});
			res.json({ preference: result });
		} catch (e) { next(e); }
	},
);

// ─── Officer: summary (submitted / draft / missing, with review metadata) ───

router.get(
	'/:schoolId/:schoolYearId/summary',
	authenticate,
	async (req: Request, res: Response, next: NextFunction) => {
		try {
			const schoolId = positiveInt(req.params.schoolId, 'schoolId');
			if (typeof schoolId === 'string') { res.status(400).json({ code: 'INVALID_PARAM', message: schoolId }); return; }
			const schoolYearId = positiveInt(req.params.schoolYearId, 'schoolYearId');
			if (typeof schoolYearId === 'string') { res.status(400).json({ code: 'INVALID_PARAM', message: schoolYearId }); return; }

			const statusParam = req.query.status as string | undefined;
			let statusFilter: 'SUBMITTED' | 'DRAFT' | 'MISSING' | undefined;
			if (statusParam) {
				const upper = statusParam.toUpperCase();
				if (!VALID_STATUSES.has(upper)) {
					res.status(400).json({ code: 'INVALID_PARAM', message: `status must be one of ${[...VALID_STATUSES].join(', ')}.` });
					return;
				}
				statusFilter = upper as 'SUBMITTED' | 'DRAFT' | 'MISSING';
			}

			// Optional auto-seed: if ?autoSeed=true and no preferences exist yet, seed defaults
			if (req.query.autoSeed === 'true') {
				const actorId = req.user?.userId;
				const role = req.user?.role;
				if (actorId && (role === 'admin' || role === 'officer' || role === 'SYSTEM_ADMIN')) {
					const preview = await prefService.getOfficerSummary(schoolId, schoolYearId);
					if (preview.counts.submitted === 0 && preview.counts.draft === 0) {
						await prefService.seedPreferencesForSchoolYear(schoolId, schoolYearId, actorId);
					}
				}
			}

			const result = await prefService.getOfficerSummaryWithReviews(schoolId, schoolYearId, statusFilter);
			res.json(result);
		} catch (e) { next(e); }
	},
);

// ─── Officer: seed preferences (idempotent) ───

const PRIVILEGED_ROLES = new Set(['admin', 'officer', 'SYSTEM_ADMIN']);

router.post(
	'/:schoolId/:schoolYearId/seed',
	authenticate,
	async (req: Request, res: Response, next: NextFunction) => {
		try {
			const schoolId = positiveInt(req.params.schoolId, 'schoolId');
			if (typeof schoolId === 'string') { res.status(400).json({ code: 'INVALID_PARAM', message: schoolId }); return; }
			const schoolYearId = positiveInt(req.params.schoolYearId, 'schoolYearId');
			if (typeof schoolYearId === 'string') { res.status(400).json({ code: 'INVALID_PARAM', message: schoolYearId }); return; }

			const role = req.user?.role;
			if (!role || !PRIVILEGED_ROLES.has(role)) {
				res.status(403).json({ code: 'FORBIDDEN', message: 'Only admin, officer, or SYSTEM_ADMIN can seed preferences.' });
				return;
			}

			const actorId = req.user?.userId;
			if (!actorId) { res.status(401).json({ code: 'NO_USER', message: 'Authenticated user required.' }); return; }

			const result = await prefService.seedPreferencesForSchoolYear(schoolId, schoolYearId, actorId);
			res.json(result);
		} catch (e) { next(e); }
	},
);

// ─── Officer: trigger reminder ───

router.post(
	'/:schoolId/:schoolYearId/remind',
	authenticate,
	async (req: Request, res: Response, next: NextFunction) => {
		try {
			const schoolId = positiveInt(req.params.schoolId, 'schoolId');
			if (typeof schoolId === 'string') { res.status(400).json({ code: 'INVALID_PARAM', message: schoolId }); return; }
			const schoolYearId = positiveInt(req.params.schoolYearId, 'schoolYearId');
			if (typeof schoolYearId === 'string') { res.status(400).json({ code: 'INVALID_PARAM', message: schoolYearId }); return; }

			const facultyIds = req.body.facultyIds;
			if (!Array.isArray(facultyIds) || facultyIds.length === 0 || !facultyIds.every((id: unknown) => Number.isInteger(Number(id)) && Number(id) > 0)) {
				res.status(400).json({ code: 'INVALID_BODY', message: 'facultyIds must be a non-empty array of positive integers.' });
				return;
			}

			const triggeredBy = req.user?.userId;
			if (!triggeredBy) { res.status(401).json({ code: 'NO_USER', message: 'Authenticated user required.' }); return; }

			const result = await prefService.triggerReminder(
				schoolId,
				schoolYearId,
				facultyIds.map(Number),
				triggeredBy,
			);
			res.json(result);
		} catch (e) { next(e); }
	},
);

// ─── Officer: get single faculty preference detail (for review) ───

router.get(
	'/:schoolId/:schoolYearId/faculty/:facultyId/detail',
	authenticate,
	async (req: Request, res: Response, next: NextFunction) => {
		try {
			const schoolId = positiveInt(req.params.schoolId, 'schoolId');
			if (typeof schoolId === 'string') { res.status(400).json({ code: 'INVALID_PARAM', message: schoolId }); return; }
			const schoolYearId = positiveInt(req.params.schoolYearId, 'schoolYearId');
			if (typeof schoolYearId === 'string') { res.status(400).json({ code: 'INVALID_PARAM', message: schoolYearId }); return; }
			const facultyId = positiveInt(req.params.facultyId, 'facultyId');
			if (typeof facultyId === 'string') { res.status(400).json({ code: 'INVALID_PARAM', message: facultyId }); return; }

			const role = req.user?.role;
			if (!role || !PRIVILEGED_ROLES.has(role)) {
				res.status(403).json({ code: 'FORBIDDEN', message: 'Only admin, officer, or SYSTEM_ADMIN can view preference details.' });
				return;
			}

			const detail = await prefService.getPreferenceDetail(schoolId, schoolYearId, facultyId);
			res.json({ preference: detail });
		} catch (e) { next(e); }
	},
);

// ─── Officer: update review metadata ───

const VALID_REVIEW_STATUSES: Set<string> = new Set(['REVIEWED', 'NEEDS_FOLLOW_UP']);

router.patch(
	'/:schoolId/:schoolYearId/review/:preferenceId',
	authenticate,
	async (req: Request, res: Response, next: NextFunction) => {
		try {
			const role = req.user?.role;
			if (!role || !PRIVILEGED_ROLES.has(role)) {
				res.status(403).json({ code: 'FORBIDDEN', message: 'Only admin, officer, or SYSTEM_ADMIN can review preferences.' });
				return;
			}

			const preferenceId = positiveInt(req.params.preferenceId, 'preferenceId');
			if (typeof preferenceId === 'string') { res.status(400).json({ code: 'INVALID_PARAM', message: preferenceId }); return; }

			const reviewerId = req.user?.userId;
			if (!reviewerId) { res.status(401).json({ code: 'NO_USER', message: 'Authenticated user required.' }); return; }

			const { reviewStatus, reviewerNotes } = req.body;
			if (!reviewStatus || !VALID_REVIEW_STATUSES.has(reviewStatus)) {
				res.status(400).json({ code: 'INVALID_BODY', message: `reviewStatus must be one of ${[...VALID_REVIEW_STATUSES].join(', ')}.` });
				return;
			}

			const review = await prefService.updateReview({
				preferenceId,
				reviewerId,
				reviewStatus,
				reviewerNotes: reviewerNotes ?? null,
			});
			res.json({ review });
		} catch (e) { next(e); }
	},
);

// ─── Dev: bulk-submit seeded drafts (non-production QA helper) ───

router.post(
	'/:schoolId/:schoolYearId/dev/submit-seeded',
	authenticate,
	async (req: Request, res: Response, next: NextFunction) => {
		try {
			if (!prefService.isDevToolsEnabled()) {
				res.status(403).json({ code: 'DEV_TOOLS_DISABLED', message: 'Dev preference tools are disabled in production.' });
				return;
			}

			const role = req.user?.role;
			if (!role || !PRIVILEGED_ROLES.has(role)) {
				res.status(403).json({ code: 'FORBIDDEN', message: 'Only admin, officer, or SYSTEM_ADMIN can use dev tools.' });
				return;
			}

			const schoolId = positiveInt(req.params.schoolId, 'schoolId');
			if (typeof schoolId === 'string') { res.status(400).json({ code: 'INVALID_PARAM', message: schoolId }); return; }
			const schoolYearId = positiveInt(req.params.schoolYearId, 'schoolYearId');
			if (typeof schoolYearId === 'string') { res.status(400).json({ code: 'INVALID_PARAM', message: schoolYearId }); return; }

			const actorId = req.user?.userId;
			if (!actorId) { res.status(401).json({ code: 'NO_USER', message: 'Authenticated user required.' }); return; }

			const result = await prefService.devBulkSubmitSeeded(schoolId, schoolYearId, actorId);
			res.json(result);
		} catch (e) { next(e); }
	},
);

export default router;
