/**
 * ACTOR-SCOPE-C01 — one shared production mechanism for session-bound actor
 * school/year authority.
 *
 * The authenticated token epoch (the exact `getPreferredAccessToken()` string,
 * versioned by `getAtlasTokenEpochVersion()`) owns the actor school. Every
 * scoped loader here:
 *   1. fails closed with zero dispatch when no token is present;
 *   2. resolves the actor school from `/auth/me` via `resolveActorSchoolId()`;
 *   3. re-checks the epoch before AND after the scoped request so a late
 *      response from an obsolete session can never be applied;
 *   4. reports the resolved `schoolId` so the caller binds to the same scope
 *      the request actually used.
 *
 * `useActorSchoolScope()` gives mounted React consumers the same guarantee:
 * on ANY token mutation it synchronously drops the previous school to `null`
 * (so no scoped request is dispatched from stale scope) and then re-resolves and
 * rebinds in place, without a full page reload.
 */

import { useCallback, useEffect, useState } from 'react';

import {
	getAtlasTokenEpochVersion,
	getPreferredAccessToken,
	subscribeAtlasTokenEpoch,
} from './auth';
import {
	fetchRecoveryClassification,
	fetchRolloverStatus,
	previewArchiveAndSync,
	resolveActorSchoolId,
	type ArchiveAndSyncPreviewResult,
	type RecoveryClassifierResult,
	type RolloverStatus,
} from './settings';
import {
	resolveActiveSchoolYearContext,
	type ActiveSchoolYearContext,
	type ResolveActiveSchoolYearContextOptions,
} from './enrollpro-public-settings';

export type ActorScopedResult<T> =
	| { status: 'ok'; value: T; schoolId: number }
	| { status: 'unresolved' }
	| { status: 'superseded' };

function isStrictPositiveSchoolId(value: unknown): value is number {
	return typeof value === 'number' && Number.isInteger(value) && value > 0;
}

/**
 * Resolve the actor school and run a scoped loader exactly once, discarding the
 * result if the session epoch changed at any point. Zero dispatch when the
 * session is absent or the actor school is unresolved.
 */
export async function runActorScoped<T>(
	loader: (schoolId: number) => Promise<T>,
): Promise<ActorScopedResult<T>> {
	const token = getPreferredAccessToken();
	if (!token) return { status: 'unresolved' };

	const epoch = getAtlasTokenEpochVersion();
	const schoolId = await resolveActorSchoolId();
	if (!isStrictPositiveSchoolId(schoolId)) return { status: 'unresolved' };
	if (getPreferredAccessToken() !== token || getAtlasTokenEpochVersion() !== epoch) {
		return { status: 'superseded' };
	}

	const value = await loader(schoolId);
	if (getPreferredAccessToken() !== token || getAtlasTokenEpochVersion() !== epoch) {
		return { status: 'superseded' };
	}
	return { status: 'ok', value, schoolId };
}

/** True when the in-flight request's captured epoch is still authoritative. */
export function isActorScopeCurrent(captured: { token: string | null; epochVersion: number }): boolean {
	return getPreferredAccessToken() === captured.token
		&& getAtlasTokenEpochVersion() === captured.epochVersion;
}

// ─── Shared actor-scoped loaders (the single production mechanism) ──────────

export function loadActorYearContext(
	options?: Omit<ResolveActiveSchoolYearContextOptions, 'schoolId'>,
): Promise<ActorScopedResult<ActiveSchoolYearContext>> {
	return runActorScoped((schoolId) => resolveActiveSchoolYearContext({ ...options, schoolId }));
}

export function loadActorRolloverStatus(
	includeCounts = false,
): Promise<ActorScopedResult<RolloverStatus>> {
	return runActorScoped((schoolId) => fetchRolloverStatus(schoolId, includeCounts));
}

export function loadActorRecoveryClassification(): Promise<ActorScopedResult<RecoveryClassifierResult>> {
	return runActorScoped((schoolId) => fetchRecoveryClassification(schoolId));
}

export function loadActorArchivePreview(): Promise<ActorScopedResult<ArchiveAndSyncPreviewResult>> {
	return runActorScoped((schoolId) => previewArchiveAndSync(schoolId));
}

// ─── Mounted React binding with immediate-null on epoch change ──────────────

export type ActorSchoolScopeBinding = {
	/** Resolved actor school, or null while unresolved/unauthenticated. */
	actorSchoolId: number | null;
	/** True once the current epoch's resolution attempt has settled. */
	resolved: boolean;
	/** Monotonic token-epoch version the binding was produced under. */
	epochVersion: number;
	/** The exact preferred access token the binding was produced under. */
	token: string | null;
	/** Re-run resolution for the current session (used by retry affordances). */
	retry: () => void;
};

/**
 * The resolved actor school for the current session. On ANY token mutation the
 * previously bound school is dropped to `null` synchronously in the subscription
 * handler (invalidating in-flight work) before re-resolution, so mounted
 * consumers cannot dispatch a scoped request from a previous session's scope.
 */
export function useActorSchoolScope(): ActorSchoolScopeBinding {
	const [state, setState] = useState<Omit<ActorSchoolScopeBinding, 'retry'>>(() => ({
		actorSchoolId: null,
		resolved: false,
		epochVersion: getAtlasTokenEpochVersion(),
		token: getPreferredAccessToken(),
	}));
	const [retryNonce, setRetryNonce] = useState(0);

	useEffect(() => {
		let disposed = false;
		let sequence = 0;

		const resolveNow = async () => {
			const requestSequence = ++sequence;
			const token = getPreferredAccessToken();
			const epoch = getAtlasTokenEpochVersion();
			if (!token) {
				if (!disposed && requestSequence === sequence) {
					setState({ actorSchoolId: null, resolved: true, epochVersion: epoch, token: null });
				}
				return;
			}
			const resolved = await resolveActorSchoolId();
			if (disposed || requestSequence !== sequence) return;
			if (getPreferredAccessToken() !== token || getAtlasTokenEpochVersion() !== epoch) return;
			setState({
				actorSchoolId: isStrictPositiveSchoolId(resolved) ? resolved : null,
				resolved: true,
				epochVersion: epoch,
				token,
			});
		};

		const unsubscribe = subscribeAtlasTokenEpoch(() => {
			// Synchronous immediate clear: invalidate any in-flight resolution and
			// drop the previous school BEFORE the new session is authoritative.
			sequence += 1;
			setState({
				actorSchoolId: null,
				resolved: false,
				epochVersion: getAtlasTokenEpochVersion(),
				token: getPreferredAccessToken(),
			});
			void resolveNow();
		});

		void resolveNow();
		return () => {
			disposed = true;
			unsubscribe();
		};
	}, [retryNonce]);

	const retry = useCallback(() => {
		setState((current) => ({ ...current, actorSchoolId: null, resolved: false }));
		setRetryNonce((nonce) => nonce + 1);
	}, []);

	return { ...state, retry };
}
