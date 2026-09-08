/**
 * SCA-03E-R2 — decision-draft state machine tests (client-side only, no server).
 *
 * Run with: npx tsx src/lib/__tests__/decision-draft.test.ts
 */

import assert from 'node:assert/strict';
import {
  applyBulkDecision,
  buildDraftFromGroups,
  compileDraftOfferings,
  findFirstDuplicateJsonKey,
  parseDraftTerms,
  restoreDraft,
  restoreDraftText,
  serializeDraft,
  type WorkspaceCandidateGroup,
} from '../decision-draft.js';

let passed = 0;
let failed = 0;

function ok(condition: boolean, label: string) {
  if (condition) { passed += 1; console.log(`  OK ${label}`); return; }
  failed += 1; console.error(`  FAIL ${label}`);
}

function group(overrides: Partial<WorkspaceCandidateGroup> & { groupKey: string }): WorkspaceCandidateGroup {
  return {
    gradeLevel: 7,
    programType: 'REGULAR',
    subjectId: 1,
    subjectCode: 'DW_MATH',
    subjectName: 'Mathematics',
    weeklyMinutes: 225,
    catalogRotationFamily: null,
    affectedScopeKeys: ['G7:REGULAR:-:-'],
    affectedSections: [{ mirrorId: 1, externalId: 101, name: 'Aguinaldo' }],
    sectionCount: 1,
    demandMinutesPerWeek: 225,
    demandDerivation: '225 min/wk (catalog) × 1 section(s) = 225 min/wk',
    currentOwnershipEvidence: { evidenceStatus: 'SUGGESTION_ONLY', ownershipIds: [5], facultyIds: [9] },
    decisionStatus: 'UNAPPROVED_SUGGESTION',
    termMode: 'ALL',
    termModeStatus: 'UNAPPROVED_SUGGESTION',
    unresolvedFields: ['classification', 'operatorConfirmReject', 'rotationOrder(if rotating)'],
    ...overrides,
  };
}

const g10 = (code: string, subjectId: number): WorkspaceCandidateGroup => group({
  groupKey: `G10:STE:${code}`,
  gradeLevel: 10,
  programType: 'STE',
  subjectCode: code,
  subjectId,
});

const STE_RESEARCH = 'STE_RESEARCH';
const STE_APPLIED_PHYS = 'STE_APPLIED_PHYS';
const STE_ROBOTICS = 'STE_ROBOTICS';

function buildCandidateSet(): WorkspaceCandidateGroup[] {
  const math = (programType: string, key: string): WorkspaceCandidateGroup =>
    group({ groupKey: key, programType, subjectId: 101 });
  const research = (gradeLevel: number): WorkspaceCandidateGroup =>
    group({
      groupKey: `G${gradeLevel}:STE:${STE_RESEARCH}`,
      programType: 'STE',
      subjectCode: STE_RESEARCH,
      subjectName: 'Research',
      gradeLevel,
      subjectId: 102,
    });
  return [
    math('REGULAR', 'G7:REGULAR:DW_MATH'),
    math('STE', 'G7:STE:DW_MATH'),
    research(7),
    research(8),
    research(9),
    research(10),
    g10(STE_APPLIED_PHYS, 103),
    g10(STE_ROBOTICS, 104),
  ];
}

const REV_HASH = 'A1B2C3D4E5F60718293A4B5C6D7E8F90123456789ABCDEF0123456789ABCDEFF';
const OTHER_HASH = 'FFEEDDCCBBAA99887766554433221100FFEEDDCCBBAA99887766554433221100';

const CONTEXT = { schoolId: 1, schoolYearId: 8, sourceRevisionHash: REV_HASH };

function buildSixChoiceDraft() {
  const groups = buildCandidateSet();
  const draft = buildDraftFromGroups(groups);
  const special = (key: string) => {
    draft[key] = { ...draft[key], decision: 'CONFIRMED', classification: 'SPECIALIZATION' };
  };
  special(`G7:STE:${STE_RESEARCH}`);
  special(`G8:STE:${STE_RESEARCH}`);
  special(`G9:STE:${STE_RESEARCH}`);
  special(`G10:STE:${STE_APPLIED_PHYS}`);
  special(`G10:STE:${STE_ROBOTICS}`);
  draft[`G10:STE:${STE_RESEARCH}`] = { ...draft[`G10:STE:${STE_RESEARCH}`], decision: 'REJECTED' };
  return { groups, draft };
}

function main() {
  const groups = buildCandidateSet();

  console.log('=== D1: defaults — every row undecided + unclassified, even special codes ===');
  const draft = buildDraftFromGroups(groups);
  ok(groups.every((g) => draft[g.groupKey].decision === 'UNDECIDED'), 'every group defaults UNDECIDED');
  ok(groups.every((g) => draft[g.groupKey].classification === null), 'every group defaults unclassified');
  ok(draft[`G10:STE:${STE_APPLIED_PHYS}`].decision === 'UNDECIDED', 'Applied Physics gets no default authority from its code');
  ok(draft[`G10:STE:${STE_ROBOTICS}`].decision === 'UNDECIDED', 'Robotics gets no default authority from its code');
  ok(draft[`G10:STE:${STE_RESEARCH}`].decision === 'UNDECIDED', 'Silver Research is not excluded by code');

  console.log('=== D2: draft terms — operator-entered, never defaulted ===');
  ok(parseDraftTerms({ countText: '', identitiesText: '' }) === null, 'empty terms unconfigured');
  ok(parseDraftTerms({ countText: '2', identitiesText: 'Q1' }) === null, 'count/identity mismatch unconfigured');
  ok(parseDraftTerms({ countText: '2', identitiesText: 'Q1, Q1' }) === null, 'duplicate identities unconfigured');
  const terms = parseDraftTerms({ countText: '2', identitiesText: 'Q1, Q2' });
  ok(terms !== null && terms.count === 2 && terms.identities.join(',') === 'Q1,Q2', 'explicit terms parse');

  console.log('=== D3: compile — confirm/reject/rotation gating ===');
  const d3 = buildDraftFromGroups(groups);
  d3['G7:REGULAR:DW_MATH'] = { ...d3['G7:REGULAR:DW_MATH'], decision: 'CONFIRMED', classification: 'CORE' };
  d3['G7:STE:DW_MATH'] = { ...d3['G7:STE:DW_MATH'], decision: 'REJECTED' };
  let compiled = compileDraftOfferings(groups, d3, { countText: '', identitiesText: '' });
  ok(compiled.offerings.length === 1, 'only the confirmed MATH row compiles');
  ok(compiled.heldOut.includes('G7:STE:DW_MATH'), 'rejected row held out');
  ok(compiled.errors.length === 0, 'no errors for ALL-mode compile');

  d3['G7:STE:DW_MATH'] = {
    ...d3['G7:STE:DW_MATH'], decision: 'CONFIRMED', classification: 'EXPLORATORY',
    termMode: 'ROTATING', rotationFamily: 'TLE', rotationOrder: '1', rotationTerm: 'Q1',
  };
  compiled = compileDraftOfferings(groups, d3, { countText: '', identitiesText: '' });
  ok(compiled.errors.length === 1, 'ROTATING without draft terms errors');
  compiled = compileDraftOfferings(groups, d3, { countText: '2', identitiesText: 'Q1, Q2' });
  ok(compiled.errors.length === 0 && compiled.offerings.length === 2, 'ROTATING with configured terms compiles');
  const rotating = compiled.offerings.find((o) => o.rotationFamily === 'TLE');
  ok(rotating?.termMode === 'ROTATING_FAMILY_MEMBER' && rotating.termIdentities.join(',') === 'Q1' && rotating.rotationOrder === 1, 'rotation binds family/order/term explicitly');

  d3['G7:REGULAR:DW_MATH'] = { ...d3['G7:REGULAR:DW_MATH'], classification: null };
  compiled = compileDraftOfferings(groups, d3, { countText: '2', identitiesText: 'Q1, Q2' });
  ok(compiled.errors.some((e) => e.groupKey === 'G7:REGULAR:DW_MATH'), 'confirmed-without-classification errors');

  console.log('=== D4: bulk applies to EVERY selected row + reports skipped ===');
  const d4 = buildDraftFromGroups(groups);
  const selected = new Set(groups.map((g) => g.groupKey));
  const bulked = applyBulkDecision(d4, groups, selected, 'REJECTED', null);
  ok(bulked.draft['G7:STE:DW_MATH'].decision === 'REJECTED', 'bulk rejects ordinary rows');
  ok(bulked.draft[`G10:STE:${STE_APPLIED_PHYS}`].decision === 'REJECTED', 'bulk also rejects the AP code row (no code lock)');
  ok(bulked.applied.length === groups.length && bulked.skipped.length === 0, 'all selected rows applied, none skipped');
  const partial = applyBulkDecision(d4, groups, new Set(['G7:REGULAR:DW_MATH', 'GHOST:ROW:NOPE']), 'CONFIRMED', 'CORE');
  ok(partial.applied.join(',') === 'G7:REGULAR:DW_MATH' && partial.skipped.join(',') === 'GHOST:ROW:NOPE',
    'partial bulk action reports the skipped (unknown) row instead of skipping it silently');

  console.log('=== D5: v3 envelope + explicit restore reproduces the six operator choices ===');
  const { draft: sixDraft, groups: sixGroups } = buildSixChoiceDraft();
  const doc = serializeDraft(1, 8, REV_HASH, { countText: '', identitiesText: '' }, sixDraft);
  ok(doc.format === 'atlas-curriculum-decision-draft' && doc.version === 3 && doc.schoolId === 1 && doc.schoolYearId === 8, 'v3 envelope binds school + year + canonical hash');
  ok(doc.sourceRevisionHash === REV_HASH, 'serialized draft carries the exact sourceRevisionHash');
  const restored = restoreDraft(JSON.parse(JSON.stringify(doc)), sixGroups, CONTEXT);
  ok(restored.draft[`G10:STE:${STE_APPLIED_PHYS}`].decision === 'CONFIRMED' && restored.draft[`G10:STE:${STE_APPLIED_PHYS}`].classification === 'SPECIALIZATION', 'Applied Physics choice reproduced by restore');
  ok(restored.draft[`G10:STE:${STE_ROBOTICS}`].decision === 'CONFIRMED' && restored.draft[`G10:STE:${STE_ROBOTICS}`].classification === 'SPECIALIZATION', 'Robotics choice reproduced by restore');
  ok(restored.draft[`G7:STE:${STE_RESEARCH}`].decision === 'CONFIRMED' && restored.draft[`G9:STE:${STE_RESEARCH}`].decision === 'CONFIRMED', 'G7/G9 Research preserves reproduced');
  ok(restored.draft[`G10:STE:${STE_RESEARCH}`].decision === 'REJECTED', 'Silver Research exclusion reproduced as an explicit REJECT decision');
  const compiledSix = compileDraftOfferings(sixGroups, restored.draft, { countText: '', identitiesText: '' });
  const idCounts = new Map<number, number>();
  for (const o of compiledSix.offerings) idCounts.set(o.subjectId, (idCounts.get(o.subjectId) ?? 0) + 1);
  ok(compiledSix.offerings.length === 5, `five confirmed CREATE choices compile (got ${compiledSix.offerings.length})`);
  ok(compiledSix.offerings.every((o) => o.classification === 'SPECIALIZATION'), 'all reproduced CREATE choices carry SPECIALIZATION classification');
  ok(idCounts.get(102) === 3 && idCounts.get(103) === 1 && idCounts.get(104) === 1,
    `reproduced set = Research G7/8/9 (id 102 ×3) + Applied Physics (103 ×1) + Robotics (104 ×1) (got ${JSON.stringify([...idCounts])})`);
  ok(compiledSix.heldOut.includes(`G10:STE:${STE_RESEARCH}`), 'Silver Research is held out of the offering set');
  const textRoundTrip = restoreDraftText(JSON.stringify(doc), sixGroups, CONTEXT);
  ok(textRoundTrip.draft[`G10:STE:${STE_ROBOTICS}`].decision === 'CONFIRMED', 'text-based restore (real file path) round-trips');

  console.log('=== D6: restore fails closed with visible errors ===');
  const hostile = JSON.parse(JSON.stringify(doc)) as Record<string, any>;
  assert.throws(() => restoreDraft({ ...hostile, schoolId: 2 } as never, sixGroups, CONTEXT), /school/, 'wrong school rejects');
  assert.throws(() => restoreDraft({ ...hostile, schoolYearId: 7 } as never, sixGroups, CONTEXT), /school year/, 'wrong year rejects');
  assert.throws(() => restoreDraft({ ...hostile, sourceRevisionHash: OTHER_HASH } as never, sixGroups, CONTEXT), /source revision/, 'stale/mismatched source-revision hash rejects');
  assert.throws(() => restoreDraft({ ...hostile, sourceRevisionHash: '' } as never, sixGroups, CONTEXT), /hexadecimal/, 'blank source-revision hash rejects');
  assert.throws(() => restoreDraft({ ...hostile, sourceRevisionHash: 42 } as never, sixGroups, CONTEXT), /hexadecimal/, 'wrong-type source-revision hash rejects');
  assert.throws(() => restoreDraft({ ...hostile, format: 'nope', version: 3 } as never, sixGroups, CONTEXT), /format or version/, 'unknown format rejects');
  assert.throws(() => restoreDraft({ ...hostile, version: 2 } as never, sixGroups, CONTEXT), /format or version/, 'legacy v2 draft rejects (format versioned forward)');
  assert.throws(() => restoreDraft({ ...hostile, sneakyField: true } as never, sixGroups, CONTEXT), /unknown field/, 'unknown top-level field rejects');
  assert.throws(() => restoreDraft({ ...hostile, termDraft: { ...hostile.termDraft, countText: '2', bogus: 1 } } as never, sixGroups, CONTEXT), /unknown field/, 'unknown term-draft field rejects');
  const malformedRow = JSON.parse(JSON.stringify(doc)) as Record<string, any>;
  malformedRow.rows['G7:REGULAR:DW_MATH'].decision = 'AUTO_APPROVE';
  assert.throws(() => restoreDraft(malformedRow, sixGroups, CONTEXT), /unknown decision/, 'hostile decision value rejects');
  const unknownRowField = JSON.parse(JSON.stringify(doc)) as Record<string, any>;
  unknownRowField.rows['G7:REGULAR:DW_MATH'].rogue = true;
  assert.throws(() => restoreDraft(unknownRowField, sixGroups, CONTEXT), /unknown field/, 'unknown row field rejects');
  assert.throws(() => restoreDraftText('{ nope', sixGroups, CONTEXT), /JSON/, 'malformed JSON rejects');
  const dupText = JSON.stringify(doc).replace(/"rows":\{/, '"rows":{"G7:REGULAR:DW_MATH":' + JSON.stringify(doc.rows['G7:REGULAR:DW_MATH']) + ',');
  assert.throws(() => restoreDraftText(dupText, sixGroups, CONTEXT), /duplicate key/, 'duplicate row key in file rejects');
  const dupTopText = JSON.stringify(doc).replace(/"exportedAt":/, '"exportedAt":' + JSON.stringify(doc.exportedAt) + ',"exportedAt":');
  assert.throws(() => restoreDraftText(dupTopText, sixGroups, CONTEXT), /duplicate key/, 'duplicate top-level key in file rejects');
  ok(findFirstDuplicateJsonKey(JSON.stringify({ a: 1, b: 2 })) === null, 'no false duplicate for unique keys');
  const keyLikeInString = JSON.stringify({ termDraft: { identitiesText: 'Q1: G7:REGULAR:DW_MATH' }, rows: { x: { decision: 'UNDECIDED' } } });
  ok(findFirstDuplicateJsonKey(keyLikeInString) === null, 'key-looking text inside a string value is never treated as a duplicate key');

  console.log('=== D7: no apply/term PUT surface in the pure draft layer ===');
  ok(!JSON.stringify(compileDraftOfferings(sixGroups, restored.draft, { countText: '', identitiesText: '' })).includes('/apply'), 'compile output carries no apply dispatch');
  ok(!('PUT' in serializeDraft(1, 8, REV_HASH, { countText: '', identitiesText: '' }, sixDraft)), 'serialized draft is a pure client document with no transport verb');

  console.log('=== D8: SCA-03E-R3 — escape-equivalent duplicates, 64-hex hash, exact row-set ===');
  // 1) Escape-decoded duplicate keys rejected BEFORE JSON.parse.
  const escTop = JSON.stringify(doc).replace(/"schoolId":1,/, '"schoolId":1,"\\u0073choolId":1,');
  assert.throws(() => restoreDraftText(escTop, sixGroups, CONTEXT), /duplicate key/, 'raw-equivalent escaped top-level key ("\\u0073choolId") rejected before JSON.parse');
  const rowKey = 'G7:REGULAR:DW_MATH';
  const escRow = JSON.stringify(doc).replace(
    new RegExp(`"${rowKey}"\\s*:`),
    `"${rowKey.replace('M', '\\u004d')}":${JSON.stringify(doc.rows[rowKey])},"${rowKey}":`,
  );
  assert.throws(() => restoreDraftText(escRow, sixGroups, CONTEXT), /duplicate key/, 'raw-equivalent escaped row key rejected before JSON.parse');
  ok(findFirstDuplicateJsonKey(escTop) !== null && findFirstDuplicateJsonKey(escRow) !== null,
    'scanner flags both escape-equivalent duplicates');

  // 2) sourceRevisionHash must be exactly 64 hexadecimal characters.
  assert.throws(() => restoreDraft({ ...hostile, sourceRevisionHash: 'ABC' } as never, sixGroups, CONTEXT), /hexadecimal/, 'short source-revision hash rejects');
  assert.throws(() => restoreDraft({ ...hostile, sourceRevisionHash: 'z'.repeat(64) } as never, sixGroups, CONTEXT), /hexadecimal/, '64-char non-hex source-revision hash rejects');
  assert.throws(() => restoreDraft({ ...hostile, sourceRevisionHash: REV_HASH.toLowerCase() } as never, sixGroups, CONTEXT), /source revision/, 'lowercase 64-hex hash mismatches (exact string equality)');

  // 3) Saved row-key set must EXACTLY equal the current candidate group-key set.
  const missingRow = JSON.parse(JSON.stringify(doc)) as Record<string, any>;
  delete missingRow.rows[rowKey];
  assert.throws(() => restoreDraft(missingRow, sixGroups, CONTEXT), /missing candidate row/, 'missing candidate row rejects (exact row-set required)');
  const preFailure = buildDraftFromGroups(sixGroups);
  try {
    restoreDraft(missingRow, sixGroups, CONTEXT);
    ok(false, 'failed restore must throw');
  } catch {
    ok(true, 'failed restore throws and applies nothing');
  }
  ok(preFailure[rowKey].decision === 'UNDECIDED', 'current UI draft unchanged after failed restore');

  console.log(`\ndecision-draft: ${passed} passed, ${failed} failed`);
  if (failed > 0) process.exit(1);
}

main();