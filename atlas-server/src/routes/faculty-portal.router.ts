import { Router } from 'express';
import type { NextFunction, Request, Response } from 'express';

import { authenticate } from '../middleware/authenticate.js';
import { getUpstreamAuthToken } from '../middleware/upstream-auth.js';
import { resolveCanonicalFacultyFromAuthPayload } from '../services/faculty-identity.service.js';
import { getFacultyPortalDashboard } from '../services/faculty-portal.service.js';

const router = Router();

function positiveInt(raw: unknown, name: string): number | string {
	const parsed = Number(raw);
	if (!Number.isInteger(parsed) || parsed < 1) return `${name} must be a positive integer.`;
	return parsed;
}

router.get('/:schoolId/:schoolYearId/dashboard', authenticate, async (req: Request, res: Response, next: NextFunction) => {
	try {
		const schoolId = positiveInt(req.params.schoolId, 'schoolId');
		if (typeof schoolId === 'string') {
			res.status(400).json({ code: 'INVALID_PARAM', message: schoolId });
			return;
		}
		const schoolYearId = positiveInt(req.params.schoolYearId, 'schoolYearId');
		if (typeof schoolYearId === 'string') {
			res.status(400).json({ code: 'INVALID_PARAM', message: schoolYearId });
			return;
		}

		const identity = await resolveCanonicalFacultyFromAuthPayload(req.user, { schoolId, schoolYearId });
		if (!identity) {
			res.status(403).json({ code: 'FORBIDDEN', message: 'Faculty profile mapping is required for My Portal.' });
			return;
		}

		const authToken = getUpstreamAuthToken(req);
		const dashboard = await getFacultyPortalDashboard({ schoolId, schoolYearId, facultyId: identity.faculty.id, authToken });
		res.json({
			faculty: {
				id: identity.faculty.id,
				externalId: identity.faculty.externalId,
				employeeId: identity.faculty.employeeId,
				name: `${identity.faculty.lastName}, ${identity.faculty.firstName}`,
			},
			...dashboard,
		});
	} catch (error) {
		next(error);
	}
});

export default router;
