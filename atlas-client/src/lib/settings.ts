import axios from 'axios';
import atlasApi from './api';
import {
	ATLAS_BRIDGE_TOKEN_KEY,
	clearBridgeToken,
	clearLocalToken,
	getBridgeToken,
	getLocalToken,
	getPreferredAccessToken,
} from './auth';
import type { BridgeUser } from '@/types';

const SESSION_USER_CACHE_KEY = 'atlas:session-user:v1';

type SessionUserCacheRecord = {
	cachedAt: string;
	user: BridgeUser;
};

function readCachedSessionUser(): BridgeUser | null {
	try {
		const raw = localStorage.getItem(SESSION_USER_CACHE_KEY);
		if (!raw) return null;
		const parsed = JSON.parse(raw) as SessionUserCacheRecord;
		if (!parsed || typeof parsed.cachedAt !== 'string' || !parsed.user || typeof parsed.user.role !== 'string') {
			return null;
		}
		return parsed.user;
	} catch {
		return null;
	}
}

function writeCachedSessionUser(user: BridgeUser): void {
	try {
		const payload: SessionUserCacheRecord = {
			cachedAt: new Date().toISOString(),
			user,
		};
		localStorage.setItem(SESSION_USER_CACHE_KEY, JSON.stringify(payload));
	} catch {
		// Ignore storage restrictions.
	}
}

function clearCachedSessionUser(): void {
	try {
		localStorage.removeItem(SESSION_USER_CACHE_KEY);
	} catch {
		// Ignore storage restrictions.
	}
}

function isAuthFailure(error: unknown): boolean {
	if (!axios.isAxiosError(error)) return false;
	const status = error.response?.status;
	return status === 401 || status === 403;
}

function canReuseCachedSession(user: BridgeUser): boolean {
	if (user.authSource === 'local') {
		return Boolean(getLocalToken());
	}
	if (user.authSource === 'bridge') {
		return Boolean(getBridgeToken());
	}
	return Boolean(getPreferredAccessToken());
}

function resolveCachedSessionFallback(preferredSource: 'local' | 'bridge'): BridgeUser | null {
	const cached = readCachedSessionUser();
	if (!cached || !canReuseCachedSession(cached)) {
		return null;
	}

	if (cached.authSource === preferredSource) {
		return cached;
	}

	if (preferredSource === 'local' && cached.authSource === 'bridge' && getBridgeToken()) {
		return cached;
	}

	if (preferredSource === 'bridge' && cached.authSource === 'local' && getLocalToken()) {
		return cached;
	}

	return null;
}

export interface EnrollProSettings {
	schoolName: string;
	logoUrl: string | null;
	colorScheme: Record<string, unknown> | null;
	selectedAccentHsl: string | null;
	activeSchoolYearId: number | null;
	activeSchoolYearLabel: string | null;
}

export interface SchoolYear {
	id: number;
	yearLabel: string;
	status?: string;
	isActive: boolean;
}

export interface AtlasRuntimeContext {
	schoolId: number;
	activeSchoolYearId: number;
	activeSchoolYearLabel: string | null;
	source: 'atlas-persisted' | 'enrollpro-verified';
	stale: boolean;
	resolvedAt: string;
	evidence: Array<{
		type: string;
		schoolYearId: number;
		timestamp: string;
		source: string;
	}>;
	upstream: {
		reachable: boolean;
		verified: boolean;
		matched: boolean | null;
	};
}

function relativeLuminance(hsl: string): number {
	const parts = hsl.trim().split(/\s+/);
	if (parts.length < 3) return 0.5;
	const h = parseFloat(parts[0]) || 0;
	const s = (parseFloat(parts[1]) || 0) / 100;
	const l = (parseFloat(parts[2]) || 0) / 100;
	const a = s * Math.min(l, 1 - l);
	const f = (n: number) => {
		const k = (n + h / 30) % 12;
		const c = l - a * Math.max(Math.min(k - 3, 9 - k, 1), -1);
		return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
	};
	return 0.2126 * f(0) + 0.7152 * f(8) + 0.0722 * f(4);
}

function contrastForeground(hsl: string): string {
	const lum = relativeLuminance(hsl);
	const contrastWhite = 1.05 / (lum + 0.05);
	const contrastBlack = (lum + 0.05) / 0.05;
	return contrastWhite >= contrastBlack ? '0 0% 100%' : '0 0% 0%';
}

const ACCENT_CACHE_KEY = 'atlas:accent-hsl';

export function applyEnrollProAccentTheme(selectedAccentHsl: string | null | undefined): void {
	if (!selectedAccentHsl) return;
	const hsl = selectedAccentHsl;
	const fg = contrastForeground(hsl);
	const parts = hsl.split(/\s+/);
	const muted = `${parts[0]} ${parts[1]} 94%`;
	const root = document.documentElement;
	root.style.setProperty('--accent', hsl);
	root.style.setProperty('--accent-foreground', fg);
	root.style.setProperty('--accent-muted', muted);
	root.style.setProperty('--accent-ring', hsl);
	root.style.setProperty('--primary', 'var(--accent)');
	root.style.setProperty('--primary-foreground', 'var(--accent-foreground)');
	root.style.setProperty('--ring', 'var(--accent-ring)');
	root.style.setProperty('--sidebar-primary', 'var(--accent)');
	root.style.setProperty('--sidebar-primary-foreground', 'var(--accent-foreground)');
	root.style.setProperty('--sidebar-ring', 'var(--accent-ring)');
	root.style.setProperty('--sidebar-accent', muted);
	try { localStorage.setItem(ACCENT_CACHE_KEY, hsl); } catch { /* storage unavailable */ }
}

/** Apply cached accent synchronously before first paint to avoid default-blue flash. */
export function applyCachedAccentTheme(): void {
	try {
		const cached = localStorage.getItem(ACCENT_CACHE_KEY);
		if (cached) applyEnrollProAccentTheme(cached);
	} catch { /* storage unavailable */ }
}

const enrollProApiBase = '/enrollpro-api';

export async function fetchPublicSettings(): Promise<EnrollProSettings> {
	const { data } = await axios.get<EnrollProSettings>(`${enrollProApiBase}/settings/public`);
	return data;
}

export async function fetchAtlasRuntimeContext(schoolId = 1): Promise<AtlasRuntimeContext> {
	const { data } = await atlasApi.get<AtlasRuntimeContext>('/runtime/context', {
		params: { schoolId },
	});
	return data;
}

export async function fetchSchoolYears(): Promise<SchoolYear[]> {
	try {
		const token = sessionStorage.getItem(ATLAS_BRIDGE_TOKEN_KEY);
		const headers: Record<string, string> = {};
		if (token) headers.Authorization = `Bearer ${token}`;
		const { data } = await axios.get<{ years?: SchoolYear[]; schoolYears?: SchoolYear[] }>(`${enrollProApiBase}/school-years`, { headers });
		// EnrollPro returns { years: [...] }; handle both shapes for safety
		const list = data.years ?? data.schoolYears ?? [];
		return list;
	} catch {
		return [];
	}
}

export async function fetchActiveSchoolYear(activeId: number | null): Promise<string | null> {
	if (!activeId) return null;
	try {
		const token = sessionStorage.getItem(ATLAS_BRIDGE_TOKEN_KEY);
		const headers: Record<string, string> = {};
		if (token) headers.Authorization = `Bearer ${token}`;
		const { data } = await axios.get<{ years?: SchoolYear[]; schoolYears?: SchoolYear[] }>(`${enrollProApiBase}/school-years`, { headers });
		const list = data.years ?? data.schoolYears ?? [];
		const active = list.find((sy) => sy.id === activeId);
		return active?.yearLabel ?? null;
	} catch {
		return null;
	}
}

export async function verifySessionToken(): Promise<BridgeUser | null> {
	if (!getPreferredAccessToken()) {
		clearCachedSessionUser();
		return null;
	}

	const localToken = getLocalToken();
	if (localToken) {
		try {
			const { data } = await atlasApi.get<{ user: BridgeUser }>('/auth/me', {
				headers: {
					authorization: `Bearer ${localToken}`,
				},
			});
			const resolvedUser: BridgeUser = {
				...data.user,
				authSource: data.user.authSource ?? 'local',
			};
			writeCachedSessionUser(resolvedUser);
			return resolvedUser;
		} catch (error) {
			if (isAuthFailure(error)) {
				clearLocalToken();
				const cached = readCachedSessionUser();
				if (cached?.authSource === 'local') {
					clearCachedSessionUser();
				}
			} else {
				const cached = resolveCachedSessionFallback('local');
				if (cached) return cached;
			}
		}
	}

	const bridgeToken = getBridgeToken();
	if (!bridgeToken) return null;

	try {
		const { data } = await atlasApi.get<{ user: BridgeUser }>('/auth/me', {
			headers: {
				authorization: `Bearer ${bridgeToken}`,
			},
		});
		const resolvedUser: BridgeUser = {
			...data.user,
			authSource: data.user.authSource ?? 'bridge',
		};
		writeCachedSessionUser(resolvedUser);
		return resolvedUser;
	} catch (error) {
		if (isAuthFailure(error)) {
			clearBridgeToken();
			const cached = readCachedSessionUser();
			if (cached?.authSource === 'bridge') {
				clearCachedSessionUser();
			}
			return null;
		}

		return resolveCachedSessionFallback('bridge');
	}
}

export const verifyBridgeToken = verifySessionToken;
