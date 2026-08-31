import type { Request } from 'express';

/**
 * Extract the upstream EnrollPro auth token from the request.
 *
 * Bridge tokens are EnrollPro-issued JWTs and MUST be forwarded.
 * System tokens and local ATLAS JWTs must never be sent upstream.
 *
 * Returns the bearer token only when the caller authenticated through
 * the EnrollPro bridge (`authSource === 'bridge'`). Returns `undefined`
 * for `local`, `system`, or missing `req.user`.
 */
export function getUpstreamAuthToken(req: Request, enabled = true): string | undefined {
	if (!enabled) return undefined;
	const authToken = req.headers.authorization?.startsWith('Bearer ')
		? req.headers.authorization.slice(7)
		: undefined;
	return req.user?.authSource === 'bridge' ? authToken : undefined;
}
