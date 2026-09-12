export const ATLAS_BRIDGE_TOKEN_KEY = 'atlas_bridge_token';
export const ATLAS_LOCAL_TOKEN_KEY = 'atlas_local_token';

/**
 * DASH-RESILIENCE-C01 — canonical expired-session signal.
 *
 * A data request that returns HTTP 401 has lost its authority. The app shell
 * owns the canonical redirect to sign-in; this helper clears the session
 * storage and raises one app-wide event so the shell performs the same
 * clear-and-navigate flow it uses after `verifySessionToken()` fails. It never
 * renders business values (zeros) for the failed read.
 */
export const ATLAS_SESSION_EXPIRED_EVENT = 'atlas:session-expired';

export function expireAtlasSession(): void {
	clearAtlasAuthStorage();
	if (typeof window !== 'undefined' && typeof window.dispatchEvent === 'function') {
		window.dispatchEvent(new CustomEvent(ATLAS_SESSION_EXPIRED_EVENT));
	}
}

/**
 * ACTOR-SCOPE-C01 — authenticated-token epoch signal.
 *
 * The token epoch is the exact `getPreferredAccessToken()` string. Any session
 * mutation (login, logout, same-tab re-login, bridge-token replacement, session
 * expiry, full auth storage clear) advances a monotonic version and synchronously
 * notifies every mounted subscriber. Subscribers MUST treat a notification as
 * authoritative: immediately drop any previously bound actor school/year before
 * the new session resolves, then re-resolve and rebind in-place without a reload.
 *
 * The version counter is monotonic so a consumer can cheaply detect that its
 * in-flight work belongs to an obsolete epoch and must be discarded, even when
 * the effective token string happens to return to a previously seen value.
 */
export type AtlasTokenEpochListener = () => void;

let atlasTokenEpochVersion = 0;
const atlasTokenEpochListeners = new Set<AtlasTokenEpochListener>();

function notifyAtlasTokenEpochChange(): void {
	atlasTokenEpochVersion += 1;
	for (const listener of Array.from(atlasTokenEpochListeners)) {
		try {
			listener();
		} catch {
			// A subscriber must never break an auth-storage mutation.
		}
	}
}

/** Current monotonic token-epoch version. Advances on EVERY session mutation. */
export function getAtlasTokenEpochVersion(): number {
	return atlasTokenEpochVersion;
}

/** Subscribe to token-epoch changes. Returns an unsubscribe function. */
export function subscribeAtlasTokenEpoch(listener: AtlasTokenEpochListener): () => void {
	atlasTokenEpochListeners.add(listener);
	return () => {
		atlasTokenEpochListeners.delete(listener);
	};
}

const ATLAS_AUTH_COOKIE_NAME = 'atlasAuthToken';
const ATLAS_AUTH_COOKIE_PATH = '/api/v1';

export type AuthSource = 'bridge' | 'local';

const FACULTY_PORTAL_ROUTES = new Set([
	'/my',
	'/my/schedule',
	'/my/preferences',
	'/my/room-preferences',
]);

function readSessionStorage(key: string): string | null {
	try {
		return sessionStorage.getItem(key);
	} catch {
		return null;
	}
}

function writeSessionStorage(key: string, value: string): void {
	try {
		sessionStorage.setItem(key, value);
	} catch {
		// Ignore storage write failures (private mode / restricted storage).
	}
}

function readLocalStorage(key: string): string | null {
	try {
		return localStorage.getItem(key);
	} catch {
		return null;
	}
}

function writeLocalStorage(key: string, value: string): void {
	try {
		localStorage.setItem(key, value);
	} catch {
		// Ignore storage write failures (private mode / restricted storage).
	}
}

function removeSessionStorage(key: string): void {
	try {
		sessionStorage.removeItem(key);
	} catch {
		// Ignore storage write failures (private mode / restricted storage).
	}
}

function removeLocalStorage(key: string): void {
	try {
		localStorage.removeItem(key);
	} catch {
		// Ignore storage write failures (private mode / restricted storage).
	}
}

function hasDocumentCookie(): boolean {
	return typeof document !== 'undefined' && typeof document.cookie === 'string';
}

function secureCookieAttribute(): string {
	try {
		return window.location.protocol === 'https:' ? '; Secure' : '';
	} catch {
		return '';
	}
}

function writeAtlasAuthCookie(token: string, remember: boolean): void {
	if (!hasDocumentCookie()) return;
	const maxAge = remember ? '; Max-Age=2592000' : '';
	document.cookie = `${ATLAS_AUTH_COOKIE_NAME}=${encodeURIComponent(token)}; Path=${ATLAS_AUTH_COOKIE_PATH}; SameSite=Lax${maxAge}${secureCookieAttribute()}`;
}

export function clearAtlasAuthCookie(): void {
	if (!hasDocumentCookie()) return;
	const expires = '; Expires=Thu, 01 Jan 1970 00:00:00 GMT; Max-Age=0';
	const secure = secureCookieAttribute();
	document.cookie = `${ATLAS_AUTH_COOKIE_NAME}=; Path=${ATLAS_AUTH_COOKIE_PATH}; SameSite=Lax${expires}${secure}`;
	document.cookie = `${ATLAS_AUTH_COOKIE_NAME}=; Path=/; SameSite=Lax${expires}${secure}`;
}

export function getLocalToken(): string | null {
	const sessionToken = readSessionStorage(ATLAS_LOCAL_TOKEN_KEY);
	if (sessionToken) {
		writeAtlasAuthCookie(sessionToken, Boolean(readLocalStorage(ATLAS_LOCAL_TOKEN_KEY)));
		return sessionToken;
	}

	const rememberedToken = readLocalStorage(ATLAS_LOCAL_TOKEN_KEY);
	if (rememberedToken) {
		writeSessionStorage(ATLAS_LOCAL_TOKEN_KEY, rememberedToken);
		writeAtlasAuthCookie(rememberedToken, true);
		return rememberedToken;
	}

	return null;
}

export function getBridgeToken(): string | null {
	const token = readSessionStorage(ATLAS_BRIDGE_TOKEN_KEY);
	if (token) writeAtlasAuthCookie(token, false);
	return token;
}

export function getPreferredAccessToken(): string | null {
	return getLocalToken() ?? getBridgeToken();
}

export function setLocalToken(token: string, remember = false): void {
	writeSessionStorage(ATLAS_LOCAL_TOKEN_KEY, token);
	writeAtlasAuthCookie(token, remember);
	if (remember) {
		writeLocalStorage(ATLAS_LOCAL_TOKEN_KEY, token);
	} else {
		removeLocalStorage(ATLAS_LOCAL_TOKEN_KEY);
	}
	notifyAtlasTokenEpochChange();
}

export function setBridgeToken(token: string): void {
	writeSessionStorage(ATLAS_BRIDGE_TOKEN_KEY, token);
	writeAtlasAuthCookie(token, false);
	notifyAtlasTokenEpochChange();
}

export function clearLocalToken(): void {
	removeSessionStorage(ATLAS_LOCAL_TOKEN_KEY);
	removeLocalStorage(ATLAS_LOCAL_TOKEN_KEY);
	clearAtlasAuthCookie();
	notifyAtlasTokenEpochChange();
}

export function clearBridgeToken(): void {
	removeSessionStorage(ATLAS_BRIDGE_TOKEN_KEY);
	clearAtlasAuthCookie();
	notifyAtlasTokenEpochChange();
}

export function clearUserRoleCache(): void {
	removeLocalStorage('userRole');
}

export function isFacultyPortalRoute(pathname: string): boolean {
	return FACULTY_PORTAL_ROUTES.has(pathname);
}

export function hasAnyAuthToken(): boolean {
	return Boolean(getPreferredAccessToken());
}

export function clearAtlasAuthStorage(): void {
	clearLocalToken();
	clearBridgeToken();
	clearUserRoleCache();
}
