import { prisma } from '../lib/prisma.js';

/**
 * Dependency-readiness probe.
 *
 * The constant `/api/v1/health` response proves only that the Node process is
 * alive. The supervisor requires a stronger signal before it declares a child
 * healthy, so this service performs a real database round-trip and reports a
 * typed result. It never exposes connection strings or driver internals.
 */
export type DependencyReadiness = {
	ready: boolean;
	checks: {
		database: 'ok' | 'error';
	};
};

export async function getDependencyReadiness(): Promise<DependencyReadiness> {
	try {
		await prisma.$queryRaw`SELECT 1`;
		return { ready: true, checks: { database: 'ok' } };
	} catch {
		return { ready: false, checks: { database: 'error' } };
	}
}
