import type { Request, Response, NextFunction } from 'express';

interface ServiceError extends Error {
	statusCode?: number;
	code?: string;
	actionHint?: string;
	details?: Record<string, unknown>;
}

/** Query parameters that may contain secrets and must be redacted from logs. */
const SENSITIVE_QUERY_PARAMS = new Set(['accesstoken', 'access_token', 'token', 'apikey', 'api_key', 'key', 'secret']);
const JWT_VALUE_PATTERN = /^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/;
const EXPECTED_READINESS_ERROR_CODES = new Set(['TERM_FILTER_NOT_READY']);

export function sanitizeUrl(url: string): string {
	try {
		const parsed = new URL(url, 'http://localhost');
		let sanitized = false;
		for (const [param, value] of parsed.searchParams.entries()) {
			const normalizedParam = param.toLowerCase();
			if (SENSITIVE_QUERY_PARAMS.has(normalizedParam) || JWT_VALUE_PATTERN.test(value)) {
				parsed.searchParams.set(param, '[REDACTED]');
				sanitized = true;
			}
		}
		return sanitized ? `${parsed.pathname}${parsed.search}` : url;
	} catch {
		return url;
	}
}

export function errorHandler(err: ServiceError, req: Request, res: Response, _next: NextFunction): void {
	const statusCode = err.statusCode ?? 500;
	const code = err.code ?? 'SERVER_ERROR';

	// Log server errors (5xx) with the actual status code, not hard-coded 500
	if (statusCode >= 500) {
		const route = `${req.method} ${sanitizeUrl(req.originalUrl)}`;
		const isExpectedReadinessState = EXPECTED_READINESS_ERROR_CODES.has(code);
		const log = isExpectedReadinessState ? console.warn : console.error;
		log(`[ATLAS] ${statusCode} on ${route}:`, err.code ?? '', err.message);
		if (!isExpectedReadinessState && err.stack) {
			console.error(err.stack);
		}
	}

	res.status(statusCode).json({
		code,
		message: err.message || 'An internal server error occurred.',
		...(err.actionHint ? { actionHint: err.actionHint } : {}),
		...(err.details ? { details: err.details } : {}),
	});
}
