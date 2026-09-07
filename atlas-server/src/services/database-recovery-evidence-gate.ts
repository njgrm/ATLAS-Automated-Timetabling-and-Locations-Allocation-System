/**
 * Database recovery evidence gate — pure deterministic checks (05R4).
 *
 * Zero I/O, zero database access. Each function throws on the exact
 * forensic/integrity mutation it guards; callers treat a throw as NO-GO
 * (nonzero). Happy-path inputs return normally.
 */

import * as ts from "typescript";

const INVALID_REVIEWER_TOKENS = [
  'simulated',
  'working tree',
  'opencode',
  'independent-reviewer',
  'self-review',
  'reviewer context',
];

const CONTEXT_ID_PATTERN = /^[a-z][a-z0-9_-]*:[A-Za-z0-9_./-]+$/;

export function diffTocObjects(baseline: string[], candidate: string[]): { added: string[]; removed: string[] } {
  const base = new Set(baseline.map((s) => s.trim()));
  const cand = new Set(candidate.map((s) => s.trim()));
  return {
    added: [...cand].filter((k) => !base.has(k)),
    removed: [...base].filter((k) => !cand.has(k)),
  };
}

/**
 * Validate dump TOC evidence against the exact proven delta.
 * Passes only when the observed added set equals the expected added set
 * and nothing was removed. Models the real 05R4 state: the quarantine
 * candidate differs from the in-repo candidate by exactly the three
 * `_prisma_migrations` objects — identical TOCs or same-count renames
 * must NOT pass here.
 */
export function assertTocEvidence(baseline: string[], candidate: string[], expectedAdded: string[]): void {
  const { added, removed } = diffTocObjects(baseline, candidate);
  const expected = new Set(expectedAdded.map((s) => s.trim()));
  const addedSet = new Set(added);
  const missing = [...expected].filter((k) => !addedSet.has(k));
  const extra = added.filter((k) => !expected.has(k));
  if (missing.length > 0) {
    throw new Error(`TOC_EXPECTED_OBJECT_MISSING: proven object(s) absent from candidate diff: [${missing.join(', ')}]`);
  }
  if (extra.length > 0 || removed.length > 0) {
    throw new Error(
      `TOC_UNEXPECTED_OBJECT: unexplained diff beyond the proven delta. extra=[${extra.join(', ')}] removed=[${removed.join(', ')}]`,
    );
  }
}

export function sumDomains(counts: number[]): number {
  return counts.reduce((a, b) => a + b, 0);
}

export function assertDomainTotal(counts: number[], claimed: number): void {
  const actual = sumDomains(counts);
  if (actual !== claimed) {
    throw new Error(`DOMAIN_ARITHMETIC_MISMATCH: components sum to ${actual} but claimed ${claimed}`);
  }
}

export function assertGateReceiptMatchesPrompt(receiptPrompt: string, requestedPrompt: string): void {
  if (receiptPrompt !== requestedPrompt) {
    throw new Error(`STALE_GATE_RECEIPT: receipt is for --prompt ${receiptPrompt}, not ${requestedPrompt}`);
  }
}

function assertContextIdShape(role: string, value: string): void {
  if (!value || !CONTEXT_ID_PATTERN.test(value.trim())) {
    throw new Error(`REVIEWER_IDENTITY_INVALID: ${role} "${value}" is not a verifiable execution-system context ID`);
  }
  if (INVALID_REVIEWER_TOKENS.some((t) => value.toLowerCase().includes(t))) {
    throw new Error(`REVIEWER_IDENTITY_INVALID: ${role} "${value}" uses a generic/simulated label`);
  }
}

/**
 * Reviewer identity is established by issuance, not syntax: the reviewer ID
 * must appear in the planner-owned allowlist of execution-system-issued
 * reviewer context IDs. A well-formed but unissued ID fails distinctly.
 */
export function assertReviewerIdentity(implementer: string, reviewer: string, reviewerAllowlist: string[]): void {
  assertContextIdShape('implementer', implementer);
  assertContextIdShape('reviewer', reviewer);
  if (implementer.trim().toLowerCase() === reviewer.trim().toLowerCase()) {
    throw new Error('REVIEWER_IDENTITY_INVALID: implementer and reviewer are identical');
  }
  if (!reviewerAllowlist.map((s) => s.trim().toLowerCase()).includes(reviewer.trim().toLowerCase())) {
    throw new Error(`REVIEWER_NOT_ISSUED: reviewer "${reviewer}" is well-formed but absent from the planner-owned issued-reviewer allowlist`);
  }
}

/**
 * Gate variant for review artifacts: the reviewer side is strictly issued
 * (shape + allowlist), while an implementer value beginning with
 * "unavailable" is accepted as explicit disclosure of a missing
 * execution-system ID rather than as a verified identity. Rationale: the
 * anti-impersonation guarantee rests on the planner-owned reviewer
 * allowlist, which an executor cannot extend; a disclosed-missing
 * implementer ID cannot fabricate reviewer issuance. Generic/simulated
 * implementer labels are still rejected.
 */
export function assertGateReviewIdentity(implementer: string, reviewer: string, reviewerAllowlist: string[]): void {
  assertContextIdShape('reviewer', reviewer);
  if (!reviewerAllowlist.map((s) => s.trim().toLowerCase()).includes(reviewer.trim().toLowerCase())) {
    throw new Error(`REVIEWER_NOT_ISSUED: reviewer "${reviewer}" is well-formed but absent from the planner-owned issued-reviewer allowlist`);
  }
  const impl = (implementer ?? '').trim();
  if (impl.toLowerCase().startsWith('unavailable')) return;
  assertContextIdShape('implementer', implementer);
  if (impl.toLowerCase() === reviewer.trim().toLowerCase()) {
    throw new Error('REVIEWER_IDENTITY_INVALID: implementer and reviewer are identical');
  }
}

export function assertSingleHighRiskScope(scopes: string[]): void {
  if (scopes.length !== 1) {
    throw new Error(`AMBIGUOUS_APPROVAL_SCOPE: one fingerprint pins ${scopes.length} HIGH-risk scopes [${scopes.join(', ')}]; exactly one required`);
  }
}

export function assertMigrationStatusConsistent(statusText: string, claimedUnapplied: number): void {
  const upToDate = /database schema is up to date/i.test(statusText);
  if (upToDate && claimedUnapplied > 0) {
    throw new Error(`MIGRATION_STATUS_CONTRADICTION: status reports up to date but ${claimedUnapplied} unapplied migrations claimed`);
  }
  if (!upToDate && claimedUnapplied === 0 && /need to apply|not yet applied/i.test(statusText)) {
    throw new Error('MIGRATION_STATUS_CONTRADICTION: status reports pending migrations but zero unapplied claimed');
  }
}

// ─── 05R5: installed-CLI proposal command contract (pure, zero I/O) ───

export const OBSOLETE_DIFF_FLAG_PATTERN = /--(?:to|from)-schema(?![\w-])/;
export const PROHIBITION_CONTEXT_PATTERN = /obsolete|forbidden|absent|removed|unsupported/i;

export const BASELINE_GENERATION_FLAGS = ['--from-empty', '--to-schema-datamodel', '--script'];
export const DATABASE_TO_DATAMODEL_FLAGS = ['--from-url', '--to-schema-datamodel', '--exit-code'];
export const MIGRATIONS_TO_DATABASE_FLAGS = ['--from-migrations', '--to-url', '--shadow-database-url', '--exit-code'];

/**
 * Obsolete `--to-schema` / `--from-schema` spellings may appear only inside an
 * explicit prohibition sentence. Any other occurrence is a command that the
 * installed Prisma CLI cannot execute.
 */
export function assertNoExecutableObsoleteDiffFlags(text: string): void {
  for (const line of text.split('\n')) {
    if (OBSOLETE_DIFF_FLAG_PATTERN.test(line) && !PROHIBITION_CONTEXT_PATTERN.test(line)) {
      throw new Error(`OBSOLETE_DIFF_FLAG: unsupported Prisma flag spelling outside prohibition context: "${line.trim().substring(0, 160)}"`);
    }
  }
}

export function assertRequiredFlagsPresent(text: string, flags: string[], operation: string): void {
  const missing = flags.filter((f) => !text.includes(f));
  if (missing.length > 0) {
    throw new Error(`MISSING_COMPARISON_SOURCE: ${operation} omits required flag(s): [${missing.join(', ')}]`);
  }
}

/**
 * A `--from-empty` command reads only the empty source plus the schema file.
 * A database URL inside the same command span is never consumed by it.
 * Spans are backtick-quoted `migrate diff` invocations, so prose flag lists
 * elsewhere on the line cannot false-positive.
 */
export function assertNoUnconsumedDatabaseUrl(text: string): void {
  const spans = text.match(/`[^`]*prisma migrate diff[^`]*`/g) ?? [];
  for (const span of spans) {
    if (span.includes('--from-empty') && (span.includes('--from-url') || span.includes('--to-url') || /DATABASE_URL\s*=/.test(span))) {
      throw new Error(`DB_URL_NEVER_CONSUMED: empty-source command supplies a database URL it never consumes: "${span.substring(0, 160)}"`);
    }
  }
}

/**
 * An empty-to-datamodel diff generates the full baseline script. Describing
 * that output as empty, or as proof about a deployed database, is false.
 */
export function assertNoEmptyDiffAsDatabaseProof(text: string): void {
  for (const line of text.split('\n')) {
    const claimsEmptyProof =
      (/emit(s|ted)? (an |the )?empty/i.test(line) || /emits nothing/i.test(line) || /empty-diff proof/i.test(line));
    if (claimsEmptyProof && /deployed|database/i.test(line)
      && !/never empty|not empty|non-empty/i.test(line)) {
      throw new Error(`EMPTY_DIFF_AS_DATABASE_PROOF: empty-to-datamodel output treated as database equality proof: "${line.trim().substring(0, 160)}"`);
    }
  }
}

export function assertExitCodeSemantics(text: string): void {
  if (!text.includes('--exit-code')) {
    throw new Error('MISSING_COMPARISON_SOURCE: proposal never uses --exit-code, so no equality check can distinguish in-sync from drift');
  }
  const hasInSyncZero = /exit `0`[^.\n]{0,60}in sync|in sync[^.\n]{0,60}exit `0`|exit 0[^.\n]{0,60}empty/i.test(text);
  const hasDriftTwo = /exit `2`[^.\n]{0,60}(drift|divergence)| (drift|divergence)[^.\n]{0,60}exit `2`|exit code[^.\n]{0,120}\b2\b[^.\n]{0,40}(non-empty|drift|divergence)/i.test(text);
  if (!hasInSyncZero) {
    throw new Error('EXIT_CODE_SEMANTICS_MISSING: proposal never documents that --exit-code 0 means empty/in-sync');
  }
  if (!hasDriftTwo) {
    throw new Error('EXIT_CODE_SEMANTICS_MISSING: proposal never documents that --exit-code 2 means non-empty/drift/divergence');
  }
}

/**
 * Full installed-CLI command contract for the clean-rebuild proposal.
 * Throws on the first violated 05R5 command rule.
 */
export function assertProposalCommandContract(proposalText: string): void {
  assertNoExecutableObsoleteDiffFlags(proposalText);
  assertRequiredFlagsPresent(proposalText, BASELINE_GENERATION_FLAGS, 'baseline generation (Operation 1)');
  assertRequiredFlagsPresent(proposalText, DATABASE_TO_DATAMODEL_FLAGS, 'database-to-datamodel equality (Operation 2)');
  assertRequiredFlagsPresent(proposalText, MIGRATIONS_TO_DATABASE_FLAGS, 'migrations-to-database equality (Operation 3)');
  assertNoUnconsumedDatabaseUrl(proposalText);
  assertNoEmptyDiffAsDatabaseProof(proposalText);
  assertExitCodeSemantics(proposalText);
}

// ─── 05R5: evidence-authority checks (pure, zero I/O) ───

const SHA256_PATTERN = /^[A-Fa-f0-9]{64}$/;

/**
 * Dump conclusions must bind BOTH the dump SHA-256 and the normalized TOC
 * SHA-256 before any object delta may be interpreted.
 */
export function assertDumpFactsBound(input: { dumpSha256?: string; normalizedTocSha256?: string }): void {
  const missing: string[] = [];
  if (!input.dumpSha256 || !SHA256_PATTERN.test(input.dumpSha256.trim())) {
    missing.push('dumpSha256');
  }
  if (!input.normalizedTocSha256 || !SHA256_PATTERN.test(input.normalizedTocSha256.trim())) {
    missing.push('normalizedTocSha256');
  }
  if (missing.length > 0) {
    throw new Error(`DUMP_BINDING_INCOMPLETE: dump conclusions require both dump and normalized-TOC hashes; missing or malformed: [${missing.join(', ')}]`);
  }
}

/**
 * Proposal integrity binds to a formal review receipt issued after review.
 * A proposal hash that differs from the receipt pin, or a non-GO receipt,
 * cannot establish integrity — even when executor files are self-consistent.
 */
export function assertProposalMatchesReviewReceipt(
  proposalSha256: string,
  receipt: { proposalSha256: string; verdict: string; zeroFix: boolean },
): void {
  if (receipt.verdict.trim().toUpperCase() !== 'GO' || !receipt.zeroFix) {
    throw new Error(`REVIEW_NOT_GO: formal review receipt is not GO zero-fix (verdict="${receipt.verdict}", zeroFix=${receipt.zeroFix})`);
  }
  if (proposalSha256.trim().toUpperCase() !== receipt.proposalSha256.trim().toUpperCase()) {
    throw new Error('PROPOSAL_CHANGED_AFTER_REVIEW: proposal hash differs from the formal review receipt pin');
  }
}

const READONLY_PROBE_KINDS = new Set(['bounded-read-only', 'cli-help', 'status-read-only', 'diff-read-only']);

/**
 * Stored database counts are never runtime proof. Only a bounded read-only
 * probe executed in the current run (fresh timestamp, read-only kind) counts.
 * Timestamps later than the current time beyond the allowed future skew fail
 * as future-dated (05R7.4): a far-future probe must never pass freshness.
 */
export function assertProbeFreshness(probe: { executedAt?: string; kind?: string; nowMs: number; maxAgeMs: number; maxFutureSkewMs?: number }): void {
  if (!probe.executedAt) {
    throw new Error('STALE_DATABASE_FACTS: no current-run probe timestamp; stored counts cannot establish database truth');
  }
  const at = Date.parse(probe.executedAt);
  if (Number.isNaN(at)) {
    throw new Error(`STALE_DATABASE_FACTS: probe timestamp "${probe.executedAt}" is not parseable`);
  }
  if (probe.nowMs - at > probe.maxAgeMs) {
    throw new Error('STALE_DATABASE_FACTS: probe timestamp is older than the current-run freshness window; stored counts cannot pass');
  }
  const skewMs = probe.maxFutureSkewMs ?? 120_000;
  if (at - probe.nowMs > skewMs) {
    throw new Error('PROBE_TIMESTAMP_FUTURE: probe timestamp is later than the current time beyond the allowed future skew');
  }
  if (!probe.kind || !READONLY_PROBE_KINDS.has(probe.kind)) {
    throw new Error(`NON_READONLY_PROBE: probe kind "${probe.kind ?? 'missing'}" is not a bounded read-only probe`);
  }
}

/**
 * Formal-review authority. Before the planner/orchestration owner issues a
 * reviewer identity outside the executor task tree, every reviewer fails
 * closed — a coordinated executor evidence file plus sidecar, and any
 * executor-spawned advisory reviewer, can never satisfy this check.
 */
export function assertFormalReviewSatisfiesIssuance(
  reviewerContextId: string,
  issuedReviewerContextIds: string[],
  formalReviewState: string,
): void {
  if (formalReviewState !== 'ISSUED' || issuedReviewerContextIds.length === 0) {
    throw new Error('FORMAL_REVIEW_NOT_ISSUED: planner has not issued a formal reviewer identity; executor-spawned reviewers are advisory only');
  }
  const issued = new Set(issuedReviewerContextIds.map((s) => s.trim().toLowerCase()));
  if (!issued.has(reviewerContextId.trim().toLowerCase())) {
    throw new Error(`REVIEWER_NOT_ISSUED: reviewer "${reviewerContextId}" was not issued by the planner/orchestration owner`);
  }
}

// ─── 05R6: planner-contract-driven formal receipt helpers (pure, zero I/O) ───

/**
 * A reviewed-implementation path must stay inside the workspace. Absolute
 * Windows/posix paths and any `..` segment escape and must fail closed.
 */
export function assertReviewedPathInsideWorkspace(pathValue: string): void {
  const normalized = (pathValue ?? '').replace(/\\/g, '/');
  const segments = normalized.split('/');
  if (/^[A-Za-z]:\//.test(normalized) || normalized.startsWith('/') || segments.includes('..')) {
    throw new Error(`REVIEWED_PATH_ESCAPE: reviewed path escapes the workspace: "${pathValue}"`);
  }
  if (!normalized || normalized.trim().length === 0) {
    throw new Error('REVIEWED_PATH_MISSING: reviewed path is missing or blank');
  }
}

/**
 * Contract-declared reviewed paths and receipt-declared reviewed files must
 * match exactly once each. Missing, additional, or duplicated entries fail
 * closed. Escaping entries fail with REVIEWED_PATH_ESCAPE.
 */
export function assertReviewedPathLists(
  contractPaths: string[],
  receiptPaths: string[],
): void {
  const normalize = (p: string) => p.replace(/\\/g, '/').trim();
  for (const p of [...contractPaths, ...receiptPaths]) {
    assertReviewedPathInsideWorkspace(p);
  }
  const contractNorm = contractPaths.map(normalize);
  const receiptNorm = receiptPaths.map(normalize);
  const contractSet = new Set(contractNorm);
  if (contractSet.size !== contractNorm.length) {
    throw new Error('REVIEWED_PATH_DUPLICATE: planner contract declares a reviewed path twice');
  }
  const receiptSet = new Set(receiptNorm);
  if (receiptSet.size !== receiptNorm.length) {
    throw new Error('REVIEWED_PATH_DUPLICATE: formal receipt declares a reviewed path twice');
  }
  const missing = contractNorm.filter((p) => !receiptSet.has(p));
  if (missing.length > 0) {
    throw new Error(`REVIEWED_PATH_MISSING: formal receipt omits contract-required path(s): [${missing.join(', ')}]`);
  }
  const additional = receiptNorm.filter((p) => !contractSet.has(p));
  if (additional.length > 0) {
    throw new Error(`REVIEWED_PATH_ADDITIONAL: formal receipt adds undeclared path(s): [${additional.join(', ')}]`);
  }
}

const PROBE_SECRET_PATTERNS = [
  /postgresql:\/\//i,
  /postgres:\/\//i,
  /password\s*[:=]/i,
  /passwd\s*[:=]/i,
  /secret/i,
  /private\s+key/i,
  /bearer\s+[A-Za-z0-9\-._~+/=]{8,}/i,
];

/**
 * Raw probe output must never carry secrets. Any database URL, password
 * assignment, secret token, or private key fails closed.
 */
export function assertNoSecretsInProbeOutput(text: string): void {
  for (const pattern of PROBE_SECRET_PATTERNS) {
    if (pattern.test(text)) {
      throw new Error(`PROBE_SECRET_LEAK: probe raw output bears secret material matching ${String(pattern)}`);
    }
  }
}

/**
 * Every current probe must carry a non-empty target classification so the
 * gate can prove which database/environment the fresh facts describe.
 */
export function assertProbeTargetClassified(target: unknown): void {
  if (typeof target !== 'string' || target.trim().length === 0) {
    throw new Error('PROBE_TARGET_MISSING: current probe target classification is missing or blank');
  }
}

/**
 * Formal receipt shape guard. Every planner-required field must be present.
 * Missing fields fail closed before any hash comparison.
 */
export function assertReceiptHasRequiredFields(
  receipt: Record<string, unknown>,
  requiredFields: string[],
): void {
  const missing = requiredFields.filter((f) => receipt[f] === undefined);
  if (missing.length > 0) {
    throw new Error(`FORMAL_RECEIPT_MALFORMED: formal receipt omits required field(s): [${missing.join(', ')}]`);
  }
}

// ─── 05R7: transitive formal-receipt authority (pure, zero I/O) ───

function assertWellFormedSha256(role: string, value: unknown): string {
  if (typeof value !== 'string' || !SHA256_PATTERN.test(value.trim())) {
    throw new Error(`FORMAL_RECEIPT_PIN_MISSING: ${role} is absent or malformed; a planner-owned SHA-256 pin is required`);
  }
  return value.trim().toUpperCase();
}

/**
 * Node-side dual-pin check over an already-computed SHA-256 hex digest.
 * Pure string comparison; the caller (real gate) recomputes the digest from
 * current file bytes with node:crypto before invoking.
 */
export function assertReceiptHexMatchesPins(
  actualHex: unknown,
  contractSha256: unknown,
  manifestSha256: unknown,
): string {
  const contractPin = assertWellFormedSha256('contract receipt pin', contractSha256);
  const manifestPin = assertWellFormedSha256('manifest receipt pin', manifestSha256);
  if (contractPin !== manifestPin) {
    throw new Error('FORMAL_RECEIPT_PIN_MISMATCH: planner contract receipt pin differs from manifest receipt pin');
  }
  if (typeof actualHex !== 'string' || !SHA256_PATTERN.test(actualHex.trim())) {
    throw new Error('FORMAL_RECEIPT_PIN_MISSING: current receipt digest is absent or malformed');
  }
  const actual = actualHex.trim().toUpperCase();
  if (actual !== contractPin) {
    throw new Error('FORMAL_RECEIPT_CHANGED: current formal receipt bytes differ from the planner-pinned SHA-256');
  }
  return actual;
}

/**
 * Proposal reviewed-file entry consistency (05R7.2). The proposal entry inside
 * `reviewedFiles` must carry exactly the receipt's `proposalSha256` pin.
 * A wrong SHA on the proposal entry fails even when the entry path matches.
 */
export function assertProposalReviewedFileConsistent(
  reviewedFiles: Array<{ path?: unknown; sha256?: unknown }>,
  proposalRel: string,
  proposalSha256: string,
): void {
  const norm = (p: unknown) => String(p ?? '').replace(/\\/g, '/').trim();
  const expected = String(proposalSha256 ?? '').trim().toUpperCase();
  if (!SHA256_PATTERN.test(expected)) {
    throw new Error('FORMAL_RECEIPT_MALFORMED: receipt proposalSha256 is absent or malformed');
  }
  const entry = reviewedFiles.find((f) => norm(f.path) === norm(proposalRel));
  if (!entry) {
    throw new Error(`REVIEWED_PATH_MISSING: formal receipt omits the proposal reviewed-file entry: "${proposalRel}"`);
  }
  const entrySha = String(entry.sha256 ?? '').trim().toUpperCase();
  if (!SHA256_PATTERN.test(entrySha)) {
    throw new Error(`PROPOSAL_ENTRY_MISMATCH: proposal reviewed-file entry carries a malformed SHA-256: "${proposalRel}"`);
  }
  if (entrySha !== expected) {
    throw new Error(`PROPOSAL_ENTRY_MISMATCH: proposal reviewed-file entry SHA differs from the receipt proposalSha256 pin: "${proposalRel}"`);
  }
}

// ─── 05R7: exact dump / normalized-TOC inventory (pure, zero I/O) ───

export interface RequiredDumpEntry {
  id?: unknown;
  dumpPath?: unknown;
  dumpSha256?: unknown;
  tocPath?: unknown;
  normalizedTocSha256?: unknown;
  pathClass?: unknown;
}

export interface ReceivedDumpEntry {
  id?: unknown;
  name?: unknown;
  dumpPath?: unknown;
  dumpSha256?: unknown;
  tocPath?: unknown;
  normalizedTocSha256?: unknown;
  pathClass?: unknown;
}

/**
 * Exact required-dump inventory match (05R7.3). The receipt inventory must
 * equal the planner-declared `requiredDumpEvidence` by ID, path, path class,
 * dump SHA-256, TOC path, and normalized-TOC SHA-256. Missing, additional,
 * duplicate, substituted, pathless, or hash-divergent entries fail closed.
 */
export function assertDumpInventoryMatchesContract(
  required: RequiredDumpEntry[],
  received: ReceivedDumpEntry[],
): void {
  if (!Array.isArray(required) || required.length === 0) {
    throw new Error('DUMP_INVENTORY_MISMATCH: planner contract declares no requiredDumpEvidence inventory');
  }
  const idOf = (e: { id?: unknown; name?: unknown }) => String((e.id ?? e.name ?? '')).trim();
  const requiredIds = required.map(idOf);
  const receivedIds = (Array.isArray(received) ? received : []).map(idOf);
  if (requiredIds.some((id) => id.length === 0)) {
    throw new Error('DUMP_INVENTORY_MISMATCH: planner contract requiredDumpEvidence contains a blank ID');
  }
  if (new Set(requiredIds).size !== requiredIds.length) {
    throw new Error('DUMP_INVENTORY_MISMATCH: planner contract requiredDumpEvidence declares a duplicate ID');
  }
  if (receivedIds.some((id) => id.length === 0)) {
    throw new Error('DUMP_INVENTORY_MISMATCH: formal receipt dumpEvidence contains a blank ID');
  }
  if (new Set(receivedIds).size !== receivedIds.length) {
    throw new Error('DUMP_INVENTORY_MISMATCH: formal receipt dumpEvidence declares a duplicate ID');
  }
  const receivedSet = new Set(receivedIds);
  const missing = requiredIds.filter((id) => !receivedSet.has(id));
  if (missing.length > 0) {
    throw new Error(`DUMP_INVENTORY_MISMATCH: formal receipt omits required dump ID(s): [${missing.join(', ')}]`);
  }
  const requiredSet = new Set(requiredIds);
  const additional = receivedIds.filter((id) => !requiredSet.has(id));
  if (additional.length > 0) {
    throw new Error(`DUMP_INVENTORY_MISMATCH: formal receipt adds undeclared dump ID(s): [${additional.join(', ')}]`);
  }
  const byId = new Map<string, ReceivedDumpEntry>();
  for (const entry of received ?? []) byId.set(idOf(entry), entry);
  for (const req of required) {
    const id = idOf(req);
    const got = byId.get(id) as ReceivedDumpEntry;
    const reqDumpPath = String(req.dumpPath ?? '').trim();
    const reqTocPath = String(req.tocPath ?? '').trim();
    if (!reqDumpPath || !reqTocPath) {
      throw new Error(`DUMP_BINDING_INCOMPLETE: planner contract dump "${id}" omits a mandatory dump or TOC path`);
    }
    const gotDumpPath = String(got.dumpPath ?? '').trim();
    const gotTocPath = String(got.tocPath ?? '').trim();
    if (!gotDumpPath || !gotTocPath) {
      throw new Error(`DUMP_BINDING_INCOMPLETE: receipt dump "${id}" omits a mandatory dump or TOC path; hash-only evidence is forbidden`);
    }
    if (gotDumpPath !== reqDumpPath || gotTocPath !== reqTocPath) {
      throw new Error(`DUMP_PATH_SUBSTITUTION: receipt dump "${id}" paths differ from the planner-declared inventory`);
    }
    const reqClass = String(req.pathClass ?? '').trim();
    const gotClass = String(got.pathClass ?? '').trim();
    if (reqClass && gotClass !== reqClass) {
      throw new Error(`DUMP_PATH_CLASS_VIOLATION: receipt dump "${id}" path class "${gotClass}" differs from planner-declared "${reqClass}"`);
    }
    if (reqClass === 'workspace') {
      try {
        assertReviewedPathInsideWorkspace(gotDumpPath);
        assertReviewedPathInsideWorkspace(gotTocPath);
      } catch (e: any) {
        throw new Error(`DUMP_PATH_CLASS_VIOLATION: receipt dump "${id}" workspace path escapes the workspace: ${(e as Error).message}`);
      }
    }
    if (String(got.dumpSha256 ?? '').trim().toUpperCase() !== String(req.dumpSha256 ?? '').trim().toUpperCase()) {
      throw new Error(`DUMP_HASH_CHANGED: receipt dump "${id}" dump SHA-256 differs from the planner-declared inventory pin`);
    }
    if (String(got.normalizedTocSha256 ?? '').trim().toUpperCase() !== String(req.normalizedTocSha256 ?? '').trim().toUpperCase()) {
      throw new Error(`TOC_HASH_CHANGED: receipt dump "${id}" normalized-TOC SHA-256 differs from the planner-declared inventory pin`);
    }
    assertDumpFactsBound({ dumpSha256: String(got.dumpSha256 ?? ''), normalizedTocSha256: String(got.normalizedTocSha256 ?? '') });
  }
}

// ─── 05R7A: strict, non-coercing probe evidence types (pure, zero I/O) ───

/**
 * Strict finite-integer exit-code equality (05R7A.1). Both the planner-required
 * and the receipt-observed values are accepted only when
 * `typeof value === "number"`, `Number.isFinite(value)`, and
 * `Number.isInteger(value)`. Shape is validated before semantic comparison so
 * coercible values can never compare equal to a required zero.
 *
 * Malformed values (absent, undefined, null, blank/numeric strings, booleans,
 * objects, arrays, NaN, infinities, fractional numbers) fail with
 * PROBE_EXIT_MALFORMED. Well-formed integers that differ fail with
 * PROBE_EXIT_MISMATCH.
 */
export function assertStrictExitCodeEqual(
  observed: unknown,
  required: unknown,
  probeId: string,
): void {
  const describe = (v: unknown) => {
    if (v === undefined) return 'missing';
    if (typeof v === 'string' && v.trim().length === 0) return 'blank-string';
    return String(v as string);
  };
  if (typeof required !== 'number' || !Number.isFinite(required) || !Number.isInteger(required)) {
    throw new Error(
      `PROBE_EXIT_MALFORMED: planner-required exit code for probe "${probeId}" is not a finite integer number (got ${describe(required)})`,
    );
  }
  if (typeof observed !== 'number' || !Number.isFinite(observed) || !Number.isInteger(observed)) {
    throw new Error(
      `PROBE_EXIT_MALFORMED: receipt probe "${probeId}" exit code ${describe(observed)} is not a finite integer number; coercion is forbidden (reject absent, null, blank/numeric strings, booleans, NaN, infinities, fractional values)`,
    );
  }
  if ((observed as number) !== (required as number)) {
    throw new Error(
      `PROBE_EXIT_MISMATCH: receipt probe "${probeId}" exit code ${String(observed)} differs from planner-required ${String(required)}`,
    );
  }
}

/**
 * Strict finite-integer gate-receipt exit-code check (05R7A.1). The stored
 * gate receipt exit code is accepted only when it is a finite integer number.
 * Malformed values fail with GATE_RECEIPT_EXIT_MALFORMED; well-formed nonzero
 * values fail with GATE_RECEIPT_NONZERO_EXIT.
 */
export function assertStrictGateExitCodeZero(exitCode: unknown): void {
  if (typeof exitCode !== 'number' || !Number.isFinite(exitCode) || !Number.isInteger(exitCode)) {
    const label = exitCode === undefined ? 'missing' : String(exitCode as string);
    throw new Error(
      `GATE_RECEIPT_EXIT_MALFORMED: gate receipt exit code ${label} is not a finite integer number; coercion is forbidden`,
    );
  }
  if ((exitCode as number) !== 0) {
    throw new Error(`GATE_RECEIPT_NONZERO_EXIT: gate receipt exit code ${String(exitCode)} is not 0`);
  }
}

// ─── 05R7A: canonical workspace containment for probe output (pure, zero I/O) ───

/**
 * Canonical workspace containment for probe raw-output evidence (05R7A.2).
 *
 * Rejects all absolute drive-qualified, UNC, POSIX-absolute, device,
 * traversal, alternate/mixed-separator, and resolved symlink escape paths.
 * Containment is based on the canonical relative relationship between the
 * resolved workspace and the resolved candidate, not on string-prefix matching
 * or on the absence of a literal `..` segment.
 *
 * Pure string-level checks run first (no filesystem access): drive-absolute,
 * UNC, POSIX-absolute, device, backslash separators, and `..` segments all
 * fail with PROBE_PATH_ESCAPE. Callers then resolve the candidate against the
 * workspace and, when the file exists, compare real paths to detect symlink
 * escapes (PROBE_PATH_SYMLINK_ESCAPE).
 */
export function assertProbeRawOutputPathShape(rawPath: unknown): void {
  if (typeof rawPath !== 'string' || rawPath.trim().length === 0) {
    throw new Error('PROBE_OUTPUT_MISSING: probe rawOutputPath is missing or blank');
  }
  const original = rawPath;
  const withForward = original.replace(/\\/g, '/');
  // Device paths first (\\.\, \\?\, //./, //?/ after normalization) — these
  // also start with `//` so they must precede the generic UNC check.
  if (/^\/\/[.?]\//.test(withForward)) {
    throw new Error(`PROBE_PATH_DEVICE: probe rawOutputPath is a device path: "${original}"`);
  }
  // Drive-qualified absolute on the original form (covers both C:\ and C:/
  // spellings before any separator rejection).
  if (/^[A-Za-z]:[\\/]/.test(original)) {
    throw new Error(`PROBE_PATH_ABSOLUTE: probe rawOutputPath is drive-absolute: "${original}"`);
  }
  // UNC on the original form (\\server\share) or forward form (//server/share).
  if (/^\\\\/.test(original) || withForward.startsWith('//')) {
    throw new Error(`PROBE_PATH_UNC: probe rawOutputPath is a UNC path: "${original}"`);
  }
  // POSIX absolute (/tmp/..., /etc/...).
  if (withForward.startsWith('/')) {
    throw new Error(`PROBE_PATH_ABSOLUTE: probe rawOutputPath is POSIX-absolute: "${original}"`);
  }
  // Alternate/mixed separators: canonical workspace-relative probe outputs use
  // forward slashes only. Any remaining backslash is an alternate-separator
  // escape (drive/UNC/device forms already returned above with specific codes).
  if (/\\/.test(original)) {
    throw new Error(`PROBE_PATH_ESCAPE: probe rawOutputPath uses alternate/mixed separators: "${original}"`);
  }
  // Drive-qualified absolute forward form (C:/, D:/) — retained for completeness
  // when the original used forward slashes.
  if (/^[A-Za-z]:(\/|$)/.test(withForward)) {
    throw new Error(`PROBE_PATH_ABSOLUTE: probe rawOutputPath is drive-absolute: "${original}"`);
  }
  // Traversal segments on the canonical forward-slash form.
  if (withForward.split('/').includes('..')) {
    throw new Error(`PROBE_PATH_TRAVERSAL: probe rawOutputPath traverses outside the workspace: "${original}"`);
  }
  // Empty segments from leading/trailing/double slashes are not canonical
  // workspace-relative forms.
  if (withForward.includes('//') || withForward.startsWith('./') || withForward === '.' || withForward.startsWith('../')) {
    throw new Error(`PROBE_PATH_ESCAPE: probe rawOutputPath is not a canonical workspace-relative path: "${original}"`);
  }
}

// ─── 05R7A: production-gate scope closure (pure, zero I/O) ───

export interface ScopeClosureSpec {
  exactPaths?: unknown;
  directoryRules?: Array<{ directory?: unknown; fileNamePattern?: unknown }>;
  requireExactSetEquality?: unknown;
}

/**
 * Mechanical changed-file scope closure (05R7A.3, pure set comparison).
 * The mechanically discovered in-scope set must equal the planner-pinned
 * reviewed set exactly. Missing, additional, duplicate, renamed (missing plus
 * additional), dangling (pinned but absent on disk), escaping, or unreviewed
 * paths fail with SCOPE_CLOSURE_* codes. Test-only closure is insufficient;
 * the production validator must execute this during the exact gate command.
 */
export function assertScopeClosureMatches(
  discovered: string[],
  pinned: string[],
  existingOnDisk: Set<string>,
): void {
  const norm = (p: unknown) => String(p ?? '').replace(/\\/g, '/').trim();
  const discoveredNorm = discovered.map(norm);
  const pinnedNorm = pinned.map(norm);
  // Escaping entries fail first.
  for (const p of [...discoveredNorm, ...pinnedNorm]) {
    if (!p) {
      throw new Error('SCOPE_CLOSURE_MISSING: scope closure path is missing or blank');
    }
    if (/^[A-Za-z]:\//.test(p) || p.startsWith('/') || p.split('/').includes('..')) {
      throw new Error(`SCOPE_CLOSURE_ESCAPE: scope closure path escapes the workspace: "${p}"`);
    }
  }
  if (new Set(discoveredNorm).size !== discoveredNorm.length) {
    throw new Error('SCOPE_CLOSURE_DUPLICATE: mechanically discovered in-scope set contains a duplicate path');
  }
  if (new Set(pinnedNorm).size !== pinnedNorm.length) {
    throw new Error('SCOPE_CLOSURE_DUPLICATE: planner-pinned reviewed set contains a duplicate path');
  }
  const discoveredSet = new Set(discoveredNorm);
  const pinnedSet = new Set(pinnedNorm);
  const missing = discoveredNorm.filter((p) => !pinnedSet.has(p));
  if (missing.length > 0) {
    throw new Error(`SCOPE_CLOSURE_MISSING: in-scope file(s) omitted from the pinned reviewed set: [${missing.join(', ')}]; planner action required`);
  }
  const additional = pinnedNorm.filter((p) => !discoveredSet.has(p));
  if (additional.length > 0) {
    // Distinguish dangling pins (absent on disk) from renamed/unreviewed.
    const dangling = additional.filter((p) => !existingOnDisk.has(p));
    if (dangling.length > 0) {
      throw new Error(`SCOPE_CLOSURE_DANGLING: planner-pinned path(s) absent on disk: [${dangling.join(', ')}]`);
    }
    throw new Error(`SCOPE_CLOSURE_ADDITIONAL: pinned set contains path(s) outside the mechanically discovered scope: [${additional.join(', ')}]`);
  }
}

// ─── 05R7: exact probe inventory with time safety (pure, zero I/O) ───

export interface RequiredProbeEntry {
  id?: unknown;
  kind?: unknown;
  target?: unknown;
  commandIdentity?: unknown;
  requiredExitCode?: unknown;
}

export interface ReceivedProbeEntry {
  id?: unknown;
  kind?: unknown;
  target?: unknown;
  commandIdentity?: unknown;
  exitCode?: unknown;
  executedAt?: unknown;
  rawOutputPath?: unknown;
  rawOutputSha256?: unknown;
}

/**
 * Exact required-probe inventory match (05R7.4). The receipt probes must equal
 * the planner-declared `requiredProbes` by ID, kind, target, command identity,
 * and exit code. Missing, additional, duplicate, substituted, failed, or
 * wrong-target/command entries fail closed.
 */
export function assertProbeInventoryMatchesContract(
  required: RequiredProbeEntry[],
  received: ReceivedProbeEntry[],
): void {
  if (!Array.isArray(required) || required.length === 0) {
    throw new Error('PROBE_INVENTORY_MISMATCH: planner contract declares no requiredProbes inventory');
  }
  const idOf = (e: { id?: unknown }) => String(e.id ?? '').trim();
  const requiredIds = required.map(idOf);
  const receivedList = Array.isArray(received) ? received : [];
  const receivedIds = receivedList.map(idOf);
  if (requiredIds.some((id) => id.length === 0)) {
    throw new Error('PROBE_INVENTORY_MISMATCH: planner contract requiredProbes contains a blank ID');
  }
  if (new Set(requiredIds).size !== requiredIds.length) {
    throw new Error('PROBE_INVENTORY_MISMATCH: planner contract requiredProbes declares a duplicate ID');
  }
  if (receivedIds.some((id) => id.length === 0)) {
    throw new Error('PROBE_INVENTORY_MISMATCH: formal receipt probe omits its contract-listed ID');
  }
  if (new Set(receivedIds).size !== receivedIds.length) {
    throw new Error('PROBE_INVENTORY_MISMATCH: formal receipt declares a duplicate probe ID');
  }
  const receivedSet = new Set(receivedIds);
  const missing = requiredIds.filter((id) => !receivedSet.has(id));
  if (missing.length > 0) {
    throw new Error(`PROBE_INVENTORY_MISMATCH: formal receipt omits required probe ID(s): [${missing.join(', ')}]`);
  }
  const requiredSet = new Set(requiredIds);
  const additional = receivedIds.filter((id) => !requiredSet.has(id));
  if (additional.length > 0) {
    throw new Error(`PROBE_INVENTORY_MISMATCH: formal receipt adds undeclared probe ID(s): [${additional.join(', ')}]`);
  }
  const byId = new Map<string, ReceivedProbeEntry>();
  for (const entry of receivedList) byId.set(idOf(entry), entry);
  for (const req of required) {
    const id = idOf(req);
    const got = byId.get(id) as ReceivedProbeEntry;
    if (String(got.kind ?? '') !== String(req.kind ?? '')) {
      throw new Error(`PROBE_SPEC_MISMATCH: receipt probe "${id}" kind "${String(got.kind ?? 'missing')}" differs from planner-declared "${String(req.kind ?? '')}"`);
    }
    if (String(got.target ?? '').trim() !== String(req.target ?? '').trim() || String(got.target ?? '').trim().length === 0) {
      throw new Error(`PROBE_TARGET_MISMATCH: receipt probe "${id}" target differs from the planner-declared target`);
    }
    if (String(got.commandIdentity ?? '').trim() !== String(req.commandIdentity ?? '').trim() || String(got.commandIdentity ?? '').trim().length === 0) {
      throw new Error(`PROBE_COMMAND_MISMATCH: receipt probe "${id}" command identity differs from the planner-declared command`);
    }
    assertStrictExitCodeEqual(got.exitCode, req.requiredExitCode, id);
  }
}

/**
 * Probe timestamp window with future-skew rejection (05R7.4). Extends the 05R5
 * freshness rule: timestamps older than the maximum age fail as stale, and
 * timestamps later than the current time beyond the allowed future skew fail
 * as future-dated. Stored prose or counts without a current probe are not
 * proof (callers require a contract-listed probe entry first).
 */
export function assertProbeTimestampInWindow(
  executedAt: unknown,
  nowMs: number,
  maxAgeMs: number,
  maxFutureSkewMs: number,
): void {
  if (typeof executedAt !== 'string' || executedAt.trim().length === 0) {
    throw new Error('STALE_DATABASE_FACTS: no current-run probe timestamp; stored counts cannot establish database truth');
  }
  const at = Date.parse(executedAt);
  if (Number.isNaN(at)) {
    throw new Error(`STALE_DATABASE_FACTS: probe timestamp "${String(executedAt)}" is not parseable`);
  }
  if (nowMs - at > maxAgeMs) {
    throw new Error('STALE_DATABASE_FACTS: probe timestamp is older than the current-run freshness window; stored counts cannot pass');
  }
  if (at - nowMs > maxFutureSkewMs) {
    throw new Error('PROBE_TIMESTAMP_FUTURE: probe timestamp is later than the current time beyond the allowed future skew');
  }
}

// ─── 05R7: acyclic gate-receipt lifecycle (pure, zero I/O) ───

export interface GateReceiptBinding {
  plan?: unknown;
  prompt?: unknown;
  manifestSha256?: unknown;
  formalReviewReceiptSha256?: unknown;
  executedAt?: unknown;
  exitCode?: unknown;
  reviewedImplementationIdentity?: unknown;
}

/**
 * Post-gate receipt binding (05R7.5). A stored gate receipt must bind the
 * exact plan and prompt, the exit code 0, a fresh execution timestamp, and a
 * non-blank reviewed-implementation identity. The pre-gate manifest SHA-256
 * and formal-receipt SHA-256 comparisons are performed by the gate against
 * recomputed current bytes (branching on successor mode); this pure check
 * covers every other binding field.
 */
export function assertGateReceiptBindsPreGateAuthority(
  receipt: Record<string, unknown>,
  expected: { plan: string; prompt: string; nowMs: number; maxAgeMs: number; maxFutureSkewMs: number },
): void {
  const required = ['plan', 'prompt', 'manifestSha256', 'formalReviewReceiptSha256', 'executedAt', 'exitCode', 'reviewedImplementationIdentity'];
  const missing = required.filter((f) => (receipt as Record<string, unknown>)[f] === undefined);
  if (missing.length > 0) {
    throw new Error(`GATE_RECEIPT_MALFORMED: gate receipt omits required field(s): [${missing.join(', ')}]`);
  }
  if (String(receipt['plan'] ?? '') !== expected.plan) {
    throw new Error(`GATE_RECEIPT_PLAN_MISMATCH: gate receipt plan "${String(receipt['plan'] ?? '')}" does not match "${expected.plan}"`);
  }
  if (String(receipt['prompt'] ?? '') !== expected.prompt) {
    throw new Error(`GATE_RECEIPT_PROMPT_MISMATCH: gate receipt prompt "${String(receipt['prompt'] ?? '')}" does not match "${expected.prompt}"`);
  }
  assertStrictGateExitCodeZero(receipt['exitCode']);
  if (typeof receipt['manifestSha256'] !== 'string' || !SHA256_PATTERN.test(String(receipt['manifestSha256']).trim())) {
    throw new Error('GATE_RECEIPT_MANIFEST_MISMATCH: gate receipt manifest SHA-256 is absent or malformed');
  }
  if (typeof receipt['formalReviewReceiptSha256'] !== 'string' || !SHA256_PATTERN.test(String(receipt['formalReviewReceiptSha256']).trim())) {
    throw new Error('GATE_RECEIPT_FORMAL_RECEIPT_MISMATCH: gate receipt formal-receipt SHA-256 is absent or malformed');
  }
  if (typeof receipt['reviewedImplementationIdentity'] !== 'string' || String(receipt['reviewedImplementationIdentity']).trim().length === 0) {
    throw new Error('GATE_RECEIPT_MALFORMED: gate receipt reviewed-implementation identity is blank');
  }
  const executedAt = receipt['executedAt'];
  if (typeof executedAt !== 'string' || executedAt.trim().length === 0) {
    throw new Error('GATE_RECEIPT_STALE: gate receipt has no execution timestamp');
  }
  const at = Date.parse(executedAt);
  if (Number.isNaN(at)) {
    throw new Error(`GATE_RECEIPT_STALE: gate receipt timestamp "${executedAt}" is not parseable`);
  }
  if (expected.nowMs - at > expected.maxAgeMs) {
    throw new Error('GATE_RECEIPT_STALE: gate receipt execution timestamp is older than the acceptance window');
  }
  if (at - expected.nowMs > expected.maxFutureSkewMs) {
    throw new Error('GATE_RECEIPT_FUTURE: gate receipt execution timestamp is later than the current time beyond the allowed skew');
  }
}

/**
 * Successor-manifest pin verification (05R7.5). The successor planner manifest
 * must pin the exact gate-receipt path and SHA-256 before 05R7 counts as
 * complete or unlocked. A missing or divergent pin fails closed. The gate
 * receipt must never be pinned by the manifest it attests (hash cycle).
 */
export function assertSuccessorManifestPinsGateReceipt(
  successorManifest: { plan?: unknown; plannerOwnedArtifacts?: Array<{ path?: unknown; sha256?: unknown }> },
  expectedPlan: string,
  gateReceiptPath: string,
  gateReceiptSha256: string,
): void {
  if (String(successorManifest.plan ?? '') !== expectedPlan) {
    throw new Error(`SUCCESSOR_PLAN_MISMATCH: successor manifest plan "${String(successorManifest.plan ?? '')}" does not match "${expectedPlan}"`);
  }
  const norm = (p: unknown) => String(p ?? '').replace(/\\/g, '/').trim();
  const entries = (successorManifest.plannerOwnedArtifacts ?? []).filter((a) => norm(a.path) === norm(gateReceiptPath));
  if (entries.length === 0) {
    throw new Error(`SUCCESSOR_PIN_MISSING: successor manifest does not pin the gate receipt path "${gateReceiptPath}"`);
  }
  const pinned = String(entries[0].sha256 ?? '').trim().toUpperCase();
  if (pinned !== gateReceiptSha256.trim().toUpperCase()) {
    throw new Error('SUCCESSOR_PIN_MISMATCH: successor manifest gate-receipt pin differs from the stored receipt SHA-256');
  }
}

/**
 * Acyclicity guard (05R7.5). The manifest a gate receipt attests must not pin
 * that same receipt — the receipt does not exist until the gate finishes, so a
 * self-pin is a hash cycle, never a valid unlock.
 */
export function assertNoReceiptCycle(
  manifestArtifacts: Array<{ path?: unknown }> | undefined,
  gateReceiptPath: string,
): void {
  const norm = (p: unknown) => String(p ?? '').replace(/\\/g, '/').trim();
  if ((manifestArtifacts ?? []).some((a) => norm(a.path) === norm(gateReceiptPath))) {
    throw new Error(`GATE_RECEIPT_CYCLE: manifest pins the gate receipt it attests ("${gateReceiptPath}"); the successor manifest must pin it instead`);
  }
}

// ─── 05R7B: planner-control consumption, transitive imports, fail-closed identity, advisory identity ───

/**
 * Planner-control consumption (05R7B.1). The exact validator must read every
 * enforceable JSON pointer declared in `controlEnforcement` and let it affect
 * the gate result. Descriptive metadata is enumerated separately and must
 * never authorize a result: planner routing fields (prompt matching) are not
 * authority, and hard-coded behavior that merely matches an unread field is
 * insufficient.
 *
 * The validator records one mark per contract read at the exact line that
 * branches on the field, then calls `assertConsumedControlsExact` with the
 * union. Missing, additional, duplicated, malformed, or metadata-authorized
 * entries fail with the contract-configured `unconsumedErrorCode`.
 */
export interface ControlEnforcementSpec {
  requireExactConsumedSet: boolean;
  unconsumedErrorCode: string;
  enforceable: string[];
  metadata: string[];
}

function assertControlPointerList(role: string, value: unknown, allowEmpty: boolean): string[] {
  if (!Array.isArray(value) || (!allowEmpty && value.length === 0)) {
    throw new Error(
      `UNCONSUMED_PLANNER_CONTROL: controlEnforcement.${role} must be a non-empty array of JSON pointers`,
    );
  }
  const norm = (p: unknown) => String(p ?? '').trim();
  for (const p of value as unknown[]) {
    if (typeof p !== 'string' || !norm(p).startsWith('/')) {
      throw new Error(
        `UNCONSUMED_PLANNER_CONTROL: controlEnforcement.${role} contains a malformed JSON pointer: "${norm(p)}"`,
      );
    }
  }
  const list = (value as unknown[]).map(norm);
  if (new Set(list).size !== list.length) {
    throw new Error(
      `UNCONSUMED_PLANNER_CONTROL: controlEnforcement.${role} declares a duplicate JSON pointer`,
    );
  }
  return list;
}

/**
 * Read and shape-validate the planner-owned `controlEnforcement` block.
 * Every violation fails with UNCONSUMED_PLANNER_CONTROL (literal fallback
 * when the configured code itself is malformed, so a broken code cannot
 * silence the enforcement).
 */
export function readControlEnforcement(contract: unknown): ControlEnforcementSpec {
  const ce = (contract as { controlEnforcement?: unknown } | null | undefined)?.controlEnforcement;
  if (!ce || typeof ce !== 'object') {
    throw new Error('UNCONSUMED_PLANNER_CONTROL: planner contract declares no controlEnforcement block');
  }
  const rec = ce as Record<string, unknown>;
  if (rec['requireExactConsumedSet'] !== true) {
    throw new Error(
      'UNCONSUMED_PLANNER_CONTROL: controlEnforcement.requireExactConsumedSet is not true; exact consumed-set equality cannot be established',
    );
  }
  const code = rec['unconsumedErrorCode'];
  if (typeof code !== 'string' || !/^[A-Z][A-Z0-9_]*$/.test(code.trim())) {
    throw new Error(
      'UNCONSUMED_PLANNER_CONTROL: controlEnforcement.unconsumedErrorCode is absent or malformed; a well-formed error code is required',
    );
  }
  const enforceable = assertControlPointerList('enforceableJsonPointers', rec['enforceableJsonPointers'], false);
  const metadata = assertControlPointerList(
    'metadataJsonPointers',
    rec['metadataJsonPointers'] ?? [],
    true,
  );
  return {
    requireExactConsumedSet: true,
    unconsumedErrorCode: code.trim(),
    enforceable,
    metadata,
  };
}

/**
 * Exact consumed-set equality (05R7B.1). The gate-collected `consumed`
 * inventory must equal the planner-declared enforceable set exactly:
 * unread pointers, consumed-but-undeclared pointers, and descriptive
 * metadata smuggled into the consumed set all fail with the configured
 * code. Returns the deterministic (sorted) consumed-control inventory.
 */
export function assertConsumedControlsExact(
  enforceable: string[],
  metadata: string[],
  consumed: string[],
  errorCode: string,
): string[] {
  const code =
    typeof errorCode === 'string' && /^[A-Z][A-Z0-9_]*$/.test(errorCode.trim())
      ? errorCode.trim()
      : 'UNCONSUMED_PLANNER_CONTROL';
  const norm = (p: unknown) => String(p ?? '').trim();
  const enforced = enforceable.map(norm);
  const meta = new Set(metadata.map(norm));
  const seen = [...consumed].map(norm);
  const missing = enforced.filter((p) => !seen.includes(p));
  if (missing.length > 0) {
    throw new Error(
      `${code}: planner-declared enforceable control(s) never read by the exact gate: [${missing.join(', ')}]`,
    );
  }
  const enforcedSet = new Set(enforced);
  const additional = seen.filter((p) => !enforcedSet.has(p));
  if (additional.length > 0) {
    throw new Error(
      `${code}: gate consumed undeclared control(s) outside the planner inventory: [${[...new Set(additional)].join(', ')}]`,
    );
  }
  const metaAuthorized = seen.filter((p) => meta.has(p));
  if (metaAuthorized.length > 0) {
    throw new Error(
      `${code}: descriptive metadata must never authorize a result: [${[...new Set(metaAuthorized)].join(', ')}]`,
    );
  }
  return [...new Set(seen)].sort();
}

// ─── 05R7B: transitive local-import scope closure (pure, zero I/O) ───
// 05R7C extends this section to syntax-complete discovery: fixed targets may
// use single quotes, double quotes, or no-substitution template literals.
// Comments and ordinary strings never create edges. Non-static import() and
// require() arguments fail with SCOPE_CLOSURE_NONSTATIC_IMPORT.
// 05R7D replaces all comment pre-stripping and hand-written lexing below with
// the TypeScript Compiler API (AST-based, lexically safe).

// ─── 05R7D: superseded pre-strip design (removed) ───
// The previous stripImportComments() preprocessing removed comment-looking
// text before lexical string state was known, so delimiter-looking text inside
// valid literals could erase a later protected import. That design is removed;
// comments are now recognized only outside literals via the language parser.

/**
 * Strip block (`/* … *​/`) and line (`// …`) comments so doc comments that
 * SUPERSEDED-05R7D: pre-strip design removed; lexically safe AST parsing below.
 */
// ─── 05R7D: lexically safe import discovery (TypeScript Compiler API) ───
// Pre-strip comment removal is FORBIDDEN. Comments are recognized only
// outside string/template/regex literals via the language parser, so
// delimiter-looking text inside any literal can never suppress a later real
// import. See parseRelativeRuntimeImports below (AST-based).

export const LEXICAL_REQUIRED_SCRIPT_KINDS = ["ts", "tsx", "js", "jsx", "mts", "cts", "mjs", "cjs"] as const;

export const LEXICAL_REQUIRED_INTERACTION_FIXTURES = [
  "block-comment-marker-in-string-before-real-import",
  "line-comment-marker-in-string-before-real-import",
  "delimiter-marker-in-template-before-real-import",
  "delimiter-marker-in-regex-before-real-import",
  "real-comment-with-fake-import",
  "real-comment-between-import-and-call",
  "malformed-source-fails-closed",
] as const;

function getScriptKindForFile(repoPath: string): ts.ScriptKind {
  const lower = String(repoPath ?? "").toLowerCase();
  if (lower.endsWith(".tsx")) return ts.ScriptKind.TSX;
  if (lower.endsWith(".jsx")) return ts.ScriptKind.JSX;
  if (lower.endsWith(".mts") || lower.endsWith(".cts")) return ts.ScriptKind.TS;
  if (lower.endsWith(".mjs") || lower.endsWith(".cjs")) return ts.ScriptKind.JS;
  if (lower.endsWith(".ts")) return ts.ScriptKind.TS;
  if (lower.endsWith(".js")) return ts.ScriptKind.JS;
  return ts.ScriptKind.TS;
}

/**
 * Validate the planner-owned lexicalImportParsingContract (05R7D.2).
 * Every field must declare exactly the enforced values; anything weaker
 * fails closed with SCOPE_CLOSURE_POLICY_MISMATCH so an unread or weakened
 * lexical control can never pass through the exact gate.
 */
export function assertLexicalImportParsingContract(contract: unknown): {
  strategy: string;
  requiredScriptKinds: string[];
  requiredInteractionFixtures: string[];
} {
  const fail = (detail: string): never => {
    throw new Error(`SCOPE_CLOSURE_POLICY_MISMATCH: lexicalImportParsingContract ${detail}`);
  };
  const holder = (contract as { lexicalImportParsingContract?: unknown } | null | undefined)?.lexicalImportParsingContract;
  if (!holder || typeof holder !== "object") fail("is absent; lexically safe parsing is required by this prompt");
  const rec = holder as Record<string, unknown>;
  if (rec["strategy"] !== "language-parser-or-context-preserving-lexer") fail('strategy is not "language-parser-or-context-preserving-lexer"');
  if (rec["preStripCommentsForbidden"] !== true) fail("preStripCommentsForbidden is not true; pre-lexical comment stripping is forbidden");
  if (rec["commentsRecognizedOnlyOutsideLiterals"] !== true) fail("commentsRecognizedOnlyOutsideLiterals is not true");
  if (rec["delimiterTextCannotSuppressLaterImport"] !== true) fail("delimiterTextCannotSuppressLaterImport is not true");
  if (rec["parseDiagnosticsPolicy"] !== "reject") fail('parseDiagnosticsPolicy is not "reject"');
  if (rec["parseFailureErrorCode"] !== "SCOPE_CLOSURE_PARSE_FAILED") fail('parseFailureErrorCode is not "SCOPE_CLOSURE_PARSE_FAILED"');
  const kinds = rec["requiredScriptKinds"];
  if (!Array.isArray(kinds)) fail("requiredScriptKinds must list every required script kind");
  const gotKinds = new Set((kinds as unknown[]).map((v) => String(v)));
  const wantKinds = new Set<string>([...LEXICAL_REQUIRED_SCRIPT_KINDS]);
  const missingKinds = [...wantKinds].filter((k) => !gotKinds.has(k));
  const extraKinds = [...gotKinds].filter((k) => !wantKinds.has(k));
  if (missingKinds.length > 0 || extraKinds.length > 0) {
    fail(`requiredScriptKinds must equal [${[...wantKinds].join(", ")}] (missing [${missingKinds.join(", ")}]; additional [${extraKinds.join(", ")}])`);
  }
  const fixtures = rec["requiredInteractionFixtures"];
  if (!Array.isArray(fixtures)) fail("requiredInteractionFixtures must list every required interaction fixture");
  const gotFixtures = new Set((fixtures as unknown[]).map((v) => String(v)));
  const wantFixtures = new Set<string>([...LEXICAL_REQUIRED_INTERACTION_FIXTURES]);
  const missingFixtures = [...wantFixtures].filter((f) => !gotFixtures.has(f));
  const extraFixtures = [...gotFixtures].filter((f) => !wantFixtures.has(f));
  if (missingFixtures.length > 0 || extraFixtures.length > 0) {
    fail(`requiredInteractionFixtures must equal [${[...wantFixtures].join(", ")}] (missing [${missingFixtures.join(", ")}]; additional [${extraFixtures.join(", ")}])`);
  }
  return {
    strategy: String(rec["strategy"]),
    requiredScriptKinds: [...wantKinds],
    requiredInteractionFixtures: [...wantFixtures],
  };
}

/**
 * Parse static relative runtime import specifiers via the TypeScript Compiler
 * API (05R7D.1, lexically safe). Covers static `import … from`, `export … from`,
 * side-effect `import`, dynamic `import()`, and identifier `require()` where
 * the fixed target uses a single-quoted, double-quoted, or no-substitution
 * template literal (static positions accept StringLiteral and, for
 * backward-compatible closure, NoSubstitutionTemplateLiteral; dynamic
 * positions require one of the three fixed forms where the parser accepts
 * them). Built-in (`node:…`) and package (bare) specifiers never match because
 * only specifiers beginning with `./` or `../` are collected. Comments,
 * strings, templates, regex literals, JSX text, and property/member names
 * never create edges because only ImportDeclaration, ExportDeclaration,
 * ImportKeyword CallExpression, bare-require CallExpression, and
 * ImportEqualsDeclaration nodes are visited. Delimiter-looking text inside any
 * literal cannot suppress a later real import because comments are recognized
 * only outside literals by the parser (pre-strip is forbidden). Template
 * substitutions, concatenations, variables, multiple arguments, and otherwise
 * non-static `import()`/`require()` targets throw
 * SCOPE_CLOSURE_NONSTATIC_IMPORT. Malformed source with parse diagnostics
 * throws SCOPE_CLOSURE_PARSE_FAILED rather than continuing with partial
 * evidence. Script kind follows the importing file extension for ts/tsx/js/
 * jsx/mts/cts/mjs/cjs. Traversal is deterministic source order; results are
 * deduplicated preserving first-seen order.
 */
export function parseRelativeRuntimeImports(fileContent: string, fileName = "file.ts"): string[] {
  const scriptKind = getScriptKindForFile(fileName);
  const sf = ts.createSourceFile(fileName, fileContent, ts.ScriptTarget.Latest, true, scriptKind);
  const diags = (sf as unknown as { parseDiagnostics?: Array<{ messageText?: unknown }> }).parseDiagnostics ?? [];
  if (diags.length > 0) {
    const first = diags[0] as { messageText?: unknown };
    const detail = typeof first?.messageText === "string" ? first.messageText : "parse error";
    throw new Error(`SCOPE_CLOSURE_PARSE_FAILED: source has ${diags.length} parse diagnostic(s); refusing partial evidence (${String(detail).slice(0, 120)})`);
  }
  const found: string[] = [];
  const isRelative = (spec: string) => spec.startsWith("./") || spec.startsWith("../");
  const failNonStatic = (detail: string): never => {
    throw new Error(`SCOPE_CLOSURE_NONSTATIC_IMPORT: ${detail}; only single-quoted, double-quoted, or no-substitution template fixed targets enter scope closure`);
  };
  function visit(node: ts.Node): void {
    if (ts.isImportDeclaration(node)) {
      const mod = node.moduleSpecifier;
      if (ts.isStringLiteral(mod) || ts.isNoSubstitutionTemplateLiteral(mod)) {
        const spec = mod.text;
        if (isRelative(spec)) found.push(spec);
      }
    } else if (ts.isExportDeclaration(node)) {
      const mod = node.moduleSpecifier;
      if (mod && (ts.isStringLiteral(mod) || ts.isNoSubstitutionTemplateLiteral(mod))) {
        const spec = (mod as ts.StringLiteral | ts.NoSubstitutionTemplateLiteral).text;
        if (isRelative(spec)) found.push(spec);
      }
    } else if (ts.isCallExpression(node)) {
      if (node.expression.kind === ts.SyntaxKind.ImportKeyword) {
        if (node.arguments.length !== 1) {
          failNonStatic("dynamic import() must have exactly one fixed argument (zero arguments, multiple arguments, spread, and trailing extra tokens fail closed)");
        }
        const arg = node.arguments[0] as ts.Expression;
        if (ts.isStringLiteral(arg) || ts.isNoSubstitutionTemplateLiteral(arg)) {
          const spec = (arg as ts.StringLiteral | ts.NoSubstitutionTemplateLiteral).text;
          if (isRelative(spec)) found.push(spec);
        } else {
          failNonStatic("dynamic import() argument is not a fixed single-quoted, double-quoted, or no-substitution template literal; concatenations, variables, and template expressions fail closed");
        }
      } else if (ts.isIdentifier(node.expression) && node.expression.text === "require") {
        if (node.arguments.length !== 1) {
          failNonStatic("require() must have exactly one fixed argument (zero arguments, multiple arguments, spread, and trailing extra tokens fail closed)");
        }
        const arg = node.arguments[0] as ts.Expression;
        if (ts.isStringLiteral(arg) || ts.isNoSubstitutionTemplateLiteral(arg)) {
          const spec = (arg as ts.StringLiteral | ts.NoSubstitutionTemplateLiteral).text;
          if (isRelative(spec)) found.push(spec);
        } else {
          failNonStatic("require() argument is not a fixed single-quoted, double-quoted, or no-substitution template literal; concatenations, variables, and template expressions fail closed");
        }
      }
    } else if (ts.isImportEqualsDeclaration(node)) {
      const modRef = node.moduleReference;
      if (ts.isExternalModuleReference(modRef)) {
        const expr = modRef.expression;
        if (expr && (ts.isStringLiteral(expr) || ts.isNoSubstitutionTemplateLiteral(expr))) {
          const spec = (expr as ts.StringLiteral | ts.NoSubstitutionTemplateLiteral).text;
          if (isRelative(spec)) found.push(spec);
        }
      }
    }
    ts.forEachChild(node, visit);
  }
  visit(sf);
  return [...new Set(found)];
}

/**
 * SUPERSEDED-05R7D legacy hand lexer (05R7C.1) preserved as rejected history.
 * The active production gate uses parseRelativeRuntimeImports (AST) above.
 * This legacy implementation is retained only so prior evidence remains
 * inspectable; it must never be called by production gate logic.
 */
export function parseRelativeRuntimeImportsLegacyHandLexerSuperseded05R7C(fileContent: string): string[] {
  const code = fileContent; // SUPERSEDED-05R7D: pre-strip removed from active path; legacy preserved as rejected history (unreachable in production gate).
  const found: string[] = [];
  const len = code.length;
  let i = 0;
  let inSingle = false;
  let inDouble = false;
  let inTemplate = false;
  let templateExprDepth = 0;
  let escaped = false;

  const isWordChar = (ch: string) => /[A-Za-z0-9_$]/.test(ch);
  const isIdentStart = (ch: string) => /[A-Za-z_$]/.test(ch);

  function matchKeywordAt(pos: number, kw: string): boolean {
    if (code.slice(pos, pos + kw.length) !== kw) return false;
    const before = pos > 0 ? code[pos - 1] as string : '';
    const after = pos + kw.length < len ? code[pos + kw.length] as string : '';
    if (before && isWordChar(before)) return false;
    if (after && isWordChar(after)) return false;
    return true;
  }

  function skipWs(pos: number): number {
    while (pos < len && /\s/.test(code[pos] as string)) pos++;
    return pos;
  }

  // Parse a fixed literal at pos (pos points at ' " or `). Returns specifier
  // plus end position, or null when not a fixed literal. Template literals
  // containing ${} are non-fixed (caller decides NONSTATIC vs ignore).
  function tryParseFixedLiteral(pos: number): { spec: string; end: number; kind: string; hasSubstitution: boolean } | null {
    const q = code[pos] as string;
    if (q !== "'" && q !== '"' && q !== '`') return null;
    let j = pos + 1;
    let buf = '';
    while (j < len) {
      const ch = code[j] as string;
      if (q !== '`' && ch === '\\') {
        if (j + 1 < len) {
          buf += code[j + 1] as string;
          j += 2;
          continue;
        }
        return null;
      }
      if (q === '`' && ch === '\\') {
        if (j + 1 < len) {
          const nxt = code[j + 1] as string;
          if (nxt === '`' || nxt === '\\' || nxt === '$') {
            buf += nxt;
            j += 2;
            continue;
          }
          buf += ch;
          j++;
          continue;
        }
        return null;
      }
      if (q === '`' && ch === '$' && code[j + 1] === '{') {
        // Consume to matching } to determine substitution; content is dynamic.
        let depth = 1;
        j += 2;
        while (j < len && depth > 0) {
          if (code[j] === '{') depth++;
          else if (code[j] === '}') depth--;
          j++;
        }
        // Continue scanning for closing backtick to find end, but mark dynamic.
        let k = j;
        while (k < len && (code[k] as string) !== '`') {
          if ((code[k] as string) === '\\' && k + 1 < len) k += 2;
          else k++;
        }
        if (k >= len) return null;
        return { spec: buf, end: k + 1, kind: 'template-substitution', hasSubstitution: true };
      }
      if (ch === q) {
        const kind = q === "'" ? 'single-quoted' : q === '"' ? 'double-quoted' : 'no-substitution-template';
        return { spec: buf, end: j + 1, kind, hasSubstitution: false };
      }
      if (q !== '`' && (ch === '\n' || ch === '\r')) return null;
      buf += ch;
      j++;
    }
    return null;
  }

  while (i < len) {
    const ch = code[i] as string;
    if (escaped) {
      escaped = false;
      i++;
      continue;
    }
    if (inSingle) {
      if (ch === '\\') escaped = true;
      else if (ch === "'") inSingle = false;
      i++;
      continue;
    }
    if (inDouble) {
      if (ch === '\\') escaped = true;
      else if (ch === '"') inDouble = false;
      i++;
      continue;
    }
    if (inTemplate) {
      if (templateExprDepth > 0) {
        // Inside ${}: track braces; a } at depth 1 returns to template text.
        if (ch === '{') templateExprDepth++;
        else if (ch === '}') {
          templateExprDepth--;
        } else if (ch === "'") {
          // Skip single-quoted string inside expression.
          let k = i + 1;
          while (k < len) {
            if ((code[k] as string) === '\\') k += 2;
            else if ((code[k] as string) === "'") break;
            else k++;
          }
          i = k + 1;
          continue;
        } else if (ch === '"') {
          let k = i + 1;
          while (k < len) {
            if ((code[k] as string) === '\\') k += 2;
            else if ((code[k] as string) === '"') break;
            else k++;
          }
          i = k + 1;
          continue;
        }
        i++;
        continue;
      }
      if (ch === '\\') escaped = true;
      else if (ch === '`') inTemplate = false;
      else if (ch === '$' && code[i + 1] === '{') {
        templateExprDepth = 1;
        i += 2;
        continue;
      }
      i++;
      continue;
    }
    // Normal code.
    if (ch === "'") {
      inSingle = true;
      i++;
      continue;
    }
    if (ch === '"') {
      inDouble = true;
      i++;
      continue;
    }
    if (ch === '`') {
      inTemplate = true;
      templateExprDepth = 0;
      i++;
      continue;
    }
    if (isIdentStart(ch)) {
      if (matchKeywordAt(i, 'from')) {
        let j = skipWs(i + 4);
        const lit = tryParseFixedLiteral(j);
        if (lit && !lit.hasSubstitution) {
          if (lit.spec.startsWith('./') || lit.spec.startsWith('../')) found.push(lit.spec);
          i = lit.end;
          continue;
        }
        i += 4;
        continue;
      }
      if (matchKeywordAt(i, 'import')) {
        let j = skipWs(i + 6);
        const nxt = code[j] as string;
        if (nxt === '(') {
          // Dynamic import(): fixed literal forms collect only when the
          // argument is exactly one fixed literal; trailing concatenation or
          // extra tokens mean the target is non-static and must fail closed.
          let k = skipWs(j + 1);
          const lit = tryParseFixedLiteral(k);
          if (lit) {
            if (lit.hasSubstitution) {
              throw new Error('SCOPE_CLOSURE_NONSTATIC_IMPORT: dynamic import() uses a template literal with substitution; only single-quoted, double-quoted, or no-substitution template targets enter scope closure');
            }
            const after = skipWs(lit.end);
            if ((code[after] as string) !== ')' && (code[after] as string) !== undefined) {
              throw new Error('SCOPE_CLOSURE_NONSTATIC_IMPORT: dynamic import() argument appends concatenation or extra tokens to a fixed literal; concatenated targets fail closed');
            }
            if (lit.spec.startsWith('./') || lit.spec.startsWith('../')) found.push(lit.spec);
            i = lit.end;
            continue;
          }
          const rest = code.slice(k, k + 40);
          if (rest.trim().length === 0 || (code[k] as string) === ')') {
            i = k;
            continue;
          }
          throw new Error('SCOPE_CLOSURE_NONSTATIC_IMPORT: dynamic import() argument is not a fixed single-quoted, double-quoted, or no-substitution template literal; concatenated targets, variables, and template expressions fail closed');
        }
        if (nxt === "'" || nxt === '"' || nxt === '`') {
          const lit = tryParseFixedLiteral(j);
          if (lit && !lit.hasSubstitution) {
            if (lit.spec.startsWith('./') || lit.spec.startsWith('../')) found.push(lit.spec);
            i = lit.end;
            continue;
          }
          i = j + 1;
          continue;
        }
        i += 6;
        continue;
      }
      if (matchKeywordAt(i, 'require')) {
        let j = skipWs(i + 7);
        if ((code[j] as string) === '(') {
          let k = skipWs(j + 1);
          const lit = tryParseFixedLiteral(k);
          if (lit) {
            if (lit.hasSubstitution) {
              throw new Error('SCOPE_CLOSURE_NONSTATIC_IMPORT: require() uses a template literal with substitution; only single-quoted, double-quoted, or no-substitution template targets enter scope closure');
            }
            const after = skipWs(lit.end);
            if ((code[after] as string) !== ')' && (code[after] as string) !== undefined) {
              throw new Error('SCOPE_CLOSURE_NONSTATIC_IMPORT: require() argument appends concatenation or extra tokens to a fixed literal; concatenated targets fail closed');
            }
            if (lit.spec.startsWith('./') || lit.spec.startsWith('../')) found.push(lit.spec);
            i = lit.end;
            continue;
          }
          const rest = code.slice(k, k + 40);
          if (rest.trim().length === 0 || (code[k] as string) === ')') {
            i = k;
            continue;
          }
          throw new Error('SCOPE_CLOSURE_NONSTATIC_IMPORT: require() argument is not a fixed single-quoted, double-quoted, or no-substitution template literal; concatenated targets, variables, and template expressions fail closed');
        }
        i += 7;
        continue;
      }
      // Any other identifier: advance one char.
      i++;
      continue;
    }
    i++;
  }
  return [...new Set(found)];
}

function normalizeRepoPath(pathValue: string): string {
  const parts = String(pathValue).replace(/\\/g, '/').split('/');
  const stack: string[] = [];
  for (let i = 0; i < parts.length; i++) {
    const part = parts[i] as string;
    if (part === '' || part === '.') continue;
    if (part === '..') {
      if (stack.length === 0) return parts.slice(i).join('/');
      stack.pop();
      continue;
    }
    stack.push(part);
  }
  return stack.join('/');
}

function isWithinRoot(candidate: string, root: string): boolean {
  const normRoot = root.replace(/\\/g, '/').replace(/\/+$/, '');
  return candidate === normRoot || candidate.startsWith(normRoot + '/');
}

export interface TransitiveImportOptions {
  allowedSourceRoots: string[];
  runtimeSpecifierMap: Record<string, string[]>;
}

/**
 * Resolve one relative runtime specifier to a repository `.ts` source
 * (05R7B.2). ESM-safe `.js` specifiers are mapped through
 * `runtimeSpecifierMap` (e.g. `.js` → [`.ts`, `.tsx`, `.js`]) and the first
 * existing candidate wins. Resolutions escaping every allowed source root
 * fail with SCOPE_CLOSURE_IMPORT_ESCAPE; unresolvable specifiers fail with
 * SCOPE_CLOSURE_UNRESOLVED_IMPORT. Non-relative specifiers are never local
 * files and are rejected as unresolved.
 */
export function resolveRuntimeSpecifierToSource(
  importerRepoPath: string,
  specifier: string,
  opts: TransitiveImportOptions,
  exists: (candidateRepoPath: string) => boolean,
): string {
  const spec = String(specifier ?? '');
  if (!spec.startsWith('./') && !spec.startsWith('../')) {
    throw new Error(
      `SCOPE_CLOSURE_UNRESOLVED_IMPORT: "${importerRepoPath}" has a non-relative runtime specifier "${spec}"; only relative local imports enter scope closure`,
    );
  }
  const importerDir = importerRepoPath.replace(/\\/g, '/').split('/').slice(0, -1).join('/');
  const joined = importerDir ? `${importerDir}/${spec}` : spec;
  const normalized = normalizeRepoPath(joined);
  if (normalized === '' || normalized.startsWith('../') || normalized === '..') {
    throw new Error(
      `SCOPE_CLOSURE_IMPORT_ESCAPE: "${importerRepoPath}" imports "${spec}" resolving outside the repository: "${normalized}"`,
    );
  }
  const roots = (opts.allowedSourceRoots ?? []).map((r) => String(r).replace(/\\/g, '/').replace(/\/+$/, ''));
  if (!roots.some((root) => isWithinRoot(normalized, root))) {
    throw new Error(
      `SCOPE_CLOSURE_IMPORT_ESCAPE: "${importerRepoPath}" imports "${spec}" resolving to "${normalized}" outside the allowed source roots [${roots.join(', ')}]`,
    );
  }
  const map = opts.runtimeSpecifierMap ?? {};
  if (normalized.endsWith('.js') && Array.isArray(map['.js'])) {
    const base = normalized.slice(0, -'.js'.length);
    for (const ext of map['.js']) {
      const candidate = `${base}${String(ext)}`;
      if (exists(candidate)) return candidate;
    }
    throw new Error(
      `SCOPE_CLOSURE_UNRESOLVED_IMPORT: "${importerRepoPath}" imports "${spec}"; no mapped source exists for "${normalized}" (tried [${(map['.js'] as string[]).map((e) => `"${base}${String(e)}"`).join(', ')}])`,
    );
  }
  if (exists(normalized)) return normalized;
  throw new Error(
    `SCOPE_CLOSURE_UNRESOLVED_IMPORT: "${importerRepoPath}" imports "${spec}"; no source exists at "${normalized}"`,
  );
}

export interface TransitiveImportWalkOptions extends TransitiveImportOptions {
  rejectUnresolvedRelativeImport: boolean;
  rejectSourceRootEscape: boolean;
  cyclesAreVisitedOnce: boolean;
}

/**
 * Breadth-first transitive local-import walk (05R7B.2). Starting from each
 * declared production root, parses static relative runtime imports
 * recursively and returns every reachable local source INCLUDING the roots.
 * Cycles are visited once (deterministic traversal). Unresolved relative
 * imports and source-root escapes throw with SCOPE_CLOSURE_* codes when the
 * corresponding contract flags require rejection. File access is injected so
 * the walk is unit-testable without touching live sources.
 */
export function collectTransitiveLocalImports(
  productionRoots: string[],
  opts: TransitiveImportWalkOptions,
  io: { readFile: (repoPath: string) => string | null; fileExists: (repoPath: string) => boolean },
): string[] {
  const norm = (p: unknown) => String(p ?? '').replace(/\\/g, '/').trim();
  const roots = (productionRoots ?? []).map(norm).filter((p) => p.length > 0);
  if (roots.length === 0) {
    throw new Error('SCOPE_CLOSURE_MISSING: transitive import walk declares no productionRoots');
  }
  const visited = new Set<string>();
  const reachable: string[] = [];
  const queue = [...roots];
  while (queue.length > 0) {
    const current = queue.shift() as string;
    if (visited.has(current)) continue;
    visited.add(current);
    const content = io.readFile(current);
    if (content === null || content === undefined) {
      throw new Error(
        `SCOPE_CLOSURE_UNRESOLVED_IMPORT: production import root not found on disk: "${current}"`,
      );
    }
    reachable.push(current);
    for (const spec of parseRelativeRuntimeImports(content, current)) {
      let resolved: string;
      try {
        resolved = resolveRuntimeSpecifierToSource(
          current,
          spec,
          { allowedSourceRoots: opts.allowedSourceRoots, runtimeSpecifierMap: opts.runtimeSpecifierMap },
          (candidate) => io.fileExists(candidate),
        );
      } catch (e: any) {
        const msg = String(e?.message ?? '');
        if (msg.startsWith('SCOPE_CLOSURE_IMPORT_ESCAPE') && !opts.rejectSourceRootEscape) continue;
        if (msg.startsWith('SCOPE_CLOSURE_UNRESOLVED_IMPORT') && !opts.rejectUnresolvedRelativeImport) continue;
        throw e;
      }
      if (!visited.has(resolved) && opts.cyclesAreVisitedOnce !== false) {
        queue.push(resolved);
      } else if (!visited.has(resolved)) {
        queue.push(resolved);
      }
    }
  }
  return reachable;
}

// ─── 05R7B: fail-closed filesystem identity (pure, zero I/O) ───

const FILESYSTEM_FAILURE_STAGES = [
  'canonicalization',
  'realpath',
  'linkInspection',
  'stat',
  'open',
  'read',
  'hash',
] as const;

export type FilesystemFailureStage = (typeof FILESYSTEM_FAILURE_STAGES)[number];

export interface FilesystemFailurePolicy {
  stages: Record<FilesystemFailureStage, 'reject'>;
  realpathErrorCode: string;
  identityErrorCode: string;
}

const ERROR_CODE_PATTERN = /^[A-Z][A-Z0-9_]*$/;

/**
 * Validate the planner-owned `filesystemFailurePolicy` (05R7B.3). Every
 * stage must be `reject`: any downgrade (`ignore` or any other value) fails
 * closed with FILESYSTEM_FAILURE_POLICY_MISMATCH, as does a malformed error
 * code. The validated policy drives the exact gate: required real-path
 * containment failures emit `realpathErrorCode`, and link/stat/open/read/
 * hash failures emit `identityErrorCode`; neither falls through to weaker
 * evidence.
 */
export function assertFilesystemFailurePolicy(policy: unknown): FilesystemFailurePolicy {
  const fail = (detail: string): never => {
    throw new Error(`FILESYSTEM_FAILURE_POLICY_MISMATCH: filesystemFailurePolicy ${detail}`);
  };
  if (!policy || typeof policy !== 'object') {
    fail('is absent; a planner-owned fail-closed policy is required');
  }
  const rec = policy as Record<string, unknown>;
  const stages = {} as Record<FilesystemFailureStage, 'reject'>;
  for (const stage of FILESYSTEM_FAILURE_STAGES) {
    if (rec[stage] !== 'reject') {
      fail(`stage "${stage}" is not "reject" (got ${JSON.stringify(rec[stage] ?? null)}); downgrades are forbidden`);
    }
    stages[stage] = 'reject';
  }
  for (const field of ['realpathErrorCode', 'identityErrorCode'] as const) {
    const value = rec[field];
    if (typeof value !== 'string' || !ERROR_CODE_PATTERN.test(value.trim())) {
      fail(`"${field}" is absent or malformed; a well-formed error code is required`);
    }
  }
  return {
    stages,
    realpathErrorCode: String(rec['realpathErrorCode']).trim(),
    identityErrorCode: String(rec['identityErrorCode']).trim(),
  };
}

/**
 * Map a failed filesystem-identity stage to its configured error code
 * (05R7B.3). Canonicalization, real-path, and link-inspection failures are
 * path-identity failures (`realpathErrorCode`); stat/open/read/hash failures
 * are file-identity failures (`identityErrorCode`).
 */
export function filesystemFailureCodeForStage(
  stage: FilesystemFailureStage,
  policy: FilesystemFailurePolicy,
): string {
  if (stage === 'canonicalization' || stage === 'realpath' || stage === 'linkInspection') {
    return policy.realpathErrorCode;
  }
  return policy.identityErrorCode;
}

// ─── 05R7B: zero-mutation boundary (pure, zero I/O) ───

const MUTATION_BOUNDARY_FLAGS = [
  'databaseDdl',
  'databaseDml',
  'databaseCreation',
  'databaseDeletion',
  'migrationApply',
  'configurationChange',
  'runtimeRestart',
  'cutover',
];

/**
 * Consume the planner-owned `mutationBoundary` (05R7B.1/05R7B.5). This pass
 * is zero-write: every declared boundary flag must be present and false.
 * Any enabled flag fails closed with MUTATION_BOUNDARY_VIOLATION, so a
 * planner scope change can never silently pass through the gate.
 */
export function assertMutationBoundaryZero(boundary: unknown): void {
  if (!boundary || typeof boundary !== 'object') {
    throw new Error('MUTATION_BOUNDARY_VIOLATION: mutationBoundary is absent; an explicit zero-mutation boundary is required');
  }
  const rec = boundary as Record<string, unknown>;
  const violated = MUTATION_BOUNDARY_FLAGS.filter((flag) => rec[flag] !== false);
  if (violated.length > 0) {
    throw new Error(
      `MUTATION_BOUNDARY_VIOLATION: mutation boundary flag(s) not explicitly false: [${violated.join(', ')}]`,
    );
  }
}

// ─── 05R7B: planner policy-shape consumption (pure, zero I/O) ───

/**
 * Consume `strictScalarValidation.probeExitCode` (05R7B.1). The exact gate
 * enforces finite-integer exit codes without coercion; the planner policy
 * must declare exactly that contract, otherwise the gate fails closed with
 * STRICT_SCALAR_POLICY_MISMATCH (a silently weakened policy cannot pass).
 */
export function assertStrictScalarPolicy(policy: unknown): void {
  const fail = (detail: string): never => {
    throw new Error(`STRICT_SCALAR_POLICY_MISMATCH: strictScalarValidation.probeExitCode ${detail}`);
  };
  const holder = (policy as { strictScalarValidation?: unknown } | null | undefined)?.strictScalarValidation;
  if (!holder || typeof holder !== 'object') fail('is absent; a strict exit-code policy is required');
  const holderRec = holder as Record<string, unknown>;
  const exitRaw = holderRec['probeExitCode'];
  if (!exitRaw || typeof exitRaw !== 'object') fail('is absent; a strict exit-code policy is required');
  const exit = exitRaw as Record<string, unknown>;
  if (exit['requiredType'] !== 'number') fail(`requiredType is not "number" (got ${JSON.stringify(exit['requiredType'] ?? null)})`);
  if (exit['finite'] !== true) fail('finite is not true');
  if (exit['integer'] !== true) fail('integer is not true');
  if (exit['coercionForbidden'] !== true) fail('coercionForbidden is not true');
  if (!Array.isArray(exit['reject']) || (exit['reject'] as unknown[]).length === 0) {
    fail('reject must be a non-empty malformed-value inventory');
  }
}

const PROBE_PATH_REJECT_CLASSES = [
  'drive-absolute',
  'UNC',
  'POSIX-absolute',
  'device-path',
  'relative-traversal',
  'mixed-separator-traversal',
  'symlink-escape',
];

/**
 * Consume `probeOutputPathPolicy` (05R7B.1). Probe raw outputs are
 * workspace-only with canonical plus real-path containment; the planner
 * policy must declare exactly that, otherwise the gate fails closed with
 * PROBE_POLICY_MISMATCH.
 */
export function assertProbeOutputPolicy(policy: unknown): void {
  const fail = (detail: string): never => {
    throw new Error(`PROBE_POLICY_MISMATCH: probeOutputPathPolicy ${detail}`);
  };
  const holder = (policy as { probeOutputPathPolicy?: unknown } | null | undefined)?.probeOutputPathPolicy;
  if (!holder || typeof holder !== 'object') fail('is absent; a workspace containment policy is required');
  const rec = holder as Record<string, unknown>;
  if (rec['pathClass'] !== 'workspace') fail(`pathClass is not "workspace" (got ${JSON.stringify(rec['pathClass'] ?? null)})`);
  if (rec['canonicalContainmentRequired'] !== true) fail('canonicalContainmentRequired is not true');
  if (rec['realPathContainmentWhenExisting'] !== true) fail('realPathContainmentWhenExisting is not true');
  if (rec['absolutePathsAllowed'] !== false) fail('absolutePathsAllowed is not false');
  const reject = rec['reject'];
  if (!Array.isArray(reject)) fail('reject must list every rejected path class');
  const got = new Set((reject as unknown[]).map((v) => String(v)));
  const missing = PROBE_PATH_REJECT_CLASSES.filter((c) => !got.has(c));
  const additional = [...got].filter((c) => !(PROBE_PATH_REJECT_CLASSES as string[]).includes(c));
  if (missing.length > 0 || additional.length > 0) {
    fail(`reject inventory differs from the enforced set (missing [${missing.join(', ')}]; additional [${additional.join(', ')}])`);
  }
}

/**
 * Consume the planner-owned `scopeClosure` boolean policy flags (05R7B.1).
 * Exact-set equality, full missing/additional/duplicate/renamed/dangling/
 * escaping rejection, exact-entry-point enforcement, and workspace scoping
 * must all be required; exact paths and directory rules must be declared.
 * Anything weaker fails closed with SCOPE_CLOSURE_POLICY_MISMATCH.
 */
export function assertScopeClosurePolicyFlags(closure: unknown): void {
  const fail = (detail: string): never => {
    throw new Error(`SCOPE_CLOSURE_POLICY_MISMATCH: scopeClosure ${detail}`);
  };
  if (!closure || typeof closure !== 'object') fail('is absent; planner-owned scope closure is required');
  const rec = closure as Record<string, unknown>;
  if (rec['enforcedByExactValidatorEntryPoint'] !== true) fail('enforcedByExactValidatorEntryPoint is not true');
  if (rec['workspaceOnly'] !== true) fail('workspaceOnly is not true');
  if (rec['requireExactSetEquality'] !== true) fail('requireExactSetEquality is not true');
  if (rec['rejectMissingAdditionalDuplicateRenamedDanglingOrEscaping'] !== true) {
    fail('rejectMissingAdditionalDuplicateRenamedDanglingOrEscaping is not true');
  }
  if (rec['testOnlyClosureInsufficient'] !== true) fail('testOnlyClosureInsufficient is not true');
  if (!Array.isArray(rec['exactPaths']) || (rec['exactPaths'] as unknown[]).length === 0) {
    fail('exactPaths must be a non-empty path list');
  }
  if (!Array.isArray(rec['directoryRules']) || (rec['directoryRules'] as unknown[]).length === 0) {
    fail('directoryRules must be a non-empty rule list');
  }
}

/**
 * Validate the planner-owned `scopeClosure.transitiveLocalImports` block
 * (05R7B.2). Production roots, allowed source roots, the runtime specifier
 * map, and all rejection flags must be declared; anything weaker fails
 * closed with SCOPE_CLOSURE_POLICY_MISMATCH.
 */
export function assertTransitiveImportConfig(closure: unknown): TransitiveImportWalkOptions & {
  productionRoots: string[];
} {
  const fail = (detail: string): never => {
    throw new Error(`SCOPE_CLOSURE_POLICY_MISMATCH: scopeClosure.transitiveLocalImports ${detail}`);
  };
  const holder = (closure as { transitiveLocalImports?: unknown } | null | undefined)?.transitiveLocalImports;
  if (!holder || typeof holder !== 'object') fail('is absent; transitive import closure is required by this prompt');
  const rec = holder as Record<string, unknown>;
  if (rec['required'] !== true) fail('required is not true');
  const productionRoots = rec['productionRoots'];
  if (!Array.isArray(productionRoots) || productionRoots.length === 0 || !(productionRoots as unknown[]).every((p) => typeof p === 'string' && String(p).trim().length > 0)) {
    fail('productionRoots must be a non-empty string list');
  }
  const allowedSourceRoots = rec['allowedSourceRoots'];
  if (!Array.isArray(allowedSourceRoots) || allowedSourceRoots.length === 0 || !(allowedSourceRoots as unknown[]).every((p) => typeof p === 'string' && String(p).trim().length > 0)) {
    fail('allowedSourceRoots must be a non-empty string list');
  }
  const mapRaw = rec['runtimeSpecifierMap'];
  if (!mapRaw || typeof mapRaw !== 'object') {
    fail('runtimeSpecifierMap must map ".js" to a non-empty extension list');
  }
  const map = mapRaw as Record<string, unknown>;
  if (!Array.isArray(map['.js']) || (map['.js'] as unknown[]).length === 0) {
    fail('runtimeSpecifierMap must map ".js" to a non-empty extension list');
  }
  if (rec['rejectUnresolvedRelativeImport'] !== true) fail('rejectUnresolvedRelativeImport is not true');
  if (rec['rejectSourceRootEscape'] !== true) fail('rejectSourceRootEscape is not true');
  if (rec['cyclesAreVisitedOnce'] !== true) fail('cyclesAreVisitedOnce is not true');
  return {
    productionRoots: (productionRoots as string[]).map((p) => String(p).replace(/\\/g, '/').trim()),
    allowedSourceRoots: (allowedSourceRoots as string[]).map((p) => String(p).replace(/\\/g, '/').trim()),
    runtimeSpecifierMap: Object.fromEntries(
      Object.entries(map).map(([k, v]) => [k, (v as unknown[]).map((e) => String(e))]),
    ),
    rejectUnresolvedRelativeImport: true,
    rejectSourceRootEscape: true,
    cyclesAreVisitedOnce: true,
  };
}

// ─── 05R7C: syntax-complete transitive closure policy (pure, zero I/O) ───

export const FIXED_LITERAL_FORMS_05R7C = ['single-quoted', 'double-quoted', 'no-substitution-template'] as const;

/**
 * Validate the planner-owned 05R7C `scopeClosure.transitiveLocalImports`
 * block. Every syntax-completeness field must declare exactly the enforced
 * values; anything weaker fails closed with SCOPE_CLOSURE_POLICY_MISMATCH.
 * The validated walk still uses the shared BFS; the fixed-literal and
 * non-static behavior is enforced by parseRelativeRuntimeImports above.
 */
export function assertTransitiveImportClosurePolicy05R7C(closure: unknown): TransitiveImportWalkOptions & {
  productionRoots: string[];
} {
  const fail = (detail: string): never => {
    throw new Error(`SCOPE_CLOSURE_POLICY_MISMATCH: scopeClosure.transitiveLocalImports ${detail}`);
  };
  const holder = (closure as { transitiveLocalImports?: unknown } | null | undefined)?.transitiveLocalImports;
  if (!holder || typeof holder !== 'object') fail('is absent; transitive import closure is required by this prompt');
  const rec = holder as Record<string, unknown>;
  if (rec['required'] !== true) fail('required is not true');
  const productionRoots = rec['productionRoots'];
  if (!Array.isArray(productionRoots) || productionRoots.length === 0 || !(productionRoots as unknown[]).every((p) => typeof p === 'string' && String(p).trim().length > 0)) {
    fail('productionRoots must be a non-empty string list');
  }
  const allowedSourceRoots = rec['allowedSourceRoots'];
  if (!Array.isArray(allowedSourceRoots) || allowedSourceRoots.length === 0 || !(allowedSourceRoots as unknown[]).every((p) => typeof p === 'string' && String(p).trim().length > 0)) {
    fail('allowedSourceRoots must be a non-empty string list');
  }
  const mapRaw = rec['runtimeSpecifierMap'];
  if (!mapRaw || typeof mapRaw !== 'object') fail('runtimeSpecifierMap must map ".js" to a non-empty extension list');
  const map = mapRaw as Record<string, unknown>;
  if (!Array.isArray(map['.js']) || (map['.js'] as unknown[]).length === 0) {
    fail('runtimeSpecifierMap must map ".js" to a non-empty extension list');
  }
  const forms = rec['fixedLiteralForms'];
  if (!Array.isArray(forms)) fail('fixedLiteralForms must list every accepted fixed literal form');
  const gotForms = new Set((forms as unknown[]).map((v) => String(v)));
  const wantForms = new Set<string>([...FIXED_LITERAL_FORMS_05R7C]);
  const missingForms = [...wantForms].filter((f) => !gotForms.has(f));
  const extraForms = [...gotForms].filter((f) => !wantForms.has(f));
  if (missingForms.length > 0 || extraForms.length > 0) {
    fail(`fixedLiteralForms must equal [${[...wantForms].join(', ')}] (missing [${missingForms.join(', ')}]; additional [${extraForms.join(', ')}])`);
  }
  if (rec['nonStaticTargetPolicy'] !== 'reject') fail('nonStaticTargetPolicy is not "reject"');
  if (rec['nonStaticErrorCode'] !== 'SCOPE_CLOSURE_NONSTATIC_IMPORT') fail('nonStaticErrorCode is not "SCOPE_CLOSURE_NONSTATIC_IMPORT"');
  if (rec['commentsAndOrdinaryStringsCreateNoEdges'] !== true) fail('commentsAndOrdinaryStringsCreateNoEdges is not true');
  if (rec['rejectUnresolvedRelativeImport'] !== true) fail('rejectUnresolvedRelativeImport is not true');
  if (rec['rejectSourceRootEscape'] !== true) fail('rejectSourceRootEscape is not true');
  if (rec['cyclesAreVisitedOnce'] !== true) fail('cyclesAreVisitedOnce is not true');
  return {
    productionRoots: (productionRoots as string[]).map((p) => String(p).replace(/\\/g, '/').trim()),
    allowedSourceRoots: (allowedSourceRoots as string[]).map((p) => String(p).replace(/\\/g, '/').trim()),
    runtimeSpecifierMap: Object.fromEntries(
      Object.entries(map).map(([k, v]) => [k, (v as unknown[]).map((e) => String(e))]),
    ),
    rejectUnresolvedRelativeImport: true,
    rejectSourceRootEscape: true,
    cyclesAreVisitedOnce: true,
  };
}

// ─── 05R7B: advisory review identity (pure, zero I/O) ───

export interface AdvisoryReviewContract {
  minimumConsecutiveZeroFindingPasses: number;
  distinctExecutionSystemContextIdsRequired: boolean;
  spawnReturnedIdRequired: boolean;
  invalidIdentityValues: string[];
  artifactDirectory: string;
  artifactFileNamePattern: string;
  strictTypeAndPathBoundaryPartitionRequired: boolean;
  realEntryPointRequired: boolean;
  formalAuthority: boolean;
}

/**
 * Validate the planner-owned `advisoryReviewContract` shape (05R7B.4).
 * Advisory credit requires consecutive zero-finding passes with distinct
 * spawn-returned execution-system IDs; the policy must declare exactly
 * that, otherwise the gate fails closed with
 * ADVISORY_REVIEW_CONTRACT_MISMATCH.
 */
export function assertAdvisoryReviewContractShape(contract: unknown): AdvisoryReviewContract {
  const fail = (detail: string): never => {
    throw new Error(`ADVISORY_REVIEW_CONTRACT_MISMATCH: advisoryReviewContract ${detail}`);
  };
  const holder = (contract as { advisoryReviewContract?: unknown } | null | undefined)?.advisoryReviewContract;
  if (!holder || typeof holder !== 'object') fail('is absent; an advisory identity contract is required by this prompt');
  const rec = holder as Record<string, unknown>;
  const passes = rec['minimumConsecutiveZeroFindingPasses'];
  if (typeof passes !== 'number' || !Number.isFinite(passes) || !Number.isInteger(passes) || (passes as number) < 2) {
    fail('minimumConsecutiveZeroFindingPasses must be a finite integer >= 2');
  }
  for (const flag of [
    'distinctExecutionSystemContextIdsRequired',
    'spawnReturnedIdRequired',
    'strictTypeAndPathBoundaryPartitionRequired',
    'realEntryPointRequired',
  ]) {
    if (rec[flag] !== true) fail(`"${flag}" is not true`);
  }
  if (rec['formalAuthority'] !== false) fail('"formalAuthority" is not false; advisory reviews are never authoritative');
  const invalid = rec['invalidIdentityValues'];
  if (!Array.isArray(invalid) || invalid.length === 0 || !(invalid as unknown[]).every((v) => typeof v === 'string')) {
    fail('invalidIdentityValues must be a non-empty string list');
  }
  const dir = rec['artifactDirectory'];
  if (typeof dir !== 'string' || dir.trim().length === 0) fail('artifactDirectory must be a non-empty path');
  const pattern = rec['artifactFileNamePattern'];
  if (typeof pattern !== 'string' || pattern.trim().length === 0) fail('artifactFileNamePattern must be a non-empty pattern');
  try {
    new RegExp(pattern as string);
  } catch {
    fail('artifactFileNamePattern is not a valid RegExp');
  }
  return {
    minimumConsecutiveZeroFindingPasses: passes as number,
    distinctExecutionSystemContextIdsRequired: true,
    spawnReturnedIdRequired: true,
    invalidIdentityValues: (invalid as string[]).map((v) => v),
    artifactDirectory: String(dir).replace(/\\/g, '/').trim(),
    artifactFileNamePattern: String(pattern),
    strictTypeAndPathBoundaryPartitionRequired: true,
    realEntryPointRequired: true,
    formalAuthority: false,
  };
}

export interface AdvisoryReviewArtifact {
  fileName: string;
  reviewerContextId: unknown;
  zeroFix: unknown;
  mentionsEntryPoint: boolean;
}

/**
 * Advisory streak validation (05R7B.4). Credit requires the last
 * `minimumConsecutiveZeroFindingPasses` consecutive artifacts (by iteration
 * number) to each carry `zeroFix: true`, name the exact validator entry
 * point, and repeat verbatim — as `reviewerContextId` — one of the
 * executor-recorded spawn-returned IDs, with all IDs in the window
 * distinct. Blank, alias-only, `none exposed`, invalid-listed, identical,
 * or ledger-mismatched IDs fail with ADVISORY_REVIEW_IDENTITY_INVALID and
 * can never satisfy the task or streak. The executor must record the
 * spawn-returned ID immediately; typed aliases, filenames, personas, or
 * phrases such as `none exposed` are not identifiers.
 */
export function assertAdvisoryStreak(input: {
  artifacts: AdvisoryReviewArtifact[];
  spawnReturnedIds: string[];
  policy: AdvisoryReviewContract;
}): void {
  const fail = (detail: string): never => {
    throw new Error(`ADVISORY_REVIEW_IDENTITY_INVALID: ${detail}`);
  };
  const required = input.policy.minimumConsecutiveZeroFindingPasses;
  const sorted = [...(input.artifacts ?? [])].sort((a, b) => {
    const iter = (name: string) => {
      const m = String(name).match(/iter(\d+)/i);
      return m ? Number(m[1]) : Number.MAX_SAFE_INTEGER;
    };
    return iter(a.fileName) - iter(b.fileName) || String(a.fileName).localeCompare(String(b.fileName));
  });
  if (sorted.length < required) {
    fail(`only ${sorted.length} advisory artifact(s) match the planner pattern; ${required} consecutive zero-finding passes are required`);
  }
  const window = sorted.slice(-required);
  const iters = window.map((a) => {
    const m = String(a.fileName).match(/iter(\d+)/i);
    return m ? Number(m[1]) : null;
  });
  for (let i = 1; i < iters.length; i++) {
    if (iters[i - 1] === null || iters[i] === null || (iters[i] as number) !== (iters[i - 1] as number) + 1) {
      fail(`advisory artifacts are not consecutive iterations: [${window.map((a) => a.fileName).join(', ')}]`);
    }
  }
  const invalid = new Set(input.policy.invalidIdentityValues.map((v) => v.trim().toLowerCase()));
  const spawn = new Set((input.spawnReturnedIds ?? []).map((v) => String(v ?? '').trim()).filter((v) => v.length > 0));
  const seen: string[] = [];
  for (const artifact of window) {
    const raw = artifact.reviewerContextId;
    const id = typeof raw === 'string' ? raw.trim() : '';
    if (id.length === 0 || invalid.has(id.toLowerCase())) {
      fail(`"${artifact.fileName}" carries no genuine execution-system reviewer ID (got "${String(raw ?? '')}".substring(0, 80)); aliases, filenames, personas, missing IDs, and "none exposed" never receive credit`);
    }
    if (!spawn.has(id)) {
      fail(`"${artifact.fileName}" reviewer ID does not repeat verbatim any executor-recorded spawn-returned ID; artifact/ledger mismatch cannot satisfy the streak`);
    }
    if (seen.includes(id)) {
      fail(`advisory reviewer IDs are not distinct across the consecutive window (duplicate "${id}"); a later pass must use a different execution-system context`);
    }
    seen.push(id);
    if (artifact.zeroFix !== true) {
      fail(`"${artifact.fileName}" is not a zero-finding pass (zeroFix !== true); any fix resets the consecutive count`);
    }
    if (input.policy.realEntryPointRequired && !artifact.mentionsEntryPoint) {
      fail(`"${artifact.fileName}" does not name the exact validator entry point; real-entry-point review is required`);
    }
  }
}

// ─── 05R7C: honest advisory trace provenance (pure, zero I/O) ───
//
// Repository text proves trace consistency only. Matching parent-recorded
// relayed IDs and reviewer Markdown proves the relay was recorded
// consistently; it does not prove execution-system issuance and never
// establishes formal review, receipt, unlock, approval, or mutation
// authority. Formal acceptance remains solely the planner-pinned receipt
// path. Messages below deliberately avoid calling repository agreement
// genuine, issued, independent, or authoritative.

export interface AdvisoryTraceContract {
  authorityLevel: string;
  repositoryTextProvesIssuance: boolean;
  parentMustRelaySpawnReturnedId: boolean;
  childSelfIntrospectionRequired: boolean;
  minimumConsecutiveZeroFindingPasses: number;
  distinctRelayedIdsRequired: boolean;
  artifactLedgerAgreementRequired: boolean;
  realEntryPointRequired: boolean;
  formalAuthority: boolean;
  formalReviewSeparate: boolean;
  artifactDirectory: string;
  artifactFileNamePattern: string;
}

/**
 * Validate the planner-owned `advisoryTraceContract` shape (05R7C.2).
 * Trace evidence is explicitly trace-only; repository text never proves
 * system-level provenance. Anything weaker fails closed with
 * ADVISORY_TRACE_CONTRACT_MISMATCH.
 */
export function assertAdvisoryTraceContractShape(contract: unknown): AdvisoryTraceContract {
  const fail = (detail: string): never => {
    throw new Error(`ADVISORY_TRACE_CONTRACT_MISMATCH: advisoryTraceContract ${detail}`);
  };
  const holder = (contract as { advisoryTraceContract?: unknown } | null | undefined)?.advisoryTraceContract;
  if (!holder || typeof holder !== 'object') fail('is absent; an advisory trace contract is required by this prompt');
  const rec = holder as Record<string, unknown>;
  if (rec['authorityLevel'] !== 'trace-only') fail('authorityLevel is not "trace-only"; advisory evidence is trace-only');
  if (rec['repositoryTextProvesIssuance'] !== false) fail('repositoryTextProvesIssuance is not false; repository text proves trace consistency only');
  if (rec['parentMustRelaySpawnReturnedId'] !== true) fail('parentMustRelaySpawnReturnedId is not true');
  if (rec['childSelfIntrospectionRequired'] !== false) fail('childSelfIntrospectionRequired is not false; the parent relays the ID to the child');
  const passes = rec['minimumConsecutiveZeroFindingPasses'];
  if (typeof passes !== 'number' || !Number.isFinite(passes) || !Number.isInteger(passes) || (passes as number) < 2) {
    fail('minimumConsecutiveZeroFindingPasses must be a finite integer >= 2');
  }
  if (rec['distinctRelayedIdsRequired'] !== true) fail('distinctRelayedIdsRequired is not true');
  if (rec['artifactLedgerAgreementRequired'] !== true) fail('artifactLedgerAgreementRequired is not true');
  if (rec['realEntryPointRequired'] !== true) fail('realEntryPointRequired is not true');
  if (rec['formalAuthority'] !== false) fail('formalAuthority is not false; advisory trace never establishes formal authority');
  if (rec['formalReviewSeparate'] !== true) fail('formalReviewSeparate is not true; formal review remains a separate planner path');
  const dir = rec['artifactDirectory'];
  if (typeof dir !== 'string' || dir.trim().length === 0) fail('artifactDirectory must be a non-empty path');
  const pattern = rec['artifactFileNamePattern'];
  if (typeof pattern !== 'string' || pattern.trim().length === 0) fail('artifactFileNamePattern must be a non-empty pattern');
  try {
    new RegExp(pattern as string);
  } catch {
    fail('artifactFileNamePattern is not a valid RegExp');
  }
  return {
    authorityLevel: 'trace-only',
    repositoryTextProvesIssuance: false,
    parentMustRelaySpawnReturnedId: true,
    childSelfIntrospectionRequired: false,
    minimumConsecutiveZeroFindingPasses: passes as number,
    distinctRelayedIdsRequired: true,
    artifactLedgerAgreementRequired: true,
    realEntryPointRequired: true,
    formalAuthority: false,
    formalReviewSeparate: true,
    artifactDirectory: String(dir).replace(/\\/g, '/').trim(),
    artifactFileNamePattern: String(pattern),
  };
}

export interface AdvisoryTraceArtifact {
  fileName: string;
  reviewerContextId: unknown;
  zeroFix: unknown;
  mentionsEntryPoint: boolean;
}

/**
 * Advisory trace-consistency validation (05R7C.2–.3). Confirms the last N
 * consecutive artifacts each carry zeroFix true, name the exact validator
 * entry point, and repeat verbatim — as reviewerContextId — one of the
 * parent-recorded relayed IDs, with all IDs in the window distinct. Blank,
 * none-exposed, identical, non-zero-fix, or ledger-mismatched entries fail
 * with ADVISORY_TRACE_INVALID. A passing trace proves trace consistency
 * only; it never proves system-level provenance and never satisfies formal
 * review, receipt, unlock, approval, or mutation authority.
 */
export function assertAdvisoryTraceStreak(input: {
  artifacts: AdvisoryTraceArtifact[];
  relayedIds: string[];
  policy: AdvisoryTraceContract;
}): void {
  const fail = (detail: string): never => {
    throw new Error(`ADVISORY_TRACE_INVALID: ${detail}`);
  };
  const required = input.policy.minimumConsecutiveZeroFindingPasses;
  const sorted = [...(input.artifacts ?? [])].sort((a, b) => {
    const iter = (name: string) => {
      const m = String(name).match(/iter(\d+)/i);
      return m ? Number(m[1]) : Number.MAX_SAFE_INTEGER;
    };
    return iter(a.fileName) - iter(b.fileName) || String(a.fileName).localeCompare(String(b.fileName));
  });
  if (sorted.length < required) {
    fail(`only ${sorted.length} advisory trace artifact(s) match the planner pattern; ${required} consecutive zero-finding trace passes are required for trace consistency`);
  }
  const window = sorted.slice(-required);
  const iters = window.map((a) => {
    const m = String(a.fileName).match(/iter(\d+)/i);
    return m ? Number(m[1]) : null;
  });
  for (let i = 1; i < iters.length; i++) {
    if (iters[i - 1] === null || iters[i] === null || (iters[i] as number) !== (iters[i - 1] as number) + 1) {
      fail(`advisory trace artifacts are not consecutive iterations: [${window.map((a) => a.fileName).join(', ')}]`);
    }
  }
  const relayed = new Set((input.relayedIds ?? []).map((v) => String(v ?? '').trim()).filter((v) => v.length > 0));
  const seen: string[] = [];
  for (const artifact of window) {
    const raw = artifact.reviewerContextId;
    const id = typeof raw === 'string' ? raw.trim() : '';
    if (id.length === 0 || id.toLowerCase() === 'none exposed' || id.toLowerCase() === 'none') {
      fail(`"${artifact.fileName}" carries no parent-relayed trace ID (got "${String(raw ?? '').slice(0, 80)}"); missing IDs never establish trace consistency`);
    }
    if (input.policy.artifactLedgerAgreementRequired && !relayed.has(id)) {
      fail(`"${artifact.fileName}" trace ID does not repeat verbatim any parent-recorded relayed ID; trace/ledger mismatch cannot establish trace consistency`);
    }
    if (input.policy.distinctRelayedIdsRequired && seen.includes(id)) {
      fail(`advisory trace IDs are not distinct across the consecutive window (duplicate "${id}"); a later trace pass must use a different parent-relayed ID`);
    }
    seen.push(id);
    if (artifact.zeroFix !== true) {
      fail(`"${artifact.fileName}" is not a zero-finding trace pass (zeroFix !== true); any fix resets the consecutive trace count`);
    }
    if (input.policy.realEntryPointRequired && !artifact.mentionsEntryPoint) {
      fail(`"${artifact.fileName}" does not name the exact validator entry point; real-entry-point trace review is required`);
    }
  }
}
