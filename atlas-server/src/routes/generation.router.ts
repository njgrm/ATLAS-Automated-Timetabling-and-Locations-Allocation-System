import { Router } from 'express';
import type { Request, Response, NextFunction } from 'express';
import { authenticate } from '../middleware/authenticate.js';
import { getUpstreamAuthToken } from '../middleware/upstream-auth.js';
import * as genService from '../services/generation.service.js';
import { buildGenerationReadiness } from '../services/generation-readiness.service.js';
import { resolveRequestedTermIndex, parseSupportedTermIndex, MAX_ACADEMIC_TERM_INDEX } from '../services/academic-term.service.js';
import { resolvePublishedRunTermIndex } from '../services/published-schedule.service.js';
import { getFixSuggestions } from '../services/fix-suggestions.service.js';
import { exportSummaryWorkbook, exportClassProgramWorkbook, resolveExportSchoolYearLabel } from '../services/workbook-export.service.js';
import { exportRoomProgramWorkbook } from '../services/room-program-export.service.js';
import { buildTeacherProgramExportShape } from '../services/teacher-program-export.service.js';
import {
	EXPORT_PRESENTATION_SCHEMA_UNAVAILABLE_CODE,
	EXPORT_PRESENTATION_SCHEMA_UNAVAILABLE_MESSAGE,
} from '../services/export-presentation.service.js';
import { generateTeacherProgramDocx } from '../services/docx-export.service.js';
import { generateClassProgramMatrix, validateSpecializationVisibility } from '../services/class-program-matrix.service.js';

const router = Router();

// ─── Helpers ───

const PRIVILEGED_ROLES: Set<string> = new Set(['admin', 'officer', 'SYSTEM_ADMIN']);

function positiveInt(raw: unknown, name: string): number | string {
	const n = Number(raw);
	if (!Number.isInteger(n) || n < 1) return `${name} must be a positive integer.`;
	return n;
}

function actorSchoolId(req: Request): number | null {
	const schoolId = Number(req.user?.schoolId);
	return Number.isInteger(schoolId) && schoolId > 0 ? schoolId : null;
}

/**
 * GEN-C02R Correction 3: bind privileged generation/readiness actions to the
 * authenticated actor's school. `SYSTEM_ADMIN` is not an implicit cross-school
 * bypass. Returns true when the route may proceed; otherwise it has already
 * written the typed 403 response and the caller must return before any service
 * invocation (zero reads/writes/service calls for rejected scope).
 */
function assertActorSchoolScope(req: Request, res: Response, schoolId: number): boolean {
	const actorSchool = actorSchoolId(req);
	if (actorSchool === null) {
		res.status(403).json({ code: 'SCHOOL_SCOPE_REQUIRED', message: 'Authenticated school scope is required for generation actions.' });
		return false;
	}
	if (actorSchool !== schoolId) {
		res.status(403).json({ code: 'CROSS_SCHOOL_DENIED', message: 'Cannot run generation actions for another school.' });
		return false;
	}
	return true;
}

type RequiredTermParse =
	| { ok: true; requested: number | 'active' }
	| { ok: false; code: string; message: string };

/**
 * BENEFICIARY-EXPORT-PARITY-C05 T9/M18 — one filename identity for official
 * outputs: `<type>[-<entity>]-SY<year>-term<N>.<ext>`. The client mirrors this
 * exact shape; the year token degrades to SY-UNLABELED when no persisted label
 * exists rather than fabricating a school year.
 */
function exportFileStem(kind: string, entity: string | null, yearLabel: string, termIndex: number): string {
	const year = yearLabel.length > 0 ? `SY${yearLabel.replace(/[^a-zA-Z0-9-]/g, '')}` : 'SY-UNLABELED';
	const entityPart = entity ? `-${entity.replace(/[^a-zA-Z0-9]/g, '_')}` : '';
	return `${kind}${entityPart}-${year}-term${termIndex}`;
}

/**
 * BENEFICIARY-EXPORT-PARITY-C05 T1/M1 — official outputs are selected-term
 * documents. An absent `termIndex` fails closed at the transport boundary with
 * a typed 4xx (zero file bytes) instead of silently serving a mixed all-term
 * document. `active` resolution and explicit-index contract validation remain
 * owned by `resolveRequestedTermIndex`; this helper only enforces presence and
 * syntax, and must never be imposed on non-export consumers of the resolver.
 */
function parseRequiredTermQuery(raw: unknown): RequiredTermParse {
	if (raw == null || String(raw).trim() === '') {
		return {
			ok: false,
			code: 'TERM_INDEX_REQUIRED',
			message: 'termIndex is required for official exports; provide a numeric term (1..N) or "active".',
		};
	}
	const value = String(raw).trim().toLowerCase();
	if (value === 'active') return { ok: true, requested: 'active' };
	const parsed = parseSupportedTermIndex(value);
	if (parsed === null) {
		return { ok: false, code: 'INVALID_TERM_INDEX', message: `termIndex must be 1..${MAX_ACADEMIC_TERM_INDEX}, or "active".` };
	}
	return { ok: true, requested: parsed };
}

// ─── POST /:schoolId/:schoolYearId/runs — trigger generation run ───

router.post(
	'/:schoolId/:schoolYearId/runs',
	authenticate,
	async (req: Request, res: Response, next: NextFunction) => {
		try {
			const role = req.user?.role;
			if (!role || !PRIVILEGED_ROLES.has(role)) {
				res.status(403).json({ code: 'FORBIDDEN', message: 'Only admin, officer, or SYSTEM_ADMIN can trigger generation runs.' });
				return;
			}

			const schoolId = positiveInt(req.params.schoolId, 'schoolId');
			if (typeof schoolId === 'string') { res.status(400).json({ code: 'INVALID_PARAM', message: schoolId }); return; }
			const schoolYearId = positiveInt(req.params.schoolYearId, 'schoolYearId');
			if (typeof schoolYearId === 'string') { res.status(400).json({ code: 'INVALID_PARAM', message: schoolYearId }); return; }

			const actorId = req.user?.userId;
			if (!actorId) { res.status(401).json({ code: 'NO_USER', message: 'Authenticated user required.' }); return; }
			if (!assertActorSchoolScope(req, res, schoolId)) return;
			const ignoreRoomRequestGate = req.body?.ignoreRoomRequestGate === true;
			const enforceShiftWindows = req.body?.enforceShiftWindows === true;
			const roomerStrategy = req.body?.roomerStrategy ?? 'HOME_ROOM_FIRST';
			if (roomerStrategy !== undefined && roomerStrategy !== 'UNIVERSAL' && roomerStrategy !== 'HOME_ROOM_FIRST') {
				res.status(400).json({ code: 'INVALID_PARAM', message: 'roomerStrategy must be UNIVERSAL or HOME_ROOM_FIRST when provided.' });
				return;
			}
			const authToken = getUpstreamAuthToken(req);

			const run = await genService.triggerGenerationRun(schoolId, schoolYearId, actorId, {
				ignoreRoomRequestGate,
				enforceShiftWindows,
				roomerStrategy,
				authToken,
			});
			res.status(201).json({ run });
		} catch (e) { next(e); }
	},
);

// ─── GET /:schoolId/:schoolYearId/readiness/diagnostic — zero-write canonical readiness ───

router.get(
	'/:schoolId/:schoolYearId/readiness/diagnostic',
	authenticate,
	async (req: Request, res: Response, next: NextFunction) => {
		try {
			const role = req.user?.role;
			if (!role || !PRIVILEGED_ROLES.has(role)) {
				res.status(403).json({ code: 'FORBIDDEN', message: 'Only admin, officer, or SYSTEM_ADMIN can run the generation readiness diagnostic.' });
				return;
			}

			const schoolId = positiveInt(req.params.schoolId, 'schoolId');
			if (typeof schoolId === 'string') { res.status(400).json({ code: 'INVALID_PARAM', message: schoolId }); return; }
			const schoolYearId = positiveInt(req.params.schoolYearId, 'schoolYearId');
			if (typeof schoolYearId === 'string') { res.status(400).json({ code: 'INVALID_PARAM', message: schoolYearId }); return; }

			if (!assertActorSchoolScope(req, res, schoolId)) return;

			const enforceShiftWindows = req.query.enforceShiftWindows === 'true';
			const readiness = await buildGenerationReadiness(schoolId, schoolYearId, { enforceShiftWindows });
			res.status(200).json({ readiness });
		} catch (e) { next(e); }
	},
);

// â”€â”€â”€ Performance verification fixture (privileged, reversible) â”€â”€â”€

router.get(
	'/:schoolId/:schoolYearId/runs/performance-fixture-source',
	authenticate,
	async (req: Request, res: Response, next: NextFunction) => {
		try {
			const role = req.user?.role;
			if (!role || !PRIVILEGED_ROLES.has(role)) {
				res.status(403).json({ code: 'FORBIDDEN', message: 'Only admin, officer, or SYSTEM_ADMIN can select performance fixtures.' });
				return;
			}
			const schoolId = positiveInt(req.params.schoolId, 'schoolId');
			const schoolYearId = positiveInt(req.params.schoolYearId, 'schoolYearId');
			if (typeof schoolId === 'string' || typeof schoolYearId === 'string') {
				res.status(400).json({ code: 'INVALID_PARAM', message: typeof schoolId === 'string' ? schoolId : schoolYearId });
				return;
			}
			res.json({ source: await genService.getPerformanceFixtureSource(schoolId, schoolYearId) });
		} catch (e) { next(e); }
	},
);

router.post(
	'/:schoolId/:schoolYearId/runs/:runId/performance-fixture',
	authenticate,
	async (req: Request, res: Response, next: NextFunction) => {
		try {
			const role = req.user?.role;
			if (!role || !PRIVILEGED_ROLES.has(role)) {
				res.status(403).json({ code: 'FORBIDDEN', message: 'Only admin, officer, or SYSTEM_ADMIN can create performance fixtures.' });
				return;
			}
			const schoolId = positiveInt(req.params.schoolId, 'schoolId');
			const schoolYearId = positiveInt(req.params.schoolYearId, 'schoolYearId');
			const runId = positiveInt(req.params.runId, 'runId');
			if (typeof schoolId === 'string' || typeof schoolYearId === 'string' || typeof runId === 'string') {
				res.status(400).json({ code: 'INVALID_PARAM', message: [schoolId, schoolYearId, runId].find((value) => typeof value === 'string') });
				return;
			}
			const actorId = req.user?.userId;
			if (!actorId) { res.status(401).json({ code: 'NO_USER', message: 'Authenticated user required.' }); return; }
			const purpose = req.body?.purpose === 'TEACHER_DEPARTURE' ? 'TEACHER_DEPARTURE' : 'PERFORMANCE';
			const fixture = await genService.createPerformanceFixture(runId, schoolId, schoolYearId, actorId, { purpose });
			res.status(201).json({ fixture });
		} catch (e) { next(e); }
	},
);

router.delete(
	'/:schoolId/:schoolYearId/runs/:runId/performance-fixture',
	authenticate,
	async (req: Request, res: Response, next: NextFunction) => {
		try {
			const role = req.user?.role;
			if (!role || !PRIVILEGED_ROLES.has(role)) {
				res.status(403).json({ code: 'FORBIDDEN', message: 'Only admin, officer, or SYSTEM_ADMIN can delete performance fixtures.' });
				return;
			}
			const schoolId = positiveInt(req.params.schoolId, 'schoolId');
			const schoolYearId = positiveInt(req.params.schoolYearId, 'schoolYearId');
			const runId = positiveInt(req.params.runId, 'runId');
			if (typeof schoolId === 'string' || typeof schoolYearId === 'string' || typeof runId === 'string') {
				res.status(400).json({ code: 'INVALID_PARAM', message: [schoolId, schoolYearId, runId].find((value) => typeof value === 'string') });
				return;
			}
			const actorId = req.user?.userId;
			if (!actorId) { res.status(401).json({ code: 'NO_USER', message: 'Authenticated user required.' }); return; }
			const result = await genService.deletePerformanceFixture(runId, schoolId, schoolYearId, actorId);
			res.json(result);
		} catch (e) { next(e); }
	},
);

router.post(
	'/:schoolId/:schoolYearId/runs/:runId/publish',
	authenticate,
	async (req: Request, res: Response, next: NextFunction) => {
		try {
			const role = req.user?.role;
			if (!role || !PRIVILEGED_ROLES.has(role)) {
				res.status(403).json({ code: 'FORBIDDEN', message: 'Only admin, officer, or SYSTEM_ADMIN can publish timetable runs.' });
				return;
			}

			const schoolId = positiveInt(req.params.schoolId, 'schoolId');
			if (typeof schoolId === 'string') { res.status(400).json({ code: 'INVALID_PARAM', message: schoolId }); return; }
			const schoolYearId = positiveInt(req.params.schoolYearId, 'schoolYearId');
			if (typeof schoolYearId === 'string') { res.status(400).json({ code: 'INVALID_PARAM', message: schoolYearId }); return; }
			const runId = positiveInt(req.params.runId, 'runId');
			if (typeof runId === 'string') { res.status(400).json({ code: 'INVALID_PARAM', message: runId }); return; }

			const actorId = req.user?.userId;
			if (!actorId) { res.status(401).json({ code: 'NO_USER', message: 'Authenticated user required.' }); return; }
			const actorSchoolId = req.user?.schoolId;
			if (!actorSchoolId) { res.status(403).json({ code: 'ACTOR_SCHOOL_UNRESOLVED', message: 'Publication requires an authenticated school scope.' }); return; }
			if (actorSchoolId !== schoolId) { res.status(403).json({ code: 'CROSS_SCHOOL_DENIED', message: 'The authenticated actor cannot publish another school\'s schedule.' }); return; }
			const acknowledgeSoftViolations = req.body?.acknowledgeSoftViolations === true;

			const result = await genService.publishRun(schoolId, schoolYearId, runId, actorId, {
				acknowledgeSoftViolations,
				actorSchoolId,
			});
			res.json({
				run: result.run,
				publication: {
					revisionId: result.revisionId,
					auditId: result.auditId,
					replayed: result.replayed,
					notificationDelivery: result.notificationDelivery,
				},
			});
		} catch (e) { next(e); }
	},
);

router.get(
	'/:schoolId/:schoolYearId/runs/gate',
	authenticate,
	async (req: Request, res: Response, next: NextFunction) => {
		try {
			const role = req.user?.role;
			if (!role || !PRIVILEGED_ROLES.has(role)) {
				res.status(403).json({ code: 'FORBIDDEN', message: 'Only admin, officer, or SYSTEM_ADMIN can view generation gate status.' });
				return;
			}

			const schoolId = positiveInt(req.params.schoolId, 'schoolId');
			if (typeof schoolId === 'string') { res.status(400).json({ code: 'INVALID_PARAM', message: schoolId }); return; }
			const schoolYearId = positiveInt(req.params.schoolYearId, 'schoolYearId');
			if (typeof schoolYearId === 'string') { res.status(400).json({ code: 'INVALID_PARAM', message: schoolYearId }); return; }

			const gate = await genService.getGenerationRoomRequestGateStatus(schoolId, schoolYearId);
			res.json(gate);
		} catch (e) { next(e); }
	},
);

// ─── GET /:schoolId/:schoolYearId/runs/latest — latest run ───

router.get(
	'/:schoolId/:schoolYearId/runs/latest',
	authenticate,
	async (req: Request, res: Response, next: NextFunction) => {
		try {
			const role = req.user?.role;
			if (!role || !PRIVILEGED_ROLES.has(role)) {
				res.status(403).json({ code: 'FORBIDDEN', message: 'Only admin, officer, or SYSTEM_ADMIN can view generation runs.' });
				return;
			}

			const schoolId = positiveInt(req.params.schoolId, 'schoolId');
			if (typeof schoolId === 'string') { res.status(400).json({ code: 'INVALID_PARAM', message: schoolId }); return; }
			const schoolYearId = positiveInt(req.params.schoolYearId, 'schoolYearId');
			if (typeof schoolYearId === 'string') { res.status(400).json({ code: 'INVALID_PARAM', message: schoolYearId }); return; }

			const run = await genService.getLatestRun(schoolId, schoolYearId);
			res.json({ run });
		} catch (e) { next(e); }
	},
);

// ─── GET /:schoolId/:schoolYearId/runs/latest/violations — latest run violations ───

router.get(
	'/:schoolId/:schoolYearId/runs/latest/violations',
	authenticate,
	async (req: Request, res: Response, next: NextFunction) => {
		try {
			const role = req.user?.role;
			if (!role || !PRIVILEGED_ROLES.has(role)) {
				res.status(403).json({ code: 'FORBIDDEN', message: 'Only admin, officer, or SYSTEM_ADMIN can view violation reports.' });
				return;
			}

			const schoolId = positiveInt(req.params.schoolId, 'schoolId');
			if (typeof schoolId === 'string') { res.status(400).json({ code: 'INVALID_PARAM', message: schoolId }); return; }
			const schoolYearId = positiveInt(req.params.schoolYearId, 'schoolYearId');
			if (typeof schoolYearId === 'string') { res.status(400).json({ code: 'INVALID_PARAM', message: schoolYearId }); return; }
			if (!assertActorSchoolScope(req, res, schoolId)) return;
			const termIndexRaw = req.query.termIndex;
			let termIndex: number | undefined;
			if (termIndexRaw !== undefined) {
				const parsedTermIndex = parseSupportedTermIndex(termIndexRaw);
				if (parsedTermIndex === null) {
					res.status(400).json({ code: 'INVALID_PARAM', message: `termIndex must be 1..${MAX_ACADEMIC_TERM_INDEX} when provided.` });
					return;
				}
				termIndex = parsedTermIndex;
			}

			const report = await genService.getLatestRunViolations(schoolId, schoolYearId, termIndex);
			res.json(report);
		} catch (e) { next(e); }
	},
);

// ─── GET /:schoolId/:schoolYearId/runs/latest/draft — latest run draft entries ───

router.get(
	'/:schoolId/:schoolYearId/runs/latest/draft',
	authenticate,
	async (req: Request, res: Response, next: NextFunction) => {
		try {
			const role = req.user?.role;
			if (!role || !PRIVILEGED_ROLES.has(role)) {
				res.status(403).json({ code: 'FORBIDDEN', message: 'Only admin, officer, or SYSTEM_ADMIN can view draft entries.' });
				return;
			}

			const schoolId = positiveInt(req.params.schoolId, 'schoolId');
			if (typeof schoolId === 'string') { res.status(400).json({ code: 'INVALID_PARAM', message: schoolId }); return; }
			const schoolYearId = positiveInt(req.params.schoolYearId, 'schoolYearId');
			if (typeof schoolYearId === 'string') { res.status(400).json({ code: 'INVALID_PARAM', message: schoolYearId }); return; }

			const report = await genService.getLatestRunDraft(schoolId, schoolYearId);
			res.json(report);
		} catch (e) { next(e); }
	},
);

// ─── GET /:schoolId/:schoolYearId/runs/latest/timetable — latest timetable alias ───

router.get(
	'/:schoolId/:schoolYearId/runs/latest/timetable',
	authenticate,
	async (req: Request, res: Response, next: NextFunction) => {
		try {
			const role = req.user?.role;
			if (!role || !PRIVILEGED_ROLES.has(role)) {
				res.status(403).json({ code: 'FORBIDDEN', message: 'Only admin, officer, or SYSTEM_ADMIN can view timetable entries.' });
				return;
			}

			const schoolId = positiveInt(req.params.schoolId, 'schoolId');
			if (typeof schoolId === 'string') { res.status(400).json({ code: 'INVALID_PARAM', message: schoolId }); return; }
			const schoolYearId = positiveInt(req.params.schoolYearId, 'schoolYearId');
			if (typeof schoolYearId === 'string') { res.status(400).json({ code: 'INVALID_PARAM', message: schoolYearId }); return; }

			const report = await genService.getLatestRunDraft(schoolId, schoolYearId);
			res.json(report);
		} catch (e) { next(e); }
	},
);

// ─── GET /:schoolId/:schoolYearId/runs/:runId — run details ───

router.get(
	'/:schoolId/:schoolYearId/runs/:runId',
	authenticate,
	async (req: Request, res: Response, next: NextFunction) => {
		try {
			const role = req.user?.role;
			if (!role || !PRIVILEGED_ROLES.has(role)) {
				res.status(403).json({ code: 'FORBIDDEN', message: 'Only admin, officer, or SYSTEM_ADMIN can view generation runs.' });
				return;
			}

			const schoolId = positiveInt(req.params.schoolId, 'schoolId');
			if (typeof schoolId === 'string') { res.status(400).json({ code: 'INVALID_PARAM', message: schoolId }); return; }
			const schoolYearId = positiveInt(req.params.schoolYearId, 'schoolYearId');
			if (typeof schoolYearId === 'string') { res.status(400).json({ code: 'INVALID_PARAM', message: schoolYearId }); return; }
			const runId = positiveInt(req.params.runId, 'runId');
			if (typeof runId === 'string') { res.status(400).json({ code: 'INVALID_PARAM', message: runId }); return; }

			const run = await genService.getRunById(runId, schoolId, schoolYearId);
			res.json({ run });
		} catch (e) { next(e); }
	},
);

// ─── GET /:schoolId/:schoolYearId/runs/:runId/violations — run violations ───

router.get(
	'/:schoolId/:schoolYearId/runs/:runId/violations',
	authenticate,
	async (req: Request, res: Response, next: NextFunction) => {
		try {
			const role = req.user?.role;
			if (!role || !PRIVILEGED_ROLES.has(role)) {
				res.status(403).json({ code: 'FORBIDDEN', message: 'Only admin, officer, or SYSTEM_ADMIN can view violation reports.' });
				return;
			}

			const schoolId = positiveInt(req.params.schoolId, 'schoolId');
			if (typeof schoolId === 'string') { res.status(400).json({ code: 'INVALID_PARAM', message: schoolId }); return; }
			const schoolYearId = positiveInt(req.params.schoolYearId, 'schoolYearId');
			if (typeof schoolYearId === 'string') { res.status(400).json({ code: 'INVALID_PARAM', message: schoolYearId }); return; }
			const runId = positiveInt(req.params.runId, 'runId');
			if (typeof runId === 'string') { res.status(400).json({ code: 'INVALID_PARAM', message: runId }); return; }
			if (!assertActorSchoolScope(req, res, schoolId)) return;
			const termIndexRaw = req.query.termIndex;
			let termIndex: number | undefined;
			if (termIndexRaw !== undefined) {
				const parsedTermIndex = parseSupportedTermIndex(termIndexRaw);
				if (parsedTermIndex === null) {
					res.status(400).json({ code: 'INVALID_PARAM', message: `termIndex must be 1..${MAX_ACADEMIC_TERM_INDEX} when provided.` });
					return;
				}
				termIndex = parsedTermIndex;
			}

			const report = await genService.getRunViolations(runId, schoolId, schoolYearId, termIndex);
			res.json(report);
		} catch (e) { next(e); }
	},
);

// ─── GET /:schoolId/:schoolYearId/runs/:runId/draft — run draft entries ───

router.get(
	'/:schoolId/:schoolYearId/runs/:runId/draft',
	authenticate,
	async (req: Request, res: Response, next: NextFunction) => {
		try {
			const role = req.user?.role;
			if (!role || !PRIVILEGED_ROLES.has(role)) {
				res.status(403).json({ code: 'FORBIDDEN', message: 'Only admin, officer, or SYSTEM_ADMIN can view draft entries.' });
				return;
			}

			const schoolId = positiveInt(req.params.schoolId, 'schoolId');
			if (typeof schoolId === 'string') { res.status(400).json({ code: 'INVALID_PARAM', message: schoolId }); return; }
			const schoolYearId = positiveInt(req.params.schoolYearId, 'schoolYearId');
			if (typeof schoolYearId === 'string') { res.status(400).json({ code: 'INVALID_PARAM', message: schoolYearId }); return; }
			const runId = positiveInt(req.params.runId, 'runId');
			if (typeof runId === 'string') { res.status(400).json({ code: 'INVALID_PARAM', message: runId }); return; }

			const report = await genService.getRunDraft(runId, schoolId, schoolYearId);
			res.json(report);
		} catch (e) { next(e); }
	},
);

// ─── GET /:schoolId/:schoolYearId/runs/:runId/timetable — run timetable alias ───

router.get(
	'/:schoolId/:schoolYearId/runs/:runId/timetable',
	authenticate,
	async (req: Request, res: Response, next: NextFunction) => {
		try {
			const role = req.user?.role;
			if (!role || !PRIVILEGED_ROLES.has(role)) {
				res.status(403).json({ code: 'FORBIDDEN', message: 'Only admin, officer, or SYSTEM_ADMIN can view timetable entries.' });
				return;
			}

			const schoolId = positiveInt(req.params.schoolId, 'schoolId');
			if (typeof schoolId === 'string') { res.status(400).json({ code: 'INVALID_PARAM', message: schoolId }); return; }
			const schoolYearId = positiveInt(req.params.schoolYearId, 'schoolYearId');
			if (typeof schoolYearId === 'string') { res.status(400).json({ code: 'INVALID_PARAM', message: schoolYearId }); return; }
			const runId = positiveInt(req.params.runId, 'runId');
			if (typeof runId === 'string') { res.status(400).json({ code: 'INVALID_PARAM', message: runId }); return; }

			const report = await genService.getRunDraft(runId, schoolId, schoolYearId);
			res.json(report);
		} catch (e) { next(e); }
	},
);

// ─── GET /:schoolId/:schoolYearId/runs — run history ───

router.get(
	'/:schoolId/:schoolYearId/runs',
	authenticate,
	async (req: Request, res: Response, next: NextFunction) => {
		try {
			const role = req.user?.role;
			if (!role || !PRIVILEGED_ROLES.has(role)) {
				res.status(403).json({ code: 'FORBIDDEN', message: 'Only admin, officer, or SYSTEM_ADMIN can view generation runs.' });
				return;
			}

			const schoolId = positiveInt(req.params.schoolId, 'schoolId');
			if (typeof schoolId === 'string') { res.status(400).json({ code: 'INVALID_PARAM', message: schoolId }); return; }
			const schoolYearId = positiveInt(req.params.schoolYearId, 'schoolYearId');
			if (typeof schoolYearId === 'string') { res.status(400).json({ code: 'INVALID_PARAM', message: schoolYearId }); return; }

			const limitRaw = req.query.limit;
			let limit = 20;
			if (limitRaw !== undefined) {
				const parsed = Number(limitRaw);
				if (!Number.isInteger(parsed) || parsed < 1 || parsed > 100) {
					res.status(400).json({ code: 'INVALID_PARAM', message: 'limit must be an integer between 1 and 100.' });
					return;
				}
				limit = parsed;
			}

			const { runs, activePublishedRunId } = await genService.listRuns(schoolId, schoolYearId, limit);
			// TIMETABLE-TRUTHFULNESS-C01 (D1) — each run now carries
			// `summary.isPublished`, and the response names the runtime-active
			// publication (`activePublishedRunId`) so a consumer can tell a
			// published run from an unpublished one from the list alone.
			res.json({ runs, count: runs.length, activePublishedRunId });
		} catch (e) { next(e); }
	},
);

// ─── POST /:schoolId/:schoolYearId/runs/:runId/fix-suggestions — get fix suggestions for an unassigned item ───

router.post(
	'/:schoolId/:schoolYearId/runs/:runId/fix-suggestions',
	authenticate,
	async (req: Request, res: Response, next: NextFunction) => {
		try {
			const role = req.user?.role;
			if (!role || !PRIVILEGED_ROLES.has(role)) {
				res.status(403).json({ code: 'FORBIDDEN', message: 'Only admin, officer, or SYSTEM_ADMIN can request fix suggestions.' });
				return;
			}

			const schoolId = positiveInt(req.params.schoolId, 'schoolId');
			if (typeof schoolId === 'string') { res.status(400).json({ code: 'INVALID_PARAM', message: schoolId }); return; }
			const schoolYearId = positiveInt(req.params.schoolYearId, 'schoolYearId');
			if (typeof schoolYearId === 'string') { res.status(400).json({ code: 'INVALID_PARAM', message: schoolYearId }); return; }
			const runId = positiveInt(req.params.runId, 'runId');
			if (typeof runId === 'string') { res.status(400).json({ code: 'INVALID_PARAM', message: runId }); return; }

			const {
				sectionId,
				subjectId,
				gradeLevel,
				session,
				reason,
				entryKind,
				programType,
				programCode,
				programName,
				cohortCode,
				cohortName,
				cohortMemberSectionIds,
				cohortExpectedEnrollment,
				adviserId,
				adviserName,
			} = req.body;
			const validReasons = ['NO_QUALIFIED_FACULTY', 'FACULTY_OVERLOADED', 'NO_AVAILABLE_SLOT', 'NO_COMPATIBLE_ROOM'];
			if (!sectionId || !subjectId || !reason || !validReasons.includes(reason)) {
				res.status(400).json({ code: 'INVALID_BODY', message: 'sectionId, subjectId, session, gradeLevel, and a valid reason are required.' });
				return;
			}

			const result = await getFixSuggestions(schoolId, schoolYearId, runId, {
				sectionId: Number(sectionId),
				subjectId: Number(subjectId),
				gradeLevel: Number(gradeLevel) || 0,
				session: Number(session) || 1,
				reason,
				entryKind: entryKind === 'COHORT' ? 'COHORT' : 'SECTION',
				programType: typeof programType === 'string' ? programType : null,
				programCode: typeof programCode === 'string' ? programCode : null,
				programName: typeof programName === 'string' ? programName : null,
				cohortCode: typeof cohortCode === 'string' ? cohortCode : null,
				cohortName: typeof cohortName === 'string' ? cohortName : null,
				cohortMemberSectionIds: Array.isArray(cohortMemberSectionIds)
					? cohortMemberSectionIds.map((value) => Number(value)).filter((value) => Number.isInteger(value) && value > 0)
					: undefined,
				cohortExpectedEnrollment: Number.isFinite(Number(cohortExpectedEnrollment)) ? Number(cohortExpectedEnrollment) : null,
				adviserId: Number.isFinite(Number(adviserId)) ? Number(adviserId) : null,
				adviserName: typeof adviserName === 'string' ? adviserName : null,
			});

			res.json(result);
		} catch (e) { next(e); }
	},
);

// ─── GET /:schoolId/:schoolYearId/runs/:runId/export/summary-teacher-schedule.xlsx — export summary workbook ───

router.get(
	'/:schoolId/:schoolYearId/runs/:runId/export/summary-teacher-schedule.xlsx',
	authenticate,
	async (req: Request, res: Response, next: NextFunction) => {
		try {
			const role = req.user?.role;
			if (!role || !PRIVILEGED_ROLES.has(role)) {
				res.status(403).json({ code: 'FORBIDDEN', message: 'Only admin, officer, or SYSTEM_ADMIN can export workbooks.' });
				return;
			}

			const schoolId = positiveInt(req.params.schoolId, 'schoolId');
			if (typeof schoolId === 'string') { res.status(400).json({ code: 'INVALID_PARAM', message: schoolId }); return; }
			const schoolYearId = positiveInt(req.params.schoolYearId, 'schoolYearId');
			if (typeof schoolYearId === 'string') { res.status(400).json({ code: 'INVALID_PARAM', message: schoolYearId }); return; }
			const runId = positiveInt(req.params.runId, 'runId');
			if (typeof runId === 'string') { res.status(400).json({ code: 'INVALID_PARAM', message: runId }); return; }
			if (!assertActorSchoolScope(req, res, schoolId)) return;

			const termParse = parseRequiredTermQuery(req.query.termIndex);
			if (!termParse.ok) {
				res.status(400).json({ code: termParse.code, message: termParse.message });
				return;
			}
			// C08 (D5) — a published run resolves its export term through the FROZEN
			// ordered-term contract; a draft/unpublished run keeps live authority.
			const termIndex = await resolvePublishedRunTermIndex(schoolId, schoolYearId, runId, termParse.requested);

			const buffer = await exportSummaryWorkbook({ schoolId, schoolYearId, runId, termIndex });
			const resolvedTerm = termIndex as number;
			const yearLabel = await resolveExportSchoolYearLabel(schoolId, schoolYearId);
			res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
			res.setHeader('Content-Disposition', `attachment; filename="${exportFileStem('summary-teacher-schedule', null, yearLabel, resolvedTerm)}.xlsx"`);
			res.send(buffer);
		} catch (e: any) {
			if (e?.message === 'RUN_NOT_FOUND') {
				res.status(404).json({ code: 'RUN_NOT_FOUND', message: 'Generation run not found.' });
				return;
			}
			if (e?.message === 'RUN_NOT_COMPLETED') {
				res.status(422).json({ code: 'RUN_NOT_COMPLETED', message: 'Only completed or published runs can be exported.' });
				return;
			}
			// C05 M16 — an empty selected-term renderable set never emits a
			// header-only official file.
			if (e?.code === 'EMPTY_SELECTED_TERM' || e?.message === 'EMPTY_SELECTED_TERM') {
				res.status(422).json({ code: 'EMPTY_SELECTED_TERM', message: 'The selected term has no renderable entries for this run; no official file was produced.' });
				return;
			}
			if (e?.code === 'TERM_FILTER_NOT_READY' || e?.message === 'TERM_FILTER_NOT_READY') {
				res.status(501).json({ code: 'TERM_FILTER_NOT_READY', message: 'Active term cannot be verified from the persisted EnrollPro term authority.' });
				return;
			}
			// Preserve the typed ordered-term authority errors (e.g.
			// TERM_INDEX_OUTSIDE_CONTRACT / TERM_STRUCTURE_UNAVAILABLE) as JSON
			// instead of leaking a generic HTML error response.
			if (typeof e?.statusCode === 'number' && typeof e?.code === 'string') {
				res.status(e.statusCode).json({ code: e.code, message: e.message });
				return;
			}
			next(e);
		}
	},
);

// ─── GET /:schoolId/:schoolYearId/runs/:runId/export/class-program.xlsx — export class-program workbook ───

router.get(
	'/:schoolId/:schoolYearId/runs/:runId/export/class-program.xlsx',
	authenticate,
	async (req: Request, res: Response, next: NextFunction) => {
		try {
			const role = req.user?.role;
			if (!role || !PRIVILEGED_ROLES.has(role)) {
				res.status(403).json({ code: 'FORBIDDEN', message: 'Only admin, officer, or SYSTEM_ADMIN can export workbooks.' });
				return;
			}

			const schoolId = positiveInt(req.params.schoolId, 'schoolId');
			if (typeof schoolId === 'string') { res.status(400).json({ code: 'INVALID_PARAM', message: schoolId }); return; }
			const schoolYearId = positiveInt(req.params.schoolYearId, 'schoolYearId');
			if (typeof schoolYearId === 'string') { res.status(400).json({ code: 'INVALID_PARAM', message: schoolYearId }); return; }
			const runId = positiveInt(req.params.runId, 'runId');
			if (typeof runId === 'string') { res.status(400).json({ code: 'INVALID_PARAM', message: runId }); return; }
			if (!assertActorSchoolScope(req, res, schoolId)) return;

			const termParse = parseRequiredTermQuery(req.query.termIndex);
			if (!termParse.ok) {
				res.status(400).json({ code: termParse.code, message: termParse.message });
				return;
			}
			// C08 (D5) — a published run resolves its export term through the FROZEN
			// ordered-term contract; a draft/unpublished run keeps live authority.
			const termIndex = await resolvePublishedRunTermIndex(schoolId, schoolYearId, runId, termParse.requested);

			const specializationVisibilityRaw = req.query.specializationVisibility as string | undefined;
			let specializationVisibility: 'hidden' | 'visible' | undefined;
			if (specializationVisibilityRaw != null) {
				const val = specializationVisibilityRaw.toLowerCase().trim();
				if (val === 'hidden' || val === 'visible') {
					specializationVisibility = val;
				} else {
					res.status(400).json({ code: 'INVALID_SPECIALIZATION_VISIBILITY', message: 'specializationVisibility must be "hidden" or "visible".' });
					return;
				}
			}

			const buffer = await exportClassProgramWorkbook({ schoolId, schoolYearId, runId, termIndex, specializationVisibility });
			const resolvedTerm = termIndex as number;
			const yearLabel = await resolveExportSchoolYearLabel(schoolId, schoolYearId);
			res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
			res.setHeader('Content-Disposition', `attachment; filename="${exportFileStem('class-program', null, yearLabel, resolvedTerm)}.xlsx"`);
			res.send(buffer);
		} catch (e: any) {
			if (e?.message === 'RUN_NOT_FOUND') {
				res.status(404).json({ code: 'RUN_NOT_FOUND', message: 'Generation run not found.' });
				return;
			}
			if (e?.message === 'RUN_NOT_COMPLETED') {
				res.status(422).json({ code: 'RUN_NOT_COMPLETED', message: 'Only completed or published runs can be exported.' });
				return;
			}
			// C05 M16 — an empty selected-term renderable set never emits a
			// header-only official file.
			if (e?.code === 'EMPTY_SELECTED_TERM' || e?.message === 'EMPTY_SELECTED_TERM') {
				res.status(422).json({ code: 'EMPTY_SELECTED_TERM', message: 'The selected term has no renderable entries for this run; no official file was produced.' });
				return;
			}
			if (e?.code === 'TERM_FILTER_NOT_READY' || e?.message === 'TERM_FILTER_NOT_READY') {
				res.status(501).json({ code: 'TERM_FILTER_NOT_READY', message: 'Active term cannot be verified from the persisted EnrollPro term authority.' });
				return;
			}
			// Preserve the typed ordered-term authority errors (e.g.
			// TERM_INDEX_OUTSIDE_CONTRACT / TERM_STRUCTURE_UNAVAILABLE) as JSON
			// instead of leaking a generic HTML error response.
			if (typeof e?.statusCode === 'number' && typeof e?.code === 'string') {
				res.status(e.statusCode).json({ code: e.code, message: e.message });
				return;
			}
			next(e);
		}
	},
);

// ─── GET /:schoolId/:schoolYearId/runs/:runId/export/teacher-program.docx ───

router.get(
	'/:schoolId/:schoolYearId/runs/:runId/export/teacher-program.docx',
	authenticate,
	async (req: Request, res: Response, next: NextFunction) => {
		try {
			const role = req.user?.role;
			if (!role || !PRIVILEGED_ROLES.has(role)) {
				res.status(403).json({ code: 'FORBIDDEN', message: 'Only admin, officer, or SYSTEM_ADMIN can export teacher programs.' });
				return;
			}

			const schoolId = positiveInt(req.params.schoolId, 'schoolId');
			if (typeof schoolId === 'string') { res.status(400).json({ code: 'INVALID_PARAM', message: schoolId }); return; }
			const schoolYearId = positiveInt(req.params.schoolYearId, 'schoolYearId');
			if (typeof schoolYearId === 'string') { res.status(400).json({ code: 'INVALID_PARAM', message: schoolYearId }); return; }
			const runId = positiveInt(req.params.runId, 'runId');
			if (typeof runId === 'string') { res.status(400).json({ code: 'INVALID_PARAM', message: runId }); return; }
			const facultyId = positiveInt(req.query.facultyId, 'facultyId');
			if (typeof facultyId === 'string') { res.status(400).json({ code: 'INVALID_PARAM', message: facultyId }); return; }
			if (!assertActorSchoolScope(req, res, schoolId)) return;

			const termParse = parseRequiredTermQuery(req.query.termIndex);
			if (!termParse.ok) {
				res.status(400).json({ code: termParse.code, message: termParse.message });
				return;
			}
			// C08 (D5) — a published run resolves its export term through the FROZEN
			// ordered-term contract; a draft/unpublished run keeps live authority.
			const termIndex = await resolvePublishedRunTermIndex(schoolId, schoolYearId, runId, termParse.requested);

			const shape = await buildTeacherProgramExportShape({
				schoolId,
				schoolYearId,
				runId,
				facultyId,
				termIndex,
			});

			const docxBuffer = await generateTeacherProgramDocx(shape);

			const resolvedTerm = termIndex as number;
			res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
			// T9/M18 — entity token is the faculty id so the client filename
			// (which knows the id, not necessarily the display name) is identical.
			res.setHeader('Content-Disposition', `attachment; filename="${exportFileStem('teacher-program', String(facultyId), shape.schoolYear.label, resolvedTerm)}.docx"`);
			res.send(docxBuffer);
		} catch (e: any) {
			if (e?.message === 'FACULTY_NOT_FOUND') {
				res.status(404).json({ code: 'FACULTY_NOT_FOUND', message: 'Faculty member not found.' });
				return;
			}
			if (e?.message === 'RUN_NOT_FOUND') {
				res.status(404).json({ code: 'RUN_NOT_FOUND', message: 'Generation run not found.' });
				return;
			}
			if (e?.message === 'RUN_NOT_COMPLETED') {
				res.status(422).json({ code: 'RUN_NOT_COMPLETED', message: 'Only completed or published runs can be exported.' });
				return;
			}
			// C05 M16 — an empty selected-term renderable set never emits a
			// header-only official file.
			if (e?.code === 'EMPTY_SELECTED_TERM' || e?.message === 'EMPTY_SELECTED_TERM') {
				res.status(422).json({ code: 'EMPTY_SELECTED_TERM', message: 'The selected term has no renderable entries for this run; no official file was produced.' });
				return;
			}
			if (e?.code === 'TERM_FILTER_NOT_READY' || e?.message === 'TERM_FILTER_NOT_READY') {
				res.status(501).json({ code: 'TERM_FILTER_NOT_READY', message: 'Term filtering is unavailable because the run has no verified ordered-term identity.' });
				return;
			}
			// EXPORT-PRESENTATION-SCHEMA-GUARD-C06B — the teacher-program
			// presentation store lives in migration 0003, which may not be applied
			// on this deployment. Fail closed with the one typed, non-leaking body
			// (and zero document bytes) instead of the generic Prisma 500 leak.
			if (e?.code === EXPORT_PRESENTATION_SCHEMA_UNAVAILABLE_CODE) {
				res.status(503).json({
					code: EXPORT_PRESENTATION_SCHEMA_UNAVAILABLE_CODE,
					message: EXPORT_PRESENTATION_SCHEMA_UNAVAILABLE_MESSAGE,
				});
				return;
			}
			// Preserve typed ordered-term authority errors as JSON.
			if (typeof e?.statusCode === 'number' && typeof e?.code === 'string') {
				res.status(e.statusCode).json({ code: e.code, message: e.message });
				return;
			}
			// Published schedule resolution errors from getPublishedFacultySchedule
			if (e?.code === 'PUBLISHED_RUN_NOT_FOUND') {
				res.status(404).json({ code: 'PUBLISHED_RUN_NOT_FOUND', message: 'No published schedule is available for export.' });
				return;
			}
			if (e?.statusCode === 404 && e?.code) {
				res.status(404).json({ code: e.code, message: e.message ?? 'Published schedule resolution failed.' });
				return;
			}
			next(e);
		}
	},
);

// ─── GET /:schoolId/:schoolYearId/runs/:runId/export/room-program.xlsx ───

router.get(
	'/:schoolId/:schoolYearId/runs/:runId/export/room-program.xlsx',
	authenticate,
	async (req: Request, res: Response, next: NextFunction) => {
		try {
			const role = req.user?.role;
			if (!role || !PRIVILEGED_ROLES.has(role)) {
				res.status(403).json({ code: 'FORBIDDEN', message: 'Only admin, officer, or SYSTEM_ADMIN can export room programs.' });
				return;
			}

			const schoolId = positiveInt(req.params.schoolId, 'schoolId');
			if (typeof schoolId === 'string') { res.status(400).json({ code: 'INVALID_PARAM', message: schoolId }); return; }
			const schoolYearId = positiveInt(req.params.schoolYearId, 'schoolYearId');
			if (typeof schoolYearId === 'string') { res.status(400).json({ code: 'INVALID_PARAM', message: schoolYearId }); return; }
			const runId = positiveInt(req.params.runId, 'runId');
			if (typeof runId === 'string') { res.status(400).json({ code: 'INVALID_PARAM', message: runId }); return; }
			if (!assertActorSchoolScope(req, res, schoolId)) return;

			// T1/M1 — official outputs are selected-term documents; absent term fails
			// closed with zero bytes.
			const termParse = parseRequiredTermQuery(req.query.termIndex);
			if (!termParse.ok) {
				res.status(400).json({ code: termParse.code, message: termParse.message });
				return;
			}
			// C08 (D5) — a published run resolves its export term through the FROZEN
			// ordered-term contract; a draft/unpublished run keeps live authority.
			const termIndex = await resolvePublishedRunTermIndex(schoolId, schoolYearId, runId, termParse.requested);

			// T7 — optional room scope; omit = every room with entries.
			let scopedRoomId: number | undefined;
			const roomIdRaw = req.query.roomId;
			if (roomIdRaw != null && String(roomIdRaw).trim() !== '') {
				const parsedRoomId = positiveInt(roomIdRaw, 'roomId');
				if (typeof parsedRoomId === 'string') { res.status(400).json({ code: 'INVALID_PARAM', message: parsedRoomId }); return; }
				scopedRoomId = parsedRoomId;
			}

			const buffer = await exportRoomProgramWorkbook({ schoolId, schoolYearId, runId, termIndex, roomId: scopedRoomId });

			const resolvedTerm = termIndex as number;
			const yearLabel = await resolveExportSchoolYearLabel(schoolId, schoolYearId);
			// The entity token is the numeric room id (or ALL), so the client — which
			// knows the id but not the server's sanitized name — emits the identical
			// filename (T9/M18).
			const entityToken = scopedRoomId != null ? String(scopedRoomId) : 'ALL';
			res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
			res.setHeader('Content-Disposition', `attachment; filename="${exportFileStem('room-program', entityToken, yearLabel, resolvedTerm)}.xlsx"`);
			res.send(buffer);
		} catch (e: any) {
			if (e?.message === 'RUN_NOT_FOUND') {
				res.status(404).json({ code: 'RUN_NOT_FOUND', message: 'Generation run not found.' });
				return;
			}
			if (e?.message === 'RUN_NOT_COMPLETED') {
				res.status(422).json({ code: 'RUN_NOT_COMPLETED', message: 'Only completed or published runs can be exported.' });
				return;
			}
			if (e?.message === 'ROOM_NOT_FOUND') {
				res.status(404).json({ code: 'ROOM_NOT_FOUND', message: 'Room not found for this school.' });
				return;
			}
			if (e?.message === 'EMPTY_ROOM_SCHEDULE') {
				res.status(422).json({ code: 'EMPTY_ROOM_SCHEDULE', message: 'The requested room has no entries in the selected term.' });
				return;
			}
			if (e?.code === 'TERM_FILTER_NOT_READY' || e?.message === 'TERM_FILTER_NOT_READY') {
				res.status(501).json({ code: 'TERM_FILTER_NOT_READY', message: 'Term filtering is unavailable because the run has no verified ordered-term identity.' });
				return;
			}
			if (typeof e?.statusCode === 'number' && typeof e?.code === 'string') {
				res.status(e.statusCode).json({ code: e.code, message: e.message });
				return;
			}
			next(e);
		}
	},
);

// ─── GET /:schoolId/:schoolYearId/class-program-matrix — grade-level class-program output ───

router.get(
	'/:schoolId/:schoolYearId/class-program-matrix',
	authenticate,
	async (req: Request, res: Response, next: NextFunction) => {
		try {
			const role = req.user?.role;
			if (!role || !PRIVILEGED_ROLES.has(role)) {
				res.status(403).json({ code: 'FORBIDDEN', message: 'Only admin, officer, or SYSTEM_ADMIN can access class-program matrix.' });
				return;
			}

			const schoolId = positiveInt(req.params.schoolId, 'schoolId');
			if (typeof schoolId === 'string') { res.status(400).json({ code: 'INVALID_PARAM', message: schoolId }); return; }
			const schoolYearId = positiveInt(req.params.schoolYearId, 'schoolYearId');
			if (typeof schoolYearId === 'string') { res.status(400).json({ code: 'INVALID_PARAM', message: schoolYearId }); return; }

			if (!assertActorSchoolScope(req, res, schoolId)) return;

			const gradeLevel = positiveInt(req.query.gradeLevel, 'gradeLevel');
			if (typeof gradeLevel === 'string') { res.status(400).json({ code: 'INVALID_GRADE_LEVEL', message: 'gradeLevel must be a positive integer (7, 8, 9, or 10).' }); return; }
			if (gradeLevel < 7 || gradeLevel > 10) {
				res.status(400).json({ code: 'INVALID_GRADE_LEVEL', message: 'gradeLevel must be 7, 8, 9, or 10.' });
				return;
			}

			const visibility = validateSpecializationVisibility(req.query.specializationVisibility as string | undefined);
			if (visibility === null) {
				res.status(400).json({ code: 'INVALID_SPECIALIZATION_VISIBILITY', message: 'specializationVisibility must be "hidden" or "visible".' });
				return;
			}

			// Bind the requested/effective source run and ordered term exactly like
			// the reviewed workbook route. An absent runId resolves the latest
			// completed run; an absent termIndex is rejected by
			// `parseRequiredTermQuery` below with a typed `TERM_INDEX_REQUIRED`
			// (official outputs are selected-term documents — never all-term).
			let runId: number | undefined;
			if (req.query.runId != null) {
				const parsedRunId = positiveInt(req.query.runId, 'runId');
				if (typeof parsedRunId === 'string') { res.status(400).json({ code: 'INVALID_PARAM', message: parsedRunId }); return; }
				runId = parsedRunId;
			}
			const termParse = parseRequiredTermQuery(req.query.termIndex);
			if (!termParse.ok) {
				res.status(400).json({ code: termParse.code, message: termParse.message });
				return;
			}
			// C08 (D5) — a published run resolves its export term through the FROZEN
			// ordered-term contract; a draft/unpublished (or not-yet-bound) run keeps
			// live verified authority.
			const termIndex = runId != null
				? await resolvePublishedRunTermIndex(schoolId, schoolYearId, runId, termParse.requested)
				: await resolveRequestedTermIndex(schoolId, schoolYearId, termParse.requested);

			const matrix = await generateClassProgramMatrix({
				schoolId,
				schoolYearId,
				gradeLevel,
				visibility,
				runId,
				termIndex,
			});

			res.json({ data: matrix });
		} catch (e: any) {
			if (e?.message === 'RUN_NOT_FOUND') {
				res.status(404).json({ code: 'RUN_NOT_FOUND', message: 'Generation run not found.' });
				return;
			}
			if (e?.message === 'RUN_NOT_COMPLETED') {
				res.status(422).json({ code: 'RUN_NOT_COMPLETED', message: 'Only completed or published runs can be exported.' });
				return;
			}
			if (e?.message === 'NO_SOURCE_RUN') {
				res.status(409).json({ code: 'NO_SOURCE_RUN', message: 'No completed source run is available for the requested grade and term.' });
				return;
			}
			if (e?.message === 'EMPTY_SOURCE_RUN') {
				res.status(422).json({ code: 'EMPTY_SOURCE_RUN', message: 'The source run has no entries for the requested grade and term.' });
				return;
			}
			if (e?.code === 'TERM_FILTER_NOT_READY' || e?.message === 'TERM_FILTER_NOT_READY') {
				res.status(501).json({ code: 'TERM_FILTER_NOT_READY', message: 'Term filtering is unavailable because the run has no verified ordered-term identity.' });
				return;
			}
			// Preserve typed ordered-term authority errors as JSON.
			if (typeof e?.statusCode === 'number' && typeof e?.code === 'string') {
				res.status(e.statusCode).json({ code: e.code, message: e.message });
				return;
			}
			next(e);
		}
	},
);

export default router;
