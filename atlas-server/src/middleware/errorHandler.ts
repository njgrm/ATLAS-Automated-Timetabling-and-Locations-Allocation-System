import type { Request, Response, NextFunction } from 'express';

interface ServiceError extends Error {
	statusCode?: number;
	code?: string;
}

export function errorHandler(err: ServiceError, _req: Request, res: Response, _next: NextFunction): void {
	const statusCode = err.statusCode ?? 500;
	const code = err.code ?? 'SERVER_ERROR';
	if (statusCode >= 500) {
		console.error('[ATLAS] Unhandled error:', err.message);
	}
	res.status(statusCode).json({ code, message: err.message || 'An internal server error occurred.' });
}
