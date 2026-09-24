import assert from 'node:assert/strict';
import test from 'node:test';
import { resolveSchedulerPrintOptionsUrl, resolveSchedulerPrintRequest, schedulerPrintProgramForView } from '../../components/timetable/simple/schedulerPrintRequests';

const base = { schoolId: 7, schoolYearId: 9, runId: 42, termIndex: 2 as const, yearLabel: '2026-2027' };

test('print options are requested from exactly the selected run and ordered term', () => {
	assert.equal(resolveSchedulerPrintOptionsUrl(base), '/api/v1/generation/7/9/runs/42/print-options?termIndex=2');
	assert.equal(resolveSchedulerPrintOptionsUrl({ ...base, termIndex: 'all' }), null);
	assert.equal(resolveSchedulerPrintOptionsUrl({ ...base, runId: null }), null);
});

test('the current timetable entity view selects the matching print program by default', () => {
	assert.equal(schedulerPrintProgramForView('section'), 'section');
	assert.equal(schedulerPrintProgramForView('faculty'), 'teacher');
	assert.equal(schedulerPrintProgramForView('room'), 'room');
});

test('single official print selection resolves to its existing Word-only entity route', () => {
	assert.deepEqual(resolveSchedulerPrintRequest({ ...base, program: 'grade', ids: [8] }), {
		method: 'GET',
		url: '/api/v1/generation/7/9/runs/42/export/class-program.docx?termIndex=2&gradeLevel=8',
		filename: 'class-program-G8-SY2026-2027-term2.docx',
	});
	assert.deepEqual(resolveSchedulerPrintRequest({ ...base, program: 'teacher', ids: [502] }), {
		method: 'GET',
		url: '/api/v1/generation/7/9/runs/42/export/teacher-program.docx?facultyId=502&termIndex=2',
		filename: 'teacher-program-502-SY2026-2027-term2.docx',
	});
});

test('multiple or all official print selections resolve to one run-and-term-bound ZIP request', () => {
	assert.deepEqual(resolveSchedulerPrintRequest({ ...base, program: 'room', ids: [601, 602] }), {
		method: 'POST',
		url: '/api/v1/generation/7/9/runs/42/print-schedules.zip',
		body: { termIndex: 2, program: 'room', ids: [601, 602] },
		filename: 'room-programs-SY2026-2027-term2.zip',
	});
	assert.deepEqual(resolveSchedulerPrintRequest({ ...base, program: 'section', all: true }), {
		method: 'POST',
		url: '/api/v1/generation/7/9/runs/42/print-schedules.zip',
		body: { termIndex: 2, program: 'section', all: true },
		filename: 'section-programs-SY2026-2027-term2.zip',
	});
});

test('print request model supports same-run editable Excel forms and packages them as Excel files', () => {
	assert.deepEqual(resolveSchedulerPrintRequest({ ...base, program: 'section', format: 'xlsx', ids: [201] } as any), {
		method: 'GET',
		url: '/api/v1/generation/7/9/runs/42/export/print-program.xlsx?termIndex=2&program=section&id=201',
		filename: 'section-program-201-SY2026-2027-term2.xlsx',
	});
	assert.deepEqual(resolveSchedulerPrintRequest({ ...base, program: 'grade', format: 'xlsx', ids: [7, 8] } as any), {
		method: 'POST',
		url: '/api/v1/generation/7/9/runs/42/print-schedules.zip',
		body: { termIndex: 2, program: 'grade', format: 'xlsx', ids: [7, 8] },
		filename: 'grade-programs-SY2026-2027-term2.zip',
	});
});

test('unresolved scope/term and invalid entity sets produce no print request', () => {
	assert.equal(resolveSchedulerPrintRequest({ ...base, termIndex: 'all', program: 'room', ids: [601] }), null);
	assert.equal(resolveSchedulerPrintRequest({ ...base, runId: null, program: 'room', ids: [601] }), null);
	assert.equal(resolveSchedulerPrintRequest({ ...base, schoolYearId: null, program: 'room', ids: [601] }), null);
	assert.equal(resolveSchedulerPrintRequest({ ...base, program: 'room', ids: [] }), null);
	assert.equal(resolveSchedulerPrintRequest({ ...base, program: 'room', ids: [0] }), null);
	assert.equal(resolveSchedulerPrintRequest({ ...base, program: 'room', ids: [601, 601] }), null);
});
