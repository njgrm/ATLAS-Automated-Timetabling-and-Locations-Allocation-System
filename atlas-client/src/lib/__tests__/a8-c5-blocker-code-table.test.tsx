/**
 * A8-C5 S2.1 / acceptance row A7 — every hard blocker code maps to a non-empty
 * sentence and a REAL mounted route, and a missing entry FAILS.
 *
 * The packet's rule 2: *"Inventory every hard blocker code the preflight can
 * emit; for each, name its fix page and write the sentence. A code with no fix
 * page is a defect."* Rule 3: *"a table-driven test asserting every hard blocker
 * code maps to a sentence and a route; a fixture per code."*
 *
 * FOUR independent things are proved, and the fourth is the one that stops the
 * test being vacuous:
 *
 *   1. INVENTORY COMPLETENESS (a). The client inventory is checked against the
 *      SERVER'S OWN SOURCE — the literal `code:` values
 *      `generation-preflight.service.ts` can emit, plus the
 *      `DerivedDemandBlockerCode` union `classifyDemandBlocker` passes through,
 *      plus the shape-policy pass-through. A code the server can emit and the
 *      table does not know is a FAILURE, not a note. This is the row that makes
 *      the table drift-proof.
 *   2. EVERY ROW IS COMPLETE (b). One FIXTURE PER CODE: for every code, a
 *      non-empty sentence template, a non-empty count noun, a button label, and
 *      a route that `matchRoutes` actually resolves against the REAL `appRoutes`
 *      table. A route that no route table mounts is a dead button and fails.
 *   3. THE SENTENCE IS PLAIN (c). No engine code, no id, no `…`, no doubled
 *      word, and the count is a CLASS count with the right verb form.
 *   4. A MISSING ENTRY FAILS (d) — the FAILING-FIRST CONTROL, proved by running
 *      the real predicate over a code the table genuinely does not carry. Without
 *      this, rows (a)-(c) could all pass on a table that silently ignored unknown
 *      codes, which is exactly the defect rule 2 names.
 *
 * Run: `npm run test:a8-c5-blocker-table`
 */

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import test from 'node:test';

import { JSDOM } from 'jsdom';

// `@/App` module-evaluates `createBrowserRouter(appRoutes)` at import time, which
// needs a `document`. The DOM is installed BEFORE the dynamic imports below, for
// the same reason `a3-c6-reachable-route-hygiene.test.tsx` does it.
const dom = new JSDOM('<!doctype html><html><body></body></html>', { url: 'http://localhost/timetable' });
Object.assign(globalThis, {
	window: dom.window,
	document: dom.window.document,
	HTMLElement: dom.window.HTMLElement,
	Element: dom.window.Element,
	Node: dom.window.Node,
	localStorage: dom.window.localStorage,
});

const { matchRoutes } = await import('react-router-dom');
const { appRoutes } = await import('@/App');
const {
	BLOCKER_CODE_COPY,
	PREFLIGHT_BLOCKER_CODES,
	blockerFixAction,
	blockerSentence,
	causeForBlockerCode,
} = await import('@/lib/timetable-blocker-code-copy');

const CLIENT_ROOT = resolve(import.meta.dirname, '../../..');
const SERVER_ROOT = resolve(CLIENT_ROOT, '..', 'atlas-server');

function readServerSource(relativePath: string): string {
	return readFileSync(resolve(SERVER_ROOT, relativePath), 'utf8');
}

// ─────────────────────────────────────────────────────────────────────────────
// THE PREDICATE UNDER TEST. Extracted so the failing-first control can run the
// REAL check over a code the table does not carry, rather than asserting that a
// hand-written "would it fail?" copy would fail.
// ─────────────────────────────────────────────────────────────────────────────
type InventoryCheck = { code: string; complete: boolean; missing: string[] };

/** The completeness predicate the table is held to. */
function checkCodeComplete(code: string): InventoryCheck {
	const row = BLOCKER_CODE_COPY[code];
	const missing: string[] = [];
	if (!row) return { code, complete: false, missing: ['no table row at all'] };
	if (typeof row.sentence !== 'string' || row.sentence.trim().length === 0) missing.push('sentence');
	if (typeof row.noun !== 'string' || row.noun.trim().length === 0) missing.push('noun');
	if (typeof row.buttonLabel !== 'string' || row.buttonLabel.trim().length === 0) missing.push('buttonLabel');
	// Every row is a HARD blocker today, so it must carry a real fix route. A row
	// that is advisory instead must carry the WRITTEN reason the packet requires.
	if (row.advisoryWithReason === undefined) {
		if (typeof row.route !== 'string' || row.route.trim().length === 0) missing.push('route');
	} else if (row.advisoryWithReason.trim().length === 0) {
		missing.push('advisoryWithReason is empty — a non-blocking code must WRITE the reason');
	}
	return { code, complete: missing.length === 0, missing };
}

/** Is `route` actually mounted? Decided by the real router, not by a list. */
function isMountedRoute(route: string): boolean {
	const matches = matchRoutes(appRoutes as never, route);
	return Array.isArray(matches) && matches.length > 0;
}

// ─────────────────────────────────────────────────────────────────────────────
// (a) INVENTORY COMPLETENESS — the table cannot drift from the server.
// ─────────────────────────────────────────────────────────────────────────────
test('A7-a every code the server preflight can emit has a row in the one table', () => {
	const preflightSource = readServerSource('src/services/generation-preflight.service.ts');
	const demandSource = readServerSource('src/services/derived-demand.service.ts');
	const validatorSource = readServerSource('src/services/constraint-validator.ts');

	// ── The preflight's OWN emission ────────────────────────────────────────
	// The literal `code: 'X'` values `buildGenerationPreflight` pushes.
	const emitted = new Set<string>();
	for (const match of preflightSource.matchAll(/code: '([A-Z0-9_]+)'/g)) emitted.add(match[1]);

	// `classifyShapePolicyBlocker` re-emits a shape-policy blocker's own code and
	// `classifyDemandBlocker` re-emits a `DerivedDemandBlockerCode` verbatim. Both
	// are pass-throughs, so the demand service's union IS the second inventory.
	const demandCodes = new Set<string>();
	// The union ends with a `;`, not a `,`, so the terminator is matched loosely.
	for (const match of demandSource.matchAll(/^\t\| '([A-Z0-9_]+)'[;,]?$/gm)) demandCodes.add(match[1]);

	// The shape-policy codes `classifyShapePolicyBlocker` forwards without naming.
	const shapePassthrough = new Set(['TERM_CACHE_MISSING', 'ROTATION_TERM_INVALID']);

	// `TL_NO_QUALIFIED_OWNER` is emitted by `classifyUnassignedBlocker` and reaches
	// the panel through `generation-readiness.service.ts`; it is part of the pair.
	const required = new Set<string>([...emitted, ...demandCodes, ...shapePassthrough]);

	// The three A8 C3 ADVISORY_CODES and the A8-C5 S1.2 third state are NOT
	// blockers: they are recorded, named, and still refused by publication (the
	// advisory ones) or block neither (the placeholder one). `ADVISORY_CODES` and
	// `PLACEHOLDER_OWNED_CODES` in the server groups service are the authority for
	// that split, so they are excluded here rather than demanded to carry a route
	// that would send an operator to fix something that is not broken.
	// `WORKLOAD_POLICY_BLOCK` IS a preflight blocker and IS in the table.
	const NOT_PREFLIGHT_BLOCKERS = new Set([
		'FACULTY_OVERLOAD',
		'FACULTY_SUBJECT_NOT_QUALIFIED',
		'SYNTHETIC_PLACEHOLDER_OWNED',
	]);
	for (const code of NOT_PREFLIGHT_BLOCKERS) required.delete(code);

	assert.ok(required.size >= 30, `the inventory scan must be substantial, found ${required.size} codes`);

	const known = new Set<string>([...PREFLIGHT_BLOCKER_CODES, ...Object.keys(BLOCKER_CODE_COPY)]);
	const unmapped = [...required].filter((code) => !known.has(code)).sort();
	assert.deepEqual(
		unmapped,
		[],
		`the server preflight can emit these codes and the client table knows none of them — a code with no fix page is a defect:\n  ${unmapped.join('\n  ')}`,
	);

	// ── A code with TWO surfaces must have copy on BOTH ──────────────────────
	// A hard VALIDATOR violation is a different surface: it is raised by the
	// constraint engine during a run and carries its own copy authority
	// (`VIOLATION_COPY`, constraint-validator.ts) plus its own repair resolver. A
	// code can legitimately be BOTH a preflight blocker AND a run violation — that
	// is one fact seen on two surfaces (A8-C5 S1.2's
	// `SYNTHETIC_PLACEHOLDER_OWNED` is exactly that case). What must never happen
	// is a code that reaches the panel with NO client row, so this row asserts the
	// client half of that overlap rather than forbidding the overlap itself.
	const validatorCodes = new Set<string>();
	for (const match of validatorSource.matchAll(/'([A-Z][A-Z0-9_]{4,})'/g)) validatorCodes.add(match[1]);
	// The full set the preflight can emit, BEFORE the non-blocker exclusion, so the
	// overlap check below sees the placeholder code too.
	const preflightEmitted = new Set<string>([...emitted, ...demandCodes, ...shapePassthrough]);
	const sharedSurfaces = [...validatorCodes].filter((code) => preflightEmitted.has(code)).sort();
	assert.ok(sharedSurfaces.length > 0, 'the two surfaces genuinely overlap, so this row is not vacuous');
	const sharedWithoutCopy = sharedSurfaces.filter((code) => !Object.prototype.hasOwnProperty.call(BLOCKER_CODE_COPY, code));
	assert.deepEqual(
		sharedWithoutCopy,
		[],
		`these codes reach the panel AND the run, and the panel has no row for them:\n  ${sharedWithoutCopy.join('\n  ')}`,
	);

	// And no row may exist for a code the preflight can never emit, because that is
	// copy nobody will ever read and it will rot.
	const orphanRows = Object.keys(BLOCKER_CODE_COPY)
		.filter((code) => !required.has(code) && !NOT_PREFLIGHT_BLOCKERS.has(code))
		.sort();
	assert.deepEqual(
		orphanRows,
		[],
		`these rows describe codes the preflight never emits — delete them rather than let the copy rot:\n  ${orphanRows.join('\n  ')}`,
	);
});

// ─────────────────────────────────────────────────────────────────────────────
// (b) EVERY ROW IS COMPLETE — one fixture per code.
// ─────────────────────────────────────────────────────────────────────────────
test('A7-b every code in the inventory has a non-empty sentence and a REAL mounted route', () => {
	assert.ok(PREFLIGHT_BLOCKER_CODES.length >= 30, 'the inventory is a real list, not a stub');
	assert.equal(
		new Set(PREFLIGHT_BLOCKER_CODES).size,
		PREFLIGHT_BLOCKER_CODES.length,
		'the inventory has no duplicate code — a duplicate would hide a missing row',
	);

	for (const code of PREFLIGHT_BLOCKER_CODES) {
		const check = checkCodeComplete(code);
		assert.ok(
			check.complete,
			`${code} is incomplete: missing ${check.missing.join(', ')} — every code needs a sentence, a count noun, a button label and a real fix route`,
		);

		const row = BLOCKER_CODE_COPY[code];
		if (row.advisoryWithReason !== undefined) continue;
		assert.equal(
			isMountedRoute(row.route),
			true,
			`${code} points at ${row.route}, which NO route in the real appRoutes table mounts — a fix button that goes nowhere is the defect this row exists for`,
		);
		assert.equal(
			row.route,
			row.route.split('?')[0],
			`${code} must not smuggle a query string into the route: ${row.route}`,
		);
		assert.equal(
			row.route.startsWith('/') && !row.route.includes('//'),
			true,
			`${code} route must be an absolute app path: ${row.route}`,
		);
	}

	// The action resolver is the SAME table, so the panel and the repair can never
	// disagree about where a code is fixed.
	for (const code of PREFLIGHT_BLOCKER_CODES) {
		const action = blockerFixAction(code);
		assert.ok(action, `${code} must resolve a fix action`);
		assert.equal(action!.href, BLOCKER_CODE_COPY[code].route, `${code} action route comes from the table`);
		assert.equal(action!.label, BLOCKER_CODE_COPY[code].buttonLabel, `${code} action label comes from the table`);
	}
});

// ─────────────────────────────────────────────────────────────────────────────
// (c) THE SENTENCE IS PLAIN — no code, no id, no ellipsis, no doubled word.
// ─────────────────────────────────────────────────────────────────────────────
test('A7-c every sentence is plain words with a class count, never a code, an id or an ellipsis', () => {
	for (const code of PREFLIGHT_BLOCKER_CODES) {
		const row = BLOCKER_CODE_COPY[code];
		for (const count of [1, 2, 7, 468]) {
			const sentence = blockerSentence(code, count);
			assert.ok(sentence.trim().length > 0, `${code}@${count} must render something`);
			assert.equal(sentence.includes('…'), false, `${code}@${count} must not truncate with an ellipsis (AGENTS.md §8)`);
			assert.equal(
				/\b[A-Z][A-Z0-9_]{5,}\b/.test(sentence),
				false,
				`${code}@${count} leaks a raw engine token: ${sentence}`,
			);
			assert.equal(
				/\b#\d+\b/.test(sentence),
				false,
				`${code}@${count} leaks an id: ${sentence}`,
			);
			assert.equal(
				/\bneed need\b|\bare are\b|\bis is\b/.test(sentence),
				false,
				`${code}@${count} doubles a word: ${sentence}`,
			);
			assert.equal(
				sentence.includes(String(count)),
				true,
				`${code}@${count} must carry the count the server measured: ${sentence}`,
			);
			assert.equal(
				sentence.toLowerCase().includes(code.toLowerCase()),
				false,
				`${code} must not print its own code in the sentence: ${sentence}`,
			);
		}

		// The two count forms must both read as English.
		const one = blockerSentence(code, 1);
		const many = blockerSentence(code, 2);
		assert.notEqual(one, many, `${code} must distinguish one from many`);
		assert.equal(/\b1\b/.test(one), true, `${code} singular form carries the count of 1: ${one}`);
		assert.equal(/\b2\b/.test(many), true, `${code} plural form carries the count of 2: ${many}`);

		// The button label is a verb phrase, not a question and not a sentence.
		assert.equal(row.buttonLabel.includes('?'), false, `${code} button label is not a question`);
		assert.ok(row.buttonLabel.length <= 32, `${code} button label must stay short: ${row.buttonLabel}`);
	}

	// The two coverage codes share ONE sentence, because they are one fact at two
	// grains and the panel folds them into one line. A test that let them drift
	// apart would put two nearly identical lines on screen.
	assert.equal(
		blockerSentence('TL_DEMAND_UNCOVERED', 50),
		blockerSentence('TL_NO_QUALIFIED_OWNER', 50),
		'the two coverage codes read as ONE cause, not two',
	);
	assert.equal(causeForBlockerCode('TL_DEMAND_UNCOVERED'), 'TEACHER_COVERAGE_GAP');
	assert.equal(causeForBlockerCode('TL_NO_QUALIFIED_OWNER'), 'TEACHER_COVERAGE_GAP');
	assert.equal(causeForBlockerCode('ROOMS_MISSING'), 'ROOMS_MISSING', 'every other code is its own cause');

	// A code with no row still renders a usable sentence rather than throwing —
	// but row A7-d is what makes that SAFE: it is a failure upstream, never a
	// silent pretty fallback.
	assert.equal(typeof blockerSentence('A_CODE_THAT_DOES_NOT_EXIST', 3), 'string');
	assert.equal(blockerFixAction('A_CODE_THAT_DOES_NOT_EXIST'), null);
});

// ─────────────────────────────────────────────────────────────────────────────
// (d) FAILING-FIRST CONTROL — a code with no entry FAILS.
// ─────────────────────────────────────────────────────────────────────────────
test('A7-d FAILING-FIRST CONTROL: a code with no table entry FAILS the same completeness check', () => {
	// Planted code: absent from BOTH the inventory and the table, exactly as a new
	// server code would be on the day it ships.
	const PLANTED = 'A_NEW_SERVER_CODE_THAT_HAS_NO_ROW';
	assert.equal((PREFLIGHT_BLOCKER_CODES as readonly string[]).includes(PLANTED), false);
	assert.equal(Object.prototype.hasOwnProperty.call(BLOCKER_CODE_COPY, PLANTED), false);

	// THE REAL PREDICATE, over the planted code. On a table that merely tolerated
	// unknown codes this would report `complete: true` and the whole suite would be
	// vacuous; it reports the failure the packet demands.
	const check = checkCodeComplete(PLANTED);
	assert.equal(check.complete, false, 'a code with no entry must FAIL the completeness check');
	assert.deepEqual(check.missing, ['no table row at all']);

	// The inverse control, so the predicate is not simply "always false": a real
	// row passes it, and a row with its route blanked out fails it. Those two prove
	// the check discriminates per FIELD, which is what makes row (b) meaningful.
	for (const code of PREFLIGHT_BLOCKER_CODES) {
		assert.equal(checkCodeComplete(code).complete, true, `${code} must pass the predicate`);
	}
	for (const field of ['sentence', 'noun', 'buttonLabel', 'route'] as const) {
		const real = BLOCKER_CODE_COPY.TL_DEMAND_UNCOVERED;
		const damaged: Record<string, unknown> = { ...real, [field]: '' };
		const previous = BLOCKER_CODE_COPY.TL_DEMAND_UNCOVERED;
		BLOCKER_CODE_COPY.TL_DEMAND_UNCOVERED = damaged as never;
		try {
			const damagedCheck = checkCodeComplete('TL_DEMAND_UNCOVERED');
			assert.equal(damagedCheck.complete, false, `blanking ${field} must fail the check`);
			assert.deepEqual(damagedCheck.missing, [field], `and it must name ${field} as the missing field`);
		} finally {
			BLOCKER_CODE_COPY.TL_DEMAND_UNCOVERED = previous;
		}
	}

	// And a code marked advisory must WRITE the reason. An empty reason is the
	// "make it advisory and write the reason" escape hatch left open, so it fails.
	{
		const code = 'ROOMS_MISSING';
		const real = BLOCKER_CODE_COPY[code];
		BLOCKER_CODE_COPY[code] = { ...real, advisoryWithReason: '   ' };
		try {
			const check2 = checkCodeComplete(code);
			assert.equal(check2.complete, false, 'an advisory row with a blank reason must fail');
			assert.deepEqual(check2.missing, ['advisoryWithReason is empty — a non-blocking code must WRITE the reason']);
		} finally {
			BLOCKER_CODE_COPY[code] = real;
		}
	}
});
