export type AtlasCapability =
	| 'faculty:self-service'
	| 'teaching-load:manage'
	| 'scheduling-policy:manage'
	| 'timetable:read'
	| 'timetable:edit'
	| 'timetable:review'
	| 'timetable:generate'
	| 'timetable:publish'
	| 'timetable:request-publication'
	| 'timetable:approve-publication'
	| 'users:admin'
	| 'system:admin';

export const SCHEDULING_CAPABILITIES: readonly AtlasCapability[] = [
	'teaching-load:manage',
	'scheduling-policy:manage',
	'timetable:read',
	'timetable:edit',
	'timetable:review',
	'timetable:generate',
];

export const SCHEDULER_PUBLICATION_CAPABILITIES: readonly AtlasCapability[] = [
	'timetable:request-publication',
	'timetable:approve-publication',
];

export type EnrollProRoleMapping = {
	role: 'faculty' | 'scheduler' | 'officer' | null;
	capabilities: AtlasCapability[];
};

const KNOWN_ENROLLPRO_ROLES = new Set([
	'SYSTEM_ADMIN',
	'HEAD_REGISTRAR',
	'CLASS_ADVISER',
	'TEACHER',
]);

export function mapEnrollProRoles(roles: readonly string[]): EnrollProRoleMapping {
	const normalized = roles
		.filter((role): role is string => typeof role === 'string')
		.map((role) => role.trim().toUpperCase())
		.filter((role) => KNOWN_ENROLLPRO_ROLES.has(role));
	const hasFaculty = normalized.some((role) => role === 'TEACHER' || role === 'CLASS_ADVISER');
	const hasSystemOfficer = normalized.some((role) => role === 'SYSTEM_ADMIN' || role === 'HEAD_REGISTRAR');

	if (hasSystemOfficer) return { role: 'officer', capabilities: ['users:admin', 'system:admin', 'timetable:publish'] };
	if (hasFaculty) {
		return {
			role: 'faculty',
			capabilities: ['faculty:self-service'],
		};
	}
	return { role: null, capabilities: [] };
}

/** Upgrade authenticated EnrollPro identity only when the separately verified active-year feed grants it. */
export function resolveEnrollProSessionAuthority(
	roles: readonly string[],
	schedulerAncillaryEligible: boolean,
): EnrollProRoleMapping {
	const identity = mapEnrollProRoles(roles);
	if (identity.role === 'officer' || !schedulerAncillaryEligible) return identity;
	return {
		role: 'scheduler',
		capabilities: [
			...(identity.role === 'faculty' ? ['faculty:self-service' as const] : []),
			...SCHEDULING_CAPABILITIES,
			...SCHEDULER_PUBLICATION_CAPABILITIES,
		],
	};
}

export function capabilitiesForRole(role: string | undefined, persisted: unknown): string[] {
	if (role === 'admin' || role === 'officer' || role === 'SYSTEM_ADMIN') {
		return ['users:admin', 'system:admin', 'timetable:publish', ...SCHEDULING_CAPABILITIES, ...SCHEDULER_PUBLICATION_CAPABILITIES];
	}
	if (role === 'scheduler') return [...SCHEDULING_CAPABILITIES, ...SCHEDULER_PUBLICATION_CAPABILITIES];
	if (role === 'faculty') return ['faculty:self-service'];
	return Array.isArray(persisted) ? persisted.filter((value): value is string => typeof value === 'string') : [];
}

export function hasCapability(capabilities: readonly string[], required: AtlasCapability): boolean {
	return capabilities.includes(required)
		|| capabilities.includes('*')
		|| capabilities.includes('admin:*')
		|| (capabilities.includes('system:admin') && required !== 'faculty:self-service')
		|| (capabilities.includes('users:admin') && required === 'users:admin');
}
