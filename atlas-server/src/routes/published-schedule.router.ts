import { Router } from 'express';
import type { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { getDataContext } from '../lib/data-context.js';
import { extractSseToken } from '../middleware/authenticate.js';
import { MAX_ACADEMIC_TERM_INDEX } from '../services/academic-term.service.js';
import { resolveCanonicalFacultyFromAuthPayload } from '../services/faculty-identity.service.js';
import { attachSseErrorGuard, registerSseCleanup, sseWrite } from '../lib/sse.js';
import {
	getPublishedFacultySchedule,
	getPublishedFacultyScheduleByExternalId,
	getPublishedRoomSchedule,
	getPublishedSchedulePayload,
	getPublishedSectionSchedule,
	resolveActiveSchoolYearElection,
} from '../services/published-schedule.service.js';
import {
	subscribePublishedScheduleEvents,
	getPublishedScheduleEventsSince,
} from '../services/published-schedule-events.service.js';

const router = Router();
const db = () => getDataContext();

function positiveInt(raw: unknown, name: string): number | string {
	const n = Number(raw);
	if (!Number.isInteger(n) || n < 1) return `${name} must be a positive integer.`;
	return n;
}

function readTermId(req: Request): number | undefined | string {
	if (!('termId' in req.params)) return undefined;
	if (req.params.termId == null) return undefined;
	return positiveInt(req.params.termId, 'termId');
}

function readStringQuery(raw: unknown): string | undefined {
	if (Array.isArray(raw)) return readStringQuery(raw[0]);
	if (typeof raw !== 'string') return undefined;
	const value = raw.trim();
	return value.length > 0 ? value : undefined;
}

function readScheduleOptions(req: Request) {
	const termIndex = parseTermIndexQuery(req.query.termIndex);
	return {
		requestedDate: readStringQuery(req.query.date) ?? readStringQuery(req.query.asOfDate),
		termIndex: termIndex === 'INVALID' ? undefined : termIndex,
		invalidTermIndex: termIndex === 'INVALID',
	};
}

function parseTermIndexQuery(raw: unknown): number | 'active' | 'INVALID' | undefined {
	if (raw == null) return undefined;
	const value = String(raw).trim().toLowerCase();
	if (value === 'active') return 'active';
	const n = Number(value);
	if (Number.isInteger(n) && n >= 1 && n <= MAX_ACADEMIC_TERM_INDEX) return n;
	return 'INVALID';
}

/**
 * Resolve the runtime-active, non-archived school year through the single
 * published-schedule election authority so the base and explicit-year route
 * families agree for the same scope. An archived year is never elected current.
 */
async function resolveActiveSchoolYearId(schoolId: number): Promise<number | null> {
	return resolveActiveSchoolYearElection(schoolId);
}

router.get('/schools/:schoolId/schedules/published', async (req: Request, res: Response, next: NextFunction) => {
	try {
		const schoolId = positiveInt(req.params.schoolId, 'schoolId');
		if (typeof schoolId === 'string') {
			res.status(400).json({ code: 'INVALID_PARAM', message: schoolId });
			return;
		}

		// Resolve the current active school year from the EnrollPro mirror
		const activeMirrors = await db().enrollProSchoolYearMirror.findMany({
			where: { schoolId, isActive: true, isArchived: false },
			orderBy: [{ lastSyncedAt: 'desc' }, { updatedAt: 'desc' }],
			select: { enrollProSchoolYearId: true },
			take: 2,
		});

		if (activeMirrors.length === 0) {
			res.status(404).json({
				code: 'CURRENT_PUBLISHED_RUN_NOT_FOUND',
				message: 'No active school year is configured. Cannot resolve the current published schedule.',
				actionHint: 'Configure an active school year in EnrollPro settings before AIMS syncs.',
			});
			return;
		}
		if (activeMirrors.length > 1) {
			res.status(409).json({ code: 'ACTIVE_SCHOOL_YEAR_AMBIGUOUS', message: 'Multiple active school years are configured. Published schedule scope is ambiguous.' });
			return;
		}

		const activeSchoolYearId = activeMirrors[0].enrollProSchoolYearId;
		const scheduleOptions = readScheduleOptions(req);
		if (scheduleOptions.invalidTermIndex) {
			res.status(400).json({
				code: 'INVALID_TERM_INDEX',
				message: `termIndex must be 1..${MAX_ACADEMIC_TERM_INDEX}, or "active".`,
			});
			return;
		}
		try {
			const payload = await getPublishedSchedulePayload(schoolId, activeSchoolYearId, scheduleOptions);
			res.json(payload);
		} catch (serviceError: any) {
			// Transform PUBLISHED_RUN_NOT_FOUND into a current-year-specific message
			if (serviceError?.code === 'PUBLISHED_RUN_NOT_FOUND') {
				res.status(404).json({
					code: 'CURRENT_PUBLISHED_RUN_NOT_FOUND',
					message: `No published schedule is available for the current school year (${activeSchoolYearId}) yet.`,
					actionHint: 'Build Teaching Load, generate a timetable, and publish the current school-year schedule before AIMS syncs.',
				});
				return;
			}
			throw serviceError;
		}
	} catch (error) {
		next(error);
	}
});

router.get('/schools/:schoolId/schedules/published/sections/:sectionId', async (req: Request, res: Response, next: NextFunction) => {
	try {
		const schoolId = positiveInt(req.params.schoolId, 'schoolId');
		if (typeof schoolId === 'string') {
			res.status(400).json({ code: 'INVALID_PARAM', message: schoolId });
			return;
		}
		const sectionId = positiveInt(req.params.sectionId, 'sectionId');
		if (typeof sectionId === 'string') {
			res.status(400).json({ code: 'INVALID_PARAM', message: sectionId });
			return;
		}

		const activeSchoolYearId = await resolveActiveSchoolYearId(schoolId);
		if (!activeSchoolYearId) {
			res.status(404).json({
				code: 'CURRENT_PUBLISHED_RUN_NOT_FOUND',
				message: 'No active school year is configured. Cannot resolve the current published schedule.',
				actionHint: 'Configure an active school year in EnrollPro settings before AIMS syncs.',
			});
			return;
		}

		try {
			const payload = await getPublishedSectionSchedule(schoolId, sectionId, activeSchoolYearId, readScheduleOptions(req));
			res.json(payload);
		} catch (serviceError: any) {
			if (serviceError?.code === 'PUBLISHED_RUN_NOT_FOUND') {
				res.status(404).json({
					code: 'CURRENT_PUBLISHED_RUN_NOT_FOUND',
					message: `No published schedule is available for the current school year (${activeSchoolYearId}) yet.`,
					actionHint: 'Build Teaching Load, generate a timetable, and publish the current school-year schedule before AIMS syncs.',
				});
				return;
			}
			throw serviceError;
		}
	} catch (error) {
		next(error);
	}
});

router.get('/schools/:schoolId/schedules/published/faculty/:facultyId', async (req: Request, res: Response, next: NextFunction) => {
	try {
		const schoolId = positiveInt(req.params.schoolId, 'schoolId');
		if (typeof schoolId === 'string') {
			res.status(400).json({ code: 'INVALID_PARAM', message: schoolId });
			return;
		}
		const facultyId = positiveInt(req.params.facultyId, 'facultyId');
		if (typeof facultyId === 'string') {
			res.status(400).json({ code: 'INVALID_PARAM', message: facultyId });
			return;
		}

		const activeSchoolYearId = await resolveActiveSchoolYearId(schoolId);
		if (!activeSchoolYearId) {
			res.status(404).json({
				code: 'CURRENT_PUBLISHED_RUN_NOT_FOUND',
				message: 'No active school year is configured. Cannot resolve the current published schedule.',
				actionHint: 'Configure an active school year in EnrollPro settings before AIMS syncs.',
			});
			return;
		}

		try {
			const payload = await getPublishedFacultySchedule(schoolId, facultyId, activeSchoolYearId, readScheduleOptions(req));
			res.json(payload);
		} catch (serviceError: any) {
			if (serviceError?.code === 'PUBLISHED_RUN_NOT_FOUND') {
				res.status(404).json({
					code: 'CURRENT_PUBLISHED_RUN_NOT_FOUND',
					message: `No published schedule is available for the current school year (${activeSchoolYearId}) yet.`,
					actionHint: 'Build Teaching Load, generate a timetable, and publish the current school-year schedule before AIMS syncs.',
				});
				return;
			}
			throw serviceError;
		}
	} catch (error) {
		next(error);
	}
});

router.get('/schools/:schoolId/schedules/published/faculty-external/:externalFacultyId', async (req: Request, res: Response, next: NextFunction) => {
	try {
		const schoolId = positiveInt(req.params.schoolId, 'schoolId');
		if (typeof schoolId === 'string') {
			res.status(400).json({ code: 'INVALID_PARAM', message: schoolId });
			return;
		}
		const externalFacultyId = positiveInt(req.params.externalFacultyId, 'externalFacultyId');
		if (typeof externalFacultyId === 'string') {
			res.status(400).json({ code: 'INVALID_PARAM', message: externalFacultyId });
			return;
		}

		const activeSchoolYearId = await resolveActiveSchoolYearId(schoolId);
		if (!activeSchoolYearId) {
			res.status(404).json({
				code: 'CURRENT_PUBLISHED_RUN_NOT_FOUND',
				message: 'No active school year is configured. Cannot resolve the current published schedule.',
				actionHint: 'Configure an active school year in EnrollPro settings before AIMS syncs.',
			});
			return;
		}

		try {
			const payload = await getPublishedFacultyScheduleByExternalId(schoolId, externalFacultyId, activeSchoolYearId, readScheduleOptions(req));
			res.json(payload);
		} catch (serviceError: any) {
			if (serviceError?.code === 'FACULTY_NOT_FOUND') {
				res.status(404).json({
					code: 'FACULTY_NOT_FOUND',
					message: `No faculty member with external ID ${externalFacultyId} found for school ${schoolId}.`,
				});
				return;
			}
			if (serviceError?.code === 'PUBLISHED_RUN_NOT_FOUND') {
				res.status(404).json({
					code: 'CURRENT_PUBLISHED_RUN_NOT_FOUND',
					message: `No published schedule is available for the current school year (${activeSchoolYearId}) yet.`,
					actionHint: 'Build Teaching Load, generate a timetable, and publish the current school-year schedule before AIMS syncs.',
				});
				return;
			}
			throw serviceError;
		}
	} catch (error) {
		next(error);
	}
});

router.get('/schools/:schoolId/school-years/:schoolYearId/schedules/published/faculty-external/:externalFacultyId', async (req: Request, res: Response, next: NextFunction) => {
	try {
		const schoolId = positiveInt(req.params.schoolId, 'schoolId');
		if (typeof schoolId === 'string') { res.status(400).json({ code: 'INVALID_PARAM', message: schoolId }); return; }
		const schoolYearId = positiveInt(req.params.schoolYearId, 'schoolYearId');
		if (typeof schoolYearId === 'string') { res.status(400).json({ code: 'INVALID_PARAM', message: schoolYearId }); return; }
		const externalFacultyId = positiveInt(req.params.externalFacultyId, 'externalFacultyId');
		if (typeof externalFacultyId === 'string') { res.status(400).json({ code: 'INVALID_PARAM', message: externalFacultyId }); return; }

		try {
			// C08 — active/historical metadata is computed once by the published
			// schedule service from the single active-year election; route-local
			// overrides are removed so both families agree for the same scope.
			const payload = await getPublishedFacultyScheduleByExternalId(schoolId, externalFacultyId, schoolYearId, readScheduleOptions(req));
			res.json(payload);
		} catch (serviceError: any) {
			if (serviceError?.code === 'FACULTY_NOT_FOUND') {
				res.status(404).json({
					code: 'FACULTY_NOT_FOUND',
					message: `No faculty member with external ID ${externalFacultyId} found for school ${schoolId}.`,
				});
				return;
			}
			throw serviceError;
		}
	} catch (error) {
		next(error);
	}
});

router.get('/schools/:schoolId/schedules/published/rooms/:roomId', async (req: Request, res: Response, next: NextFunction) => {
	try {
		const schoolId = positiveInt(req.params.schoolId, 'schoolId');
		if (typeof schoolId === 'string') {
			res.status(400).json({ code: 'INVALID_PARAM', message: schoolId });
			return;
		}
		const roomId = positiveInt(req.params.roomId, 'roomId');
		if (typeof roomId === 'string') {
			res.status(400).json({ code: 'INVALID_PARAM', message: roomId });
			return;
		}

		const activeSchoolYearId = await resolveActiveSchoolYearId(schoolId);
		if (!activeSchoolYearId) {
			res.status(404).json({
				code: 'CURRENT_PUBLISHED_RUN_NOT_FOUND',
				message: 'No active school year is configured. Cannot resolve the current published schedule.',
				actionHint: 'Configure an active school year in EnrollPro settings before AIMS syncs.',
			});
			return;
		}

		try {
			const payload = await getPublishedRoomSchedule(schoolId, roomId, activeSchoolYearId, readScheduleOptions(req));
			res.json(payload);
		} catch (serviceError: any) {
			if (serviceError?.code === 'PUBLISHED_RUN_NOT_FOUND') {
				res.status(404).json({
					code: 'CURRENT_PUBLISHED_RUN_NOT_FOUND',
					message: `No published schedule is available for the current school year (${activeSchoolYearId}) yet.`,
					actionHint: 'Build Teaching Load, generate a timetable, and publish the current school-year schedule before AIMS syncs.',
				});
				return;
			}
			throw serviceError;
		}
	} catch (error) {
		next(error);
	}
});

// ─── Explicit school-year routes ───
// AIMS uses these to request current or historical schedules intentionally.

router.get('/schools/:schoolId/school-years/:schoolYearId/schedules/published', async (req: Request, res: Response, next: NextFunction) => {
	try {
		const schoolId = positiveInt(req.params.schoolId, 'schoolId');
		if (typeof schoolId === 'string') { res.status(400).json({ code: 'INVALID_PARAM', message: schoolId }); return; }
		const schoolYearId = positiveInt(req.params.schoolYearId, 'schoolYearId');
		if (typeof schoolYearId === 'string') { res.status(400).json({ code: 'INVALID_PARAM', message: schoolYearId }); return; }

		const activeSchoolYearId = await resolveActiveSchoolYearId(schoolId);
		const payload = await getPublishedSchedulePayload(schoolId, schoolYearId, readScheduleOptions(req), undefined, activeSchoolYearId);
		res.json(payload);
	} catch (error) {
		next(error);
	}
});

router.get('/schools/:schoolId/school-years/:schoolYearId/schedules/published/sections/:sectionId', async (req: Request, res: Response, next: NextFunction) => {
	try {
		const schoolId = positiveInt(req.params.schoolId, 'schoolId');
		if (typeof schoolId === 'string') { res.status(400).json({ code: 'INVALID_PARAM', message: schoolId }); return; }
		const schoolYearId = positiveInt(req.params.schoolYearId, 'schoolYearId');
		if (typeof schoolYearId === 'string') { res.status(400).json({ code: 'INVALID_PARAM', message: schoolYearId }); return; }
		const sectionId = positiveInt(req.params.sectionId, 'sectionId');
		if (typeof sectionId === 'string') { res.status(400).json({ code: 'INVALID_PARAM', message: sectionId }); return; }

		// C08 — active/historical metadata is computed once by the published
		// schedule service; no route-local override.
		const payload = await getPublishedSectionSchedule(schoolId, sectionId, schoolYearId, readScheduleOptions(req));
		res.json(payload);
	} catch (error) {
		next(error);
	}
});

router.get('/schools/:schoolId/school-years/:schoolYearId/schedules/published/faculty/:facultyId', async (req: Request, res: Response, next: NextFunction) => {
	try {
		const schoolId = positiveInt(req.params.schoolId, 'schoolId');
		if (typeof schoolId === 'string') { res.status(400).json({ code: 'INVALID_PARAM', message: schoolId }); return; }
		const schoolYearId = positiveInt(req.params.schoolYearId, 'schoolYearId');
		if (typeof schoolYearId === 'string') { res.status(400).json({ code: 'INVALID_PARAM', message: schoolYearId }); return; }
		const facultyId = positiveInt(req.params.facultyId, 'facultyId');
		if (typeof facultyId === 'string') { res.status(400).json({ code: 'INVALID_PARAM', message: facultyId }); return; }

		// C08 — active/historical metadata is computed once by the published
		// schedule service; no route-local override.
		const payload = await getPublishedFacultySchedule(schoolId, facultyId, schoolYearId, readScheduleOptions(req));
		res.json(payload);
	} catch (error) {
		next(error);
	}
});

router.get('/schools/:schoolId/school-years/:schoolYearId/schedules/published/rooms/:roomId', async (req: Request, res: Response, next: NextFunction) => {
	try {
		const schoolId = positiveInt(req.params.schoolId, 'schoolId');
		if (typeof schoolId === 'string') { res.status(400).json({ code: 'INVALID_PARAM', message: schoolId }); return; }
		const schoolYearId = positiveInt(req.params.schoolYearId, 'schoolYearId');
		if (typeof schoolYearId === 'string') { res.status(400).json({ code: 'INVALID_PARAM', message: schoolYearId }); return; }
		const roomId = positiveInt(req.params.roomId, 'roomId');
		if (typeof roomId === 'string') { res.status(400).json({ code: 'INVALID_PARAM', message: roomId }); return; }

		// C08 — active/historical metadata is computed once by the published
		// schedule service; no route-local override.
		const payload = await getPublishedRoomSchedule(schoolId, roomId, schoolYearId, readScheduleOptions(req));
		res.json(payload);
	} catch (error) {
		next(error);
	}
});

// ─── Term-scoped routes ───
// C08 (D6) — `/schools/:schoolId/schedules/published/:termId` and its
// `/sections`, `/faculty`, `/rooms` siblings treat the path segment as a TERM
// identity within the resolved published school year, NEVER as a `schoolYearId`
// alias. The published school year is the runtime-active one (identical to the
// base family); the term is resolved through the published run's frozen
// ordered-term contract, so an invalid/absent/out-of-contract term fails closed
// with a typed error.

type TermFamilyScope =
	| { ok: true; schoolYearId: number; options: { requestedDate?: string; termIndex: number } }
	| { ok: false; status: number; body: Record<string, unknown> };

async function resolveTermFamilyScope(schoolId: number, termId: number, req: Request): Promise<TermFamilyScope> {
	const scheduleOptions = readScheduleOptions(req);
	if (scheduleOptions.invalidTermIndex) {
		return {
			ok: false,
			status: 400,
			body: { code: 'INVALID_TERM_INDEX', message: `termIndex must be 1..${MAX_ACADEMIC_TERM_INDEX}, or "active".` },
		};
	}
	const activeSchoolYearId = await resolveActiveSchoolYearId(schoolId);
	if (!activeSchoolYearId) {
		return {
			ok: false,
			status: 404,
			body: {
				code: 'CURRENT_PUBLISHED_RUN_NOT_FOUND',
				message: 'No active school year is configured. Cannot resolve the current published schedule.',
				actionHint: 'Configure an active school year in EnrollPro settings before AIMS syncs.',
			},
		};
	}
	return { ok: true, schoolYearId: activeSchoolYearId, options: { requestedDate: scheduleOptions.requestedDate, termIndex: termId } };
}

router.get('/schools/:schoolId/schedules/published/:termId', async (req: Request, res: Response, next: NextFunction) => {
	try {
		const schoolId = positiveInt(req.params.schoolId, 'schoolId');
		if (typeof schoolId === 'string') {
			res.status(400).json({ code: 'INVALID_PARAM', message: schoolId });
			return;
		}
		const termId = readTermId(req);
		if (typeof termId === 'string') {
			res.status(400).json({ code: 'INVALID_PARAM', message: termId });
			return;
		}

		const scope = await resolveTermFamilyScope(schoolId, termId!, req);
		if (!scope.ok) { res.status(scope.status).json(scope.body); return; }
		const payload = await getPublishedSchedulePayload(schoolId, scope.schoolYearId, scope.options);
		res.json(payload);
	} catch (error) {
		next(error);
	}
});

router.get('/schools/:schoolId/schedules/published/:termId/sections/:sectionId', async (req: Request, res: Response, next: NextFunction) => {
	try {
		const schoolId = positiveInt(req.params.schoolId, 'schoolId');
		if (typeof schoolId === 'string') {
			res.status(400).json({ code: 'INVALID_PARAM', message: schoolId });
			return;
		}
		const termId = readTermId(req);
		if (typeof termId === 'string') {
			res.status(400).json({ code: 'INVALID_PARAM', message: termId });
			return;
		}
		const sectionId = positiveInt(req.params.sectionId, 'sectionId');
		if (typeof sectionId === 'string') {
			res.status(400).json({ code: 'INVALID_PARAM', message: sectionId });
			return;
		}

		const scope = await resolveTermFamilyScope(schoolId, termId!, req);
		if (!scope.ok) { res.status(scope.status).json(scope.body); return; }
		const payload = await getPublishedSchedulePayload(schoolId, scope.schoolYearId, scope.options, { sectionId });
		res.json(payload);
	} catch (error) {
		next(error);
	}
});

router.get('/schools/:schoolId/schedules/published/:termId/faculty/:facultyId', async (req: Request, res: Response, next: NextFunction) => {
	try {
		const schoolId = positiveInt(req.params.schoolId, 'schoolId');
		if (typeof schoolId === 'string') {
			res.status(400).json({ code: 'INVALID_PARAM', message: schoolId });
			return;
		}
		const termId = readTermId(req);
		if (typeof termId === 'string') {
			res.status(400).json({ code: 'INVALID_PARAM', message: termId });
			return;
		}
		const facultyId = positiveInt(req.params.facultyId, 'facultyId');
		if (typeof facultyId === 'string') {
			res.status(400).json({ code: 'INVALID_PARAM', message: facultyId });
			return;
		}

		const scope = await resolveTermFamilyScope(schoolId, termId!, req);
		if (!scope.ok) { res.status(scope.status).json(scope.body); return; }
		const payload = await getPublishedSchedulePayload(schoolId, scope.schoolYearId, scope.options, { facultyId });
		res.json(payload);
	} catch (error) {
		next(error);
	}
});

router.get('/schools/:schoolId/schedules/published/:termId/rooms/:roomId', async (req: Request, res: Response, next: NextFunction) => {
	try {
		const schoolId = positiveInt(req.params.schoolId, 'schoolId');
		if (typeof schoolId === 'string') {
			res.status(400).json({ code: 'INVALID_PARAM', message: schoolId });
			return;
		}
		const termId = readTermId(req);
		if (typeof termId === 'string') {
			res.status(400).json({ code: 'INVALID_PARAM', message: termId });
			return;
		}
		const roomId = positiveInt(req.params.roomId, 'roomId');
		if (typeof roomId === 'string') {
			res.status(400).json({ code: 'INVALID_PARAM', message: roomId });
			return;
		}

		const scope = await resolveTermFamilyScope(schoolId, termId!, req);
		if (!scope.ok) { res.status(scope.status).json(scope.body); return; }
		const payload = await getPublishedSchedulePayload(schoolId, scope.schoolYearId, scope.options, { roomId });
		res.json(payload);
	} catch (error) {
		next(error);
	}
});

// ─── SSE: published schedule events ───
// Faculty clients subscribe scoped to their own facultyId to see changes affecting them.
// Officer clients subscribe with facultyId=null to see all updates.
// Accepts accessToken query param for EventSource compatibility.

router.get(
	'/schools/:schoolId/:schoolYearId/schedules/published-events',
	async (req: Request, res: Response, next: NextFunction) => {
		try {
			const schoolId = positiveInt(req.params.schoolId, 'schoolId');
			if (typeof schoolId === 'string') { res.status(400).json({ code: 'INVALID_PARAM', message: schoolId }); return; }
			const schoolYearId = positiveInt(req.params.schoolYearId, 'schoolYearId');
			if (typeof schoolYearId === 'string') { res.status(400).json({ code: 'INVALID_PARAM', message: schoolYearId }); return; }

			// Auth: browser EventSource uses the ATLAS auth cookie; query token remains compatibility-only.
			const token = extractSseToken(req);
			if (!token) { res.status(401).json({ code: 'NO_TOKEN', message: 'Authentication required.' }); return; }

			const secret = process.env.JWT_SECRET;
			if (!secret) { res.status(500).json({ code: 'SERVER_ERROR', message: 'JWT secret not configured.' }); return; }
			let decoded: import('../middleware/authenticate.js').AuthPayload | null = null;
			try {
				decoded = jwt.verify(token, secret) as import('../middleware/authenticate.js').AuthPayload;
			} catch {
				res.status(401).json({ code: 'INVALID_TOKEN', message: 'Invalid or expired token.' });
				return;
			}
			if (!decoded) { res.status(401).json({ code: 'INVALID_TOKEN', message: 'Invalid token.' }); return; }

			// Determine scope: teacher users get filtered to their own events.
			const isPrivileged = decoded.role === 'admin' || decoded.role === 'officer' || decoded.role === 'SYSTEM_ADMIN';
			let scopeFacultyId: number | null = null;
			if (!isPrivileged) {
				const identity = await resolveCanonicalFacultyFromAuthPayload(
					{ ...decoded, authSource: decoded.authSource ?? 'local' },
					{ schoolId, schoolYearId },
				);
				if (!identity) {
					res.status(403).json({
						code: 'FORBIDDEN',
						message: 'Teacher profile mapping is required to subscribe to schedule updates.',
					});
					return;
				}
				scopeFacultyId = identity.faculty.id;
			}

			// Reconnect: replay missed events since Last-Event-ID
			const lastIdRaw = req.headers['last-event-id'] as string | undefined;
			const lastId = lastIdRaw ? parseInt(lastIdRaw, 10) : 0;

			res.setHeader('Content-Type', 'text/event-stream');
			res.setHeader('Cache-Control', 'no-cache, no-transform');
			res.setHeader('Connection', 'keep-alive');
			res.setHeader('X-Accel-Buffering', 'no');
			res.flushHeaders();
			attachSseErrorGuard(res);

			const send = (event: import('../services/published-schedule-events.service.js').PublishedScheduleEvent) => {
				sseWrite(res, `id: ${event.id}\nevent: published-schedule\ndata: ${JSON.stringify(event)}\n\n`);
			};

			// Replay missed events
			if (lastId > 0) {
				const missed = getPublishedScheduleEventsSince(lastId, { schoolId, schoolYearId, facultyId: scopeFacultyId });
				for (const ev of missed) send(ev);
			}

			const unsub = subscribePublishedScheduleEvents({ schoolId, schoolYearId, facultyId: scopeFacultyId, send });

			const heartbeat = setInterval(() => sseWrite(res, ': heartbeat\n\n'), 15_000);
			registerSseCleanup(req, res, () => { unsub(); clearInterval(heartbeat); });
		} catch (e) { next(e); }
	},
);

export default router;
