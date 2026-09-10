/**
 * TERM-SUBJ-C01 planner decision — deferred scheduling disposition UI guardrail.
 *
 * `schedulingDisposition` is schema groundwork for DEMAND-C01 and is NOT yet an
 * operative operator control: generation, timetable demand, and Teaching Load
 * still enforce their own HG-specific rules. These tests pin the Subjects
 * surfaces so no operator-facing claim of downstream exclusion can reappear and
 * no create/edit payload can carry the deferred field.
 *
 * Run with: npx tsx --test src/lib/__tests__/subject-deferred-disposition-ui.test.ts
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import test from 'node:test';

const root = resolve(import.meta.dirname, '../../..');

function source(path: string): string {
	return readFileSync(resolve(root, path), 'utf8');
}

const FORBIDDEN_COPY = [
	'Reference only',
	'Creates neither timetable demand nor Teaching Load',
	'No timetable or Teaching Load',
	'No coverage action',
	'Not applicable',
];

test('Subjects surfaces carry no operative reference-only copy or selector', () => {
	const surfaces = [
		source('src/components/subjects/SubjectFormModal.tsx'),
		source('src/components/subjects/SubjectRow.tsx'),
		source('src/components/subjects/SubjectMobileCard.tsx'),
	].join('\n');
	for (const phrase of FORBIDDEN_COPY) {
		assert.ok(!surfaces.includes(phrase), `Subjects surface must not contain "${phrase}"`);
	}
	assert.ok(!surfaces.includes('Schedule use'), 'Subjects form must not expose a Schedule use selector');
});

test('operator create and edit payloads omit deferred schedulingDisposition', () => {
	const payloadBuilder = source('src/lib/subject-create-payload.ts');
	const subjectsPage = source('src/pages/Subjects.tsx');
	assert.ok(!payloadBuilder.includes('schedulingDisposition'), 'create payload builder must omit schedulingDisposition');
	assert.ok(!subjectsPage.includes('schedulingDisposition'), 'edit payload must omit schedulingDisposition');
});

test('client Subject type and authority view make no operative demand or Teaching Load claim', () => {
	const types = source('src/types.ts');
	assert.ok(!types.includes('createsTimetableDemand'), 'Subject type must not claim timetable demand');
	assert.ok(!types.includes('createsTeachingLoad'), 'Subject type must not claim Teaching Load');
	const viewService = source('../atlas-server/src/services/subject-scheduling-authority.service.ts');
	for (const forbidden of ['createsTimetableDemand', 'createsTeachingLoad', 'demandProjection', 'projectSubjectSchedulingDemand']) {
		assert.ok(!viewService.includes(forbidden), `authority view must not contain ${forbidden}`);
	}
});
