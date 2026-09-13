import { Router } from 'express';
import type { Request, Response, NextFunction } from 'express';
import { authenticate } from '../middleware/authenticate.js';
import { syncTimetableSetup } from '../services/timetable-sync-setup.service.js';
import { publishNotificationEvent } from '../services/notification-events.service.js';

const router = Router();
const PRIVILEGED_ROLES: Set<string> = new Set(['admin', 'officer', 'SYSTEM_ADMIN']);

function positiveInt(raw: unknown, name: string): number | string {
	const n = Number(raw);
	if (!Number.isInteger(n) || n < 1) return `${name} must be a positive integer.`;
	return n;
}

router.post(
	'/:schoolId/:schoolYearId/runs/:runId/sync-setup',
	authenticate,
	async (req: Request, res: Response, next: NextFunction) => {
		try {
			const role = req.user?.role;
			if (!role || !PRIVILEGED_ROLES.has(role)) {
				res.status(403).json({ code: 'FORBIDDEN', message: 'Only admin, officer, or SYSTEM_ADMIN can sync timetable setup.' });
				return;
			}

			const schoolId = positiveInt(req.params.schoolId, 'schoolId');
			if (typeof schoolId === 'string') { res.status(400).json({ code: 'INVALID_PARAM', message: schoolId }); return; }
			const schoolYearId = positiveInt(req.params.schoolYearId, 'schoolYearId');
			if (typeof schoolYearId === 'string') { res.status(400).json({ code: 'INVALID_PARAM', message: schoolYearId }); return; }
			const runId = positiveInt(req.params.runId, 'runId');
			if (typeof runId === 'string') { res.status(400).json({ code: 'INVALID_PARAM', message: runId }); return; }

			const actorId = req.user?.userId;
			if (typeof actorId !== 'number' || !Number.isInteger(actorId) || actorId < 1) {
				res.status(401).json({ code: 'NO_USER', message: 'Authenticated user required.' });
				return;
			}

			// Tenant isolation: an authenticated actor may only sync its own school.
			const actorSchoolId = req.user?.schoolId;
			if (typeof actorSchoolId !== 'number' || !Number.isInteger(actorSchoolId) || actorSchoolId < 1) {
				res.status(403).json({ code: 'ACTOR_SCHOOL_UNRESOLVED', message: 'Setup sync requires an authenticated school scope.' });
				return;
			}
			if (actorSchoolId !== schoolId) {
				res.status(403).json({ code: 'CROSS_SCHOOL_DENIED', message: "The authenticated actor cannot sync another school's timetable setup." });
				return;
			}

			// Anti-clobber: require the exact run version the client reviewed.
			const expectedRunVersion = req.body?.expectedRunVersion;
			if (typeof expectedRunVersion !== 'number' || !Number.isInteger(expectedRunVersion) || expectedRunVersion < 1) {
				res.status(400).json({ code: 'INVALID_PARAM', message: 'expectedRunVersion is required and must be a positive integer.' });
				return;
			}

			const result = await syncTimetableSetup(schoolId, schoolYearId, runId, actorId, expectedRunVersion);

			// A committed synchronization is complete even if the notification
			// transport fails; a replayed (no-write) result must not re-notify.
			if (!result.replayed) {
				try {
					publishNotificationEvent({
						type: 'TIMETABLE_SETUP_SYNC_COMPLETED',
						domain: 'integration',
						severity: 'success',
						audience: 'PRIVILEGED',
						schoolId,
						schoolYearId,
						facultyId: null,
						message: 'Timetable setup was synced into the selected run.',
						metadata: {
							runId,
							actorId,
							result,
						},
					});
				} catch (notificationError) {
					console.warn('[timetable-sync-setup] notification dispatch failed after committed sync', notificationError);
				}
			}
			res.status(200).json(result);
		} catch (e: any) {
			if (e.statusCode) {
				res.status(e.statusCode).json({ code: e.code, message: e.message });
			} else {
				next(e);
			}
		}
	}
);

export default router;
