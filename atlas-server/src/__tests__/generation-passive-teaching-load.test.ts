/**
 * GEN-ZW01 passive generation and Teaching Load authority regression.
 *
 * Hermetic source/entry-point controls. No database, generation, migration,
 * publication, or external service is accessed.
 */

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const read = (relativePath: string) => readFileSync(resolve(here, relativePath), 'utf8');

const generationSource = read('../services/generation.service.ts');
const automationSource = read('../services/teaching-load-automation.service.ts');
const proposalSource = read('../services/teaching-load-suggestion-proposal.service.ts');
const assignmentSource = read('../services/faculty-assignment.service.ts');
const routerSource = read('../routes/faculty-assignment.router.ts');

function functionSpan(source: string, name: string, nextMarker: RegExp): string {
	const start = source.indexOf(`export async function ${name}(`);
	assert.notEqual(start, -1, `${name} must remain a production export`);
	const tail = source.slice(start);
	const next = tail.slice(1).search(nextMarker);
	return next < 0 ? tail : tail.slice(0, next + 1);
}

const generationTrigger = functionSpan(generationSource, 'triggerGenerationRun', /\nexport async function /);
const autoFill = functionSpan(automationSource, 'autoFill', /\n(?:export )?(?:async )?function |\nexport interface /);
const proposalApply = functionSpan(proposalSource, 'applyTeachingLoadSuggestionProposal', /\nexport async function /);
const manualSave = functionSpan(assignmentSource, 'setAssignments', /\nexport async function /);

// Real generation entry point: Teaching Load is input-only. The known mutator
// remains available for explicit reviewed workflows, which is the sensitivity
// control proving this guard would detect the former import/call.
assert.match(assignmentSource, /export async function repairActiveSubjectCoverageWithPlaceholders/);
assert.doesNotMatch(generationSource, /import[^;]*repairActiveSubjectCoverageWithPlaceholders/);
assert.doesNotMatch(generationTrigger, /repairActiveSubjectCoverageWithPlaceholders\s*\(/);
for (const model of ['facultyMirror', 'facultySubject', 'subjectSectionOwnership', 'teachingLoadCycle']) {
	assert.doesNotMatch(generationTrigger, new RegExp(`${model}\\.(?:create|createMany|update|updateMany|upsert|delete|deleteMany)\\s*\\(`));
}

// Auto-fill is suggestion-only. Both the service and mounted route must reject
// direct mutation before any persistence path can run.
assert.doesNotMatch(automationSource, /repairActiveSubjectCoverageWithPlaceholders/);
assert.doesNotMatch(autoFill, /assignedBy:\s*0/);
for (const model of ['facultyMirror', 'facultySubject', 'subjectSectionOwnership', 'teachingLoadCycle', 'auditLog']) {
	assert.doesNotMatch(autoFill, new RegExp(`${model}\\.(?:create|createMany|update|updateMany|upsert|delete|deleteMany)\\s*\\(`));
}
assert.match(autoFill, /TEACHING_LOAD_PROPOSAL_REQUIRED/);
assert.match(routerSource, /TEACHING_LOAD_PROPOSAL_REQUIRED/);
assert.match(routerSource, /Direct Teaching Load auto-fill apply is retired/);

// Reviewed proposal apply owns the only auto-fill persistence boundary: one
// Serializable transaction contains proposal status, domain writes, cycle, and
// one durable actor-attributed audit. It must never call the retired direct
// auto-fill apply mode.
assert.match(proposalSource, /getDataContext/);
assert.match(proposalApply, /isolationLevel:\s*['"]Serializable['"]/);
assert.match(proposalApply, /refreshTeachingLoadCycle\([^;]*tx\)/s);
assert.equal((proposalApply.match(/tx\.auditLog\.create\s*\(/g) ?? []).length, 1);
assert.match(proposalApply, /actorId:\s*input\.actorId/);
assert.doesNotMatch(proposalApply, /previewOnly:\s*false/);
assert.doesNotMatch(proposalApply, /prisma\.(?:facultySubject|subjectSectionOwnership|teachingLoadCycle|auditLog)/);

// Manual save must carry actor attribution, cycle refresh, and exactly one
// audit inside its existing Serializable transaction.
assert.match(manualSave, /assignedBy/);
assert.match(manualSave, /isolationLevel:\s*['"]Serializable['"]/);
assert.match(manualSave, /refreshTeachingLoadCycle\([^;]*tx\)/s);
assert.equal((manualSave.match(/tx\.auditLog\.create\s*\(/g) ?? []).length, 1);
assert.match(manualSave, /actorId:\s*assignedBy/);

// Authenticated operator IDs must not silently collapse to system actor 0 on
// the touched create/apply routes.
for (const routeFragment of [
	'createTeachingLoadSuggestionProposal({',
	'applyTeachingLoadSuggestionProposal({',
]) {
	const start = routerSource.indexOf(routeFragment);
	assert.notEqual(start, -1, `${routeFragment} remains routed`);
	assert.doesNotMatch(routerSource.slice(start, start + 350), /userId\s*\?\?\s*0/);
}

console.log('GEN-ZW01 passive Teaching Load source and entry-point guards: PASS');
