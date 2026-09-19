/**
 * COMPANION-SSO-C01 — Integrated Systems catalog and EnrollPro reverse-SSO link.
 *
 * Closed direct-federation catalog. AIMS, SMART, and EnrollPro are enabled only
 * by explicit configured SSO start URLs; MRF remains unavailable.
 *
 * Companion URL resolution is centralized in `lib/companion-config.ts` and is
 * fail-closed: when `VITE_ENROLLPRO_URL` is not configured the reverse-SSO
 * start URL is `null` and the EnrollPro row renders as disabled plain text.
 */

export type IntegratedSystemKey = 'AIMS' | 'SMART' | 'ATLAS' | 'MRF' | 'ENROLLPRO';

export type IntegratedSystemItem = {
	key: IntegratedSystemKey;
	label: string;
	/** ATLAS itself is the current system: rendered, but not a link. */
	current?: boolean;
	/** Only the current system and EnrollPro are enabled. */
	enabled: boolean;
	/** Plain-text reason for a disabled item; never a raw URL. */
	disabledReason?: string;
};

export { resolveDirectCompanionStartUrl, resolveEnrollProReverseStartUrl } from './companion-config';

/** `ADMIN`/`USER`/`TEACHER` rows are not a concern here — only privileged staff. */
export function canUseEnrollProReverseSso(role: string | null | undefined): boolean {
	return role === 'admin' || role === 'officer' || role === 'SYSTEM_ADMIN';
}

/**
 * The Integrated Systems list in the required AIMS, SMART, ATLAS, MRF order.
 * `privilegedStaff` gates the single enabled companion item, EnrollPro.
 */
export function buildIntegratedSystems(
	privilegedStaff: boolean,
): IntegratedSystemItem[] {
	return [
		{ key: 'AIMS', label: 'AIMS', enabled: privilegedStaff, disabledReason: 'AIMS is not configured' },
		{ key: 'SMART', label: 'SMART', enabled: privilegedStaff, disabledReason: 'SMART is not configured' },
		{ key: 'ATLAS', label: 'ATLAS', current: true, enabled: false },
		{ key: 'MRF', label: 'MRF', enabled: false, disabledReason: 'Available after direct federation' },
	];
}

/** Whether the sidebar should show the EnrollPro reverse-SSO row at all. */
export function shouldEnableEnrollPro(privilegedStaff: boolean): boolean {
	return privilegedStaff;
}
