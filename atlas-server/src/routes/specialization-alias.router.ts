import { Router } from 'express';
import type { Request, Response, NextFunction } from 'express';
import { prisma } from '../lib/prisma.js';
import { authenticate } from './../middleware/authenticate.js';
import { requirePrivilegedRole } from './../middleware/authorize.js';

const router = Router();

function normalizeCanonicalCode(value: unknown): string {
	return String(value ?? '').trim().toUpperCase();
}

async function getActiveCanonicalCodeSet(schoolId: number): Promise<Set<string>> {
	const rows = await prisma.subject.findMany({
		where: { schoolId, isActive: true },
		select: { code: true },
	});
	return new Set(rows.map((row) => row.code));
}

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

		const parsedSchoolId = Number(schoolId);
		const canonicalCode = normalizeCanonicalCode(canonical);
		const activeCanonicalCodes = await getActiveCanonicalCodeSet(parsedSchoolId);
		if (!activeCanonicalCodes.has(canonicalCode)) {
			res.status(400).json({
				code: 'INVALID_CANONICAL',
				message: `canonical must reference an active subject code for schoolId=${parsedSchoolId}`,
			});
			return;
		}

		const entry = await prisma.specializationAlias.create({
			data: { 
				schoolId: parsedSchoolId, 
				canonical: canonicalCode,
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
				? entry.canonicalCodes.map((code: unknown) => normalizeCanonicalCode(code)).filter(Boolean)
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

		const activeCanonicalCodes = await getActiveCanonicalCodeSet(schoolId);
		const ignoredInvalidMappings: Array<{ alias: string; invalidCanonicalCodes: string[] }> = [];

		await prisma.$transaction(async (tx) => {
			for (const mapping of normalized) {
				const validCanonicalCodes = mapping.canonicalCodes.filter((code) => activeCanonicalCodes.has(code));
				const invalidCanonicalCodes = mapping.canonicalCodes.filter((code) => !activeCanonicalCodes.has(code));
				if (invalidCanonicalCodes.length > 0) {
					ignoredInvalidMappings.push({ alias: mapping.alias, invalidCanonicalCodes });
				}

				await tx.specializationAlias.deleteMany({
					where: {
						schoolId,
						alias: mapping.alias,
					},
				});

				if (validCanonicalCodes.length > 0) {
					await tx.specializationAlias.createMany({
						data: validCanonicalCodes.map((canonical: string) => ({
							schoolId,
							alias: mapping.alias,
							canonical,
						})),
						skipDuplicates: true,
					});
				}
			}
		});

		res.json({
			success: true,
			updated: normalized.length,
			ignoredInvalidMappings,
		});
	} catch (err) {
		next(err);
	}
});

/**
 * POST /api/v1/specialization-aliases/cleanup
 * Remove stale alias rows that target inactive subject codes.
 */
router.post('/cleanup', authenticate, requirePrivilegedRole, async (req: Request, res: Response, next: NextFunction) => {
	try {
		const schoolId = Number(req.body?.schoolId ?? req.query.schoolId);
		if (!schoolId || Number.isNaN(schoolId)) {
			res.status(400).json({ code: 'INVALID_PARAM', message: 'schoolId is required' });
			return;
		}

		const activeCanonicalCodes = await getActiveCanonicalCodeSet(schoolId);
		const aliases = await prisma.specializationAlias.findMany({
			where: { schoolId },
			select: { id: true, canonical: true },
		});
		const staleAliases = aliases.filter((entry) => !activeCanonicalCodes.has(entry.canonical));
		const staleIds = staleAliases.map((entry) => entry.id);
		if (staleIds.length === 0) {
			res.json({ success: true, removed: 0, removedCanonicalCodes: [] });
			return;
		}

		await prisma.specializationAlias.deleteMany({ where: { id: { in: staleIds } } });

		const removedCanonicalCodes = Array.from(
			new Set(staleAliases.map((entry) => entry.canonical)),
		).sort((left, right) => left.localeCompare(right));

		res.json({
			success: true,
			removed: staleIds.length,
			removedCanonicalCodes,
		});
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
