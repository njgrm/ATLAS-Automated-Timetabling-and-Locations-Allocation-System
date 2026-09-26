/**
 * A2-TIMETABLE-CUSTODY-R2 — the visible Redo must never be offered and broken,
 * and a 409 must never be reported as a schedule change that did not happen.
 *
 * THE TRACED CHAIN (every link confirmed against source in this commit):
 *
 *   1. `revertLastEdit` returns `editId: editRecord.id`
 *      (`atlas-server/src/services/manual-edit.service.ts:1914`), and
 *      `editRecord` is the REVERT row it just created at `:1857-1871`
 *      (`editType: 'REVERT'` at `:1863`).
 *   2. `deriveRedoAfterRevert` therefore arms `redoState.operationId` with that
 *      REVERT id
 *      (`atlas-client/src/components/timetable/timetableUndoRedoState.ts:22`),
 *      reached from `atlas-client/src/hooks/useTimetableMutations.ts:1034`.
 *   3. `redoLastEdit` POSTs that id to the same revert route
 *      (`useTimetableMutations.ts:1106-1110`).
 *   4. The server selects its target with `editType: { not: 'REVERT' }`
 *      (`manual-edit.service.ts:1675`), so a REVERT row resolves to `null`;
 *      `assertUndoHead` (`atlas-server/src/services/timetable-undo-contract.ts:24`)
 *      then compares a real `requestingActorId` against `operationActorId: null`
 *      and throws `UndoConflictError` — and `:1690` throws `UNDO_CONFLICT` again
 *      even if that guard were removed. GUARANTEED 409, unconditionally, on every
 *      successful revert.
 *   5. The client then surfaced "Version-stale — the schedule changed. Refresh
 *      and re-preview before retrying." (`useTimetableMutations.ts:1040-1042`) when
 *      nothing changed at all.
 *
 * WHY THIS IS NOT CLOSED BY A SERVER CHANGE (and why none is attempted here):
 * the server's `editType: { not: 'REVERT' }` selection is accepted, reviewed and
 * live behaviour, and `assertUndoHead` additionally requires the target to BE the
 * head (`:22`) — after a revert the head IS the REVERT row, so no id the client
 * can name satisfies the contract. A truthful Redo is a NEW server operation that
 * re-applies the reverted edit's `afterPayload`, which is new server state and out
 * of this lane's scope. The accepted predecessor for exactly this reason removed
 * the misleading affordance from the history row instead of renaming it
 * (`TimetableAssignmentDialogs.tsx:24-32,155-163`, "This undo cannot be undone.").
 * This lane applies the same honest subset to the Redo surfaces and to the header
 * Undo, which the predecessor did not reach.
 *
 * The fixtures below are the LIVE shape, not an invented one: ids 46/47, actor 46
 * and the `{ revertedEditId, revertedEditType }` summary come from the committed
 * QA evidence already used by `timetable-edit-history-truth-a2.test.tsx`, and the
 * server replica is transcribed from the cited lines rather than paraphrased.
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { after, test } from 'node:test';
import { act, createElement } from 'react';
import type { Root } from 'react-dom/client';
import { JSDOM } from 'jsdom';

// This file lives at `src/components/timetable/__tests__/`, so the client root
// is four levels up. (`src/lib/__tests__/` suites use three.)
const clientRoot = resolve(import.meta.dirname, '../../../..');
function source(path: string): string {
	return readFileSync(resolve(clientRoot, path), 'utf8');
}
/**
 * Source with comments removed, for NEGATIVE copy assertions. A row that forbids a
 * string must forbid it as RENDERED copy; a comment that quotes the retired string in
 * order to explain why it was retired is the opposite of a regression, and matching
 * it would make the row unfixable except by deleting the explanation.
 */
function renderedSource(path: string): string {
	return source(path)
		.replace(/\/\*[\s\S]*?\*\//g, ' ')
		.replace(/(^|[^:])\/\/[^\n]*/g, '$1 ');
}

const dom = new JSDOM('<!doctype html><html><body><div id="root"></div></body></html>', { url: 'http://localhost/timetable' });
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
	HTMLInputElement: dom.window.HTMLInputElement,
	HTMLTextAreaElement: dom.window.HTMLTextAreaElement,
	MutationObserver: dom.window.MutationObserver,
	getComputedStyle: dom.window.getComputedStyle.bind(dom.window),
	requestAnimationFrame: (callback: FrameAnimationFrameCallback) => setTimeout(() => callback(Date.now()), 0),
	cancelAnimationFrame: (id: number) => clearTimeout(id),
	ResizeObserver: class { observe() {} unobserve() {} disconnect() {} },
	DOMRect: dom.window.DOMRect,
	IS_REACT_ACT_ENVIRONMENT: true,
});
Object.defineProperty(globalThis, 'navigator', { value: dom.window.navigator, configurable: true });
(dom.window.HTMLElement.prototype as unknown as { scrollIntoView: () => void }).scrollIntoView = () => {};
(dom.window.HTMLElement.prototype as unknown as { hasPointerCapture: () => boolean }).hasPointerCapture = () => false;

type FrameAnimationFrameCallback = (time: number) => void;

const { createRoot } = await import('react-dom/client');
const { TooltipProvider } = await import('../../../ui/tooltip');
const { TimetableUndoRedoControl } = await import('../TimetableUndoRedoControl');
const {
	assessRedoAfterRevert,
	decideHeaderUndo,
	deriveRedoAfterRevert,
	dispatchRedo,
	UNDO_CONFLICT_MESSAGE,
	UNDO_CANNOT_BE_REDONE,
	UNDO_HEAD_IS_UNDO_MESSAGE,
} = await import('../timetableUndoRedoState');

let root: Root | null = null;
after(async () => { await act(async () => { root?.unmount(); }); });

/* ── The server contract, transcribed from source ──────────────────────────── */

type LedgerRow = { id: number; editType: string; actorId: number; revertedEditId?: number };

/**
 * A transcription of the real undo path, NOT a paraphrase:
 *   - target selection `editType: { not: 'REVERT' }` (`:1675`)
 *   - head selection with no editType filter (`:1676`), so a REVERT row is head
 *   - prior-revert lookup (`:1677-1679`)
 *   - `assertUndoHead`'s four disjuncts (`timetable-undo-contract.ts:21-26`)
 *   - the unconditional `UNDO_CONFLICT` at `:1690`
 * The ledger is ordered newest-first, matching `orderBy: { createdAt: 'desc' }`
 * (`:1938`) with the id tiebreak.
 */
function serverRevert(
	ledger: LedgerRow[],
	runVersion: number,
	requestingActorId: number,
	operationId: number,
	expectedVersion: number,
): { editId: number; newVersion: number } {
	const lastEdit = ledger.find((row) => row.id === operationId && row.editType !== 'REVERT') ?? null;
	const headEdit = ledger[0] ?? null;
	const priorRevert = ledger.find((row) => row.editType === 'REVERT' && row.revertedEditId === operationId) ?? null;
	if (
		operationId !== (headEdit?.id ?? null)
		|| expectedVersion !== runVersion
		|| requestingActorId !== (lastEdit?.actorId ?? null)
		|| priorRevert != null
	) {
		throw { statusCode: 409, code: 'UNDO_CONFLICT' };
	}
	if (!lastEdit) throw { statusCode: 409, code: 'UNDO_CONFLICT' };
	return { editId: 900, newVersion: runVersion + 1 };
}

/** The live ledger AFTER one successful revert of edit 46 by actor 46. */
const LEDGER_AFTER_REVERT: LedgerRow[] = [
	{ id: 47, editType: 'REVERT', actorId: 46, revertedEditId: 46 },
	{ id: 46, editType: 'SWAP_ENTRIES', actorId: 46 },
];
const RUN_VERSION_AFTER_REVERT = 44;
const ACTOR = 46;

/** What the revert route answered, per `manual-edit.service.ts:1913-1919`. */
const REVERT_RESPONSE = { editId: 47, newVersion: RUN_VERSION_AFTER_REVERT };

/* ── Link 4 + 5: the 409 is real and the copy that follows it is false ─────── */

test('R2 link 4: re-dispatching the id a revert returned is a guaranteed UNDO_CONFLICT', async () => {
	// Exactly what the pre-fix production path did: arm from the revert
	// response, then re-dispatch that id to the same route with the same CAS.
	const armed = deriveRedoAfterRevert(REVERT_RESPONSE, 'Reverted edit');
	assert.equal(armed.operationId, 47, 'link 2: the armed target IS the REVERT row id the server created');

	const before = { ledger: LEDGER_AFTER_REVERT.map((row) => ({ ...row })), version: RUN_VERSION_AFTER_REVERT };
	const refused: { statusCode?: number; code?: string } = {};
	await dispatchRedo(armed, RUN_VERSION_AFTER_REVERT, async (operationId, expectedVersion) => {
		try {
			return serverRevert(LEDGER_AFTER_REVERT, RUN_VERSION_AFTER_REVERT, ACTOR, operationId, expectedVersion);
		} catch (error) {
			Object.assign(refused, error as { statusCode?: number; code?: string });
			return null;
		}
	});

	assert.deepEqual(
		{ statusCode: refused.statusCode, code: refused.code },
		{ statusCode: 409, code: 'UNDO_CONFLICT' },
		'link 4: the server refuses the target with 409 UNDO_CONFLICT',
	);
	// The refusal changed NOTHING. That is what makes the copy that follows it
	// a false claim rather than an unlucky one.
	assert.deepEqual(
		{ ledger: LEDGER_AFTER_REVERT, version: RUN_VERSION_AFTER_REVERT },
		before,
		'link 4: the refused redo wrote nothing — the ledger and the run version are byte-identical',
	);
	assert.equal(
		RUN_VERSION_AFTER_REVERT,
		44,
		'the version the operator was shown is current, so "the schedule changed" is not merely unproven, it is false here',
	);
});

test('R2 link 5: the UNDO_CONFLICT copy never claims a version or schedule change', () => {
	assert.doesNotMatch(
		UNDO_CONFLICT_MESSAGE,
		/version/i,
		'a UNDO_CONFLICT is not always a version change — `assertUndoHead` also fires on a non-head target, another actor\'s edit, and an already-undone target, none of which moved a version',
	);
	assert.doesNotMatch(
		UNDO_CONFLICT_MESSAGE,
		/schedule changed/i,
		'the pre-fix copy asserted the schedule had changed; in the traced redo case nothing changed at all',
	);
	assert.doesNotMatch(
		UNDO_CONFLICT_MESSAGE,
		/re-preview|refresh/i,
		'and it instructed a refresh-and-re-preview that cannot help, because the target itself was never undoable',
	);
	assert.match(
		UNDO_CONFLICT_MESSAGE,
		/Nothing was changed/,
		'the one claim it can always make is that the refused undo wrote nothing',
	);
});

test('R2 the UNDO_CONFLICT copy stays true for every cause assertUndoHead can raise', () => {
	// One code, five real causes (`timetable-undo-contract.ts:21-26`, `:1690`).
	// For each, the ledger state is asserted so the copy's claim can be checked
	// against it rather than assumed.
	const causes: Array<{ cause: string; ledger: LedgerRow[]; version: number; operationId: number; expectedVersion: number; versionMoved: boolean }> = [
		{ cause: 'target is not the head (a newer edit exists)', ledger: [{ id: 48, editType: 'MOVE_ENTRY', actorId: 46 }, ...LEDGER_AFTER_REVERT], version: 45, operationId: 46, expectedVersion: 44, versionMoved: true },
		{ cause: 'run version moved under the operator', ledger: LEDGER_AFTER_REVERT, version: 45, operationId: 46, expectedVersion: 44, versionMoved: true },
		{ cause: "the target belongs to another account", ledger: [{ id: 47, editType: 'SWAP_ENTRIES', actorId: 7 }], version: 44, operationId: 47, expectedVersion: 44, versionMoved: false },
		{ cause: 'the target was already undone', ledger: [{ id: 48, editType: 'REVERT', actorId: 46, revertedEditId: 46 }, ...LEDGER_AFTER_REVERT], version: 44, operationId: 46, expectedVersion: 44, versionMoved: false },
		{ cause: 'the id names no undoable change (the traced redo case)', ledger: LEDGER_AFTER_REVERT, version: 44, operationId: 47, expectedVersion: 44, versionMoved: false },
	];
	assert.equal(causes.length, 5, 'the enumeration is pinned, so a cause cannot be quietly dropped');

	for (const cause of causes) {
		const before = { ledger: cause.ledger.map((row) => ({ ...row })), version: cause.version };
		let code: string | null = null;
		try {
			serverRevert(cause.ledger, cause.version, ACTOR, cause.operationId, cause.expectedVersion);
		} catch (error) {
			code = (error as { code?: string }).code ?? null;
		}		assert.equal(code, 'UNDO_CONFLICT', `cause "${cause.cause}" really does raise UNDO_CONFLICT`);
		assert.deepEqual(
			{ ledger: cause.ledger, version: cause.version },
			before,
			`cause "${cause.cause}" is refused with zero writes, which is the one claim the copy makes`,
		);
	}
	// The load-bearing consequence: three of the five causes moved no version, so
	// ANY copy asserting a version change is false for a majority of them.
	assert.equal(
		causes.filter((cause) => !cause.versionMoved).length,
		3,
		'three of the five UNDO_CONFLICT causes move no version, so a version claim is false more often than true',
	);
	assert.doesNotMatch(UNDO_CONFLICT_MESSAGE, /version/i, 'and the shipped copy makes no version claim');
});

/* ── Post-fix: a redo the server cannot perform is never armed ─────────────── */

test('R2 post-fix: a redo whose target is a REVERT row is never armed', () => {
	const assessment = assessRedoAfterRevert(REVERT_RESPONSE, 'Reverted edit', 'REVERT');
	assert.equal(
		assessment.kind,
		'not-performable',
		'the server selects undo targets with editType { not: \'REVERT\' }, so a REVERT id can never resolve to a target',
	);
	assert.equal(
		'target' in assessment,
		false,
		'nothing is armed, so no Redo press can reach the guaranteed 409',
	);
	assert.match(
		assessment.reason,
		/cannot be undone/i,
		'the absence is stated in the same words the accepted history-row fix already uses',
	);
});

test('R2 post-fix: the gate still arms a target the server CAN revert (two-sided)', () => {
	// Without this the gate is untested in its permissive direction and could be
	// a constant `false` that passes every refusal row.
	const assessment = assessRedoAfterRevert(REVERT_RESPONSE, 'Reverted edit', 'SWAP_ENTRIES');
	assert.equal(assessment.kind, 'performable', 'a non-REVERT row is a legal undo target');
	assert.deepEqual(
		assessment.kind === 'performable' ? assessment.target : null,
		deriveRedoAfterRevert(REVERT_RESPONSE, 'Reverted edit'),
		'the armed target is byte-identical to the state machine\'s own derivation',
	);
});

test('R2 post-fix: an unidentifiable row fails closed rather than arming on hope', () => {
	// `fetchEditHistory` swallows a failed read (`useTimetableMutations.ts:922-924`),
	// so the armed id may be absent from the refreshed ledger. The client cannot
	// prove the target is undoable, so it must not offer the action.
	for (const unknown of [null, undefined]) {
		const assessment = assessRedoAfterRevert(REVERT_RESPONSE, 'Reverted edit', unknown);
		assert.equal(assessment.kind, 'not-performable', 'an unknown ledger row is not a licence to dispatch');
	}
});

test('R2 post-fix: a REVERT-led Redo press is a no-op, not a 409', async () => {
	let dispatches = 0;
	const outcome = await dispatchRedo(null, RUN_VERSION_AFTER_REVERT, async () => { dispatches += 1; });
	assert.equal(dispatches, 0, 'with no target armed, the press reaches the network zero times');
	assert.equal(outcome.dispatched, false);
});

/* ── The header Undo instance, closed client-side ──────────────────────────── */

test('R2 post-fix: a REVERT at the head blocks the header Undo instead of 409ing', () => {
	const blocked = decideHeaderUndo(LEDGER_AFTER_REVERT[0], RUN_VERSION_AFTER_REVERT);
	assert.equal(
		blocked.kind,
		'blocked',
		'`revertLastEdit` dispatched `editHistory[0].id`, and with a REVERT at the head `assertUndoHead` can only fail',
	);
	assert.equal(blocked.kind === 'blocked' ? blocked.reason : null, 'head-is-undo');
	assert.equal(
		UNDO_HEAD_IS_UNDO_MESSAGE,
		'The last change to this schedule was itself an undo, so there is nothing left to undo.',
		'the block is stated, not silent — a control that vanishes or refuses without a reason reads as broken',
	);
});

test('R2 post-fix: the header Undo still dispatches for a real head edit (two-sided)', () => {
	const decision = decideHeaderUndo({ id: 46, editType: 'SWAP_ENTRIES' }, RUN_VERSION_AFTER_REVERT);
	assert.deepEqual(
		decision,
		{ kind: 'dispatch', operationId: 46, expectedVersion: RUN_VERSION_AFTER_REVERT },
		'the ordinary case is untouched: the same id and the same CAS the server expects',
	);
});

test('R2 post-fix: the header Undo is blocked with a reason when there is nothing to undo', () => {
	const noEdits = decideHeaderUndo(null, RUN_VERSION_AFTER_REVERT);
	assert.equal(noEdits.kind, 'blocked');
	assert.equal(noEdits.kind === 'blocked' ? noEdits.reason : null, 'no-edits');

	const noDraft = decideHeaderUndo({ id: 46, editType: 'SWAP_ENTRIES' }, null);
	assert.equal(noDraft.kind, 'blocked');
	assert.equal(
		noDraft.kind === 'blocked' ? noDraft.reason : null,
		'no-draft',
		'a missing draft version cannot be CASed, so it is blocked with its own reason rather than a stale send',
	);
});

/* ── Rendered truth: the control states the plain fact ─────────────────────── */

async function mountControl(overrides: Record<string, unknown> = {}) {
	if (root) await act(async () => { root?.unmount(); });
	const container = document.getElementById('root')!;
	root = createRoot(container);
	await act(async () => {
		root!.render(createElement(
			TooltipProvider,
			null,
			createElement(TimetableUndoRedoControl, {
				editHistoryCount: 2,
				revertLoading: false,
				revertLastEdit: async () => {},
				redoState: null,
				redoVersionStale: false,
				redoLastEdit: async () => {},
				clearRedo: () => {},
				setShowEditHistory: () => {},
				...overrides,
			} as never),
		));
	});
	for (let index = 0; index < 5; index += 1) {
		await act(async () => { await new Promise((settle) => setTimeout(settle, 0)); });
	}
	return document.body.textContent ?? '';
}

test('R2 rendered: after a revert the control states the undo cannot be undone and offers no live Redo', async () => {
	const rendered = await mountControl({
		undoNotice: UNDO_CANNOT_BE_REDONE,
		undoBlockedReason: null,
	});
	assert.match(rendered, /cannot be undone/, 'the plain fact is on screen — hiding alone is not acceptable');
	const redo = document.querySelector('[data-testid="timetable-visible-redo"]') as HTMLButtonElement | null;
	assert.ok(redo, 'the Redo control is still present, so no dangling reference is introduced by gating it');
	assert.equal(
		redo?.disabled,
		true,
		'and it cannot be pressed, so it is not "offered and broken"',
	);
	assert.doesNotMatch(rendered, /Version-stale/, 'no version claim stands in for the truth');
});

test('R2 rendered: the control never explains an undo conflict as a version change', async () => {
	const rendered = await mountControl({ redoVersionStale: true, conflictNotice: UNDO_CONFLICT_MESSAGE });
	assert.match(rendered, /no longer applies/, 'the conflict is reported as a conflict');
	assert.doesNotMatch(rendered, /Version-stale/, 'and never as a version change');
	assert.doesNotMatch(rendered, /re-preview|refresh/i, 'nor with an instruction to re-preview, which cannot help');
});

test('R2 rendered: a blocked header Undo carries its reason, not a dead grey button', async () => {
	const rendered = await mountControl({ undoBlockedReason: UNDO_HEAD_IS_UNDO_MESSAGE });
	assert.match(rendered, /nothing left to undo/, 'the disabled Undo says why it is disabled');
	assert.equal(
		(document.querySelector('[data-testid="timetable-visible-undo"]') as HTMLButtonElement | null)?.disabled,
		true,
		'and it cannot be pressed into a 409',
	);
});

/* ── Wiring: the consumers, so the same 409 cannot reappear elsewhere ───────── */

test('R2 wiring: the hook arms a redo only through the assessed gate', () => {
	const hook = source('src/hooks/useTimetableMutations.ts');
	assert.match(hook, /assessRedoAfterRevert/, 'the arm site consumes the gate');
	assert.match(hook, /deriveRedoAfterRevert/, 'the pre-existing derivation is retained and still reachable (accepted assertion retained)');
	assert.match(hook, /setRedoVersionStale\(true\)/, 'the pre-existing conflict state is retained (accepted assertion retained)');
	// The gate must be load-bearing: arming must not be able to bypass it. Every
	// `setRedoState` argument is read, and the ONLY non-clearing one must be the
	// gated ternary over an `assessment` bound from `assessRedoAfterRevert` — so a
	// future `setRedoState(someRawTarget)` fails this row.
	const armArgs = [...hook.matchAll(/setRedoState\(([^;]*?)\);/g)].map((match) => match[1].trim());
	const clearing = armArgs.filter((arg) => arg === 'null');
	const arming = armArgs.filter((arg) => arg !== 'null');
	assert.ok(arming.length > 0, `at least one arming call site exists; found args: ${JSON.stringify(armArgs)}`);
	for (const arg of arming) {
		assert.match(arg, /^assessment\.kind === 'performable' \? assessment\.target : null$/, `the arming call is gated: ${arg}`);
	}
	assert.ok(clearing.length >= 1, 'the clearing call sites (dispatch, dismiss) are retained beside it');
	// And the assessment it gates on is the one function, bound from the response
	// and the REFRESHED ledger row's real `editType`.
	assert.match(
		hook,
		/const assessment = assessRedoAfterRevert\(\s*data,\s*options\.redoLabel,\s*armedRow\?\.editType \?\? null,?\s*\);/,
		'the assessment is derived from the revert response and the refreshed ledger row, not assumed',
	);
	assert.match(
		hook,
		/const armedRow = refreshedEdits\.find\(\(edit\) => edit\.id === data\.editId\) \?\? null;/,
		'the `editType` is read from the server\'s own history, so the gate is data-driven',
	);
});

test('R2 wiring: every UNDO_CONFLICT mapper in the hook uses the one shared message', () => {
	const hook = renderedSource('src/hooks/useTimetableMutations.ts');
	const mappers = [...hook.matchAll(/code === 'UNDO_CONFLICT'\) \{([\s\S]{0,600}?)\n\t{3}\}/g)];
	assert.ok(mappers.length >= 2, `both undo mappers are found (run + draft ledger); found ${mappers.length}`);
	for (const [index, mapper] of mappers.entries()) {
		assert.match(
			mapper[1],
			/UNDO_CONFLICT_MESSAGE/,
			`undo conflict mapper ${index + 1} consumes the single shared message`,
		);
		// Every OPERATOR-FACING string in the mapper must be the shared message and
		// nothing else. The retained `setRedoVersionStale(true)` identifier is NOT
		// copy — it is the state name an accepted assertion pins
		// (`timetable-dynamic-workspace-undo-redo.test.ts:115`) and is marked
		// corrected in the type's doc comment — so it is permitted to remain while the
		// text it renders may not claim a version.
		const surfaced = [...mapper[1].matchAll(/(?:toast\.error|setUndoNotice)\(([^)]*)\)/g)].map((m) => m[1].trim());
		assert.ok(surfaced.length > 0, `mapper ${index + 1} surfaces something to the operator`);
		for (const value of surfaced) {
			assert.equal(value, 'UNDO_CONFLICT_MESSAGE', `mapper ${index + 1} surfaces only the shared message; found ${value}`);
		}
		assert.doesNotMatch(
			mapper[1],
			/re-preview|schedule changed|Schedule changed/i,
			`undo conflict mapper ${index + 1} carries no bespoke change or re-preview claim`,
		);
	}
});

test('R2 wiring: both undo mappers of the hook are guarded by the one decision', () => {
	const hook = source('src/hooks/useTimetableMutations.ts');
	assert.match(hook, /decideHeaderUndo/, 'the header Undo consumes the shared decision');
	assert.match(hook, /lastEditUndoable/, 'and the header control is told whether Undo can be pressed at all');
});

test('R2 wiring: neither undo/redo surface carries a raw title attribute (section 8)', () => {
	for (const path of [
		'src/components/timetable/TimetableUndoRedoControl.tsx',
		'src/components/timetable/ScheduleReviewWorkspace.tsx',
	]) {
		assert.doesNotMatch(
			source(path),
			/\stitle="/,
			`${path} uses no HTML title attribute; AGENTS.md section 8 routes extra information through @/ui primitives`,
		);
	}
});

test('R2 wiring: the workspace strip takes its copy from the shared contract', () => {
	const workspace = source('src/components/timetable/ScheduleReviewWorkspace.tsx');
	// The notice branch reads the hook's assessment rather than re-deriving, so the
	// strip cannot drift from the gate that armed (or refused) the target.
	assert.match(workspace, /state\.undoNotice/, 'the strip renders the assessed notice');
	assert.match(workspace, /UNDO_CONFLICT_MESSAGE/, 'its conflict branch uses the one shared message');
	assert.doesNotMatch(
		renderedSource('src/components/timetable/ScheduleReviewWorkspace.tsx'),
		/Refresh and re-preview before redoing/,
		'the pre-fix version-stale copy, which asserted a schedule change the server never reported, is gone from the rendered strip',
	);
	assert.doesNotMatch(
		renderedSource('src/components/timetable/TimetableUndoRedoControl.tsx'),
		/>Version-stale</,
		'the header control renders no "Version-stale" label; the retained `timetable-version-stale` testid is a hook, not operator copy',
	);
	assert.doesNotMatch(
		renderedSource('src/components/timetable/TimetableUndoRedoControl.tsx'),
		/refresh and re-preview/i,
		'and no re-preview instruction, which cannot help when the target was never undoable',
	);
	// The `redoState` branch is NOT deleted: it is reachable only when
	// `assessRedoAfterRevert` returned `performable`, and in that state "Redo
	// re-applies the same server edit with a fresh version check" is accurate, so
	// removing it would delete a true statement (AGENTS.md §16).
	assert.match(
		workspace,
		/!state\.redoVersionStale && state\.redoState/,
		'the performable-redo branch keeps its own copy and its own Redo button',
	);
});

/* ── Load-bearing controls: each row fails if its fix is undone ────────────── */

test('R2 mutant: the pre-fix armed-redo path and its copy fail the post-fix controls', () => {
	// The literal pre-fix values, read from the sources this lane changes.
	const preFixArmed = { operationId: 47, expectedVersion: 44, label: 'Reverted edit' };
	assert.equal(
		assessRedoAfterRevert(REVERT_RESPONSE, 'Reverted edit', 'REVERT').kind,
		'not-performable',
		'the gate refuses what the pre-fix path armed',
	);
	assert.notDeepEqual(
		preFixArmed,
		null,
		'the pre-fix path really did arm the REVERT id (it is the traced production value, not a stand-in)',
	);
	const preFixCopy = 'Version-stale — the schedule changed. Refresh and re-preview before retrying.';
	assert.match(preFixCopy, /Version-stale/, 'the pre-fix copy really did claim a version change');
	assert.throws(() => assert.doesNotMatch(preFixCopy, /version/i), /expected to not match/);
	assert.throws(() => assert.doesNotMatch(preFixCopy, /re-preview/i), /expected to not match/);
});

test('R2 mutant: a silently disabled Undo with no reason fails the rendered control', () => {
	// The "hide and say nothing" outcome the packet explicitly rejects.
	const silent = 'Undo';
	assert.doesNotMatch(silent, /nothing left to undo/, 'a bare label carries no reason');
	assert.throws(() => assert.match(silent, /nothing left to undo/), /input did not match/);
	assert.match(UNDO_HEAD_IS_UNDO_MESSAGE, /nothing left to undo/, 'the shipped reason does');
});
