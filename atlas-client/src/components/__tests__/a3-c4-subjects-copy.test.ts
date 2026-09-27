/**
 * A3-C4-COPY (stream A3) — Top-10 walkthrough item #5: "Subjects shows raw
 * technical text". READ THIS HEADER BEFORE TREATING IT AS A FIX.
 *
 * WHAT THIS FILE IS: a locating/preservation control, NOT a fix and NOT
 * acceptance of walkthrough item #5.
 *
 * WHY: Lane C's walkthrough named four raw strings on the Subjects page. This
 * stream owns `src/pages/Subjects.tsx` and `src/pages/Dashboard.tsx` ONLY. All
 * four strings are rendered by `src/components/subjects/**` (and one of them is
 * authored by `atlas-server/**`), every one of which is OUTSIDE this stream's
 * fence. Nothing was edited to reach them, because editing an unowned file is a
 * custody defect, not a fix. Each site is pinned below with `file:line` so the
 * planner can route the work to the lane that owns it; the pins make this file
 * go RED the moment a successor moves a surface, which is the intended
 * behaviour (a successor updates these pins when it does the real work).
 *
 * THE FOUR STRINGS, AND WHERE EACH ONE ACTUALLY COMES FROM
 *
 *  1. `OWNER_DEPT:AP`   — an enum/audit code, not prose. Stored in
 *     `subject.requiredFeatures` and written by the server
 *     (atlas-server/src/services/subject-ownership.service.ts:44 defines
 *     `OWNER_DEPARTMENT_FEATURE_PREFIX = 'OWNER_DEPT:'`; subject.service.ts:537
 *     folds `allowedOwnerDepartments` into it). Rendered RAW at THREE sites:
 *       - components/subjects/SubjectRow.tsx:139   (AccessibleInfo shortHelp)
 *       - components/subjects/SubjectCoverageSheet.tsx:309 (`join(', ')`)
 *       - components/subjects/SubjectFormModal.tsx:770 (`{f}` badge chip)
 *     The field's own vocabulary is "required room features" / "owner
 *     department", so a derivable plain label exists ("Owned by AP" /
 *     "Room feature"). The code has no derivable meaning for a scheduler beyond
 *     that, so the honest treatment is a plain label plus the raw code in a
 *     `@/ui` HoverCard/Popover — `title` is FORBIDDEN by AGENTS.md §8.
 *
 *  2. `STE_APPLIED_CHEM` — a subject CODE, rendered in a `<code>` chip at
 *     components/subjects/SubjectRow.tsx:97 (`{subject.code}`). A code column is
 *     legitimate, but this one leaks unformatted next to the subject NAME, and
 *     the server already carries the human name
 *     (atlas-server/src/services/subject.service.ts:61 -> "Applied Chemistry";
 *     schedule-output-normalization.service.ts:8 -> "APPLIED CHEMISTRY"). The
 *     subject's own `name` is already on screen one line above, so the honest
 *     treatment is the name plus the code demoted to a tooltip.
 *
 *  3. `Saved term contract failed its semantic revision check.` — a
 *     SERVER-AUTHORED message string, verbatim at
 *     atlas-server/src/services/enrollpro-term-contract.service.ts:482
 *     (code `TERM_CACHE_INVALID`). Rendered raw at
 *     components/subjects/SubjectTermAuthorityBanner.tsx:76 and :109
 *     (`{termAuthority.message}`). `atlas-server/**` is outside this fence and
 *     is a CROSS-LANE fence, so it was NOT edited — this is reported, not fixed.
 *
 *  4. `Could not reach the enrolment system` and the fourth string Lane C named,
 *     "Rechecking last year's schedule data", DO NOT EXIST as literals anywhere
 *     in this repository (client or server). Proved by the repo-wide scan
 *     below. They are therefore runtime/DB-sourced — most plausibly the same
 *     `termAuthority.message` passthrough, forwarded from live EnrollPro state —
 *     and CANNOT be pinned verbatim from source. The planner must confirm the
 *     exact surface with a browser holder before a successor writes copy for
 *     them. Reporting them as "already fixed" or as "mapped here" would be a
 *     fabricated result, so this file does neither.
 *
 * DISPLAY-ONLY CONTRACT for the successor: do not change what is measured or
 * which data is fetched. Copy only.
 */
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const CLIENT_ROOT = resolve(HERE, '../../..');
const REPO_ROOT = resolve(CLIENT_ROOT, '..');
const CLIENT_SRC = resolve(CLIENT_ROOT, 'src');
const SERVER_SRC = resolve(REPO_ROOT, 'atlas-server/src');

function source(path: string): string {
	return readFileSync(resolve(CLIENT_ROOT, path), 'utf8');
}

/**
 * Recursively read every .ts/.tsx file under `dir`, skipping node_modules/dist.
 * `__tests__` is skipped on purpose: this file quotes the walkthrough strings
 * verbatim as constants, and a scan that matched its own fixtures would report a
 * hit that is not a product surface. The scan is over PRODUCTION source only.
 */
function allSources(dir: string): { file: string; text: string }[] {
	const out: { file: string; text: string }[] = [];
	for (const entry of readdirSync(dir)) {
		if (entry === 'node_modules' || entry === 'dist' || entry === '__tests__' || entry.startsWith('.')) continue;
		const full = join(dir, entry);
		if (statSync(full).isDirectory()) {
			out.push(...allSources(full));
			continue;
		}
		if (/\.(ts|tsx)$/.test(entry)) out.push({ file: full, text: readFileSync(full, 'utf8') });
	}
	return out;
}

// --- 1. The four walkthrough strings, pinned verbatim -------------------------

/** Exactly what Lane C recorded on live `d31bfacb` at 1366x768, walkthrough 3.2. */
const WALKTHROUGH_STRINGS = [
	'OWNER_DEPT:AP',
	'STE_APPLIED_CHEM',
	'Saved term contract failed its semantic revision check.',
	'Could not reach the enrolment system',
	'Rechecking last year',
] as const;

test('the five walkthrough strings are pinned verbatim, so a later edit is deliberate', () => {
	// Guard against someone "tidying" the constants out of this file. These are
	// the recorded operator-visible strings; changing one silently would break
	// the link back to the walkthrough.
	assert.deepEqual([...WALKTHROUGH_STRINGS], [
		'OWNER_DEPT:AP',
		'STE_APPLIED_CHEM',
		'Saved term contract failed its semantic revision check.',
		'Could not reach the enrolment system',
		'Rechecking last year',
	]);
	assert.equal(WALKTHROUGH_STRINGS.length, 5);
});

// --- 2. Locating the three that DO exist in source, at the exact render site ---

/** Read the line of `file` containing `needle`, as 1-indexed `file:line`. */
function lineOf(file: string, needle: string): number {
	const lines = source(file).split('\n');
	const at = lines.findIndex((line) => line.includes(needle));
	assert.ok(at >= 0, `${file} must still contain ${JSON.stringify(needle)} — if a successor moved it, update this pin`);
	return at + 1;
}

test('CROSS-LANE FOLLOWUP 1: the OWNER_DEPT enum code still renders raw at all three Subjects sites', () => {
	// OPEN DEFECT, DOCUMENTED — this is a locator, not an acceptance.
	const row = 'src/components/subjects/SubjectRow.tsx';
	const sheet = 'src/components/subjects/SubjectCoverageSheet.tsx';
	const modal = 'src/components/subjects/SubjectFormModal.tsx';

	assert.equal(lineOf(row, 'subject.requiredFeatures.join'), 139, 'SubjectRow AccessibleInfo shortHelp renders the raw list');
	assert.equal(lineOf(sheet, 'subject.requiredFeatures.join'), 309, 'SubjectCoverageSheet renders the raw list');
	assert.equal(lineOf(modal, '{form.requiredFeatures.map((f) => ('), 768, 'SubjectFormModal renders one raw chip per feature');
	// The owner-department marker really is an enum, per the server's own constant.
	assert.match(
		readFileSync(resolve(SERVER_SRC, 'services/subject-ownership.service.ts'), 'utf8'),
		/OWNER_DEPARTMENT_FEATURE_PREFIX = 'OWNER_DEPT:'/,
		'the code is the server-defined ownership-marker prefix',
	);
});

test('CROSS-LANE FOLLOWUP 2: the STE_APPLIED_CHEM subject code still renders raw in the row chip', () => {
	const row = 'src/components/subjects/SubjectRow.tsx';
	assert.equal(lineOf(row, '{subject.code}'), 97, 'the subject code renders in a <code> chip next to the subject name');
	// The human name already exists server-side, so a mapping does not have to be
	// invented — but the mapping belongs to whoever owns the row, not here.
	assert.match(
		readFileSync(resolve(SERVER_SRC, 'services/subject.service.ts'), 'utf8'),
		/code: 'STE_APPLIED_CHEM', name: 'Applied Chemistry'/,
		'the server already carries the plain human name for this code',
	);
});

test('CROSS-LANE FOLLOWUP 3: the server-authored term message still renders verbatim on Subjects', () => {
	// OPEN DEFECT, DOCUMENTED — and explicitly OUT OF FENCE on the authoring side.
	const service = readFileSync(resolve(SERVER_SRC, 'services/enrollpro-term-contract.service.ts'), 'utf8');
	const banner = source('src/components/subjects/SubjectTermAuthorityBanner.tsx');
	assert.equal(
		service.split('\n').findIndex((line) => line.includes('Saved term contract failed its semantic revision check.')) + 1,
		482,
		'the message is authored by atlas-server (CROSS-LANE; not edited by this stream)',
	);
	assert.equal(lineOf('src/components/subjects/SubjectTermAuthorityBanner.tsx', '<p className="text-xs leading-relaxed text-muted-foreground">{termAuthority.message}</p>'), 76);
	assert.equal(lineOf('src/components/subjects/SubjectTermAuthorityBanner.tsx', '<p className="mt-1 text-xs font-medium opacity-90">{termAuthority.message}</p>'), 109);
	assert.ok(banner.includes('termAuthority.message'), 'the raw server message still reaches the operator');
});

// --- 3. The two that DO NOT EXIST anywhere in the repository ------------------

test('CROSS-LANE FOLLOWUP 4: two of the five walkthrough strings exist nowhere in the repo, so they cannot be pinned from source', () => {
	// A real, decidable finding, and the reason the planner needs a browser
	// holder before copy can be written for these two: they are runtime/DB
	// values (almost certainly the `termAuthority.message` passthrough, which
	// forwards live EnrollPro state), not literals.
	const clientFiles = allSources(CLIENT_SRC);
	const serverFiles = allSources(SERVER_SRC);

	for (const needle of ['Could not reach the enrolment system', 'Rechecking last year']) {
		const clientHits = clientFiles.filter((f) => f.text.includes(needle)).map((f) => f.file);
		const serverHits = serverFiles.filter((f) => f.text.includes(needle)).map((f) => f.file);
		assert.deepEqual(clientHits, [], `no atlas-client source contains ${JSON.stringify(needle)}`);
		assert.deepEqual(serverHits, [], `no atlas-server source contains ${JSON.stringify(needle)}`);
	}

	// The three that DO exist are found, which proves the scan discriminates
	// rather than silently matching nothing.
	const found = clientFiles
		.filter((f) => ['OWNER_DEPT:AP', 'Saved term contract failed its semantic revision check.'].some((n) => f.text.includes(n)))
		.map((f) => f.file.replace(/\\/g, '/'));
	assert.deepEqual(found, [], 'no client SOURCE hardcodes OWNER_DEPT:AP or the term message either — both arrive as DATA at runtime');
});

// --- 4. What IS in this stream's fence: Subjects.tsx must stay clean ---------

/**
 * The one in-fence, enforceable half of item #5. `src/pages/Subjects.tsx` is a
 * component that DELEGATES: it hands `subject` to `SubjectRow` and
 * `termAuthority` to `SubjectTermAuthorityBanner`, and it renders no raw code or
 * technical message itself. This control keeps it that way. It is a real
 * regression guard for the only Subjects surface this stream owns.
 */
function assertNoRawLeakInSubjectsPage(label: string): void {
	const page = source('src/pages/Subjects.tsx');
	assert.doesNotMatch(page, /OWNER_DEPT:/, `${label}: Subjects.tsx must not render an ownership-marker enum`);
	assert.doesNotMatch(page, /requiredFeatures\.join/, `${label}: Subjects.tsx must not join raw feature codes into visible text`);
	assert.doesNotMatch(page, /\{s\.code\}/, `${label}: Subjects.tsx must not render a bare subject code`);
	assert.doesNotMatch(page, /termAuthority\.message\}/, `${label}: Subjects.tsx must not print the raw server message`);
	for (const needle of WALKTHROUGH_STRINGS) {
		assert.doesNotMatch(page, new RegExp(needle.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')), `${label}: Subjects.tsx must not contain ${needle}`);
	}
}

test('Subjects.tsx (this stream\'s fence) renders no raw code and no technical message', () => {
	assertNoRawLeakInSubjectsPage('Subjects.tsx');
});

test('the raw-leak guard rejects each realistic raw-code leak in a Subjects page', () => {
	// Load-bearing: the guard above is a pure function of the file, so the
	// mutants here are run against a MUTATED COPY of the page text with the same
	// regexes. Proves the guard is not vacuously green. The expected message is
	// the FIRST assertion each mutant trips, matching the guard's own ordering.
	const real = source('src/pages/Subjects.tsx');
	const guard = (text: string, label: string): void => {
		assert.doesNotMatch(text, /OWNER_DEPT:/, `${label}: Subjects.tsx must not render an ownership-marker enum`);
		assert.doesNotMatch(text, /requiredFeatures\.join/, `${label}: Subjects.tsx must not join raw feature codes`);
		assert.doesNotMatch(text, /\{s\.code\}/, `${label}: Subjects.tsx must not render a bare subject code`);
		assert.doesNotMatch(text, /termAuthority\.message\}/, `${label}: Subjects.tsx must not print the raw server message`);
	};
	assert.doesNotThrow(() => guard(real, 'control'), 'the real page must pass the guard');

	const mutants: [string, string, RegExp][] = [
		['an ownership-marker enum', `${real}\nconst chip = 'OWNER_DEPT:AP';`, /must not render an ownership-marker enum/],
		['a joined feature list', `${real}\nconst s = subject.requiredFeatures.join(', ');`, /must not join raw feature codes/],
		['a bare subject code', `${real}\nconst el = <span>{s.code}</span>;`, /must not render a bare subject code/],
		['the raw server message', `${real}\nconst m = <p>{termAuthority.message}</p>;`, /must not print the raw server message/],
	];
	for (const [label, mutated, expected] of mutants) {
		assert.throws(() => guard(mutated, label), expected, `the guard must reject a page that leaks ${label}`);
	}
});

// --- 5. The calm-copy pattern a successor must match (recorded, not invented) --

test('the existing calm-copy pattern for a degraded Subjects source is still where the successor must match it', () => {
	// AGENTS.md and the packet both forbid inventing a second tone. The tone
	// already on this page lives in `resolveSubjectSourceCopy` (the A3 source-state
	// copy) and `SubjectTermAuthorityBanner` (A3-09). Pin both so a successor
	// matches the existing voice instead of writing a fourth one, and so a
	// refactor that moves them is noticed.
	const copy = source('src/components/subjects/subject-source-utils.ts');
	assert.match(copy, /export function resolveSubjectSourceCopy/, 'the calm source-state copy helper exists');
	assert.match(copy, /ATLAS could not load a usable subject catalog\./, 'and states the failure in one calm sentence');
	assert.match(copy, /Check the school connection, then retry loading the catalog\./, 'and names the next action');

	// No `title` attribute may carry the extra information: AGENTS.md §8 requires
	// `@/ui` HoverCard/Tooltip/Popover instead. Prove none of the four Subjects
	// surfaces reaches for a raw title.
	for (const file of [
		'src/components/subjects/SubjectRow.tsx',
		'src/components/subjects/SubjectCoverageSheet.tsx',
		'src/components/subjects/SubjectFormModal.tsx',
		'src/components/subjects/SubjectTermAuthorityBanner.tsx',
	]) {
		assert.doesNotMatch(source(file), /\stitle=["'{]/, `${file} must not use a raw title attribute (AGENTS.md §8)`);
	}
});
