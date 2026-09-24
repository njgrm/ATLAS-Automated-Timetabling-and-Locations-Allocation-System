import assert from 'node:assert/strict';
import test from 'node:test';
import { resolveExportSignatoryProfile } from '../services/export-presentation.service.js';

test('official export presentation profile includes school-year identity, header, footer, and signatories', async () => {
	const current = {
		revision: 3, schoolName: 'Example National High School', regionLine: 'Region VI', divisionLine: 'Division of Example',
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
	assert.equal((effective as any).schoolName, current.schoolName);
	assert.equal((effective as any).regionLine, current.regionLine);
	assert.equal((effective as any).headerLine, current.headerLine);
	assert.equal(effective.footerText, current.footerText);
	const published = await resolveExportSignatoryProfile({ schoolId: 7, schoolYearId: 9, isPublished: true, publishedAt: '2026-01-01T00:00:00Z', client });
	assert.equal((published as any).schoolName, historical.schoolName);
	assert.equal(published.footerText, historical.footerText);
	assert.deepEqual(calls.map((call) => call.where.createdAt != null), [false, true]);
});

test('missing presentation revision delegate stays a typed empty profile, not invented school identity', async () => {
	const profile = await resolveExportSignatoryProfile({ schoolId: 7, schoolYearId: 9, isPublished: false, publishedAt: null, client: {} });
	assert.equal((profile as any).schoolName, null);
	assert.equal((profile as any).regionLine, null);
	assert.equal(profile.schoolHead.name, null);
});
