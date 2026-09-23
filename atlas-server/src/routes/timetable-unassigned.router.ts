import { Router } from 'express';
import type { Request, Response, NextFunction } from 'express';

import { authenticate } from '../middleware/authenticate.js';
import { assertRequestSchoolScope, requestHasCapability } from '../middleware/authorize.js';
import {
  summarizeUnassignedInsertionReadiness,
  previewUnassignedInsertion,
} from '../services/timetable-insertion.service.js';

const router = Router();

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

function assertPrivilegedAndScoped(req: Request, res: Response, schoolId: number): boolean {
	if (!requestHasCapability(req, 'timetable:review')) {
		res.status(403).json({ code: 'FORBIDDEN', message: 'Timetable review capability is required.' });
    return false;
  }
	return assertRequestSchoolScope(req, res, schoolId);
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
