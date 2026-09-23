import type { Request, Response, NextFunction } from 'express';
import { capabilitiesForRole, hasCapability, type AtlasCapability } from '../services/scheduler-capabilities.js';

const PRIVILEGED_ROLES = new Set(['admin', 'officer', 'SYSTEM_ADMIN']);

export function hasPrivilegedRole(role: string | undefined): boolean {
	if (!role) return false;
	return PRIVILEGED_ROLES.has(role);
}

export function requirePrivilegedRole(req: Request, res: Response, next: NextFunction): void {
	if (hasPrivilegedRole(req.user?.role)) {
		next();
		return;
	}
	res.status(403).json({
		code: 'FORBIDDEN',
		message: 'This endpoint is restricted to scheduler officers and administrators.',
	});
}

export function requestHasCapability(req: Request, required: AtlasCapability): boolean {
	const capabilities = capabilitiesForRole(req.user?.role, req.user?.capabilities);
	return hasCapability(capabilities, required);
}

/** Bind a route's numeric school path to the authenticated actor before any service dispatch. */
export function assertRequestSchoolScope(req: Request, res: Response, schoolId: number): boolean {
	const actorSchoolId = req.user?.schoolId;
	if (!Number.isSafeInteger(schoolId) || schoolId < 1) {
		res.status(400).json({ code: 'INVALID_PARAM', message: 'schoolId must be a positive integer.' });
		return false;
	}
	if (!Number.isSafeInteger(actorSchoolId) || actorSchoolId! < 1 || actorSchoolId !== schoolId) {
		res.status(403).json({ code: 'SCHOOL_SCOPE_DENIED', message: 'The authenticated account is not authorized for this school.' });
		return false;
	}
	return true;
}

export function requireCapability(required: AtlasCapability) {
	return (req: Request, res: Response, next: NextFunction): void => {
		if (requestHasCapability(req, required)) {
			next();
			return;
		}
		res.status(403).json({
			code: 'FORBIDDEN',
			message: `This endpoint requires the ${required} capability.`,
		});
	};
}
