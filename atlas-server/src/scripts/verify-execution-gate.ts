#!/usr/bin/env node
/**
 * Execution Gate Validator v3 — planner-owned manifest enforcement.
 *
 * Usage:
 *   npm run verify:execution-gate -- --plan <plan-stem> --prompt <prompt-id>
 *
 * Reads the canonical task manifest from the planner-owned location:
 *   docs/verification/teaching-load-dynamic-recovery-planner-gate-manifest-v1.json
 *
 * Validates: manifest hash, CLI identity, ledger, reviews, summaries, test
 * baselines, production call-sites, predecessor gates, external blocker
 * allowlist, and structured task classification.
 *
 * Exit 0 = GO, Exit 1 = NO-GO.
 */

import { readFileSync, existsSync, readdirSync, realpathSync } from 'node:fs';
import { join, resolve, relative, isAbsolute } from 'node:path';
import { createHash } from 'node:crypto';
import {
  assertTocEvidence,
  assertDomainTotal,
  assertGateReceiptMatchesPrompt,
  assertGateReviewIdentity,
  assertSingleHighRiskScope,
  assertMigrationStatusConsistent,
  assertFormalReviewSatisfiesIssuance,
  assertDumpFactsBound,
  assertProposalMatchesReviewReceipt,
  assertProbeFreshness,
  assertReviewedPathLists,
  assertReviewedPathInsideWorkspace,
  assertNoSecretsInProbeOutput,
  assertProbeTargetClassified,
  assertReceiptHasRequiredFields,
  assertReceiptHexMatchesPins,
  assertProposalReviewedFileConsistent,
  assertDumpInventoryMatchesContract,
  assertProbeInventoryMatchesContract,
  assertProbeTimestampInWindow,
  assertGateReceiptBindsPreGateAuthority,
  assertSuccessorManifestPinsGateReceipt,
  assertNoReceiptCycle,
  assertStrictExitCodeEqual,
  assertStrictGateExitCodeZero,
  assertProbeRawOutputPathShape,
  assertScopeClosureMatches,
  readControlEnforcement,
  assertConsumedControlsExact,
  parseRelativeRuntimeImports,
  resolveRuntimeSpecifierToSource,
  collectTransitiveLocalImports,
  assertFilesystemFailurePolicy,
  filesystemFailureCodeForStage,
  assertMutationBoundaryZero,
  assertStrictScalarPolicy,
  assertProbeOutputPolicy,
  assertScopeClosurePolicyFlags,
  assertTransitiveImportConfig,
  assertTransitiveImportClosurePolicy05R7C,
  assertAdvisoryReviewContractShape,
  assertAdvisoryStreak,
  assertAdvisoryTraceContractShape,
  assertAdvisoryTraceStreak,
  assertLexicalImportParsingContract,
  diffTocObjects,
} from '../services/database-recovery-evidence-gate.js';

// ─── Types ───

interface PlannerManifestTask {
  id: string;
  requirement: string;
  externalEligible?: boolean;
}

interface PlannerManifestPrompt {
  id: string;
  predecessors: string[];
  tasks: PlannerManifestTask[];
  go: string;
  gateReceiptTaskId?: string;
}

interface PlannerManifestCanonicalPaths {
  ledger: string;
  summary: string;
  evidenceLog: string;
  reviewDir: string;
  sequence?: string;
}

interface PlannerManifest {
  $schema: string;
  version: string;
  owner: { role: string; context: string; executorMayModify: boolean };
  plan: string;
  canonicalPaths: PlannerManifestCanonicalPaths;
  plannerOwnedArtifacts?: Array<{ path: string; sha256: string }>;
  sourcePrompts: Array<{ id: string; path: string; sha256: string }>;
  statuses: {
    sourceImplementation: string[];
    liveRuntime: string[];
    task: string[];
    advanceRequires: string;
    conditionalGoUnlocksDependencies: boolean;
  };
  externalBlockerAllowlist: string[];
  neverExternal: string[];
  reviewModel: {
    defaultTaskRisk: string;
    riskTiers: string[];
    promptBatchReviewRequired: boolean;
    highRiskCheckpointReviewRequiredBeforeAction: boolean;
    highRiskTriggers: string[];
    taskRiskOverrides: Record<string, string>;
  };
  prompts: PlannerManifestPrompt[];
  testBaselines: {
    minimumExistingAssertions: number;
    suites: Array<{ path: string; minimum: number }>;
    countingRule: string;
  };
  reviewRequirements: {
    author: string;
    requiredFields: string[];
    invalidValues: string[];
    latestReviewMustBeZeroFix: boolean;
    oneLatestReviewPerRequiredTaskAndPhase: boolean;
    requiredCoverage: string;
    lowAndMediumTasksMaySharePromptReview: boolean;
    implementerMayAuthorReview: boolean;
  };
  validatorRequirements: {
    manifestHashMustMatchSequence: boolean;
    planArgumentMustEqualManifest: boolean;
    promptMustExist: boolean;
    requiredPathFailuresAreErrors: boolean;
    productionReachability: string[];
    tests: string[];
  };
}

interface LedgerTask {
  id: string;
  title: string;
  status: string;
  evidence: string;
  dependencies: string;
}

interface ReviewArtifact {
  path: string;
  implementer: string;
  reviewer: string;
  taskId: string;
  promptId: string;
  commitHash: string;
  filesInspected: string[];
  commandsRerun: string[];
  verdict: string;
  zeroFix: boolean;
  zeroFixPresent: boolean;
}

interface Finding {
  code: string;
  severity: 'ERROR' | 'WARNING';
  message: string;
}

// ─── Constants ───

const PLANNER_MANIFEST_REL = join('docs', 'verification', 'teaching-load-dynamic-recovery-planner-gate-manifest-v1.json');
const EXPECTED_MANIFEST_HASH = '50D7A9C6F2FD524CAB37A30D7E2C9CE05DFA44557A979CBC7B9DA195B5DC4D6F';

// ─── Globals ───

const findings: Finding[] = [];
const workspaceRoot = resolve(process.cwd(), '..');

// ─── 05R7B: planner-control consumption inventory ───
//
// Every check records one mark per planner contract field at the exact line
// that branches on the field. `checkControlEnforcement` (exact-gate step
// 10c8) then requires the collected set to equal the planner-declared
// enforceable inventory exactly. The set is reset at the start of every
// gate run; hermetic CLI fixtures execute in separate processes, so marks
// never leak across runs.
const consumedControls = new Set<string>();

function consumeControl(pointer: string) {
  consumedControls.add(pointer);
}

/**
 * 05R7B marker: the prompt-matching planner contract declares
 * `controlEnforcement`. All 05R7B gate extensions (consumed inventory,
 * transitive imports, filesystem policy, advisory identity, mutation
 * boundary) activate only for such contracts, so frozen earlier prompts
 * keep byte-identical gate behavior.
 */
function is05R7BContract(contract: unknown): boolean {
  const ce = (contract as { controlEnforcement?: unknown } | null | undefined)?.controlEnforcement;
  return !!ce && typeof ce === 'object';
}

/**
 * 05R7C marker: the prompt-matching planner contract declares
 * `advisoryTraceContract`. Trace-only advisory handling activates only for
 * such contracts. 05R7C contracts also declare controlEnforcement, so they
 * remain 05R7B contracts for shared wiring; trace handling is additive.
 */
function is05R7CTraceContract(contract: unknown): boolean {
  const adv = (contract as { advisoryTraceContract?: unknown } | null | undefined)?.advisoryTraceContract;
  return !!adv && typeof adv === 'object';
}

function error(code: string, message: string) {
  findings.push({ code, severity: 'ERROR', message });
  console.error(`[FAIL] ${code}: ${message}`);
}

function warn(code: string, message: string) {
  findings.push({ code, severity: 'WARNING', message });
  console.warn(`[WARN] ${code}: ${message}`);
}

function pass(message: string) {
  console.log(`[PASS] ${message}`);
}

// ─── File I/O ───

function readFile(relPath: string): string {
  const abs = join(workspaceRoot, relPath);
  if (!existsSync(abs)) return '';
  return readFileSync(abs, 'utf-8');
}

function fileExists(relPath: string): boolean {
  return existsSync(join(workspaceRoot, relPath));
}

function sha256File(relPath: string): string {
  const abs = relPath.match(/^[A-Z]:\\/i) || relPath.startsWith('/') ? relPath : join(workspaceRoot, relPath);
  const content = readFileSync(abs);
  return createHash('sha256').update(content).digest('hex').toUpperCase();
}

// ─── CLI ───

interface CliArgs { plan: string; prompt: string; manifest?: string; }

function parseArgs(): CliArgs {
  const args = process.argv.slice(2);
  const result: CliArgs = { plan: '', prompt: '' };
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--plan' && args[i + 1]) result.plan = args[++i];
    else if (args[i] === '--prompt' && args[i + 1]) result.prompt = args[++i];
    else if (args[i] === '--manifest' && args[i + 1]) result.manifest = args[++i];
  }
  if (!result.plan || !result.prompt) {
    console.error('Usage: npm run verify:execution-gate -- --plan <plan-stem> --prompt <prompt-id> [--manifest <path>]');
    process.exit(1);
  }
  return result;
}

// ─── Manifest Loading ───

function loadPlannerManifest(manifestRelOverride?: string): PlannerManifest {
  const relPath = manifestRelOverride ?? PLANNER_MANIFEST_REL;
  // Support both absolute and relative paths
  const abs = relPath.match(/^[A-Z]:\\/i) || relPath.startsWith('/') ? relPath : join(workspaceRoot, relPath);
  if (!existsSync(abs)) {
    error('MANIFEST_MISSING', `Planner manifest not found at ${abs}`);
    process.exit(1);
  }
  return JSON.parse(readFileSync(abs, 'utf-8'));
}

// ─── Ledger Parsing ───

function parseLedgerTasks(content: string): LedgerTask[] {
  const tasks: LedgerTask[] = [];
  // Match "### Task TL-01.1: Title" or "### TL-01.1: Title" or "### 06R.0: Title"
  const taskRegex = /### (?:Task )?([\w-]+\.[\w.-]+):\s*(.+)/g;
  let match;
  while ((match = taskRegex.exec(content)) !== null) {
    const nextIdx = content.indexOf('### ', match.index + match[0].length);
    const endIdx = nextIdx >= 0 ? nextIdx : content.length;
    const block = content.substring(match.index, endIdx);
    const statusMatch = block.match(/\*\*Status:\*\*\s*(.+?)(?:\n|$)/);
    const evidenceMatch = block.match(/\*\*Evidence:\*\*\s*(.+?)(?:\n|$)/);
    const depsMatch = block.match(/\*\*Dependencies:\*\*\s*(.+?)(?:\n|$)/);
    tasks.push({
      id: match[1],
      title: match[2].trim(),
      status: statusMatch?.[1]?.trim() ?? 'UNKNOWN',
      evidence: evidenceMatch?.[1]?.trim() ?? '',
      dependencies: depsMatch?.[1]?.trim() ?? '',
    });
  }
  return tasks;
}

// ─── Review Artifact Parsing ───

function parseSectionList(content: string, headingRe: RegExp): string[] {
  const items: string[] = [];
  const lines = content.split('\n');
  let inSection = false;
  for (const line of lines) {
    if (/^#{1,3}\s/.test(line)) {
      inSection = headingRe.test(line);
      continue;
    }
    if (inSection) {
      const m = line.match(/^\s*[-*]\s+(.+)/);
      if (m) items.push(m[1].trim());
    }
  }
  return items;
}

function parseReviewArtifacts(reviewDir: string): ReviewArtifact[] {
  const artifacts: ReviewArtifact[] = [];
  const absDir = join(workspaceRoot, reviewDir);
  if (!existsSync(absDir)) return artifacts;

  const files = readdirSync(absDir).filter(f => f.endsWith('.md'));
  for (const file of files) {
    const content = readFileSync(join(absDir, file), 'utf-8');
    const implementerMatch = content.match(/implementerContextId:\s*(.+)/i);
    const reviewerMatch = content.match(/reviewerContextId:\s*(.+)/i);
    const taskMatch = content.match(/taskOrPhaseIds:\s*\n((?:\s*-\s*.+\n?)+)/i)
      || content.match(/task[s]?:\s*(.+)/i);
    const commitMatch = content.match(/reviewedDiffSha256:\s*(.+)/i)
      || content.match(/(?:Reviewed commit|diff hash|Diff):\s*(.+)/i);
    const filesMatch = content.match(/Files?\s*[Ii]nspected:\s*(.+)/i);
    const commandsMatch = content.match(/Commands?\s*[Rr]erun:\s*(.+)/i);
    const verdictMatch = content.match(/verdict:\s*(.+)/i);
    const explicitZeroFixMatch = content.match(/zeroFix\s*:\s*(true|false)/i);
    const genericZeroFixMatch = explicitZeroFixMatch ? null : content.match(/zero.?fix/i);
    const zeroFixPresent = explicitZeroFixMatch != null || genericZeroFixMatch != null;

    let taskId = '';
    if (taskMatch?.[1]) {
      // Extract task IDs from YAML list or comma-separated
      const raw = taskMatch[1];
      const ids = raw.match(/(?:TL|DBR)-[\w.-]+/g) || raw.split(',').map(s => s.trim()).filter(Boolean);
      taskId = ids.join(', ');
    }

    // Inline `Files Inspected:` / `Commands Rerun:` values first, then fall
    // back to structured Markdown sections (`## Files Inspected` with bullets).
    let filesInspected = filesMatch?.[1]?.split(',').map(s => s.trim()).filter(Boolean) ?? [];
    if (filesInspected.length === 0) {
      filesInspected = parseSectionList(content, /files?\s*inspected/i);
    }
    let commandsRerun = commandsMatch?.[1]?.split(',').map(s => s.trim()).filter(Boolean) ?? [];
    if (commandsRerun.length === 0) {
      commandsRerun = parseSectionList(content, /commands?(\s|_)*(rerun|re-run)?|independently\s*rerun/i);
    }
    // A bare section heading with no parseable value yields [''] — normalize.
    filesInspected = filesInspected.filter(s => s.length > 0);
    commandsRerun = commandsRerun.filter(s => s.length > 0);

    artifacts.push({
      path: file,
      implementer: implementerMatch?.[1]?.trim() ?? '',
      reviewer: reviewerMatch?.[1]?.trim() ?? '',
      taskId,
      promptId: '',
      commitHash: commitMatch?.[1]?.trim() ?? '',
      filesInspected,
      commandsRerun,
      verdict: verdictMatch?.[1]?.trim() ?? '',
      zeroFix: explicitZeroFixMatch?.[1]?.toLowerCase() === 'true' || false,
      zeroFixPresent,
    });
  }
  return artifacts;
}

// ─── Import Path Analysis ───

function analyzeImports(serviceFile: string): { importers: string[]; callPaths: string[] } {
  const importers: string[] = [];
  const callPaths: string[] = [];
  const serviceName = serviceFile.split('/').pop()?.replace('.service.ts', '') ?? serviceFile.replace('.service.ts', '');

  const routeDir = join(workspaceRoot, 'atlas-server', 'src', 'routes');
  if (existsSync(routeDir)) {
    for (const f of readdirSync(routeDir).filter(f => f.endsWith('.ts'))) {
      const content = readFileSync(join(routeDir, f), 'utf-8');
      if (content.includes(`from`) && content.includes(serviceName)) {
        importers.push(`routes/${f}`);
        const importLine = content.split('\n').find(l => l.includes(serviceName) && l.includes('from'));
        if (importLine) callPaths.push(importLine.trim());
      }
    }
  }

  const serviceDir = join(workspaceRoot, 'atlas-server', 'src', 'services');
  if (existsSync(serviceDir)) {
    const routeImported = new Set<string>();
    if (existsSync(routeDir)) {
      for (const f of readdirSync(routeDir).filter(f => f.endsWith('.ts'))) {
        const content = readFileSync(join(routeDir, f), 'utf-8');
        for (const sf of readdirSync(serviceDir).filter(s => s.endsWith('.ts'))) {
          if (content.includes(sf.replace('.service.ts', ''))) routeImported.add(sf);
        }
      }
    }

    for (const rf of Array.from(routeImported)) {
      const content = readFileSync(join(serviceDir, rf), 'utf-8');
      if (rf !== serviceFile.split('/').pop() && content.includes(serviceName)) {
        importers.push(`services/${rf}`);
        const importLine = content.split('\n').find(l => l.includes(serviceName) && l.includes('from'));
        if (importLine) callPaths.push(importLine.trim());
      }
    }
  }

  return { importers, callPaths };
}

// ─── Check Functions ───

function checkManifestHash(manifestRelPath: string, manifest: PlannerManifest) {
  const actualHash = sha256File(manifestRelPath);
  let expectedHash = EXPECTED_MANIFEST_HASH;

  if (manifestRelPath !== PLANNER_MANIFEST_REL) {
    const pinPath = `${manifestRelPath}.sha256`;
    const pinAbs = pinPath.match(/^[A-Z]:\\/i) || pinPath.startsWith('/')
      ? pinPath
      : join(workspaceRoot, pinPath);
    if (!existsSync(pinAbs)) {
      error('MANIFEST_PIN_MISSING', `Custom planner manifest pin not found at ${pinAbs}`);
      return;
    }
    const pinText = readFileSync(pinAbs, 'utf-8').trim();
    const match = pinText.match(/^([A-Fa-f0-9]{64})(?:\s+.+)?$/);
    if (!match) {
      error('MANIFEST_PIN_INVALID', `Manifest pin at ${pinAbs} must begin with one SHA-256 value.`);
      return;
    }
    expectedHash = match[1].toUpperCase();
  }

  if (manifest.canonicalPaths.sequence) {
    const sequenceContent = readFile(manifest.canonicalPaths.sequence);
    if (!sequenceContent) {
      error('SEQUENCE_PATH_MISSING', `Sequence file not found: ${manifest.canonicalPaths.sequence}`);
    } else if (!sequenceContent.toUpperCase().includes(expectedHash)) {
      error('SEQUENCE_PIN_MISMATCH', `Sequence ${manifest.canonicalPaths.sequence} does not contain manifest pin ${expectedHash}.`);
    } else {
      pass(`Sequence pin matches manifest sidecar: ${expectedHash}`);
    }
  }

  if (actualHash !== expectedHash) {
    error('MANIFEST_HASH_MISMATCH',
      `Planner manifest hash ${actualHash} does not match expected ${expectedHash}. The manifest may have been modified.`);
  } else {
    pass(`Planner manifest hash verified: ${actualHash}`);
  }
}

function checkSourcePromptHashes(manifest: PlannerManifest) {
  for (const source of manifest.sourcePrompts) {
    if (!fileExists(source.path)) {
      error('SOURCE_PROMPT_MISSING', `Source prompt ${source.id} not found: ${source.path}`);
      continue;
    }
    const actual = sha256File(source.path);
    if (actual !== source.sha256.toUpperCase()) {
      error('SOURCE_PROMPT_HASH_MISMATCH', `Source prompt ${source.id} hash ${actual} does not match manifest ${source.sha256}.`);
    } else {
      pass(`Source prompt ${source.id} hash verified`);
    }
  }
}

function promptClosure(manifest: PlannerManifest, currentPrompt: string): PlannerManifestPrompt[] {
  const byId = new Map(manifest.prompts.map(prompt => [prompt.id, prompt]));
  const selected = new Set<string>();
  const visit = (id: string) => {
    if (selected.has(id)) return;
    const prompt = byId.get(id);
    if (!prompt) return;
    for (const predecessor of prompt.predecessors ?? []) visit(predecessor);
    selected.add(id);
  };
  visit(currentPrompt);
  return manifest.prompts.filter(prompt => selected.has(prompt.id));
}

function checkPlanArgument(manifest: PlannerManifest, cliPlan: string) {
  if (manifest.plan !== cliPlan) {
    error('PLAN_MISMATCH',
      `CLI --plan "${cliPlan}" does not match manifest.plan "${manifest.plan}".`);
  } else {
    pass(`CLI plan matches manifest: ${manifest.plan}`);
  }
}

function checkPromptExists(manifest: PlannerManifest, promptId: string) {
  const found = manifest.prompts.find(p => p.id === promptId);
  if (!found) {
    error('PROMPT_ABSENT',
      `Prompt "${promptId}" not found in manifest prompts: ${manifest.prompts.map(p => p.id).join(', ')}`);
  } else {
    pass(`Prompt ${promptId} exists in manifest`);
  }
}

function checkExactPaths(manifest: PlannerManifest) {
  const cp = manifest.canonicalPaths;
  if (!fileExists(cp.ledger)) {
    error('LEDGER_PATH', `Exact ledger path not found: ${cp.ledger}`);
  } else {
    pass(`Exact ledger path: ${cp.ledger}`);
  }
  if (!fileExists(cp.summary)) {
    error('SUMMARY_PATH', `Exact summary path not found: ${cp.summary}`);
  } else {
    pass(`Exact summary path: ${cp.summary}`);
  }
  if (!fileExists(cp.evidenceLog)) {
    error('EVIDENCE_LOG_PATH', `Evidence log not found: ${cp.evidenceLog}`);
  } else {
    pass(`Evidence log path: ${cp.evidenceLog}`);
  }
}

function checkManifestAndLedger(manifest: PlannerManifest, ledgerTasks: LedgerTask[]) {
  const ledgerIds = new Set(ledgerTasks.map(t => t.id));
  const manifestIds = new Set<string>();

  for (const prompt of manifest.prompts) {
    for (const task of prompt.tasks) {
      manifestIds.add(task.id);
      if (!ledgerIds.has(task.id)) {
        error('TASK_MISSING', `Task ${task.id} ("${task.requirement}") from manifest is absent from ledger`);
      }
    }
  }

  for (const task of ledgerTasks) {
    if (!manifestIds.has(task.id)) {
      error('TASK_COLLAPSED', `Task ${task.id} ("${task.title}") in ledger has no manifest entry — may be collapsed or undocumented`);
    }
  }

  pass(`Manifest/ledger cross-check: ${manifestIds.size} manifest tasks, ${ledgerTasks.length} ledger tasks`);
}

function currentGateReceiptTaskId(manifest: PlannerManifest, currentPrompt: string): string {
  const prompt = manifest.prompts.find(p => p.id === currentPrompt);
  if (!prompt) return '';
  // Planner-driven: prefer the manifest-declared gate receipt task ID when
  // present (05R6 declares DBR-05R6.G explicitly). Fall back to suffix search
  // only for older prompts without an explicit declaration.
  if ((prompt as PlannerManifestPrompt).gateReceiptTaskId) {
    return (prompt as PlannerManifestPrompt).gateReceiptTaskId as string;
  }
  return prompt?.tasks.find(t => t.id.endsWith('.G'))?.id ?? '';
}

interface GateReceiptLifecycle {
  taskId?: string;
  preGateLedgerStatus?: string;
  excludeFromPreGateDoneRequirement?: boolean;
  excludeFromPreGateReviewCoverage?: boolean;
  excludeFromSafeIncompleteCount?: boolean;
  markDoneOnlyAfterExitZeroReceiptStored?: boolean;
}

/**
 * Locate the planner-owned contract for the current prompt. The manifest may
 * declare several contracts (05R5, 05R6); the correct one is the file whose
 * parsed `prompt` field matches the CLI prompt. Filename matching is a
 * fallback; the legacy first-entry fallback preserves byte-compatibility for
 * prompts without a dedicated contract.
 */
function findPlannerContractForPrompt(manifest: PlannerManifest, cliPrompt: string): string | undefined {
  const candidates = (manifest.plannerOwnedArtifacts ?? []).filter(a =>
    (a.path ?? '').toLowerCase().endsWith('-planner-contract.json'));
  for (const c of candidates) {
    try {
      const abs = resolveGatePath(c.path);
      if (!existsSync(abs)) continue;
      const parsed = JSON.parse(readFileSync(abs, 'utf-8')) as { prompt?: string };
      if (parsed.prompt && parsed.prompt.toLowerCase() === cliPrompt.toLowerCase()) return c.path;
    } catch {
      continue;
    }
  }
  const lowerPrompt = cliPrompt.toLowerCase();
  const byName = candidates.find(a => (a.path ?? '').toLowerCase().includes(lowerPrompt));
  if (byName) return byName.path;
  return candidates[0]?.path;
}

function readPlannerContractJson(contractRel: string): any | undefined {
  try {
    const abs = resolveGatePath(contractRel);
    if (!existsSync(abs)) return undefined;
    return JSON.parse(readFileSync(abs, 'utf-8'));
  } catch {
    return undefined;
  }
}

function getGateReceiptLifecycle(manifest: PlannerManifest, currentPrompt: string): GateReceiptLifecycle | undefined {
  const contractRel = findPlannerContractForPrompt(manifest, currentPrompt);
  if (!contractRel) return undefined;
  const contract = readPlannerContractJson(contractRel);
  if (!contract) return undefined;
  if (contract.prompt && String(contract.prompt).toLowerCase() !== currentPrompt.toLowerCase()) return undefined;
  if (contract.gateReceiptLifecycle && typeof contract.gateReceiptLifecycle === 'object') {
    return contract.gateReceiptLifecycle as GateReceiptLifecycle;
  }
  return undefined;
}

function checkTaskStatuses(manifest: PlannerManifest, ledgerTasks: LedgerTask[], currentPrompt: string) {
  const allowedFinal = new Set(['DONE', 'COMPLETE']);
  const gateReceiptTaskId = currentGateReceiptTaskId(manifest, currentPrompt);
  const lifecycle = getGateReceiptLifecycle(manifest, currentPrompt);

  // Build set of external-blocker allowlist from manifest
  const allowlist = manifest.externalBlockerAllowlist;

  for (const prompt of promptClosure(manifest, currentPrompt)) {
    for (const task of prompt.tasks) {
      const ledgerTask = ledgerTasks.find(t => t.id === task.id);
      if (!ledgerTask) continue;

      const status = ledgerTask.status.toUpperCase();
      const statusBase = status.replace(/\s.*$/, '');

      // Mechanical-receipt lifecycle (planner-driven, 05R6): when the planner
      // contract declares preGateLedgerStatus TODO with exclusions, the
      // current prompt's .G receipt task must remain TODO before and after
      // observation-only nonzero gate runs. TODO here is the expected
      // pre-gate state (not DONE, not an error); IN_PROGRESS after an
      // observation run is forbidden and must fail. DONE is the post-gate
      // state after planner/QA stores an exit-zero receipt.
      if (task.id === gateReceiptTaskId && prompt.id === currentPrompt && lifecycle?.preGateLedgerStatus === 'TODO') {
        if (statusBase === 'TODO') {
          continue;
        }
        if (statusBase === 'IN_PROGRESS') {
          error('INVALID_STATUS',
            `Task ${task.id} has forbidden status "${ledgerTask.status}" after an observation run. Expected TODO before and after observation-only gate runs; DONE only after planner/QA stores an exit-zero receipt.`);
          continue;
        }
        // DONE/COMPLETE/BLOCKED fall through to normal handling below.
      }

      // Mechanical-receipt lifecycle (legacy, 05R5): the current prompt's .G
      // receipt task may be IN_PROGRESS while its exact gate command runs. It
      // must not require its own pre-existing receipt (that would be circular:
      // DONE requires an exit-0 receipt, which requires running the gate).
      // IN_PROGRESS here is not DONE — completeness and stop-eligibility still
      // treat it as open.
      if (task.id === gateReceiptTaskId && statusBase === 'IN_PROGRESS' && !lifecycle?.preGateLedgerStatus) {
        continue;
      }

      if (allowedFinal.has(status) || allowedFinal.has(statusBase)) {
        // OK
      } else if (statusBase === 'BLOCKED') {
        // Must have a structured external blocker code from the allowlist in evidence
        const evidence = ledgerTask.evidence;
        const hasAllowlistedCode = allowlist.some(code => evidence.includes(code));
        if (!hasAllowlistedCode) {
          error('BLOCKED_NOT_EXTERNAL',
            `Task ${task.id} has status BLOCKED but evidence does not contain a structured allowlisted external blocker code. Allowlist: ${[...allowlist].join(', ')}. Safe source wiring remains SAFE_TO_CONTINUE.`);
        }
      } else {
        error('INVALID_STATUS',
          `Task ${task.id} has forbidden status "${ledgerTask.status}". Allowed: DONE, COMPLETE, or BLOCKED with an allowlisted external blocker code.`);
      }
    }
  }

  pass('Task status validation complete');
}

function checkExternalBlockerEligibility(manifest: PlannerManifest, ledgerTasks: LedgerTask[]) {
  const eligibleTaskIds = manifest.prompts.flatMap(p => p.tasks.filter(t => t.externalEligible).map(t => t.id));
  const eligibleTasks = new Set(eligibleTaskIds);

  for (const task of ledgerTasks) {
    const s = task.status.toUpperCase().replace(/\s.*$/, '');
    if (s === 'BLOCKED') {
      if (!eligibleTasks.has(task.id)) {
        error('BLOCKED_NOT_ELIGIBLE',
          `Task ${task.id} is BLOCKED but is not marked externalEligible in the manifest. Only externalEligible tasks may be EXTERNALLY_BLOCKED.`);
      }
    }
  }

  pass('External blocker eligibility check complete');
}

function checkReviewArtifacts(manifest: PlannerManifest, reviews: ReviewArtifact[], currentPrompt: string) {
  if (reviews.length === 0) {
    error('NO_REVIEWS', 'No review artifacts found in review directory');
    return;
  }

  // Prompt scoping (05R5): a review blocks or certifies only the prompt whose
  // tasks it covers. A negative review for another prompt (e.g. 05R4) remains
  // durable evidence in the shared directory but must not block the current
  // prompt merely because both use the same review directory. Reviews with no
  // attributable task ID stay fail-closed (scoped) so unattributed verdicts
  // can neither silently pass nor silently block.
  const current = manifest.prompts.find(p => p.id === currentPrompt);
  const currentTaskIds = new Set((current?.tasks ?? []).map(t => t.id));
  const scoped: ReviewArtifact[] = [];
  const preserved: ReviewArtifact[] = [];
  for (const review of reviews) {
    const ids = review.taskId.split(',').map(id => id.trim()).filter(Boolean);
    if (ids.length === 0 || ids.some(id => currentTaskIds.has(id))) {
      scoped.push(review);
    } else {
      preserved.push(review);
    }
  }
  for (const review of preserved) {
    pass(`Review ${review.path} covers other prompt(s); preserved as durable evidence, not blocking ${currentPrompt}`);
  }

  const invalidValues = new Set(manifest.reviewRequirements.invalidValues.map(v => v.toLowerCase()));

  // Only scoped reviews (covering the current prompt) are enforced here. A
  // negative verdict for the current prompt blocks it; other prompts'
  // verdicts are preserved above and cannot leak across prompts.
  for (const review of scoped) {
    if (!review.implementer || review.implementer === '—' || review.implementer === '-') {
      error('REVIEW_NO_IMPLEMENTER', `Review ${review.path}: missing or blank implementer context ID`);
    }
    if (!review.reviewer || review.reviewer === '—' || review.reviewer === '-') {
      error('REVIEW_NO_REVIEWER', `Review ${review.path}: missing or blank reviewer context ID`);
    }
    if (review.implementer && review.reviewer &&
        review.implementer.toLowerCase() === review.reviewer.toLowerCase()) {
      error('REVIEW_SAME_PERSON',
        `Review ${review.path}: implementer "${review.implementer}" and reviewer "${review.reviewer}" are identical. Fresh means independent.`);
    }
    if (review.implementer && [...invalidValues].some(value => review.implementer.toLowerCase().includes(value))) {
      error('REVIEW_INVALID_IMPLEMENTER',
        `Review ${review.path}: implementer "${review.implementer}" is in the invalid values list.`);
    }
    if (review.reviewer && [...invalidValues].some(value => review.reviewer.toLowerCase().includes(value))) {
      error('REVIEW_SIMULATED',
        `Review ${review.path}: reviewer "${review.reviewer}" is in the invalid values list.`);
    }
    if (review.verdict.trim().toUpperCase() !== 'GO') {
      const verdictUp = review.verdict.trim().toUpperCase();
      if ((verdictUp === 'NO-GO' || verdictUp === 'NOGO') && review.zeroFixPresent && !review.zeroFix) {
        error('REVIEW_NEGATIVE',
          `Review ${review.path}: honest negative verdict (NO-GO, zeroFix false) recorded as present evidence; advancement prohibited until a GO zero-fix review lands.`);
      } else {
        error('REVIEW_VERDICT_INVALID', `Review ${review.path}: verdict must be exactly GO; received "${review.verdict || 'missing'}".`);
        if (!review.zeroFixPresent) {
          error('REVIEW_NO_ZERO_FIX',
            `Review ${review.path}: missing explicit zero-fix verdict.`);
        }
      }
    } else if (!review.zeroFix && !review.verdict.toLowerCase().includes('zero fix')) {
      error('REVIEW_NO_ZERO_FIX',
        `Review ${review.path}: missing explicit zero-fix verdict.`);
    }
    if (!review.commitHash) {
      error('REVIEW_NO_COMMIT',
        `Review ${review.path}: missing reviewed commit or deterministic diff hash.`);
    }
    if (!review.taskId) {
      error('REVIEW_NO_TASK_ID',
        `Review ${review.path}: missing task or phase ID.`);
    }
    if (review.filesInspected.length === 0) {
      error('REVIEW_NO_FILES',
        `Review ${review.path}: missing files inspected list.`);
    }
    if (review.commandsRerun.length === 0) {
      error('REVIEW_NO_COMMANDS',
        `Review ${review.path}: missing commands independently rerun.`);
    }
  }

  pass(`${scoped.length} scoped review artifact(s) validated for ${currentPrompt} (${preserved.length} other-prompt artifact(s) preserved)`);
}

function checkPromptBatchReviewCoverage(manifest: PlannerManifest, reviews: ReviewArtifact[], currentPrompt: string) {
  // For LOW/MEDIUM tasks, one prompt-batch review per completed prompt is sufficient.
  // For HIGH-risk checkpoints, an independent review is required before the boundary.
  // At minimum, there must be at least one review artifact.
  if (reviews.length === 0) {
    error('NO_PROMPT_REVIEWS', 'No prompt-batch review artifacts found. At least one per completed prompt is required.');
    return;
  }
  // Prompt scoping (05R5): coverage is evaluated against the CURRENT prompt's
  // tasks only. Predecessor completion is enforced through ledger statuses
  // and predecessor gates, not by re-covering old tasks here; and other
  // prompts' reviews neither satisfy nor block this prompt's coverage.
  const current = manifest.prompts.find(p => p.id === currentPrompt);
  let requiredTaskIds = (current?.tasks ?? []).map(task => task.id);
  // Planner-driven receipt lifecycle (05R6): the .G receipt task is DONE only
  // after planner/QA stores an exit-zero receipt, so it is excluded from
  // pre-gate review coverage. The formal review artifact must not claim to
  // review a receipt that did not exist yet.
  const gateReceiptTaskId = currentGateReceiptTaskId(manifest, currentPrompt);
  const lifecycle = getGateReceiptLifecycle(manifest, currentPrompt);
  if (lifecycle?.excludeFromPreGateReviewCoverage && gateReceiptTaskId) {
    requiredTaskIds = requiredTaskIds.filter(id => id !== gateReceiptTaskId);
  }
  const covered = new Set(reviews.flatMap(review => review.taskId.split(',').map(id => id.trim()).filter(Boolean)));
  const missing = requiredTaskIds.filter(id => !covered.has(id));
  if (missing.length > 0) {
    error('REVIEW_COVERAGE_MISSING', `Required prompt-closure tasks lack review coverage: ${missing.join(', ')}`);
  } else {
    pass(`Prompt-batch review coverage: ${requiredTaskIds.length} scoped task(s) covered`);
  }
}

function checkStatusAgreement(manifest: PlannerManifest, ledgerTasks: LedgerTask[], currentPrompt: string) {
  const scopedPrompts = promptClosure(manifest, currentPrompt);
  const gateReceiptTaskId = currentGateReceiptTaskId(manifest, currentPrompt);
  // The current prompt's .G receipt task is DONE only after this exact gate
  // exits 0 and its receipt is stored, so it is excluded from the
  // pre-run DONE-completeness requirement (requiring it here would make the
  // gate demand its own receipt before it can run).
  const allManifestTaskIds = scopedPrompts.flatMap(p => p.tasks.map(t => t.id)).filter(id => id !== gateReceiptTaskId);
  const manifestTaskIds = new Set(allManifestTaskIds);

  const ledgerManifestTasks = ledgerTasks.filter(t => manifestTaskIds.has(t.id));
  const doneCount = ledgerManifestTasks.filter(t => {
    const s = t.status.toUpperCase().replace(/\s.*$/, '');
    return s === 'DONE' || s === 'COMPLETE';
  }).length;

  const totalTasks = scopedPrompts.reduce((sum, p) => sum + p.tasks.filter(t => t.id !== gateReceiptTaskId).length, 0);

  if (doneCount === totalTasks) {
    pass(`Status agreement: ${doneCount}/${totalTasks} tasks DONE`);
  } else {
    error('STATUS_DISAGREEMENT',
      `Ledger shows ${doneCount}/${totalTasks} manifest tasks in DONE state. All manifest tasks must be DONE for GO.`);
  }
}

function checkTestBaseline(manifest: PlannerManifest) {
  const testDir = join(workspaceRoot, 'atlas-server', 'src', '__tests__');
  if (!existsSync(testDir)) {
    error('TEST_DIR_MISSING', 'Test directory not found');
    return;
  }

  let currentTotal = 0;
  for (const suite of manifest.testBaselines.suites) {
    const testFile = join(workspaceRoot, suite.path);
    if (existsSync(testFile)) {
      const content = readFileSync(testFile, 'utf-8');
      const testCount = (content.match(/\btest\s*\(/g) || []).length;
      currentTotal += testCount;

      if (testCount < suite.minimum) {
        error('TEST_REDUCTION',
          `Test file ${suite.path}: minimum ${suite.minimum} tests, current ${testCount}. Unexplained test reduction is NO-GO.`);
      }
    } else {
      error('TEST_FILE_MISSING', `Test file not found: ${suite.path}`);
    }
  }

  if (currentTotal >= manifest.testBaselines.minimumExistingAssertions) {
    pass(`Test baseline: ${currentTotal}/${manifest.testBaselines.minimumExistingAssertions} minimum assertions`);
  } else {
    error('TEST_REDUCTION',
      `Total tests ${currentTotal} below minimum baseline ${manifest.testBaselines.minimumExistingAssertions}`);
  }
}

function checkProductionCallSites(manifest: PlannerManifest) {
  if (manifest.validatorRequirements.productionReachability.length === 0) {
    pass('Production call-site analysis not required by this manifest');
    return;
  }
  // Collect all service files referenced in tasks
  for (const prompt of manifest.prompts) {
    for (const task of prompt.tasks) {
      // The planner manifest doesn't list files per task; we check known new services
      // by looking for services that should be reachable from routes.
    }
  }

  // Known canonical services that must have production call-sites
  const knownServices = [
    'workload-policy.service.ts',
    'term-config.service.ts',
    'school-year-offering.service.ts',
    'qualification-evaluator.service.ts',
    'assignment-security.service.ts',
    'allocation.service.ts',
  ];

  for (const svcFile of knownServices) {
    const { importers } = analyzeImports(svcFile);
    if (importers.length === 0) {
      warn('NO_PRODUCTION_CALLSITE',
        `Service ${svcFile} has no detected production import/call path. Verify manually that a real route/workflow reaches it.`);
    } else {
      pass(`Service ${svcFile}: ${importers.length} production call-site(s)`);
    }
  }
}

function checkPredecessors(manifest: PlannerManifest, currentPrompt: string) {
  const current = manifest.prompts.find(p => p.id === currentPrompt);
  if (!current) {
    error('PROMPT_NOT_IN_MANIFEST', `Prompt ${currentPrompt} not found in manifest`);
    return;
  }

  if (!current.predecessors || current.predecessors.length === 0) {
    pass(`No predecessors required for prompt ${currentPrompt}`);
    return;
  }

  const ledgerContent = readFile(manifest.canonicalPaths.ledger);
  const allTasks = parseLedgerTasks(ledgerContent);

  for (const predId of current.predecessors) {
    const predPrompt = manifest.prompts.find(p => p.id === predId);
    if (!predPrompt) {
      error('PREDECESSOR_MISSING', `Predecessor prompt ${predId} not found in manifest`);
      continue;
    }

    let allDone = true;
    for (const task of predPrompt.tasks) {
      const ledgerTask = allTasks.find(t => t.id === task.id);
      if (!ledgerTask) {
        allDone = false;
        error('PREDECESSOR_TASK_MISSING',
          `Predecessor prompt ${predId}: task ${task.id} not found in ledger`);
      } else {
        const s = ledgerTask.status.toUpperCase().replace(/\s.*$/, '');
        if (s !== 'DONE' && s !== 'COMPLETE') {
          allDone = false;
          error('PREDECESSOR_INCOMPLETE',
            `Predecessor prompt ${predId}: task ${task.id} has status "${ledgerTask.status}" (required: DONE)`);
        }
      }
    }

    if (allDone) {
      pass(`Predecessor prompt ${predId}: all ${predPrompt.tasks.length} tasks DONE`);
    }
  }
}

function checkStopEligibility(manifest: PlannerManifest, ledgerTasks: LedgerTask[], currentPrompt: string) {
  const stopManifestTaskIds = promptClosure(manifest, currentPrompt).flatMap(p => p.tasks.map(t => t.id));
  const gateReceiptTaskId = currentGateReceiptTaskId(manifest, currentPrompt);
  const lifecycle = getGateReceiptLifecycle(manifest, currentPrompt);
  const manifestTaskIds = new Set(stopManifestTaskIds);

  const safeIncomplete = ledgerTasks.filter(t => {
    if (!manifestTaskIds.has(t.id)) return false;
    // The in-flight .G receipt task is the gate's own receipt lifecycle, not
    // SAFE_TO_CONTINUE work remaining at a stop.
    if (t.id === gateReceiptTaskId && t.status.toUpperCase().replace(/\s.*$/, '') === 'IN_PROGRESS' && !lifecycle?.preGateLedgerStatus) return false;
    // Planner-driven lifecycle (05R6): .G TODO before and after
    // observation-only runs is the expected pre-gate state and is excluded
    // from the safe-incomplete count.
    if (t.id === gateReceiptTaskId && t.status.toUpperCase().replace(/\s.*$/, '') === 'TODO' && lifecycle?.excludeFromSafeIncompleteCount) return false;
    const s = t.status.toUpperCase().replace(/\s.*$/, '');
    if (s === 'DONE' || s === 'COMPLETE') return false;
    if (s === 'BLOCKED') {
      // Check if evidence contains an allowlisted external blocker code
      const hasAllowlistedCode = manifest.externalBlockerAllowlist.some(code => t.evidence.includes(code));
      if (hasAllowlistedCode) return false;
    }
    return true;
  });

  if (safeIncomplete.length > 0) {
    for (const task of safeIncomplete) {
      error('SAFE_TO_CONTINUE',
        `Task ${task.id} ("${task.title}") is incomplete with status "${task.status}" and is not EXTERNALLY_BLOCKED. Stop is forbidden while SAFE_TO_CONTINUE tasks exist.`);
    }
  } else {
    pass('No SAFE_TO_CONTINUE tasks at stop');
  }
}

// ─── Planner-owned artifact pins (05R5, generic) ───

/**
 * Verify every manifest-declared planner-owned artifact before any
 * prompt-specific evidence check. Paths come ONLY from the hash-pinned
 * planner manifest: no environment variable and no CLI flag can replace,
 * extend, or redirect them in a real gate run. Test-only fixtures exercise
 * this function through temp manifests, never through overrides.
 */
function checkPlannerOwnedArtifacts(manifest: PlannerManifest) {
  const artifacts = manifest.plannerOwnedArtifacts ?? [];
  if (artifacts.length === 0) {
    pass('No planner-owned artifacts declared in manifest; pin check not applicable');
    return;
  }
  const seen = new Set<string>();
  for (const artifact of artifacts) {
    const rawPath = artifact.path ?? '';
    const normalized = rawPath.replace(/\\/g, '/');
    const segments = normalized.split('/');
    if (/^[A-Za-z]:\//.test(normalized) || normalized.startsWith('/') || segments.includes('..')) {
      error('PLANNER_ARTIFACT_ESCAPE', `Planner-owned artifact path escapes the workspace: "${rawPath}"`);
      continue;
    }
    if (seen.has(normalized)) {
      error('PLANNER_ARTIFACT_DUPLICATE', `Planner-owned artifact path declared twice: "${rawPath}"`);
      continue;
    }
    seen.add(normalized);
    if (!fileExists(rawPath)) {
      error('PLANNER_ARTIFACT_MISSING', `Planner-owned artifact not found: "${rawPath}"`);
      continue;
    }
    const actual = sha256File(rawPath);
    const expected = (artifact.sha256 ?? '').toUpperCase();
    if (actual !== expected) {
      error('PLANNER_ARTIFACT_DRIFT', `Planner-owned artifact hash drift: "${rawPath}" actual ${actual} != pinned ${expected}. Do not repin; stop with PLANNER_ARTIFACT_DRIFT.`);
    } else {
      pass(`Planner-owned artifact pin verified: ${rawPath}`);
    }
  }
}

/**
 * Fail closed until the planner/orchestration owner issues a formal reviewer
 * identity outside the executor task tree. Reads ONLY the planner-owned
 * contract artifact declared in the manifest (already pin-verified above).
 * An executor-spawned advisory reviewer can never satisfy this check.
 */
function checkFormalReviewIssuance(manifest: PlannerManifest, reviews: ReviewArtifact[], cliPrompt: string) {
  const contractRel = findPlannerContractForPrompt(manifest, cliPrompt);
  if (!contractRel) {
    pass('No planner-owned contract declares formal-review issuance; issuance gate not applicable');
    return;
  }
  const contractAbs = resolveGatePath(contractRel);
  if (!existsSync(contractAbs)) {
    // PLANNER_ARTIFACT_MISSING already recorded above; do not throw here.
    return;
  }
  const contract = JSON.parse(readFileSync(contractAbs, 'utf-8')) as {
    prompt?: string;
    evidenceAuthority?: { formalReviewerContextIds?: string[]; formalReviewState?: string };
    formalReviewReceipt?: { state?: string; formalReviewerContextIds?: string[]; path?: string };
  };
  if (contract.prompt && contract.prompt !== cliPrompt) {
    pass('Planner-owned contract targets another prompt; issuance gate not applicable');
    return;
  }
  // 05R6-style contracts carry issuance under formalReviewReceipt; 05R5-style
  // contracts carry it under evidenceAuthority. Both fail closed until the
  // planner issues a reviewer outside the executor task tree.
  consumeControl('/formalReviewReceipt');
  const issuedIds = contract.evidenceAuthority?.formalReviewerContextIds
    ?? contract.formalReviewReceipt?.formalReviewerContextIds
    ?? [];
  const state = contract.evidenceAuthority?.formalReviewState
    ?? contract.formalReviewReceipt?.state
    ?? (issuedIds.length > 0 ? 'ISSUED' : 'NOT_ISSUED');
  const prompt = manifest.prompts.find(p => p.id === cliPrompt);
  const formalTaskIds = (prompt?.tasks ?? []).filter(t => t.id.endsWith('.R')).map(t => t.id);
  if (state !== 'ISSUED' || issuedIds.length === 0) {
    error('FORMAL_REVIEW_NOT_ISSUED',
      `Planner has not issued a formal reviewer identity (state=${state}); executor-spawned advisory reviews cannot satisfy ${formalTaskIds.join(', ') || 'the formal-review task'}.`);
    return;
  }
  const covering = reviews.filter(r =>
    r.taskId.split(',').map(s => s.trim()).filter(Boolean).some(id => formalTaskIds.includes(id)));
  if (covering.length === 0) {
    error('REVIEWER_NOT_ISSUED', `No review covers formal-review task(s) ${formalTaskIds.join(', ')} with a planner-issued reviewer.`);
    return;
  }
  for (const review of covering) {
    try {
      assertFormalReviewSatisfiesIssuance(review.reviewer, issuedIds, state);
      pass(`Formal reviewer issued for ${review.path}`);
    } catch (e: any) {
      error('REVIEWER_NOT_ISSUED', `Formal-review check failed (${review.path}): ${e.message}`);
    }
  }
}

// ─── Prompt 05R6 formal receipt enforcement (DBR-05R6.1) ───

interface FormalReceiptReviewedFile {
  path?: string;
  sha256?: string;
}

interface FormalReceiptDump {
  name?: string;
  dumpSha256?: string;
  normalizedTocSha256?: string;
  dumpPath?: string;
  tocPath?: string;
}

interface FormalReceiptProbe {
  executedAt?: string;
  kind?: string;
  target?: string;
  rawOutputPath?: string;
  rawOutputSha256?: string;
}

interface FormalReceipt {
  prompt?: string;
  reviewerContextId?: string;
  verdict?: string;
  zeroFix?: boolean;
  proposalSha256?: string;
  reviewedFiles?: FormalReceiptReviewedFile[];
  dumpEvidence?: FormalReceiptDump[];
  probes?: FormalReceiptProbe[];
}

/**
 * Generic planner-contract-driven formal receipt check (05R6).
 *
 * Reads the formal receipt ONLY from the planner-owned contract path
 * (already pin-verified). Fails while receipt state is NOT_ISSUED. Requires
 * a planner-issued reviewer, binary GO with zeroFix true, current proposal
 * hash equality, exact reviewed-file coverage with recomputed hashes,
 * dump/TOC hash binding, and current bounded read-only probe freshness with
 * raw-output hash and secret checks.
 *
 * Calls the existing pure assertions (proposal, dump, freshness) rather than
 * duplicating them; new path/secret/target helpers live in the evidence-gate
 * service and are also called here (no dead code).
 */
function checkFormalReceiptEnforcement(manifest: PlannerManifest, cliPrompt: string) {
  const contractRel = findPlannerContractForPrompt(manifest, cliPrompt);
  if (!contractRel) {
    pass('Formal receipt enforcement not applicable (no planner-owned contract)');
    return;
  }
  const contract = readPlannerContractJson(contractRel) as any;
  if (!contract) {
    // PLANNER_ARTIFACT_MISSING already recorded; do not double-report here.
    return;
  }
  if (!contract.requiredGateEnforcement && !contract.formalReviewReceipt) {
    pass('Formal receipt enforcement not applicable to this prompt');
    return;
  }
  if (contract.prompt && String(contract.prompt) !== cliPrompt) {
    pass('Planner-owned contract targets another prompt; receipt enforcement not applicable');
    return;
  }

  // 05R7B pre-issuance policy-shape consumption: every enforceable planner
  // field below is read and shape-validated BEFORE the NOT_ISSUED return, so
  // the consumed-control inventory is complete even while the formal receipt
  // is reserved. Each validation genuinely affects the gate (malformed
  // planner policy fails closed here, not later). Marks mirror the exact
  // `controlEnforcement.enforceableJsonPointers` entries.
  if (is05R7BContract(contract)) {
    try {
      const paths = (contract as { reviewedImplementationPaths?: unknown }).reviewedImplementationPaths;
      if (!Array.isArray(paths) || paths.length === 0 || !paths.every((p) => typeof p === 'string' && p.trim().length > 0)) {
        throw new Error('REVIEWED_PATH_MISSING: planner contract declares no reviewedImplementationPaths.');
      }
      consumeControl('/reviewedImplementationPaths');
      assertStrictScalarPolicy(contract);
      consumeControl('/strictScalarValidation/probeExitCode');
      assertProbeOutputPolicy(contract);
      consumeControl('/probeOutputPathPolicy/pathClass');
      consumeControl('/probeOutputPathPolicy/canonicalContainmentRequired');
      consumeControl('/probeOutputPathPolicy/realPathContainmentWhenExisting');
      consumeControl('/probeOutputPathPolicy/absolutePathsAllowed');
      consumeControl('/probeOutputPathPolicy/reject');
      consumeControl('/formalReviewReceipt');
      const dumps = (contract as { requiredDumpEvidence?: unknown }).requiredDumpEvidence;
      if (!Array.isArray(dumps) || dumps.length === 0) {
        throw new Error('DUMP_INVENTORY_MISMATCH: planner contract declares no requiredDumpEvidence inventory');
      }
      consumeControl('/requiredDumpEvidence');
      const probes = (contract as { probeContract?: { requiredProbes?: unknown } }).probeContract?.requiredProbes;
      if (!Array.isArray(probes) || probes.length === 0) {
        throw new Error('PROBE_INVENTORY_MISMATCH: planner contract declares no requiredProbes inventory');
      }
      consumeControl('/probeContract');
      pass('05R7B planner policy shapes validated pre-issuance (paths, scalar, probe-output, dumps, probes)');
    } catch (e: any) {
      const msg = String(e.message ?? '');
      const code = msg.split(':')[0] || 'UNCONSUMED_PLANNER_CONTROL';
      error(code, `05R7B planner policy-shape check failed: ${msg}`);
      return;
    }
  }

  const receiptMeta = contract.formalReviewReceipt as {
    path?: string;
    state?: string;
    formalReviewerContextIds?: string[];
    requiredFields?: string[];
  } | undefined;
  if (!receiptMeta) {
    error('FORMAL_RECEIPT_MISSING', 'Planner contract declares enforcement but omits formalReviewReceipt metadata.');
    return;
  }
  const state = receiptMeta.state ?? 'NOT_ISSUED';
  const issuedIds = receiptMeta.formalReviewerContextIds ?? [];
  if (state !== 'ISSUED' || issuedIds.length === 0) {
    error('FORMAL_RECEIPT_NOT_ISSUED',
      `Planner has not issued a formal receipt (state=${state}); post-review proposal, file, dump, and probe binding cannot be established.`);
    return;
  }

  const receiptRel = receiptMeta.path ?? '';
  const receiptNorm = receiptRel.replace(/\\/g, '/');
  if (!receiptRel || /^[A-Za-z]:\//.test(receiptNorm) || receiptNorm.startsWith('/') || receiptNorm.split('/').includes('..')) {
    error('FORMAL_RECEIPT_ESCAPE', `Formal receipt path escapes the workspace: "${receiptRel}"`);
    return;
  }
  const receiptAbs = resolveGatePath(receiptRel);
  if (!existsSync(receiptAbs)) {
    error('FORMAL_RECEIPT_MISSING', `Formal receipt not found at planner-owned path: "${receiptRel}"`);
    return;
  }

  // Transitive receipt authority (05R7.1): when the planner contract requires
  // a manifest pin, the current receipt bytes must match BOTH the
  // prompt-matching contract pin and the selected-manifest pin before any
  // receipt claim is read. A coordinated post-issuance rewrite of the receipt
  // still fails unless the planner repins the authority chain.
  const manifestPinRequired =
    (receiptMeta as { manifestPinRequiredWhenIssued?: unknown }).manifestPinRequiredWhenIssued === true;
  if (manifestPinRequired) {
    const receiptPathNorm = receiptRel.replace(/\\/g, '/').trim();
    const manifestPins = (manifest.plannerOwnedArtifacts ?? []).filter(
      (a) => String(a.path ?? '').replace(/\\/g, '/').trim() === receiptPathNorm,
    );
    if (manifestPins.length === 0) {
      error('FORMAL_RECEIPT_PIN_MISSING',
        `Selected manifest pins no receipt path "${receiptRel}"; transitive receipt authority requires a manifest pin.`);
      return;
    }
    if (manifestPins.length > 1) {
      error('FORMAL_RECEIPT_PIN_MISMATCH',
        `Selected manifest pins receipt path "${receiptRel}" ${manifestPins.length} times; exactly one pin is required.`);
      return;
    }
    try {
      const currentReceiptSha = sha256File(receiptRel);
      assertReceiptHexMatchesPins(
        currentReceiptSha,
        (receiptMeta as { sha256?: unknown }).sha256,
        manifestPins[0].sha256,
      );
      pass('Formal receipt bytes match planner contract and manifest pins');
    } catch (e: any) {
      const msg = String(e.message ?? '');
      const code = msg.split(':')[0] || 'FORMAL_RECEIPT_CHANGED';
      error(code, `Transitive receipt authority failed: ${msg}`);
      return;
    }
  }
  let receipt: FormalReceipt;
  try {
    receipt = JSON.parse(readFileSync(receiptAbs, 'utf-8')) as FormalReceipt;
  } catch (e: any) {
    error('FORMAL_RECEIPT_MALFORMED', `Formal receipt at "${receiptRel}" is not valid JSON: ${e.message}`);
    return;
  }

  const requiredFields: string[] = receiptMeta.requiredFields
    ?? ['prompt', 'reviewerContextId', 'verdict', 'zeroFix', 'proposalSha256', 'reviewedFiles', 'probes', 'dumpEvidence'];
  try {
    assertReceiptHasRequiredFields(receipt as unknown as Record<string, unknown>, requiredFields);
    pass('Formal receipt carries all planner-required fields');
  } catch (e: any) {
    error('FORMAL_RECEIPT_MALFORMED', `Formal receipt field check failed: ${e.message}`);
    return;
  }

  if (String(receipt.prompt) !== cliPrompt) {
    error('FORMAL_RECEIPT_PROMPT_MISMATCH',
      `Formal receipt prompt "${receipt.prompt}" does not match CLI prompt "${cliPrompt}".`);
  }

  try {
    assertFormalReviewSatisfiesIssuance(String(receipt.reviewerContextId ?? ''), issuedIds, 'ISSUED');
    pass(`Formal receipt reviewer issued (${receiptRel})`);
  } catch (e: any) {
    error('REVIEWER_NOT_ISSUED', `Formal receipt reviewer check failed: ${e.message}`);
  }

  if (String(receipt.verdict ?? '').trim().toUpperCase() !== 'GO' || !receipt.zeroFix) {
    error('REVIEW_NOT_GO',
      `Formal receipt is not GO zero-fix (verdict="${receipt.verdict}", zeroFix=${receipt.zeroFix}).`);
  } else {
    pass('Formal receipt verdict is GO with zeroFix true');
  }

  const contractPaths: string[] = Array.isArray(contract.reviewedImplementationPaths)
    ? contract.reviewedImplementationPaths.map((p: unknown) => String(p))
    : [];
  if (contractPaths.length === 0) {
    error('REVIEWED_PATH_MISSING', 'Planner contract declares no reviewedImplementationPaths.');
    return;
  }
  const receiptFiles = Array.isArray(receipt.reviewedFiles) ? receipt.reviewedFiles : [];
  const receiptPaths = receiptFiles.map((f) => String(f.path ?? ''));
  try {
    assertReviewedPathLists(contractPaths, receiptPaths);
    pass(`Reviewed paths match contract exactly (${contractPaths.length} path(s))`);
  } catch (e: any) {
    const msg = String(e.message ?? '');
    const code = msg.split(':')[0] || 'REVIEWED_PATH_MISSING';
    error(code, `Reviewed path check failed: ${msg}`);
    // Continue to hash checks to surface all drift, but path mismatch already fails.
  }

  // Proposal is the first contract path by convention (the clean-rebuild
  // proposal). Recompute its current hash and bind it to the receipt via the
  // existing proposal assertion (no duplicated logic).
  const proposalRel = contractPaths[0];
  try {
    const currentProposalSha = sha256File(proposalRel);
    assertProposalMatchesReviewReceipt(currentProposalSha, {
      proposalSha256: String(receipt.proposalSha256 ?? ''),
      verdict: String(receipt.verdict ?? ''),
      zeroFix: Boolean(receipt.zeroFix),
    });
    pass('Current proposal hash matches formal receipt');
  } catch (e: any) {
    const msg = String(e.message ?? '');
    const code = msg.split(':')[0] || 'PROPOSAL_CHANGED_AFTER_REVIEW';
    error(code, `Proposal binding failed: ${msg}`);
  }

  // Proposal reviewed-file entry consistency (05R7.2): the proposal entry
  // inside reviewedFiles must carry exactly the receipt proposal pin. The
  // per-file loop below skips the proposal path (bound above), so without
  // this check a wrong SHA on the proposal entry would pass undetected.
  try {
    assertProposalReviewedFileConsistent(receiptFiles, proposalRel, String(receipt.proposalSha256 ?? ''));
    pass('Proposal reviewed-file entry matches receipt proposal pin');
  } catch (e: any) {
    const msg = String(e.message ?? '');
    const code = msg.split(':')[0] || 'PROPOSAL_ENTRY_MISMATCH';
    error(code, `Proposal entry check failed: ${msg}`);
  }

  // Every reviewed file: recompute current SHA-256 and compare to the receipt.
  // Sidecar .sha256 files are never trusted; only the planner-issued receipt
  // pin counts, so coordinated file+sidecar edits still fail here.
  const receiptByPath = new Map<string, string>();
  for (const f of receiptFiles) {
    receiptByPath.set(String(f.path ?? '').replace(/\\/g, '/').trim(), String(f.sha256 ?? '').trim().toUpperCase());
  }
  for (const contractPath of contractPaths) {
    const norm = contractPath.replace(/\\/g, '/').trim();
    if (contractPath === proposalRel) continue; // proposal already bound above
    const expected = receiptByPath.get(norm);
    if (!expected) continue; // already reported as MISSING above
    let actual: string;
    try {
      actual = sha256File(contractPath);
    } catch {
      error('REVIEWED_FILE_MISSING', `Reviewed implementation file not found: "${contractPath}"`);
      continue;
    }
    if (actual !== expected) {
      error('REVIEWED_FILE_CHANGED',
        `Reviewed file changed after formal review: "${contractPath}" receipt ${expected} != current ${actual}.`);
    } else {
      pass(`Reviewed file hash matches receipt: ${contractPath}`);
    }
  }

  // Dumps: exact planner inventory (05R7.3) when the contract declares
  // requiredDumpEvidence, legacy per-entry binding otherwise. The inventory
  // path requires the receipt to match the planner declaration exactly by ID,
  // path, path class, and both hashes; hash-only entries, undeclared
  // replacements, substitutions, and drift all fail closed. Current file
  // hashes below are recomputed only when the inventory is trusted.
  const dumps = Array.isArray(receipt.dumpEvidence) ? receipt.dumpEvidence : [];
  const requiredDumps: Array<{ id?: unknown; dumpPath?: unknown; dumpSha256?: unknown; tocPath?: unknown; normalizedTocSha256?: unknown; pathClass?: unknown }> =
    Array.isArray((contract as { requiredDumpEvidence?: unknown }).requiredDumpEvidence)
      ? (contract as { requiredDumpEvidence: Array<{ id?: unknown; dumpPath?: unknown; dumpSha256?: unknown; tocPath?: unknown; normalizedTocSha256?: unknown; pathClass?: unknown }> }).requiredDumpEvidence
      : [];
  let dumpPathsTrusted = true;
  if (requiredDumps.length > 0) {
    try {
      assertDumpInventoryMatchesContract(requiredDumps, dumps);
      pass(`Dump inventory matches planner contract exactly (${requiredDumps.length} dump(s))`);
    } catch (e: any) {
      const msg = String(e.message ?? '');
      const code = msg.split(':')[0] || 'DUMP_INVENTORY_MISMATCH';
      error(code, `Dump inventory check failed: ${msg}`);
      dumpPathsTrusted = false;
    }
  }
  if (dumps.length === 0) {
    error('DUMP_EVIDENCE_MISSING', 'Formal receipt declares no dumpEvidence entries.');
  } else if (dumpPathsTrusted) {
    for (const d of dumps) {
      try {
        assertDumpFactsBound({ dumpSha256: d.dumpSha256, normalizedTocSha256: d.normalizedTocSha256 });
      } catch (e: any) {
        error('DUMP_BINDING_INCOMPLETE', `Dump "${d.name ?? 'unnamed'}" binding failed: ${(e as Error).message}`);
        continue;
      }
      if (d.dumpPath) {
        const dumpNorm = String(d.dumpPath).replace(/\\/g, '/');
        if (/^[A-Za-z]:\//.test(dumpNorm) && !/^[A-Za-z]:\//.test(String(d.dumpPath)) && dumpNorm.includes('..')) {
          error('REVIEWED_PATH_ESCAPE', `Dump path escapes workspace: "${d.dumpPath}"`);
        } else {
          try {
            const abs = resolveGatePath(String(d.dumpPath));
            if (!existsSync(abs)) {
              error('DUMP_HASH_CHANGED', `Dump file not found for "${d.name ?? 'unnamed'}": "${d.dumpPath}"`);
            } else {
              const actual = sha256File(String(d.dumpPath));
              if (actual !== String(d.dumpSha256 ?? '').trim().toUpperCase()) {
                error('DUMP_HASH_CHANGED',
                  `Dump "${d.name ?? 'unnamed'}" changed after review: receipt ${String(d.dumpSha256).toUpperCase()} != current ${actual}.`);
              } else {
                pass(`Dump hash matches receipt: ${d.name ?? d.dumpPath}`);
              }
            }
          } catch (e: any) {
            error('DUMP_HASH_CHANGED', `Dump hash check failed for "${d.name ?? 'unnamed'}": ${e.message}`);
          }
        }
      }
      if (d.tocPath) {
        try {
          const abs = resolveGatePath(String(d.tocPath));
          if (!existsSync(abs)) {
            error('TOC_HASH_CHANGED', `TOC file not found for "${d.name ?? 'unnamed'}": "${d.tocPath}"`);
          } else {
            const actual = sha256File(String(d.tocPath));
            if (actual !== String(d.normalizedTocSha256 ?? '').trim().toUpperCase()) {
              error('TOC_HASH_CHANGED',
                `TOC "${d.name ?? 'unnamed'}" changed after review: receipt ${String(d.normalizedTocSha256).toUpperCase()} != current ${actual}.`);
            } else {
              pass(`TOC hash matches receipt: ${d.name ?? d.tocPath}`);
            }
          }
        } catch (e: any) {
          error('TOC_HASH_CHANGED', `TOC hash check failed for "${d.name ?? 'unnamed'}": ${e.message}`);
        }
      }
    }
  }

  // Probes: exact planner inventory (05R7.4) when the contract declares
  // requiredProbes, legacy per-entry checks otherwise. The inventory path
  // requires the receipt to match the planner declaration exactly by ID, kind,
  // target, command identity, and exit code; stale, future-dated, malformed,
  // unsafe, failed, substituted, secret-bearing, missing, additional, or
  // changed probe evidence all fail closed. Stored prose or counts without a
  // contract-listed current probe are not proof.
  const probes = Array.isArray(receipt.probes) ? receipt.probes : [];
  const probeContract = (contract.probeContract ?? {}) as {
    maximumAgeMinutes?: number;
    maximumFutureSkewSeconds?: number;
    allowedKinds?: string[];
    rawOutputPathAndSha256Required?: boolean;
    requiredProbes?: Array<{ id?: unknown; kind?: unknown; target?: unknown; commandIdentity?: unknown; requiredExitCode?: unknown }>;
  };
  const maxAgeMs = Number(probeContract.maximumAgeMinutes ?? 30) * 60 * 1000;
  const maxFutureSkewMs = Number(probeContract.maximumFutureSkewSeconds ?? 120) * 1000;
  const allowedKinds: string[] = Array.isArray(probeContract.allowedKinds) && probeContract.allowedKinds.length > 0
    ? probeContract.allowedKinds.map((k: unknown) => String(k))
    : ['bounded-read-only', 'status-read-only', 'diff-read-only'];
  const requiredProbes = Array.isArray(probeContract.requiredProbes) ? probeContract.requiredProbes : [];
  let probePathsTrusted = true;
  if (requiredProbes.length > 0) {
    try {
      assertProbeInventoryMatchesContract(requiredProbes, probes);
      pass(`Probe inventory matches planner contract exactly (${requiredProbes.length} probe(s))`);
    } catch (e: any) {
      const msg = String(e.message ?? '');
      const code = msg.split(':')[0] || 'PROBE_INVENTORY_MISMATCH';
      error(code, `Probe inventory check failed: ${msg}`);
      probePathsTrusted = false;
    }
  }
  if (probes.length === 0) {
    error('PROBE_MISSING', 'Formal receipt declares no current probes; stored counts cannot establish database truth.');
  } else if (probePathsTrusted) {
    const nowMs = Date.now();
    for (const [index, p] of probes.entries()) {
      const label = `probe[${index}]`;
      try {
        assertProbeTargetClassified(p.target);
      } catch (e: any) {
        error('PROBE_TARGET_MISSING', `${label} target check failed: ${(e as Error).message}`);
      }
      if (!p.kind || !allowedKinds.includes(String(p.kind))) {
        error('NON_READONLY_PROBE', `${label} kind "${p.kind ?? 'missing'}" is not an allowed bounded read-only probe kind [${allowedKinds.join(', ')}].`);
        continue;
      }
      try {
        assertProbeFreshness({ executedAt: p.executedAt, kind: p.kind, nowMs, maxAgeMs, maxFutureSkewMs });
        pass(`Current probe fresh: ${label}`);
      } catch (e: any) {
        const msg = String((e as Error).message ?? '');
        const code = msg.split(':')[0] || 'STALE_DATABASE_FACTS';
        error(code, `${label} freshness failed: ${msg}`);
        continue;
      }
      if (probeContract.rawOutputPathAndSha256Required !== false) {
        if (!p.rawOutputPath || !p.rawOutputSha256) {
          error('PROBE_OUTPUT_MISSING', `${label} omits rawOutputPath or rawOutputSha256.`);
          continue;
        }
        // Strict canonical workspace containment (05R7A.2): shape first
        // (drive/UNC/POSIX/device/traversal/mixed-separator), then canonical
        // relative containment, then real-path symlink containment when the
        // file exists. Probe outputs are workspace-only; the separately
        // allowlisted absolute dump paths never authorize a probe escape.
        try {
          assertProbeRawOutputPathShape(p.rawOutputPath);
        } catch (e: any) {
          const msg = String((e as Error).message ?? '');
          const code = msg.split(':')[0] || 'PROBE_PATH_ESCAPE';
          error(code, `${label} rawOutputPath containment failed: ${msg}`);
          continue;
        }
        let rawAbs: string;
        // 05R7B fail-closed identity codes: defaults match the planner
        // contract values; a 05R7B contract overrides them with its
        // validated `filesystemFailurePolicy` codes below.
        const fsCodes = { realpathErrorCode: 'PROBE_PATH_REALPATH_FAILED', identityErrorCode: 'PROBE_FILE_IDENTITY_FAILED' };
        if (is05R7BContract(contract)) {
          try {
            const validated = assertFilesystemFailurePolicy(
              (contract as { filesystemFailurePolicy?: unknown }).filesystemFailurePolicy,
            );
            fsCodes.realpathErrorCode = validated.realpathErrorCode;
            fsCodes.identityErrorCode = validated.identityErrorCode;
          } catch (e: any) {
            const msg = String((e as Error).message ?? '');
            error(msg.split(':')[0] || 'FILESYSTEM_FAILURE_POLICY_MISMATCH', `${label} filesystem policy check failed: ${msg}`);
            continue;
          }
        }
        try {
          rawAbs = resolveGatePath(String(p.rawOutputPath));
          // Canonical containment: resolve both workspace and candidate, then
          // require a canonical relative relationship inside the workspace.
          const workspaceCanonical = resolve(workspaceRoot);
          const candidateCanonical = resolve(workspaceRoot, String(p.rawOutputPath));
          const rel = relative(workspaceCanonical, candidateCanonical);
          if (!rel || rel === '.' || rel.startsWith('..') || isAbsolute(rel)) {
            error('PROBE_PATH_ESCAPE', `${label} rawOutputPath escapes the canonical workspace: "${p.rawOutputPath}"`);
            continue;
          }
          // Existing files are checked with their real path to detect symlink
          // escapes that string checks cannot see.
          // 05R7B fail-closed identity: when the prompt-matching contract
          // declares `filesystemFailurePolicy`, any required real-path
          // failure emits the configured `realpathErrorCode` (resolved into
          // `fsCodes` above) and rejects the evidence — it never falls
          // through to weaker checks.
          if (existsSync(rawAbs)) {
            try {
              const workspaceReal = realpathSync(workspaceCanonical);
              const candidateReal = realpathSync(rawAbs);
              const realRel = relative(workspaceReal, candidateReal);
              if (!realRel || realRel === '.' || realRel.startsWith('..') || isAbsolute(realRel)) {
                error('PROBE_PATH_SYMLINK_ESCAPE', `${label} rawOutputPath resolves outside the workspace via symlink: "${p.rawOutputPath}"`);
                continue;
              }
            } catch (e: any) {
              if (is05R7BContract(contract)) {
                error(fsCodes.realpathErrorCode, `${label} required real-path containment failed and weaker evidence is rejected: ${(e as Error)?.message ?? 'filesystem identity unavailable'}`);
                continue;
              }
              // realpath failure falls through to the existence/hash checks
              // below; shape and canonical containment already passed.
            }
          }
        } catch (e: any) {
          error('PROBE_PATH_ESCAPE', `${label} rawOutputPath containment failed: ${(e as Error).message}`);
          continue;
        }
        if (!existsSync(rawAbs!)) {
          error('PROBE_OUTPUT_MISSING', `${label} raw output not found: "${p.rawOutputPath}"`);
          continue;
        }
        let rawText = '';
        try {
          rawText = readFileSync(rawAbs, 'utf-8');
        } catch (e: any) {
          // 05R7B fail-closed identity: required open/read failures emit the
          // configured identity error and reject the evidence.
          if (is05R7BContract(contract)) {
            error(fsCodes.identityErrorCode, `${label} required probe file identity failed and weaker evidence is rejected: ${e.message}`);
            continue;
          }
          error('PROBE_OUTPUT_MISSING', `${label} raw output unreadable: ${e.message}`);
          continue;
        }
        try {
          assertNoSecretsInProbeOutput(rawText);
        } catch (e: any) {
          error('PROBE_SECRET_LEAK', `${label} secret check failed: ${(e as Error).message}`);
        }
        // 05R7B fail-closed identity: required hash failures emit the
        // configured identity error instead of crashing or downgrading.
        let actualRawSha: string;
        try {
          actualRawSha = sha256File(String(p.rawOutputPath));
        } catch (e: any) {
          if (is05R7BContract(contract)) {
            error(fsCodes.identityErrorCode, `${label} required probe file hash failed and weaker evidence is rejected: ${(e as Error)?.message ?? 'hash unavailable'}`);
            continue;
          }
          throw e;
        }
        if (actualRawSha !== String(p.rawOutputSha256 ?? '').trim().toUpperCase()) {
          error('PROBE_OUTPUT_CHANGED',
            `${label} raw output changed after review: receipt ${String(p.rawOutputSha256).toUpperCase()} != current ${actualRawSha}.`);
        } else {
          pass(`Probe raw output hash matches: ${label}`);
        }
      }
    }
  }
}

// ─── Prompt 05R7 acyclic gate-receipt lifecycle (DBR-05R7.5) ───

const GATE_RECEIPT_MAX_AGE_MS = 24 * 60 * 60 * 1000;
const GATE_RECEIPT_MAX_FUTURE_SKEW_MS = 120 * 1000;

/**
 * Mechanical gate-receipt lifecycle (05R7.5). Consumes
 * `markDoneOnlyAfterExitZeroReceiptStored` in production gate logic: the
 * receipt task must remain TODO during pre-gate evaluation, and the current
 * gate rejects a manual pre-gate DONE unless a stored post-gate receipt binds
 * the exact pre-gate authority. The stored receipt must never be pinned by the
 * manifest it attests (hash cycle); the successor manifest pins and verifies
 * it before unlock. Only contracts declaring
 * `currentGateMustRejectDoneWithoutPostGateTransition` take this path, so
 * older prompts keep their recorded lifecycle semantics.
 */
function checkGateReceiptLifecycle(manifest: PlannerManifest, ledgerTasks: LedgerTask[], cliPrompt: string, manifestRelPath: string) {
  const contractRel = findPlannerContractForPrompt(manifest, cliPrompt);
  if (!contractRel) {
    pass('Gate-receipt lifecycle not applicable (no planner-owned contract)');
    return;
  }
  const contract = readPlannerContractJson(contractRel) as any;
  if (!contract) {
    // PLANNER_ARTIFACT_MISSING already recorded; do not double-report here.
    return;
  }
  if (contract.prompt && String(contract.prompt) !== cliPrompt) {
    pass('Planner-owned contract targets another prompt; gate-receipt lifecycle not applicable');
    return;
  }
  const lifecycle = contract.gateReceiptLifecycle as {
    taskId?: string;
    markDoneOnlyAfterExitZeroReceiptStored?: boolean;
    currentGateMustRejectDoneWithoutPostGateTransition?: unknown;
  } | undefined;
  const gateMeta = contract.gateReceipt as { path?: string } | undefined;
  // 05R7B consumption marks: both lifecycle fields are read here (the
  // applicability branch below decides behavior; the read itself is marked).
  if (is05R7BContract(contract)) {
    if (contract.gateReceipt && typeof contract.gateReceipt === 'object') consumeControl('/gateReceipt');
    if (contract.gateReceiptLifecycle && typeof contract.gateReceiptLifecycle === 'object') {
      consumeControl('/gateReceiptLifecycle');
    }
  }
  if (lifecycle?.markDoneOnlyAfterExitZeroReceiptStored !== true
    || lifecycle.currentGateMustRejectDoneWithoutPostGateTransition !== true
    || !gateMeta?.path) {
    pass('Acyclic gate-receipt enforcement not declared by this prompt; lifecycle not applicable');
    return;
  }
  const receiptTaskId = lifecycle.taskId ?? currentGateReceiptTaskId(manifest, cliPrompt);
  const task = ledgerTasks.find((t) => t.id === receiptTaskId);
  if (!task) return; // Manifest/ledger cross-check already reports a missing task.
  const statusBase = task.status.toUpperCase().replace(/\s.*$/, '');
  if (statusBase === 'TODO') {
    pass(`Gate-receipt task ${receiptTaskId} TODO pre-gate; DONE requires a stored exit-zero receipt`);
    return;
  }
  if (statusBase !== 'DONE' && statusBase !== 'COMPLETE') {
    return; // INVALID_STATUS/BLOCKED handling belongs to the status checks.
  }
  const receiptRel = String(gateMeta.path);
  const receiptNorm = receiptRel.replace(/\\/g, '/');
  if (!receiptRel || /^[A-Za-z]:\//.test(receiptNorm) || receiptNorm.startsWith('/') || receiptNorm.split('/').includes('..')) {
    error('GATE_RECEIPT_MALFORMED', `Gate receipt path escapes the workspace: "${receiptRel}"`);
    return;
  }
  const receiptAbs = resolveGatePath(receiptRel);
  if (!existsSync(receiptAbs)) {
    error('GATE_RECEIPT_NOT_STORED',
      `Gate-receipt task ${receiptTaskId} is DONE but no stored exit-zero receipt exists at "${receiptRel}". Direct TODO-to-DONE without a post-gate transition is forbidden.`);
    return;
  }
  let stored: Record<string, unknown>;
  try {
    stored = JSON.parse(readFileSync(receiptAbs, 'utf-8')) as Record<string, unknown>;
  } catch (e: any) {
    error('GATE_RECEIPT_MALFORMED', `Stored gate receipt at "${receiptRel}" is not valid JSON: ${e.message}`);
    return;
  }
  try {
    assertGateReceiptBindsPreGateAuthority(stored, {
      plan: manifest.plan,
      prompt: cliPrompt,
      nowMs: Date.now(),
      maxAgeMs: GATE_RECEIPT_MAX_AGE_MS,
      maxFutureSkewMs: GATE_RECEIPT_MAX_FUTURE_SKEW_MS,
    });
  } catch (e: any) {
    const msg = String(e.message ?? '');
    const code = msg.split(':')[0] || 'GATE_RECEIPT_MALFORMED';
    error(code, `Stored gate receipt binding failed: ${msg}`);
    return;
  }
  // Formal-receipt value binding against recomputed current bytes.
  const formalRel = String((contract.formalReviewReceipt as { path?: string } | undefined)?.path ?? '');
  let formalSha: string | undefined;
  try {
    formalSha = formalRel ? sha256File(formalRel) : undefined;
  } catch {
    formalSha = undefined;
  }
  if (!formalSha || formalSha !== String(stored['formalReviewReceiptSha256'] ?? '').trim().toUpperCase()) {
    error('GATE_RECEIPT_FORMAL_RECEIPT_MISMATCH',
      `Stored gate receipt binds formal-receipt SHA ${String(stored['formalReviewReceiptSha256'] ?? 'missing')} which differs from the current planner-pinned receipt bytes.`);
    return;
  }
  // Manifest branching: successor mode verifies the pin; pre-gate mode
  // requires the bound pre-gate hash and reports the missing successor pin.
  const currentManifestSha = sha256File(manifestRelPath);
  const boundManifestSha = String(stored['manifestSha256'] ?? '').trim().toUpperCase();
  const manifestPinsReceipt = (manifest.plannerOwnedArtifacts ?? []).some(
    (a) => String(a.path ?? '').replace(/\\/g, '/').trim() === receiptNorm.trim(),
  );
  if (manifestPinsReceipt) {
    if (boundManifestSha === currentManifestSha) {
      error('GATE_RECEIPT_CYCLE',
        `Manifest pins the gate receipt it attests ("${receiptRel}"); the successor manifest must pin it instead.`);
      return;
    }
    try {
      const storedSha = sha256File(receiptRel);
      assertSuccessorManifestPinsGateReceipt(manifest, manifest.plan, receiptRel, storedSha);
      pass('Successor manifest pins the stored gate receipt; acyclic unlock verified');
    } catch (e: any) {
      const msg = String(e.message ?? '');
      const code = msg.split(':')[0] || 'SUCCESSOR_PIN_MISMATCH';
      error(code, `Successor gate-receipt verification failed: ${msg}`);
    }
    return;
  }
  if (boundManifestSha !== currentManifestSha) {
    error('GATE_RECEIPT_MANIFEST_MISMATCH',
      `Stored gate receipt binds pre-gate manifest ${boundManifestSha} which differs from the current manifest ${currentManifestSha}.`);
    return;
  }
  error('SUCCESSOR_PIN_MISSING',
    `Stored gate receipt binds this pre-gate manifest, but no successor manifest pins the receipt yet; unlock requires successor pinning and verification.`);
}

// ─── Prompt 05R7A production-gate scope closure (DBR-05R7A.3) ───

/**
 * Mechanical changed-file scope closure inside the exact production validator
 * (05R7A.3). Consumes `scopeClosure` from the prompt-matching planner
 * contract. Mechanically discovers the complete in-scope file set from its
 * exact paths plus directory/name rules, then compares that discovered set
 * exactly with `reviewedImplementationPaths` and, once a formal receipt is
 * issued, with the receipt's `reviewedFiles` set.
 *
 * Fails on missing, additional, duplicate, renamed, dangling, escaping, or
 * unreviewed in-scope paths. Retaining a test-only closure is not sufficient;
 * this must execute during the exact `... --prompt 05R7A` command. Static test
 * declaration counts are never treated as proof that any suite or closure ran.
 */
function checkScopeClosure(manifest: PlannerManifest, cliPrompt: string) {
  const contractRel = findPlannerContractForPrompt(manifest, cliPrompt);
  if (!contractRel) {
    pass('Scope closure not applicable (no planner-owned contract)');
    return;
  }
  const contract = readPlannerContractJson(contractRel) as any;
  if (!contract) {
    return;
  }
  if (contract.prompt && String(contract.prompt) !== cliPrompt) {
    pass('Planner-owned contract targets another prompt; scope closure not applicable');
    return;
  }
  const closure = contract.scopeClosure as {
    enforcedByExactValidatorEntryPoint?: unknown;
    exactPaths?: unknown;
    directoryRules?: Array<{ directory?: unknown; fileNamePattern?: unknown }>;
    requireExactSetEquality?: unknown;
  } | undefined;
  if (!closure || closure.enforcedByExactValidatorEntryPoint !== true) {
    pass('Scope closure not declared by this prompt; closure check not applicable');
    return;
  }
  // 05R7B consumption marks: every scopeClosure policy flag is read here and
  // must require the enforced values; anything weaker fails closed. Marks
  // mirror the exact `controlEnforcement.enforceableJsonPointers` entries.
  // 05R7C declares granular transitive pointers instead of the singular
  // 05R7B pointer; consume the granular set for trace contracts.
  const isScopeR7B = is05R7BContract(contract);
  const isTrace = is05R7CTraceContract(contract);
  if (isScopeR7B) {
    try {
      assertScopeClosurePolicyFlags(contract.scopeClosure);
    } catch (e: any) {
      const msg = String(e.message ?? '');
      error(msg.split(':')[0] || 'SCOPE_CLOSURE_POLICY_MISMATCH', `Scope closure policy check failed: ${msg}`);
      return;
    }
    consumeControl('/scopeClosure/enforcedByExactValidatorEntryPoint');
    consumeControl('/scopeClosure/workspaceOnly');
    consumeControl('/scopeClosure/exactPaths');
    consumeControl('/scopeClosure/directoryRules');
    consumeControl('/scopeClosure/requireExactSetEquality');
    consumeControl('/scopeClosure/rejectMissingAdditionalDuplicateRenamedDanglingOrEscaping');
    consumeControl('/scopeClosure/testOnlyClosureInsufficient');
  }
  const exactPaths = Array.isArray(closure.exactPaths) ? closure.exactPaths.map((p: unknown) => String(p)) : [];
  const directoryRules = Array.isArray(closure.directoryRules) ? closure.directoryRules : [];
  // Mechanically discover directory-rule matches from disk.
  const discoveredFromRules: string[] = [];
  for (const rule of directoryRules) {
    const dir = String(rule.directory ?? '');
    const patternSrc = String(rule.fileNamePattern ?? '');
    if (!dir || !patternSrc) {
      error('SCOPE_CLOSURE_MISSING', `Scope closure directory rule omits directory or fileNamePattern.`);
      continue;
    }
    const dirNorm = dir.replace(/\\/g, '/').trim();
    if (/^[A-Za-z]:\//.test(dirNorm) || dirNorm.startsWith('/') || dirNorm.split('/').includes('..')) {
      error('SCOPE_CLOSURE_ESCAPE', `Scope closure directory escapes the workspace: "${dir}"`);
      continue;
    }
    let pattern: RegExp;
    try {
      pattern = new RegExp(patternSrc);
    } catch (e: any) {
      error('SCOPE_CLOSURE_MISSING', `Scope closure fileNamePattern is not a valid RegExp: "${patternSrc}"`);
      continue;
    }
    const absDir = resolveGatePath(dir);
    let entries: string[];
    try {
      entries = readdirSync(absDir);
    } catch {
      error('SCOPE_CLOSURE_MISSING', `Scope closure directory not found on disk: "${dir}"`);
      continue;
    }
    for (const name of entries) {
      if (pattern.test(name)) {
        discoveredFromRules.push(`${dirNorm}/${name}`);
      }
    }
  }
  const discovered = [...exactPaths.map((p) => String(p).replace(/\\/g, '/').trim()), ...discoveredFromRules];
  // 05R7B transitive local imports: starting from each planner-declared
  // production root, parse static relative runtime imports recursively and
  // add every reachable local source to the mechanically discovered set, so
  // a newly imported helper cannot escape review merely because its
  // filename matches no fixed scope rule. Unresolved or escaping imports
  // fail closed; cycles are visited once (deterministic traversal).
  // 05R7C syntax-complete walk accepts single-quoted, double-quoted, and
  // no-substitution template targets; comments and ordinary strings create
  // no edges; non-static import()/require() targets fail closed.
  if (isScopeR7B) {
    try {
      if (isTrace) {
        const walkConfig = assertTransitiveImportClosurePolicy05R7C(contract.scopeClosure);
        consumeControl('/scopeClosure/transitiveLocalImports/required');
        consumeControl('/scopeClosure/transitiveLocalImports/productionRoots');
        consumeControl('/scopeClosure/transitiveLocalImports/allowedSourceRoots');
        consumeControl('/scopeClosure/transitiveLocalImports/runtimeSpecifierMap');
        consumeControl('/scopeClosure/transitiveLocalImports/fixedLiteralForms');
        consumeControl('/scopeClosure/transitiveLocalImports/nonStaticTargetPolicy');
        consumeControl('/scopeClosure/transitiveLocalImports/nonStaticErrorCode');
        consumeControl('/scopeClosure/transitiveLocalImports/commentsAndOrdinaryStringsCreateNoEdges');
        consumeControl('/scopeClosure/transitiveLocalImports/rejectUnresolvedRelativeImport');
        consumeControl('/scopeClosure/transitiveLocalImports/rejectSourceRootEscape');
        consumeControl('/scopeClosure/transitiveLocalImports/cyclesAreVisitedOnce');
        const transitiveDiscovered = collectTransitiveLocalImports(walkConfig.productionRoots, walkConfig, {
          readFile: (repoPath) => {
            try {
              return readFileSync(resolveGatePath(repoPath), 'utf-8');
            } catch {
              return null;
            }
          },
          fileExists: (repoPath) => {
            try {
              return existsSync(resolveGatePath(repoPath));
            } catch {
              return false;
            }
          },
        });
        for (const t of transitiveDiscovered) {
          discovered.push(String(t).replace(/\\/g, '/').trim());
        }
        pass(`Transitive local imports resolved from ${walkConfig.productionRoots.length} production root(s): ${transitiveDiscovered.length} reachable file(s)`);
      } else {
        const walkConfig = assertTransitiveImportConfig(contract.scopeClosure);
        consumeControl('/scopeClosure/transitiveLocalImports');
        const transitiveDiscovered = collectTransitiveLocalImports(walkConfig.productionRoots, walkConfig, {
          readFile: (repoPath) => {
            try {
              return readFileSync(resolveGatePath(repoPath), 'utf-8');
            } catch {
              return null;
            }
          },
          fileExists: (repoPath) => {
            try {
              return existsSync(resolveGatePath(repoPath));
            } catch {
              return false;
            }
          },
        });
        for (const t of transitiveDiscovered) {
          discovered.push(String(t).replace(/\\/g, '/').trim());
        }
        pass(`Transitive local imports resolved from ${walkConfig.productionRoots.length} production root(s): ${transitiveDiscovered.length} reachable file(s)`);
      }
    } catch (e: any) {
      const msg = String(e.message ?? '');
      error(msg.split(':')[0] || 'SCOPE_CLOSURE_MISSING', `Transitive import closure failed: ${msg}`);
      return;
    }
  }
  // Deduplicate (production roots and helpers already covered by exact
  // paths or directory rules appear once); the pure set comparison below
  // rejects genuine missing/additional/duplicate/escaping entries.
  const discoveredUnique = [...new Set(discovered)];
  const pinned: string[] = Array.isArray(contract.reviewedImplementationPaths)
    ? contract.reviewedImplementationPaths.map((p: unknown) => String(p))
    : [];
  if (pinned.length === 0) {
    error('SCOPE_CLOSURE_MISSING', 'Planner contract declares no reviewedImplementationPaths for scope closure.');
    return;
  }
  // Existing-on-disk set for dangling-pin distinction.
  const existingOnDisk = new Set<string>();
  for (const p of [...discoveredUnique, ...pinned]) {
    try {
      if (existsSync(resolveGatePath(p))) {
        existingOnDisk.add(String(p).replace(/\\/g, '/').trim());
      }
    } catch {
      continue;
    }
  }
  try {
    assertScopeClosureMatches(discoveredUnique, pinned, existingOnDisk);
    pass(`Scope closure matches planner contract exactly (${discoveredUnique.length} in-scope file(s))`);
  } catch (e: any) {
    const msg = String(e.message ?? '');
    const code = msg.split(':')[0] || 'SCOPE_CLOSURE_MISSING';
    error(code, `Changed-file scope closure failed: ${msg}`);
    return;
  }
  // Once a formal receipt is issued, the discovered set must also equal the
  // receipt's reviewedFiles set (renamed/dangling/unreviewed receipt entries
  // fail here even when the contract comparison passed).
  const receiptMeta = contract.formalReviewReceipt as { state?: string; path?: string } | undefined;
  if (receiptMeta?.state === 'ISSUED' && receiptMeta.path) {
    const receiptAbs = resolveGatePath(String(receiptMeta.path));
    if (existsSync(receiptAbs)) {
      try {
        const receipt = JSON.parse(readFileSync(receiptAbs, 'utf-8')) as { reviewedFiles?: Array<{ path?: unknown }> };
        const receiptPaths = Array.isArray(receipt.reviewedFiles)
          ? receipt.reviewedFiles.map((f) => String(f.path ?? ''))
          : [];
        try {
          assertScopeClosureMatches(discoveredUnique, receiptPaths, existingOnDisk);
          pass('Scope closure matches issued formal receipt exactly');
        } catch (e: any) {
          const msg = String(e.message ?? '');
          const code = msg.split(':')[0] || 'SCOPE_CLOSURE_MISSING';
          error(code, `Changed-file scope closure against issued receipt failed: ${msg}`);
        }
      } catch {
        // Receipt JSON errors are reported by the formal-receipt check; do not
        // double-report here.
      }
    }
  }
}

// ─── Prompt 05R7D lexical import parsing contract (DBR-05R7D.1–.2) ───

/**
 * Lexically safe import discovery enforcement (05R7D.2). Consumes every
 * `lexicalImportParsingContract` field from the prompt-matching planner
 * contract and enforces it through the exact production validator:
 * - pure shape assertion via assertLexicalImportParsingContract (strategy,
 *   pre-strip forbidden, outside-literals only, delimiter cannot suppress,
 *   reject diagnostics, PARSE_FAILED code, 8 script kinds, 7 interaction
 *   fixtures);
 * - real-entry-point behavioral probes against the real
 *   parseRelativeRuntimeImports implementation (block/line markers in strings,
 *   delimiter markers in templates/regex, real comments with fake imports,
 *   real comments between import and call, malformed rejection, non-static
 *   rejection, JSX handling, and 8 script-kind filenames).
 * Every enforceable pointer is consumed and affects the gate result: weakened
 * policies fail with SCOPE_CLOSURE_POLICY_MISMATCH; hidden imports fail with
 * LEXICAL_DELIMITER_SUPPRESSION; false edges fail with LEXICAL_FALSE_EDGE;
 * unrejected malformed/non-static fail with their required codes.
 */
function checkLexicalImportParsingContract(manifest: PlannerManifest, cliPrompt: string) {
  const contractRel = findPlannerContractForPrompt(manifest, cliPrompt);
  if (!contractRel) {
    pass('Lexical import parsing not applicable (no planner-owned contract)');
    return;
  }
  const contract = readPlannerContractJson(contractRel) as any;
  if (!contract) return;
  if (contract.prompt && String(contract.prompt) !== cliPrompt) {
    pass('Planner-owned contract targets another prompt; lexical check not applicable');
    return;
  }
  const lexical = (contract as { lexicalImportParsingContract?: unknown }).lexicalImportParsingContract;
  if (!lexical || typeof lexical !== 'object') {
    pass('Lexical import parsing not declared by this prompt; check not applicable');
    return;
  }
  try {
    assertLexicalImportParsingContract(contract);
  } catch (e: any) {
    const msg = String(e.message ?? '');
    error(msg.split(':')[0] || 'SCOPE_CLOSURE_POLICY_MISMATCH', `Lexical contract shape check failed: ${msg}`);
    return;
  }
  consumeControl('/lexicalImportParsingContract/strategy');
  consumeControl('/lexicalImportParsingContract/preStripCommentsForbidden');
  consumeControl('/lexicalImportParsingContract/commentsRecognizedOnlyOutsideLiterals');
  consumeControl('/lexicalImportParsingContract/delimiterTextCannotSuppressLaterImport');
  consumeControl('/lexicalImportParsingContract/parseDiagnosticsPolicy');
  consumeControl('/lexicalImportParsingContract/parseFailureErrorCode');
  consumeControl('/lexicalImportParsingContract/requiredScriptKinds');
  consumeControl('/lexicalImportParsingContract/requiredInteractionFixtures');
  pass('Lexical import parsing contract shape validated (8/8 controls)');

  // Behavioral interaction probes against the real parser (exact gate logic).
  try {
    const blockCode = 'const marker = "/*";\nconst loaded = import("./hidden-block.js");\nconst end = "*/";\n';
    const blockFound = parseRelativeRuntimeImports(blockCode, 'probe-block.ts');
    if (!blockFound.includes('./hidden-block.js')) {
      error('LEXICAL_DELIMITER_SUPPRESSION', 'Lexical probe failed: block-comment marker inside ordinary string hid a later real import (block-comment-marker-in-string-before-real-import).');
      return;
    }
    const lineCode = 'const lineMarker = " //"; const other = import("./hidden-line.js");\n';
    const lineFound = parseRelativeRuntimeImports(lineCode, 'probe-line.ts');
    if (!lineFound.includes('./hidden-line.js')) {
      error('LEXICAL_DELIMITER_SUPPRESSION', 'Lexical probe failed: line-comment marker inside ordinary string hid a later real import (line-comment-marker-in-string-before-real-import).');
      return;
    }
    const tplCode = 'const t = `/*`; const u = import("./hidden-template.js");\n';
    const tplFound = parseRelativeRuntimeImports(tplCode, 'probe-template.ts');
    if (!tplFound.includes('./hidden-template.js')) {
      error('LEXICAL_DELIMITER_SUPPRESSION', 'Lexical probe failed: delimiter marker inside template literal hid a later real import (delimiter-marker-in-template-before-real-import).');
      return;
    }
    const regexCode = 'const r = /\\/\\*/; const v = import("./hidden-regex.js");\n';
    const regexFound = parseRelativeRuntimeImports(regexCode, 'probe-regex.js');
    if (!regexFound.includes('./hidden-regex.js')) {
      error('LEXICAL_DELIMITER_SUPPRESSION', 'Lexical probe failed: delimiter marker inside regex literal hid a later real import (delimiter-marker-in-regex-before-real-import).');
      return;
    }
    const fakeCode = '/* fake import("./fake-hidden.js") */ const z = import("./real-visible.js");\n';
    const fakeFound = parseRelativeRuntimeImports(fakeCode, 'probe-fake.ts');
    if (fakeFound.includes('./fake-hidden.js')) {
      error('LEXICAL_FALSE_EDGE', 'Lexical probe failed: genuine block comment with fake import created an edge (real-comment-with-fake-import).');
      return;
    }
    if (!fakeFound.includes('./real-visible.js')) {
      error('LEXICAL_DELIMITER_SUPPRESSION', 'Lexical probe failed: genuine comment suppressed a later real import (real-comment-with-fake-import).');
      return;
    }
    const betweenCode = 'const m = import /* comment */ ("./with-comment.js");\n';
    const betweenFound = parseRelativeRuntimeImports(betweenCode, 'probe-between.ts');
    if (!betweenFound.includes('./with-comment.js')) {
      error('LEXICAL_FALSE_EDGE', 'Lexical probe failed: genuine comment between import and call hid a fixed target (real-comment-between-import-and-call).');
      return;
    }
    // Malformed must fail closed with PARSE_FAILED.
    let malformedThrew = false;
    let malformedCode = '';
    try {
      parseRelativeRuntimeImports('const x = ;;; import { unbalanced\n', 'probe-malformed.ts');
    } catch (e: any) {
      malformedThrew = true;
      malformedCode = String(e.message ?? '');
    }
    if (!malformedThrew || !malformedCode.includes('SCOPE_CLOSURE_PARSE_FAILED')) {
      error('SCOPE_CLOSURE_PARSE_FAILED', 'Lexical probe failed: malformed source did not fail closed with SCOPE_CLOSURE_PARSE_FAILED (malformed-source-fails-closed).');
      return;
    }
    // Non-static template expression must fail closed with NONSTATIC.
    let nonStaticThrew = false;
    let nonStaticCode = '';
    try {
      parseRelativeRuntimeImports('const m = await import(`./dir/${name}.js`);\n', 'probe-nonstatic.ts');
    } catch (e: any) {
      nonStaticThrew = true;
      nonStaticCode = String(e.message ?? '');
    }
    if (!nonStaticThrew || !nonStaticCode.includes('SCOPE_CLOSURE_NONSTATIC_IMPORT')) {
      error('SCOPE_CLOSURE_NONSTATIC_IMPORT', 'Lexical probe failed: template-expression import() did not fail closed with SCOPE_CLOSURE_NONSTATIC_IMPORT.');
      return;
    }
    // F-05R7D-01: zero-argument import()/require() must fail closed with
    // NONSTATIC. Exactly one fixed literal is the only accepted shape.
    const zeroProbes: Array<[string, string]> = [
      ['const m = await import();\n', 'probe-zero-import.ts'],
      ['const h = require();\n', 'probe-zero-require.ts'],
      ['const m = await import(/* no target */);\n', 'probe-zero-import-comment.ts'],
      ['const h = require(/* no target */);\n', 'probe-zero-require-comment.ts'],
    ];
    for (const [zeroCode, zeroName] of zeroProbes) {
      let threw = false;
      let msg = '';
      try {
        parseRelativeRuntimeImports(zeroCode, zeroName);
      } catch (e: any) {
        threw = true;
        msg = String(e.message ?? '');
      }
      if (!threw || !msg.includes('SCOPE_CLOSURE_NONSTATIC_IMPORT')) {
        error('SCOPE_CLOSURE_NONSTATIC_IMPORT', `Lexical probe failed: zero-argument form in ${zeroName} did not fail closed with SCOPE_CLOSURE_NONSTATIC_IMPORT (F-05R7D-01).`);
        return;
      }
    }
    // JSX text must not create edges; real import after JSX must be found.
    const jsxCode = 'const el = <div>from "./jsx-fake.js"</div>;\nimport { real } from "./jsx-real.js";\n';
    const jsxFound = parseRelativeRuntimeImports(jsxCode, 'probe-jsx.tsx');
    if (jsxFound.includes('./jsx-fake.js')) {
      error('LEXICAL_FALSE_EDGE', 'Lexical probe failed: JSX text created an import edge.');
      return;
    }
    if (!jsxFound.includes('./jsx-real.js')) {
      error('LEXICAL_DELIMITER_SUPPRESSION', 'Lexical probe failed: real import after JSX text was hidden.');
      return;
    }
    // Script kinds: same valid source must parse under all 8 required kinds.
    const kinds: Array<[string, string]> = [
      ['probe-kinds.ts', 'ts'], ['probe-kinds.tsx', 'tsx'], ['probe-kinds.js', 'js'], ['probe-kinds.jsx', 'jsx'],
      ['probe-kinds.mts', 'mts'], ['probe-kinds.cts', 'cts'], ['probe-kinds.mjs', 'mjs'], ['probe-kinds.cjs', 'cjs'],
    ];
    for (const [fname] of kinds) {
      const kFound = parseRelativeRuntimeImports('import { k } from "./kinds-helper.js";\n', fname);
      if (!kFound.includes('./kinds-helper.js')) {
        error('SCOPE_CLOSURE_POLICY_MISMATCH', `Lexical probe failed: script kind ${fname} did not discover a valid static import.`);
        return;
      }
    }
    pass('Lexical interaction probes preserve context (7/7 fixtures, JSX, 8 script kinds, malformed/non-static fail closed)');
  } catch (e: any) {
    const msg = String(e.message ?? '');
    const code = msg.split(':')[0] || 'LEXICAL_DELIMITER_SUPPRESSION';
    error(code, `Lexical behavioral probe failed: ${msg}`);
  }
}

// ─── Prompt 05R7B planner-control consumption, filesystem identity, advisory identity (DBR-05R7B.1–.4) ───

/**
 * Fail-closed filesystem-identity policy validation (05R7B.3). Reads the
 * planner-owned `filesystemFailurePolicy` and requires every stage to
 * reject with well-formed error codes. The validated codes drive the
 * probe-evidence loop above (real-path failures and read/hash failures
 * reject the evidence instead of falling through to weaker checks).
 */
function checkFilesystemFailurePolicy(manifest: PlannerManifest, cliPrompt: string) {
  const contractRel = findPlannerContractForPrompt(manifest, cliPrompt);
  if (!contractRel) {
    pass('Filesystem failure policy not applicable (no planner-owned contract)');
    return;
  }
  const contract = readPlannerContractJson(contractRel) as any;
  if (!contract) return;
  if (contract.prompt && String(contract.prompt) !== cliPrompt) {
    pass('Planner-owned contract targets another prompt; filesystem policy not applicable');
    return;
  }
  if (!is05R7BContract(contract)) {
    pass('Filesystem failure policy not declared by this prompt; fail-closed identity not applicable');
    return;
  }
  try {
    assertFilesystemFailurePolicy(contract.filesystemFailurePolicy);
    consumeControl('/filesystemFailurePolicy');
    pass('Filesystem failure policy validated (all required identity stages reject)');
  } catch (e: any) {
    const msg = String(e.message ?? '');
    error(msg.split(':')[0] || 'FILESYSTEM_FAILURE_POLICY_MISMATCH', `Filesystem failure policy check failed: ${msg}`);
  }
}

/**
 * Zero-mutation boundary consumption (05R7B.1/05R7B.5). This pass is
 * zero-write for databases, migrations, configuration, and runtime: every
 * planner-declared boundary flag must be explicitly false, otherwise the
 * gate fails closed with MUTATION_BOUNDARY_VIOLATION.
 */
function checkMutationBoundary(manifest: PlannerManifest, cliPrompt: string) {
  const contractRel = findPlannerContractForPrompt(manifest, cliPrompt);
  if (!contractRel) {
    pass('Mutation boundary not applicable (no planner-owned contract)');
    return;
  }
  const contract = readPlannerContractJson(contractRel) as any;
  if (!contract) return;
  if (contract.prompt && String(contract.prompt) !== cliPrompt) {
    pass('Planner-owned contract targets another prompt; mutation boundary not applicable');
    return;
  }
  if (!is05R7BContract(contract) || !contract.mutationBoundary) {
    pass('Mutation boundary not declared by this prompt; boundary check not applicable');
    return;
  }
  try {
    assertMutationBoundaryZero(contract.mutationBoundary);
    consumeControl('/mutationBoundary');
    pass('Mutation boundary is explicitly zero (no database, migration, configuration, runtime, or cutover writes)');
  } catch (e: any) {
    const msg = String(e.message ?? '');
    error(msg.split(':')[0] || 'MUTATION_BOUNDARY_VIOLATION', `Mutation boundary check failed: ${msg}`);
  }
}

/**
 * Advisory review identity enforcement (05R7B.4). Advisory credit requires
 * the last N consecutive artifacts (by iteration number, N from the
 * planner contract) to each carry zeroFix true, name the exact validator
 * entry point, and repeat verbatim — as reviewerContextId — one of the
 * executor-recorded spawn-returned IDs from the DBR-05R7B.4 ledger
 * evidence, with all IDs in the window distinct. Blank, alias-only,
 * `none exposed`, invalid-listed, identical, non-zero-fix, or
 * ledger-mismatched artifacts fail with ADVISORY_REVIEW_IDENTITY_INVALID
 * and can never satisfy the task or streak. Advisory reviews remain
 * non-authoritative: they never satisfy formal review coverage.
 */
function checkAdvisoryReviewIdentity(manifest: PlannerManifest, cliPrompt: string) {
  const contractRel = findPlannerContractForPrompt(manifest, cliPrompt);
  if (!contractRel) {
    pass('Advisory identity not applicable (no planner-owned contract)');
    return;
  }
  const contract = readPlannerContractJson(contractRel) as any;
  if (!contract) return;
  if (contract.prompt && String(contract.prompt) !== cliPrompt) {
    pass('Planner-owned contract targets another prompt; advisory identity not applicable');
    return;
  }
  const adv = (contract as { advisoryReviewContract?: unknown }).advisoryReviewContract as
    | Record<string, unknown>
    | undefined;
  if (!adv || typeof adv !== 'object' || adv['spawnReturnedIdRequired'] !== true) {
    pass('Advisory spawn-identity enforcement not declared by this prompt; advisory check not applicable');
    return;
  }
  let policy;
  try {
    policy = assertAdvisoryReviewContractShape(contract);
  } catch (e: any) {
    const msg = String(e.message ?? '');
    error(msg.split(':')[0] || 'ADVISORY_REVIEW_CONTRACT_MISMATCH', `Advisory contract check failed: ${msg}`);
    return;
  }
  consumeControl('/advisoryReviewContract/minimumConsecutiveZeroFindingPasses');
  consumeControl('/advisoryReviewContract/distinctExecutionSystemContextIdsRequired');
  consumeControl('/advisoryReviewContract/spawnReturnedIdRequired');
  consumeControl('/advisoryReviewContract/invalidIdentityValues');
  consumeControl('/advisoryReviewContract/artifactDirectory');
  consumeControl('/advisoryReviewContract/artifactFileNamePattern');
  consumeControl('/advisoryReviewContract/strictTypeAndPathBoundaryPartitionRequired');
  consumeControl('/advisoryReviewContract/realEntryPointRequired');
  consumeControl('/advisoryReviewContract/formalAuthority');

  let pattern: RegExp;
  try {
    pattern = new RegExp(policy.artifactFileNamePattern);
  } catch {
    error('ADVISORY_REVIEW_CONTRACT_MISMATCH', 'Advisory artifact filename pattern is not a valid RegExp.');
    return;
  }
  let files: string[] = [];
  try {
    const dirAbs = resolveGatePath(policy.artifactDirectory);
    if (existsSync(dirAbs)) {
      files = readdirSync(dirAbs).filter((f) => pattern.test(f));
    }
  } catch {
    files = [];
  }
  const artifacts = files.map((f) => {
    let content = '';
    try {
      content = readFileSync(resolveGatePath(`${policy.artifactDirectory}/${f}`), 'utf-8');
    } catch {
      content = '';
    }
    const reviewerMatch = content.match(/(?:^|\n)\s*(?:-\s*)?reviewerContextId:\s*(.+)/im);
    const zeroFixMatch = content.match(/zeroFix\s*:\s*(true|false)/i);
    return {
      fileName: f,
      reviewerContextId: reviewerMatch?.[1]?.trim() ?? '',
      zeroFix: zeroFixMatch?.[1]?.toLowerCase() === 'true',
      mentionsEntryPoint: content.includes('verify:execution-gate'),
    };
  });
  const ledgerContent = readFile(manifest.canonicalPaths.ledger);
  const ledgerTasks = parseLedgerTasks(ledgerContent);
  const advisoryTask = ledgerTasks.find((t) => t.id === 'DBR-05R7B.4');
  let spawnIds: string[] = [];
  if (advisoryTask) {
    const m = advisoryTask.evidence.match(/spawnReturnedIds\s*:\s*\[([^\]]*)\]/i);
    if (m) {
      spawnIds = m[1]
        .split(',')
        .map((s) => s.trim().replace(/^['"]|['"]$/g, '').trim())
        .filter((s) => s.length > 0);
    }
  }
  try {
    assertAdvisoryStreak({ artifacts, spawnReturnedIds: spawnIds, policy });
    pass(`Advisory streak verified (${policy.minimumConsecutiveZeroFindingPasses} consecutive genuine-ID zero-finding passes)`);
  } catch (e: any) {
    const msg = String(e.message ?? '');
    error(msg.split(':')[0] || 'ADVISORY_REVIEW_IDENTITY_INVALID', `Advisory identity check failed: ${msg}`);
  }
}

/**
 * Advisory trace-consistency enforcement (05R7C.2–.3). Trace evidence is
 * explicitly trace-only: matching parent-recorded relayed IDs and reviewer
 * Markdown proves trace consistency, not execution-system issuance, and never
 * satisfies formal review, receipt, unlock, approval, or mutation authority.
 * The parent must relay each spawn-returned ID to the reviewer before the
 * artifact is written; the child need not self-discover it. Failures use
 * ADVISORY_TRACE_* codes with trace-only wording.
 */
function checkAdvisoryTraceIdentity(manifest: PlannerManifest, cliPrompt: string) {
  const contractRel = findPlannerContractForPrompt(manifest, cliPrompt);
  if (!contractRel) {
    pass('Advisory trace not applicable (no planner-owned contract)');
    return;
  }
  const contract = readPlannerContractJson(contractRel) as any;
  if (!contract) return;
  if (contract.prompt && String(contract.prompt) !== cliPrompt) {
    pass('Planner-owned contract targets another prompt; advisory trace not applicable');
    return;
  }
  if (!is05R7CTraceContract(contract)) {
    pass('Advisory trace contract not declared by this prompt; trace check not applicable');
    return;
  }
  let policy;
  try {
    policy = assertAdvisoryTraceContractShape(contract);
  } catch (e: any) {
    const msg = String(e.message ?? '');
    error(msg.split(':')[0] || 'ADVISORY_TRACE_CONTRACT_MISMATCH', `Advisory trace contract check failed: ${msg}`);
    return;
  }
  consumeControl('/advisoryTraceContract/authorityLevel');
  consumeControl('/advisoryTraceContract/repositoryTextProvesIssuance');
  consumeControl('/advisoryTraceContract/parentMustRelaySpawnReturnedId');
  consumeControl('/advisoryTraceContract/childSelfIntrospectionRequired');
  consumeControl('/advisoryTraceContract/minimumConsecutiveZeroFindingPasses');
  consumeControl('/advisoryTraceContract/distinctRelayedIdsRequired');
  consumeControl('/advisoryTraceContract/artifactLedgerAgreementRequired');
  consumeControl('/advisoryTraceContract/realEntryPointRequired');
  consumeControl('/advisoryTraceContract/formalAuthority');
  consumeControl('/advisoryTraceContract/formalReviewSeparate');
  consumeControl('/advisoryTraceContract/artifactDirectory');
  consumeControl('/advisoryTraceContract/artifactFileNamePattern');

  let pattern: RegExp;
  try {
    pattern = new RegExp(policy.artifactFileNamePattern);
  } catch {
    error('ADVISORY_TRACE_CONTRACT_MISMATCH', 'Advisory trace artifact filename pattern is not a valid RegExp.');
    return;
  }
  let files: string[] = [];
  try {
    const dirAbs = resolveGatePath(policy.artifactDirectory);
    if (existsSync(dirAbs)) {
      files = readdirSync(dirAbs).filter((f) => pattern.test(f));
    }
  } catch {
    files = [];
  }
  const artifacts = files.map((f) => {
    let content = '';
    try {
      content = readFileSync(resolveGatePath(`${policy.artifactDirectory}/${f}`), 'utf-8');
    } catch {
      content = '';
    }
    const reviewerMatch = content.match(/(?:^|\n)\s*(?:-\s*)?reviewerContextId:\s*(.+)/im);
    const zeroFixMatch = content.match(/zeroFix\s*:\s*(true|false)/i);
    return {
      fileName: f,
      reviewerContextId: reviewerMatch?.[1]?.trim() ?? '',
      zeroFix: zeroFixMatch?.[1]?.toLowerCase() === 'true',
      mentionsEntryPoint: content.includes('verify:execution-gate'),
    };
  });
  const ledgerContent = readFile(manifest.canonicalPaths.ledger);
  const ledgerTasks = parseLedgerTasks(ledgerContent);
  const traceTaskId = `DBR-${cliPrompt}.3`;
  const traceTask = ledgerTasks.find((t) => t.id === traceTaskId) ?? ledgerTasks.find((t) => t.id === 'DBR-05R7C.3');
  let relayedIds: string[] = [];
  if (traceTask) {
    const m = traceTask.evidence.match(/spawnRelayedIds\s*:\s*\[([^\]]*)\]/i)
      ?? traceTask.evidence.match(/spawnReturnedIds\s*:\s*\[([^\]]*)\]/i);
    if (m) {
      relayedIds = m[1]
        .split(',')
        .map((s) => s.trim().replace(/^['"]|['"]$/g, '').trim())
        .filter((s) => s.length > 0);
    }
  }
  try {
    assertAdvisoryTraceStreak({ artifacts, relayedIds, policy });
    pass(`Advisory trace consistency verified (${policy.minimumConsecutiveZeroFindingPasses} consecutive trace-only passes with distinct parent-relayed IDs; trace-only, not formal authority)`);
  } catch (e: any) {
    const msg = String(e.message ?? '');
    error(msg.split(':')[0] || 'ADVISORY_TRACE_INVALID', `Advisory trace check failed (trace-only; formal review remains separate): ${msg}`);
  }
}

/**
 * Planner-control consumption inventory (05R7B.1). Reads
 * `controlEnforcement` from the prompt-matching planner contract, validates
 * its shape, then requires the gate-collected consumed set to equal the
 * declared enforceable inventory exactly. Unread, unsupported, duplicated,
 * missing, non-affecting, or metadata-authorized pointers fail with the
 * contract-configured `unconsumedErrorCode`. Descriptive metadata is
 * enumerated separately and never authorizes a result.
 */
function checkControlEnforcement(manifest: PlannerManifest, cliPrompt: string) {
  const contractRel = findPlannerContractForPrompt(manifest, cliPrompt);
  if (!contractRel) {
    pass('Control-enforcement inventory not applicable (no planner-owned contract)');
    return;
  }
  const contract = readPlannerContractJson(contractRel) as any;
  if (!contract) return;
  if (contract.prompt && String(contract.prompt) !== cliPrompt) {
    pass('Planner-owned contract targets another prompt; control-enforcement inventory not applicable');
    return;
  }
  if (!is05R7BContract(contract)) {
    pass('Control-enforcement inventory not declared by this prompt; consumption check not applicable');
    return;
  }
  let spec;
  try {
    spec = readControlEnforcement(contract);
  } catch (e: any) {
    const msg = String(e.message ?? '');
    error(msg.split(':')[0] || 'UNCONSUMED_PLANNER_CONTROL', `Control-enforcement read failed: ${msg}`);
    return;
  }
  consumeControl('/controlEnforcement/requireExactConsumedSet');
  consumeControl('/controlEnforcement/unconsumedErrorCode');
  consumeControl('/controlEnforcement/enforceableJsonPointers');
  consumeControl('/controlEnforcement/metadataJsonPointers');
  try {
    const inventory = assertConsumedControlsExact(spec.enforceable, spec.metadata, [...consumedControls], spec.unconsumedErrorCode);
    pass(`Consumed planner controls (${inventory.length}/${spec.enforceable.length}): ${inventory.join(', ')}`);
    pass(`Descriptive metadata enumerated separately (${spec.metadata.length}): ${[...spec.metadata].sort().join(', ')}`);
  } catch (e: any) {
    const msg = String(e.message ?? '');
    error(msg.split(':')[0] || 'UNCONSUMED_PLANNER_CONTROL', `Control-enforcement inventory failed: ${msg}`);
  }
}

// ─── Prompt 05R4 evidence integration (F-05R4-03) ───

interface Dbr05R4Contract {
  plan: string;
  prompt: string;
  proposalPath: string;
  proposalSha256: string;
  tocBaselinePath: string;
  tocCandidatePath: string;
  tocBaselineNumbered: number;
  tocCandidateNumbered: number;
  expectedAddedObjects: string[];
  tocIncidentInrepoPath: string;
  tocIncidentQuarantinePath: string;
  tocIncidentHeader: number;
  tocIncidentNumbered: number;
  domainCounts: number[];
  claimedTotal: number;
  receiptPrompt: string;
  reviewerAllowlistPath: string;
  highRiskScopes: string[];
  migrationStatusText: string;
  claimedUnapplied: number;
}

function resolveGatePath(p: string): string {
  if (/^[A-Z]:\\/i.test(p) || p.startsWith('/')) return p;
  return join(workspaceRoot, p);
}

function readEvidenceLines(relPath: string): string[] {
  const content = readFileSync(resolveGatePath(relPath), 'utf-8');
  return content.split('\n').map(l => l.trim()).filter(l => l.length > 0);
}

function checkPrompt05R4Evidence(manifest: PlannerManifest, cliPlan: string, cliPrompt: string) {
  const has05R4 = manifest.prompts.some(p => p.id === '05R4');
  if (cliPrompt !== '05R4' || !has05R4) {
    pass('05R4 evidence gate not applicable to this prompt');
    return;
  }

  // Authority boundary note (05R5): DBR05R4_* environment overrides apply ONLY
  // to this superseded 05R4 evidence path (closed prompt; can never reach GO
  // while its NO-GO review stands). Planner-owned artifact pins declared in
  // the manifest can never be overridden by environment or CLI — see
  // checkPlannerOwnedArtifacts, which reads paths only from the manifest.
  if (process.env.DBR05R4_CONTRACT_PATH) {
    warn('EVIDENCE_CONTRACT_OVERRIDE',
      'DBR05R4_CONTRACT_PATH override is active; it applies only to the superseded 05R4 evidence path and cannot replace planner-owned pins.');
  }
  const contractRel = process.env.DBR05R4_CONTRACT_PATH
    ?? join('docs', 'verification', 'database-recovery-05r4-evidence-contract.json');
  const contractAbs = resolveGatePath(contractRel);
  if (!existsSync(contractAbs)) {
    error('EVIDENCE_CONTRACT_MISSING', `05R4 evidence contract not found at ${contractAbs}`);
    return;
  }
  const contract = JSON.parse(readFileSync(contractAbs, 'utf-8')) as Dbr05R4Contract;

  if (contract.plan !== cliPlan || contract.prompt !== cliPrompt) {
    error('EVIDENCE_CONTRACT_SCOPE',
      `05R4 evidence contract scope plan="${contract.plan}" prompt="${contract.prompt}" does not match CLI plan="${cliPlan}" prompt="${cliPrompt}".`);
    return;
  } else {
    pass('05R4 evidence contract scope matches CLI prompt');
  }

  const actualProposalHash = sha256File(contract.proposalPath);
  if (actualProposalHash !== contract.proposalSha256.toUpperCase()) {
    error('EVIDENCE_PROPOSAL_HASH',
      `05R4 proposal hash ${actualProposalHash} does not match contract pin ${contract.proposalSha256}.`);
  } else {
    pass('05R4 proposal hash matches contract pin');
  }

  try {
    const base = readEvidenceLines(contract.tocBaselinePath);
    const cand = readEvidenceLines(contract.tocCandidatePath);
    if (base.length !== contract.tocBaselineNumbered || cand.length !== contract.tocCandidateNumbered) {
      error('EVIDENCE_TOC_COUNT',
        `05R4 TOC line counts ${base.length}/${cand.length} do not match contract ${contract.tocBaselineNumbered}/${contract.tocCandidateNumbered}.`);
    } else if (cand.length - base.length !== contract.expectedAddedObjects.length) {
      error('EVIDENCE_TOC_COUNT',
        `05R4 TOC count delta ${cand.length - base.length} does not equal proven added-object count ${contract.expectedAddedObjects.length}.`);
    } else {
      assertTocEvidence(base, cand, contract.expectedAddedObjects);
      pass(`05R4 TOC evidence matches proven delta (${base.length} to ${cand.length})`);
    }
  } catch (e: any) {
    error('EVIDENCE_TOC_DRIFT', `05R4 TOC evidence failed: ${e.message}`);
  }

  try {
    const ii = readEvidenceLines(contract.tocIncidentInrepoPath);
    const iq = readEvidenceLines(contract.tocIncidentQuarantinePath);
    if (ii.length !== contract.tocIncidentNumbered || iq.length !== contract.tocIncidentNumbered) {
      error('EVIDENCE_TOC_COUNT',
        `05R4 incident TOC line counts ${ii.length}/${iq.length} do not match contract ${contract.tocIncidentNumbered}/${contract.tocIncidentNumbered}.`);
    } else {
      const { added, removed } = diffTocObjects(ii, iq);
      if (added.length > 0 || removed.length > 0) {
        error('EVIDENCE_TOC_DRIFT',
          `05R4 incident TOCs differ at object level: added=[${added.join(', ')}] removed=[${removed.join(', ')}].`);
      } else {
        pass('05R4 incident TOC evidence identical at object level');
      }
    }
  } catch (e: any) {
    error('EVIDENCE_TOC_DRIFT', `05R4 incident TOC evidence failed: ${e.message}`);
  }

  try {
    assertDomainTotal(contract.domainCounts, contract.claimedTotal);
    pass(`05R4 domain arithmetic reconciles to ${contract.claimedTotal}`);
  } catch (e: any) {
    error('EVIDENCE_ARITHMETIC', `05R4 domain arithmetic failed: ${e.message}`);
  }

  try {
    assertGateReceiptMatchesPrompt(contract.receiptPrompt, cliPrompt);
    pass('05R4 gate receipt prompt matches');
  } catch (e: any) {
    error('EVIDENCE_STALE_RECEIPT', `05R4 gate receipt check failed: ${e.message}`);
  }

  const reviews = parseReviewArtifacts(manifest.canonicalPaths.reviewDir);
  const scoped = reviews.filter(r =>
    r.taskId.split(',').map(s => s.trim()).some(id => id.startsWith('DBR-05R4')));
  if (scoped.length === 0) {
    error('EVIDENCE_REVIEW_MISSING', 'No review artifact covers DBR-05R4 tasks.');
  } else {
    const allowlistRel = process.env.DBR05R4_ALLOWLIST_PATH ?? contract.reviewerAllowlistPath;
    if (process.env.DBR05R4_ALLOWLIST_PATH) {
      warn('EVIDENCE_CONTRACT_OVERRIDE',
        'DBR05R4_ALLOWLIST_PATH override is active; it applies only to the superseded 05R4 evidence path and cannot replace planner-owned pins.');
    }
    const allowlistAbs = resolveGatePath(allowlistRel);
    if (!existsSync(allowlistAbs)) {
      error('EVIDENCE_ALLOWLIST_MISSING', `05R4 reviewer allowlist not found at ${allowlistAbs}`);
    } else {
      const allowlist = (JSON.parse(readFileSync(allowlistAbs, 'utf-8')) as { issued: string[] }).issued ?? [];
      for (const r of scoped) {
        try {
          assertGateReviewIdentity(r.implementer, r.reviewer, allowlist);
          pass(`05R4 reviewer identity issued (${r.path})`);
        } catch (e: any) {
          error('EVIDENCE_REVIEWER_IDENTITY', `05R4 reviewer identity failed (${r.path}): ${e.message}`);
        }
      }
    }
  }

  try {
    assertSingleHighRiskScope(contract.highRiskScopes);
    pass('05R4 approval scope is exactly one HIGH-risk option');
  } catch (e: any) {
    error('EVIDENCE_AMBIGUOUS_SCOPE', `05R4 approval scope check failed: ${e.message}`);
  }

  try {
    assertMigrationStatusConsistent(contract.migrationStatusText, contract.claimedUnapplied);
    pass('05R4 migration status consistent with claimed pre-state');
  } catch (e: any) {
    error('EVIDENCE_MIGRATION_STATUS', `05R4 migration status check failed: ${e.message}`);
  }
}

// ─── Main ───

function main() {
  const args = parseArgs();
  consumedControls.clear();
  console.log(`\n=== Execution Gate Validator v3 (planner-owned manifest) ===`);
  console.log(`Plan: ${args.plan}`);
  console.log(`Prompt: ${args.prompt}\n`);

  // 0. Load planner manifest
  const manifest = loadPlannerManifest(args.manifest);

  // 1. Verify manifest hash
  const manifestRel = args.manifest ?? PLANNER_MANIFEST_REL;
  checkManifestHash(manifestRel, manifest);

  // 1b. Verify every prompt contract pinned by the manifest
  checkSourcePromptHashes(manifest);

  // 2. CLI plan must match manifest plan
  checkPlanArgument(manifest, args.plan);

  // 3. Prompt must exist in manifest
  checkPromptExists(manifest, args.prompt);

  // 4. Exact canonical paths
  checkExactPaths(manifest);

  // 5. Load and parse ledger
  const ledgerContent = readFile(manifest.canonicalPaths.ledger);
  const ledgerTasks = parseLedgerTasks(ledgerContent);

  if (ledgerTasks.length === 0) {
    error('LEDGER_EMPTY', 'No tasks found in progress ledger');
  } else {
    pass(`Parsed ${ledgerTasks.length} task(s) from ledger`);
  }

  // 6. Manifest/ledger cross-check
  checkManifestAndLedger(manifest, ledgerTasks);

  // 7. Task statuses
  checkTaskStatuses(manifest, ledgerTasks, args.prompt);

  // 8. External blocker eligibility
  checkExternalBlockerEligibility(manifest, ledgerTasks);

  // 9. Review artifacts (prompt-scoped: other prompts' verdicts neither block nor certify)
  const reviews = parseReviewArtifacts(manifest.canonicalPaths.reviewDir);
  checkReviewArtifacts(manifest, reviews, args.prompt);
  checkPromptBatchReviewCoverage(manifest, reviews, args.prompt);

  // 10. Status agreement
  checkStatusAgreement(manifest, ledgerTasks, args.prompt);

  // 10b. Planner-owned artifact pins BEFORE any prompt-specific evidence.
  checkPlannerOwnedArtifacts(manifest);

  // 10c. Formal-review issuance (fail closed until planner issues a reviewer).
  checkFormalReviewIssuance(manifest, reviews, args.prompt);

  // 10c2. Formal receipt enforcement (05R6): planner-contract-driven binding
  // of issued reviewer, current proposal, reviewed files, dump/TOC hashes,
  // and current read-only probes through the real gate. Calls the existing
  // proposal, dump, and freshness assertions (no dead code).
  checkFormalReceiptEnforcement(manifest, args.prompt);

  // 10c3. Acyclic gate-receipt lifecycle (05R7.5): pre-gate .G stays TODO;
  // a manual pre-gate DONE without a stored exit-zero receipt fails, and the
  // successor manifest must pin and verify the receipt before unlock.
  checkGateReceiptLifecycle(manifest, ledgerTasks, args.prompt, manifestRel);

  // 10c4. Production-gate scope closure (05R7A.3): mechanically discover the
  // complete in-scope file set from the planner-owned scopeClosure and compare
  // it exactly with the pinned reviewed-file inventory. Runs inside the exact
  // gate command; test-only closure is insufficient. 05R7B extends the
  // discovered set through the transitive local import graph.
  checkScopeClosure(manifest, args.prompt);

  // 10c4b. Lexical import parsing contract (05R7D.2): consume every
  // lexicalImportParsingContract field and enforce lexically safe discovery
  // through real-entry-point behavioral probes. Runs before the consumed
  // inventory so the 8 controls are included.
  checkLexicalImportParsingContract(manifest, args.prompt);

  // 10c5. Filesystem failure policy (05R7B.3): consume the planner-owned
  // fail-closed identity policy; required canonicalization, real-path,
  // link, stat, open, read, or hash failures reject the evidence.
  checkFilesystemFailurePolicy(manifest, args.prompt);

  // 10c6. Mutation boundary (05R7B.1/05R7B.5): the planner-declared
  // zero-mutation boundary must hold explicitly.
  checkMutationBoundary(manifest, args.prompt);

  // 10c7. Advisory review identity (05R7B.4): credit requires consecutive
  // genuine-ID zero-finding passes repeating spawn-returned IDs verbatim.
  // Advisory reviews remain non-authoritative.
  checkAdvisoryReviewIdentity(manifest, args.prompt);

  // 10c7b. Advisory trace consistency (05R7C.2–.3): trace-only consistency
  // from parent-relayed IDs and reviewer Markdown. Repository agreement never
  // proves system-level provenance and never satisfies formal authority.
  checkAdvisoryTraceIdentity(manifest, args.prompt);

  // 10c8. Planner-control consumption inventory (05R7B.1): the collected
  // consumed set must equal the declared enforceable inventory exactly.
  // Runs after every behavioral check so the set is complete.
  checkControlEnforcement(manifest, args.prompt);

  // 10d. Prompt 05R4 forensic evidence integration (no-op for other prompts;
  // superseded path: cannot certify 05R5, 05, cutover, or approval).
  checkPrompt05R4Evidence(manifest, args.plan, args.prompt);

  // 11. Test baseline
  checkTestBaseline(manifest);

  // 12. Production call-sites
  checkProductionCallSites(manifest);

  // 13. Predecessors
  checkPredecessors(manifest, args.prompt);

  // 14. Stop eligibility
  checkStopEligibility(manifest, ledgerTasks, args.prompt);

  // Final verdict
  const errorCount = findings.filter(f => f.severity === 'ERROR').length;
  const warningCount = findings.filter(f => f.severity === 'WARNING').length;

  console.log('\n=== RESULT ===');
  if (errorCount > 0) {
    console.log(`NO-GO — ${errorCount} error(s), ${warningCount} warning(s)`);
    for (const f of findings.filter(f => f.severity === 'ERROR')) {
      console.log(`  [${f.code}] ${f.message}`);
    }
    process.exit(1);
  } else {
    console.log(`GO — ${warningCount} warning(s), 0 errors`);
    process.exit(0);
  }
}

main();
