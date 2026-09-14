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
	// `import.meta.env` exists under Vite and is undefined under the Node test
	// runner, so guard the access rather than assuming a bundler.
	try {
		return ((import.meta as unknown as { env?: Record<string, string | undefined> }).env) ?? {};
	} catch {
		return {};
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
