import { Router } from 'express';
import type { Request, Response, NextFunction } from 'express';

import { authenticate } from '../middleware/authenticate.js';
import {
  summarizeUnassignedInsertionReadiness,
  previewUnassignedInsertion,
} from '../services/timetable-insertion.service.js';

const router = Router();
const PRIVILEGED_ROLES: Set<string> = new Set(['admin', 'officer', 'SYSTEM_ADMIN']);

function positiveInt(raw: unknown, name: string): number | string {
  const n = Number(raw);
  if (!Number.isInteger(n) || n < 1) return `${name} must be a positive integer.`;
  return n;
}

function parseScope(params: Record<string, string>): { schoolId: number; schoolYearId: number } | string {
  const schoolId = positiveInt(params.schoolId, 'schoolId');
  if (typeof schoolId === 'string') return schoolId;
  const schoolYearId = positiveInt(params.schoolYearId, 'schoolYearId');
  if (typeof schoolYearId === 'string') return schoolYearId;
  return { schoolId, schoolYearId };
}

function actorSchoolId(req: Request): number | null {
  const schoolId = Number(req.user?.schoolId);
  return Number.isInteger(schoolId) && schoolId > 0 ? schoolId : null;
}

function assertPrivilegedAndScoped(req: Request, res: Response, schoolId: number): boolean {
  const role = req.user?.role;
  if (!role || !PRIVILEGED_ROLES.has(role)) {
    res.status(403).json({ code: 'FORBIDDEN', message: 'Only admin, officer, or SYSTEM_ADMIN can view unassigned insertion readiness.' });
    return false;
  }
  const actorSchool = actorSchoolId(req);
  if (actorSchool === null) {
    res.status(403).json({ code: 'SCHOOL_SCOPE_REQUIRED', message: 'Authenticated school scope is required.' });
    return false;
  }
  if (actorSchool !== schoolId) {
    res.status(403).json({ code: 'CROSS_SCHOOL_DENIED', message: 'Cannot read another school\u2019s unassigned insertion state.' });
    return false;
  }
  return true;
}

router.get(
  '/:schoolId/:schoolYearId/unassigned-workflow/summary',
  authenticate,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const scope = parseScope(req.params as Record<string, string>);
      if (typeof scope === 'string') {
        res.status(400).json({ code: 'INVALID_PARAM', message: scope });
        return;
      }
      if (!assertPrivilegedAndScoped(req, res, scope.schoolId)) return;
      const result = await summarizeUnassignedInsertionReadiness(scope.schoolId, scope.schoolYearId);
      res.json(result);
    } catch (e) {
      next(e);
    }
  },
);

router.post(
  '/:schoolId/:schoolYearId/unassigned-workflow/preview',
  authenticate,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const scope = parseScope(req.params as Record<string, string>);
      if (typeof scope === 'string') {
        res.status(400).json({ code: 'INVALID_PARAM', message: scope });
        return;
      }
      if (!assertPrivilegedAndScoped(req, res, scope.schoolId)) return;
      const demandKey = typeof req.body?.demandKey === 'string' ? req.body.demandKey : '';
      if (!demandKey) {
        res.status(400).json({ code: 'INVALID_PARAM', message: 'demandKey is required.' });
        return;
      }
      const result = await previewUnassignedInsertion(scope.schoolId, scope.schoolYearId, demandKey);
      res.json(result);
    } catch (e) {
      next(e);
    }
  },
);

export default router;
