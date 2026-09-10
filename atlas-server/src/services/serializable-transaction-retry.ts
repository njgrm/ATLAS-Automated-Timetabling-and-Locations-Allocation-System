import type { Prisma, PrismaClient } from '@prisma/client';

const MAX_SERIALIZABLE_ATTEMPTS = 3;

type PrismaFailure = Error & {
	code?: string;
	meta?: { code?: string };
};

export type TransactionConflictError = Error & {
	statusCode: 409;
	code: 'PUBLICATION_TRANSACTION_CONFLICT';
};

function isSerializationConflict(error: unknown): boolean {
	const failure = error as PrismaFailure;
	return failure?.code === 'P2034' || failure?.meta?.code === '40001';
}

function exhaustedConflict(): TransactionConflictError {
	const error = new Error(
		'Publication could not complete because concurrent schedule changes repeatedly conflicted. Reload and retry.',
	) as TransactionConflictError;
	error.statusCode = 409;
	error.code = 'PUBLICATION_TRANSACTION_CONFLICT';
	return error;
}

/**
 * Retries the entire Serializable decision/write boundary after PostgreSQL
 * aborts it for a genuine serialization conflict. Each attempt is a fresh
 * transaction; application errors and all other database failures pass through.
 */
export async function runSerializablePublicationTransaction<T>(
	client: PrismaClient,
	work: (tx: Prisma.TransactionClient) => Promise<T>,
): Promise<T> {
	for (let attempt = 1; attempt <= MAX_SERIALIZABLE_ATTEMPTS; attempt += 1) {
		try {
			return await client.$transaction(work, { isolationLevel: 'Serializable' });
		} catch (error) {
			if (!isSerializationConflict(error)) throw error;
			if (attempt === MAX_SERIALIZABLE_ATTEMPTS) throw exhaustedConflict();
		}
	}
	throw exhaustedConflict();
}
