/**
 * COMPANION-SSO-C01 — Integrated Systems catalog and EnrollPro reverse-SSO link.
 *
 * Hub model only (guide §3.3): the only companion link ATLAS may enable is
 * EnrollPro. AIMS/SMART/MRF have no direct authenticated launch and must stay
 * plain text. No raw companion dashboard URL is ever rendered.
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

const DEFAULT_ENROLLPRO_URL = 'http://100.88.55.125:5173';
const REVERSE_START_PATH = '/api/auth/companion-sso/atlas/reverse/start';

function viteEnv(): Record<string, string | undefined> {
	// `import.meta.env` exists under Vite and is undefined under the Node test
	// runner, so guard the access rather than assuming a bundler.
	try {
		return ((import.meta as unknown as { env?: Record<string, string | undefined> }).env) ?? {};
	} catch {
		return {};
	}
}

/**
 * The EnrollPro reverse-SSO start URL. Prefers the explicit
 * `VITE_ENROLLPRO_SSO_START_URL`; otherwise derives it from
 * `VITE_ENROLLPRO_URL` (falling back to the configured Tailnet origin) plus the
 * canonical reverse path. This is the ONLY companion URL the sidebar may emit.
 */
export function resolveEnrollProReverseStartUrl(env: Record<string, string | undefined> = viteEnv()): string {
	const explicit = env.VITE_ENROLLPRO_SSO_START_URL?.trim();
	if (explicit) return explicit;
	const base = (env.VITE_ENROLLPRO_URL?.trim() || DEFAULT_ENROLLPRO_URL).replace(/\/+$/, '');
	return `${base}${REVERSE_START_PATH}`;
}

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
		{ key: 'AIMS', label: 'AIMS', enabled: false, disabledReason: 'Available after direct federation' },
		{ key: 'SMART', label: 'SMART', enabled: false, disabledReason: 'Available after direct federation' },
		{ key: 'ATLAS', label: 'ATLAS', current: true, enabled: false },
		{ key: 'MRF', label: 'MRF', enabled: false, disabledReason: 'Available after direct federation' },
	];
}

/** Whether the sidebar should show the EnrollPro reverse-SSO row at all. */
export function shouldEnableEnrollPro(privilegedStaff: boolean): boolean {
	return privilegedStaff;
}
