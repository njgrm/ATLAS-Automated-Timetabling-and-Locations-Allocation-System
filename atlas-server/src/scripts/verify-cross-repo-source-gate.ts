import 'dotenv/config';

import { spawn, type ChildProcessByStdio } from 'node:child_process';
import path from 'node:path';
import type { Readable } from 'node:stream';
import { fileURLToPath } from 'node:url';

type CliValue = string | boolean | undefined;

interface GateOptions {
	schoolId: number;
	schoolYearId: number;
	enrollProApi: string;
	enrollProDatabaseUrl: string;
	atlasDatabaseUrl: string;
	enrollProAdminEmail: string;
	enrollProAdminPassword: string;
	reuseServer: boolean;
}

interface VerifyDomainSummary {
	source: string;
	isStale?: boolean;
	warnings?: string[];
	activeCount?: number;
	mtbFacultyCount?: number;
	totalSections?: number;
	totalEnrolled?: number;
	count?: number;
}

interface VerifySummary {
	authSource: string;
	faculty: VerifyDomainSummary;
	sections: VerifyDomainSummary & { byGradeLevel?: Record<string, number> };
	cohorts: VerifyDomainSummary;
	teachingLoad?: {
		unassignedSectionSubjectCount: number;
		facultyWithoutAssignmentsCount: number;
		adviserCount: number;
		adviserHomeroomMatchCount: number;
		maxAssignedHours: number;
		duplicateOwnershipCount: number;
		mtbFacultyCount: number;
	};
}

interface SpawnResult {
	stdout: string;
	stderr: string;
	exitCode: number | null;
}

type ServerChildProcess = ChildProcessByStdio<null, Readable, Readable>;

const DEFAULT_ENROLLPRO_DB = 'postgresql://atlas_user:incorrect404@localhost:5432/enrollpro?schema=public';
const DEFAULT_ATLAS_DB = 'postgresql://atlas_user:incorrect404@localhost:5432/atlas_db?schema=public';
const DEFAULT_ENROLLPRO_API = 'http://127.0.0.1:5000/api';
const DEFAULT_ADMIN_EMAIL = 'admin@deped.edu.ph';
const DEFAULT_ADMIN_PASSWORD = 'Admin2026!';

function parseBooleanFlag(value: CliValue, defaultValue = false): boolean {
	if (value === undefined) return defaultValue;
	if (value === true) return true;
	const normalized = String(value).trim().toLowerCase();
	if (['true', '1', 'yes'].includes(normalized)) return true;
	if (['false', '0', 'no'].includes(normalized)) return false;
	throw new Error(`Invalid boolean flag value: ${value}`);
}

function parseArgs(): GateOptions {
	const parsed: Record<string, string | boolean> = {};
	for (const arg of process.argv.slice(2)) {
		if (!arg.startsWith('--')) continue;
		const [key, value] = arg.slice(2).split('=');
		parsed[key] = value ?? true;
	}

	return {
		schoolId: Number(parsed.schoolId) || 1,
		schoolYearId: Number(parsed.schoolYearId) || 1,
		enrollProApi: typeof parsed.enrollProApi === 'string' && parsed.enrollProApi.trim().length > 0
			? parsed.enrollProApi.trim()
			: DEFAULT_ENROLLPRO_API,
		enrollProDatabaseUrl: process.env.ENROLLPRO_DATABASE_URL ?? DEFAULT_ENROLLPRO_DB,
		atlasDatabaseUrl: process.env.ATLAS_DATABASE_URL ?? process.env.DATABASE_URL ?? DEFAULT_ATLAS_DB,
		enrollProAdminEmail: process.env.ENROLLPRO_ADMIN_EMAIL ?? DEFAULT_ADMIN_EMAIL,
		enrollProAdminPassword: process.env.ENROLLPRO_ADMIN_PASSWORD ?? DEFAULT_ADMIN_PASSWORD,
		reuseServer: parseBooleanFlag(parsed.reuseServer, false),
	};
}

function buildCommand(command: string, args: string[]) {
	if (process.platform === 'win32') {
		return { executable: 'cmd.exe', finalArgs: ['/d', '/s', '/c', `${command} ${args.join(' ')}`] };
	}

	return { executable: command, finalArgs: args };
}

function spawnCommand(command: string, args: string[], cwd: string, env: NodeJS.ProcessEnv, label: string): Promise<SpawnResult> {
	const { executable, finalArgs } = buildCommand(command, args);

	return new Promise((resolve, reject) => {
		const child = spawn(executable, finalArgs, {
			cwd,
			env: { ...process.env, ...env },
			stdio: ['ignore', 'pipe', 'pipe'],
		});

		let stdout = '';
		let stderr = '';

		child.stdout.on('data', (chunk) => {
			stdout += chunk.toString();
		});

		child.stderr.on('data', (chunk) => {
			stderr += chunk.toString();
		});

		child.on('error', reject);
		child.on('close', (exitCode) => {
			if (exitCode === 0) {
				resolve({ stdout, stderr, exitCode });
				return;
			}

			reject(new Error(`${label} failed with exit code ${exitCode}.\n${stdout}${stderr}`));
		});
	});
}

async function waitForHealth(baseApiUrl: string, timeoutMs = 45000) {
	const deadline = Date.now() + timeoutMs;
	const healthUrl = `${baseApiUrl.replace(/\/$/, '')}/health`;

	while (Date.now() < deadline) {
		try {
			const response = await fetch(healthUrl);
			if (response.ok) {
				return;
			}
		} catch {
			// Keep polling until the deadline.
		}

		await new Promise((resolve) => setTimeout(resolve, 1000));
	}

	throw new Error(`Timed out waiting for EnrollPro health at ${healthUrl}.`);
}

async function loginForToken(baseApiUrl: string, email: string, password: string) {
	const response = await fetch(`${baseApiUrl.replace(/\/$/, '')}/auth/login`, {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify({ email, password }),
	});

	if (!response.ok) {
		throw new Error(`EnrollPro login failed with ${response.status} ${response.statusText}.`);
	}

	const body = await response.json() as { token?: string };
	if (!body.token) {
		throw new Error('EnrollPro login response did not include a token.');
	}

	return body.token;
}

function parseVerifySummary(rawOutput: string): VerifySummary {
	const trimmed = rawOutput.trim();
	if (trimmed.startsWith('{')) {
		return JSON.parse(trimmed) as VerifySummary;
	}

	const match = trimmed.match(/\{\s*"authSource"[\s\S]*\}\s*$/);
	if (!match) {
		throw new Error(`Unable to parse verifier JSON output.\n${rawOutput}`);
	}

	return JSON.parse(match[0]) as VerifySummary;
}

function assertLiveSummary(summary: VerifySummary) {
	if (summary.faculty.source !== 'enrollpro') {
		throw new Error(`Expected live faculty source=enrollpro, got ${summary.faculty.source}.`);
	}
	if (summary.sections.source !== 'enrollpro') {
		throw new Error(`Expected live sections source=enrollpro, got ${summary.sections.source}.`);
	}
	if (summary.cohorts.source !== 'enrollpro') {
		throw new Error(`Expected live cohorts source=enrollpro, got ${summary.cohorts.source}.`);
	}
	if (summary.faculty.activeCount !== 146) {
		throw new Error(`Expected 146 active faculty, got ${summary.faculty.activeCount}.`);
	}
	if (summary.faculty.mtbFacultyCount !== 0) {
		throw new Error(`Expected 0 MTB-specialized faculty after JHS cleanup, got ${summary.faculty.mtbFacultyCount}.`);
	}
	if (summary.sections.totalSections !== 83) {
		throw new Error(`Expected 83 sections, got ${summary.sections.totalSections}.`);
	}
	if (summary.sections.totalEnrolled !== 3311) {
		throw new Error(`Expected 3311 enrolled learners, got ${summary.sections.totalEnrolled}.`);
	}
	if (summary.cohorts.count !== 12) {
		throw new Error(`Expected 12 cohorts, got ${summary.cohorts.count}.`);
	}
	if (!summary.teachingLoad) {
		throw new Error('Expected teaching-load diagnostics in verifier output.');
	}
	if (summary.teachingLoad.unassignedSectionSubjectCount !== 0) {
		throw new Error(`Expected 0 unassigned section-subject pairs, got ${summary.teachingLoad.unassignedSectionSubjectCount}.`);
	}
	if (summary.teachingLoad.facultyWithoutAssignmentsCount !== 0) {
		throw new Error(`Expected 0 faculty without assignments, got ${summary.teachingLoad.facultyWithoutAssignmentsCount}.`);
	}
	if (summary.teachingLoad.adviserCount !== summary.teachingLoad.adviserHomeroomMatchCount) {
		throw new Error(`Expected adviser homeroom coverage to match adviser count (${summary.teachingLoad.adviserCount}), got ${summary.teachingLoad.adviserHomeroomMatchCount}.`);
	}
	if (summary.teachingLoad.maxAssignedHours > 40) {
		throw new Error(`Expected max assigned hours <= 40, got ${summary.teachingLoad.maxAssignedHours}.`);
	}
	if (summary.teachingLoad.duplicateOwnershipCount !== 0) {
		throw new Error(`Expected 0 duplicate ownership conflicts, got ${summary.teachingLoad.duplicateOwnershipCount}.`);
	}
}

function assertCachedSummary(summary: VerifySummary) {
	if (summary.faculty.source !== 'cached-enrollpro') {
		throw new Error(`Expected cached faculty source=cached-enrollpro, got ${summary.faculty.source}.`);
	}
	if (summary.sections.source !== 'cached-enrollpro') {
		throw new Error(`Expected cached sections source=cached-enrollpro, got ${summary.sections.source}.`);
	}
	if (summary.cohorts.source !== 'cached-enrollpro') {
		throw new Error(`Expected cached cohorts source=cached-enrollpro, got ${summary.cohorts.source}.`);
	}
	if (summary.sections.totalSections !== 83 || summary.sections.totalEnrolled !== 3311) {
		throw new Error('Cached verification totals diverged from the live upstream snapshot.');
	}
	if (summary.faculty.activeCount !== 146 || summary.faculty.mtbFacultyCount !== 0) {
		throw new Error('Cached faculty totals diverged from the live MTB-free upstream snapshot.');
	}
	if (!summary.teachingLoad || summary.teachingLoad.unassignedSectionSubjectCount !== 0 || summary.teachingLoad.facultyWithoutAssignmentsCount !== 0) {
		throw new Error('Cached verification did not preserve the seeded teaching-load baseline.');
	}
}

async function main() {
	const options = parseArgs();
	const scriptDir = path.dirname(fileURLToPath(import.meta.url));
	const repoRoot = path.resolve(scriptDir, '..', '..', '..');
	const atlasServerDir = path.resolve(repoRoot, 'atlas-server');
	const enrollProServerDir = path.resolve(repoRoot, 'EnrollPro', 'server');
	const enrollProApi = options.enrollProApi.replace(/\/$/, '');

	console.log('[verify-cross-repo-source-gate] Seeding EnrollPro authoritative data...');
	await spawnCommand('npm', ['run', 'db:seed'], enrollProServerDir, {
		DATABASE_URL: options.enrollProDatabaseUrl,
	}, 'EnrollPro db:seed');
	await spawnCommand('npm', ['run', 'db:seed-atlas-source'], enrollProServerDir, {
		DATABASE_URL: options.enrollProDatabaseUrl,
	}, 'EnrollPro db:seed-atlas-source');

	let serverChild: ServerChildProcess | undefined;
	const healthReady = await (async () => {
		if (options.reuseServer) {
			await waitForHealth(enrollProApi);
			return true;
		}

		try {
			await waitForHealth(enrollProApi, 3000);
			return true;
		} catch {
			const { executable, finalArgs } = buildCommand('npx', ['tsx', 'src/server.ts']);
			const spawnedServer = spawn(executable, finalArgs, {
				cwd: enrollProServerDir,
				env: {
					...process.env,
					DATABASE_URL: options.enrollProDatabaseUrl,
					PORT: '5000',
				},
				stdio: ['ignore', 'pipe', 'pipe'],
			}) as ServerChildProcess;
			serverChild = spawnedServer;

			spawnedServer.stdout.on('data', (chunk) => process.stdout.write(chunk));
			spawnedServer.stderr.on('data', (chunk) => process.stderr.write(chunk));
			await waitForHealth(enrollProApi);
			return true;
		}
	})();

	if (!healthReady) {
		throw new Error('EnrollPro server did not become healthy.');
	}

	try {
		const token = await loginForToken(enrollProApi, options.enrollProAdminEmail, options.enrollProAdminPassword);

		console.log('[verify-cross-repo-source-gate] Resetting ATLAS mirror state from live EnrollPro...');
		await spawnCommand('npx', ['tsx', 'src/scripts/seed-realistic.ts', `--schoolId=${options.schoolId}`, `--schoolYearId=${options.schoolYearId}`, '--reset', `--authToken=${token}`], atlasServerDir, {
			DATABASE_URL: options.atlasDatabaseUrl,
			ENROLLPRO_API: enrollProApi,
			SECTION_SOURCE_MODE: 'auto',
			COHORT_SOURCE_MODE: 'auto',
			FACULTY_ADAPTER: 'enrollpro',
		}, 'ATLAS seed-realistic');

		const liveVerify = await spawnCommand('npm', ['run', 'verify:enrollpro-source', '--', `--schoolId=${options.schoolId}`, `--schoolYearId=${options.schoolYearId}`, `--authToken=${token}`], atlasServerDir, {
			DATABASE_URL: options.atlasDatabaseUrl,
			ENROLLPRO_API: enrollProApi,
			SECTION_SOURCE_MODE: 'auto',
			COHORT_SOURCE_MODE: 'auto',
			FACULTY_ADAPTER: 'enrollpro',
		}, 'ATLAS verify:enrollpro-source (live)');
		const liveSummary = parseVerifySummary(liveVerify.stdout);
		assertLiveSummary(liveSummary);

		const cachedVerify = await spawnCommand('npm', ['run', 'verify:enrollpro-source', '--', `--schoolId=${options.schoolId}`, `--schoolYearId=${options.schoolYearId}`, `--authToken=${token}`], atlasServerDir, {
			DATABASE_URL: options.atlasDatabaseUrl,
			ENROLLPRO_API: 'http://127.0.0.1:59999/api',
			SECTION_SOURCE_MODE: 'auto',
			COHORT_SOURCE_MODE: 'auto',
			FACULTY_ADAPTER: 'enrollpro',
		}, 'ATLAS verify:enrollpro-source (cached)');
		const cachedSummary = parseVerifySummary(cachedVerify.stdout);
		assertCachedSummary(cachedSummary);

		console.log(JSON.stringify({
			schoolId: options.schoolId,
			schoolYearId: options.schoolYearId,
			enrollProApi,
			live: liveSummary,
			cachedFallback: cachedSummary,
		}, null, 2));
	} finally {
		serverChild?.kill();
	}
}

main().catch((error) => {
	console.error('[verify-cross-repo-source-gate] Failed:', error instanceof Error ? error.message : error);
	process.exit(1);
});