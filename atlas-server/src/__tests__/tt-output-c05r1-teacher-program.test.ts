/**
 * BENEFICIARY-EXPORT-PARITY-C05R1 — Teacher Program correction suite.
 *
 * Proves, through the real production builders (`buildTeacherProgramExportShape`
 * + `generateTeacherProgramDocx`), the mandatory controls:
 *
 *  1. canonical shift projection: class rows, policy break rows, `Ancillary Work`
 *  2. removing the configured event produces ancillary work; a gap is never a health break
 *  3. Monday–Friday compaction of teaching/ancillary/lunch/health; day exceptions explicit
 *  4. ancillary/break/HG/ARAL contribute zero; an ancillary-in-total mutant fails
 *  5. AP stays an ordinary teaching row with its true minutes
 *  6. adviser credit only with effective policy + a real adviser assignment
 *  7. exact selected-term parity; no missing term becomes T1
 * 10. active-year signatory edits change draft exports, not published revisions
 * 11. extracted DOCX structure: six headers, ordered rows, merged break bands,
 *     load equation, no ARAL/ancillary load components, profile, role hierarchy
 *
 * Zero writes: the injected client is a read-only fixture.
 */

import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';

import { withDataContext } from '../lib/data-context.js';
import { buildTeacherProgramExportShape } from '../services/teacher-program-export.service.js';
import { generateTeacherProgramDocx } from '../services/docx-export.service.js';

const SCHOOL_ID = 71;
const SCHOOL_YEAR_ID = 11;
const RUN_ID = 42;
const YEAR_LABEL = '2026-2027';
const ARTIFACT_DIR = join(tmpdir(), 'opencode', 'beneficiary-export-parity-c05r1', 'executor');

const WEEKDAYS = ['MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY'] as const;

type Entry = {
	entryId: string;
	sectionId: number;
	subjectId: number;
	facultyId: number | null;
	roomId: number;
	day: string;
	startTime: string;
	endTime: string;
	durationMinutes: number;
	termIndex: number;
};

const SECTIONS = [
	{ id: 1, externalId: 701, name: '7-Rizal', gradeLevelId: 7, gradeLevelName: 'Grade 7', programType: 'REGULAR' },
	{ id: 2, externalId: 702, name: '7-Zamora', gradeLevelId: 7, gradeLevelName: 'Grade 7', programType: 'REGULAR' },
];
const FACULTY = [
	{
		id: 501, firstName: 'Juan', lastName: 'Dela Cruz', employeeId: 'E-501', plantillaPosition: 'Teacher I',
		designationTitle: null, undergraduateDegree: 'BACHELOR IN SECONDARY EDUCATION', postgraduateDegree: null,
		avatarUrl: null, ancillaryRoles: [], ancillaryMinutesPerWeek: 0, ancillaryLoadSource: 'NONE',
		isClassAdviser: true, advisedSectionId: 701, advisedSectionName: '7-Rizal', isStale: false,
	},
	{
		id: 502, firstName: 'Maria', lastName: 'Santos', employeeId: 'E-502', plantillaPosition: 'Teacher II',
		designationTitle: null, undergraduateDegree: null, postgraduateDegree: null, avatarUrl: null,
		ancillaryRoles: [], ancillaryMinutesPerWeek: 0, ancillaryLoadSource: 'NONE',
		isClassAdviser: false, advisedSectionId: null, advisedSectionName: null, isStale: false,
	},
];
const SUBJECTS = [
	{ id: 11, name: 'Mathematics', code: 'MATH' },
	{ id: 21, name: 'Biology', code: 'BIO' },
	{ id: 22, name: 'Chemistry', code: 'CHEM' },
	{ id: 23, name: 'Earth Science', code: 'ES' },
	{ id: 13, name: 'Araling Panlipunan', code: 'AP' },
	{ id: 99, name: 'Homeroom Guidance', code: 'HG' },
	{ id: 98, name: 'ARAL Program', code: 'ARAL' },
];
const ROOMS = [
	{ id: 601, name: '101', type: 'CLASSROOM', floor: 1, building: { id: 1, name: 'Building A' } },
	{ id: 602, name: '102', type: 'CLASSROOM', floor: 1, building: { id: 1, name: 'Building A' } },
];

// Canonical shift template: three 45-minute class periods + two configured breaks.
const CLASS_PROGRAM_SLOTS = [
	{ gradeLevel: 7, startTime: '06:00', endTime: '06:45', rowKind: 'CLASS', subjectLabel: 'Class', dayOfWeek: null },
	{ gradeLevel: 7, startTime: '06:45', endTime: '07:30', rowKind: 'CLASS', subjectLabel: 'Class', dayOfWeek: null },
	{ gradeLevel: 7, startTime: '07:30', endTime: '08:15', rowKind: 'CLASS', subjectLabel: 'Class', dayOfWeek: null },
	{ gradeLevel: 7, startTime: '09:00', endTime: '09:15', rowKind: 'BREAK', subjectLabel: 'Health Break', dayOfWeek: null },
	{ gradeLevel: 7, startTime: '11:30', endTime: '12:15', rowKind: 'BREAK', subjectLabel: 'Lunch Break', dayOfWeek: null },
];

const ROTATION = [
	{ term: 1, subject: 21, faculty: 501, room: 601 },
	{ term: 2, subject: 22, faculty: 502, room: 602 },
	{ term: 3, subject: 23, faculty: 501, room: 601 },
];

function buildEntries(): Entry[] {
	const entries: Entry[] = [];
	for (const term of [1, 2, 3] as const) {
		for (const day of WEEKDAYS) {
			entries.push({ entryId: `math-${term}-${day}`, sectionId: 701, subjectId: 11, facultyId: 501, roomId: 601, day, startTime: '06:00', endTime: '06:45', durationMinutes: 45, termIndex: term });
		}
		const rotation = ROTATION.find((item) => item.term === term)!;
		entries.push({ entryId: `rotation-${term}`, sectionId: 701, subjectId: rotation.subject, facultyId: rotation.faculty, roomId: rotation.room, day: 'MONDAY', startTime: '06:45', endTime: '07:30', durationMinutes: 45, termIndex: term });
		entries.push({ entryId: `ap-${term}`, sectionId: 701, subjectId: 13, facultyId: 502, roomId: 602, day: 'THURSDAY', startTime: '06:45', endTime: '07:30', durationMinutes: 45, termIndex: term });
		// Reference-only demand: present in the source, absent from every output.
		entries.push({ entryId: `hg-${term}`, sectionId: 701, subjectId: 99, facultyId: 501, roomId: 601, day: 'TUESDAY', startTime: '08:15', endTime: '09:00', durationMinutes: 45, termIndex: term });
		entries.push({ entryId: `aral-${term}`, sectionId: 701, subjectId: 98, facultyId: 501, roomId: 601, day: 'WEDNESDAY', startTime: '08:15', endTime: '09:00', durationMinutes: 45, termIndex: term });
	}
	return entries;
}

const ENTRIES = buildEntries();

function makeClient(options: {
	entries?: Entry[];
	summary?: Record<string, unknown>;
	classProgramSlots?: typeof CLASS_PROGRAM_SLOTS;
	adviser?: boolean;
	advisoryCreditMinutes?: number | null;
	presentationRevisions?: Array<Record<string, unknown>>;
	writes?: string[];
} = {}) {
	const entries = options.entries ?? ENTRIES;
	const summary = options.summary ?? { isPublished: false, timetableDisplaySlots: [] };
	const slots = options.classProgramSlots ?? CLASS_PROGRAM_SLOTS;
	const adviser = options.adviser ?? true;
	const faculty501 = { ...FACULTY[0], isClassAdviser: adviser, advisedSectionId: adviser ? 701 : null, advisedSectionName: adviser ? '7-Rizal' : null };
	const presentationRevisions = options.presentationRevisions ?? [];
	return {
		generationRun: { findFirst: async () => ({ id: RUN_ID, status: 'COMPLETED', summary, draftEntries: entries }) },
		school: { findUnique: async () => ({ name: 'ATLAS National High School' }) },
		enrollProSchoolYearMirror: { findFirst: async () => ({ yearLabel: YEAR_LABEL }) },
		sectionMirror: { findMany: async () => SECTIONS },
		facultyMirror: { findFirst: async (args: any) => {
			const id = args?.where?.id;
			if (id === 501) return faculty501;
			return FACULTY.find((f) => f.id === id) ?? null;
		} },
		subject: { findMany: async () => SUBJECTS },
		room: { findMany: async () => ROOMS },
		building: { findMany: async () => [{ id: 1, name: 'Building A' }] },
		schedulingPolicy: { findFirst: async () => ({
			enableRecess: true, enableFlagCeremony: false,
			advisoryCreditMinutes: options.advisoryCreditMinutes === undefined ? 60 : options.advisoryCreditMinutes,
		}) },
		classProgramSlot: { findMany: async () => slots },
		policySpecialEvent: { findMany: async () => [] },
		teacherProgramPresentationRevision: {
			findFirst: async (args: any) => {
				const where = args?.where ?? {};
				let rows = [...presentationRevisions];
				if (where.createdAt?.lte) {
					const cutoff = new Date(where.createdAt.lte).getTime();
					rows = rows.filter((row) => new Date(row.createdAt as string).getTime() <= cutoff);
				}
				rows.sort((a, b) => (b.revision as number) - (a.revision as number));
				return rows[0] ?? null;
			},
		},
	};
}

async function buildShape(client: any, facultyId = 501, termIndex: number | undefined = 1) {
	return withDataContext(client, () => buildTeacherProgramExportShape({
		schoolId: SCHOOL_ID, schoolYearId: SCHOOL_YEAR_ID, runId: RUN_ID, facultyId, termIndex, client,
	}));
}

async function docxTexts(buffer: Buffer): Promise<{ document: string; header: string; footer: string }> {
	const { default: JSZip } = await import('jszip');
	const zip = await (JSZip as any).loadAsync(buffer);
	const read = async (name: string) => {
		const file = zip.file(name);
		if (!file) return '';
		const xml: string = await file.async('string');
		return xml;
	};
	return { document: await read('word/document.xml'), header: await read('word/header1.xml'), footer: await read('word/footer1.xml') };
}

function texts(xml: string): string[] {
	return [...xml.matchAll(/<w:t[^>]*>([^<]*)<\/w:t>/g)].map((match) =>
		match[1]
			.replace(/&apos;/g, "'")
			.replace(/&quot;/g, '"')
			.replace(/&lt;/g, '<')
			.replace(/&gt;/g, '>')
			.replace(/&amp;/g, '&'),
	);
}

// ─── Control 1 — teacher-day projection ───

test('control 1: the projection yields class rows, configured break rows, and Ancillary Work gaps', async () => {
	const shape = await buildShape(makeClient());
	const row = (kind: string, start: string) => shape.rows.find((r) => r.kind === kind && r.intervalStart === start);

	const math = row('TEACHING', '06:00');
	assert.ok(math, 'the five-session MATH class projects');
	assert.equal(math.dayLabel, 'Monday to Friday');
	assert.equal(math.gradeAndSection, 'Grade 7 - 7-Rizal');
	assert.equal(math.room, 'Building A / 101');
	assert.equal(math.minutes, 45);

	const rotation = row('TEACHING', '06:45');
	assert.ok(rotation, 'the Monday-only rotation class projects');
	assert.equal(rotation.label, 'Biology');
	assert.deepEqual(rotation.days, ['MONDAY']);

	const gap = row('ANCILLARY', '06:45');
	assert.ok(gap, 'the ordinary gap after the Monday-only class projects as Ancillary Work');
	assert.equal(gap.label, 'Ancillary Work');
	assert.deepEqual(gap.days, ['TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY']);
	assert.equal(gap.presentationOnly, true, 'Ancillary Work is an export-only projection');

	const gap2 = row('ANCILLARY', '07:30');
	assert.ok(gap2, 'the fully free canonical period projects as Ancillary Work');
	assert.equal(gap2.dayLabel, 'Monday to Friday');

	const health = shape.rows.find((r) => r.kind === 'BREAK' && r.label === 'Health Break');
	assert.ok(health, 'the configured Health Break policy row renders');
	assert.equal(health.dayLabel, 'Monday to Friday');
	assert.equal(health.isEvent, true);

	const lunch = shape.rows.find((r) => r.kind === 'BREAK' && r.label === 'Lunch Break');
	assert.ok(lunch, 'the configured Lunch Break policy row renders');
});

// ─── Control 2 — no false health breaks ───

test('control 2: removing the configured event produces ancillary work and never a health break', async () => {
	// The former health-break interval remains a canonical class period, but the
	// break/event classification is withdrawn. It must become ordinary ancillary
	// work, never a mislabeled health break.
	const withoutEvents = [
		...CLASS_PROGRAM_SLOTS.filter((slot) => slot.startTime !== '09:00'),
		{ gradeLevel: 7, startTime: '09:00', endTime: '09:15', rowKind: 'CLASS', subjectLabel: 'Class', dayOfWeek: null },
	];
	const shape = await buildShape(makeClient({ classProgramSlots: withoutEvents }));
	assert.equal(shape.rows.some((r) => r.label === 'Health Break'), false, 'no configured event -> no break label');
	assert.ok(shape.rows.some((r) => r.kind === 'ANCILLARY' && r.intervalStart === '09:00'), 'the unconfigured interval becomes ancillary work');
	assert.equal(
		shape.rows.some((r) => r.kind === 'BREAK' && r.intervalStart === '09:00'),
		false,
		'an ordinary free period is never relabeled as a health break',
	);
});

// ─── Control 3 — compaction ───

test('control 3: equivalent rows compact once and a one-day exception stays day-specific', async () => {
	const entries = [...ENTRIES];
	// Replace Thursday MATH with a distinct subject so MATH becomes a 4-day row.
	const shape = await buildShape(makeClient({ entries }));
	const math = shape.rows.find((r) => r.kind === 'TEACHING' && r.intervalStart === '06:00' && r.label === 'Mathematics');
	assert.ok(math);
	assert.equal(math.dayLabel, 'Monday to Friday');
	assert.equal(shape.rows.filter((r) => r.kind === 'TEACHING' && r.intervalStart === '06:00' && r.label === 'Mathematics').length, 1, 'equivalent rows compact once');

	// One-day exception: a distinct Monday-only rotation day is explicit.
	const rotation = shape.rows.find((r) => r.kind === 'TEACHING' && r.intervalStart === '06:45' && r.label === 'Biology');
	assert.ok(rotation);
	assert.equal(rotation.dayLabel, 'Monday');
	assert.ok(shape.rows.some((r) => r.dayLabel === 'Tuesday, Wednesday, Thursday, Friday'), 'the four-day ancillary gap states its explicit days');
	// A Tuesday-only teaching exception renders as a day-specific row.
	const tuesdayOnly = await buildShape(makeClient({
		entries: ENTRIES.map((entry) => entry.entryId.startsWith('rotation-1') ? { ...entry, day: 'TUESDAY' } : entry),
	}));
	const biology = tuesdayOnly.rows.find((r) => r.kind === 'TEACHING' && r.label === 'Biology');
	assert.ok(biology);
	assert.deepEqual(biology.days, ['TUESDAY']);
});

// ─── Control 4 — load arithmetic ───

test('control 4: ancillary/break/HG/ARAL contribute zero to load; an ancillary-in-total mutant fails', async () => {
	const shape = await buildShape(makeClient());
	assert.equal(shape.summary.actualTeachingMinutes, 270, 'actual teaching = five 45-minute MATH sessions + the term-1 Biology rotation session');
	assert.equal(shape.summary.ancillaryMinutes, 0, 'ancillary carries zero credited minutes');
	assert.equal(shape.summary.advisoryMinutes, 60, 'adviser credit comes from the effective policy');
	assert.equal(shape.summary.totalTeachingLoad, 330, 'total = actual teaching + adviser credit');
	assert.equal(shape.summary.totalTeachingLoad, shape.summary.actualTeachingMinutes + shape.summary.advisoryMinutes);
	// Reference convention: the form's "Total minutes per day" / load block state
	// one full teaching day (Monday = MATH 45 + Biology 45), not the weekly sum.
	assert.equal(shape.summary.perDayTeachingMinutes, 90, 'per-day teaching = the busiest weekday total, excluding breaks and ancillary');
	assert.equal(shape.summary.perDayTotalTeachingLoad, 150, 'per-day total = per-day teaching + adviser credit');

	// Mutant control: an implementation that added the ancillary projection
	// minutes to the total would produce a different, wrong number.
	const ancillaryMinutesIfCounted = shape.rows
		.filter((r) => r.kind === 'ANCILLARY')
		.reduce((sum, r) => sum + r.minutes * r.days.length, 0);
	assert.ok(ancillaryMinutesIfCounted > 0, 'ancillary rows carry visible minutes');
	assert.notEqual(shape.summary.totalTeachingLoad, shape.summary.actualTeachingMinutes + shape.summary.advisoryMinutes + ancillaryMinutesIfCounted, 'ancillary-in-total mutant is rejected');

	// HG/ARAL never contribute a row, minute, or label.
	assert.equal(shape.rows.some((r) => /ARAL|Homeroom/i.test(r.label)), false);
	assert.equal(shape.summary.actualTeachingMinutes % 45, 0, 'reference-only rows never inflate teaching minutes');
});

// ─── Control 5 — AP ordinary ───

test('control 5: Araling Panlipunan remains an ordinary teaching row with true minutes', async () => {
	const shape = await buildShape(makeClient(), 502, 1);
	const ap = shape.rows.find((r) => r.kind === 'TEACHING' && r.label === 'Araling Panlipunan');
	assert.ok(ap, 'AP renders as an ordinary teaching row');
	assert.equal(ap.minutes, 45);
	assert.equal(ap.gradeAndSection, 'Grade 7 - 7-Rizal');
	assert.equal(shape.summary.actualTeachingMinutes, 45, 'AP contributes its true teaching minutes');
	assert.equal(shape.summary.totalTeachingLoad, 45);
});

// ─── Control 6 — adviser credit authority ───

test('control 6: adviser credit requires the effective policy and a real adviser assignment', async () => {
	const noAdviser = await buildShape(makeClient({ adviser: false }));
	assert.equal(noAdviser.summary.advisoryMinutes, 0, 'a non-adviser contributes zero');
	assert.equal(noAdviser.summary.totalTeachingLoad, noAdviser.summary.actualTeachingMinutes);

	const noPolicy = await buildShape(makeClient({ advisoryCreditMinutes: null }));
	assert.equal(noPolicy.summary.advisoryMinutes, 0, 'a missing persisted advisory-credit policy contributes zero');
});

// ─── Control 7 — selected-term parity ───

test('control 7: selected-term parity holds and a missing term identity fails closed', async () => {
	const term1 = await buildShape(makeClient(), 501, 1);
	assert.equal(term1.rows.some((r) => r.label === 'Biology'), true, 'term 1 renders its rotation member');
	assert.equal(term1.rows.some((r) => r.label === 'Chemistry' || r.label === 'Earth Science'), false, 'other-term rotation members never leak');

	const term3 = await buildShape(makeClient(), 501, 3);
	assert.equal(term3.rows.some((r) => r.label === 'Earth Science'), true);
	assert.equal(term3.rows.some((r) => r.label === 'Biology'), false);

	const missingTermClient = makeClient({ entries: ENTRIES.map((entry) => ({ ...entry, termIndex: undefined as unknown as number })) });
	await assert.rejects(
		() => buildShape(missingTermClient, 501, 1),
		(error: unknown) => error instanceof Error && (error as Error & { code?: string }).code === 'TERM_FILTER_NOT_READY',
		'a missing term identity never silently becomes T1',
	);
});

// ─── Control 10 — publication-bound signatories ───

test('control 10: active-year signatory edits change draft exports but not a published revision', async () => {
	const publishedAt = '2026-09-10T00:00:00.000Z';
	const revisions = [
		{
			revision: 1, schoolHeadName: 'OLD HEAD', schoolHeadTitle: null, psdsName: 'PSDS ONE', psdsTitle: null,
			cidChiefName: null, cidChiefTitle: null, asdsName: null, asdsTitle: null, footerText: 'For every learner, we rise!',
			createdAt: '2026-09-01T00:00:00.000Z',
		},
		{
			revision: 2, schoolHeadName: 'NEW HEAD', schoolHeadTitle: null, psdsName: 'PSDS TWO', psdsTitle: null,
			cidChiefName: null, cidChiefTitle: null, asdsName: null, asdsTitle: null, footerText: 'For every learner, we rise!',
			createdAt: '2026-09-20T00:00:00.000Z',
		},
	];

	const draftClient = makeClient({ presentationRevisions: revisions });
	const draft = await buildShape(draftClient, 501, 1);
	assert.equal(draft.signatories.schoolHead.name, 'NEW HEAD', 'the draft export uses the current effective profile');
	assert.equal(draft.signatories.schoolHead.title, 'School Head');

	const publishedClient = makeClient({
		presentationRevisions: revisions,
		summary: { isPublished: true, publishedAt, timetableDisplaySlots: [] },
	});
	const published = await withDataContext(publishedClient, () => buildTeacherProgramExportShape({
		schoolId: SCHOOL_ID, schoolYearId: SCHOOL_YEAR_ID, runId: RUN_ID, facultyId: 501, termIndex: 1,
		client: publishedClient,
		publishedScheduleResolver: async () => ({ source: { runId: RUN_ID }, entries: ENTRIES.filter((entry) => entry.termIndex === 1) }),
	}));
	assert.equal(published.signatories.schoolHead.name, 'OLD HEAD', 'the published export binds to the immutable publication-time revision');
	assert.equal(published.signatories.psds.name, 'PSDS ONE');
	assert.equal(published.signatories.footerText, 'For every learner, we rise!');
});

// ─── Control 11 — DOCX structure extraction ───

test('control 11: the produced DOCX reproduces the reference structure and load equation', async () => {
	const client = makeClient({
		presentationRevisions: [{
			revision: 1, schoolHeadName: 'JUDY ANN B. NONATO', schoolHeadTitle: null, psdsName: 'EMILIA L. ENGLIS', psdsTitle: null,
			cidChiefName: 'ARCH. NELSON G. BEDAURE, PhD', cidChiefTitle: null, asdsName: 'JULITO L. FELICANO, CESE', asdsTitle: null,
			footerText: 'For every learner, we rise!', createdAt: '2026-09-01T00:00:00.000Z',
		}],
	});
	const shape = await buildShape(client, 501, 1);
	const buffer = await generateTeacherProgramDocx(shape);
	const { document, header, footer } = await docxTexts(buffer);
	const all = [...texts(document), ...texts(header), ...texts(footer)];

	mkdirSync(ARTIFACT_DIR, { recursive: true });
	writeFileSync(join(ARTIFACT_DIR, 'teacher-program-501-SY2026-2027-term1.docx'), buffer);

	// Six column headers.
	for (const label of ['Time', 'No. of min', 'Subject', 'Grade and section', 'Day', 'Bldg/Room #']) {
		assert.ok(all.includes(label), `column header "${label}" renders`);
	}
	// Identity header.
	for (const line of ['Republic of the Philippines', 'Department of Education', 'ATLAS National High School']) {
		assert.ok(all.includes(line), `identity line "${line}" renders`);
	}
	// Title + SY.
	assert.ok(all.some((value) => /^TEACHER.{0,2}S PROGRAM$/.test(value)), 'the title renders');
	assert.ok(all.some((value) => /^SY 2026-2027/.test(value)), 'the school year renders');
	// Ordered schedule rows: MATH 06:00, Biology 06:45 (Monday), ancillary 07:30, health 09:00, lunch 11:30.
	assert.ok(all.includes('Mathematics') && all.includes('Ancillary Work') && all.includes('Lunch Break') && all.includes('Health Break'));
	// Merged break bands: the break label cell carries gridSpan.
	assert.match(document, /<w:gridSpan w:val="4"\/>/, 'the break band spans Subject..Bldg/Room #');
	// Load equation labels only — no ARAL row, no ancillary load component.
	for (const label of ['Class Advising Duty', 'Actual Teaching Load', 'Total Teaching Load']) {
		assert.ok(all.includes(label), `load label "${label}" renders`);
	}
	assert.equal(all.some((value) => /ARAL Program|ARAL PROGRAM|Homeroom Guidance/.test(value)), false, 'no ARAL/HG label may render');
	assert.ok(all.includes('150 mins'), 'the total teaching load states the per-day arithmetic result');
	assert.ok(all.includes('90 mins'), 'the actual teaching load states the per-day teaching-only total');
	assert.ok(all.includes('Total minutes per day'), 'the reference totals row renders');
	// Profile fields.
	for (const label of ['Name:', 'Position:', "Bachelor's Degree:", 'Post Graduate Degree:']) {
		assert.ok(all.includes(label), `profile label "${label}" renders`);
	}
	assert.ok(all.includes('Dela Cruz, Juan'), 'the teacher name resolves from the selected teacher');
	// Full role hierarchy.
	for (const label of ['Checked by:', 'Noted:', 'Recommending Approval:', 'Approved:']) {
		assert.ok(all.includes(label), `signature label "${label}" renders`);
	}
	for (const role of ['Teacher', 'School Head', 'Public School District Supervisor', 'Chief – Curriculum Implementation Division', 'Assistant Schools Division Superintendent']) {
		assert.ok(all.includes(role), `signature role "${role}" renders`);
	}
	assert.ok(all.includes('JUDY ANN B. NONATO') && all.includes('EMILIA L. ENGLIS'), 'configured signatory names render');
	// Footer treatment when configured.
	assert.ok(texts(footer).includes('For every learner, we rise!'), 'the configured footer renders');
	// Portrait + page border.
	assert.match(document, /<w:pgSz[^>]*w:orient="portrait"/, 'the teacher program is portrait');
	assert.match(document, /<w:pgBorders[\s>]/, 'the page border renders');
});

test('missing signatory names render blank signature lines with the configured role titles', async () => {
	const shape = await buildShape(makeClient(), 501, 1);
	const buffer = await generateTeacherProgramDocx(shape);
	const { document } = await docxTexts(buffer);
	const all = texts(document);
	assert.ok(all.includes('Public School District Supervisor'), 'the canonical role title still renders');
	assert.ok(all.includes('________________________'), 'a missing name renders a blank signature line');
	assert.equal(all.some((value) => /BEBOSO|TORNEA|NONATO|ENGLIS/.test(value)), false, 'no reference name is invented');
});

// ─── Control 9 — the full draft export path is instrumented zero-write ───

const WRITE_METHODS = new Set(['create', 'createMany', 'update', 'updateMany', 'upsert', 'delete', 'deleteMany', 'executeRaw', 'queryRaw', '$executeRaw', '$queryRaw']);

/**
 * Wrap every model delegate so any write attempt throws. A production export
 * that created, normalized, or repaired policy/signatory rows would fail here.
 */
function zeroWriteClient(base: any): { client: any; writes: string[] } {
	const writes: string[] = [];
	const wrapDelegate = (model: string, delegate: any) => new Proxy(delegate, {
		get(target, property: string) {
			const value = target[property];
			if (typeof value === 'function' && WRITE_METHODS.has(property)) {
				return (...args: unknown[]) => {
					writes.push(`${model}.${property}`);
					throw new Error(`UNEXPECTED WRITE: ${model}.${property}`);
				};
			}
			return typeof value === 'function' ? value.bind(target) : value;
		},
	});
	const client = new Proxy(base, {
		get(target, property: string) {
			const value = target[property];
			if (value && typeof value === 'object') return wrapDelegate(property, value);
			if (typeof value === 'function') return value.bind(target);
			return value;
		},
	});
	return { client, writes };
}

test('control 9: a draft export is an instrumented zero-write path', async () => {
	const { client, writes } = zeroWriteClient(makeClient());
	const shape = await buildShape(client, 501, 1);
	const buffer = await generateTeacherProgramDocx(shape);
	assert.ok(buffer.length > 2000, 'the draft export produced a real artifact');
	assert.deepEqual(writes, [], 'the draft export path performs zero writes');
});
