/**
 * A2-CUSTODY — the "Change room" dialog must not crash the page, and the
 * room-feature surface must tell the truth.
 *
 * THE DEFECT (findings.md #1, live, user-facing): clicking "Change room" in the
 * timetable session dialog crashed /timetable with the router error boundary
 * and "Cannot read properties of undefined (reading 'length')". A scheduler
 * could not change a room from the dialog at all.
 *
 * ROOT CAUSE — a field the room map never carried. `useTimetableData` builds the
 * `roomMap` the panel receives, copying nine fields per room and never copying
 * `features`, which the server does send on every room. So every room in the map
 * had `features: undefined` at runtime while `ManualEditRoomInfo` declares
 * `features: string[]` as required — a type that lies about the runtime value,
 * which is why `tsc` never caught it. The crash was the read
 * `!selectedRoom?.features.length`: the `?.` short-circuits the whole chain when
 * the room is ABSENT, but not when the room is present and its `features` is
 * undefined, and the right conjunct is only evaluated when the subject has no
 * required features. That is why it read as flaky rather than broken: a subject
 * WITH required features makes `&&` short-circuit and the line never throws.
 *
 * `aa7f6f67` is exonerated: it moved the option-derivation lines verbatim and
 * touches neither `requiredFeatures` nor any `features` copy. The throw site
 * dates from `5de6a2e3b`, and `RoomInfo` already lacked the field at
 * `aa7f6f67^`.
 *
 * ASSERTION STYLE — real rendered markup from the real component via
 * `renderToStaticMarkup`, matching the neighbouring lane suites, plus
 * source-level controls for the two things markup cannot show: the map builder
 * that dropped the field, and the "no unguarded read survives" invariant. Every
 * control that asserts on a source pattern carries a recorded pre-fix fixture,
 * so it cannot pass vacuously.
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import test from 'node:test';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

import ManualEditPanel from '../../ManualEditPanel';
import { useManualEditOptionGroups } from '../../manual-edit/useManualEditOptionGroups';
import type { ManualEditRoomInfo } from '../../manual-edit/manual-edit-foundation';
import type { FacultyMirror, ScheduledEntry, Subject } from '../../../types';

const clientRoot = resolve(import.meta.dirname, '../../../..');
function source(path: string): string {
	return readFileSync(resolve(clientRoot, path), 'utf8');
}

const ENTRY = {
	entryId: 'e-1',
	day: 'MONDAY',
	startTime: '07:30',
	endTime: '08:15',
	roomId: 1,
	facultyId: 9,
	subjectId: 6,
	sectionId: 701,
	durationMinutes: 45,
	programKind: 'SHARED_CLASS',
} as unknown as ScheduledEntry;

/**
 * A room reference row exactly as the room map built it before this fix: the
 * nine copied fields, and NO `features` key at all. The cast is the point — the
 * declared type claims `features: string[]`, and the runtime value had no such
 * key, so a fixture typed honestly could not express the bug.
 */
function roomWithoutFeatures(id: number, name: string, buildingId = 2): ManualEditRoomInfo {
	return {
		id,
		name,
		buildingId,
		buildingName: 'Main',
		buildingShortCode: 'MN',
		floor: 1,
		type: 'CLASSROOM',
		isTeachingSpace: true,
	} as unknown as ManualEditRoomInfo;
}

function roomWithFeatures(id: number, name: string, features: string[]): ManualEditRoomInfo {
	return { ...roomWithoutFeatures(id, name), features };
}

function subjectWith(requiredFeatures: string[]): Subject {
	return { id: 6, name: 'MAPEH', requiredFeatures } as unknown as Subject;
}

function renderChangeRoom(opts: {
	subject: Subject;
	room: ManualEditRoomInfo;
}): string {
	return renderToStaticMarkup(
		createElement(ManualEditPanel, {
			entry: ENTRY,
			violationIndex: new Map(),
			followUps: new Set(),
			onToggleFollowUp: () => {},
			onClose: () => {},
			subjectLabel: () => 'MAPEH',
			facultyLabel: () => 'Dela Cruz, P.',
			sectionLabel: () => '7AW',
			gradeForSection: () => 7,
			roomLabel: () => 'Room 201',
			isStaleRoom: () => false,
			timeSlots: [{ startTime: '07:30', endTime: '08:15' }],
			roomMap: new Map([[opts.room.id, opts.room]]),
			facultyMap: new Map<number, FacultyMirror>(),
			subjectMap: new Map([[opts.subject.id, opts.subject]]),
			draftEntries: [],
			onPreview: async () => null,
			onCommit: async () => true,
			previewLoading: false,
			commitLoading: false,
			initialAction: 'CHANGE_ROOM',
			onForceOpen: () => {},
		} as never),
	);
}

// --- the crash itself ---

test('A2-CUSTODY: a room row with no features key must not crash the Change room form', () => {
	// The exact repro shape: a subject with no required features (live subject 6,
	// MAPEH) and the room the map actually built. Before the fix this threw
	// "Cannot read properties of undefined (reading 'length')" out of the
	// feature-check IIFE, which the router error boundary turned into a dead
	// /timetable.
	const markup = renderChangeRoom({
		subject: subjectWith([]),
		room: roomWithoutFeatures(1, '201'),
	});
	// The form rendered: the room action and its target-room field are present.
	assert.match(markup, /Target Room/, 'the Change room form must render its target-room field');
	// The subject requires nothing and the room provides nothing, so the
	// requirement-vs-capability block is correctly suppressed — but the render
	// completed rather than throwing.
	assert.doesNotMatch(markup, /Requirement vs capability/);
});

test('A2-CUSTODY: an absent requiredFeatures on the subject must not crash the form either', () => {
	// The other half of the same invariant: the field is declared required, so a
	// subject row from an older payload carrying no key must also survive.
	const subject = { id: 6, name: 'MAPEH' } as unknown as Subject;
	const markup = renderChangeRoom({ subject, room: roomWithoutFeatures(1, '201') });
	assert.match(markup, /Target Room/);
	assert.doesNotMatch(markup, /Requirement vs capability/);
});

test('A2-CUSTODY: a subject WITH required features against a featureless room still renders', () => {
	// The short-circuit case that hid the defect: a non-empty `requiredFeatures`
	// makes the left conjunct false, so the pre-fix `&&` never evaluated the
	// right side. Asserted so that case stays covered on both sides.
	const markup = renderChangeRoom({
		subject: subjectWith(['FUME_HOOD']),
		room: roomWithoutFeatures(1, '201'),
	});
	assert.match(markup, /Requirement vs capability/);
	// The room provides nothing, so the shortfall is reported in full.
	assert.match(markup, /Lacks: FUME_HOOD/);
});

// --- the honest warning, now that the data flows ---

test('A2-CUSTODY: the Lacks warning names the feature the selected room actually lacks', () => {
	const markup = renderChangeRoom({
		subject: subjectWith(['FUME_HOOD', 'ICT-LAB']),
		room: roomWithFeatures(1, '201', ['PROJECTOR']),
	});
	assert.match(markup, /Lacks:/);
	assert.match(markup, /FUME_HOOD/, 'the missing feature must be named');
	assert.match(markup, /ICT-LAB/, 'every missing feature must be named');
	// The room's own real feature is shown as provided, proving the room value
	// reached the surface rather than being defaulted away.
	assert.match(markup, /PROJECTOR/);
	// A feature the room does provide is not reported as lacking.
	assert.doesNotMatch(markup, /Lacks:[^<]*PROJECTOR/);
});

test('A2-CUSTODY: a room that provides the required feature shows no Lacks warning', () => {
	const markup = renderChangeRoom({
		subject: subjectWith(['FUME_HOOD']),
		room: roomWithFeatures(1, '201', ['FUME_HOOD']),
	});
	assert.match(markup, /Requirement vs capability/);
	assert.match(markup, /FUME_HOOD/);
	assert.doesNotMatch(markup, /Lacks:/, 'a room with the required feature is not lacking it');
});

test('A2-CUSTODY: a room declaring the feature only as null is treated as lacking it, not as a crash', () => {
	// `features: null` is the shape a JSON reference row can carry. The server
	// does not send it today; a control that crashes on it would be latent.
	const room = { ...roomWithFeatures(1, '201', []), features: null } as unknown as ManualEditRoomInfo;
	const markup = renderChangeRoom({ subject: subjectWith(['FUME_HOOD']), room });
	assert.match(markup, /Lacks: FUME_HOOD/, 'a null features list is an empty list, not a crash');
});

// --- the derivation receives the room's real features ---

/**
 * Probe that runs the real `useManualEditOptionGroups` and serialises the
 * derived room groups. `SearchableSelect` ignores `subLabel` and `disabled` —
 * a gap documented in that module's own header and explicitly out of scope here
 * — so the derivation is asserted at its source rather than through a dropdown
 * that would not display it.
 */
function deriveRoomGroups(rooms: ManualEditRoomInfo[], requiredFeatures: string[]): string {
	function Probe(): ReturnType<typeof createElement> {
		const { roomSearchGroups } = useManualEditOptionGroups({
			roomMap: new Map(rooms.map((r) => [r.id, r])),
			facultyMap: new Map<number, FacultyMirror>(),
			subjectMap: new Map([[6, subjectWith(requiredFeatures)]]),
			draftEntries: [],
			subjectId: 6,
		});
		return createElement('pre', null, JSON.stringify(roomSearchGroups));
	}
	const markup = renderToStaticMarkup(createElement(Probe));
	return markup.replace(/^<pre>|<\/pre>$/g, '').replace(/&quot;/g, '"').replace(/&amp;/g, '&');
}

test('A2-CUSTODY: the option derivation receives the room\'s real features', () => {
	const groups = JSON.parse(
		deriveRoomGroups(
			[roomWithFeatures(1, '201', ['FUME_HOOD']), roomWithFeatures(2, '202', ['PROJECTOR'])],
			['FUME_HOOD'],
		),
	) as Array<{ items: Array<{ value: string; subLabel?: string; disabled?: boolean }> }>;
	const byValue = new Map(groups.flatMap((g) => g.items).map((i) => [i.value, i]));
	// The capable room: compatible, and its features are reported.
	assert.equal(byValue.get('1')?.disabled, false, 'a room with the required feature is compatible');
	assert.match(byValue.get('1')?.subLabel ?? '', /Features: FUME_HOOD/);
	// The incapable room: incompatible, and the shortfall is named.
	assert.equal(byValue.get('2')?.disabled, true, 'a room without the required feature is incompatible');
	assert.match(byValue.get('2')?.subLabel ?? '', /Lacks: FUME_HOOD/);
});

test('A2-CUSTODY: the derivation already fails closed on an absent features key — the defect was the map builder', () => {
	// A scope control, and it passes on the BASE revision too. The hook guards
	// its read with `(r.features || [])`, so it correctly treated an absent key
	// as an empty list. The silent half of the defect was upstream: because the
	// builder never set the key, that correct empty-list read made EVERY room
	// look feature-compatible. Asserted so the fix is not miscredited to this
	// hook, and so a future edit that drops the guard here is caught.
	const groups = JSON.parse(deriveRoomGroups([roomWithoutFeatures(1, '201')], ['FUME_HOOD'])) as Array<{
		items: Array<{ value: string; subLabel?: string; disabled?: boolean }>;
	}>;
	const option = groups.flatMap((g) => g.items).find((i) => i.value === '1');
	assert.equal(option?.disabled, true, 'an absent features key must not read as full compatibility');
	assert.match(option?.subLabel ?? '', /Lacks: FUME_HOOD/);
});

// --- the root cause: the field the map never copied ---

test('A2-CUSTODY: the room map builder copies features, with a guard for an older row shape', () => {
	const data = source('src/hooks/useTimetableData.ts');
	// The declared element type carries the field, so a future read of
	// `room.features` is type-checked rather than silently `any`.
	assert.match(data, /type RoomInfo = \{[\s\S]*?\bisTeachingSpace: boolean;[\s\S]*?\bfeatures: string\[\];[\s\S]*?\};/);
	// The builder copies it, guarded, so a reference row from an older shape
	// cannot crash a control downstream.
	const builder = data.slice(data.indexOf('const enrichedRooms'));
	assert.match(builder, /features: room\.features \?\? \[\],/);
	// The guard is load-bearing: a bare copy would be the un-defended form.
	assert.doesNotMatch(builder, /features: room\.features,(?!\s*\?\?)/);
});

// --- the invariant: no unguarded read survives ---

/** The pre-fix read, verbatim from the base revision of `ManualEditPanel.tsx`. */
const PRE_FIX_READ = 'if (!subject || (subject.requiredFeatures.length === 0 && !selectedRoom?.features.length)) return null;';

/**
 * The control's subject is CODE, not prose: both consumers are expected to
 * document this defect in comments, and a control that fires on a comment
 * quoting the old line is brittle rather than strict.
 *
 * Two details make the scan trustworthy rather than merely green. Line endings
 * are normalised first, because a `.` in a JS regex does not match `\r`, so a
 * `//`-strip anchored at `$` silently no-ops on a CRLF file. And a block comment
 * is blanked to an equal number of newlines instead of deleted, so the reported
 * line numbers still point at the real source. A line comment is dropped from
 * its `//` only when that `//` starts the line or follows whitespace, so a `//`
 * inside a string literal (`https://…`) is left alone.
 */
function codeLines(text: string): string[] {
	return text
		.replace(/\r\n/g, '\n')
		.replace(/\/\*[\s\S]*?\*\//g, (block) => block.replace(/[^\n]/g, ' '))
		.split('\n')
		.map((line) => line.replace(/(^|\s)\/\/.*$/, '$1'));
}

test('A2-CUSTODY: no read of either optional field is left unguarded in the two consumers', () => {
	// The invariant, not a line list: a member-access-then-`length` chain on
	// `features` or `requiredFeatures` is exactly the shape that threw. Both
	// consumers normalise the two fields into locals once, so no such chain may
	// remain.
	for (const path of [
		'src/components/ManualEditPanel.tsx',
		'src/components/manual-edit/useManualEditOptionGroups.ts',
	]) {
		const offenders = codeLines(source(path))
			.map((line, i) => ({ line: i + 1, text: line }))
			.filter(({ text: line }) => /\.(?:features|requiredFeatures)\.length/.test(line));
		assert.deepEqual(
			offenders.map((o) => `${o.line}: ${o.text.trim()}`),
			[],
			`${path} must not read .features.length or .requiredFeatures.length off an object`,
		);
	}
});

test('A2-CUSTODY: the unguarded-read control discriminates — the pre-fix line fails it', () => {
	// Without this the control above could pass on a regex that matches nothing.
	const offending = (line: string): boolean => /\.(?:features|requiredFeatures)\.length/.test(line);
	assert.equal(offending(PRE_FIX_READ), true, 'the pre-fix read must be caught by the control');
	// Both halves independently, so neither `?.` nor the `&&` hides a regression.
	assert.equal(offending('subject.requiredFeatures.length === 0'), true);
	assert.equal(offending('!selectedRoom?.features.length'), true);
	// The post-fix normalisation is not caught.
	assert.equal(offending('const roomFeatures = selectedRoom?.features ?? [];'), false);
	assert.equal(offending('roomFeatures.length === 0'), false);

	// `codeLines` must not pass the control by over-stripping. A synthetic
	// CRLF source with the read on a real code line, the same read quoted in
	// comments, and a URL string is scanned: exactly the code line is reported,
	// and the line number survives comment blanking.
	const synthetic = [
		'/* header mentioning selectedRoom?.features.length */',
		'const url = "https://example.test/a";',
		'\t// comment: !selectedRoom?.features.length',
		'\tconst n = !selectedRoom?.features.length;',
		'',
	].join('\r\n');
	const code = codeLines(synthetic);
	assert.equal(code.length, 5, 'line blanking must preserve line numbering');
	const flagged = code
		.map((line, i) => ({ line: i + 1, text: line }))
		.filter(({ text: line }) => offending(line));
	assert.deepEqual(flagged.map((f) => f.line), [4], 'only the code line is flagged, at its real number');
	assert.match(flagged[0].text, /const n =/, 'the reported line is the code, not the comment');
});

test('A2-CUSTODY: the panel normalises both fields once, before any read', () => {
	const panel = source('src/components/ManualEditPanel.tsx');
	assert.match(panel, /const requiredFeatures = subject\?\.requiredFeatures \?\? \[\];/);
	assert.match(panel, /const roomFeatures = selectedRoom\?\.features \?\? \[\];/);
	// The suppression condition keeps its exact meaning: hide the block when
	// there is neither a requirement nor a capability to compare against.
	assert.match(
		panel,
		/if \(!subject \|\| \(requiredFeatures\.length === 0 && roomFeatures\.length === 0\)\) return null;/,
	);
});

test('A2-CUSTODY: the room option derivation keeps its fail-closed guards', () => {
	const hook = source('src/components/manual-edit/useManualEditOptionGroups.ts');
	// Already guarded before this change and asserted here so a later edit that
	// tightens one of the three cannot drop the other two.
	assert.match(hook, /const required = subject\?\.requiredFeatures \|\| \[\];/);
	assert.match(hook, /required\.filter\(\(f: string\) => !\(r\.features \|\| \[\]\)\.includes\(f\)\)/);
	// The KNOWN GAP is unchanged and still stated: this candidate restores the
	// data, it does not wire SearchableSelect or disable any room.
	assert.match(hook, /KNOWN GAP/);
	assert.match(hook, /does not consume either/);
});
