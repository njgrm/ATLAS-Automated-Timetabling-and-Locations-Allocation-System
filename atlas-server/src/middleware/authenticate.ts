import type { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';

export interface AuthPayload {
	userId: number;
	role: string;
	mustChangePassword?: boolean;
	authSource?: 'bridge' | 'local';
	schoolId?: number;
	accountId?: number;
	email?: string;
}

declare global {
	namespace Express {
		interface Request {
			user?: AuthPayload;
		}
	}
}

export function authenticate(req: Request, res: Response, next: NextFunction): void {
	const header = req.headers.authorization;
	if (!header?.startsWith('Bearer ')) {
		res.status(401).json({ code: 'NO_TOKEN', message: 'Authorization header missing or malformed.' });
		return;
	}

	const token = header.slice(7);
	const secret = process.env.JWT_SECRET;
	if (!secret) {
		res.status(500).json({ code: 'SERVER_ERROR', message: 'JWT secret not configured.' });
		return;
	}

	try {
		const decoded = jwt.verify(token, secret) as AuthPayload;
		req.user = {
			...decoded,
			authSource: decoded.authSource === 'local' ? 'local' : 'bridge',
		};
		next();
	} catch (err: unknown) {
		if (err instanceof jwt.TokenExpiredError) {
			res.status(401).json({ code: 'TOKEN_EXPIRED', message: 'Access token has expired.' });
			return;
		}
		res.status(401).json({ code: 'INVALID_TOKEN', message: 'Invalid access token.' });
	}
}
