/**
 * BENEFICIARY-EXPORT-PARITY-C05R1 — Teacher Program export presentation
 * settings client.
 *
 * Dedicated export module: export/signatory API types live here rather than in
 * the shared `types.ts` (owned by the TL operator-workspace lane). Every route
 * is actor-school scoped; reads/previews are zero-write; a save is an
 * optimistic-revision (CAS) append.
 */

import { getPreferredAccessToken } from '@/lib/auth';

export type ExportPresentationSignatory = {
	name: string | null;
	title: string;
};

export type ExportPresentationProfile = {
	revision: number | null;
	schoolHead: ExportPresentationSignatory;
	psds: ExportPresentationSignatory;
	cidChief: ExportPresentationSignatory;
	asds: ExportPresentationSignatory;
	footerText: string | null;
};

export type ExportPresentationInput = {
	schoolHeadName?: string | null;
	schoolHeadTitle?: string | null;
	psdsName?: string | null;
	psdsTitle?: string | null;
	cidChiefName?: string | null;
	cidChiefTitle?: string | null;
	asdsName?: string | null;
	asdsTitle?: string | null;
	footerText?: string | null;
};

export type ExportPresentationSaveResult = {
	revision: number;
	replayed: boolean;
	auditId: number | null;
	profile: ExportPresentationProfile;
};

export class ExportPresentationError extends Error {
	readonly status: number;
	readonly code: string;

	constructor(status: number, code: string, message: string) {
		super(message);
		this.name = 'ExportPresentationError';
		this.status = status;
		this.code = code;
	}
}

export type ExportPresentationDeps = {
	fetchImpl?: typeof fetch;
	getAccessToken?: () => string | null;
};

function requireScope(schoolId: number, schoolYearId: number): void {
	if (!Number.isInteger(schoolId) || schoolId <= 0) throw new ExportPresentationError(0, 'SCOPE_REQUIRED', 'A resolved school is required.');
	if (!Number.isInteger(schoolYearId) || schoolYearId <= 0) throw new ExportPresentationError(0, 'SCOPE_REQUIRED', 'A resolved school year is required.');
}

export function exportPresentationUrl(schoolId: number, schoolYearId: number): string {
	return `/api/v1/export-presentation/${schoolId}/${schoolYearId}`;
}

export function exportPresentationPreviewUrl(schoolId: number, schoolYearId: number): string {
	return `${exportPresentationUrl(schoolId, schoolYearId)}/preview`;
}

async function parseError(response: Response): Promise<never> {
	const payload = await response.json().catch(() => null) as { code?: string; message?: string } | null;
	throw new ExportPresentationError(
		response.status,
		payload?.code ?? 'EXPORT_PRESENTATION_FAILED',
		payload?.message ?? 'Export presentation settings request failed.',
	);
}

/** Read the effective profile. Zero writes. */
export async function fetchExportPresentationProfile(
	schoolId: number,
	schoolYearId: number,
	deps: ExportPresentationDeps = {},
): Promise<ExportPresentationProfile> {
	requireScope(schoolId, schoolYearId);
	const response = await (deps.fetchImpl ?? fetch)(exportPresentationUrl(schoolId, schoolYearId), {
		headers: { Authorization: `Bearer ${(deps.getAccessToken ?? getPreferredAccessToken)() ?? ''}` },
	});
	if (!response.ok) await parseError(response);
	const body = await response.json() as { data: ExportPresentationProfile };
	return body.data;
}

/** Validate + echo the payload without persisting. Zero writes. */
export async function previewExportPresentationSettings(
	schoolId: number,
	schoolYearId: number,
	input: ExportPresentationInput,
	deps: ExportPresentationDeps = {},
): Promise<{ profile: ExportPresentationProfile; currentRevision: number | null }> {
	requireScope(schoolId, schoolYearId);
	const response = await (deps.fetchImpl ?? fetch)(exportPresentationPreviewUrl(schoolId, schoolYearId), {
		method: 'POST',
		headers: {
			'Content-Type': 'application/json',
			Authorization: `Bearer ${(deps.getAccessToken ?? getPreferredAccessToken)() ?? ''}`,
		},
		body: JSON.stringify({ profile: input }),
	});
	if (!response.ok) await parseError(response);
	const body = await response.json() as { data: { profile: ExportPresentationProfile; currentRevision: number | null } };
	return body.data;
}

/** Append one audited revision under optimistic revision CAS. */
export async function saveExportPresentationSettings(
	schoolId: number,
	schoolYearId: number,
	expectedRevision: number,
	input: ExportPresentationInput,
	deps: ExportPresentationDeps = {},
): Promise<ExportPresentationSaveResult> {
	requireScope(schoolId, schoolYearId);
	if (!Number.isInteger(expectedRevision) || expectedRevision < 0) {
		throw new ExportPresentationError(0, 'EXPECTED_REVISION_REQUIRED', 'expectedRevision must be a non-negative integer.');
	}
	const response = await (deps.fetchImpl ?? fetch)(exportPresentationUrl(schoolId, schoolYearId), {
		method: 'PUT',
		headers: {
			'Content-Type': 'application/json',
			Authorization: `Bearer ${(deps.getAccessToken ?? getPreferredAccessToken)() ?? ''}`,
		},
		body: JSON.stringify({ expectedRevision, profile: input }),
	});
	if (!response.ok) await parseError(response);
	const body = await response.json() as { data: ExportPresentationSaveResult };
	return body.data;
}

/** Build the editable input from a loaded profile (canonical titles preserved). */
export function toExportPresentationInput(profile: ExportPresentationProfile): Required<ExportPresentationInput> {
	return {
		schoolHeadName: profile.schoolHead.name ?? '',
		schoolHeadTitle: profile.schoolHead.title,
		psdsName: profile.psds.name ?? '',
		psdsTitle: profile.psds.title,
		cidChiefName: profile.cidChief.name ?? '',
		cidChiefTitle: profile.cidChief.title,
		asdsName: profile.asds.name ?? '',
		asdsTitle: profile.asds.title,
		footerText: profile.footerText ?? '',
	};
}
