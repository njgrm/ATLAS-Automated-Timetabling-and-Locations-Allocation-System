import { Router } from 'express';
import { prisma } from '../lib/prisma.js';
import { authenticate } from './../middleware/authenticate.js';
import { requirePrivilegedRole } from './../middleware/authorize.js';
const router = Router();
/**
 * GET /api/v1/specialization-aliases?schoolId=X
 * Fetch all specialization aliases for a school.
 */
router.get('/', authenticate, requirePrivilegedRole, async (req, res, next) => {
    try {
        const schoolId = Number(req.query.schoolId);
        if (!schoolId) {
            res.status(400).json({ code: 'INVALID_PARAM', message: 'schoolId is required' });
            return;
        }
        const aliases = await prisma.specializationAlias.findMany({
            where: { schoolId },
            orderBy: [{ canonical: 'asc' }, { alias: 'asc' }]
        });
        res.json({ aliases });
    }
    catch (err) {
        next(err);
    }
});
/**
 * POST /api/v1/specialization-aliases
 * Create a new specialization alias entry.
 */
router.post('/', authenticate, requirePrivilegedRole, async (req, res, next) => {
    try {
        const { schoolId, canonical, alias } = req.body;
        if (!schoolId || !canonical || !alias) {
            res.status(400).json({ code: 'INVALID_PARAM', message: 'Missing required fields: schoolId, canonical, alias' });
            return;
        }
        const entry = await prisma.specializationAlias.create({
            data: {
                schoolId: Number(schoolId),
                canonical: String(canonical).trim(),
                alias: String(alias).trim()
            }
        });
        res.status(201).json({ alias: entry });
    }
    catch (err) {
        // Handle unique constraint violation
        if (err.code === 'P2002') {
            res.status(409).json({ code: 'CONFLICT', message: 'This alias mapping already exists for this school.' });
            return;
        }
        next(err);
    }
});
/**
 * DELETE /api/v1/specialization-aliases/:id
 * Delete a specialization alias entry.
 */
router.delete('/:id', authenticate, requirePrivilegedRole, async (req, res, next) => {
    try {
        const id = Number(req.params.id);
        if (Number.isNaN(id)) {
            res.status(400).json({ code: 'INVALID_PARAM', message: 'Invalid alias ID' });
            return;
        }
        await prisma.specializationAlias.delete({ where: { id } });
        res.json({ success: true });
    }
    catch (err) {
        next(err);
    }
});
export default router;
//# sourceMappingURL=specialization-alias.router.js.map