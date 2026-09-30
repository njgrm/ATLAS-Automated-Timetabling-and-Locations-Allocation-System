/**
 * A6 — reuse guard for the placement-feasibility check.
 *
 * Packet §1/§4: the check MUST be a composition of existing generator-aligned
 * primitives. A local re-implementation of interval overlap, time parsing, term
 * scope, slot enumeration, or conflict rules is a `CORRECTION_REQUIRED` finding.
 * This source-level guard pins that contract: the module has no local copy of
 * the shared primitives and imports the ones the packet names.
 *
 * Run: `npm run test:a6-tl-placement` (wired in atlas-server/package.json in the
 * same commit).
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const here = dirname(fileURLToPath(import.meta.url));
const SERVICE_PATH = resolve(here, '../services/teaching-load-placement-check.service.ts');
const source = readFileSync(SERVICE_PATH, 'utf8');

test('imports the shared insertion primitives (no second slot search)', () => {
  assert.match(source, /from '\.\/timetable-insertion\.service\.js'/, 'imports timetable-insertion.service.js');
  for (const primitive of [
    'searchCandidateSlots',
    'buildWeeklyDayShape',
    'emptyOccupancy',
    'addLockedSessionOccupancy',
    'filterCompatibleRooms',
    'guidanceFor',
  ]) {
    assert.match(source, new RegExp(`\\b${primitive}\\b`), `uses the shared primitive ${primitive}`);
  }
});

test('imports the shared demand authority (no second demand computation)', () => {
  assert.match(source, /from '\.\/timetable-demand\.service\.js'/, 'imports timetable-demand.service.js');
  assert.match(source, /\bbuildCanonicalTimetableDemand\b/, 'uses buildCanonicalTimetableDemand');
  assert.match(source, /\breadDayShapePolicy\b/, 'uses readDayShapePolicy');
});

test('imports the shared term-scope primitives (no local term-scope rules)', () => {
  assert.match(source, /from '\.\/effective-scheduled-resources\.js'/, 'imports effective-scheduled-resources.js');
  assert.match(source, /\beffectiveTermsOverlap\b/, 'uses effectiveTermsOverlap');
  assert.match(source, /\bentryTermScope\b/, 'uses entryTermScope');
});

test('declares no local copy of the shared primitives', () => {
  const forbiddenDeclarations = [
    /function\s+intervalsOverlap\b/,
    /const\s+intervalsOverlap\b/,
    /function\s+toMinutes\b/,
    /const\s+toMinutes\b/,
    /function\s+timeToMinutes\b/,
    /const\s+timeToMinutes\b/,
    /function\s+minutesToHhmm\b/,
    /const\s+minutesToHhmm\b/,
    /function\s+effectiveTermsOverlap\b/,
    /const\s+effectiveTermsOverlap\b/,
    /function\s+entryTermScope\b/,
    /const\s+entryTermScope\b/,
    /function\s+buildWeeklyDayShape\b/,
    /function\s+searchCandidateSlots\b/,
    /function\s+filterCompatibleRooms\b/,
  ];
  for (const pattern of forbiddenDeclarations) {
    assert.doesNotMatch(source, pattern, `must not re-declare ${pattern}`);
  }
});
