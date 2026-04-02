/**
 * Benchmark harness script — run from project root:
 *   npx tsx atlas-server/src/scripts/benchmark.ts [--schoolId=N] [--schoolYearId=N] [--runs=N]
 *
 * Triggers N generation runs against the database context, captures metrics,
 * writes a machine-readable artifact to docs/verification/artifacts/.
 */

import 'dotenv/config';
import { runBenchmark, type BenchmarkReport } from '../services/benchmark.service.js';
import { prisma } from '../lib/prisma.js';
import fs from 'fs';
import path from 'path';

// ─── CLI arg parsing ───

function getArg(name: string, fallback: string): string {
	const prefix = `--${name}=`;
	const arg = process.argv.find((a) => a.startsWith(prefix));
	return arg ? arg.slice(prefix.length) : fallback;
}

async function main() {
	const schoolId = Number(getArg('schoolId', '1'));
	const schoolYearId = Number(getArg('schoolYearId', '1'));
	const runCount = Number(getArg('runs', '5'));
	const actorId = 1; // system benchmark actor

	console.log(`[Benchmark] Starting ${runCount} generation runs for school=${schoolId}, schoolYear=${schoolYearId}`);
	console.log('─'.repeat(60));

	const report = await runBenchmark(schoolId, schoolYearId, actorId, runCount);

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
	const dateStr = new Date().toISOString().slice(0, 10);
	const artifactPath = path.join(artifactDir, `phase3-benchmark-${dateStr}.json`);
	fs.writeFileSync(artifactPath, JSON.stringify(report, null, 2), 'utf-8');
	console.log(`\n[Benchmark] Artifact written to: ${artifactPath}`);

	// Per-run detail table
	console.log('\n[Run Details]:');
	for (const run of report.runs) {
		console.log(`  Run #${run.runId}: ${run.status} | ${run.durationMs}ms | assigned=${run.assignedCount} unassigned=${run.unassignedCount} hardViolations=${run.hardViolationCount}`);
	}

	await prisma.$disconnect();

	process.exit(report.guardrails.overallPass ? 0 : 1);
}

main().catch(async (err) => {
	console.error('[Benchmark] Fatal error:', err);
	await prisma.$disconnect();
	process.exit(2);
});
