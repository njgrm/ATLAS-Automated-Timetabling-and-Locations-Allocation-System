/**
 * UX-R03c — shared Simple export orchestration.
 *
 * The beneficiary download descriptors (`resolveSimpleExportRequest`) and the
 * single-flight dispatch (`dispatchSimpleExport`) used to live inline in
 * `TimetableSimpleHeader`. The new `/timetable/exports` center view needs the
 * exact same orchestration, so it is extracted here rather than duplicated:
 * the header keeps working and the route is an additional place to land.
 * Nothing about what an export emits changes.
 */

import { useMemo, useState } from 'react';

import {
	dispatchSimpleExport,
	resolveSimpleExportRequest,
	type SimpleExportKind,
} from '@/components/timetable/simple/simpleExportRequests';

export type SimpleExportSurfaceTarget = {
	schoolId: number;
	schoolYearId: number | null;
	runId: number | null;
	termFilter: 'all' | number;
	facultyId?: number | null;
	yearLabel?: string | null;
};

export function useSimpleExportSurface(target: SimpleExportSurfaceTarget) {
	const [exportingKind, setExportingKind] = useState<SimpleExportKind | null>(null);
	const [exportError, setExportError] = useState<{ kind: SimpleExportKind; message: string } | null>(null);

	const summaryExport = useMemo(
		() =>
			resolveSimpleExportRequest('summary-teacher-schedule', {
				schoolId: target.schoolId,
				schoolYearId: target.schoolYearId,
				runId: target.runId,
				termFilter: target.termFilter,
				yearLabel: target.yearLabel ?? null,
			}),
		[target.schoolId, target.schoolYearId, target.runId, target.termFilter, target.yearLabel],
	);
	const classProgramExport = useMemo(
		() =>
			resolveSimpleExportRequest('class-program', {
				schoolId: target.schoolId,
				schoolYearId: target.schoolYearId,
				runId: target.runId,
				termFilter: target.termFilter,
				yearLabel: target.yearLabel ?? null,
			}),
		[target.schoolId, target.schoolYearId, target.runId, target.termFilter, target.yearLabel],
	);
	const teacherProgramExport = useMemo(
		() =>
			resolveSimpleExportRequest('teacher-program', {
				schoolId: target.schoolId,
				schoolYearId: target.schoolYearId,
				runId: target.runId,
				termFilter: target.termFilter,
				facultyId: target.facultyId ?? null,
				yearLabel: target.yearLabel ?? null,
			}),
		[target.schoolId, target.schoolYearId, target.runId, target.termFilter, target.facultyId, target.yearLabel],
	);

	const handleSimpleExport = async (kind: SimpleExportKind) => {
		// Prevent duplicate concurrent downloads: one official export at a time.
		if (exportingKind !== null) return;
		const descriptor =
			kind === 'summary-teacher-schedule'
				? summaryExport
				: kind === 'class-program'
					? classProgramExport
					: teacherProgramExport;
		if (!descriptor) return;
		setExportError(null);
		setExportingKind(kind);
		try {
			await dispatchSimpleExport(descriptor);
		} catch (err) {
			// Every beneficiary download surfaces its own visible, retryable error.
			setExportError({ kind, message: err instanceof Error && err.message ? err.message : 'Export failed' });
		} finally {
			setExportingKind(null);
		}
	};

	return {
		summaryExport,
		classProgramExport,
		teacherProgramExport,
		exportingKind,
		exportError,
		setExportError,
		handleSimpleExport,
	};
}
