import assert from 'node:assert/strict';
import test from 'node:test';

import {
  groupInsertionReadiness,
  placementSaveAvailability,
  type InsertionReadinessSummary,
} from '../timetable-ttc02-insertion';

function sampleLine(state: 'MISSING_TEACHING_LOAD_OWNER' | 'INDIVIDUALLY_PREVIEWABLE' | 'HG_FORBIDDEN', index: number) {
  return {
    demandKey: `${state}-${index}`,
    subjectCode: 'MATH',
    subjectName: 'Mathematics',
    sectionName: 'Grade 7 - A',
    gradeLevel: 7,
    programType: 'REGULAR',
    termIdentity: 'T1',
    termIndex: 1,
    sessionsPerWeek: 4,
    ownerFacultyName: state === 'INDIVIDUALLY_PREVIEWABLE' ? 'Probe Owner' : null,
    state,
    guidance: {
      reason: state,
      action: state === 'MISSING_TEACHING_LOAD_OWNER' ? 'FIX_TEACHING_LOAD' : state === 'HG_FORBIDDEN' ? 'REVIEW_CURRICULUM' : 'OPEN_DRAFT',
      message: 'message',
      prerequisite: 'prerequisite',
      primaryAction: 'primary action',
    },
  };
}

test('reason grouping is deterministic and orders owners before slots', () => {
  const summary = {
    scope: { schoolId: 1, schoolYearId: 8 },
    demand: { totalLines: 4, totalSessions: 16, totalsByTerm: { T1: 16 } },
    breakdown: { MISSING_TEACHING_LOAD_OWNER: 2, INDIVIDUALLY_PREVIEWABLE: 1, HG_FORBIDDEN: 1 },
    insertionReadyLines: 1,
    unresolvedLines: 3,
    lineStates: [
      sampleLine('INDIVIDUALLY_PREVIEWABLE', 0),
      sampleLine('MISSING_TEACHING_LOAD_OWNER', 1),
      sampleLine('HG_FORBIDDEN', 2),
      sampleLine('MISSING_TEACHING_LOAD_OWNER', 3),
    ],
    liveGenerationRunCount: 0,
  } as InsertionReadinessSummary;

  const groups = groupInsertionReadiness(summary);
  assert.deepEqual(
    groups.map((group) => group.reason),
    ['HG_FORBIDDEN', 'MISSING_TEACHING_LOAD_OWNER', 'INDIVIDUALLY_PREVIEWABLE'],
    'HG must surface first, then owner problems, then placeable',
  );
  assert.equal(groups[1].count, 2);
  assert.equal(groups[0].guidance?.action, 'REVIEW_CURRICULUM');
});

test('save boundary is clearly labelled and disabled when apply is not enabled', () => {
  const blocked = placementSaveAvailability({ state: 'NO_AVAILABLE_SLOT', hasCandidates: false, allowApply: true });
  assert.equal(blocked.canSave, false);
  assert.equal(blocked.label, 'Save blocked');

  const previewOnly = placementSaveAvailability({ state: 'INDIVIDUALLY_PREVIEWABLE', hasCandidates: true, allowApply: false });
  assert.equal(previewOnly.canSave, false);
  assert.match(previewOnly.label, /preview only/);
  assert.match(previewOnly.detail, /No production apply endpoint/);

  const enabled = placementSaveAvailability({ state: 'INDIVIDUALLY_PREVIEWABLE', hasCandidates: true, allowApply: true });
  assert.equal(enabled.canSave, true);
  assert.equal(enabled.label, 'Save placement');
});
