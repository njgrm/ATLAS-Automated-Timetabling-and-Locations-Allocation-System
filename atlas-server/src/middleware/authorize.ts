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

export function requireCapability(required: AtlasCapability) {
	return (req: Request, res: Response, next: NextFunction): void => {
		const capabilities = capabilitiesForRole(req.user?.role, req.user?.capabilities);
		if (hasCapability(capabilities, required)) {
			next();
			return;
		}
		res.status(403).json({
			code: 'FORBIDDEN',
			message: `This endpoint requires the ${required} capability.`,
		});
	};
}
