import { Router } from 'express';
import type { NextFunction, Request, Response } from 'express';

import { authenticate } from '../middleware/authenticate.js';
import { requestHasCapability } from '../middleware/authorize.js';
import { prisma } from '../lib/prisma.js';
import { issueCollaborationTicket } from '../services/timetable-collaboration-ticket.service.js';

const router = Router();
const isPositiveId = (value: unknown): value is number => Number.isSafeInteger(value) && (value as number) > 0;

router.post('/ticket', authenticate, (req: Request, res: Response, next: NextFunction) => {
	if (!requestHasCapability(req, 'timetable:read') && !requestHasCapability(req, 'faculty:self-service')) {
		res.status(403).json({ code: 'FORBIDDEN', message: 'This endpoint requires timetable read or faculty self-service capability.' });
		return;
	}
	next();
}, async (req: Request, res: Response, next: NextFunction) => {
	try {
		const { schoolId, schoolYearId, runId } = req.body ?? {};
		if (!isPositiveId(schoolId) || !isPositiveId(schoolYearId) || !isPositiveId(runId)) {
			res.status(400).json({ code: 'INVALID_SCOPE', message: 'schoolId, schoolYearId, and runId must be positive integer JSON numbers.' });
			return;
		}
		const actor = req.user;
		if (!actor || actor.schoolId !== schoolId) {
			res.status(403).json({ code: 'SCHOOL_SCOPE_MISMATCH', message: 'The requested school is outside the authenticated actor scope.' });
			return;
		}
		const run = await prisma.generationRun.findFirst({
			where: { id: runId, schoolId, schoolYearId },
			select: { id: true },
		});
		if (!run) {
			res.status(404).json({ code: 'RUN_NOT_FOUND', message: 'Run was not found in this school/year scope.' });
			return;
		}
		const issued = issueCollaborationTicket({
			userId: actor.userId,
			role: actor.role,
			schoolId,
			displayName: actor.accountName ?? null,
			capabilities: actor.capabilities ?? [],
		}, { schoolId, schoolYearId, runId });
		res.status(201).json(issued);
	} catch (error) {
		next(error);
	}
});

export default router;
