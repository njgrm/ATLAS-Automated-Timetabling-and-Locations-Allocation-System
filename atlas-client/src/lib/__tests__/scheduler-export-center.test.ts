import test from 'node:test';
import assert from 'node:assert/strict';
import { resolveSchedulerExportCenterRequest } from '../../components/timetable/simple/schedulerExportCenterRequests';

const base = {
	schoolId: 7,
	schoolYearId: 9,
	runId: 42,
	termIndex: 2 as const,
	yearLabel: '2026-2027',
	scope: 'all' as const,
	selection: null,
};

test('Export Center resolves all-room XLSX and DOCX requests on one ordered term', () => {
	for (const format of ['xlsx', 'docx'] as const) {
		const request = resolveSchedulerExportCenterRequest({ ...base, kind: 'room-program', format });
		assert.equal(request?.url, `/api/v1/generation/7/9/runs/42/export/room-program.${format}?termIndex=2`);
		assert.equal(request?.filename, `room-program-ALL-SY2026-2027-term2.${format}`);
	}
});

test('Export Center resolves selected room and section variants without mixing term or identity', () => {
	const room = resolveSchedulerExportCenterRequest({
		...base, kind: 'room-program', format: 'docx', scope: 'selected',
		selection: { kind: 'room', id: 601, label: 'Room 101' },
	});
	assert.equal(room?.url, '/api/v1/generation/7/9/runs/42/export/room-program.docx?termIndex=2&roomId=601');
	const section = resolveSchedulerExportCenterRequest({
		...base, kind: 'section-program', format: 'xlsx', scope: 'selected',
		selection: { kind: 'section', id: 701, label: '7-Rizal' },
	});
	assert.equal(section?.url, '/api/v1/generation/7/9/runs/42/export/class-program.xlsx?termIndex=2&sectionId=701');
	assert.equal(section?.filename, 'section-program-701-SY2026-2027-term2.xlsx');
});

test('consolidated teacher workbook uses the existing revision-aware summary export', () => {
	const request = resolveSchedulerExportCenterRequest({ ...base, kind: 'teacher-consolidated', format: 'xlsx' });
	assert.equal(request?.url, '/api/v1/generation/7/9/runs/42/export/summary-teacher-schedule.xlsx?termIndex=2');
	assert.equal(resolveSchedulerExportCenterRequest({ ...base, kind: 'teacher-consolidated', format: 'docx' }), null);
});

test('Export Center sends nothing when term, run, scope, or selected entity is unresolved', () => {
	assert.equal(resolveSchedulerExportCenterRequest({ ...base, termIndex: 'all', kind: 'room-program', format: 'xlsx' }), null);
	assert.equal(resolveSchedulerExportCenterRequest({ ...base, runId: null, kind: 'room-program', format: 'xlsx' }), null);
	assert.equal(resolveSchedulerExportCenterRequest({ ...base, kind: 'section-program', format: 'docx', scope: 'selected' }), null);
	assert.equal(resolveSchedulerExportCenterRequest({
		...base, kind: 'section-program', format: 'xlsx', scope: 'selected',
		selection: { kind: 'room', id: 601, label: 'Room 101' },
	}), null);
});
