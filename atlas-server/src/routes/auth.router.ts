import { Router } from 'express';
import type { Request, Response } from 'express';
import { authenticate } from '../middleware/authenticate.js';

const router = Router();

// Verify bridge token and return decoded identity
router.get('/me', authenticate, (req: Request, res: Response) => {
	res.json({
		user: {
			userId: req.user!.userId,
			role: req.user!.role,
		},
	});
});

export default router;
