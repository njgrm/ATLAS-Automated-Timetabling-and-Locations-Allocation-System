/**
 * TT-OUTPUT-C03R2 — Simple Timetable beneficiary export request contract.
 *
 * Every official (beneficiary-facing) download must be bound to exactly one
 * ordered academic term. An "All terms" selection resolves to `null` so the
 * caller disables the control instead of silently exporting a mixed-term
 * schedule. The server already validates `termIndex` and actor-school scope; the
 * client only has to send one numeric term.
 */

import { MAX_ACADEMIC_TERM_INDEX } from '@/lib/academic-term';
import { getPreferredAccessToken } from '@/lib/auth';

export type SimpleExportKind = 'summary-teacher-schedule' | 'class-program' | 'teacher-program';

export type SimpleExportDescriptor = {
	kind: SimpleExportKind;
	/** Exact request URL, including the numeric `termIndex`. */
	url: string;
	/** Exact browser download filename, including the numeric term suffix. */
	filename: string;
	termIndex: number;
};

export type SimpleExportTarget = {
	schoolId: number;
	schoolYearId: number | null;
	runId: number | null;
	termFilter: 'all' | number;
	facultyId?: number | null;
};

function isResolvedTermIndex(termFilter: 'all' | number): termFilter is number {
	return typeof termFilter === 'number'
		&& Number.isInteger(termFilter)
		&& termFilter >= 1
		&& termFilter <= MAX_ACADEMIC_TERM_INDEX;
}

/**
 * Resolve the official export request for one beneficiary download. Returns
 * `null` when no single numeric term is selected, or when the run/scope is not
 * available, so the caller never dispatches an all-term official schedule.
 */
export function resolveSimpleExportRequest(
	kind: SimpleExportKind,
	target: SimpleExportTarget,
): SimpleExportDescriptor | null {
	if (!isResolvedTermIndex(target.termFilter)) return null;
	const { schoolId, schoolYearId, runId } = target;
	if (!Number.isInteger(schoolId) || schoolId <= 0) return null;
	if (!Number.isInteger(schoolYearId) || (schoolYearId ?? 0) <= 0) return null;
	if (!Number.isInteger(runId) || (runId ?? 0) <= 0) return null;

	const term = target.termFilter;
	const base = `/api/v1/generation/${schoolId}/${schoolYearId}/runs/${runId}/export`;
	const termParam = `termIndex=${term}`;

	if (kind === 'summary-teacher-schedule') {
		return {
			kind,
			url: `${base}/summary-teacher-schedule.xlsx?${termParam}`,
			filename: `summary-teacher-schedule-run-${runId}-term${term}.xlsx`,
			termIndex: term,
		};
	}

	if (kind === 'class-program') {
		return {
			kind,
			url: `${base}/class-program.xlsx?${termParam}`,
			filename: `class-program-run-${runId}-term${term}.xlsx`,
			termIndex: term,
		};
	}

	const facultyId = target.facultyId ?? null;
	if (!Number.isInteger(facultyId) || (facultyId ?? 0) <= 0) return null;
	return {
		kind,
		url: `${base}/teacher-program.docx?facultyId=${encodeURIComponent(String(facultyId))}&${termParam}`,
		filename: `teacher-program-${facultyId}-term${term}.docx`,
		termIndex: term,
	};
}

export type SimpleExportDispatchDeps = {
	fetchImpl?: typeof fetch;
	getAccessToken?: () => string | null;
	createObjectUrl?: (blob: Blob) => string;
	revokeObjectUrl?: (url: string) => void;
	triggerDownload?: (objectUrl: string, filename: string) => void;
};

/**
 * Dispatch one resolved export request. `null` is a deliberate no-op: this is
 * the single production path used by the Simple header handlers, so an
 * "All terms" selection can never send an official all-term request.
 */
export async function dispatchSimpleExport(
	descriptor: SimpleExportDescriptor | null,
	deps: SimpleExportDispatchDeps = {},
): Promise<'downloaded' | 'skipped'> {
	if (!descriptor) return 'skipped';
	const fetchImpl = deps.fetchImpl ?? fetch;
	const token = (deps.getAccessToken ?? getPreferredAccessToken)();
	const response = await fetchImpl(descriptor.url, {
		headers: { Authorization: `Bearer ${token ?? ''}` },
	});
	if (!response.ok) {
		const payload = await response.json().catch(() => ({ message: 'Export failed' }));
		const message = (payload as { message?: string } | null)?.message;
		throw new Error(message && message.length > 0 ? message : 'Export failed');
	}
	const blob = await response.blob();
	const objectUrl = (deps.createObjectUrl ?? URL.createObjectURL)(blob);
	if (deps.triggerDownload) {
		deps.triggerDownload(objectUrl, descriptor.filename);
	} else {
		const anchor = document.createElement('a');
		anchor.href = objectUrl;
		anchor.download = descriptor.filename;
		anchor.click();
	}
	(deps.revokeObjectUrl ?? URL.revokeObjectURL)(objectUrl);
	return 'downloaded';
}
