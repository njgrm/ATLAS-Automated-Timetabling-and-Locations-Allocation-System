/**
 * COMPANION-CONFIG — the single, fail-closed source of EnrollPro companion
 * URLs for ATLAS.
 *
 * Every EnrollPro navigation derives from explicit configuration only. There is
 * no raw-IP or hard-coded production default: when `VITE_ENROLLPRO_URL` is
 * unset or blank the resolvers return `null` and the consuming surface must
 * disable or omit the link rather than navigate somewhere stale.
 */

/** The canonical reverse-SSO start path on the EnrollPro origin. */
export const ENROLLPRO_REVERSE_START_PATH = '/api/auth/companion-sso/atlas/reverse/start';

function viteEnv(): Record<string, string | undefined> {
	// Each key is read as a static `import.meta.env.VITE_*` member reference so
	// Vite inlines the value into the bundle at build time. Do not route this
	// through a cast/`Record` lookup: that hides the member expression from the
	// bundler and ships a bundle with no companion origin.
	//
	// `import.meta.env` is undefined under the Node test runner (`tsx` /
	// `node --test`), so the member access throws and the catch fails closed to
	// `{}` — preserving the "no configuration in tests" contract.
	try {
		return {
			VITE_ENROLLPRO_URL: import.meta.env.VITE_ENROLLPRO_URL,
			VITE_ENROLLPRO_SSO_START_URL: import.meta.env.VITE_ENROLLPRO_SSO_START_URL,
			VITE_SMART_SSO_START_URL: import.meta.env.VITE_SMART_SSO_START_URL,
			VITE_AIMS_SSO_START_URL: import.meta.env.VITE_AIMS_SSO_START_URL,
		};
	} catch {
		return {};
	}
}

export type DirectCompanionPeer = 'smart' | 'aims';

/** Direct federation links are explicit build-time URLs; there is no origin fallback. */
export function resolveDirectCompanionStartUrl(
	peer: DirectCompanionPeer,
	env: Record<string, string | undefined> = viteEnv(),
): string | null {
	const key = peer === 'smart' ? 'VITE_SMART_SSO_START_URL' : 'VITE_AIMS_SSO_START_URL';
	const raw = env[key]?.trim();
	if (!raw) return null;
	try {
		const url = new URL(raw);
		return url.protocol === 'https:' || url.protocol === 'http:' ? url.toString() : null;
	} catch {
		return null;
	}
}

/**
 * The configured EnrollPro base origin, trimmed with trailing slashes removed.
 * Returns `null` when `VITE_ENROLLPRO_URL` is unset or blank — never a raw IP.
 */
export function resolveEnrollProBase(env: Record<string, string | undefined> = viteEnv()): string | null {
	const raw = env.VITE_ENROLLPRO_URL?.trim();
	if (!raw) return null;
	return raw.replace(/\/+$/, '');
}

/** The reciprocal "Back to EnrollPro" dashboard link, or `null` when unresolved. */
export function resolveEnrollProBackHref(env: Record<string, string | undefined> = viteEnv()): string | null {
	const base = resolveEnrollProBase(env);
	return base ? `${base}/dashboard` : null;
}

/**
 * The bridge-logout redirect target. This is the EnrollPro personnel login
 * route (distinct from the reverse-SSO start contract), or `null` when
 * unresolved so the caller stays on the local `/login` route.
 */
export function resolveEnrollProLogoutRedirect(env: Record<string, string | undefined> = viteEnv()): string | null {
	const base = resolveEnrollProBase(env);
	return base ? `${base}/personnel/login` : null;
}

/**
 * The EnrollPro reverse-SSO start URL. An explicit
 * `VITE_ENROLLPRO_SSO_START_URL` wins; otherwise it derives from
 * `VITE_ENROLLPRO_URL` plus the canonical reverse path; otherwise `null`.
 */
export function resolveEnrollProReverseStartUrl(env: Record<string, string | undefined> = viteEnv()): string | null {
	const explicit = env.VITE_ENROLLPRO_SSO_START_URL?.trim();
	if (explicit) return explicit;
	const base = resolveEnrollProBase(env);
	return base ? `${base}${ENROLLPRO_REVERSE_START_PATH}` : null;
}
