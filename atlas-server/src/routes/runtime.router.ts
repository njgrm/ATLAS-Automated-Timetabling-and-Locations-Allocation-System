import { Router } from 'express';
import type { Request, Response, NextFunction } from 'express';
import { authenticateWithSystemToken } from '../middleware/authenticate.js';
import { resolveRuntimeContext } from '../services/runtime-context.service.js';

const router = Router();

router.get('/context', authenticateWithSystemToken, async (req: Request, res: Response, next: NextFunction) => {
	try {
		const schoolId = Number(req.query.schoolId ?? 1);
		if (!Number.isInteger(schoolId) || schoolId <= 0) {
			res.status(400).json({ code: 'INVALID_PARAM', message: 'schoolId query parameter must be a positive integer.' });
			return;
		}

		const authToken = req.headers.authorization?.slice(7);
		const upstreamAuthToken = req.user?.authSource === 'system' ? undefined : authToken;
		const context = await resolveRuntimeContext(schoolId, upstreamAuthToken);

		if (!context) {
			res.status(404).json({
				code: 'NO_RUNTIME_CONTEXT',
				message: 'No ATLAS runtime context is available yet for this school. Run at least one successful sync first.',
				schoolId,
			});
			return;
		}

		res.json(context);
	} catch (err) {
		next(err);
	}
});

export default router;