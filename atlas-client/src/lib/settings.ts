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
		activeSchoolYearId: number | null;
		activeSchoolYearLabel: string | null;
	};
	activeYearDrift?: {
		status: 'aligned' | 'atlas-stale' | 'enrollpro-unreachable' | 'mapping-conflict';
		message: string;
		recommendedAction: 'NONE' | 'RUN_ROLLOVER_SYNC' | 'REVIEW_MAPPING_CONFLICT' | 'RETRY_ENROLLPRO' | 'RESET_DUMMY_YEAR' | 'RUN_ARCHIVE_AND_SYNC';
		atlasSchoolYearId: number | null;
		enrollProSchoolYearId: number | null;
		enrollProSchoolYearLabel: string | null;
		mirrorSyncedAt: string | null;
	};
	rollover?: {
		mirror: {
			enrollProSchoolYearId: number;
			yearLabel: string;
			isActive: boolean;
			lastVerifiedAt: string | null;
			lastSyncedAt: string | null;
			facultyCount: number;
			sectionCount: number;
			syncStatus: string;
			lastFailureSummary: string | null;
		} | null;
	};
	activeTerm?: {
		source: 'enrollpro-verified' | 'enrollpro-unreachable' | 'enrollpro-contract-drift' | 'atlas-unverified';
		reachable: boolean;
		verified: boolean;
		activeTerm: string | null;
		termIndex: number | null;
		schoolYearId: number | null;
		matchedSchoolYear: boolean | null;
		code: string | null;
		message: string;
	};
}

export interface ArchivedYearSummary {
	enrollProSchoolYearId: number;
	yearLabel: string;
	archivedAt: string | null;
	archivedBy: number | null;
	archiveReason: string | null;
	preservedCounts: Record<string, number> | null;
}

export interface RolloverStatus {
	schoolId: number;
	atlasSchoolYearId: number | null;
	enrollProActiveYear: { id: number; yearLabel: string } | null;
	drift: NonNullable<AtlasRuntimeContext['activeYearDrift']>;
	mirror: NonNullable<AtlasRuntimeContext['rollover']>['mirror'];
	counts?: {
		facultyCount: number;
		sectionCount: number;
		settingsReachable: boolean;
	};
	conflicts: Array<{ code: string; message: string; details?: Record<string, unknown> }>;
	reconfiguredSections: Array<{
		externalId: number;
		sectionName: string;
		previousName: string | null;
		previousGradeLevelId: number | null;
		previousProgramType: string | null;
		newName: string;
		newGradeLevelId: number;
		newProgramType: string;
	}>;
	automation?: {
		enabled: boolean;
		lastAttemptAt: string | null;
		lastResult: string | null;
		nextAttemptAt: string | null;
		consecutiveFailures: number;
		currentlyApplying: boolean;
		testModeEnabled?: boolean;
	} | null;
	canResetDummyYear: boolean;
	resetTargetSchoolYearId: number | null;
	conflictingRecordCounts: RolloverDummyYearRecordCounts | null;
	teachingLoadResetRequired: boolean;
	publishedResetBlocked: boolean;
	/** RR-09A: years already archived as read-only history. */
	archivedYears?: ArchivedYearSummary[];
}

export interface RolloverApplyResult extends RolloverStatus {
	applied: boolean;
	sync: {
		faculty: unknown;
		sections: unknown;
		policyReady: boolean;
	};
}

export interface RolloverDummyYearRecordCounts {
	sectionMirrors: number;
	facultyPreferences: number;
	preferenceTimeSlots: number;
	preferenceReviews: number;
	facultyRoomPreferences: number;
	roomRequestAppeals: number;
	roomRequestAppealHistory: number;
	schedulingPolicies: number;
	generationRuns: number;
	publishedGenerationRuns: number;
	manualScheduleEdits: number;
	followUpFlags: number;
	publishedScheduleRevisions: number;
	auditLogs: number;
	lockedSessions: number;
	lockedSessionActions: number;
	gradeShiftWindows: number;
	facultySnapshots: number;
	sectionSnapshots: number;
	instructionalCohorts: number;
	teachingLoadFacultySubjects: number;
	teachingLoadOwnerships: number;
}

export interface RolloverDummyYearResetResult extends RolloverStatus {
	previewOnly: boolean;
	resetApplied: boolean;
	reset: {
		targetSchoolYearId: number | null;
		confirmationText: string;
		canResetDummyYear: boolean;
		publishedResetBlocked: boolean;
		teachingLoadResetRequired: boolean;
		counts: RolloverDummyYearRecordCounts;
		blockers: Array<{ code: string; message: string; details?: Record<string, unknown> }>;
	};
	rolloverApply: RolloverApplyResult | null;
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
	const h = parseInt(parts[0], 10) || 0;
	const s = parseInt(parts[1], 10) || 0;
	const l = parseInt(parts[2], 10) || 0;
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

	// Derived brand variants for translucent gradients, glows, and chart fills
	const light = Math.min(l + 15, 95);
	const dark = Math.max(l - 15, 5);
	root.style.setProperty('--primary-light', `${h} ${s}% ${light}%`);
	root.style.setProperty('--primary-dark', `${h} ${s}% ${dark}%`);

	// RGB triplet for translucent use (e.g., hsl(var(--primary) / 0.3) -> rgb(...))
	const r = Math.round(((1 - Math.abs(2 * l / 100 - 1)) * s / 100) * [0, 1, 2].reduce((m, i) => {
		const c = [0, 0, 0];
		const x = (1 - Math.abs((l / 50 + i * 2) % 2 - 1));
		c[i] = Math.round(255 * (l < 50 ? (s / 100 * l / 50) : (s / 100 * (1 - l / 50) + l / 50)));
		return m;
	}, 0) || 0);
	// Simple approximation for RGB from HSL
	const rgb = hslToRgb(h, s, l);
	root.style.setProperty('--primary-rgb', rgb);

	try { localStorage.setItem(ACCENT_CACHE_KEY, hsl); } catch { /* storage unavailable */ }
}

function hslToRgb(h: number, s: number, l: number): string {
	const sNorm = s / 100;
	const lNorm = l / 100;
	const c = (1 - Math.abs(2 * lNorm - 1)) * sNorm;
	const x = c * (1 - Math.abs((h / 60) % 2 - 1));
	const m = lNorm - c / 2;
	let r = 0, g = 0, b = 0;
	if (h < 60) { r = c; g = x; }
	else if (h < 120) { r = x; g = c; }
	else if (h < 180) { g = c; b = x; }
	else if (h < 240) { g = x; b = c; }
	else if (h < 300) { r = x; b = c; }
	else { r = c; b = x; }
	return `${Math.round((r + m) * 255)}, ${Math.round((g + m) * 255)}, ${Math.round((b + m) * 255)}`;
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

// ─── Actor school scoping (Prompt 01A) ───
// Mutation ownership must come from the authenticated actor, never a client
// constant. Resolves the caller's schoolId from /auth/me once per session.

let cachedActorSchoolId: number | null = null;

export async function resolveActorSchoolId(): Promise<number | null> {
	if (cachedActorSchoolId != null) return cachedActorSchoolId;
	try {
		const { data } = await atlasApi.get<{ user?: { schoolId?: number | null } }>('/auth/me');
		const schoolId = data?.user?.schoolId;
		if (typeof schoolId === 'number' && Number.isInteger(schoolId) && schoolId > 0) {
			cachedActorSchoolId = schoolId;
			return schoolId;
		}
	} catch {
		// unauthenticated or auth/me unavailable — caller decides fallback
	}
	return null;
}

export async function fetchAtlasRuntimeContext(schoolId = 1, verifyUpstream = false): Promise<AtlasRuntimeContext> {
	const { data } = await atlasApi.get<AtlasRuntimeContext>('/runtime/context', {
		params: { schoolId, verifyUpstream: verifyUpstream ? 'true' : undefined },
	});
	return data;
}

export async function fetchRolloverStatus(schoolId = 1, includeCounts = false): Promise<RolloverStatus> {
	const { data } = await atlasApi.get<RolloverStatus>('/runtime/rollover-status', {
		params: { schoolId, includeCounts },
	});
	return data;
}

export async function previewRolloverSync(schoolId = 1): Promise<RolloverStatus> {
	const { data } = await atlasApi.post<RolloverStatus>('/runtime/rollover-sync/preview', { schoolId });
	return data;
}

export async function applyRolloverSync(schoolId = 1, options?: { acknowledgeReconfiguredSectionIds?: number[] }): Promise<RolloverApplyResult> {
	const { data } = await atlasApi.post<RolloverApplyResult>('/runtime/rollover-sync/apply', {
		schoolId,
		acknowledgeReconfiguredSectionIds: options?.acknowledgeReconfiguredSectionIds,
	});
	return data;
}

export async function resetDummyRolloverYear(
	schoolId = 1,
	input?: { confirmReset?: boolean; confirmationText?: string },
): Promise<RolloverDummyYearResetResult> {
	const { data } = await atlasApi.post<RolloverDummyYearResetResult>('/runtime/rollover-sync/reset-dummy-year', {
		schoolId,
		confirmReset: input?.confirmReset ?? false,
		confirmationText: input?.confirmationText,
	});
	return data;
}

export type RecoveryClassification =
	| 'AUTO_ROLLOVER_READY'
	| 'MANUAL_RECONFIGURE_REQUIRED'
	| 'MANUAL_MAPPING_CONFLICT_REQUIRED'
	| 'TEST_DATA_RECOVERY_AVAILABLE'
	| 'TEST_DATA_RECOVERY_BLOCKED'
	| 'ARCHIVE_AND_SYNC_AVAILABLE'
	| 'ENROLLPRO_UNREACHABLE';

export interface RecoveryClassifierResult {
	classification: RecoveryClassification;
	schoolId: number;
	enrollProActiveYear: { id: number; yearLabel: string } | null;
	atlasSchoolYearId: number | null;
	conflictCode: string | null;
	artifactCounts: Record<string, number> | null;
	blockers: Array<{ code: string; message: string }>;
	confirmationText: string;
	message: string;
	canClearTestData: boolean;
	publishedResetBlocked?: boolean;
	testDataMarked: boolean;
}

export async function fetchRecoveryClassification(schoolId = 1): Promise<RecoveryClassifierResult> {
	const { data } = await atlasApi.get<RecoveryClassifierResult>('/runtime/rollover-recovery/classify', {
		params: { schoolId },
	});
	return data;
}

export async function previewTestYearRecovery(schoolId = 1): Promise<RecoveryClassifierResult> {
	const { data } = await atlasApi.get<RecoveryClassifierResult>('/runtime/rollover-recovery/preview', {
		params: { schoolId },
	});
	return data;
}

export async function applyTestYearRecovery(schoolId = 1, input?: {
	confirmClear?: boolean;
	confirmationText?: string;
	acknowledgePublished?: boolean;
}): Promise<{ preview: RecoveryClassifierResult; cleared: boolean; sync: unknown }> {
	const { data } = await atlasApi.post('/runtime/rollover-recovery/apply', {
		schoolId,
		confirmClear: input?.confirmClear ?? false,
		confirmationText: input?.confirmationText,
		acknowledgePublished: input?.acknowledgePublished ?? false,
	});
	return data;
}

export async function markSchoolYearAsTestData(schoolId: number, schoolYearId: number): Promise<{
	marked: boolean;
	schoolId: number;
	schoolYearId: number;
}> {
	const { data } = await atlasApi.post('/runtime/rollover-recovery/mark-test-data', {
		schoolId,
		schoolYearId,
	});
	return data;
}

// ─── RR-09A: Non-destructive school-year archive + sync ───

export interface ArchivePreviewYear {
	schoolYearId: number;
	yearLabel: string;
	preservedCounts: Record<string, number>;
}

export interface ArchiveAndSyncPreviewResult {
	schoolId: number;
	enrollProActiveYear: { id: number; yearLabel: string } | null;
	atlasSchoolYearId: number | null;
	drift: NonNullable<AtlasRuntimeContext['activeYearDrift']>;
	yearsToArchive: ArchivePreviewYear[];
	labelReconcileRequired: boolean;
	syncPlan: string;
	summary: string;
}

export interface ArchiveAndSyncApplyResult {
	schoolId: number;
	enrollProActiveYear: { id: number; yearLabel: string };
	archivedYears: Array<{
		schoolYearId: number;
		yearLabel: string;
		alreadyArchived: boolean;
		archivedAt: string;
		preservedCounts: Record<string, number>;
	}>;
	labelReconciled: boolean;
	sync: RolloverApplyResult;
}

export async function previewArchiveAndSync(schoolId = 1): Promise<ArchiveAndSyncPreviewResult> {
	const { data } = await atlasApi.post<ArchiveAndSyncPreviewResult>('/runtime/rollover-archive/preview', {
		schoolId,
	});
	return data;
}

export async function applyArchiveAndSync(
	schoolId = 1,
	options?: { reason?: string; acknowledgeReconfiguredSectionIds?: number[] },
): Promise<ArchiveAndSyncApplyResult> {
	const { data } = await atlasApi.post<ArchiveAndSyncApplyResult>('/runtime/rollover-archive/apply', {
		schoolId,
		reason: options?.reason,
		acknowledgeReconfiguredSectionIds: options?.acknowledgeReconfiguredSectionIds,
	});
	return data;
}

export async function fetchSchoolYears(): Promise<SchoolYear[]> {
	// EnrollPro school-years requires a bridge token (issued only when the user
	// arrives through the EnrollPro -> ATLAS bridge). For direct-ATLAS logins
	// (faculty, locally-authenticated admins) there is no bridge token, and
	// calling this endpoint just produces repeated 401 noise on otherwise
	// healthy pages. Skip the call silently in that case — the active
	// school-year context is already owned by the ATLAS runtime resolver, and
	// the school-year switcher is an admin-bridge-only feature in v1.
	const token = sessionStorage.getItem(ATLAS_BRIDGE_TOKEN_KEY);
	if (!token) {
		return [];
	}
	try {
		const headers: Record<string, string> = { Authorization: `Bearer ${token}` };
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
	const token = sessionStorage.getItem(ATLAS_BRIDGE_TOKEN_KEY);
	if (!token) return null;
	try {
		const headers: Record<string, string> = { Authorization: `Bearer ${token}` };
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
