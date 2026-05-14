import { Router } from 'express';
import type { Request, Response, NextFunction } from 'express';
import { prisma } from '../lib/prisma.js';
import { authenticate } from './../middleware/authenticate.js';
import { requirePrivilegedRole } from './../middleware/authorize.js';

const router = Router();

/**
 * GET /api/v1/specialization-aliases?schoolId=X
 * Fetch all specialization aliases for a school.
 */
router.get('/', authenticate, requirePrivilegedRole, async (req: Request, res: Response, next: NextFunction) => {
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
	} catch (err) {
		next(err);
	}
});

/**
 * POST /api/v1/specialization-aliases
 * Create a new specialization alias entry.
 */
router.post('/', authenticate, requirePrivilegedRole, async (req: Request, res: Response, next: NextFunction) => {
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
	} catch (err) {
		// Handle unique constraint violation
		if ((err as any).code === 'P2002') {
			res.status(409).json({ code: 'CONFLICT', message: 'This alias mapping already exists for this school.' });
			return;
		}
		next(err);
	}
});

/**
 * POST /api/v1/specialization-aliases/batch
 * Atomically replace specialization mappings for changed terms.
 */
router.post('/batch', authenticate, requirePrivilegedRole, async (req: Request, res: Response, next: NextFunction) => {
	try {
		const schoolId = Number(req.body?.schoolId);
		const mappings = Array.isArray(req.body?.mappings) ? req.body.mappings : [];

		if (!schoolId || mappings.length === 0) {
			res.status(400).json({
				code: 'INVALID_PARAM',
				message: 'Missing required fields: schoolId, mappings[]'
			});
			return;
		}

		type NormalizedMapping = { alias: string; canonicalCodes: string[] };
		const normalized: NormalizedMapping[] = mappings.map((entry: any) => {
			const alias = String(entry?.alias ?? '').trim();
			const canonicalList = Array.isArray(entry?.canonicalCodes)
				? entry.canonicalCodes.map((code: unknown) => String(code ?? '').trim()).filter(Boolean)
				: [];
			const uniqueCanonical = Array.from(new Set(canonicalList));
			return {
				alias,
				canonicalCodes: uniqueCanonical,
			};
		});

		if (normalized.some((entry: NormalizedMapping) => !entry.alias)) {
			res.status(400).json({
				code: 'INVALID_PARAM',
				message: 'Each mapping entry must include a non-empty alias.'
			});
			return;
		}

		await prisma.$transaction(async (tx) => {
			for (const mapping of normalized) {
				await tx.specializationAlias.deleteMany({
					where: {
						schoolId,
						alias: mapping.alias,
					},
				});

				if (mapping.canonicalCodes.length > 0) {
					await tx.specializationAlias.createMany({
						data: mapping.canonicalCodes.map((canonical: string) => ({
							schoolId,
							alias: mapping.alias,
							canonical,
						})),
						skipDuplicates: true,
					});
				}
			}
		});

		res.json({ success: true, updated: normalized.length });
	} catch (err) {
		next(err);
	}
});

/**
 * DELETE /api/v1/specialization-aliases/:id
 * Delete a specialization alias entry.
 */
router.delete('/:id', authenticate, requirePrivilegedRole, async (req: Request, res: Response, next: NextFunction) => {
	try {
		const id = Number(req.params.id);
		if (Number.isNaN(id)) {
			res.status(400).json({ code: 'INVALID_PARAM', message: 'Invalid alias ID' });
			return;
		}

		await prisma.specializationAlias.delete({ where: { id } });
		res.json({ success: true });
	} catch (err) {
		next(err);
	}
});

export default router;
