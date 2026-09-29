/**
 * A3-C8 S1 — `/audit` reads as the calm system, and every status has a non-colour cue.
 *
 * `src/pages/Audit.tsx` was the last page in this route family carrying raw Tailwind ramp
 * literals: 28 distinct classes across 32 lines at base `7ea2abda1`, measured with the
 * `grep -oE "(text|bg|border|ring|divide|from|to|via|outline|decoration)-(slate|...)-[0-9]{2,3}"`
 * distinct-token recipe. This file pins the result at 2 distinct / 8 lines and, more
 * importantly, pins the two things a colour sweep silently breaks.
 *
 *   Row 1  no raw ramp literals survive (with ONE documented carve-out, below)
 *   Row 2  the three severities are still three DIFFERENT treatments
 *   Row 3  every severity has a non-colour cue, at BOTH badge render sites
 *   Row 4  the `focus` search-param contract still resolves
 *   Row 5  no internal identifier or raw enum reaches the user
 *   Row 6  the row-1 detector is proved able to fail
 *
 * ── THE CARVE-OUT IN ROW 1, stated up front because it is the one judgement call here ──
 *
 * Two other lanes pin `Audit.tsx`'s raw-neutral TEXT count at **exactly 8** with
 * `assert.equal`, and I may not edit either file:
 *   palette-token-sweep-a3-s-e.test.ts:193  STEP_2_SURVIVING_RESIDUALS  ['src/pages/Audit.tsx', 8]
 *   palette-slate400-step2-a3-s-f.test.ts:184 EXPECTED_RESIDUAL_PER_OWNED_FILE [.., 8]
 * Both also pin the GLOBAL residual (`ratchet.total === 95`, `inScope.total === 68`).
 *
 * So the 8 occurrences of `text-slate-200` (3 decorative `|` separators) and
 * `text-slate-600` (5) stay, deliberately, and row 1 pins them by COUNT AND BY SHADE so
 * they cannot drift silently. The ratchet file's own correction note is the authority that
 * this is right rather than a shortcut: it measures `slate-200` on white at 1.232:1 and
 * calls those separators decorative, and it records the remaining `slate-600` sites as
 * residual shades "with no exact token" that need a rendered screen rather than a rename.
 * Turning them green would mean editing another lane's pins, which is not this lane's
 * authority — so this lane stops at the boundary and reports it instead.
 *
 * The chromatic ramp — sky, red, amber, emerald, green and the rest — IS fully removed,
 * and that is what row 1's first assertion gates.
 *
 * Run: `npm run test:a3-c8-audit`
 *
 * ── DATED BACKLOG (recorded, deliberately NOT fixed here) — 2026-09-28 ────────────
 * Two `info` inconsistencies survive this sweep. Both are real consolidation items and
 * neither is corrected by this stream, for a stated reason in each case.
 *
 *   1. `src/components/admin-workspace/AdminWorkspace.tsx:64` still maps the `info` tone to
 *      `border-sky-200 bg-sky-50 text-sky-700`. So `info` is NEUTRAL on `/audit` (this
 *      lane made it neutral) and SKY-BLUE on the admin workspace — the same semantic name
 *      renders two different colours in two places. NOT FIXED HERE: that file is another
 *      lane's sweep file carrying the same kind of pinned corpus count this stream had to
 *      re-pin, and editing it would move a pin that is not this lane's to move. The fix
 *      belongs to whichever lane owns that file, and must move its pin deliberately.
 *   2. `src/ui/badge-variants.ts:17` still ships a raw ramp in a SHARED primitive:
 *      `warning: 'bg-amber-100 text-amber-800'` (and `:18` `danger: 'bg-red-100 text-red-800'`).
 *      Every consumer of `<Badge variant="warning">` therefore still renders raw amber,
 *      so the warning family is not actually centralised. NOT FIXED HERE: it is a shared
 *      primitive whose blast radius is every badge in the product, which is its own packet
 *      and its own review. Note also that `src/ui/**` is OUTSIDE the counting scope of
 *      `a3-c8-warning-token.test.ts` (roots are `pages` and `components`), so this raw
 *      amber is invisible to that ratchet — a real blind spot, not a passing grade.
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import test from 'node:test';

const HERE = dirname(fileURLToPath(import.meta.url));
const CLIENT_ROOT = resolve(HERE, '../../..');
const AUDIT_PATH = 'src/pages/Audit.tsx';
/**
 * A5 C4 ITEM 5, ADDED: the findings panel was extracted out of `Audit.tsx` because
 * the page measured 1003 physical lines, over the AGENTS.md §8 cap. Two of the pins
 * below count things that now live in TWO files, so both are read here and the counts
 * are stated per file with the TOTAL preserved. Nothing is dropped: 8 raw neutrals
 * become 4 + 4, and 2 `SeverityBadge` render sites become 1 + 1.
 */
const AUDIT_PANEL_PATH = 'src/components/audit/AuditFindingsPanel.tsx';
const auditSource = readFileSync(resolve(CLIENT_ROOT, AUDIT_PATH), 'utf8');
const auditPanelSource = readFileSync(resolve(CLIENT_ROOT, AUDIT_PANEL_PATH), 'utf8');
/** Every source this route owns, for the pins that count across the split. */
const auditSurfaceSource = `${auditSource}\n${auditPanelSource}`;

/** The real production values, not a copy of them. */
const { SEVERITY_TREATMENT, SeverityBadge, resolveFocusGroupId } = await import('@/pages/Audit');

/**
 * The raw-ramp detector, as a PURE function over a source string so row 6 can feed it a
 * fabricated class. Prefix list and shade range match the measurement the planner used, so
 * the number this file reports is comparable with the number in the handoff.
 */
const RAMP_PREFIXES = [
	'text', 'bg', 'border', 'ring', 'divide', 'from', 'to', 'via', 'outline', 'decoration',
] as const;
const RAMP_FAMILIES = [
	'slate', 'gray', 'zinc', 'neutral', 'stone', 'blue', 'red', 'violet', 'amber', 'emerald',
	'green', 'yellow', 'orange', 'pink', 'indigo', 'teal', 'cyan', 'sky', 'rose', 'fuchsia', 'lime',
] as const;
const RAMP_RE = new RegExp(
	`\\b(?:${RAMP_PREFIXES.join('|')})-(?:${RAMP_FAMILIES.join('|')})-\\d{2,3}\\b`,
	'g',
);

/** Every raw ramp class in `source`, deduplicated and sorted. */
function findRawRampClasses(source: string): string[] {
	return [...new Set(source.match(RAMP_RE) ?? [])].sort();
}

// ── Row 1 ─────────────────────────────────────────────────────────────────────

/**
 * The chromatic half of the ramp, listed EXPLICITLY rather than derived, so the assertion
 * states what it protects. If a lane later swaps `emerald` for `lime`, this list goes red
 * and the change has to be made on purpose.
 */
const CHROMATIC_RAMP_FAMILIES = [
	'blue', 'red', 'violet', 'amber', 'emerald', 'green', 'yellow', 'orange', 'pink',
	'indigo', 'teal', 'cyan', 'sky', 'rose', 'fuchsia', 'lime',
] as const;
const CHROMATIC_RE = new RegExp(
	`\\b(?:${RAMP_PREFIXES.join('|')})-(?:${CHROMATIC_RAMP_FAMILIES.join('|')})-\\d{2,3}\\b`,
	'g',
);

/**
 * The token families this page is EXPECTED to use instead. Named, non-empty, and asserted to
 * be the ones actually present — a token sweep that quietly removed the tokens too would
 * leave a page with no colour at all, and that is the failure this list exists to catch.
 */
const EXPECTED_TOKEN_PREFIXES = [
	'destructive', 'destructive-foreground', 'warning', 'warning-foreground', 'warning-muted',
	'warning-border', 'muted', 'muted-foreground', 'border', 'accent', 'accent-foreground',
	'foreground', 'primary',
] as const;

test('row 1: Audit.tsx holds zero raw chromatic ramp classes, and the token families are really used', () => {
	// ── F1, STATED WITH ITS LIMIT (record accuracy, 2026-09-28) ────────────────────
	// "Zero raw classes" is met for the CHROMATIC RAMP ONLY. This row must never be read
	// as "Audit.tsx carries no raw Tailwind classes": the page still holds 8 raw
	// `text-slate-*` lines, asserted deliberately by row 1b. The residual slate is held
	// by TWO ACCEPTED GATES in files outside this stream's scope —
	// `palette-token-sweep-a3-s-e.test.ts:193` and `palette-slate400-step2-a3-s-f.test.ts:184`,
	// both `['src/pages/Audit.tsx', 8]` — plus the global equalities `EXPECTED_TOTAL = 95`
	// (s-e:178) and `EXPECTED_IN_SCOPE_RESIDUAL = 68` (s-e:181, s-f:172). Those files are
	// S-E/S-F's to move; this stream may not edit them, so the honest statement is
	// "chromatic ramp tokenised, slate residual held by two external gates" — NOT
	// "the page is fully tokenised".
	const chromatic = [...new Set(auditSource.match(CHROMATIC_RE) ?? [])].sort();
	assert.deepEqual(
		chromatic,
		[],
		`Audit.tsx still renders raw chromatic ramp classes: ${chromatic.join(', ')}. ` +
			'These are the families this lane removed; the three severity treatments must come from the tokens.',
	);

	// Guard the OTHER direction: the replacement must exist, not just the absence of the old.
	const severities = Object.values(SEVERITY_TREATMENT);
	for (const { className } of severities) {
		for (const token of EXPECTED_TOKEN_PREFIXES) {
			if (new RegExp(`(?:^|\\s)${token}(?:[/-]|\\s|$)`).test(className)) return;
		}
	}
	assert.fail(
		'no severity treatment uses any of the expected token families ' +
			`(${EXPECTED_TOKEN_PREFIXES.join(', ')}); the sweep removed the ramp literals without landing on the tokens.`,
	);
});

test('row 1b: the raw-neutral residue is EXACTLY the 8 occurrences two other lanes pin, and only the two pinned shades', () => {
	// The pin: palette-token-sweep-a3-s-e:193 and palette-slate400-step2-a3-s-f:184 both assert 8.
	// (Row 1 of this file previously cited `palette-token-sweep:189`; that line number is
	// STALE and was corrected here to the actual 193 — a citation that points at the wrong
	// line is not evidence, it is a rumour.) The two global equalities these two files also
	// carry are `EXPECTED_TOTAL = 95` (s-e:178) and `EXPECTED_IN_SCOPE_RESIDUAL = 68`
	// (s-e:181, s-f:172); note that 68 there is a raw-neutral count and is unrelated to the
	// 68 files in the a3-c8-warning-token corpus pin, which is a different measurement.
	// ── THE CARVE-OUT IN ROW 1 — RESTATED, because the extraction moved HALF of it ──
	//
	// A5 C4 ITEM 5. The two external gates that pin this route's raw-neutral TEXT
	// count (`palette-token-sweep-a3-s-e` and `palette-slate400-step2-a3-s-f`) now
	// name TWO files: `src/pages/Audit.tsx` and `src/components/audit/
	// AuditFindingsPanel.tsx`. The TOTAL is unchanged at 8 — this is a split, and a
	// split moves code rather than deleting it — but the page alone now holds 4, so
	// "the count in Audit.tsx" is no longer the count of the route.
	//
	// This row is therefore stated per file, with the total asserted as well. That is
	// STRICTER than the single-file count it replaces: a lane that moved a neutral out
	// of the page and failed to move it into the panel is now red, where before the
	// page-local number alone could be satisfied.
	const rawNeutralsIn = (source: string) => [...source.match(/\btext-(?:slate|zinc|gray|neutral|stone)-\d{2,3}\b/g) ?? []];
	const pageNeutrals = rawNeutralsIn(auditSource);
	const panelNeutrals = rawNeutralsIn(auditPanelSource);
	const rawNeutrals = [...pageNeutrals, ...panelNeutrals];
	assert.equal(
		rawNeutrals.length,
		8,
		`the /audit route holds ${rawNeutrals.length} raw neutral text classes across ` +
			`${AUDIT_PATH} (${pageNeutrals.length}) and ${AUDIT_PANEL_PATH} (${panelNeutrals.length}); ` +
			'the sweep and slate400 controls assert a combined 8, so any other number turns one of them red. ' +
			'If a later lane lowers the pin, update this row in the same commit.',
	);
	// The per-file split, stated so neither file can quietly drift from the total.
	assert.equal(pageNeutrals.length, 4, `${AUDIT_PATH} no longer holds its half of the residue (${pageNeutrals.length})`);
	assert.equal(panelNeutrals.length, 4, `${AUDIT_PANEL_PATH} no longer holds the moved half (${panelNeutrals.length})`);

	// Pinned by SHADE as well as by count, so the residue cannot be swapped for a different
	// raw neutral that happens to keep the total at 8.
	assert.deepEqual(
		[...new Set(rawNeutrals)].sort(),
		['text-slate-200', 'text-slate-600'],
		'the pinned residue must stay text-slate-200 (3 decorative separators) and text-slate-600 (5 body lines).',
	);
	assert.equal(
		rawNeutrals.filter((c) => c === 'text-slate-200').length,
		3,
		'the three `|` separators are the measured-1.232:1 decorative sites the ratchet file says must stay.',
	);
	assert.equal(
		rawNeutrals.filter((c) => c === 'text-slate-600').length,
		5,
		'the five body-text sites are the residual shades the ratchet defers to a rendered screen.',
	);
	// A5 C4, ADDED: the chromatic half is asserted on BOTH files, so the extraction
	// cannot have carried a raw chromatic class across unnoticed.
	for (const [label, source] of [[AUDIT_PATH, auditSource], [AUDIT_PANEL_PATH, auditPanelSource]] as const) {
		assert.deepEqual(
			[...new Set(source.match(CHROMATIC_RE) ?? [])].sort(),
			[],
			`${label} renders raw chromatic ramp classes after the split`,
		);
	}
});

// ── Row 2 ─────────────────────────────────────────────────────────────────────

function pairwiseDistinct(values: readonly string[]): boolean {
	return new Set(values).size === values.length;
}

test('row 2: the three severities are three visually distinct treatments', () => {
	const bySeverity = (['blocker', 'warning', 'info'] as const).map((s) => SEVERITY_TREATMENT[s]);
	const classNames = bySeverity.map((t) => t.className);
	const labels = bySeverity.map((t) => t.label);

	assert.ok(
		pairwiseDistinct(classNames),
		`two severities render identically (${classNames.join(' | ')}); the page would show three identical pills.`,
	);
	assert.ok(
		pairwiseDistinct(labels),
		`two severities share a label (${labels.join(' | ')}); the word is the second non-colour cue.`,
	);

	// Discrimination: the exact edit this row exists to catch — collapsing two severities
	// onto one treatment — must be reported as not-distinct.
	assert.equal(
		pairwiseDistinct([...classNames.slice(0, 2), classNames[0]]),
		false,
		'the distinctness check is broken: making two severities identical still reports distinct.',
	);
});

// ── Row 3 ─────────────────────────────────────────────────────────────────────

test('row 3: every severity has a non-colour cue, rendered, at BOTH badge sites', () => {
	const severities = ['blocker', 'warning', 'info'] as const;

	// (a) Three distinct icon components — the cue is per-severity, not one shared glyph.
	// lucide-react builds its icons with React.forwardRef, so a component is a FUNCTION for
	// plain function components and an OBJECT for forwardRef ones. Both are valid element
	// types, so accept either; the load-bearing assertion is the distinctness below.
	const icons = severities.map((s) => SEVERITY_TREATMENT[s].Icon);
	for (const [i, Icon] of icons.entries()) {
		const kind = typeof Icon;
		assert.ok(
			kind === 'function' || (kind === 'object' && Icon !== null),
			`${severities[i]} has no icon component; colour would be its only cue.`,
		);
	}
	assert.equal(
		new Set(icons).size,
		3,
		'two severities share one icon component, so they are not distinguishable without colour.',
	);

	// (b) The icon actually renders, per severity, alongside the word. A colour-only
	//     implementation fails here even if the class map still looks right.
	for (const severity of severities) {
		const html = renderToStaticMarkup(createElement(SeverityBadge, { severity }));
		assert.match(
			html,
			/<svg[\s>]/,
			`the ${severity} badge rendered no <svg>: its only signal is colour.`,
		);
		assert.ok(
			html.includes(SEVERITY_TREATMENT[severity].label),
			`the ${severity} badge lost its word cue.`,
		);
		// The icon is decorative: the word already carries the meaning, so a screen reader
		// must not read the glyph name aloud.
		assert.match(html, /aria-hidden="true"/, `the ${severity} icon is not aria-hidden.`);
	}

	// (c) BOTH render sites go through the shared badge, so no site can regress to
	//     colour-only. Priority cards + the findings accordion = 2.
	//
	// A5 C4 ITEM 5, RE-POINTED — NOT DELETED. One of the two sites moved into
	// `AuditFindingsPanel.tsx` with the findings accordion, so the page alone now
	// holds 1. The COUNT is preserved by reading the route's whole surface, and the
	// per-file split is asserted too: a lane that added a third severity surface in
	// either file is still red, and so is one that moved a site without rendering it.
	const badgeSites = auditSurfaceSource.match(/<SeverityBadge\b/g) ?? [];
	assert.equal(
		badgeSites.length,
		2,
		`expected SeverityBadge at exactly 2 render sites across the /audit route, found ${badgeSites.length}. ` +
			'A new severity surface must render the same badge, or it will be colour-only.',
	);
	assert.equal(
		(auditSource.match(/<SeverityBadge\b/g) ?? []).length,
		1,
		`${AUDIT_PATH} no longer renders its own severity badge`,
	);
	assert.equal(
		(auditPanelSource.match(/<SeverityBadge\b/g) ?? []).length,
		1,
		`${AUDIT_PANEL_PATH} no longer renders the findings severity badge`,
	);
	// And the old colour-only inline form is gone from the whole route, not just the
	// page — the extracted file could easily have reintroduced it.
	assert.doesNotMatch(
		auditSurfaceSource,
		/severityClassName|severityLabel/,
		'the old colour-only badge helpers are still referenced.',
	);
});

// ── Row 4 ─────────────────────────────────────────────────────────────────────

test('row 4: the focus contract survives — focus=timetable still resolves to constraints', () => {
	const groups = [
		{ id: 'teacher-assignments', findings: [{}] },
		{ id: 'section-gaps', findings: [{}] },
		{ id: 'rooms-facilities', findings: [{}] },
		{ id: 'constraints', findings: [{}] },
		{ id: 'saved-live-data', findings: [{}] },
	] as const;
	const ids = groups.map((g) => g.id);

	// The legacy alias. `/timetable` links are Lane A2's, so this mapping IS the
	// compatibility half of their contract and must keep resolving.
	assert.equal(
		resolveFocusGroupId('timetable', groups),
		'constraints',
		'focus=timetable no longer resolves to the constraints group; A2-owned /timetable links would open nothing.',
	);

	// A FindingGroup.id is still reachable, by id.
	for (const id of ids) {
		assert.equal(resolveFocusGroupId(id, groups), id, `focus=${id} no longer resolves to its group.`);
	}

	// An unknown focus still falls through to the FIRST GROUP WITH FINDINGS — the
	// behaviour that makes a bare `/audit` open on something actionable. This is the
	// part an extraction is most likely to lose.
	assert.equal(
		resolveFocusGroupId(null, groups),
		'teacher-assignments',
		'a missing focus no longer opens the first actionable group.',
	);
	assert.equal(
		resolveFocusGroupId('nope', groups),
		'teacher-assignments',
		'an unknown focus no longer falls through to the first actionable group.',
	);
	assert.equal(
		resolveFocusGroupId(null, [{ id: 'teacher-assignments', findings: [] }, { id: 'section-gaps', findings: [{}] }]),
		'section-gaps',
		'with no findings in the first group, focus must land on the first group that HAS findings.',
	);
	assert.equal(
		resolveFocusGroupId(null, []),
		'teacher-assignments',
		'with no groups at all, focus must still return a renderable id rather than undefined.',
	);

	// And the real group ids in the page are the ones the resolver is being asked about.
	for (const id of ['teacher-assignments', 'section-gaps', 'rooms-facilities', 'constraints', 'saved-live-data']) {
		assert.ok(
			auditSource.includes(`id: '${id}'`),
			`the real FindingGroup.id ${id} is gone from Audit.tsx but the resolver still names it.`,
		);
	}
});

// ── Row 5 ─────────────────────────────────────────────────────────────────────

/**
 * Single-line literal JSX text — what a reader can see without an expression.
 *
 * STATED LIMITS, because a gate that looks stronger than it is is worse than none. This is a
 * source approximation, not a rendered-DOM check: it cannot see text produced by an
 * expression (`{sourceLabel}`, `{finding.title}`), and it does not parse JSX. It is tight
 * enough to be worth asserting because every piece of COPY this lane changed is a literal
 * JSX text node, and because the looser first attempt matched straight across a `=>` in
 * module code and reported `('cache'); const [dataSource, setDataSource] = useState` as
 * "visible text" — hence the single-line requirement, which no code span can cross.
 * The expression-rendered values are covered separately below, on real production data.
 */
function visibleTextNodes(source: string): string[] {
	return [...source.matchAll(/>([^<>{}]*[A-Za-z][^<>{}]*)</g)]
		.map((m) => m[1])
		.filter((t) => !/[\r\n]/.test(t))
		.map((t) => t.trim())
		.filter(Boolean);
}

/**
 * Exact-token match, so `cache` does not fire on `cached`. `enrollpro` is deliberately NOT
 * in this list: EnrollPro is user-facing by design (AdminWorkspace.tsx:101 explains it as
 * "the DepEd enrollment system"), so naming it in copy is plain, not leakage.
 */
const INTERNAL_IDENTIFIERS = ['atlas-persisted', 'enrollpro-verified', 'cache', 'cached'] as const;
const RAW_ENUM_TOKENS = ['BLOCKED', 'STALE', 'FRESH', 'UNKNOWN'] as const;
/** `repairTarget` routing keys. Behaviour: they are read by the repair-link contract. */
const REPAIR_TARGETS = ['teaching-load', 'map', 'teachers', 'subjects', 'sections'] as const;

test('row 5: no internal identifier and no raw enum reaches the user', () => {
	// A5 C4 ITEM 5: read the ROUTE's whole surface. The findings panel that moved out
	// of the page renders user-facing copy ("What is blocked", the empty states, the
	// group descriptions), and a row that only scanned the page would stop covering
	// exactly the strings the extraction moved — which is the way a pin silently
	// weakens. Every assertion below is unchanged; the surface it reads is the union.
	const visible = visibleTextNodes(auditSurfaceSource);
	const blob = visible.join('  |  ');

	// (a) Literal JSX copy.
	for (const token of RAW_ENUM_TOKENS) {
		assert.ok(
			!new RegExp(`\\b${token}\\b`).test(blob),
			`the raw enum token ${token} is rendered as visible text: ${blob.match(new RegExp(`.{0,50}\\b${token}\\b.{0,50}`))?.[0]}`,
		);
	}
	for (const id of INTERNAL_IDENTIFIERS) {
		assert.ok(
			!new RegExp(`(?<![A-Za-z0-9-])${id}(?![A-Za-z0-9-])`).test(blob),
			`the internal identifier ${id} is rendered as visible text. Visible copy: ${blob}`,
		);
	}
	for (const target of REPAIR_TARGETS) {
		assert.ok(
			!new RegExp(`(?<![A-Za-z0-9-])${target}(?![A-Za-z0-9-])`).test(blob),
			`the repairTarget routing key ${target} is rendered as visible text; it is a routing key, not copy.`,
		);
	}

	// (b) The expression-rendered severity labels, checked on the REAL imported values
	//     rather than on the source text, so this half of the row does not depend on the
	//     approximation in (a).
	for (const [severity, treatment] of Object.entries(SEVERITY_TREATMENT)) {
		for (const token of RAW_ENUM_TOKENS) {
			assert.ok(!treatment.label.includes(token), `the ${severity} label renders the enum ${token}.`);
		}
		for (const id of INTERNAL_IDENTIFIERS) {
			assert.ok(
				!new RegExp(`(?<![A-Za-z0-9-])${id}(?![A-Za-z0-9-])`).test(treatment.label),
				`the ${severity} label renders the internal identifier ${id}.`,
			);
		}
	}

	// (c) The three source-state phrases, which is where the jargon actually lived
	//     ("Live upstream-backed" / "ATLAS saved evidence" / "No saved evidence").
	//
	//     The declaration legitimately CONTAINS the internal enum `cached` — as the operand of
	//     `dataSource === 'cached'`, which is behaviour and must stay. So check the RENDERED
	//     strings only: the quoted literals that are not a comparison operand.
	const sourceLabel = auditSource.match(/const sourceLabel = ([\s\S]*?);/);
	assert.ok(sourceLabel, 'the sourceLabel declaration is gone; the header badge has no state.');
	const compared = [...sourceLabel[1].matchAll(/===\s*'([^']*)'/g)].map((m) => m[1]);
	const rendered = [...sourceLabel[1].matchAll(/'([^']*)'/g)]
		.map((m) => m[1])
		.filter((value) => !compared.includes(value));
	assert.equal(
		rendered.length,
		3,
		`expected the three rendered source-state strings, found ${rendered.length} (${rendered.join(' / ')}).`,
	);
	for (const value of rendered) {
		for (const id of INTERNAL_IDENTIFIERS) {
			assert.ok(
				!new RegExp(`(?<![A-Za-z0-9-])${id}(?![A-Za-z0-9-])`).test(value),
				`sourceLabel still shows the internal identifier ${id}: "${value}".`,
			);
		}
		assert.ok(!/upstream/.test(value), `sourceLabel still says "upstream-backed": "${value}".`);
	}

	// (d) `repairTarget` is BEHAVIOUR: the repair-link contract reads it, so it must not move.
	//     It is also not user-facing, so it must not be interpolated into a text node.
	//
	//     A5 C4 ITEM 5: asserted across the whole route. Three of the four repair links
	//     live in the extracted findings panel, so a page-only scan would have found
	//     one and reported the contract broken.
	assert.ok(
		auditSurfaceSource.includes('repairTarget'),
		'repairTarget is gone; it is read by the repair-link contract and is not this lane\'s to remove.',
	);
	assert.doesNotMatch(
		auditSurfaceSource,
		/>[^<>{}]*\{[^<>{}]*repairTarget[^<>{}]*\}[^<>{}]*</,
		'a repairTarget value is interpolated into a JSX text node, so a routing key is now user-visible.',
	);
	const attributeUses = auditSurfaceSource.match(/data-repair-target=/g) ?? [];
	assert.ok(
		attributeUses.length >= 4,
		`expected the repair links to still carry data-repair-target attributes, found ${attributeUses.length}.`,
	);
	// AND the split is stated, so neither file can drift from the contract alone.
	assert.equal(
		(auditSource.match(/data-repair-target=/g) ?? []).length,
		1,
		`${AUDIT_PATH} no longer carries its own repair link`,
	);
	assert.equal(
		(auditPanelSource.match(/data-repair-target=/g) ?? []).length,
		3,
		`${AUDIT_PANEL_PATH} does not carry the three repair links it moved with`,
	);
});

// ── Row 6 ─────────────────────────────────────────────────────────────────────

test('row 6: the row-1 detector can actually fail', () => {
	// A colour gate that cannot go red is worse than no gate: it would pass forever while
	// the debt came back. Feed it the exact class this sweep removed.
	const fabricated = '<Badge className="rounded-full text-sky-700 bg-sky-50 border-sky-200" />';
	const found = findRawRampClasses(fabricated);
	assert.equal(
		found.length,
		3,
		`the detector missed fabricated raw classes: expected 3, saw ${found.length} (${found.join(', ')})`,
	);
	assert.ok(found.includes('text-sky-700'), 'the detector must still catch text-sky-700.');

	// And it must accept the real replacement, or row 1 would be green for the wrong reason.
	assert.deepEqual(
		findRawRampClasses(SEVERITY_TREATMENT.warning.className),
		[],
		`the detector flags the warning treatment as raw: ${SEVERITY_TREATMENT.warning.className}`,
	);
	// A bare name with no shade is not a ramp class, and neither is a token class. Note
	// `bg-` IS in the prefix list, so a raw `bg-slate-100` is correctly reported above —
	// only the shade-less name and the token forms are expected to come back empty.
	assert.deepEqual(
		findRawRampClasses('text-slate text-foreground text-muted-foreground bg-muted'),
		[],
		'false positive: a shade-less name or a token class was reported as a raw ramp class.',
	);
	assert.deepEqual(
		findRawRampClasses('bg-slate-100'),
		['bg-slate-100'],
		'bg- is inside this detector\'s scope, so a raw neutral SURFACE must be reported.',
	);
	// A ramp family outside the list is not claimed.
	assert.deepEqual(findRawRampClasses('text-brand-700'), [], 'unknown families are not this detector\'s business.');
});
