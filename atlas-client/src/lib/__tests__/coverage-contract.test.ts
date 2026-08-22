import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const workspaceRoot = resolve(import.meta.dirname, '../../../..');
const clientRoot = resolve(import.meta.dirname, '../../..');

function source(path: string): string {
	return readFileSync(resolve(clientRoot, path), 'utf8');
}

function serverSource(path: string): string {
	return readFileSync(resolve(workspaceRoot, path), 'utf8');
}

test('coverage helper counts partially covered subjects as missing', () => {
	const helper = source('src/lib/coverage.ts');
	assert.match(helper, /export function countSubjectsWithMissingCoverage/);
	assert.match(helper, /row\.uncoveredSectionCount > 0/);
});

test('coverage helper exports getSubjectsWithMissingCoverage', () => {
	const helper = source('src/lib/coverage.ts');
	assert.match(helper, /export function getSubjectsWithMissingCoverage/);
});

test('coverage helper exports fetchSubjectCoverageSummary', () => {
	const helper = source('src/lib/coverage.ts');
	assert.match(helper, /export async function fetchSubjectCoverageSummary/);
	assert.match(helper, /\/faculty-assignments\/coverage\/summary/);
});

test('client types define SubjectCoverageRow with uncoveredSections', () => {
	const types = source('src/types.ts');
	assert.match(types, /export type SubjectCoverageRow/);
	assert.match(types, /uncoveredSections: UncoveredSectionInfo\[\]/);
	assert.match(types, /uncoveredSectionCount: number/);
	assert.match(types, /coveragePercent: number/);
	assert.match(types, /status: 'FULL' \| 'PARTIAL' \| 'ZERO'/);
});

test('client types define SubjectCoverageSummary', () => {
	const types = source('src/types.ts');
	assert.match(types, /export type SubjectCoverageSummary/);
	assert.match(types, /rows: SubjectCoverageRow\[\]/);
	assert.match(types, /zeroCoverageSubjectCodes: string\[\]/);
	assert.match(types, /partiallyCoveredSubjectCodes: string\[\]/);
	assert.match(types, /fullyCoveredSubjectCodes: string\[\]/);
});

test('client types define UncoveredSectionInfo', () => {
	const types = source('src/types.ts');
	assert.match(types, /export type UncoveredSectionInfo/);
	assert.match(types, /sectionId: number/);
	assert.match(types, /sectionName: string/);
	assert.match(types, /gradeLevel: number/);
	assert.match(types, /programType: string/);
});

test('useDashboardData imports coverage helper', () => {
	const hook = source('src/hooks/useDashboardData.ts');
	assert.match(hook, /import.*fetchSubjectCoverageSummary.*from.*@\/lib\/coverage/);
	assert.match(hook, /import.*countSubjectsWithMissingCoverage.*from.*@\/lib\/coverage/);
});

test('useDashboardData overrides unassignedSubjectCount from coverage', () => {
	const hook = source('src/hooks/useDashboardData.ts');
	// Primary path: fetches coverage after readiness summary
	assert.match(hook, /fetchSubjectCoverageSummary\(summary\.activeSchoolYearId\)/);
	assert.match(hook, /countSubjectsWithMissingCoverage\(coverage\)/);
	// Legacy path: also fetches coverage
	assert.match(hook, /fetchSubjectCoverageSummary\(context\.activeSchoolYearId\)/);
});

test('backend ActiveSubjectCoverageRow includes uncoveredSections', () => {
	const service = serverSource('atlas-server/src/services/faculty-assignment.service.ts');
	assert.match(service, /uncoveredSections: UncoveredSectionInfo\[\]/);
	assert.match(service, /export interface UncoveredSectionInfo/);
	assert.match(service, /sectionId: number/);
	assert.match(service, /sectionName: string/);
	assert.match(service, /gradeLevel: number/);
	assert.match(service, /programType: string/);
});

test('backend computes uncoveredSections from relevantSectionIds minus ownedSectionIds', () => {
	const service = serverSource('atlas-server/src/services/faculty-assignment.service.ts');
	assert.match(service, /const uncoveredSections: UncoveredSectionInfo\[\] = relevantSectionIds/);
	assert.match(service, /\.filter\(\(sectionId\) => !ownedSectionIds\.has\(sectionId\)\)/);
	assert.match(service, /\.map\(\(sectionId\) =>/);
	assert.match(service, /sectionId,\s*sectionName: section\?\.name/);
	assert.match(service, /gradeLevel: section\?\.gradeLevel/);
	assert.match(service, /programType: section\?\.programType/);
});
