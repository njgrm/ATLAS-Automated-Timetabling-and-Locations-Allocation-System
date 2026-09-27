/**
 * A3-C4-SUBJECTS-COPY (stream A3) — Top-10 walkthrough item #5, "Subjects shows
 * raw technical text", the four strings Lane C recorded live on 2026-09-28.
 *
 * THIS IS THE FIX'S ACCEPTANCE SUITE, NOT A LOCATOR. The prior A3 stream
 * delivered 0 of the 4 items because it treated `components/subjects/**` as
 * outside its fence; the planner ruled that fence wrong, so this stream owns
 * those files and this suite decides whether the operator-facing copy is plain.
 *
 * THE FOUR ITEMS AND HOW EACH IS DECIDED HERE
 *
 *  1. `OWNER_DEPT:AP` — an ownership marker, not a room feature. The server
 *     folds it into `requiredFeatures` (atlas-server/.../subject-ownership
 *     .service.ts:44) and the client rendered the whole mixed list as
 *     "special room features", so a scheduler saw a raw enum labelled as a room
 *     requirement. The human phrase is NOT invented: `AP` is expanded by
 *     `@/lib/deped-glossary` `DEPARTMENT_LABELS`, the repo's own canonical
 *     glossary, whose stated purpose is that raw internal codes never ship to
 *     scheduler officers, and whose `AP: 'Araling Panlipunan'` matches the
 *     server's own `DEPARTMENT_NORMALIZATION` (`'SOCIAL STUDIES' -> 'AP'`,
 *     `'ARALING PANLIPUNAN' -> 'AP'`). The raw code survives in an `@/ui`
 *     affordance. AGENTS.md §8 forbids a bare `title=`.
 *
 *  2. `STE_APPLIED_CHEM` — the subject code chip. The human name already exists
 *     server-side and `subject.name` is already on screen one line above, so the
 *     chip is demoted to a subordinate, focusable, plainly-described code rather
 *     than duplicating the name. No client-side code->name table is invented.
 *
 *  3. `Saved term contract failed its semantic revision check.` — SERVER-AUTHORED
 *     (atlas-server/.../enrollpro-term-contract.service.ts:482, code
 *     `TERM_CACHE_INVALID`) and rendered verbatim by the client banner. The
 *     server file is NOT edited (out of fence). The client instead maps the
 *     `code` it already receives to one calm operator sentence, in the tone of
 *     the existing `resolveSubjectSourceCopy`, keeping the raw code and raw
 *     message in a labelled diagnostic affordance.
 *
 *  4. `Could not reach the enrolment system` / `Rechecking last year's schedule
 *     data` — confirmed absent from all production source (control
 *     `A3-C4-4b`), so they are runtime-sourced. Their literal text CANNOT be
 *     fixed from source and NO test here asserts a guess at it. What IS
 *     fixable and IS delivered: the pass-through that renders whatever the
 *     runtime supplies now falls back to calm wording instead of rendering an
 *     empty element, and the raw text is retained in a labelled diagnostic.
 *     The literal text stays owed to a browser holder.
 *
 * F6 CORRECTION (carried from QA on the prior stream's suite): that suite
 * claimed a repo-wide scan "proves the scan discriminates" while asserting
 * `deepEqual(found, [], ...)` — a scan broken to return `[]` for everything
 * would have PASSED. `A3-C4-4b` below inverts it: it asserts the same scanner
 * FINDS a literal that is genuinely present (positive control) and does NOT
 * find the two genuinely absent ones. Discrimination is proved by the positive
 * control, not asserted about an empty list.
 *
 * Display-only contract: no control here changes what is measured or fetched.
 */
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { after, test } from 'node:test';
import { act } from 'react';
import type { Root } from 'react-dom/client';
import { JSDOM } from 'jsdom';

const dom = new JSDOM('<!doctype html><html><body><div id="root"></div></body></html>', { url: 'http://localhost/subjects' });
Object.assign(globalThis, {
	window: dom.window,
	document: dom.window.document,
	HTMLElement: dom.window.HTMLElement,
	Element: dom.window.Element,
	Node: dom.window.Node,
	Event: dom.window.Event,
	CustomEvent: dom.window.CustomEvent,
	FocusEvent: dom.window.FocusEvent,
	KeyboardEvent: dom.window.KeyboardEvent,
	MouseEvent: dom.window.MouseEvent,
	PointerEvent: (dom.window as unknown as { PointerEvent?: unknown }).PointerEvent ?? dom.window.MouseEvent,
	NodeFilter: dom.window.NodeFilter,
	DocumentFragment: dom.window.DocumentFragment,
	ShadowRoot: dom.window.ShadowRoot,
	SVGElement: dom.window.SVGElement,
	HTMLInputElement: dom.window.HTMLInputElement,
	HTMLTextAreaElement: dom.window.HTMLTextAreaElement,
	HTMLButtonElement: dom.window.HTMLButtonElement,
	HTMLSelectElement: dom.window.HTMLSelectElement,
	HTMLLabelElement: dom.window.HTMLLabelElement,
	HTMLFormElement: dom.window.HTMLFormElement,
	HTMLAnchorElement: dom.window.HTMLAnchorElement,
	HTMLOListElement: dom.window.HTMLOListElement,
	DOMParser: dom.window.DOMParser,
	NodeList: dom.window.NodeList,
	AbortController: dom.window.AbortController,
	MutationObserver: dom.window.MutationObserver,
	getComputedStyle: dom.window.getComputedStyle.bind(dom.window),
	requestAnimationFrame: (callback: FrameRequestCallback) => setTimeout(() => callback(Date.now()), 0),
	cancelAnimationFrame: (id: number) => clearTimeout(id),
	ResizeObserver: class { observe() {} unobserve() {} disconnect() {} },
	DOMRect: dom.window.DOMRect,
	IS_REACT_ACT_ENVIRONMENT: true,
});
Object.defineProperty(globalThis, 'navigator', { value: dom.window.navigator, configurable: true });
(dom.window as unknown as { innerWidth: number }).innerWidth = 1366;
(dom.window as unknown as { innerHeight: number }).innerHeight = 768;
(dom.window.HTMLElement.prototype as unknown as { scrollIntoView: () => void }).scrollIntoView = () => {};
(dom.window.HTMLElement.prototype as unknown as { hasPointerCapture: () => boolean }).hasPointerCapture = () => false;
(dom.window.HTMLElement.prototype as unknown as { releasePointerCapture: () => void }).releasePointerCapture = () => {};
(dom.window.HTMLElement.prototype as unknown as { setPointerCapture: () => void }).setPointerCapture = () => {};
(dom.window.HTMLElement.prototype as unknown as { click: () => void }).click = function click(this: HTMLElement) {
	this.dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true, cancelable: true }));
};
(dom.window as unknown as { PointerEvent: typeof MouseEvent }).PointerEvent = dom.window.MouseEvent;

const { createRoot } = await import('react-dom/client');
const { MemoryRouter } = await import('react-router-dom');
const { SubjectRow } = await import('../SubjectRow');
const { SubjectFormModal } = await import('../SubjectFormModal');
const { SubjectCoverageSheet } = await import('../SubjectCoverageSheet');
const { SubjectTermAuthorityBanner } = await import('../SubjectTermAuthorityBanner');
const { SubjectStatusBanners } = await import('../SubjectStatusBanners');
const { subjectToFormValues } = await import('../subject-form-utils');

type TermAuthority = import('../../../types').TermAuthority;

const clientRoot = resolve(import.meta.dirname, '../../../..');
const repoRoot = resolve(clientRoot, '..');
function source(path: string): string {
	return readFileSync(resolve(clientRoot, path), 'utf8');
}

let root: Root | null = null;
let hostEl: HTMLElement | null = null;
after(async () => {
	if (root) await act(async () => { root?.unmount(); });
	hostEl?.remove();
	dom.window.close();
});

async function render(node: React.ReactNode): Promise<HTMLElement> {
	await unmount();
	hostEl = document.createElement('div');
	document.body.appendChild(hostEl);
	root = createRoot(hostEl);
	await act(async () => { root?.render(node); });
	return hostEl;
}

async function unmount(): Promise<void> {
	if (root) await act(async () => { root?.unmount(); });
	root = null;
	hostEl?.remove();
	hostEl = null;
}

function subjectFixture(overrides: Record<string, unknown> = {}) {
	return {
		id: 41,
		code: 'SCI10',
		name: 'Earth Science',
		displayCode: 'SCI10',
		outputLabel: null,
		ownerDepartment: 'AP',
		allowedOwnerDepartments: ['AP'],
		qualificationPriority: 'DEPARTMENT_FIRST' as const,
		rotationFamily: null,
		minMinutesPerWeek: 225,
		preferredRoomType: 'LAB' as never,
		isActive: true,
		isSeedable: false,
		isSystemManaged: false,
		gradeLevels: [9],
		interSectionEnabled: false,
		interSectionGradeLevels: [] as number[],
		modularGroupId: null,
		modularOrder: null,
		programScopes: ['REGULAR'],
		allowedSpecializations: [] as string[],
		requiredFeatures: [] as string[],
		rotationTermLabel: null,
		rotationTermRank: null,
		rotationTermGroupId: null,
		rotationTermCount: null,
		updatedAt: '2026-09-28T00:00:00.000Z',
		...overrides,
	} as never;
}

function rowFor(subject: unknown) {
	return (
		<MemoryRouter>
			<table><tbody>
				<SubjectRow
					subject={subject as never}
					timeMode="hours"
					onEdit={() => {}}
					onDelete={() => {}}
					onArchive={() => {}}
					onReactivate={() => {}}
					onShowCoverage={() => {}}
				/>
			</tbody></table>
		</MemoryRouter>
	);
}

/**
 * Text an operator actually READS, with assistive and decorative nodes removed.
 *
 * The fix deliberately keeps the raw `OWNER_DEPT:AP` code reachable in an
 * `@/ui` diagnostic, and `AccessibleInfo` mirrors its help text into an
 * `sr-only` span that lives in the DOM. So "is the raw code rendered?" and
 * "is the raw code still reachable?" are two different questions and need two
 * different readings of the same DOM. Asserting on raw `textContent` for both
 * would force one of them to be false.
 */
function visibleText(scope: Element = document.body): string {
	const clone = scope.cloneNode(true) as Element;
	for (const node of clone.querySelectorAll('.sr-only, [aria-hidden="true"]')) node.remove();
	return clone.textContent ?? '';
}

const NOOP = { onEdit: () => {}, onDelete: () => {}, onArchive: () => {}, onReactivate: () => {}, onShowCoverage: () => {} };

// ===========================================================================
// ITEM 1 — `OWNER_DEPT:AP` must not reach the operator as a raw enum.
// ===========================================================================

/**
 * DISCRIMINATOR (failing-first): on the base commit the row's `AccessibleInfo`
 * shortHelp is built from `subject.requiredFeatures.join(', ')`, so the literal
 * `OWNER_DEPT:` IS present in the rendered DOM and `Araling Panlipunan` is not.
 */
test('A3-C4-1a: the OWNER_DEPT marker is not rendered raw, and reads as a plain department', async () => {
	const host = await render(rowFor(subjectFixture({ requiredFeatures: ['OWNER_DEPT:AP', 'LAB_BENCH'] })));
	const text = visibleText(host);
	assert.doesNotMatch(
		text,
		/OWNER_DEPT:/,
		'the raw ownership-marker code is still in the text a scheduler reads on the Subjects row',
	);
	assert.match(
		text,
		/Araling Panlipunan/,
		'the ownership marker is not shown with the plain department name from the canonical glossary',
	);
	await unmount();
});

/**
 * DISCRIMINATOR (failing-first): on base the count is `requiredFeatures.length`
 * = 2, so an ownership marker inflates the "N special room features" claim. The
 * server's own `roomRequiredFeatures()` excludes markers; the count must agree.
 */
test('A3-C4-1b: an ownership marker is not counted as a room feature', async () => {
	const host = await render(rowFor(subjectFixture({ requiredFeatures: ['OWNER_DEPT:AP', 'LAB_BENCH'] })));
	const text = visibleText(host);
	// Asserted in both directions: the marker must be excluded, and the real
	// feature must still be counted. A control that only asserted the absence
	// would pass on a row that showed no feature count at all.
	assert.match(text, /\+1 feature/, 'the room-feature count still includes the ownership marker');
	assert.doesNotMatch(text, /\+2 feature/, 'the row is still counting the ownership marker as a room feature');
	await unmount();
});

/**
 * The raw code and its expansion must BOTH survive in an `@/ui` affordance —
 * the fix removes the code from the primary read, not from reachability.
 */
test('A3-C4-1c: the raw code and its plain expansion stay reachable in an @/ui affordance', async () => {
	const host = await render(rowFor(subjectFixture({ requiredFeatures: ['OWNER_DEPT:AP'] })));
	assert.equal(
		document.body.querySelector('details'), null,
		'a raw <details> was used — AGENTS.md §8 forbids it',
	);
	assert.equal(
		document.body.querySelector('[title]'), null,
		'a bare title attribute was used — AGENTS.md §8 forbids it',
	);
	const described = document.body.textContent ?? '';
	assert.match(described, /OWNER_DEPT:AP/, 'the raw code is no longer reachable anywhere on the row');
	assert.match(
		described,
		/Araling Panlipunan/,
		'the expansion is not reachable next to the raw code',
	);
	await unmount();
});

/** Unit control on the shared presenter. Imported dynamically so that on the
 * base commit this control alone reports the missing module, instead of the
 * whole file failing to load and every other control reporting nothing. */
test('A3-C4-1d: the shared presenter partitions markers from real room features', async () => {
	const m = await import('../subject-feature-presentation');
	const split = m.splitSubjectFeatures(['OWNER_DEPT:AP', 'LAB_BENCH', 'OWNER_DEPT:TLE']);
	assert.deepEqual(split.roomFeatures, ['LAB_BENCH'], 'markers leaked into the room-feature list');
	assert.deepEqual(
		split.ownerDepartments.map((o) => o.label),
		['Araling Panlipunan', 'Technology and Livelihood Education'],
		'the department labels are not the canonical glossary names',
	);
	assert.deepEqual(
		split.ownerDepartments.map((o) => o.raw),
		['OWNER_DEPT:AP', 'OWNER_DEPT:TLE'],
		'the raw codes are not retained for the diagnostic affordance',
	);
	assert.equal(m.isOwnerDepartmentMarker('OWNER_DEPT:AP'), true);
	assert.equal(m.isOwnerDepartmentMarker('LAB_BENCH'), false);
});

/** A code with no glossary entry must degrade honestly, not to a blank or a
 * fabricated learning area. */
test('A3-C4-1e: an unknown department code degrades to its own code, never to invented prose', async () => {
	const m = await import('../subject-feature-presentation');
	const split = m.splitSubjectFeatures(['OWNER_DEPT:ZZZ']);
	assert.equal(split.ownerDepartments.length, 1);
	assert.equal(split.ownerDepartments[0].code, 'ZZZ');
	assert.equal(
		split.ownerDepartments[0].label,
		'ZZZ',
		'an unknown code was given a fabricated plain-language name',
	);
});

// ===========================================================================
// ITEM 2 — the `STE_APPLIED_CHEM` chip must be subordinate and self-explanatory.
// ===========================================================================

/**
 * DISCRIMINATOR (failing-first): on base the chip is a loud
 * `font-bold ... uppercase ... font-bold tracking-tight` `<code>` with no
 * `tabindex`, no `aria-label` and no affordance at all, so it is neither
 * subordinate nor self-explanatory.
 */
test('A3-C4-2a: the subject-code chip is subordinate and plainly described', async () => {
	const host = await render(rowFor(subjectFixture({ code: 'STE_APPLIED_CHEM', name: 'Applied Chemistry' })));
	const chip = host.querySelector('code');
	assert.ok(chip, 'no subject code chip rendered');
	assert.equal(chip.textContent, 'STE_APPLIED_CHEM', 'the raw code must stay visible on the chip');
	assert.doesNotMatch(
		chip.className,
		/\bfont-bold\b/,
		'the raw code chip still shouts as loudly as the subject name',
	);
	assert.equal(
		chip.getAttribute('tabindex'), '0',
		'the code chip is not keyboard reachable, so no tooltip can be opened',
	);
	const label = chip.getAttribute('aria-label') ?? '';
	assert.match(label, /code/i, 'the code chip is not described as what it is');
	assert.doesNotMatch(label, /OWNER_DEPT/, 'an unrelated code leaked into the subject-code description');
	await unmount();
});

/** The subject NAME is already on screen one line above, so the fix must not
 * duplicate it into the chip. */
test('A3-C4-2b: the chip does not duplicate the subject name that is already shown', async () => {
	const host = await render(rowFor(subjectFixture({ code: 'STE_APPLIED_CHEM', name: 'Applied Chemistry' })));
	const chip = host.querySelector('code');
	assert.notEqual(
		chip?.textContent, 'Applied Chemistry',
		'the chip was made to read as the name, duplicating the row title',
	);
	assert.match(host.textContent ?? '', /Applied Chemistry/, 'the subject name is no longer on the row');
	await unmount();
});

// ===========================================================================
// ITEM 3 — the server-authored TERM_CACHE_INVALID sentence.
// ===========================================================================

const TERM_CONTRACT = {
	schoolId: 1,
	schoolYear: { id: 1, yearLabel: '2026-2027' },
	format: 'TRIMESTER' as const,
	terms: [
		{ identity: 'T1', displayLabel: 'Term 1', order: 1, startDate: null, endDate: null },
		{ identity: 'T2', displayLabel: 'Term 2', order: 2, startDate: null, endDate: null },
		{ identity: 'T3', displayLabel: 'Term 3', order: 3, startDate: null, endDate: null },
	],
	activeTerm: { identity: 'T1', displayLabel: 'Term 1', order: 1 },
	activeTermState: { availability: 'RESOLVED' as const, code: null, message: '', reachable: true, identity: 'T1' },
	semanticRevision: 'rev-1',
};

function authority(overrides: Partial<TermAuthority>): TermAuthority {
	return {
		state: 'VERIFIED_CACHED',
		source: 'atlas-cache',
		degraded: true,
		code: null,
		message: '',
		contract: TERM_CONTRACT as never,
		...overrides,
	} as TermAuthority;
}

/**
 * DISCRIMINATOR (failing-first): on base the banner renders
 * `{termAuthority.message}` verbatim, so the server's internal sentence appears
 * character-for-character in the operator's DOM.
 */
test('A3-C4-3a: the server-authored TERM_CACHE_INVALID sentence never reaches the operator', async () => {
	const host = await render(
		<SubjectTermAuthorityBanner
			termAuthority={authority({
				code: 'TERM_CACHE_INVALID',
				message: 'Saved term contract failed its semantic revision check.',
			})}
		/>,
	);
	const banner = document.body.querySelector('[data-testid="subject-term-authority"]');
	assert.ok(banner, 'no banner rendered');
	// The calm sentence is what the operator reads.
	assert.doesNotMatch(
		banner.textContent ?? '',
		/Saved term contract failed its semantic revision check\./,
		'the server-authored sentence is still shown verbatim',
	);
	// ...and the raw code + raw sentence are still reachable for diagnosis.
	assert.match(
		document.body.textContent ?? '',
		/TERM_CACHE_INVALID/,
		'the diagnostic code is no longer reachable anywhere',
	);
	await unmount();
});

/** The mapping must cover the WHOLE `TERM_CACHE_INVALID` class, not just the
 * one sentence Lane C happened to capture. The server emits six distinct
 * messages under that one code (enrollpro-term-contract.service.ts:439-482). */
test('A3-C4-3b: every TERM_CACHE_INVALID sentence maps to calm operator copy', async () => {
	const sentences = [
		'Saved term contract is not a valid object.',
		'Saved term contract has an unsupported format.',
		'Saved term contract has an invalid term count.',
		'Saved term contract is missing its semantic revision.',
		'Saved term contract has malformed, duplicate, or out-of-order terms.',
		'Saved term contract failed its semantic revision check.',
	];
	for (const message of sentences) {
		const host = await render(
			<SubjectTermAuthorityBanner termAuthority={authority({ code: 'TERM_CACHE_INVALID', message })} />,
		);
		const banner = document.body.querySelector('[data-testid="subject-term-authority"]');
		assert.doesNotMatch(
			banner?.textContent ?? '',
			/Saved term contract/,
			`a raw server sentence still reaches the operator: ${message}`,
		);
		assert.match(
			banner?.textContent ?? '',
			/[a-z]/,
			`no operator copy at all for: ${message}`,
		);
		await unmount();
	}
});

/** The server file is CROSS-LANE and must not have been edited. */
test('A3-C4-3c: the server-authored string is still authored by atlas-server (not edited here)', () => {
	const service = readFileSync(
		resolve(repoRoot, 'atlas-server/src/services/enrollpro-term-contract.service.ts'),
		'utf8',
	);
	assert.match(
		service,
		/Saved term contract failed its semantic revision check\./,
		'the cross-lane server string was altered by this client-only stream',
	);
});

// ===========================================================================
// ITEM 4 — the runtime pass-through, and the two strings nobody can locate.
// ===========================================================================

/**
 * DISCRIMINATOR (failing-first): on base a blank `message` renders an EMPTY
 * `<p>` inside a coloured exception banner, and there is no affordance that can
 * carry the raw detail at all. An earlier draft of this control asserted only
 * that the banner contained letters, which the static chrome ("Read-only
 * source", the format badge, the participation sentence) satisfies on base too
 * — that version was vacuous and is replaced by one that requires the
 * deliverable itself: a labelled detail affordance that actually carries the
 * raw code and the raw message.
 */
test('A3-C4-4a: a term-authority state with no message still shows calm copy and a labelled detail affordance', async () => {
	const host = await render(
		<SubjectTermAuthorityBanner termAuthority={authority({ state: 'BLOCKED', code: 'ENROLLPRO_UNREACHABLE', message: '   ' })} />,
	);
	const banner = document.body.querySelector('[data-testid="subject-term-authority"]');
	assert.ok(banner, 'no banner rendered');
	assert.match(
		banner.textContent ?? '',
		/[A-Za-z]{4,}/,
		'the banner rendered no operator-readable sentence at all',
	);
	// The deliverable: a labelled affordance carrying the raw code + raw message.
	const detail = document.body.querySelector('[data-testid="subject-term-authority-detail"]');
	assert.ok(
		detail,
		'a blocked state with no message offers no labelled affordance for the raw detail (AGENTS.md §8: not a title attribute)',
	);
	const detailText = detail.textContent ?? '';
	assert.match(detailText, /ENROLLPRO_UNREACHABLE/, 'the raw code is not carried in the detail affordance');
	assert.equal(
		document.body.querySelector('[title]'), null,
		'a bare title attribute was used for the detail — AGENTS.md §8 forbids it',
	);
	await unmount();
});

/** The catalog-load error banner is the other Subjects pass-through that shows
 * a raw upstream string to the operator. A whitespace-only upstream string must
 * not produce a coloured exception banner with no sentence in it, and a real
 * one must keep its retry control.
 *
 * DISCRIMINATOR (failing-first): on base `{error && ...}` treats `'   '` as
 * truthy and renders a destructive alert whose only message text is whitespace.
 * The control targets the MESSAGE SLOT, not the whole banner — an earlier
 * draft matched letters against the banner and the "Retry" button label
 * satisfied it vacuously.
 */
test('A3-C4-4a2: the catalog error banner does not render an empty alert for a blank upstream string', async () => {
	const blank = await render(<SubjectStatusBanners error={'   '} onRetryLoad={() => {}} />);
	const slot = document.body.querySelector('[data-testid="subjects-error-text"]');
	assert.ok(
		slot,
		'a blank upstream string renders a coloured alert with no calm fallback sentence in it',
	);
	assert.match(
		slot.textContent ?? '',
		/[A-Za-z]{4,}/,
		'the catalog error message slot is empty rather than carrying calm fallback copy',
	);
	await unmount();

	const real = await render(<SubjectStatusBanners error="EnrollPro is unreachable." onRetryLoad={() => {}} />);
	const realSlot = document.body.querySelector('[data-testid="subjects-error-text"]');
	assert.ok(realSlot, 'a real upstream error no longer renders the banner');
	assert.equal(
		realSlot.textContent, 'EnrollPro is unreachable.',
		'the upstream detail was replaced instead of being kept as the diagnostic',
	);
	assert.ok(
		document.body.querySelector('[data-testid="subjects-error-banner"] button'),
		'the retry control was lost from the error banner',
	);
	await unmount();
});

/**
 * F6 CORRECTION — a scan that DISCRIMINATES, not one that returns [].
 *
 * The prior stream's control asserted `deepEqual(found, [], ...)` and called
 * that proof the scan works; a scanner broken to return an empty list passed it.
 * Here the SAME scanner is required to FIND a literal that genuinely exists
 * (positive control) and to MISS two that genuinely do not. If the scanner
 * regressed to "always empty", the positive control fails and this test goes
 * red — which is the discrimination the earlier suite only claimed.
 */
test('A3-C4-4b: the repo scan discriminates — it finds a present literal and misses the two absent ones', () => {
	function allSources(dir: string): string[] {
		const out: string[] = [];
		for (const entry of readdirSync(dir)) {
			if (entry === 'node_modules' || entry === 'dist' || entry === '__tests__' || entry.startsWith('.')) continue;
			const full = join(dir, entry);
			if (statSync(full).isDirectory()) {
				out.push(...allSources(full));
				continue;
			}
			if (/\.(ts|tsx)$/.test(entry)) out.push(readFileSync(full, 'utf8'));
		}
		return out;
	}
	const files = [...allSources(resolve(clientRoot, 'src')), ...allSources(resolve(repoRoot, 'atlas-server/src'))];
	const scan = (needle: string) => files.filter((t) => t.includes(needle));

	// POSITIVE CONTROL — proves the scanner is not vacuously empty. Without this
	// assertion the two negative assertions below would be meaningless.
	assert.ok(
		scan('OWNER_DEPARTMENT_FEATURE_PREFIX').length > 0,
		'DISCRIMINATION FAILURE: the scanner found nothing at all, so every negative below would pass vacuously',
	);
	assert.ok(
		scan('Saved term contract failed its semantic revision check.').length > 0,
		'DISCRIMINATION FAILURE: the scanner cannot find a literal that is definitely present',
	);

	// NEGATIVE CONTROLS — the two strings Lane C saw, which exist nowhere.
	for (const needle of ['Could not reach the enrolment system', "Rechecking last year's schedule data"]) {
		assert.deepEqual(
			scan(needle), [],
			`${JSON.stringify(needle)} now exists in source, so the finding that it is runtime-sourced is stale`,
		);
	}
});

// ===========================================================================
// Preservation — the same defect must be gone on the other two owned surfaces.
// ===========================================================================

test('A3-C4-5a: the coverage sheet shows the marker as a plain department, not a raw chip', async () => {
	const host = await render(
		<MemoryRouter>
			<SubjectCoverageSheet
				subject={subjectFixture({ requiredFeatures: ['OWNER_DEPT:AP', 'LAB_BENCH'] }) as never}
				loading={false}
				detail={null}
				errorBySubjectId={new Map<number, string>()}
				onRetry={() => {}}
				onClose={() => {}}
			/>
		</MemoryRouter>,
	);
	const read = visibleText(document.body);
	assert.doesNotMatch(read, /OWNER_DEPT:/, 'the coverage sheet still shows the raw marker to the reader');
	assert.match(read, /Araling Panlipunan/, 'the coverage sheet does not name the owning department');
	assert.match(
		document.body.textContent ?? '',
		/OWNER_DEPT:AP/,
		'the raw marker is no longer reachable in the coverage sheet diagnostic',
	);
	await unmount();
});

test('A3-C4-5b: the form modal chips the marker as a plain department', async () => {
	const host = await render(
		<SubjectFormModal
			open
			mode="edit"
			initialValues={subjectToFormValues(subjectFixture({ requiredFeatures: ['OWNER_DEPT:AP'] }) as never)}
			subjectMeta={{ ownerDepartment: 'AP', allowedOwnerDepartments: ['AP'] }}
			saving={false}
			onClose={() => {}}
			onSave={async () => ({ ok: true } as never)}
		/>,
	);
	const read = visibleText(document.body);
	assert.doesNotMatch(read, /OWNER_DEPT:/, 'the form modal still shows the raw marker chip to the reader');
	assert.match(read, /Araling Panlipunan/, 'the form modal does not name the owning department');
	assert.match(
		document.body.textContent ?? '',
		/OWNER_DEPT:AP/,
		'the raw marker is no longer reachable in the form modal diagnostic',
	);
	await unmount();
});

void NOOP;
