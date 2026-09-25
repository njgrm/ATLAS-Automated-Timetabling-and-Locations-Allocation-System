/**
 * LANE-C DEPARTURE-SWAP-C04 — teacher leaving and published swap, demo blockers.
 *
 * Live QA on 2026-09-25 (docs/handoffs/lane-c-browser-acceptance-e8553752-2026-09-25.md):
 *   S1 the teacher-leaving sheet could not scroll in Step 4 or Step 5, so a long
 *      clash list clipped the footer (Back, Choose start date)
 *   S2 dropping a Term 2 class on an occupied slot picked the Term 1 copy of the
 *      other class, and the server reported clashes against the copies left behind
 *   S3 clash sentences named rooms by id ("Room 3") instead of by name
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

import { describeRevisionClash, type PublishedRevisionClash } from '../published-revision-clashes';
import { findRegularSwapCandidate } from '../timetable-swap-routing';

const source = (path: string) => readFileSync(new URL(path, import.meta.url), 'utf8');

const entry = (entryId: string, termIndex: number, sectionId = 141, facultyId = 1, roomId = 3) => ({
	entryId,
	sectionId,
	facultyId,
	roomId,
	termIndex,
});

test('S1: the Step 4/5 check region scrolls and the footer stays outside it', () => {
	const sheet = source('../../components/timetable/TeacherDepartureRecoverySheet.tsx');
	const published = sheet.match(/<div className="([^"]*)"[^>]*data-testid="teacher-departure-published-check"/);
	assert.ok(published, 'published check region is present');
	for (const token of ['min-h-0', 'flex-1', 'overflow-y-auto']) {
		assert.ok(published[1].split(/\s+/).includes(token), `published check region has ${token}`);
	}
	const draftPreview = sheet.match(/<div className="([^"]*)"[^>]*data-testid="teacher-departure-draft-check"/);
	assert.ok(draftPreview, 'draft preview region is present');
	for (const token of ['min-h-0', 'flex-1', 'overflow-y-auto']) {
		assert.ok(draftPreview[1].split(/\s+/).includes(token), `draft preview region has ${token}`);
	}
	assert.ok(
		sheet.indexOf('data-testid="teacher-departure-published-check"') < sheet.indexOf('<SheetFooter'),
		'footer renders after, not inside, the scrolling region',
	);
});

test('S2: a swap target is taken from the same term as the moved class', () => {
	const source2 = entry('entry-10::t2', 2);
	const slot = [entry('entry-20::t1', 1), entry('entry-20::t2', 2), entry('entry-20::t3', 3)];
	assert.equal(findRegularSwapCandidate(source2, slot)?.entryId, 'entry-20::t2');
});

test('S2: a class from another term is never offered as the swap target', () => {
	const source2 = entry('entry-10::t2', 2);
	assert.equal(findRegularSwapCandidate(source2, [entry('entry-20::t1', 1), entry('entry-20::t3', 3)]), null);
});

test('S2: a whole-year class (no term) can still swap with a termed class', () => {
	const whole = entry('entry-10', 0);
	assert.equal(findRegularSwapCandidate(whole, [entry('entry-20::t2', 2)])?.entryId, 'entry-20::t2');
});

test('S3: room clashes use the room name wherever the demo paths build clash labels', () => {
	const clash: PublishedRevisionClash = {
		code: 'ROOM_TIME_CONFLICT',
		title: 'Room double-booked',
		meaning: '',
		day: 'THURSDAY',
		startTime: '10:45',
		endTime: '11:30',
		roomId: 3,
		entries: [
			{ entryId: 'a', changed: true, sectionId: 141, subjectId: 5, termIndex: 2, day: 'THURSDAY', startTime: '10:45', endTime: '11:30', roomId: 3, facultyId: 1 },
			{ entryId: 'b', changed: false, sectionId: 141, subjectId: 6, termIndex: 2, day: 'THURSDAY', startTime: '10:45', endTime: '11:30', roomId: 3, facultyId: 2 },
		],
	} as PublishedRevisionClash;
	const sentence = describeRevisionClash(clash, {
		facultyLabel: (id) => `Teacher ${id}`,
		sectionLabel: () => 'GR7 - Luna',
		subjectLabel: (id) => `Subject ${id}`,
		roomLabel: () => 'G7 Room 103',
	}).sentence;
	assert.match(sentence, /^G7 Room 103 would hold/);

	for (const path of [
		'../../components/timetable/TeacherDepartureRecoverySheet.tsx',
		'../../components/timetable/modals/PublishedSwapRevisionPanel.tsx',
	]) {
		const text = source(path);
		assert.match(text, /useMemo\(\(\) => \(\{ facultyLabel, sectionLabel, subjectLabel, roomLabel \}\)/, `${path} passes roomLabel`);
	}
});

test('S4: a clean published check says the change also moves the classes in Teaching Load', () => {
	const sheet = source('../../components/timetable/TeacherDepartureRecoverySheet.tsx');
	const clean = sheet.indexOf('data-testid="teacher-departure-published-check-clean"');
	const note = sheet.indexOf('data-testid="teacher-departure-load-transfer-note"');
	assert.ok(clean > 0 && note > clean, 'the note follows the clean result');
	assert.ok(note < sheet.indexOf(') : publishedPreview ? (', clean), 'the note renders only in the clean branch');
	assert.match(sheet, /also moves these classes to the new teacher in Teaching Load/);
});
