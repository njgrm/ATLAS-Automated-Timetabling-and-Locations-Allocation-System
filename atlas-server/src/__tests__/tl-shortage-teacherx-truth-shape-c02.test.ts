import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

/**
 * A8 TL-SHORTAGE-C02 item 2 — Teacher-X mode must report the truth.
 *
 * Live defect: `TLA:3116` forced `finalUnresolved = 0` in
 * `REAL_FACULTY_THEN_TEACHER_X`, while that mode's `TEMPORARY_SUBSTITUTE` rows
 * (`facultyId: null`) are stripped from the distribution plan and never
 * persisted (apply writes only `plan.inserts`). The page read "complete" while
 * generation still emitted one `TL_DEMAND_UNCOVERED` blocker per uncovered pair
 * (`generation-preflight.service.ts:967-980`).
 *
 * The behavioural contract is exercised through the real `autoFill` in
 * `tl-shortage-teacherx-truth-c02.test.ts`; this file holds the source-shape
 * guards that make the forced zero unreintroducible and that keep the
 * substitute rows visibly marked as unsaved.
 */

const SERVICES_DIR = fileURLToPath(new URL('../services/', import.meta.url));
const automation = readFileSync(new URL('../services/teaching-load-automation.service.ts', import.meta.url), 'utf8');
void SERVICES_DIR;

test('the forced-zero unresolved count is gone', () => {
	assert.doesNotMatch(
		automation,
		/const\s+finalUnresolved\s*=\s*coverageMode\s*===\s*'REAL_FACULTY_THEN_TEACHER_X'\s*\?\s*0/,
		'Teacher-X mode must not force `unresolved` to 0',
	);
	assert.match(
		automation,
		/const\s+stillNeedRealTeacher\s*=\s*unresolvedPairs\.length/,
		'`stillNeedRealTeacher` must be the real still-uncovered pair count',
	);
});

test('stillNeedRealTeacher is exposed on the result contract and populated on every return path', () => {
	const interfaceBlock = /export interface AutoFillResult \{[\s\S]*?\n\}/.exec(automation);
	assert.ok(interfaceBlock, 'AutoFillResult interface must be locatable');
	assert.match(
		interfaceBlock[0],
		/stillNeedRealTeacher\?: number;/,
		'AutoFillResult must declare the truthful still-need-a-real-teacher count',
	);

	// Every autoFill RETURN must carry the truthful count, so no path can
	// silently report 0 again. Scope the scan to the `autoFill` body only: other
	// functions legitimately return an `unresolved` field of a different shape.
	const autoFillStart = automation.indexOf('export async function autoFill(');
	assert.ok(autoFillStart > 0, 'autoFill must be locatable');
	const autoFillBody = automation.slice(autoFillStart, automation.indexOf('\nexport ', autoFillStart + 1));
	const unresolvedInAutoFill = autoFillBody.match(/\bunresolved:/g) ?? [];
	const stillNeedInAutoFill = autoFillBody.match(/\bstillNeedRealTeacher\b/g) ?? [];
	assert.ok(unresolvedInAutoFill.length >= 2, `expected at least two autoFill return sites (found ${unresolvedInAutoFill.length})`);
	assert.ok(
		stillNeedInAutoFill.length >= unresolvedInAutoFill.length,
		`every autoFill return that sets \`unresolved\` must also set \`stillNeedRealTeacher\` `
		+ `(found ${unresolvedInAutoFill.length} unresolved vs ${stillNeedInAutoFill.length} stillNeedRealTeacher)`,
	);
});

test('substitute rows are explicitly reported as unsaved, not as covered classes', () => {
	assert.match(
		automation,
		/unsavedSubstituteRows\?:\s*number;/,
		'teacherXResolution must declare the unsaved substitute row count',
	);
	assert.match(
		automation,
		/unsavedSubstituteRows:\s*unresolvedPairs\.length,/,
		'every Teacher-X substitute row is unsaved and must be counted as such',
	);
});

test('substitute rows remain clearly marked in the preview row type', () => {
	const interfaceBlock = /export interface SuggestedRowPreview \{[\s\S]*?\n\}/.exec(automation);
	assert.ok(interfaceBlock, 'SuggestedRowPreview interface must be locatable');
	assert.match(
		interfaceBlock[0],
		/assignmentType:\s*'KEPT_EXISTING'\s*\|\s*'REAL_TEACHER'\s*\|\s*'PLACEHOLDER_TEACHER'\s*\|\s*'TEMPORARY_SUBSTITUTE';/,
		'a saved placeholder assignment must be a distinct, persisted assignment type',
	);
});
