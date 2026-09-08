/**
 * Effective workload policy tests (TL-C01 correction).
 *
 * Proves the Teaching Load read path consumes the persisted school/year
 * policy instead of invented defaults:
 * - resolveEffectiveWorkloadPolicy maps a persisted row to CONFIGURED and
 *   anything else to a typed UNCONFIGURED readiness state (never defaults);
 * - the same teaching fixture changes status when the persisted standard
 *   changes, without any client involvement;
 * - changing advisory credit never changes teaching utilization or excess;
 * - getAssignmentSummary performs zero policy writes (source-level guard);
 * - summary sorting/stats follow the resolved standard, collapsing
 *   standard-relative tiers when UNCONFIGURED instead of inventing 30h.
 *
 * Hermetic: no database access. Run with `npx tsx <this-file>`.
 */

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { resolveEffectiveWorkloadPolicy } from '../services/scheduling-policy.service.js';
import { computeWorkload } from '../services/workload-policy.service.js';
import { __testBuildAssignmentSummaryPage, resolveCanonicalDepartmentIdentity } from '../services/faculty-assignment.service.js';

let passCount = 0;
let failCount = 0;

function section(title: string) {
  console.log(`\n=== ${title} ===`);
}

function assert(condition: boolean, label: string) {
  if (condition) {
    passCount += 1;
    console.log(`[PASS] ${label}`);
    return;
  }
  failCount += 1;
  console.error(`[FAIL] ${label}`);
}

function assertEqual<T>(actual: T, expected: T, label: string) {
  assert(actual === expected, `${label} (expected ${String(expected)}, got ${String(actual)})`);
}

// ─── Pure resolver ───

section('resolveEffectiveWorkloadPolicy');

{
  const missing = resolveEffectiveWorkloadPolicy(null);
  assertEqual(missing.status, 'UNCONFIGURED', 'null row is UNCONFIGURED');
  assertEqual(missing.policy, null, 'null row carries no policy');
}

{
  const row = resolveEffectiveWorkloadPolicy({
    teachingStandardMinutes: 1800,
    advisoryCreditMinutes: 300,
    hardCapMinutes: 2400,
  });
  assertEqual(row.status, 'CONFIGURED', 'complete persisted row is CONFIGURED');
  assertEqual(row.policy?.teachingStandardMinutes, 1800, 'standard passes through exactly');
  assertEqual(row.policy?.advisoryCreditMinutes, 300, 'advisory passes through exactly');
  assertEqual(row.policy?.hardCapMinutes, 2400, 'cap passes through exactly');
}

{
  const custom = resolveEffectiveWorkloadPolicy({
    teachingStandardMinutes: 1500,
    advisoryCreditMinutes: 200,
    hardCapMinutes: 2000,
  });
  assertEqual(custom.status, 'CONFIGURED', 'custom persisted values are CONFIGURED');
  assertEqual(custom.policy?.teachingStandardMinutes, 1500, 'custom standard is not normalized to 1800');
}

for (const [label, row] of [
  ['undefined row', undefined],
  ['partial row', { teachingStandardMinutes: 1800, advisoryCreditMinutes: null, hardCapMinutes: 2400 }],
  ['zero standard', { teachingStandardMinutes: 0, advisoryCreditMinutes: 300, hardCapMinutes: 2400 }],
  ['negative standard', { teachingStandardMinutes: -100, advisoryCreditMinutes: 300, hardCapMinutes: 2400 }],
  ['NaN advisory', { teachingStandardMinutes: 1800, advisoryCreditMinutes: NaN, hardCapMinutes: 2400 }],
] as Array<[string, any]>) {
  const resolved = resolveEffectiveWorkloadPolicy(row);
  assertEqual(resolved.status, 'UNCONFIGURED', `${label} is UNCONFIGURED (never defaulted)`);
  assertEqual(resolved.policy, null, `${label} carries no invented policy`);
}

// ─── Persisted-standard variance changes statuses (no client involved) ───

section('persisted standard variance');

{
  // Same 28h teaching fixture under two persisted standards.
  const teachingMinutes = 1680;
  const under1800 = computeWorkload(teachingMinutes, 300, 0, {
    teachingStandardMinutes: 1800,
    advisoryCreditMinutes: 300,
    hardCapMinutes: 2400,
  });
  const over1500 = computeWorkload(teachingMinutes, 300, 0, {
    teachingStandardMinutes: 1500,
    advisoryCreditMinutes: 300,
    hardCapMinutes: 2400,
  });
  assertEqual(under1800.teachingCapacityRemainingMinutes, 120, '28h under persisted 1800 standard has 120 remaining');
  assertEqual(under1800.excessTeachingMinutes, 0, '28h under persisted 1800 standard has no excess');
  assertEqual(over1500.teachingCapacityRemainingMinutes, 0, '28h over persisted 1500 standard has zero remaining');
  assertEqual(over1500.excessTeachingMinutes, 180, '28h over persisted 1500 standard has 180 excess');
}

// ─── Advisory invariance ───

section('advisory credit invariance');

{
  const base = { teachingStandardMinutes: 1800, hardCapMinutes: 2400 };
  const low = computeWorkload(1500, 300, 0, { ...base, advisoryCreditMinutes: 300 });
  const high = computeWorkload(1500, 600, 0, { ...base, advisoryCreditMinutes: 600 });
  assertEqual(low.teachingUtilizationPercent, high.teachingUtilizationPercent, 'doubling advisory leaves utilization unchanged');
  assertEqual(low.excessTeachingMinutes, high.excessTeachingMinutes, 'doubling advisory leaves excess unchanged');
  assertEqual(low.teachingCapacityRemainingMinutes, high.teachingCapacityRemainingMinutes, 'doubling advisory leaves remaining unchanged');
  assert(low.creditedWorkloadMinutes !== high.creditedWorkloadMinutes, 'credited workload still reflects advisory');
}

// ─── Transitive zero-write statement capture ───
//
// A static call-graph detector (no database): starting from an entry function,
// it follows same-file and same-directory service callees transitively and
// reports every write statement in the reachable spans, including
// $executeRaw/$executeRawUnsafe. Positive controls prove the detector observes
// raw writes (it must flag getOrCreatePolicy and a synthetic raw-write span).

section('transitive zero-write statement capture');

const SERVICES_DIR = 'services';
const JS_KEYWORDS = new Set([
  'if', 'for', 'while', 'switch', 'catch', 'return', 'await', 'typeof', 'new',
  'console', 'Math', 'JSON', 'Promise', 'Array', 'Object', 'String', 'Number',
  'Map', 'Set', 'Date', 'Error', 'isNaN', 'isFinite', 'parseInt', 'parseFloat',
  'require', 'setTimeout', 'clearTimeout', 'then',
]);

function stripComments(source: string): string {
  const withoutBlocks = source.replace(/\/\*[\s\S]*?\*\//g, '');
  return withoutBlocks.split('\n').map((line) => {
    const idx = line.indexOf('//');
    return idx >= 0 ? line.slice(0, idx) : line;
  }).join('\n');
}

function readService(relativeFile: string): string {
  const here = dirname(fileURLToPath(import.meta.url));
  return readFileSync(resolve(here, '..', SERVICES_DIR, relativeFile), 'utf8');
}

function extractFunctionSpan(source: string, name: string): string | null {
  const patterns = [
    `export async function ${name}(`,
    `export function ${name}(`,
    `async function ${name}(`,
    `function ${name}(`,
  ];
  for (const marker of patterns) {
    const start = source.indexOf(marker);
    if (start < 0) continue;
    // Span runs to the next top-level export/function or EOF.
    const rest = source.slice(start + marker.length);
    const next = rest.search(/\nexport (async )?function |\nasync function |\nfunction |\nexport const /);
    return next < 0 ? source.slice(start) : source.slice(start, start + marker.length + next);
  }
  return null;
}

function calledIdentifiers(span: string): string[] {
  const clean = stripComments(span);
  const names = new Set<string>();
  const re = /\b([A-Za-z_$][A-Za-z0-9_$]*)\s*\(/g;
  let match: RegExpExecArray | null;
  while ((match = re.exec(clean)) !== null) {
    const name = match[1];
    if (!JS_KEYWORDS.has(name)) names.add(name);
  }
  return Array.from(names);
}

function resolveImportFile(source: string, name: string): string | null {
  const re = /import\s*\{([^}]*)\}\s*from\s*['"]([^'"]+)['"]/g;
  let match: RegExpExecArray | null;
  while ((match = re.exec(source)) !== null) {
    const members = match[1].split(',').map((part) => part.trim().split(' as ')[0].trim());
    if (members.includes(name)) {
      const spec = match[2];
      if (spec.startsWith('./') && spec.endsWith('.js')) return spec.slice(2);
    }
  }
  return null;
}

function collectTransitiveSpans(entryFile: string, entryFn: string, maxDepth = 4): Map<string, string[]> {
  const files = new Map<string, string>([[entryFile, readService(entryFile)]]);
  const visited = new Set<string>();
  const spans = new Map<string, string[]>();
  const queue: Array<{ file: string; fn: string; depth: number }> = [{ file: entryFile, fn: entryFn, depth: 0 }];
  while (queue.length > 0) {
    const { file, fn, depth } = queue.shift() as { file: string; fn: string; depth: number };
    const key = `${file}::${fn}`;
    if (visited.has(key) || depth > maxDepth) continue;
    visited.add(key);
    const source = files.get(file) as string;
    const span = extractFunctionSpan(source, fn);
    if (!span) continue;
    if (!spans.has(file)) spans.set(file, []);
    (spans.get(file) as string[]).push(`/* ${fn} */\n${span}`);
    if (depth === maxDepth) continue;
    for (const callee of calledIdentifiers(span)) {
      if (extractFunctionSpan(source, callee)) {
        queue.push({ file, fn: callee, depth: depth + 1 });
        continue;
      }
      const imported = resolveImportFile(source, callee);
      if (imported) {
        if (!files.has(imported)) {
          try {
            files.set(imported, readService(imported));
          } catch {
            continue;
          }
        }
        queue.push({ file: imported, fn: callee, depth: depth + 1 });
      }
    }
  }
  return spans;
}

const WRITE_PATTERNS: Array<[string, RegExp]> = [
  ['raw execution', /\$executeRawUnsafe|\$executeRaw\b/],
  ['model create', /\.\s*create\s*\(|\.\s*createMany\s*\(/],
  ['model upsert', /\.\s*upsert\s*\(/],
  ['model update', /\.\s*update\s*\(|\.\s*updateMany\s*\(/],
  ['model delete', /\.\s*delete\s*\(|\.\s*deleteMany\s*\(/],
  ['raw query write', /\$queryRaw[^;]*\b(INSERT|UPDATE|DELETE|CREATE|ALTER|DROP|TRUNCATE)\b/i],
  ['migration/ensure-columns', /ensureSchedulingPolicyColumns|ensureColumns|migrate/],
];

function findWriteStatements(spans: Map<string, string[]>): string[] {
  const findings: string[] = [];
  for (const [file, list] of spans) {
    for (const span of list) {
      const clean = stripComments(span);
      for (const [label, pattern] of WRITE_PATTERNS) {
        if (pattern.test(clean)) findings.push(`${file}: ${label}`);
      }
    }
  }
  return findings;
}

{
  // Entry: the read-only resolver — its FULL transitive graph must be write-free.
  const spans = collectTransitiveSpans('scheduling-policy.service.ts', 'getEffectiveWorkloadPolicy');
  assert(spans.size > 0, 'resolver transitive spans collected');
  const findings = findWriteStatements(spans);
  assertEqual(findings.length, 0, `getEffectiveWorkloadPolicy graph is write-free (got ${JSON.stringify(findings)})`);
}

{
  // Entry: the summary GET path — zero policy writes and zero raw execution.
  // (Teaching-load-cycle bookkeeping is separate authority and out of scope here;
  //  this detector scopes to policy-model writes, getOrCreatePolicy, and raw SQL.)
  const spans = collectTransitiveSpans('faculty-assignment.service.ts', 'getAssignmentSummary');
  assert(spans.size > 0, 'summary transitive spans collected');
  const policyFindings: string[] = [];
  for (const [file, list] of spans) {
    for (const span of list) {
      const clean = stripComments(span);
      if (clean.includes('getOrCreatePolicy')) policyFindings.push(`${file}: getOrCreatePolicy reference`);
      if (/schedulingPolicy\s*\.\s*(create|upsert|update)\s*\(/.test(clean)) {
        policyFindings.push(`${file}: schedulingPolicy write`);
      }
      if (/\$executeRawUnsafe|\$executeRaw\b/.test(clean)) policyFindings.push(`${file}: raw execution`);
      if (/teachingLoadCycle\s*\.\s*(create|upsert|update|delete)\s*\(/.test(clean)) {
        policyFindings.push(`${file}: teachingLoadCycle write`);
      }
      if (/refreshTeachingLoadCycle|ensureTeachingLoadCycle/.test(clean)) {
        policyFindings.push(`${file}: cycle ensure/refresh reference`);
      }
    }
  }
  assertEqual(policyFindings.length, 0, `summary graph has zero policy writes/raw SQL (got ${JSON.stringify(policyFindings)})`);
  const direct = spans.get('faculty-assignment.service.ts')?.join('\n') ?? '';
  assert(direct.includes('getEffectiveWorkloadPolicy'), 'summary resolves the read-only effective policy');
}

{
  // POSITIVE CONTROL 1: the detector must flag getOrCreatePolicy (create + raw via ensure).
  const spans = collectTransitiveSpans('scheduling-policy.service.ts', 'getOrCreatePolicy');
  const findings = findWriteStatements(spans);
  assert(findings.length > 0, `detector flags getOrCreatePolicy writes (got ${JSON.stringify(findings)})`);
  assert(findings.some((finding) => finding.includes('raw execution')), 'detector observes transitive $executeRawUnsafe');
}

{
  // POSITIVE CONTROL 2: a synthetic raw-write span is always flagged.
  const synthetic = new Map<string, string[]>([
    ['synthetic.service.ts', ['export async function wipe() { await db().$executeRawUnsafe(`DELETE FROM t`); }']],
  ]);
  const findings = findWriteStatements(synthetic);
  assert(findings.length > 0, 'detector flags synthetic raw-write span');
}

// ─── Sorting/stats follow the resolved standard ───

section('summary sorting and stats follow the resolved standard');

type SummaryRow = {
  firstName: string;
  lastName: string;
  department: string | null;
  specialization: string | null;
  isActiveForScheduling: boolean;
  subjectCount: number;
  policyCreditedHours: number;
  sectionTeachingHours: number;
  maxHoursPerWeek: number;
  assignedGradeLevels: number[];
};

function row(name: string, teaching: number, subjects = 2): SummaryRow {
  return {
    firstName: name,
    lastName: 'T',
    department: 'FIL',
    specialization: null,
    isActiveForScheduling: true,
    subjectCount: teaching > 0 ? subjects : 0,
    policyCreditedHours: teaching,
    sectionTeachingHours: teaching,
    maxHoursPerWeek: 40,
    assignedGradeLevels: [7],
  };
}

{
  // 28h fixture: below a persisted 30h standard, above a persisted 25h standard.
  const rows = [row('A', 28), row('B', 20)];
  const with30 = __testBuildAssignmentSummaryPage(rows, { sortField: 'status', sortDir: 'asc' }, 30);
  assertEqual(with30.rosterStats.reviewCount, 0, '28h is not review-counted under a 30h standard');
  const with25 = __testBuildAssignmentSummaryPage(rows, { sortField: 'status', sortDir: 'asc' }, 25);
  assertEqual(with25.rosterStats.reviewCount, 1, '28h is review-counted under a 25h standard');
  const unconfigured = __testBuildAssignmentSummaryPage(rows, { sortField: 'status', sortDir: 'asc' }, null);
  assertEqual(unconfigured.rosterStats.reviewCount, 0, 'UNCONFIGURED reports zero review count instead of inventing 30h');
  const straddle = [row('Heavy', 35), row('Light', 20)];
  const asc = __testBuildAssignmentSummaryPage(straddle, { sortField: 'status', sortDir: 'asc' }, 30);
  assert(asc.items[0].firstName === 'Heavy', `30h standard sorts excess teaching first ascending (got ${asc.items.map((i) => i.firstName).join(',')})`);
  const desc = __testBuildAssignmentSummaryPage(straddle, { sortField: 'status', sortDir: 'desc' }, 30);
  assert(desc.items[0].firstName === 'Light', `30h standard sorts excess teaching last descending (got ${desc.items.map((i) => i.firstName).join(',')})`);
}

{
  // 35h fixture exceeds a 30h standard but the tier collapses when UNCONFIGURED.
  const rows = [row('Heavy', 35), row('Light', 10)];
  const with30 = __testBuildAssignmentSummaryPage(rows, { sortField: 'status', sortDir: 'asc' }, 30);
  assert(with30.items[0].firstName === 'Heavy', 'configured standard ranks excess teaching first');
  const unconfigured = __testBuildAssignmentSummaryPage(rows, { sortField: 'status', sortDir: 'asc' }, null);
  assert(
    unconfigured.items[0].firstName === 'Heavy' || unconfigured.items[0].firstName === 'Light',
    'unconfigured sort completes without a standard comparison',
  );
  assertEqual(unconfigured.rosterStats.reviewCount, 0, 'unconfigured stats carry no standard-relative review count');
}

// ─── Persisted department authority (no client inference) ───

section('resolveCanonicalDepartmentIdentity follows persisted alias data');

function deptMap(aliases: Array<[string, string]>, labels: Array<[string, string]>) {
  const aliasMap = new Map<string, string>();
  for (const [alias, code] of aliases) aliasMap.set(alias, code);
  const labelMap = new Map<string, string>();
  for (const [code, label] of labels) labelMap.set(code, label);
  return { aliases: aliasMap, labels: labelMap, codes: new Set<string>([...labelMap.keys(), ...aliasMap.values()]) };
}

{
  // Persisted alias data set A: FILIPINO is an alias of FIL.
  const mapA = deptMap([['FILIPINO', 'FIL']], [['FIL', 'Filipino']]);
  assertEqual(resolveCanonicalDepartmentIdentity('Filipino', mapA).code, 'FIL', 'alias set A resolves Filipino to FIL');
  assertEqual(resolveCanonicalDepartmentIdentity('Filipino', mapA).status, 'MAPPED', 'alias set A marks Filipino MAPPED');
  assertEqual(resolveCanonicalDepartmentIdentity('FIL', mapA).code, 'FIL', 'exact code hit resolves');
  assertEqual(resolveCanonicalDepartmentIdentity('filipino ', mapA).code, 'FIL', 'alias matching is case/space insensitive');
  assertEqual(resolveCanonicalDepartmentIdentity('Filipino', mapA).label, 'Filipino', 'display label comes from persisted labels');
}

{
  // NEGATIVE CONTROL: same raw value, emptied persisted alias data → UNMAPPED.
  // No client rebuild, no keyword inference — the result follows the data.
  const mapB = deptMap([], [['FIL', 'Filipino']]);
  const resolved = resolveCanonicalDepartmentIdentity('Filipino', mapB);
  assertEqual(resolved.code, 'UNMAPPED', 'without the persisted alias, Filipino is UNMAPPED (never inferred)');
  assertEqual(resolved.status, 'UNMAPPED', 'missing mapping carries UNMAPPED status');
  assertEqual(resolveCanonicalDepartmentIdentity('FIL', mapB).code, 'FIL', 'exact code still resolves without aliases');
}

{
  // NEGATIVE CONTROL: retargeted persisted alias changes the result without a rebuild.
  const mapC = deptMap([['FILIPINO', 'ENG']], [['ENG', 'English'], ['FIL', 'Filipino']]);
  assertEqual(resolveCanonicalDepartmentIdentity('Filipino', mapC).code, 'ENG', 'retargeted alias is honored exactly');
}

for (const [label, raw] of [['null', null], ['blank', '   '], ['unknown', 'KLINGON']] as Array<[string, any]>) {
  const resolved = resolveCanonicalDepartmentIdentity(raw, deptMap([['FILIPINO', 'FIL']], [['FIL', 'Filipino']]));
  assertEqual(resolved.code, 'UNMAPPED', `${label} department is UNMAPPED`);
}

{
  // Code without a persisted label row keeps the code as its own label (display, not inference).
  const map = deptMap([], []);
  const resolved = resolveCanonicalDepartmentIdentity('TLE', { ...map, codes: new Set(['TLE']) });
  assertEqual(resolved.code, 'TLE', 'known code resolves');
  assertEqual(resolved.label, 'TLE', 'code without label row falls back to the code itself');
}

// ─── Summary ───

console.log(`\n=== Effective Workload Policy Tests ===`);
console.log(`Total: ${passCount + failCount}, Passed: ${passCount}, Failed: ${failCount}`);
if (failCount > 0) process.exit(1);
