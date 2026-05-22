import { Router } from 'express';
import type { NextFunction, Request, Response } from 'express';

import { authenticate } from '../middleware/authenticate.js';
import { prisma } from '../lib/prisma.js';
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

		const userId = req.user?.userId;
		if (!userId) {
			res.status(401).json({ code: 'NO_USER', message: 'Authenticated user required.' });
			return;
		}

		const faculty = await prisma.facultyMirror.findFirst({
			where: {
				schoolId,
				externalId: userId,
			},
			select: {
				id: true,
				firstName: true,
				lastName: true,
			},
		});
		if (!faculty) {
			res.status(403).json({ code: 'FORBIDDEN', message: 'Faculty profile mapping is required for My Portal.' });
			return;
		}

		const authToken = req.headers.authorization?.slice(7);
		const dashboard = await getFacultyPortalDashboard({ schoolId, schoolYearId, facultyId: faculty.id, authToken });
		res.json({
			faculty: {
				id: faculty.id,
				name: `${faculty.lastName}, ${faculty.firstName}`,
			},
			...dashboard,
		});
	} catch (error) {
		next(error);
	}
});

export default router;
