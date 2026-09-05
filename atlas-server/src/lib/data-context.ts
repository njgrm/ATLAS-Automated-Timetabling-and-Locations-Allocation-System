/**
 * Injectable data-access context.
 *
 * Production services import the singleton `prisma` from `lib/prisma.js`.
 * Tests that must observe or isolate the EXACT production data-access path
 * (e.g. generation zero-write instrumentation) inject an instrumented client
 * through this module instead of creating an unrelated second client.
 *
 * Prompt 03B: the context is carried by Node AsyncLocalStorage, NOT a
 * process-global mutable variable. Guarantees:
 *  - normal production requests use the singleton Prisma client;
 *  - one request/test cannot observe another request's injected client;
 *  - nested asynchronous services inherit only the correct context;
 *  - context is restored after success and failure;
 *  - timers/promises created inside a scope retain the scope's context;
 *  - production behavior outside an injected scope is unchanged.
 *
 * `getDataContext()` returns the injected client for the current async scope
 * when present, otherwise the production singleton. `withDataContext()` scopes
 * injection to a single async call via `AsyncLocalStorage.run()`; the store is
 * never visible outside the callback or its async descendants.
 */

import { AsyncLocalStorage } from 'node:async_hooks';
import { prisma } from './prisma.js';

const contextStorage = new AsyncLocalStorage<unknown>();

export function getDataContext<T = typeof prisma>(): T {
	return (contextStorage.getStore() ?? prisma) as T;
}

export async function withDataContext<T>(
	client: unknown,
	fn: () => Promise<T>,
): Promise<T> {
	return contextStorage.run(client, () => fn());
}
