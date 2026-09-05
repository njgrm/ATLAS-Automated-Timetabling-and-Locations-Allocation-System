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

import { readFileSync, existsSync, readdirSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { createHash } from 'node:crypto';

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
    const zeroFixMatch = content.match(/zeroFix:\s*(true|false)/i)
      || content.match(/zero.?fix/i);

    let taskId = '';
    if (taskMatch?.[1]) {
      // Extract task IDs from YAML list or comma-separated
      const raw = taskMatch[1];
      const ids = raw.match(/(?:TL|DBR)-[\w.-]+/g) || raw.split(',').map(s => s.trim()).filter(Boolean);
      taskId = ids.join(', ');
    }

    artifacts.push({
      path: file,
      implementer: implementerMatch?.[1]?.trim() ?? '',
      reviewer: reviewerMatch?.[1]?.trim() ?? '',
      taskId,
      promptId: '',
      commitHash: commitMatch?.[1]?.trim() ?? '',
      filesInspected: filesMatch?.[1]?.split(',').map(s => s.trim()) ?? [],
      commandsRerun: commandsMatch?.[1]?.split(',').map(s => s.trim()) ?? [],
      verdict: verdictMatch?.[1]?.trim() ?? '',
      zeroFix: zeroFixMatch?.[1]?.toLowerCase() === 'true' || false,
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

function checkTaskStatuses(manifest: PlannerManifest, ledgerTasks: LedgerTask[], currentPrompt: string) {
  const allowedFinal = new Set(['DONE', 'COMPLETE']);

  // Build set of external-blocker allowlist from manifest
  const allowlist = manifest.externalBlockerAllowlist;

  for (const prompt of promptClosure(manifest, currentPrompt)) {
    for (const task of prompt.tasks) {
      const ledgerTask = ledgerTasks.find(t => t.id === task.id);
      if (!ledgerTask) continue;

      const status = ledgerTask.status.toUpperCase();
      const statusBase = status.replace(/\s.*$/, '');

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

function checkReviewArtifacts(manifest: PlannerManifest, reviews: ReviewArtifact[]) {
  if (reviews.length === 0) {
    error('NO_REVIEWS', 'No review artifacts found in review directory');
    return;
  }

  const invalidValues = new Set(manifest.reviewRequirements.invalidValues.map(v => v.toLowerCase()));

  for (const review of reviews) {
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
      error('REVIEW_VERDICT_INVALID', `Review ${review.path}: verdict must be exactly GO; received "${review.verdict || 'missing'}".`);
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
    if (!review.zeroFix && !review.verdict.toLowerCase().includes('zero fix')) {
      error('REVIEW_NO_ZERO_FIX',
        `Review ${review.path}: missing explicit zero-fix verdict.`);
    }
  }

  pass(`${reviews.length} review artifact(s) validated`);
}

function checkPromptBatchReviewCoverage(manifest: PlannerManifest, reviews: ReviewArtifact[], currentPrompt: string) {
  // For LOW/MEDIUM tasks, one prompt-batch review per completed prompt is sufficient.
  // For HIGH-risk checkpoints, an independent review is required before the boundary.
  // At minimum, there must be at least one review artifact.
  if (reviews.length === 0) {
    error('NO_PROMPT_REVIEWS', 'No prompt-batch review artifacts found. At least one per completed prompt is required.');
    return;
  }
  const requiredTaskIds = promptClosure(manifest, currentPrompt).flatMap(prompt => prompt.tasks.map(task => task.id));
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
  const allManifestTaskIds = scopedPrompts.flatMap(p => p.tasks.map(t => t.id));
  const manifestTaskIds = new Set(allManifestTaskIds);

  const ledgerManifestTasks = ledgerTasks.filter(t => manifestTaskIds.has(t.id));
  const doneCount = ledgerManifestTasks.filter(t => {
    const s = t.status.toUpperCase().replace(/\s.*$/, '');
    return s === 'DONE' || s === 'COMPLETE';
  }).length;

  const totalTasks = scopedPrompts.reduce((sum, p) => sum + p.tasks.length, 0);

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
  const manifestTaskIds = new Set(stopManifestTaskIds);

  const safeIncomplete = ledgerTasks.filter(t => {
    if (!manifestTaskIds.has(t.id)) return false;
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

// ─── Main ───

function main() {
  const args = parseArgs();
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

  // 9. Review artifacts
  const reviews = parseReviewArtifacts(manifest.canonicalPaths.reviewDir);
  checkReviewArtifacts(manifest, reviews);
  checkPromptBatchReviewCoverage(manifest, reviews, args.prompt);

  // 10. Status agreement
  checkStatusAgreement(manifest, ledgerTasks, args.prompt);

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
