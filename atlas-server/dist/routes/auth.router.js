import { Router } from 'express';
import { authenticate } from '../middleware/authenticate.js';
import { loginWithEmailPassword } from '../services/local-auth.service.js';
const router = Router();
router.post('/login', async (req, res, next) => {
    try {
        const email = typeof req.body?.email === 'string' ? req.body.email : '';
        const password = typeof req.body?.password === 'string' ? req.body.password : '';
        const result = await loginWithEmailPassword({
            email,
            password,
            ipAddress: req.ip || 'unknown',
            userAgent: req.get('user-agent') ?? undefined,
        });
        if (!result.ok) {
            if (result.retryAfterSeconds) {
                res.setHeader('Retry-After', String(result.retryAfterSeconds));
            }
            res.status(result.status).json({
                code: result.code,
                message: result.message,
            });
            return;
        }
        res.json({
            token: result.token,
            user: {
                userId: result.user.userId,
                role: result.user.role,
                mustChangePassword: result.user.mustChangePassword,
                authSource: result.user.authSource,
            },
        });
    }
    catch (err) {
        next(err);
    }
});
// TODO(atlas-auth): Keep a dedicated /admin/login endpoint once scheduler and IT admin flows diverge.
// Verify bridge token and return decoded identity
router.get('/me', authenticate, (req, res) => {
    res.json({
        user: {
            userId: req.user.userId,
            role: req.user.role,
            mustChangePassword: req.user.mustChangePassword ?? false,
            authSource: req.user.authSource ?? 'bridge',
            schoolId: req.user.schoolId,
            accountId: req.user.accountId,
        },
    });
});
export default router;
//# sourceMappingURL=auth.router.js.map