import { Router } from 'express';
import { authenticate } from '../middleware/authenticate.js';
const router = Router();
// Verify bridge token and return decoded identity
router.get('/me', authenticate, (req, res) => {
    res.json({
        user: {
            userId: req.user.userId,
            role: req.user.role,
        },
    });
});
export default router;
//# sourceMappingURL=auth.router.js.map