import { MAX_ACADEMIC_TERM_INDEX } from '@/lib/academic-term';

export type SchedulerPrintProgram = 'grade' | 'section' | 'teacher' | 'room';
export type SchedulerPrintViewMode = 'section' | 'faculty' | 'room';
export type SchedulerPrintRequestTarget = {
	schoolId: number;
	schoolYearId: number | null;
	runId: number | null;
	termIndex: number | 'all';
	yearLabel: string | null;
	program: SchedulerPrintProgram;
	format?: 'docx' | 'xlsx';
	ids?: number[];
	all?: boolean;
};
export type SchedulerPrintRequest = {
	method: 'GET' | 'POST';
	url: string;
	filename: string;
	body?: { termIndex: number; program: SchedulerPrintProgram; format?: 'docx' | 'xlsx'; ids?: number[]; all?: true };
};
export type SchedulerPrintScope = Omit<SchedulerPrintRequestTarget, 'program' | 'ids' | 'all'>;

export function schedulerPrintProgramForView(viewMode: SchedulerPrintViewMode): SchedulerPrintProgram {
	return viewMode === 'faculty' ? 'teacher' : viewMode;
}

function yearToken(value: string | null): string {
	const label = value?.trim() ?? '';
	return label ? `SY${label.replace(/[^a-zA-Z0-9-]/g, '')}` : 'SY-UNLABELED';
}

function isValidId(id: number, program: SchedulerPrintProgram): boolean {
	return Number.isSafeInteger(id) && id > 0 && (program !== 'grade' || (id >= 7 && id <= 10));
}

export function resolveSchedulerPrintOptionsUrl(target: SchedulerPrintScope): string | null {
	const { schoolId, schoolYearId, runId, termIndex } = target;
	if (!Number.isSafeInteger(schoolId) || schoolId <= 0
		|| !Number.isSafeInteger(schoolYearId) || (schoolYearId ?? 0) <= 0
		|| !Number.isSafeInteger(runId) || (runId ?? 0) <= 0
		|| typeof termIndex !== 'number' || !Number.isInteger(termIndex)
		|| termIndex < 1 || termIndex > MAX_ACADEMIC_TERM_INDEX) return null;
	return `/api/v1/generation/${schoolId}/${schoolYearId}/runs/${runId}/print-options?termIndex=${termIndex}`;
}

export function resolveSchedulerPrintRequest(target: SchedulerPrintRequestTarget): SchedulerPrintRequest | null {
	const { schoolId, schoolYearId, runId, termIndex, yearLabel, program } = target;
	const format = target.format ?? 'docx';
	if (format !== 'docx' && format !== 'xlsx') return null;
	if (!Number.isSafeInteger(schoolId) || schoolId <= 0
		|| !Number.isSafeInteger(schoolYearId) || (schoolYearId ?? 0) <= 0
		|| !Number.isSafeInteger(runId) || (runId ?? 0) <= 0
		|| typeof termIndex !== 'number' || !Number.isInteger(termIndex)
		|| termIndex < 1 || termIndex > MAX_ACADEMIC_TERM_INDEX) return null;
	const all = target.all === true;
	const ids = target.ids;
	if (all ? ids !== undefined : !Array.isArray(ids) || ids.length < 1 || ids.length > 500) return null;
	if (ids && (new Set(ids).size !== ids.length || ids.some((id) => !isValidId(id, program)))) return null;
	const root = `/api/v1/generation/${schoolId}/${schoolYearId}/runs/${runId}`;
	const year = yearToken(yearLabel);
	const kind = program === 'grade' ? 'class' : program;
	if (all || (ids?.length ?? 0) > 1) {
		return {
			method: 'POST',
			url: `${root}/print-schedules.zip`,
			body: { termIndex, program, ...(format === 'xlsx' ? { format } : {}), ...(all ? { all: true as const } : { ids: ids! }) },
			filename: `${program}-programs-${year}-term${termIndex}.zip`,
		};
	}
	const id = ids![0];
	if (format === 'xlsx') {
		const identity = program === 'grade' ? `G${id}` : String(id);
		return {
			method: 'GET',
			url: `${root}/export/print-program.xlsx?termIndex=${termIndex}&program=${program}&id=${id}`,
			filename: `${program}-program-${identity}-${year}-term${termIndex}.xlsx`,
		};
	}
	const path = program === 'grade' ? `/export/class-program.docx?termIndex=${termIndex}&gradeLevel=${id}`
		: program === 'section' ? `/export/section-program.docx?termIndex=${termIndex}&sectionId=${id}`
			: program === 'teacher' ? `/export/teacher-program.docx?facultyId=${id}&termIndex=${termIndex}`
				: `/export/room-program.docx?termIndex=${termIndex}&roomId=${id}`;
	const identity = program === 'grade' ? `G${id}-` : `${id}-`;
	return {
		method: 'GET',
		url: `${root}${path}`,
		filename: `${kind}-program-${identity}${year}-term${termIndex}.docx`,
	};
}
