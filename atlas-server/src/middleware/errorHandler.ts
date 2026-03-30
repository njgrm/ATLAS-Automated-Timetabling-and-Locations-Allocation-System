import type { Request, Response, NextFunction } from 'express';

export function errorHandler(err: Error, _req: Request, res: Response, _next: NextFunction): void {
	console.error('[ATLAS] Unhandled error:', err.message);
	res.status(500).json({ code: 'SERVER_ERROR', message: 'An internal server error occurred.' });
}
