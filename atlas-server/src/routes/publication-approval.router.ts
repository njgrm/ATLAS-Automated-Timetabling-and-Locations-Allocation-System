import { Router } from 'express';
import type { NextFunction, Request, Response } from 'express';

import { authenticate } from '../middleware/authenticate.js';
import { requestHasCapability } from '../middleware/authorize.js';
import { approvePublicationRequest, listPendingPublicationApprovals, requestPublicationApproval } from '../services/publication-approval.service.js';

const router = Router();
const positiveId = (value: unknown): number | null => {
	const parsed = typeof value === 'number' ? value : Number(value);
	return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : null;
};

function scopeFrom(req: Request) {
	const schoolId = positiveId(req.params.schoolId);
	const schoolYearId = positiveId(req.params.schoolYearId);
	const runId = positiveId(req.params.runId);
	const actorId = positiveId(req.user?.userId);
	const actorSchoolId = positiveId(req.user?.schoolId);
	if (schoolId === null || schoolYearId === null || runId === null || actorId === null || actorSchoolId === null || schoolId !== actorSchoolId) return null;
	return { schoolId, schoolYearId, runId, actorId, actorSchoolId };
}

router.get('/:schoolId/:schoolYearId/requests', authenticate, async (req: Request, res: Response, next: NextFunction) => {
	if (!requestHasCapability(req, 'timetable:approve-publication')) {
		res.status(403).json({ code: 'FORBIDDEN', message: 'This endpoint requires publication approval capability.' });
		return;
	}
	const schoolId = positiveId(req.params.schoolId);
	const schoolYearId = positiveId(req.params.schoolYearId);
	const actorSchoolId = positiveId(req.user?.schoolId);
	if (schoolId === null || schoolYearId === null || actorSchoolId !== schoolId) {
		res.status(403).json({ code: 'APPROVAL_SCOPE_MISMATCH', message: 'Pending approvals must be within the authenticated school scope.' });
		return;
	}
	try {
		res.json({ requests: await listPendingPublicationApprovals({ schoolId, schoolYearId, actorSchoolId }) });
	} catch (error) { next(error); }
});

router.post('/:schoolId/:schoolYearId/runs/:runId/requests', authenticate, async (req: Request, res: Response, next: NextFunction) => {
	if (!requestHasCapability(req, 'timetable:request-publication')) {
		res.status(403).json({ code: 'FORBIDDEN', message: 'This endpoint requires publication request capability.' });
		return;
	}
	const scope = scopeFrom(req);
	if (!scope) { res.status(403).json({ code: 'APPROVAL_SCOPE_MISMATCH', message: 'The request must be within the authenticated school scope.' }); return; }
	try {
		res.status(201).json({ request: await requestPublicationApproval({ ...scope, acknowledgeSoftViolations: req.body?.acknowledgeSoftViolations === true }) });
	} catch (error) { next(error); }
});

router.post('/:schoolId/:schoolYearId/runs/:runId/requests/:requestId/approve', authenticate, async (req: Request, res: Response, next: NextFunction) => {
	if (!requestHasCapability(req, 'timetable:approve-publication')) {
		res.status(403).json({ code: 'FORBIDDEN', message: 'This endpoint requires publication approval capability.' });
		return;
	}
	const scope = scopeFrom(req);
	const requestId = positiveId(req.params.requestId);
	if (!scope || requestId === null) { res.status(403).json({ code: 'APPROVAL_SCOPE_MISMATCH', message: 'A valid request must be within the authenticated school scope.' }); return; }
	try {
		const result = await approvePublicationRequest({ ...scope, requestId, acknowledgeSoftViolations: req.body?.acknowledgeSoftViolations === true });
		res.json({ run: result.run, publication: { revisionId: result.revisionId, auditId: result.auditId, replayed: result.replayed, notificationDelivery: result.notificationDelivery } });
	} catch (error) { next(error); }
});

export default router;
