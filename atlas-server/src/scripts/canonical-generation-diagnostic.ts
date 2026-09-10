/**
 * GEN-C01 CLI: run the read-only canonical generation diagnostic.
 *
 * Usage:
 *   tsx src/scripts/canonical-generation-diagnostic.ts --schoolId 1 --schoolYearId 8 [--enforceShiftWindows] [--out path.json]
 *
 * Loads DATABASE_URL from `atlas-server/.env` when present (the same file the
 * server uses). Never writes to the database: no GenerationRun, LockedSession,
 * audit, publication, or source-data mutation.
 *
 * The full JSON report is written to `--out` (default
 * `canonical-generation-diagnostic-<schoolId>-<schoolYearId>.json` in the CWD)
 * so the `[prisma]`/`[hybrid-scheduler]` core logs never corrupt the JSON
 * stream. Stdout prints a compact status line.
 */

import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

function loadServerEnv() {
  try {
    const content = readFileSync(resolve(process.cwd(), '.env'), 'utf8');
    for (const line of content.split('\n')) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      const eq = trimmed.indexOf('=');
      if (eq < 0) continue;
      const key = trimmed.slice(0, eq).trim();
      const value = trimmed.slice(eq + 1).trim();
      if (!process.env[key]) process.env[key] = value;
    }
  } catch {
    // .env is optional; callers may export DATABASE_URL themselves.
  }
}

async function parseArgs(argv: string[]) {
	const args: Record<string, string> = {};
	for (let index = 0; index < argv.length; index += 1) {
		const token = argv[index];
		if (token.startsWith('--')) {
			const key = token.slice(2);
			const next = argv[index + 1];
			if (next !== undefined && !next.startsWith('--')) {
				args[key] = next;
				index += 1;
			} else {
				args[key] = 'true';
			}
		}
	}
	return args;
}

async function main() {
	loadServerEnv();
	const { runCanonicalGenerationDiagnostic, computeDatabaseSignature } =
		await import('../services/canonical-generation-diagnostic.service.js');
	const args = await parseArgs(process.argv.slice(2));
	const schoolId = Number(args.schoolId ?? 1);
	const schoolYearId = Number(args.schoolYearId ?? 8);
	if (!Number.isInteger(schoolId) || !Number.isInteger(schoolYearId) || schoolId < 1 || schoolYearId < 1) {
		console.error('Invalid schoolId/schoolYearId.');
		process.exit(2);
	}

	const before = await computeDatabaseSignature(schoolId, schoolYearId);
	const report = await runCanonicalGenerationDiagnostic(schoolId, schoolYearId, {
		enforceShiftWindows: args.enforceShiftWindows === 'true',
	});
	const after = await computeDatabaseSignature(schoolId, schoolYearId);

	const output = {
		report,
		databaseSignature: {
			before: before.sha256,
			after: after.sha256,
			equal: before.sha256 === after.sha256,
			probes: before.probes,
		},
	};

	const outPath = typeof args.out === 'string' && args.out.length > 0
		? resolve(process.cwd(), args.out)
		: resolve(process.cwd(), `canonical-generation-diagnostic-${schoolId}-${schoolYearId}.json`);
	writeFileSync(outPath, `${JSON.stringify(output, null, 2)}\n`, 'utf8');

	const signatureEqual = output.databaseSignature.equal;
	const isReady = report.status === 'CANDIDATE_READY';
	console.log(
		`[canonical-generation-diagnostic] school=${schoolId} year=${schoolYearId} status=${report.status} ` +
		`runtimeMs=${report.runtimeMs} canonicalSessions=${report.canonicalDemand.totalSessions} ` +
		`productionSessions=${report.productionDemand.totalSessions} assigned=${report.scheduler.assignedCount} ` +
		`unassigned=${report.scheduler.unassignedCount} hard=${report.violations.hardCount} ` +
		`dbSignatureEqual=${signatureEqual} report=${outPath}`,
	);
	process.exit(signatureEqual && isReady ? 0 : 1);
}

main().catch((error) => {
	console.error('[canonical-generation-diagnostic] failed:', error);
	process.exit(2);
});