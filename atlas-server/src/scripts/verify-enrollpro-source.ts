import jwt from 'jsonwebtoken';

import { syncCohorts } from '../services/cohort.service.js';
import { syncFacultyFromExternal } from '../services/faculty.service.js';
import { getSectionSummary } from '../services/section.service.js';

type CliValue = string | boolean | undefined;

interface VerificationOptions {
	schoolId: number;
	schoolYearId: number;
	authUserId: number;
	authRole: string;
	authToken: string | null;
}

function parseArgs(): VerificationOptions {
	const parsed: Record<string, string | boolean> = {};

	for (const arg of process.argv.slice(2)) {
		if (!arg.startsWith('--')) {
			continue;
		}

		const [key, value] = arg.slice(2).split('=');
		parsed[key] = value ?? true;
	}

	return {
		schoolId: Number(parsed.schoolId) || 0,
		schoolYearId: Number(parsed.schoolYearId) || 0,
		authUserId: Number(parsed.authUserId) || 1,
		authRole: typeof parsed.authRole === 'string' && parsed.authRole.trim().length > 0 ? parsed.authRole.trim() : 'SYSTEM_ADMIN',
		authToken: typeof parsed.authToken === 'string' && parsed.authToken.trim().length > 0 ? parsed.authToken.trim() : null,
	};
}

function resolveAuthToken(options: VerificationOptions): { token: string | undefined; source: string } {
	if (options.authToken) {
		return { token: options.authToken, source: 'cli' };
	}

	if (process.env.ENROLLPRO_SERVICE_TOKEN) {
		return { token: process.env.ENROLLPRO_SERVICE_TOKEN, source: 'service-env' };
	}

	if (!process.env.JWT_SECRET) {
		return { token: undefined, source: 'none' };
	}

	return {
		token: jwt.sign(
			{ userId: options.authUserId, role: options.authRole },
			process.env.JWT_SECRET,
			{ expiresIn: '15m' },
		),
		source: 'generated-jwt',
	};
}

function assertAcceptedSource(domain: string, source: string) {
	if (source === 'stub' || source === 'auto-fallback' || source === 'preserved-existing') {
		throw new Error(`${domain} resolved to disallowed source \"${source}\".`);
	}
}

async function main() {
	const options = parseArgs();
	if (!options.schoolId || !options.schoolYearId) {
		throw new Error('Usage: npx tsx src/scripts/verify-enrollpro-source.ts --schoolId=N --schoolYearId=N [--authUserId=N] [--authRole=SYSTEM_ADMIN] [--authToken=TOKEN]');
	}

	const auth = resolveAuthToken(options);
	if (!auth.token) {
		throw new Error('Missing EnrollPro auth token. Provide --authToken, ENROLLPRO_SERVICE_TOKEN, or JWT_SECRET plus an active auth user id.');
	}

	const faculty = await syncFacultyFromExternal(options.schoolId, options.schoolYearId, auth.token);
	const sections = await getSectionSummary(options.schoolYearId, options.schoolId, auth.token);
	const cohorts = await syncCohorts(options.schoolId, options.schoolYearId, auth.token);

	assertAcceptedSource('faculty', faculty.source);
	assertAcceptedSource('sections', sections.source);
	assertAcceptedSource('cohorts', cohorts.source);

	console.log(
		JSON.stringify(
			{
				authSource: auth.source,
				faculty: {
					source: faculty.source,
					activeCount: faculty.activeCount,
					staleCount: faculty.staleCount,
					deactivatedCount: faculty.deactivatedCount,
					isStale: faculty.isStale ?? false,
				},
				sections: {
					source: sections.source,
					totalSections: sections.totalSections,
					totalEnrolled: sections.totalEnrolled,
					byGradeLevel: sections.byGradeLevel,
					isStale: sections.isStale,
					warnings: sections.contractWarnings ?? [],
				},
				cohorts: {
					source: cohorts.source,
					count: cohorts.count,
					warnings: cohorts.warnings ?? [],
				},
			},
			null,
			2,
		),
	);
}

main().catch((error) => {
	console.error('[verify-enrollpro-source] Failed:', error instanceof Error ? error.message : error);
	process.exit(1);
});