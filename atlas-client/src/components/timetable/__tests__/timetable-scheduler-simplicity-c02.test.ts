import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { QueryClient } from '@tanstack/react-query';

import { buildSectionLabel } from '@/lib/timetable-reference-labels';
import { requiresFacultyIssueConfirmation, resolveTimetableEntryPivot } from '@/lib/timetable-entry-pivot';
import { timetableRunBundleQueryKey, timetableRunsQueryKey, timetableReferenceQueryKey, timetableRoomRequestQueryKey } from '@/lib/timetable-data/timetableQueryKeys';
import { CENTER_PANE_OWNER, assertCenterPaneOwnerIsRendered, centerPaneSource } from './centerPaneOwner';

const clientRoot = fileURLToPath(new URL('../../../..', import.meta.url));
const source = (path: string) => readFileSync(`${clientRoot}/${path}`, 'utf8');

test('known section labels lead with the grade and retain special-program suffixes', () => {
	const label = buildSectionLabel(new Map([[7, {
		id: 7,
		name: 'A',
		gradeLevelId: 8,
		gradeLevelName: 'Grade 8',
		programType: 'STE',
		programCode: 'STE',
	} as any]]), (_type, code) => code ?? 'Special Program');
	assert.equal(label(7), 'GR8 - A · STE');
	assert.equal(label(404), 'Section #404');
});

test('mouse selection pivots only to canonical section, teacher, room, or homeroom identities', () => {
	const entry = { sectionId: 7, facultyId: 12, roomId: null } as any;
	const shared = {
		entry,
		sections: new Map([[7, { homeRoomId: 41 }]]),
		facultyIds: new Set([12]),
		roomIds: new Set([41]),
	};
	assert.deepEqual(resolveTimetableEntryPivot({ ...shared, viewMode: 'section' }), { entityId: 7, guidance: null });
	assert.deepEqual(resolveTimetableEntryPivot({ ...shared, viewMode: 'faculty' }), { entityId: 12, guidance: null });
	assert.deepEqual(resolveTimetableEntryPivot({ ...shared, viewMode: 'room' }), { entityId: 41, guidance: null });
	assert.deepEqual(resolveTimetableEntryPivot({
		...shared,
		viewMode: 'room',
		entry: { ...entry, roomId: 99 },
	}), { entityId: 41, guidance: null }, 'configured homeroom wins over an assigned room');
	assert.equal(resolveTimetableEntryPivot({ ...shared, viewMode: 'faculty', entry: { ...entry, facultyId: null } }).entityId, null);
	assert.equal(resolveTimetableEntryPivot({ ...shared, viewMode: 'room', sections: new Map(), roomIds: new Set() }).entityId, null);
});

test('scheduled and unassigned session drag starts share canonical context pivot without changing view mode', () => {
	const drag = source('src/hooks/useTimetableDragDrop.ts');
	const state = source('src/hooks/useScheduleReviewWorkspaceState.ts');
	const mutations = source('src/hooks/useTimetableMutations.ts');
	assert.match(drag, /onSessionContextPivot\?\.\(data\.entry\)/);
	assert.match(drag, /onSessionContextPivot\?\.\(\{ sectionId: item\.sectionId, facultyId: item\.facultyId \?\? null, roomId: null \}\)/);
	assert.match(state, /onSessionContextPivot:\s*handleSessionContextPivot/);
	assert.match(mutations, /const handleSessionContextPivot[\s\S]+resolveTimetableEntryPivot[\s\S]+setEntityFilter/);
	assert.doesNotMatch(mutations, /handleSessionContextPivot[\s\S]{0,500}setViewMode/);
});

test('the ordinary Simple header hides provenance while retaining actionable drift warnings', () => {
	const header = source('src/components/timetable/TimetableSimpleHeader.tsx');
	assert.doesNotMatch(header, /data-testid="timetable-simple-authority"/);
	// A2 C11 S2 (re-pin, 2026-09-28): the header no longer renders
	// `<SimpleDriftBanner>` inline. It asks the ONE shared gate
	// (`useRunChangeNotice`, `simple/SimpleHeaderChangeNoticeSlot.tsx`) for a
	// notice node and mounts what comes back, so the banner markup moved into
	// that module. The property this row protects is UNCHANGED — the ordinary
	// header still surfaces actionable drift instead of going silent — and one
	// pin cannot carry it any more, so it is now carried by the two halves that
	// can actually break it independently:
	//
	//   1. the gate MOUNTS the banner (a silent slot is a silent header), and
	//   2. the header renders the notice node it was given (a derived-but-dropped
	//      node is exactly the defect that left the Expert header saying nothing
	//      about a change it had the data for).
	//
	// Dropping either pin would let this row pass on a header that shows no drift
	// warning at all, which is the failure it exists to catch.
	const noticeSlot = source('src/components/timetable/simple/SimpleHeaderChangeNoticeSlot.tsx');
	assert.match(noticeSlot, /<SimpleDriftBanner/, 'the module the header takes its notice from renders the drift banner');
	assert.match(header, /const changeNotice = useRunChangeNotice\(/, 'the header derives the notice through that one shared gate');
	assert.match(header, /\{changeNotice\.node\}/, 'and MOUNTS the node it returns — the warning is on screen, not derived and dropped');
	// The unresolved-term notice moved with the status region into the extracted
	// strip in the same slice, so its pin moves with it. Same property, same
	// evidence: the header still says something when the term contract is not
	// verified, and provenance still stays out of it.
	assert.match(source('src/components/timetable/simple/SimpleHeaderStatusStrip.tsx'), /data-testid="timetable-term-authority-unverified"/,
		'the term-authority notice renders in the status strip the header now uses');
	// ── SUPERSEDED IN PLACE, 2026-09-29, A2 HEADER-BUDGET (operator) ──
	// The header no longer mounts `SimpleHeaderStatusStrip` at all. §8's "Header
	// budget" caps the `<header>` BOX at two calm rows, and the status strip was
	// the surface that made the box a third band, so the whole status line moved
	// out of the box to `simple/SimpleHeaderTrailingSurfaces.tsx`
	// (`SimpleHeaderStatusBand`, a SIBLING of `</header>`).
	//
	// The original assertion is retained VERBATIM as the record of the structural
	// pin that no longer describes this code; it is not run as pass/fail:
	//   assert.match(header, /<SimpleHeaderStatusStrip/, 'and the header renders that strip, so the notice is actually reachable');
	//
	// THE CLAIM THAT IS STILL LOAD-BEARING — and it is the same claim, only the
	// owner moved: the term-authority notice is still RENDERED, and it is still
	// REACHABLE from the header the route renders. A silent header about an
	// unverified term contract is the defect this row exists to catch, and it does
	// not care which module owns the markup. The replacement row below asserts it
	// on the new owner. `SimpleHeaderStatusStrip.tsx` is NOT deleted: the module
	// stays, and its `timetable-term-authority-unverified` span is still asserted
	// on the line above, so its Expert/consumer callers are still covered.
});

test('the term-authority notice is still rendered and still reachable, now from the trailing status band', () => {
	// The replacement for the superseded `<SimpleHeaderStatusStrip` mount pin in
	// the row above. Same property, re-pinned to the surface that now owns it.
	//
	// DISCRIMINATION, stated rather than assumed: this row names the NEW owner by
	// path, so if the notice were moved to a third module — or the header stopped
	// rendering the surface that carries it — the first two assertions fail rather
	// than passing by reading an empty string. That is the failure mode the
	// original pin was written to catch, and it is preserved here.
	const header = source('src/components/timetable/TimetableSimpleHeader.tsx');
	const band = source('src/components/timetable/simple/SimpleHeaderTrailingSurfaces.tsx');
	assert.match(band, /data-testid="timetable-term-authority-unverified"/,
		'the term-authority notice renders in the trailing status band the header now uses');
	assert.match(header, /<SimpleHeaderTrailingSurfaces/,
		'and the header renders that surface, so the notice is actually reachable');
	// The value is threaded, not invented: the header computes the ONE notice and
	// hands it over, so a derived-but-dropped notice still fails here.
	assert.match(header, /termAuthorityNotice=/, 'the header hands the band the notice it computed');
	assert.match(header, /termAuthorityNotice=\{termAuthorityNotice\}/, 'and it is the same value, not a re-derivation');
	// `SimpleTermScopeLine` renders the same testid for the term SCOPE line, which
	// the Expert orientation row still uses. It is a second reachable surface, so
	// dropping the band without keeping that path would silently silence the
	// notice; this assertion keeps the second owner accounted for.
	assert.match(source('src/components/timetable/simple/SimpleTermScopeLine.tsx'), /data-testid="timetable-term-authority-unverified"/,
		'the term-scope line still renders the same notice for the Expert orientation row');
});

test('user-facing layout entry points use Expert while the stored layout key stays stable', () => {
	const workspace = source('src/components/timetable/ScheduleReviewWorkspace.tsx');
	const menu = source('src/components/timetable/simple/SimpleMoreMenuContent.tsx');
	assert.match(menu, /Expert view/);
	assert.match(workspace, /Expert details/);
	assert.match(menu, /Advanced rules/);
	assert.match(workspace, /localStorage\.getItem\('atlas_timetable_layout_mode'\).*advanced/s);
	assert.doesNotMatch(source('src/components/timetable/simple/SimpleHeaderHelpers.tsx'), /Advanced view/);
});

test('ordinary schedule chrome does not expose implementation provenance', () => {
	const files = [
		'src/components/timetable/TimetableSimpleHeader.tsx',
		'src/components/timetable/ScheduleReviewWorkspace.tsx',
		'src/components/timetable/InlinePlacementPreview.tsx',
	].map((path) => source(path)).join('\n');
	assert.equal(/source[- ]revision|fingerprint/i.test(files), false, 'routine placement copy must not name internal freshness tokens');
	const repairCopy = source('src/components/timetable/TacticalSandboxDock.parts.tsx');
	assert.equal(/Server fingerprint issued|issues the fingerprint that apply requires/i.test(repairCopy), false, 'repair preview copy must describe the user action');
});

test('entering a timetable preserves the desktop sidebar preference', () => {
	const appShell = source('src/components/AppShell.tsx');
	assert.doesNotMatch(appShell, /if \(isTimetableRoute && !wasTimetableRoute\) setSidebarOpen\(false\)/);
	assert.match(appShell, /isMobile/);
});

test('ordinary schedule repair keeps issue summary separate from technical detail', () => {
	const issues = source('src/components/timetable/TimetableShared.tsx');
	assert.match(issues, /groupSummary/);
	assert.match(issues, />Details</);
	assert.match(issues, /z-\[?(?:[4-9]\d|\d{3,})/);
	assert.equal(/decoration-dashed|decoration-dotted/.test(issues), false, 'issue copy must not use dotted or dashed word underlines');
});

test('cross-faculty issue selection asks before changing teacher and confirm selects the affected session', () => {
	const mutations = source('src/hooks/useTimetableMutations.ts');
	const workspace = source('src/components/timetable/ScheduleReviewWorkspace.tsx');
	const confirmation = source('src/components/timetable/TimetableFacultyIssuePivotDialog.tsx');
	assert.match(mutations, /canonicalFaculty[\s\S]+setPendingFacultyIssuePivot/);
	assert.match(mutations, /requiresFacultyIssueConfirmation\(/);
	assert.equal(requiresFacultyIssueConfirmation({ viewMode: 'section', entityFilter: '7', facultyId: 12, canonicalFacultyExists: true }), true);
	assert.equal(requiresFacultyIssueConfirmation({ viewMode: 'room', entityFilter: '41', facultyId: 12, canonicalFacultyExists: true }), true);
	assert.equal(requiresFacultyIssueConfirmation({ viewMode: 'faculty', entityFilter: '12', facultyId: 12, canonicalFacultyExists: true }), false);
	assert.equal(requiresFacultyIssueConfirmation({ viewMode: 'faculty', entityFilter: '9', facultyId: 12, canonicalFacultyExists: true }), true);
	assert.equal(requiresFacultyIssueConfirmation({ viewMode: 'section', entityFilter: '7', facultyId: 12, canonicalFacultyExists: false }), false);
	assert.match(workspace, /<TimetableFacultyIssuePivotDialog/);
	assert.match(confirmation, /Open \{teacherLabel\}&apos;s timetable\?/);
	assert.match(confirmation, /onCancel\}>Cancel/);
	assert.match(confirmation, /onConfirm\}>Open teacher timetable/);
	assert.match(source('src/hooks/useScheduleReviewWorkspaceState.ts'), /setSelectedViolation\(pending\.violation\)[\s\S]+setSelectedEntry\(pending\.entry\)/);
});

test('published return is visible and restores run, term, view, and entity after draft planning', () => {
	const header = source('src/components/timetable/ScheduleReviewWorkspaceHeader.tsx');
	const state = source('src/hooks/useScheduleReviewWorkspaceState.ts');
	assert.match(header, /Return to published schedule/);
	assert.match(state, /usePublishedTimetableReturnState\(/,
		'the workspace tracks a return target from route state as well as the Draft button callback');
	assert.match(state, /publishedReturnState\.capture\('schedule'\)/,
		'the in-app Draft action snapshots the current published context before changing view');
	assert.match(state, /restorePublishedTimetableContext\(publishedReturnState\.snapshot/,
		'the return action restores the saved published run, term, view, and entity');
	assert.match(source('src/lib/timetable-published-return.ts'), /setRunId\(snapshot\.runId\)[\s\S]+setTermFilter\(snapshot\.termFilter\)[\s\S]+setViewMode\(snapshot\.viewMode\)[\s\S]+setEntityFilter\(snapshot\.entityFilter\)/,
		'the shared production restore helper reapplies every captured published context field');
	assert.match(state, /publishedReturnState\.clear\(\)[\s\S]+navigate\('\/timetable'\)/,
		'after restore, the mouse action returns to the published timetable route');
});

test('draft tray switch review is inline with one Confirm action', () => {
	const dialogs = source('src/components/timetable/modals/TimetablePlacementDialogs.tsx');
	assert.match(dialogs, /data-testid="draft-swap-inline-preview"/);
	// C11 M4 (F3) — the blocked verdict and its ONE Confirm moved verbatim into
	// `DraftSwapReviewVerdict.tsx`, because the blocked review stated only a count
	// and left the disabled control with no visible reason. The property decided
	// here is UNCHANGED: the switch review is still inline, and still has exactly
	// ONE Confirm action. What moved is which module owns the label, so the row now
	// pins BOTH halves — the dialog renders the extracted verdict, and the verdict
	// still carries the single Confirm control.
	assert.match(dialogs, /<DraftSwapReviewVerdict/,
		'the inline preview renders the extracted blocked-review verdict');
	assert.doesNotMatch(dialogs, /<Button[^>]*>\s*Confirm switch|Confirm switch<\/Button>/,
		'and no SECOND Confirm control is left inline in the dialog');
	const verdict = source('src/components/timetable/DraftSwapReviewVerdict.tsx');
	assert.match(verdict, /data-testid="draft-swap-commit"/, 'the verdict owns the single Confirm control');
	assert.match(verdict, /Confirm switch/, 'which is still labelled "Confirm switch"');
	assert.equal((verdict.match(/data-testid="draft-swap-commit"/g) ?? []).length, 1, 'exactly one');
	assert.doesNotMatch(dialogs, /draft-swap-review-dialog/);
});

test('Teaching Load dock retains all three deliberate mount states', () => {
	const center = source('src/components/timetable/CenterWorkspace.tsx');
	assert.match(center, /tacticalSandboxOpen\s*\|\|\s*sandboxFacultyByEntryId\.size > 0\s*\|\|\s*\(centerView === 'schedule' && selectedUnassigned !== null\)/);
	assert.match(center, /<TacticalSandboxDock\s+open=\{tacticalSandboxOpen\}/);
	assert.match(center, /onOpenChange=\{handleTacticalSandboxOpenChange\}/);
});

test('nested timetable pages keep focused routes without duplicating scheduler chrome', () => {
	// C11 slice 1 (F4) — the centre-pane chain moved to
	// `CenterWorkspacePaneSurface.tsx` (the AGENTS.md §8 cap, plus F4's
	// requirement for a rendered row on the real surface). The property decided
	// here is UNCHANGED and nothing was removed or weakened; only the owning
	// module is read now, and `assertCenterPaneOwnerIsRendered()` pins the new
	// owner to the one CenterWorkspace actually renders.
	assertCenterPaneOwnerIsRendered();
	const workspace = source('src/components/timetable/ScheduleReviewWorkspace.tsx');
	const center = centerPaneSource(CENTER_PANE_OWNER);
	assert.match(workspace, /const showSchedulerChrome = isTimetableSchedulerView\(state\.headerContext\.centerView\)/);
	// C11 M1 — the routed sub-page arms are now keyed off `paneView`, the RESOLVED
	// view from `resolveCenterPane`, not the raw `centerView` state. The assertion
	// is updated rather than dropped (AGENTS.md §16: evidence is additive, never
	// subtractive) and it is now STRONGER: it pins both the three routed arms AND
	// that the chain consumes the decision, so a future change cannot quietly go
	// back to keying off the lagging state that caused the stale-panel defect.
	assert.match(center, /paneView === 'setup'|paneView === 'policy'|paneView === 'runs'/);
	// SUPERSEDED, and REPLACED immediately below — not dropped (AGENTS.md §16). The
	// candidate took a TWO-argument decision; the F1 correction added the third
	// argument that gates the route override to the one-render lag window, because
	// the two-argument form fired on every in-app entry and made Manual edit, Change
	// room and the M2 room picker unreachable from /timetable. The superseded shape
	// is now asserted ABSENT so it can never come back silently, and the corrected
	// shape is asserted PRESENT — strictly stronger than the single assertion this
	// replaces.
	assert.equal(
		/const centerPane = resolveCenterPane\(pathname, centerView\);/.test(center),
		false,
		'the two-argument centre-pane decision is superseded and must not return',
	);
	assert.match(center, /const centerPane = resolveCenterPane\(pathname, centerView, routeAppliedPathname\);/);
	assert.match(center, /const paneView = centerPane\.kind === 'center-view' \? centerPane\.view : centerView;/);
	assert.match(center, /\{centerPane\.kind === 'pending-map-intent' \? \(/);
	assert.match(workspace, /h-\[calc\(100svh-3\.5rem\)\]/);
	assert.match(center, /min-h-0 overflow-auto|flex-1 min-h-0/);
});

test('timetable route updates keep mounted-grid state and skip broad reload on term changes', () => {
	const header = source('src/components/timetable/TimetableSimpleHeader.tsx');
	const data = source('src/hooks/useTimetableData.ts');
	assert.match(header, /<SimpleTermSwitcher context=\{context\}/);
	assert.match(data, /queryKey: timetableRunBundleQueryKey\(currentScope\)/);
	assert.match(data, /placeholderData: keepPreviousData/);
	assert.match(data, /Normal term navigation is served by the term-scoped run-bundle query/);
	assert.match(data, /if \(!gateBlockedRef\.current && fallbackTermIndex == null && fallbackTermRef\.current == null\) return;/);
});

test('warm term return and remount reuse the scoped bundle without broad reads', async () => {
	const client = new QueryClient({ defaultOptions: { queries: { staleTime: 60_000, gcTime: 60_000 } } });
	const requests = new Map<number, number>();
	const fetchTermBundle = (termIndex: number) => {
		const scope = { schoolId: 5, schoolYearId: 9, runId: 'run-12', termIndex };
		return client.fetchQuery({
			queryKey: timetableRunBundleQueryKey(scope),
			queryFn: async () => {
				requests.set(termIndex, (requests.get(termIndex) ?? 0) + 1);
				return { termIndex };
			},
		});
	};
	try {
		await fetchTermBundle(1);
		await fetchTermBundle(2);
		await fetchTermBundle(1);
		await fetchTermBundle(1); // same scoped client after route remount
		assert.deepEqual([...requests.entries()].sort(), [[1, 1], [2, 1]]);
		const scope = { schoolId: 5, schoolYearId: 9, runId: 'run-12', termIndex: 1 };
		assert.deepEqual(timetableRunsQueryKey(scope), timetableRunsQueryKey({ ...scope, termIndex: 2 }));
		assert.deepEqual(timetableReferenceQueryKey(scope), timetableReferenceQueryKey({ ...scope, termIndex: 2 }));
		assert.deepEqual(timetableRoomRequestQueryKey(scope, 'ALL', 'ALL'), timetableRoomRequestQueryKey({ ...scope, termIndex: 2 }, 'ALL', 'ALL'));
	} finally {
		client.clear();
	}
});
