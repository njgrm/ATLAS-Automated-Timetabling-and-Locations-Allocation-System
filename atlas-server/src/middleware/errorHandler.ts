import type { Request, Response, NextFunction } from 'express';

interface ServiceError extends Error {
	statusCode?: number;
	code?: string;
	actionHint?: string;
	details?: Record<string, unknown>;
}

export function errorHandler(err: ServiceError, req: Request, res: Response, _next: NextFunction): void {
	const statusCode = err.statusCode ?? 500;
	const code = err.code ?? 'SERVER_ERROR';

	if (statusCode >= 500) {
		const route = `${req.method} ${req.originalUrl}`;
		console.error(`[ATLAS] 500 on ${route}:`, err.code ?? '', err.message);
		if (err.stack) {
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
