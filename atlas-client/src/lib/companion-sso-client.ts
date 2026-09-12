/**
 * COMPANION-SSO-C01 — pure client helpers for the companion SSO surfaces.
 *
 * These functions hold the decision logic for the fragment-token callback, the
 * EnrollPro authorize resume, and the additive `returnUrl` handling so the
 * behavior is testable without a DOM. The React pages consume them directly.
 */

/* ─── /auth/sso/callback fragment consumption ──────────────────────────────── */

export type CompanionSsoCallbackOutcome =
	| { kind: 'token'; token: string }
	| { kind: 'error'; message: string };

export function readFragmentValue(hash: string, key: string): string | null {
	const raw = hash.startsWith('#') ? hash.slice(1) : hash;
	if (!raw) return null;
	for (const part of raw.split('&')) {
		if (!part) continue;
		const eq = part.indexOf('=');
		if (eq < 0) continue;
		if (part.slice(0, eq) !== key) continue;
		try {
			return decodeURIComponent(part.slice(eq + 1));
		} catch {
			return part.slice(eq + 1);
		}
	}
	return null;
}

/**
 * Decide what the callback page must do. The token is read ONLY from the URL
 * fragment (never the query string) so it is never sent to a server.
 */
export function resolveCompanionSsoCallback(hash: string, search: string): CompanionSsoCallbackOutcome {
	const ssoError = new URLSearchParams(search).get('ssoError');
	const token = readFragmentValue(hash, 'atlasToken');
	if (token) return { kind: 'token', token };
	return {
		kind: 'error',
		message: ssoError
			? 'This sign-in link expired or was already used. Start again from EnrollPro.'
			: 'No sign-in token was provided. Start again from EnrollPro.',
	};
}

/**
 * The effects the callback page must apply, injected so the ordering is
 * executable and testable without a DOM.
 */
export type CompanionSsoEffects = {
	/** Remove the token fragment / error query from the URL and history. */
	strip: () => void;
	/** Persist the ATLAS session token. */
	setToken: (token: string, remember: boolean) => void;
	/** Navigate to the role-based landing route. */
	navigate: (to: string, options: { replace: boolean }) => void;
	/** Surface a plain, recoverable error message. */
	onError: (message: string) => void;
};

/**
 * Apply a callback outcome with a HARD ordering guarantee:
 *   STRIP → SET TOKEN → NAVIGATE
 * The URL is always stripped first so the fragment token is removed from the
 * address bar and history BEFORE it is persisted or any navigation happens. For
 * an error outcome the URL is still stripped first, then the error is surfaced
 * and no token is set and no navigation occurs.
 *
 * `resolveRole` is invoked after the token is set and before navigation so the
 * role-based landing decision sees the just-stored token.
 */
export function applyCompanionSsoOutcome(
	outcome: CompanionSsoCallbackOutcome,
	effects: CompanionSsoEffects,
	resolveRole: (token: string) => string | null = () => null,
): void {
	// 1. STRIP first, unconditionally.
	effects.strip();

	if (outcome.kind === 'error') {
		effects.onError(outcome.message);
		return;
	}

	// 2. SET TOKEN.
	effects.setToken(outcome.token, false);

	// 3. NAVIGATE by role.
	const role = resolveRole(outcome.token);
	effects.navigate(role === 'faculty' ? '/my' : '/', { replace: true });
}

/* ─── /auth/enrollpro/authorize resume + request shaping ───────────────────── */

/** Build the login URL that resumes the full authorize request after sign-in. */
export function buildEnrollProAuthorizeLoginUrl(authorizeUrl: string): string {
	return `/login?returnUrl=${encodeURIComponent(authorizeUrl)}`;
}

export type AuthorizeRequestBody = {
	response_type: string | null;
	client_id: string | null;
	redirect_uri: string | null;
	state: string | null;
};

/** Extract the four authorize parameters verbatim from the browser query. */
export function buildAuthorizeRequestBody(search: string): AuthorizeRequestBody {
	const params = new URLSearchParams(search);
	return {
		response_type: params.get('response_type'),
		client_id: params.get('client_id'),
		redirect_uri: params.get('redirect_uri'),
		state: params.get('state'),
	};
}

/* ─── Login `returnUrl` validation ─────────────────────────────────────────── */

/**
 * Only a safe same-origin RELATIVE path is honored: it must start with a single
 * `/`, must not start with `//` (protocol-relative), and must not contain a
 * scheme or backslash. Anything else returns null so login falls back to the
 * existing role-based landing behavior unchanged.
 */
export function resolveSafeReturnUrl(value: string | null | undefined): string | null {
	if (!value) return null;
	if (!value.startsWith('/')) return null;
	if (value.startsWith('//')) return null;
	if (value.includes('\\')) return null;
	if (/^[a-zA-Z][a-zA-Z0-9+.-]*:/.test(value)) return null;
	return value;
}
