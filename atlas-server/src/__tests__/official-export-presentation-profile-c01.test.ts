import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { applyTemplateSignatoryFallback, PresentationProfileError, resolveExportSignatoryProfile } from '../services/export-presentation.service.js';

test('official export presentation profile includes school-year identity, header, footer, and signatories', async () => {
	const current = {
		revision: 3, officialSchoolName: 'Example National High School', regionLine: 'Region VI', divisionLine: 'Division of Example',
		districtLine: 'Example District', headerLine: 'Department of Education', footerText: 'Official footer',
		schoolHeadName: 'A. Principal', schoolHeadTitle: 'Principal', psdsName: 'B. Supervisor', psdsTitle: 'PSDS',
		cidChiefName: 'C. Chief', cidChiefTitle: 'CID Chief', asdsName: 'D. Superintendent', asdsTitle: 'ASDS',
	};
	const historical = { ...current, revision: 2, schoolName: 'Old Example School', footerText: 'Earlier footer' };
	const calls: any[] = [];
	const client = {
		teacherProgramPresentationRevision: {
			findFirst: async (args: any) => {
				calls.push(args);
				return args.where.createdAt ? historical : current;
			},
		},
	};
	const effective = await resolveExportSignatoryProfile({ schoolId: 7, schoolYearId: 9, isPublished: false, publishedAt: null, client });
	assert.equal(effective.officialSchoolName, current.officialSchoolName);
	assert.equal((effective as any).regionLine, current.regionLine);
	assert.equal((effective as any).headerLine, current.headerLine);
	assert.equal(effective.footerText, current.footerText);
	const published = await resolveExportSignatoryProfile({ schoolId: 7, schoolYearId: 9, isPublished: true, publishedAt: '2026-01-01T00:00:00Z', client });
	assert.equal(published.officialSchoolName, historical.officialSchoolName);
	assert.equal(published.footerText, historical.footerText);
	assert.deepEqual(calls.map((call) => call.where.createdAt != null), [false, true]);
});

test('missing presentation revision delegate stays a typed empty profile, not invented school identity', async () => {
	const profile = await resolveExportSignatoryProfile({ schoolId: 7, schoolYearId: 9, isPublished: false, publishedAt: null, client: {} });
	assert.equal(profile.officialSchoolName, null);
	assert.equal((profile as any).regionLine, null);
	assert.equal(profile.schoolHead.name, null);
});

test('Hinigaran reference signatories are fallback only for the exact source school', async () => {
	const empty = await resolveExportSignatoryProfile({ schoolId: 7, schoolYearId: 9, isPublished: false, publishedAt: null, client: {} });
	assert.equal(applyTemplateSignatoryFallback(empty, 'Hinigaran National High School').schoolHead.name, 'JUDY ANN B. NONATO');
	assert.equal(applyTemplateSignatoryFallback(empty, 'Hinigaran National High School ').asds.name, 'JULITO L. FELICANO, CESE');
	assert.equal(applyTemplateSignatoryFallback(empty, 'Example National High School').schoolHead.name, null);
});

test('a missing unified-profile column keeps the official export path typed and fail-closed', async () => {
	await assert.rejects(
		() => resolveExportSignatoryProfile({
			schoolId: 7, schoolYearId: 9, isPublished: false, publishedAt: null,
			client: { teacherProgramPresentationRevision: { findFirst: async () => { throw { code: 'P2022' }; } } },
		}),
		(error: unknown) => error instanceof PresentationProfileError
			&& error.statusCode === 503
			&& error.code === 'EXPORT_PRESENTATION_SCHEMA_UNAVAILABLE',
	);
});

test('the additive Prisma schema and source-only migration contain matching school-year identity fields', async () => {
	const root = new URL('../../../', import.meta.url);
	const schema = await readFile(new URL('prisma/schema.prisma', root), 'utf8');
	const migration = await readFile(new URL('prisma/migrations/20260924000000_unified_official_export_profile/migration.sql', root), 'utf8');
	for (const [field, column] of [
		['officialSchoolName', 'official_school_name'], ['headerLine', 'header_line'], ['regionLine', 'region_line'],
		['divisionLine', 'division_line'], ['districtLine', 'district_line'],
	] as const) {
		assert.match(schema, new RegExp(`${field}\\s+String\\?\\s+@map\\("${column}"\\)`));
		assert.match(migration, new RegExp(`ADD COLUMN "${column}"`));
	}
	assert.match(migration, /ALTER TABLE "teacher_program_presentation_revisions"/);
});
