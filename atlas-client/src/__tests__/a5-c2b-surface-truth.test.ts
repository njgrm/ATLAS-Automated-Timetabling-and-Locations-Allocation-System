/**
 * A5-C2B / SLICE B — the four surfaces of `docs/reviews/codex-demo-walk-20260928`.
 *
 * WHAT THESE ROWS ARE, PRECISELY. jsdom rows for a LIVE-READ render, not for
 * layout. They exist to pin the COPY and the DATA SHAPE; the two rows that
 * genuinely need geometry (the clipped Subjects action, and the notification
 * popover's hard clip) are in the Playwright spec, because a source-text or
 * class-name assertion cannot see a real defect — the A5-C2A lesson is that a
 * row passed while the rendered page still showed the defect.
 *
 * EVERY ROW DISCRIMINATES. Each says in its header which assertion fails on the
 * base commit (`2cb6f2f2`), so a reviewer can run the same file against base
 * and watch it go red rather than take the claim on trust.
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

/* eslint-disable @typescript-eslint/no-explicit-any */
import {
	containsRawIdentifier,
	notificationRead,
} from '../lib/notification-presentation';
import {
	hasNamedOwnerDepartments,
	ownerDepartmentPhrase,
	ownerDepartmentRead,
	splitSubjectFeatures,
	subjectFeatureHelp,
} from '../components/subjects/subject-feature-presentation';

/**
 * The report's own words, quoted. These are the source of every expectation
 * below, and a row that cannot be traced to one of these is out of scope.
 */
const REPORT = {
	audit: "81 readiness blockers must be fixed before scheduling review is reliable",
	auditFix: "Explain the scope/date of the audit versus the published schedule",
	load: "Average roster load: 56.6% has no target, meaning, or decision attached",
	notification: "raw operations/IDs (MOVE_ENT..., entry-321::t2) and long notices are clipped",
	subjects: "Room needs expose stored values such as OWNER_DEPT:AP and OWNER_DEPT:MAPEH; the page admits it has no plain name",
};

/**
 * Read a source file with ALL whitespace runs collapsed to a single space.
 *
 * Without this every assertion below is a bet on the author's indentation: a
 * JSX sentence that wraps at column 100 stops matching a regex written against
 * the same sentence on one line, and the row then fails (or, worse, passes for
 * an unrelated reason). Collapsing first makes each expectation a statement
 * about the COPY rather than about the formatting.
 */
function readFile(path: string): string {
	// Resolved relative to this file, so the row needs no CWD plumbing.
	return readFileSync(new URL(path, import.meta.url), 'utf8').replace(/\s+/g, ' ');
}

// ───────────────────────────── item 4 — Audit copy ────────────────────────────

/**
 * DISCRIMINATES: on base the verdict sentence is the report's own quoted string
 * verbatim, so this assertion fails on base.
 */
test('A5-C2B-4a: the audit verdict no longer claims the published schedule is unreliable', async () => {
	const source = readFile('../pages/Audit.tsx');
	assert.doesNotMatch(
		source,
		/must be fixed before scheduling review is reliable/,
		`the report quoted the verdict as "${REPORT.audit}", which is the contradiction; it is still in Audit.tsx`,
	);
	// The replacement must still COUNT the blockers — the report asks to say
	// what they are or scope the number, NOT to delete the number.
	assert.match(
		source,
		/in the setup records/,
		'the blocker count was removed instead of scoped',
	);
	// And it must keep the all-clear branch, or a clean report would be silent.
	assert.match(source, /No readiness blockers were found in the loaded evidence\./);
});

/**
 * DISCRIMINATES: neither `audit-blocker-scope` nor `audit-roster-load-verdict`
 * exists on base.
 */
test('A5-C2B-4b: the audit names the scope and the date of the blocker count', async () => {
	const source = readFile('../pages/Audit.tsx');
	assert.match(source, /data-testid="audit-blocker-scope"/, 'the blocker scope/date statement is missing');
	assert.ok(
		/stamp|evidenceReadAt|read \$\{evidenceReadAtLabel\}/.test(source) && source.includes('setEvidenceReadAt'),
		'the scope statement promises a date but nothing records when the evidence was read',
	);
	assert.match(
		source,
		/They are not findings about a published schedule/,
		'the report asked for the audit to be distinguished from the published schedule; that sentence is the point',
	);
});

/**
 * DISCRIMINATES: on base the roster-load tile is a bare `avgLoad.toFixed(1)}%`
 * with no target and no decision. Both must appear.
 */
test('A5-C2B-4c: average roster load carries its target, its denominator and a decision', async () => {
	const source = readFile('../pages/Audit.tsx');
	assert.match(source, /data-testid="audit-roster-load-verdict"/, 'the roster-load verdict is missing');
	assert.match(
		source,
		/of each teacher's maximum weekly hours/,
		`the report said ${REPORT.load} — without a denominator the percentage has no meaning`,
	);
	assert.match(source, /Target is \{ROSTER_LOAD_STANDARD_PERCENT\}% \(30 hours against a 40-hour maximum\)/);
	// A decision, not just a number: the grade must map to a next step.
	assert.match(source, /rosterLoadVerdict\.needsAction/);
	assert.match(source, /rosterLoadVerdict\.hint/);
	assert.match(source, /Check Teaching Load\./);
	// The standard must be the repository's own, not an invented number.
	assert.match(source, /const ROSTER_LOAD_STANDARD_PERCENT = 75;/);
});

// ─────────────────────── item 5 — notification presentation ───────────────────

/**
 * DISCRIMINATES: on base there is no `notification-presentation` module, so the
 * whole file fails to load. The discriminator that matters is `5b`/`5c`, which
 * are about the VALUES.
 */
test('A5-C2B-5a: the two stored shapes the report named are detected as raw identifiers', () => {
	assert.equal(containsRawIdentifier('MOVE_ENTRY'), true, 'the ALL-CAPS edit-type enum is not detected');
	// The report's own rendering was CSS-truncated to `MOVE_ENT...`; the
	// underscore is still present, so the truncated form must also be caught.
	assert.equal(containsRawIdentifier('MOVE_ENT...'), true, 'the truncated form the operator actually saw is not detected');
	assert.equal(containsRawIdentifier('entry-321::t2'), true, 'the raw entry id is not detected');
	assert.equal(containsRawIdentifier('entry-321'), true);
	// PROSE MUST NOT FIRE. This is the load-bearing negative control: a
	// detector that flags ordinary sentences is worse than no detector.
	for (const prose of [
		'Teacher submitted a room request for review.',
		'Earth Science · Bonifacio · Mon 07:30-08:30',
		'GR7 and SCI10 are scheduled today',
		'Araling Panlipunan department',
		'',
	]) {
		assert.equal(containsRawIdentifier(prose), false, `a readable sentence was flagged as a raw identifier: "${prose}"`);
	}
});

/**
 * DISCRIMINATES: this is THE row for the report's observed output. A legacy row
 * whose stored `title` IS the raw token must produce a summary that says what
 * kind of change it is and leaks no token.
 */
test('A5-C2B-5b: a legacy row whose stored title is the raw token summarises readably', () => {
	const read = notificationRead({
		type: 'TIMETABLE_EDIT_COMMITTED',
		domain: 'timetable',
		title: 'MOVE_ENTRY entry-321::t2',
		body: null,
		data: null,
	});
	assert.doesNotMatch(
		read.summary,
		/MOVE_ENTRY|entry-321|::/,
		`the operator's row still reads as a raw operation id :: "${read.summary}"`,
	);
	assert.match(read.summary, /Timetable change/);
	// And the operator is told where the rest is, rather than left guessing.
	assert.match(read.summary, /Open this notice for the recorded detail\./);
	// NOTHING IS DESTROYED: the exact stored text is still reachable.
	assert.equal(read.detail, 'MOVE_ENTRY entry-321::t2', 'the recorded detail was lost rather than demoted');
});

/**
 * DISCRIMINATES: on base the row shows `title` verbatim, so a row carrying
 * metadata renders NOTHING about the subject. This asserts the new behaviour:
 * the subject, section, room and time come from the `data` column.
 */
test('A5-C2B-5c: a row with metadata states what changed, in names', () => {
	const read = notificationRead({
		type: 'ROOM_REQUEST_SUBMITTED',
		domain: 'room-preference',
		title: 'Teacher submitted a room request for review.',
		body: null,
		data: {
			subjectCode: 'SCI10',
			sectionName: 'Bonifacio',
			facultyName: 'Santos, Miguel',
			requestedRoomName: 'Lab 3',
			day: 'MON',
			startTime: '07:30',
			endTime: '08:30',
		},
	});
	assert.equal(read.kind, 'Room request');
	assert.match(read.summary, /SCI10/);
	assert.match(read.summary, /Bonifacio/);
	assert.match(read.summary, /Santos, Miguel/);
	assert.match(read.summary, /Lab 3/);
	assert.match(read.summary, /07:30-08:30/);
	assert.doesNotMatch(read.summary, /MOVE_ENTRY|entry-\d/);
});

/**
 * The honesty control: a row with NO metadata must not invent one. And an
 * unrecognised event type degrades mechanically rather than to blank.
 */
test('A5-C2B-5d: a row with no metadata claims nothing, and an unknown type still reads', () => {
	const bare = notificationRead({ type: 'ROOM_REQUEST_SUBMITTED', domain: 'room-preference', title: null, body: null, data: null });
	assert.equal(bare.summary, 'Room request. Open this notice for the recorded detail.');
	assert.equal(bare.detail, null, 'there is no stored text, so there is nothing to expand to');

	const unknown = notificationRead({ type: 'SOME_NEW_EVENT_A2', domain: 'timetable', title: null, data: null });
	assert.equal(unknown.kind, 'Some new event a2', 'an unrecognised type should degrade to readable words, not to nothing');

	// A readable stored message with no metadata is used AS IS rather than being
	// replaced by a vaguer sentence.
	const readable = notificationRead({ type: 'ROOM_REQUEST_SUBMITTED', domain: 'room-preference', title: 'Teacher submitted a room request for review.', data: null });
	assert.equal(readable.summary, 'Teacher submitted a room request for review.');
	assert.equal(readable.detail, 'Teacher submitted a room request for review.');
});

/**
 * DISCRIMINATES: on base the row element carried `truncate` on the title and
 * `line-clamp-2` on the body — the hard clip the report described. Neither
 * class may survive on the summary.
 */
test('A5-C2B-5e: the bell stops hard-clipping a long notice and offers an expandable detail', async () => {
	const source = readFile('../components/app-shell/NotificationBell.tsx');
	assert.doesNotMatch(
		source,
		/truncate font-medium/,
		'`truncate` is the hard clip the report described ("long notices are clipped in the narrow popover")',
	);
	assert.doesNotMatch(source, /line-clamp-2/, 'the body is still clamped to two lines');
	assert.match(source, /whitespace-normal/, 'the summary must wrap instead of being clipped');
	assert.match(source, /data-testid="notification-bell-detail"/, 'there is no expandable detail view');
	assert.match(source, /data-testid="notification-bell-detail-toggle"/);
	// A `<button>` inside a `<button>` is invalid HTML whose click also
	// navigates; the row must be a container with the action on the summary.
	assert.doesNotMatch(source, /<Button[^>]*data-testid="notification-bell-item"/, 'the row is still a button containing the detail control');
	assert.match(source, /data-testid="notification-bell-open"/);
});

/**
 * The narrowest-way proof the packet asked for: the summary is built from a
 * field the response ALREADY returned, so no server change is claimed. This
 * pins that the client type declares the `data` column the Prisma row carries.
 */
test('A5-C2B-5f: the readable label is built from the data column the API already returns', async () => {
	const hook = readFile('../hooks/useNotificationInbox.ts');
	assert.match(
		hook,
		/data\?: Record<string, unknown> \| null;/,
		'the client type does not declare the Notification.data column the summary reads',
	);
	// The server route must remain untouched by this slice: it returns Prisma
	// rows unmodified, which is why no atlas-server change is claimed.
	const route = readFile('../../../atlas-server/src/routes/notification-inbox.router.ts');
	assert.match(route, /const items = await prisma\.notification\.findMany\(/);
});

// ───────────────────── item 7 — Subjects department read ──────────────────────

/**
 * DISCRIMINATES: on base `ownerDepartmentRead` does not exist. The value
 * assertion is the point: for a code the glossary cannot expand, the primary
 * read is the CODE, never the `OWNER_DEPT:` marker.
 */
test('A5-C2B-7a: the primary department read never shows the stored OWNER_DEPT marker', () => {
	// Mapped code — the plain name, as before.
	const mapped = splitSubjectFeatures(['OWNER_DEPT:AP']);
	assert.equal(ownerDepartmentRead(mapped.ownerDepartments), 'Araling Panlipunan department');

	// Unmapped code — `MAPEH` is the department's real name for a school
	// scheduler, so the code IS the readable read. The marker is a storage
	// detail and must not appear here.
	const unmapped = splitSubjectFeatures(['OWNER_DEPT:MAPEH']);
	assert.equal(
		ownerDepartmentRead(unmapped.ownerDepartments),
		'MAPEH',
		`the report quoted ${REPORT.subjects} — the marker reached the room column`,
	);
	assert.doesNotMatch(ownerDepartmentRead(unmapped.ownerDepartments), /OWNER_DEPT/);

	// A mixed list: all-or-nothing noun withholding is A3-C4-1e's contract and
	// must survive; only the marker-to-code change is new.
	const mixed = splitSubjectFeatures(['OWNER_DEPT:AP', 'OWNER_DEPT:MAPEH']);
	assert.equal(hasNamedOwnerDepartments(mixed.ownerDepartments), false);
	assert.equal(ownerDepartmentRead(mixed.ownerDepartments), 'AP, MAPEH');
	assert.doesNotMatch(ownerDepartmentRead(mixed.ownerDepartments), /OWNER_DEPT|department/i);
});

/**
 * The reachability control. A3-C4-1c requires the raw marker to remain
 * reachable in an `@/ui` affordance. Demoting it off the primary line must not
 * delete it.
 */
test('A5-C2B-7b: the stored marker stays reachable in the detail', () => {
	const unmapped = splitSubjectFeatures(['OWNER_DEPT:MAPEH']);
	const help = subjectFeatureHelp(unmapped);
	assert.match(help, /OWNER_DEPT:MAPEH/, 'the stored marker is no longer reachable anywhere');
	// The report also complained the page ADMITTED it had no plain name. The
	// old sentence was "… has no plain name for that code, so it is shown as
	// stored." — the page telling the operator there was nothing to read.
	assert.doesNotMatch(
		help,
		/no plain name/,
		'the page still admits on screen that it has nothing readable to show',
	);
	assert.match(help, /ATLAS records the owning code as OWNER_DEPT:MAPEH\./);
	// A3-C4-1e/1f: no "department" noun for an unmapped code.
	assert.doesNotMatch(help, /department/i);

	// The strict, marker-bearing phrase is still exported and still behaves as
	// A3-C4 pinned it. It is now the DETAIL, not the primary read.
	assert.equal(ownerDepartmentPhrase(unmapped.ownerDepartments), 'OWNER_DEPT:MAPEH');
});

/**
 * The two Subjects call sites must both use the primary read, so the fix is not
 // confined to one surface.
 */
test('A5-C2B-7c: both Subjects call sites use the readable read', async () => {
	for (const file of ['../components/subjects/SubjectRow.tsx', '../components/subjects/SubjectCoverageSheet.tsx']) {
		const source = readFile(file);
		assert.match(source, /ownerDepartmentRead\(/, `${file} still calls the stored-marker phrase`);
		assert.doesNotMatch(source, /ownerDepartmentPhrase\(/, `${file} still builds its primary read from the stored marker`);
	}
});

/**
 * DISCRIMINATES: on base the action cell had no `sticky`, so at 1366px it sat
 * past the right edge of the table's scroll box.
 */
test('A5-C2B-7d: the Subjects row action is pinned in view and the label is one word', async () => {
	const row = readFile('../components/subjects/SubjectRow.tsx');
	assert.match(
		row,
		/sticky right-0/,
		'the action cell is not pinned to the right edge, so it is still clipped at 1366px',
	);
	assert.match(row, /bg-white/, 'a sticky cell with a transparent background lets scrolled content show through it');
	assert.match(row, /border-l/, 'a sticky cell needs a left border to read as a pinned edge');
	assert.match(row, />\s*Review\s*</, 'the visible action label was not shortened to one word');
	// The accessible name is unchanged, so nothing is lost to a screen reader.
	assert.match(row, /aria-label=\{`Review teacher coverage for \$\{subject\.name\}`\}/);
	// The header cell must be sticky too or the pinned body cell has no heading.
	const page = readFile('../pages/Subjects.tsx');
	assert.match(page, /sticky right-0/, 'the Action column header is not pinned with its body cells');
});
