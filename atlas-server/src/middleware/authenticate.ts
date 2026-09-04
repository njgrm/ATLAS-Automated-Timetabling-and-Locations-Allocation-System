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

export function extractBearerToken(req: Request): string | null {
	const header = req.headers.authorization;
	if (!header?.startsWith('Bearer ')) {
		return null;
	}
	return header.slice(7);
}

export function extractCookieValue(req: Request, name: string): string | null {
	const cookieHeader = req.headers.cookie;
	if (!cookieHeader) return null;
	for (const part of cookieHeader.split(';')) {
		const [rawKey, ...rawValueParts] = part.trim().split('=');
		if (rawKey !== name) continue;
		const rawValue = rawValueParts.join('=');
		if (!rawValue) return null;
		try {
			return decodeURIComponent(rawValue);
		} catch {
			return rawValue;
		}
	}
	return null;
}

export function extractAtlasAuthCookieToken(req: Request): string | null {
	return extractCookieValue(req, 'atlasAuthToken');
}

export function extractSseToken(req: Request): string | null {
	const bearer = extractBearerToken(req);
	if (bearer) return bearer;
	const cookieToken = extractAtlasAuthCookieToken(req);
	if (cookieToken) return cookieToken;
	// DEPRECATED: accessToken query param is deprecated for SSE routes.
	// Remove once no client sends tokens via query string.
	const queryToken = typeof req.query.accessToken === 'string' ? req.query.accessToken : null;
	if (queryToken) {
		console.warn('[SSE auth] accessToken query param is deprecated; use Authorization header instead.');
	}
	return queryToken;
}

function getConfiguredSystemToken(): string | null {
	const configuredToken = process.env.ATLAS_SYSTEM_TOKEN?.trim();
	return configuredToken || null;
}

function isSystemTokenMatch(providedToken: string): boolean {
	const configuredToken = getConfiguredSystemToken();
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

function extractIntegrationKey(req: Request): string | null {
	const header = req.headers['x-integration-key'];
	if (typeof header !== 'string' || !header.trim()) {
		return null;
	}
	return header;
}

type JwtVerificationResult =
	| { payload: AuthPayload }
	| { statusCode: number; code: string; message: string };

function verifyJwtToken(token: string): JwtVerificationResult {
	const secret = process.env.JWT_SECRET;
	if (!secret) {
		return { statusCode: 500, code: 'SERVER_ERROR', message: 'JWT secret not configured.' };
	}

	try {
		return { payload: jwt.verify(token, secret) as AuthPayload };
	} catch (err: unknown) {
		if (err instanceof jwt.TokenExpiredError) {
			return { statusCode: 401, code: 'TOKEN_EXPIRED', message: 'Access token has expired.' };
		}
		return { statusCode: 401, code: 'INVALID_TOKEN', message: 'Invalid access token.' };
	}
}

function setJwtUser(req: Request, payload: AuthPayload): void {
	req.user = {
		...payload,
		authSource: payload.authSource === 'local' ? 'local' : 'bridge',
	};
}

function sendJwtFailure(res: Response, result: Exclude<JwtVerificationResult, { payload: AuthPayload }>): void {
	res.status(result.statusCode).json({ code: result.code, message: result.message });
}

export function authenticateWithSystemToken(req: Request, res: Response, next: NextFunction): void {
	const bearerToken = extractBearerToken(req);
	const integrationKey = extractIntegrationKey(req);
	const token = integrationKey ?? bearerToken;
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

	if (integrationKey) {
		if (!getConfiguredSystemToken()) {
			res.status(500).json({
				code: 'SYSTEM_TOKEN_NOT_CONFIGURED',
				message: 'ATLAS_SYSTEM_TOKEN must be configured for integration-key authentication.',
			});
			return;
		}
		res.status(401).json({ code: 'INVALID_SYSTEM_TOKEN', message: 'Invalid ATLAS system token.' });
		return;
	}

	const jwtResult = verifyJwtToken(bearerToken!);
	if ('payload' in jwtResult) {
		setJwtUser(req, jwtResult.payload);
		next();
		return;
	}

	if (!getConfiguredSystemToken()) {
		res.status(500).json({
			code: 'SYSTEM_TOKEN_NOT_CONFIGURED',
			message: 'ATLAS_SYSTEM_TOKEN must be configured for system-token authentication.',
		});
		return;
	}

	sendJwtFailure(res, jwtResult);
}

export function authenticate(req: Request, res: Response, next: NextFunction): void {
	const header = req.headers.authorization;
	if (!header?.startsWith('Bearer ')) {
		res.status(401).json({ code: 'NO_TOKEN', message: 'Authorization header missing or malformed.' });
		return;
	}

	const token = header.slice(7);
	const jwtResult = verifyJwtToken(token);
	if ('payload' in jwtResult) {
		setJwtUser(req, jwtResult.payload);
		next();
		return;
	}
	sendJwtFailure(res, jwtResult);
}
