/**
 * DOCX1 S1 (operator 30 Sep 2026) — the `Owned by …` note in the edit subject form.
 *
 * THE DEFECT, in the operator's words: the per-chip `AccessibleInfo` hover bubble
 * anchored `side="top"` opened directly under the `Add` button row — it was
 * CLIPPED and OVERLAPPED the `Add` button — and its `shortHelp` printed the raw
 * storage code (`stored as OWNER_DEPT:AP`).
 *
 * THE FIX: the floating bubble is subtracted and the explanation is rendered
 * INLINE, in full, below the chip row, in raw-free plain words:
 *   "ATLAS records the owning codes as AP and MAPEH."
 *
 * HARNESS: every row renders the REAL `SubjectFormModal` through jsdom (the
 * render/unmount discipline of the accepted sibling `a5-fix20-subject-discard`),
 * reads into plain data, and unmounts BEFORE asserting. `AGENTS.md` §11: a test
 * that only asserts source text is not acceptance evidence for a user-facing
 * change, so every row mounts the component and reads the resulting DOM.
 */
import assert from 'node:assert/strict';
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
	IntersectionObserver: class { observe() {} unobserve() {} disconnect() {} takeRecords() { return []; } },
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
(dom.window as unknown as { PointerEvent: typeof MouseEvent }).PointerEvent = dom.window.MouseEvent;

const { createRoot } = await import('react-dom/client');
const { SubjectFormModal } = await import('../SubjectFormModal');
const { subjectToFormValues } = await import('../subject-form-utils');

let root: Root | null = null;
let hostEl: HTMLElement | null = null;
after(async () => {
	if (root) await act(async () => { root?.unmount(); });
	hostEl?.remove();
	dom.window.close();
});

async function render(node: React.ReactNode): Promise<HTMLElement> {
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
		code: 'ESP/GMRC',
		name: 'Edukasyon sa Pagkakaisa',
		displayCode: 'ESP/GMRC',
		outputLabel: null,
		ownerDepartment: 'AP',
		allowedOwnerDepartments: [] as string[],
		qualificationPriority: 'DEPARTMENT_FIRST' as const,
		rotationFamily: null,
		minMinutesPerWeek: 150,
		preferredRoomType: 'CLASSROOM' as const,
		isActive: true,
		isSeedable: false,
		isSystemManaged: false,
		gradeLevels: [7, 8, 9, 10],
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
		updatedAt: '2026-09-30T00:00:00.000Z',
		...overrides,
	} as never;
}

/** The edit form, seeded with two ownership markers — the operator's exact case. */
function renderEditForm(requiredFeatures: string[]): Promise<HTMLElement> {
	return render(
		<SubjectFormModal
			open
			mode="edit"
			initialValues={subjectToFormValues(subjectFixture({ requiredFeatures }))}
			subjectMeta={{ ownerDepartment: 'AP', allowedOwnerDepartments: ['AP', 'MAPEH'] }}
			saving={false}
			onSave={async () => ({ status: 'saved' as const })}
			onClose={() => {}}
		/>,
	);
}

test('A5DOCX1-S1-1 the ownership note renders IN FULL inline, in raw-free plain words', async () => {
	const host = await renderEditForm(['OWNER_DEPT:AP', 'OWNER_DEPT:MAPEH']);

	const bodyText = document.body.textContent ?? '';
	// (a) the plain sentence is present, verbatim.
	assert.match(
		bodyText,
		/ATLAS records the owning codes as AP and MAPEH\./,
		'the form does not render the plain ownership sentence in words an officer reads',
	);
	// (b) no raw storage code anywhere — the operator's "no raw OWNER_DEPT / OWNED DEPT
	// on screen".
	assert.doesNotMatch(bodyText, /OWNER_DEPT/, 'the raw OWNER_DEPT storage code is still on screen');
	assert.doesNotMatch(bodyText, /OWNED DEPT/, 'a raw OWNED DEPT string is on screen');
	// (c) the note node is RENDERED — no hover, no click, no tooltip required.
	const note = document.body.querySelector('[data-testid="subjects-form-owner-note"]');
	assert.ok(note, 'the inline ownership note is not rendered, so the explanation still depends on a hover bubble');
	assert.match(note!.textContent ?? '', /ATLAS records the owning codes as AP and MAPEH\./, 'the note node does not carry the plain sentence');
	assert.equal(note!.querySelector('button'), null, 'the inline note must not itself be an interactive control');
	await unmount();
	void host;
});

test('A5DOCX1-S1-2 the ownership chips carry NO floating info trigger — the bubble is subtracted, not hidden', async () => {
	await renderEditForm(['OWNER_DEPT:AP', 'OWNER_DEPT:MAPEH']);

	// (d) The per-chip `AccessibleInfo` trigger was a Button whose aria-label was
	// "How this subject's owning department is recorded". It must be gone.
	assert.equal(
		document.body.querySelector('[aria-label="How this subject\'s owning department is recorded"]'),
		null,
		'the AccessibleInfo info trigger is still rendered inside the ownership chips',
	);
	// The ownership badges are still present and still name the department in plain
	// words — this is a subtraction of the bubble, not of the ownership status.
	const ownedBadges = Array.from(document.body.querySelectorAll('[data-slot="badge"]')).filter(
		(b) => (b.textContent ?? '').replace(/\s+/g, ' ').trim().startsWith('Owned by '),
	);
	assert.ok(ownedBadges.length >= 1, 'the ownership badge itself disappeared');
	for (const badge of ownedBadges) {
		assert.equal(badge.querySelector('button'), null, `the ownership badge "${badge.textContent}" still contains a control`);
	}
	assert.match(document.body.textContent ?? '', /Owned by Araling Panlipunan/, 'the owning department is no longer named in plain words');
	await unmount();
});

test('A5DOCX1-S1-3 a single owning code produces the singular raw-free sentence', async () => {
	await renderEditForm(['OWNER_DEPT:AP']);
	const bodyText = document.body.textContent ?? '';
	assert.match(bodyText, /ATLAS records the owning code as AP\./, 'the singular ownership sentence is wrong');
	assert.doesNotMatch(bodyText, /OWNER_DEPT/, 'the raw OWNER_DEPT storage code is still on screen');
	await unmount();
});

test('A5DOCX1-S1-4 a subject with a real room feature still renders it, and the note only states ownership', async () => {
	await renderEditForm(['OWNER_DEPT:AP', 'LAB_BENCH']);
	const bodyText = document.body.textContent ?? '';
	assert.match(bodyText, /LAB_BENCH/, 'the real room feature chip disappeared');
	// The note is the OWNERSHIP sentence only; it must not claim a room feature.
	const note = document.body.querySelector('[data-testid="subjects-form-owner-note"]');
	assert.ok(note, 'the ownership note is not rendered beside a real room feature either');
	assert.match(note!.textContent ?? '', /ATLAS records the owning code as AP\./);
	assert.doesNotMatch(note!.textContent ?? '', /special room feature/i, 'the ownership note wrongly claims a room feature');
	await unmount();
});
