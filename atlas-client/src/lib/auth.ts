export const ATLAS_BRIDGE_TOKEN_KEY = 'atlas_bridge_token';
export const ATLAS_LOCAL_TOKEN_KEY = 'atlas_local_token';
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
}

export function setBridgeToken(token: string): void {
	writeSessionStorage(ATLAS_BRIDGE_TOKEN_KEY, token);
	writeAtlasAuthCookie(token, false);
}

export function clearLocalToken(): void {
	removeSessionStorage(ATLAS_LOCAL_TOKEN_KEY);
	removeLocalStorage(ATLAS_LOCAL_TOKEN_KEY);
	clearAtlasAuthCookie();
}

export function clearBridgeToken(): void {
	removeSessionStorage(ATLAS_BRIDGE_TOKEN_KEY);
	clearAtlasAuthCookie();
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
