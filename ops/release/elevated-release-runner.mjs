import { existsSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

const SHA = /^[0-9a-f]{40}$/i;
const RELEASE_ROOT = /^ATLAS-runtime-supervised-([0-9a-f]{12})-([0-9]{8})$/i;
const FORBIDDEN = /(?:migrate|db\s*push|db\s*reset|reset|seed|schema|prisma)/i;

export class ReleaseRunnerError extends Error {
	constructor(code, message) {
		super(message);
		this.code = code;
	}
}

function fail(code, message) {
	throw new ReleaseRunnerError(code, message);
}

export function parseArgs(argv) {
	const values = { mode: 'preflight', approved: false };
	for (let index = 0; index < argv.length; index += 1) {
		const arg = argv[index];
		if (arg === '--mode') values.mode = argv[++index];
		else if (arg === '--sha') values.sha = argv[++index];
		else if (arg === '--release-root') values.releaseRoot = argv[++index];
		else if (arg === '--approve-cutover') values.approved = true;
		else if (arg === '--help') values.help = true;
		else fail('ARGUMENT_REJECTED', `Unsupported argument: ${arg}`);
	}
	if (values.help) return values;
	if (!['preflight', 'cutover'].includes(values.mode)) fail('ARGUMENT_REJECTED', 'Mode must be preflight or cutover.');
	if (typeof values.sha !== 'string' || !SHA.test(values.sha)) fail('SHA_REJECTED', 'SHA must be exactly 40 hexadecimal characters.');
	if (typeof values.releaseRoot !== 'string' || !path.win32.isAbsolute(values.releaseRoot)) fail('RELEASE_ROOT_REJECTED', 'Release root must be an absolute Windows path.');
	if (values.releaseRoot.includes('..') || /[\r\n"']/u.test(values.releaseRoot)) fail('RELEASE_ROOT_REJECTED', 'Release root contains forbidden path characters.');
	const name = path.win32.basename(values.releaseRoot.replace(/[\\/]$/u, ''));
	const match = RELEASE_ROOT.exec(name);
	if (!match || match[1].toLowerCase() !== values.sha.slice(0, 12).toLowerCase()) fail('RELEASE_ROOT_REJECTED', 'Release root must be the approved SHA-prefixed supervised release directory.');
	if (values.mode === 'cutover' && !values.approved) fail('CUTOVER_APPROVAL_REQUIRED', 'Cutover requires the explicit --approve-cutover flag.');
	return { ...values, sha: values.sha.toLowerCase() };
}

function safeEnvironment(env) {
	return {
		sourceDir: env.ATLAS_RUNTIME_SOURCE_DIR || null,
		releaseSha: env.ATLAS_RUNTIME_RELEASE_SHA || null,
		taskName: 'ATLAS-Runtime-Supervisor',
	};
}

export function collectReadOnlyMetadata(env = process.env, runner = execFileSync) {
	let taskQuery = 'unavailable';
	try {
		taskQuery = runner('schtasks.exe', ['/query', '/tn', 'ATLAS-Runtime-Supervisor', '/fo', 'LIST'], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] })
			.replace(/(?:password|secret|token|database_url)\s*:\s*[^\r\n]*/giu, '$1: [REDACTED]');
	} catch {
		taskQuery = 'unavailable';
	}
	return { capturedAt: new Date().toISOString(), environment: safeEnvironment(env), taskQueryReadOnly: taskQuery };
}

export function runRelease(argv, options = {}) {
	const args = parseArgs(argv);
	if (args.help) return { exitCode: 0, output: 'Usage: elevated-release-runner.mjs --sha <40-hex> --release-root <approved-root> [--mode preflight|cutover] [--approve-cutover]' };
	if (FORBIDDEN.test(argv.join(' '))) fail('FORBIDDEN_OPERATION', 'Migration, schema, seed, reset, and database commands are never accepted.');
	const root = args.releaseRoot;
	const head = options.resolveHead ? options.resolveHead(root) : (existsSync(path.win32.join(root, '.git')) ? 'present' : 'unverified');
	const metadata = collectReadOnlyMetadata(options.env, options.runner);
	const result = {
		schema: 'atlas-elevated-release-preflight/v1',
		mode: args.mode,
		readOnly: args.mode === 'preflight',
		cutoverExecuted: false,
		approvedSha: args.sha,
		releaseRoot: root,
		releaseHead: head,
		incumbent: metadata,
		rollback: { required: true, source: metadata.environment.sourceDir, sha: metadata.environment.releaseSha },
		message: args.mode === 'preflight' ? 'Preflight captured; no task, runtime, database, or release files were changed.' : 'Cutover approval recorded; execution is intentionally delegated to the separately reviewed HIGH packet.',
	};
	return { exitCode: 0, output: JSON.stringify(result, null, 2) };
}

if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url))) {
	try {
		const result = runRelease(process.argv.slice(2));
		console.log(result.output);
	} catch (error) {
		console.error(JSON.stringify({ code: error.code || 'UNEXPECTED', message: error.message }, null, 2));
		process.exitCode = 1;
	}
}
