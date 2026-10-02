import { prisma } from '../lib/prisma.js';
import type { Prisma } from '@prisma/client';

/**
 * Serialize Flag/HGP overlay and scheduling-policy writes for one school/year.
 * The lock is transaction-scoped and intentionally acquired before either
 * service reads scoped authority. This uses the repository's established
 * school/year advisory-lock key so both mutation paths share one boundary.
 */
export async function withFlagHgpAuthorityLock<T>(
	client: typeof prisma,
	schoolId: number,
	schoolYearId: number,
	mutate: (tx: Prisma.TransactionClient) => Promise<T>,
): Promise<T> {
	return client.$transaction(async (tx) => {
		await tx.$executeRawUnsafe(
			'SELECT pg_advisory_xact_lock($1::integer, $2::integer)',
			schoolId,
			schoolYearId,
		);
		return mutate(tx);
	});
}
