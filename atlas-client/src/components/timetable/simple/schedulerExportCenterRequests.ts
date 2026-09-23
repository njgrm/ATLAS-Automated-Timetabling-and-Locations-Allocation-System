import { MAX_ACADEMIC_TERM_INDEX } from '@/lib/academic-term';

export type SchedulerExportFormat = 'xlsx' | 'docx';
export type SchedulerExportKind = 'teacher-consolidated' | 'class-program' | 'room-program' | 'section-program';
export type SchedulerExportSelection = { kind: 'room' | 'section'; id: number; label: string } | null;

export type SchedulerExportCenterTarget = {
	schoolId: number;
	schoolYearId: number | null;
	runId: number | null;
	termIndex: number | 'all';
	yearLabel: string | null;
	kind: SchedulerExportKind;
	format: SchedulerExportFormat;
	scope: 'all' | 'selected';
	selection: SchedulerExportSelection;
};

function yearToken(yearLabel: string | null): string {
	const label = yearLabel?.trim() ?? '';
	return label ? `SY${label.replace(/[^a-zA-Z0-9-]/g, '')}` : 'SY-UNLABELED';
}

function validTerm(value: SchedulerExportCenterTarget['termIndex']): value is number {
	return typeof value === 'number' && Number.isInteger(value) && value >= 1 && value <= MAX_ACADEMIC_TERM_INDEX;
}

/** Build a selected-term export request. An unresolved term or entity is a zero-dispatch result. */
export function resolveSchedulerExportCenterRequest(target: SchedulerExportCenterTarget): { url: string; filename: string } | null {
	if (!Number.isInteger(target.schoolId) || target.schoolId <= 0
		|| !Number.isInteger(target.schoolYearId) || (target.schoolYearId ?? 0) <= 0
		|| !Number.isInteger(target.runId) || (target.runId ?? 0) <= 0
		|| !validTerm(target.termIndex)) return null;
	if (target.kind === 'teacher-consolidated' && target.format !== 'xlsx') return null;
	if (target.kind === 'class-program' && target.format !== 'xlsx') return null;
	if (target.scope === 'selected' && target.kind !== 'teacher-consolidated') {
		const expectedKind = target.kind === 'room-program' ? 'room' : 'section';
		if (target.selection?.kind !== expectedKind || !Number.isInteger(target.selection.id) || target.selection.id <= 0) return null;
	}

	const root = `/api/v1/generation/${target.schoolId}/${target.schoolYearId}/runs/${target.runId}/export`;
	const term = `termIndex=${target.termIndex}`;
	const year = yearToken(target.yearLabel);
	if (target.kind === 'teacher-consolidated') {
		return { url: `${root}/summary-teacher-schedule.xlsx?${term}`, filename: `teacher-consolidated-${year}-term${target.termIndex}.xlsx` };
	}
	if (target.kind === 'class-program') {
		return { url: `${root}/class-program.xlsx?${term}`, filename: `class-program-${year}-term${target.termIndex}.xlsx` };
	}
	const entityId = target.scope === 'selected' ? target.selection!.id : null;
	const entity = entityId == null ? 'ALL' : String(entityId);
	const entityQuery = entityId == null ? '' : `&${target.kind === 'room-program' ? 'roomId' : 'sectionId'}=${entityId}`;
	if (target.kind === 'room-program') {
		return {
			url: `${root}/room-program.${target.format}?${term}${entityQuery}`,
			filename: `room-program-${entity}-${year}-term${target.termIndex}.${target.format}`,
		};
	}
	const endpoint = target.format === 'docx' ? 'section-program.docx' : 'class-program.xlsx';
	return {
		url: `${root}/${endpoint}?${term}${entityQuery}`,
		filename: `section-program-${entity}-${year}-term${target.termIndex}.${target.format}`,
	};
}
