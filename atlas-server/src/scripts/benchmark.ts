/**
 * Benchmark harness script — run from project root:
 *   SECTION_SOURCE_MODE=stub npx tsx atlas-server/src/scripts/benchmark.ts [--schoolId=N] [--schoolYearId=N] [--runs=N]
 *
 * Triggers N generation runs against the database context, captures metrics,
 * writes a machine-readable artifact to docs/verification/artifacts/.
 *
 * Recommended reproducible invocation:
 *   SECTION_SOURCE_MODE=stub npx tsx atlas-server/src/scripts/benchmark.ts --runs=5
 */

import 'dotenv/config';
import { runBenchmark } from '../services/benchmark.service.js';
import { prisma } from '../lib/prisma.js';
import { sectionSourceMode } from '../services/section-adapter.js';
import fs from 'fs';
import path from 'path';

// ─── CLI arg parsing ───

function getArg(name: string, fallback: string): string {
	const prefix = `--${name}=`;
	const arg = process.argv.find((a) => a.startsWith(prefix));
	return arg ? arg.slice(prefix.length) : fallback;
}

// ─── Preflight checks ───

async function preflight(schoolId: number, schoolYearId: number): Promise<string[]> {
	const errors: string[] = [];

	const school = await prisma.school.findUnique({ where: { id: schoolId }, select: { id: true, name: true } });
	if (!school) {
		errors.push(`School id=${schoolId} not found in database.`);
		return errors;
	}

	// Check minimum setup data exists
	const [subjectCount, facultyCount, roomCount] = await Promise.all([
		prisma.subject.count({ where: { schoolId, isActive: true } }),
		prisma.facultyMirror.count({ where: { schoolId, isActiveForScheduling: true } }),
		prisma.room.count({ where: { building: { schoolId }, isTeachingSpace: true } }),
	]);

	if (subjectCount === 0) errors.push(`No active subjects found for school=${schoolId}.`);
	if (facultyCount === 0) errors.push(`No active faculty found for school=${schoolId}.`);
	if (roomCount === 0) errors.push(`No teaching rooms found for school=${schoolId}.`);

	if (sectionSourceMode === 'enrollpro') {
		errors.push(
			`SECTION_SOURCE_MODE=enrollpro requires a reachable EnrollPro API. ` +
			`For reproducible local benchmarks, use SECTION_SOURCE_MODE=stub.`,
		);
	}

	return errors;
}

async function main() {
	const schoolId = Number(getArg('schoolId', '1'));
	const schoolYearId = Number(getArg('schoolYearId', '1'));
	const runCount = Number(getArg('runs', '5'));
	const actorId = 1; // system benchmark actor

	console.log(`[Benchmark] Configuration:`);
	console.log(`  SECTION_SOURCE_MODE: ${sectionSourceMode}`);
	console.log(`  school=${schoolId}  schoolYear=${schoolYearId}  runs=${runCount}`);
	console.log('─'.repeat(60));

	// Preflight
	console.log('[Benchmark] Running preflight checks...');
	const preflightErrors = await preflight(schoolId, schoolYearId);
	if (preflightErrors.length > 0) {
		console.error('[Benchmark] Preflight FAILED:');
		for (const e of preflightErrors) console.error(`  ✗ ${e}`);
		await prisma.$disconnect();
		process.exit(3);
	}
	console.log('[Benchmark] Preflight PASS');
	console.log('─'.repeat(60));

	console.log(`[Benchmark] Starting ${runCount} generation runs...`);

	const report = await runBenchmark(schoolId, schoolYearId, actorId, runCount, sectionSourceMode);

	// Print summary
	console.log('\n[Benchmark] Results:');
	console.log(`  Runs: ${report.stats.successCount}/${report.stats.runCount} succeeded`);
	console.log(`  Duration p50: ${report.stats.durations.p50}ms`);
	console.log(`  Duration p95: ${report.stats.durations.p95}ms`);
	console.log(`  Duration max: ${report.stats.durations.max}ms`);
	console.log(`  Assigned: min=${report.stats.assignedCount.min} max=${report.stats.assignedCount.max} mean=${report.stats.assignedCount.mean}`);
	console.log(`  Unassigned: min=${report.stats.unassignedCount.min} max=${report.stats.unassignedCount.max} mean=${report.stats.unassignedCount.mean}`);
	console.log(`  Hard violations: min=${report.stats.hardViolationCount.min} max=${report.stats.hardViolationCount.max} mean=${report.stats.hardViolationCount.mean}`);
	console.log(`  Policy blocked: min=${report.stats.policyBlockedCount.min} max=${report.stats.policyBlockedCount.max} mean=${report.stats.policyBlockedCount.mean}`);

	console.log('\n[Guardrails]:');
	console.log(`  All runs succeeded:      ${report.guardrails.allRunsSucceeded ? 'PASS' : 'FAIL'}`);
	console.log(`  Hard violations stable:   ${report.guardrails.hardViolationsStable ? 'PASS' : 'FAIL'}`);
	console.log(`  Max duration < 60s:       ${report.guardrails.maxDurationUnder60s ? 'PASS' : 'FAIL'}`);
	console.log(`  Overall:                  ${report.guardrails.overallPass ? 'PASS' : 'FAIL'}`);

	// Write artifact
	const artifactDir = path.resolve(process.cwd(), 'docs', 'verification', 'artifacts');
	if (!fs.existsSync(artifactDir)) {
		fs.mkdirSync(artifactDir, { recursive: true });
	}
	const isoStamp = new Date().toISOString().replace(/[:.]/g, '-');
	const artifactPath = path.join(
		artifactDir,
		`phase3-benchmark-${isoStamp}-school${schoolId}-year${schoolYearId}-runs${runCount}.json`,
	);
	fs.writeFileSync(artifactPath, JSON.stringify(report, null, 2), 'utf-8');
	console.log(`\n[Benchmark] Artifact written to: ${artifactPath}`);

	// Per-run detail table
	console.log('\n[Run Details]:');
	for (const run of report.runs) {
		const errorSuffix = run.error ? ` | error="${run.error}"` : '';
		console.log(
			`  Run #${run.runId}: ${run.status} | ${run.durationMs}ms | assigned=${run.assignedCount} unassigned=${run.unassignedCount} hardViolations=${run.hardViolationCount}${errorSuffix}`,
		);
	}

	await prisma.$disconnect();

	process.exit(report.guardrails.overallPass ? 0 : 1);
}

main().catch(async (err) => {
	console.error('[Benchmark] Fatal error:', err);
	await prisma.$disconnect();
	process.exit(2);
});
