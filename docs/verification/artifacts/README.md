# Benchmark Artifacts

Machine-readable artifacts from ATLAS generation benchmark runs.

## How to Run (Reproducible)

```bash
# From project root (d:\ATLAS):
SECTION_SOURCE_MODE=stub npx tsx atlas-server/src/scripts/benchmark.ts --runs=5

# PowerShell equivalent:
$env:SECTION_SOURCE_MODE='stub'; npx tsx atlas-server/src/scripts/benchmark.ts --runs=5
```

### Options

| Flag | Default | Description |
|------|---------|-------------|
| `--schoolId=N` | 1 | Target school ID |
| `--schoolYearId=N` | 1 | Target school year ID |
| `--runs=N` | 5 | Number of generation runs |

### Environment

| Variable | Values | Description |
|----------|--------|-------------|
| `SECTION_SOURCE_MODE` | `stub` / `enrollpro` / `auto` | Section data source. Use `stub` for reproducible benchmarks. |

## Pass Criteria

The benchmark harness checks three guardrails:

1. **All runs succeeded** — every generation run must complete with `COMPLETED` status.
2. **Hard violations stable** — `hardViolationCount` must be identical across all runs (deterministic output).
3. **Max duration < 60s** — no single run may exceed the 60-second performance target.

Overall **PASS** requires all three guardrails green. Exit code 0 = PASS, 1 = FAIL, 3 = preflight failure.

## Preflight Checks

Before running benchmarks, the script validates:
- School and school year exist in the database
- At least one active subject, faculty member, and teaching room exist
- `SECTION_SOURCE_MODE` is not `enrollpro` (which requires a live external service)

## Artifact Naming

Files are written with immutable timestamped names:

```
phase3-benchmark-<ISO-timestamp>-school<N>-year<N>-runs<N>.json
```

Each artifact contains: `meta` (inputs), `runs` (per-run detail), `stats` (aggregated p50/p95/max), `guardrails` (pass/fail).

## Interpreting Results

- **Assigned count**: entries successfully placed in the timetable.
- **Unassigned count**: demand items that could not be placed (may be high with stub data due to limited faculty/rooms — not a defect).
- **Policy blocked**: placement attempts rejected by policy constraints (consecutive teaching limit, daily max, etc.).
- **Hard violations**: post-construction validator findings with `HARD` severity. Must be 0 for publish readiness.
