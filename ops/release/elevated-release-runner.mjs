import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
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
	if (values.mode !== 'preflight') fail('ARGUMENT_REJECTED', 'Only read-only preflight is supported by this operator runner.');
	if (typeof values.sha !== 'string' || !SHA.test(values.sha)) fail('SHA_REJECTED', 'SHA must be exactly 40 hexadecimal characters.');
	if (typeof values.releaseRoot !== 'string' || !path.win32.isAbsolute(values.releaseRoot)) fail('RELEASE_ROOT_REJECTED', 'Release root must be an absolute Windows path.');
	if (values.releaseRoot.includes('..') || /[\r\n"']/u.test(values.releaseRoot)) fail('RELEASE_ROOT_REJECTED', 'Release root contains forbidden path characters.');
	const name = path.win32.basename(values.releaseRoot.replace(/[\\/]$/u, ''));
	const match = RELEASE_ROOT.exec(name);
	if (!match || match[1].toLowerCase() !== values.sha.slice(0, 12).toLowerCase()) fail('RELEASE_ROOT_REJECTED', 'Release root must be the approved SHA-prefixed supervised release directory.');
	return { ...values, sha: values.sha.toLowerCase() };
}

function safeEnvironment(env) {
	return {
		sourceDir: env.ATLAS_RUNTIME_SOURCE_DIR || null,
		releaseSha: env.ATLAS_RUNTIME_RELEASE_SHA || null,
		environmentKeys: ['ATLAS_RUNTIME_SOURCE_DIR', 'ATLAS_RUNTIME_RELEASE_SHA', 'ATLAS_RUNTIME_ENV_FILE'],
		taskName: 'ATLAS-Runtime-Supervisor',
	};
}

export function collectReadOnlyMetadata(env = process.env, runner = execFileSync) {
	let taskQuery = 'unavailable';
	let taskXml = 'unavailable';
	let listeners = [];
	let authoritativeHead = null;
	try {
		taskQuery = runner('schtasks.exe', ['/query', '/tn', 'ATLAS-Runtime-Supervisor', '/fo', 'LIST'], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] })
			.replace(/(?:password|secret|token|database_url)\s*:\s*[^\r\n]*/giu, '$1: [REDACTED]');
		taskXml = runner('schtasks.exe', ['/query', '/tn', 'ATLAS-Runtime-Supervisor', '/xml'], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] })
			.replace(/(?:password|secret|token|database_url)\s*=\s*[^\r\n<]*/giu, '$1=[REDACTED]');
	} catch {
		taskQuery = 'unavailable';
	}
	try {
		const raw = runner('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', 'Get-NetTCPConnection -LocalPort 5001,5174 -State Listen | ForEach-Object { $p=Get-CimInstance Win32_Process -Filter ("ProcessId=" + $_.OwningProcess); [pscustomobject]@{LocalPort=$_.LocalPort; OwningProcess=$_.OwningProcess; ParentProcessId=$p.ParentProcessId; CommandLine=$p.CommandLine} } | ConvertTo-Json -Compress'], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] });
		listeners = raw.trim() ? JSON.parse(raw) : [];
		if (!Array.isArray(listeners)) listeners = [listeners];
		listeners = listeners.map((entry) => ({ localPort: entry.LocalPort, pid: entry.OwningProcess, parentPid: entry.ParentProcessId }));
	} catch {
		listeners = [];
	}
	try {
		const head = runner('git.exe', ['-C', env.ATLAS_RUNTIME_SOURCE_DIR, 'rev-parse', 'HEAD'], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
		if (SHA.test(head)) authoritativeHead = head.toLowerCase();
	} catch {
		authoritativeHead = null;
	}
	return {
		capturedAt: new Date().toISOString(),
		environment: safeEnvironment(env),
		authoritativeSourceDir: env.ATLAS_RUNTIME_SOURCE_DIR || null,
		authoritativeReleaseSha: env.ATLAS_RUNTIME_RELEASE_SHA || null,
		authoritativeHead,
		taskQueryReadOnly: taskQuery,
		taskXmlExported: taskXml !== 'unavailable',
		taskXmlSha256: taskXml === 'unavailable' ? null : createHash('sha256').update(taskXml).digest('hex'),
		listeners,
		lineageReadOnly: true,
	};
}

export function runRelease(argv, options = {}) {
	const args = parseArgs(argv);
	if (args.help) return { exitCode: 0, output: 'Usage: elevated-release-runner.mjs --sha <40-hex> --release-root <approved-root> --mode preflight' };
	if (FORBIDDEN.test(argv.join(' '))) fail('FORBIDDEN_OPERATION', 'Migration, schema, seed, reset, and database commands are never accepted.');
	const root = args.releaseRoot;
	const head = options.resolveHead ? options.resolveHead(root) : execFileSync('git.exe', ['-C', root, 'rev-parse', 'HEAD'], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim().toLowerCase();
	if (!SHA.test(head) || head !== args.sha) fail('RELEASE_HEAD_MISMATCH', 'Release root HEAD does not exactly match the approved SHA.');
	const metadata = collectReadOnlyMetadata(options.env, options.runner);
	const result = {
		schema: 'atlas-elevated-release-preflight/v1',
		mode: args.mode,
		readOnly: true,
		cutoverExecuted: false,
		approvedSha: args.sha,
		releaseRoot: root,
		releaseHead: head,
		incumbent: metadata,
		rollback: { required: true, source: metadata.environment.sourceDir, sha: metadata.environment.releaseSha },
		message: 'Preflight captured; no task, runtime, database, or release files were changed.',
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
