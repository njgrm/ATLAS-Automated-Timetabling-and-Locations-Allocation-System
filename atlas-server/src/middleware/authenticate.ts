import type { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { timingSafeEqual } from 'node:crypto';

export interface AuthPayload {
	userId: number;
	role: string;
	mustChangePassword?: boolean;
	authSource?: 'bridge' | 'local' | 'system';
	schoolId?: number;
	accountId?: number;
	facultyId?: number | null;
	email?: string;
	employeeId?: string | null;
	accountName?: string | null;
}

declare global {
	namespace Express {
		interface Request {
			user?: AuthPayload;
		}
	}
}

function extractBearerToken(req: Request): string | null {
	const header = req.headers.authorization;
	if (!header?.startsWith('Bearer ')) {
		return null;
	}
	return header.slice(7);
}

function isSystemTokenMatch(providedToken: string): boolean {
	const configuredToken = process.env.ATLAS_SYSTEM_TOKEN;
	if (!configuredToken) {
		return false;
	}
	const provided = Buffer.from(providedToken, 'utf8');
	const expected = Buffer.from(configuredToken, 'utf8');
	if (provided.length !== expected.length) {
		return false;
	}
	return timingSafeEqual(provided, expected);
}

export function authenticateWithSystemToken(req: Request, res: Response, next: NextFunction): void {
	const token = extractBearerToken(req);
	if (!token) {
		res.status(401).json({ code: 'NO_TOKEN', message: 'Authorization header missing or malformed.' });
		return;
	}

	if (isSystemTokenMatch(token)) {
		req.user = {
			userId: 0,
			role: 'SYSTEM_ADMIN',
			authSource: 'system',
			email: 'atlas-system-token@local',
		};
		next();
		return;
	}

	authenticate(req, res, next);
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
