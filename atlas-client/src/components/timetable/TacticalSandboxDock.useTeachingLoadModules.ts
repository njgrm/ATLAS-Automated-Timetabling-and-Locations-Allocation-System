import { useEffect, useRef, useState } from 'react';

import atlasApi from '@/lib/api';

import {
	buildCapabilityOverrideMutation,
	buildQualificationApplyPayload,
	buildQualificationPreviewPayload,
	buildRedistributionRequest,
	canonicalRefusalFromError,
	capabilityOverrideRefusalCopy,
	createEmptyCapabilityOverrideDraft,
	previewErrorCopy,
	qualificationRefusalCopy,
	summarizeReadiness,
	summarizeRedistribution,
	type CapabilityOverrideDraft,
	type CapabilityOverridePreviewState,
	type QualificationPreviewState,
	type ReadinessSummary,
	type RedistributionSummary,
} from './TacticalSandboxDock.helpers';

/**
 * TT-TL-MODULES-C04R1 (F5) — the focused Teaching Load mini-module state.
 *
 * Extracted verbatim from `TacticalSandboxDock.tsx` so the dock keeps a single
 * presenter and stays well under the mandatory 1000-physical-line limit. The
 * behavior is unchanged: the redistribution card dispatches only the canonical
 * read-only `previewOnly: true` request, the qualification module previews
 * read-only and applies only with the server-issued fingerprint and the
 * server-issued confirmation text, and both clear on a school/year/run change.
 */
export type TeachingLoadModules = {
	redistributionSummary: RedistributionSummary | null;
	redistributionReadiness: ReadinessSummary | null;
	redistributionLoading: boolean;
	redistributionError: string | null;
	qualificationOpen: boolean;
	setQualificationOpen: (open: boolean) => void;
	qualificationAliases: Array<{ key: string; value: string }>;
	setQualificationAliases: (rows: Array<{ key: string; value: string }>) => void;
	qualificationLabels: Array<{ key: string; value: string }>;
	setQualificationLabels: (rows: Array<{ key: string; value: string }>) => void;
	qualificationPreview: QualificationPreviewState | null;
	qualificationPreviewing: boolean;
	qualificationApplying: boolean;
	qualificationConfirmation: string;
	setQualificationConfirmation: (value: string) => void;
	qualificationStatus: string | null;
	qualificationError: string | null;
	capabilityDraft: CapabilityOverrideDraft;
	setCapabilityDraft: (draft: CapabilityOverrideDraft) => void;
	capabilityPreview: CapabilityOverridePreviewState | null;
	capabilityPreviewing: boolean;
	capabilityApplying: boolean;
	capabilityConfirmation: string;
	setCapabilityConfirmation: (value: string) => void;
	capabilityStatus: string | null;
	capabilityError: string | null;
	triggerRedistributionPreview: () => Promise<void>;
	previewQualificationAuthority: () => Promise<void>;
	applyQualificationAuthority: () => Promise<void>;
	previewCapabilityOverride: (facultyId: number | null) => Promise<void>;
	applyCapabilityOverride: (facultyId: number | null) => Promise<void>;
};

export function useTeachingLoadModules(scope: {
	schoolId: number | null | undefined;
	schoolYearId: number | null | undefined;
	scopeKey: string;
}): TeachingLoadModules {
	const { schoolId, schoolYearId, scopeKey } = scope;
	const [redistributionSummary, setRedistributionSummary] = useState<RedistributionSummary | null>(null);
	const [redistributionReadiness, setRedistributionReadiness] = useState<ReadinessSummary | null>(null);
	const [redistributionLoading, setRedistributionLoading] = useState(false);
	const [redistributionError, setRedistributionError] = useState<string | null>(null);
	const [qualificationOpen, setQualificationOpen] = useState(false);
	const [qualificationAliases, setQualificationAliases] = useState<Array<{ key: string; value: string }>>([]);
	const [qualificationLabels, setQualificationLabels] = useState<Array<{ key: string; value: string }>>([]);
	const [qualificationPreview, setQualificationPreview] = useState<QualificationPreviewState | null>(null);
	const [qualificationPreviewing, setQualificationPreviewing] = useState(false);
	const [qualificationApplying, setQualificationApplying] = useState(false);
	const [qualificationConfirmation, setQualificationConfirmation] = useState('');
	const [qualificationStatus, setQualificationStatus] = useState<string | null>(null);
	const [qualificationError, setQualificationError] = useState<string | null>(null);
	// F2: bounded capability-override state (selected teacher/subject only).
	const [capabilityDraft, setCapabilityDraft] = useState<CapabilityOverrideDraft>(() => createEmptyCapabilityOverrideDraft());
	const [capabilityPreview, setCapabilityPreview] = useState<CapabilityOverridePreviewState | null>(null);
	const [capabilityPreviewing, setCapabilityPreviewing] = useState(false);
	const [capabilityApplying, setCapabilityApplying] = useState(false);
	const [capabilityConfirmation, setCapabilityConfirmation] = useState('');
	const [capabilityStatus, setCapabilityStatus] = useState<string | null>(null);
	const [capabilityError, setCapabilityError] = useState<string | null>(null);
	// Monotonic request epoch: any scope change invalidates in-flight module
	// responses so a stale school/year payload can never be rendered.
	const requestRef = useRef(0);

	// R8(d): module state is scope-bound and clears on school/year/run change.
	useEffect(() => {
		setRedistributionSummary(null);
		setRedistributionReadiness(null);
		setRedistributionError(null);
		setRedistributionLoading(false);
		requestRef.current += 1;
		setQualificationPreview(null);
		setQualificationError(null);
		setQualificationStatus(null);
		setQualificationConfirmation('');
		setQualificationOpen(false);
		setCapabilityPreview(null);
		setCapabilityError(null);
		setCapabilityStatus(null);
		setCapabilityConfirmation('');
		setCapabilityDraft(createEmptyCapabilityOverrideDraft());
	}, [scopeKey]);

	/**
	 * R3: read-only redistribution summary. It dispatches at most the canonical
	 * `previewOnly: true` request and the canonical readiness read; it never
	 * sends `previewOnly:false`/`confirmApply`, so it cannot rebind Teaching Load.
	 */
	async function triggerRedistributionPreview() {
		const request = buildRedistributionRequest({ schoolId, schoolYearId });
		if (!request) {
			setRedistributionSummary(null);
			setRedistributionReadiness(null);
			setRedistributionError(null);
			return;
		}
		const epoch = ++requestRef.current;
		setRedistributionLoading(true);
		setRedistributionError(null);
		try {
			const { data: rebalance } = await atlasApi.post(`/faculty-assignments/coverage/rebalance-over-cap`, request);
			if (epoch !== requestRef.current) return;
			setRedistributionSummary(summarizeRedistribution(rebalance));
		} catch (error) {
			if (epoch !== requestRef.current) return;
			setRedistributionSummary(null);
			setRedistributionError(previewErrorCopy(error));
		}
		try {
			const { data: readiness } = await atlasApi.get(`/faculty-assignments/reconciliation/readiness`, {
				params: { schoolId: request.schoolId, schoolYearId: request.schoolYearId },
			});
			if (epoch !== requestRef.current) return;
			setRedistributionReadiness(summarizeReadiness(readiness));
		} catch (error) {
			if (epoch !== requestRef.current) return;
			setRedistributionReadiness(null);
			setRedistributionError((previous) => previous ?? previewErrorCopy(error));
		} finally {
			if (epoch === requestRef.current) setRedistributionLoading(false);
		}
	}

	/** R4: read-only department-authority preview; issues the server fingerprint. */
	async function previewQualificationAuthority() {
		const payload = buildQualificationPreviewPayload({ schoolId }, qualificationAliases, qualificationLabels);
		if (!payload) {
			setQualificationError('An authenticated school scope is required before qualification authority can be previewed.');
			return;
		}
		const epoch = ++requestRef.current;
		setQualificationPreviewing(true);
		setQualificationError(null);
		setQualificationStatus(null);
		try {
			const { data } = await atlasApi.post(`/faculty-assignments/department-authority/preview`, payload);
			if (epoch !== requestRef.current) return;
			const changes = Array.isArray(data?.changes) ? data.changes as Array<{ action?: string }> : [];
			// F3: the confirmation text is the server-issued value; the client
			// never holds a local phrase authority.
			const issuedConfirmation = typeof data?.confirmationText === 'string' && data.confirmationText
				? data.confirmationText
				: null;
			setQualificationPreview({
				fingerprint: typeof data?.fingerprint === 'string' && data.fingerprint ? data.fingerprint : null,
				expectedSourceRevision: data?.sourceRevision ?? null,
				confirmationText: issuedConfirmation,
				conflicts: changes.filter((change) => change.action === 'conflict').length,
				creates: changes.filter((change) => change.action === 'create').length,
			});
			setQualificationConfirmation('');
			setQualificationStatus('Preview complete. Nothing was written; apply is now authorized by this fingerprint.');
		} catch (error) {
			if (epoch !== requestRef.current) return;
			const refusal = canonicalRefusalFromError(error);
			setQualificationPreview(null);
			setQualificationError(qualificationRefusalCopy(refusal.code, refusal.message));
		} finally {
			if (epoch === requestRef.current) setQualificationPreviewing(false);
		}
	}

	/**
	 * R4: fingerprinted apply. Blocked until the server preview issued a
	 * fingerprint and the operator typed the server-issued confirmation text.
	 */
	async function applyQualificationAuthority() {
		const payload = buildQualificationApplyPayload({ schoolId }, qualificationAliases, qualificationLabels, qualificationPreview, qualificationConfirmation);
		if (!payload) {
			setQualificationError(qualificationRefusalCopy('FINGERPRINT_REQUIRED'));
			return;
		}
		const epoch = ++requestRef.current;
		setQualificationApplying(true);
		setQualificationError(null);
		setQualificationStatus(null);
		try {
			const { data } = await atlasApi.post(`/faculty-assignments/department-authority/apply`, payload);
			if (epoch !== requestRef.current) return;
			const created = Array.isArray(data?.created) ? data.created.length : 0;
			const conflicting = Array.isArray(data?.conflicting) ? data.conflicting.length : 0;
			setQualificationStatus(
				conflicting > 0
					? `Nothing was written: ${conflicting} conflicting authority row${conflicting === 1 ? '' : 's'} must be resolved before apply.`
					: `Applied ${created} authority row${created === 1 ? '' : 's'}. Nothing else changed.`,
			);
			if (conflicting === 0) {
				setQualificationPreview(null);
				setQualificationConfirmation('');
			}
		} catch (error) {
			if (epoch !== requestRef.current) return;
			const refusal = canonicalRefusalFromError(error);
			setQualificationError(qualificationRefusalCopy(refusal.code, refusal.message));
		} finally {
			if (epoch === requestRef.current) setQualificationApplying(false);
		}
	}

	/**
	 * F2: read-only capability-override preview for the selected teacher. Emits
	 * nothing while no teacher is selected or the school/year is unresolved.
	 */
	async function previewCapabilityOverride(facultyId: number | null) {
		const mutation = buildCapabilityOverrideMutation(capabilityDraft, facultyId);
		if (!mutation || !Number.isInteger(schoolId) || !Number.isInteger(schoolYearId)) {
			setCapabilityError('Select a teacher and an active school year before previewing a capability override.');
			return;
		}
		const epoch = ++requestRef.current;
		setCapabilityPreviewing(true);
		setCapabilityError(null);
		setCapabilityStatus(null);
		try {
			const { data } = await atlasApi.post('/faculty-assignments/capability-overrides/preview', {
				schoolId,
				schoolYearId,
				mutation,
			});
			if (epoch !== requestRef.current) return;
			const changeAction = typeof data?.change?.action === 'string' ? data.change.action as CapabilityOverridePreviewState['changeAction'] : null;
			setCapabilityPreview({
				fingerprint: typeof data?.fingerprint === 'string' && data.fingerprint ? data.fingerprint : null,
				expectedSourceRevision: data?.sourceRevision ?? null,
				confirmationText: typeof data?.confirmationText === 'string' && data.confirmationText ? data.confirmationText : null,
				changeAction,
				subjectCode: typeof data?.change?.subjectCode === 'string' ? data.change.subjectCode : data?.change?.subjectCode ?? null,
				specializationCode: typeof data?.change?.specializationCode === 'string' ? data.change.specializationCode : data?.change?.specializationCode ?? null,
				conflictCount: 0,
			});
			setCapabilityConfirmation('');
			setCapabilityStatus('Preview complete. Nothing was written; apply is now authorized by this fingerprint.');
		} catch (error) {
			if (epoch !== requestRef.current) return;
			const refusal = canonicalRefusalFromError(error);
			setCapabilityPreview(null);
			setCapabilityError(capabilityOverrideRefusalCopy(refusal.code, refusal.message));
		} finally {
			if (epoch === requestRef.current) setCapabilityPreviewing(false);
		}
	}

	/**
	 * F2: fingerprinted, source-revision-bound apply. Blocked until the server
	 * preview issued a fingerprint and the operator typed the server-issued
	 * confirmation text. There is no client-side phrase authority.
	 */
	async function applyCapabilityOverride(facultyId: number | null) {
		const mutation = buildCapabilityOverrideMutation(capabilityDraft, facultyId);
		if (!mutation || !capabilityPreview?.fingerprint || !capabilityPreview.confirmationText) {
			setCapabilityError(capabilityOverrideRefusalCopy('FINGERPRINT_MISMATCH'));
			return;
		}
		if (capabilityConfirmation !== capabilityPreview.confirmationText) {
			setCapabilityError(capabilityOverrideRefusalCopy('CONFIRMATION_REQUIRED'));
			return;
		}
		const epoch = ++requestRef.current;
		setCapabilityApplying(true);
		setCapabilityError(null);
		setCapabilityStatus(null);
		try {
			const { data } = await atlasApi.post('/faculty-assignments/capability-overrides/apply', {
				schoolId,
				schoolYearId,
				mutation,
				expectedFingerprint: capabilityPreview.fingerprint,
				expectedSourceRevision: capabilityPreview.expectedSourceRevision,
				confirmationText: capabilityConfirmation,
			});
			if (epoch !== requestRef.current) return;
			setCapabilityStatus(
				data?.replayed === true
					? 'Capability override already matches; nothing changed.'
					: `Capability override ${data?.change?.action ?? 'applied'}. Exactly one policy config and one audit row changed.`,
			);
			setCapabilityPreview(null);
			setCapabilityConfirmation('');
		} catch (error) {
			if (epoch !== requestRef.current) return;
			const refusal = canonicalRefusalFromError(error);
			setCapabilityError(capabilityOverrideRefusalCopy(refusal.code, refusal.message));
		} finally {
			if (epoch === requestRef.current) setCapabilityApplying(false);
		}
	}

	return {
		redistributionSummary,
		redistributionReadiness,
		redistributionLoading,
		redistributionError,
		qualificationOpen,
		setQualificationOpen,
		qualificationAliases,
		setQualificationAliases,
		qualificationLabels,
		setQualificationLabels,
		qualificationPreview,
		qualificationPreviewing,
		qualificationApplying,
		qualificationConfirmation,
		setQualificationConfirmation,
		qualificationStatus,
		qualificationError,
		capabilityDraft,
		setCapabilityDraft,
		capabilityPreview,
		capabilityPreviewing,
		capabilityApplying,
		capabilityConfirmation,
		setCapabilityConfirmation,
		capabilityStatus,
		capabilityError,
		triggerRedistributionPreview,
		previewQualificationAuthority,
		applyQualificationAuthority,
		previewCapabilityOverride,
		applyCapabilityOverride,
	};
}
