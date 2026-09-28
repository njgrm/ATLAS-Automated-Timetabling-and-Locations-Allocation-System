/**
 * A5 C3 slice B (2026-09-29) — the picker-sweep guard.
 *
 * WHAT THIS IS FOR. `AGENTS.md` §8 "One look per control" (operator, 2026-09-29): *"Every picker
 * (Section, Teacher, Subject, Room, Term, Year) is the same `@/ui` primitive… No page-local
 * `className` overrides that change a primitive's look. Before adding a control, find the
 * existing one and reuse it; if it truly needs a new variant, add the variant to `@/ui` so every
 * page gets it."* and §11: *"A test no gate runs is not evidence."*
 *
 * R1 J5 recorded that this repository has **no vitest** — there is no `vitest` in
 * `atlas-client/package.json` — so the harness is `tsx --test`, and this file is wired to
 * `test:a5-p3-picker-guard` in the same commit.
 *
 * IT IS A GUARD, NOT A STYLE BAN. Everything is scoped to an ALLOWLIST of the files this sweep
 * touched. A repo-wide ban would fail on `/timetable`'s entity picker (A3's, deliberately left
 * alone), on every other `Select` in a codebase full of legitimate non-filter selects, and on the
 * A3-owned map components that are out of scope. An allowlist means the guard is a promise about
 * a known set of surfaces, which is a promise a reviewer can check.
 *
 * THE THREE FAILURES IT MUST PRODUCE, each for the reason the operator actually cares about:
 *
 *  1. A swept filter built from `@/ui/select` instead of the shared picker — the defect this whole
 *     cycle exists to remove, reintroduced by one import.
	 *  2. A look-changing override in a swept file — `triggerClassName` reaching past the shared
	 *     variant, or a page restating `rounded-xl` / `uppercase tracking-tight` chrome on the
	 *     line that builds a picker. **Scope, stated honestly:** this rule is
	 *     allowlist-scoped and proximity-scoped, so it sees a picker on the line it is
	 *     checking. It does NOT see hand-rolled markup — a raw `<button role="combobox">` in
	 *     a swept file was green until the reviewer proved it by running the guard, and the
	 *     fix is the second positive control `A5-C3-P3-1c`, not a wider ban. Neither hole is
	 *     closed by a token ban here, deliberately: a repo-wide ban dies on the first
	 *     legitimate `Select`, and this codebase is full of them on surfaces nobody swept.
 *  3. A page-local redefinition of the shared variant — a swept file re-declaring the height, a
 *     width or the chrome string that `@/ui/picker-trigger` owns. This is the one that already
 *     happened once (`CONTROL_CHROME` on the Teaching Load row) and it is why the string is
 *     named here.
 *
 * WHAT IT DELIBERATELY DOES NOT DO — recorded, because a guard that overreaches gets deleted:
 * it does not police option LABELS (each page keeps its own vocabulary, R2), it does not require
 * a search box, it does not touch `@/ui` itself (that is where the variant belongs), and it does
 * not assert a class LIST as evidence of a rendered width. That last one is the slice-A lesson:
 * `min-w-[160px]` sat in a `cn()` ahead of the caller's `w-*`, every trigger rendered at 160px
 * regardless of the variant, and the width-class assertions were all green. The RENDERED
 * contract is pinned in `a5-c3-picker-contract.test.tsx`; this file pins the SOURCE contract.
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { test } from 'node:test';

const clientSrc = resolve(import.meta.dirname, '../../..');

/**
 * The swept surfaces. Every entry is a file this cycle converted, and every entry is a file a
 * reviewer can open and check. Adding a page to the sweep means adding it here, which is
 * deliberate: the guard's reach is a decision, not an accident.
 */
const SWEPT_FILES = [
	'src/components/sections/SectionsFilterToolbar.tsx',
	'src/components/faculty/FacultyFilterRow.tsx',
	'src/pages/Faculty.tsx',
	'src/components/faculty-assignments/TeachingLoadFilterBar.tsx',
	'src/components/faculty-assignments/SectionGridMode.tsx',
	'src/components/faculty-assignments/TeachingLoadHistoryView.tsx',
] as const;

/** Read a swept file, failing loudly if the allowlist names something that moved. */
function swept(relative: string): string {
	return readFileSync(resolve(clientSrc, relative), 'utf8');
}

/** Strip comments so a rule cannot be satisfied — or broken — by a sentence in a comment. */
function code(relative: string): string {
	return swept(relative)
		.replace(/\/\*[\s\S]*?\*\//g, ' ')
		.replace(/(^|[^:])\/\/.*$/gm, '$1 ');
}

const files = SWEPT_FILES.map((f) => ({ f, src: code(f) }));

test('A5-C3-P3-1: every swept filter is built from the one shared picker, never from @/ui/select', () => {
	const offenders = files
		.filter(({ src }) => /from ['"]@\/ui\/select['"]/.test(src) || /<SelectTrigger[\s>]/.test(src))
		.map(({ f }) => f);
	assert.deepEqual(
		offenders,
		[],
		'these swept files build a filter from Radix @/ui/select instead of @/ui/filter-picker — ' +
			'that is the one-look defect this cycle exists to remove',
	);
});

test('A5-C3-P3-1b: the files that build a filter actually USE FilterPicker', () => {
	/* The positive control. A guard that only asserts absence is satisfied by a file that
	 * builds nothing at all — the F6 lesson from `a3-c4-subjects-copy`. Each swept file is
	 * required to reach the shared picker, so deleting the conversion fails here. */
	const expected = SWEPT_FILES.filter((f) => f !== 'src/pages/Faculty.tsx');
	const missing = expected.filter((f) => !code(f).includes('@/ui/filter-picker')).map((f) => f);
	assert.deepEqual(
		missing,
		[],
		'these swept files no longer import the shared picker — a converted control must be built from it',
	);
	/* `Faculty.tsx` is the caller, not a builder: it delegates the row to `FacultyFilterRow`. */
	assert.ok(
		code('src/pages/Faculty.tsx').includes('FacultyFilterRow'),
		'Faculty.tsx must render the extracted FacultyFilterRow, not build filters itself',
	);
});

test('A5-C3-P3-2: no swept file carries a look-changing override on a PICKER', () => {
	/* Each token is a page-local look on a shared surface, and each is one this sweep removed.
	 * `CONTROL_CHROME` is named because the Teaching Load row HAD one and it is the reason this
	 * guard exists; `w-45` because the grid-mode filter had it; `min-h-11` because the history
	 * picker had it.
	 *
	 * PROXIMITY, AND WHY. A first pass banned these tokens anywhere in a swept file and was
	 * immediately wrong: it flagged two Switch `<Label>`s, a `<h4>`, three status badges, a
	 * Button and the history SEARCH input — none of which is a picker. A guard that flags a
	 * search box's height gets deleted by the next person who reads it, and a deleted guard is
	 * worse than a narrow one. So the rule is scoped to the line that BUILDS a picker, which is
	 * the thing §8 is about: a look override applied to a filter control.
	 */
	const FORBIDDEN = [
		'uppercase',
		'tracking-tight',
		'w-45',
		'min-h-11',
		'CONTROL_CHROME',
		'rounded-xl',
	] as const;
	const PICKER_LINE = /FilterPicker|SelectTrigger|triggerClassName|pickerTriggerClass|searchable-select/;
	const offenders: string[] = [];
	for (const { f, src } of files) {
		src.split('\n').forEach((line, index) => {
			if (!PICKER_LINE.test(line)) return;
			for (const token of FORBIDDEN) {
				if (line.includes(token)) offenders.push(`${f}:${index + 1} ${token}`);
			}
		});
		/* A look override smuggled through as a class string on the shared primitive — with
		 * EITHER a string or a template, because the first version of this row only matched
		 * the brace form and the discrimination run proved a `triggerClassName="…"` sails
		 * straight through it. The primitive itself is in `@/ui` and is allowlisted out. */
		if (/triggerClassName\s*=/.test(src)) {
			offenders.push(`${f}: triggerClassName=… reaches past the shared variant`);
		}
	}
	assert.deepEqual(
		offenders,
		[],
		'page-local look overrides found on a swept PICKER — AGENTS.md §8 says the variant belongs in @/ui, not on a page',
	);
});

test('A5-C3-P3-2b: the two Teaching Load SWITCH labels are a known, recorded exception, not an oversight', () => {
	/* R1 B4's target was the pickers' chrome and their option rows. A Switch label is a
	 * different control and restyling it was not part of this sweep. The exception is pinned
	 * HERE, with its count, rather than left as a quiet gap: if a future sweep does restyle
	 * those two labels this row goes red and the exception is removed deliberately. */
	const bar = code('src/components/faculty-assignments/TeachingLoadFilterBar.tsx');
	const switchLabels = bar.split('\n').filter((l) => l.includes('uppercase tracking-tight')).length;
	assert.equal(
		switchLabels,
		2,
		`expected exactly 2 uppercased Switch labels in the Teaching Load row, found ${switchLabels} — ` +
			'if this slice restyled them, remove this exception row with the restyle',
	);
});

test('A5-C3-P3-3: a swept file does not redefine the shared picker variant', () => {
	/* The variant is owned by `@/ui/picker-trigger.ts`. A page that re-declares the height, a
	 * width or the chrome string is the defect that produced `CONTROL_CHROME` in the first
	 * place. `@/ui` itself is the owner and is not in the allowlist. */
	const REDEFINITION = [
		'PICKER_CONTROL_HEIGHT_CLASS',
		'PICKER_TRIGGER_WIDTH_CLASS',
		'SEARCHABLE_OPTION_THRESHOLD',
		'pickerTriggerClass(',
	] as const;
	const offenders: string[] = [];
	for (const { f, src } of files) {
		for (const token of REDEFINITION) {
			if (src.includes(token)) offenders.push(`${f}: redefines ${token}`);
		}
	}
	assert.deepEqual(offenders, [], 'a swept file redefines the shared picker variant instead of using it');
});

test('A5-C3-P3-1c: a swept file builds no trigger BY HAND — second positive control, and it closes two proved holes', () => {
	/* Why this row exists. The reviewer ran the guard two ways and it stayed GREEN 6/6 both
	 * times, which is exactly how a guard that overclaims becomes worse than none:
	 *
	 *   HOLE 1 — `PICKER_LINE` was single-line, so a look token on a CONTINUATION line of a
	 *   `<FilterPicker …>` (which is how every prop in this codebase is written) sailed
	 *   straight through. Probed with `contentClassName="h-10 uppercase"` on the next line.
	 *   HOLE 2 — the rule's doc claimed it reached "hand-rolled markup", and it did not. A
	 *   hand-written `<button className="h-10 w-40 uppercase tracking-tight rounded-xl
	 *   border-border/60">` in a swept file was also green, because the rule only looked at
	 *   lines that mention a picker.
	 *
	 * The fix is NOT a token ban, and deliberately so: the allowlist-plus-proximity design is
	 * right, because a repo-wide ban dies on the first legitimate `Select` — and this
	 * codebase is full of them, on surfaces nobody swept. What closes both holes is asking a
	 * POSITIVE question of every swept file, in the same shape as `P3-1b`: build the trigger
	 * through the shared picker, and nothing else. A positive control cannot be satisfied by
	 * not being there, so it does not need a heuristic to find the bad case.
	 *
	 * STATED BOUND, because QA round 2 proved the previous claim false. `P3-1c` catches a
	 * hand-rolled trigger in either spelling of the element — `<button …>` and `<Button …>` —
	 * but only while it carries `role="combobox"`. A combobox-shaped control written with
	 * some other role would pass, and so would a look override on a sibling line that belongs
	 * to no picker element and is not a trigger. That is the deliberate cost of not banning
	 * tokens repo-wide, and it is bounded here rather than implied.
	 */
	const offenders: string[] = [];
	for (const { f, src } of files) {
		/* HOLE 2: a trigger-shaped element built by hand, anywhere in the file, on any line.
		 * `FilterPicker` is the shared primitive; a `<button role="combobox">` or a
		 * `<Button role="combobox">` beside it is a page re-deciding what a filter looks
		 * like, which is the defect. **Both spellings matter**: this codebase writes the
		 * capitalised form (`searchable-select.tsx` itself, and all four swept toolbars
		 * import it), and a case-sensitive `<button` probe scored that hole closed when it
		 * was not — QA round 2's third probe, `<Button role="combobox">`, ran green. */
		if (/<[Bb]utton[^>]*role="combobox"/.test(src) || /<select[\s>]/i.test(src)) {
			offenders.push(`${f}: a trigger built by hand instead of through @/ui/filter-picker`);
		}
		/* HOLE 1: the look tokens, checked against the WHOLE element rather than one line.
		 * A `<FilterPicker` that runs to a closing `/>` is one element however it is
		 * formatted, so the unit of the check is the element, not the line. */
		for (const match of src.matchAll(/<(FilterPicker|SelectTrigger|SearchableSelect)\b[\s\S]*?\/>/g)) {
			for (const token of ['uppercase', 'tracking-tight', 'w-45', 'min-h-11', 'rounded-xl', 'CONTROL_CHROME']) {
				if (match[0].includes(token)) {
					offenders.push(`${f}: "${token}" on a <${match[1]}> element (continuation lines included)`);
				}
			}
			if (/triggerClassName\s*=/.test(match[0])) {
				offenders.push(`${f}: triggerClassName=… on a <${match[1]}> element`);
			}
		}
	}
	assert.deepEqual(
		offenders,
		[],
		'a swept file builds a filter trigger by hand, or restates the shared variant on a picker element — ' +
			'either one is a page re-deciding what a filter looks like, which is what @/ui/picker-trigger is for',
	);
});

test('A5-C3-P3-4: the shared variant is still owned by @/ui, and still has no className escape hatch', () => {
	/* The other half of the contract: the guard is only meaningful if `@/ui` is still the single
	 * owner. If a page could pass a className, rule 2 above would be unenforceable by
	 * construction, and this row says so rather than letting the guard imply more than it can. */
	const picker = readFileSync(resolve(clientSrc, 'src/ui/filter-picker.tsx'), 'utf8');
	assert.doesNotMatch(
		picker.replace(/\/\*[\s\S]*?\*\//g, ' '),
		/\bclassName\?:\s*string/,
		'FilterPicker exposes a className prop again, so a page can restate the chrome',
	);
	const trigger = readFileSync(resolve(clientSrc, 'src/ui/picker-trigger.ts'), 'utf8');
	assert.ok(
		trigger.includes('PICKER_CONTROL_HEIGHT_CLASS') && trigger.includes('PICKER_TRIGGER_WIDTH_CLASS'),
		'@/ui/picker-trigger no longer owns the height and width tokens',
	);
});
