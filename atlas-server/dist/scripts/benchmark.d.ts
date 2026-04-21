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
