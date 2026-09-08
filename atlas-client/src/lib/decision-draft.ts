/**
 * SCA-03E-R — pure decision-draft helpers for the operator decision workspace.
 *
 * The draft is client-side only: it never writes offerings, terms, Teaching
 * Load, or runs. Every candidate defaults to UNDECIDED and UNCLASSIFIED —
 * nothing is pre-approved, locked, classified, or pre-resolved by code.
 * Prior operator choices re-enter ONLY through an explicit restore/import
 * action that is schema/scope/source-revision validated, stays a visible
 * draft, and performs zero writes.
 *
 * Kept free of React so the state machine is unit-testable.
 */

export interface WorkspaceCandidateGroup {
  groupKey: string;
  gradeLevel: number;
  programType: string;
  subjectId: number;
  subjectCode: string;
  subjectName: string;
  weeklyMinutes: number;
  catalogRotationFamily: string | null;
  affectedScopeKeys: string[];
  affectedSections: Array<{ mirrorId: number; externalId: number; name: string }>;
  sectionCount: number;
  demandMinutesPerWeek: number;
  demandDerivation: string;
  currentOwnershipEvidence: {
    evidenceStatus: 'SUGGESTION_ONLY';
    ownershipIds: number[];
    facultyIds: number[];
  };
  decisionStatus: 'UNAPPROVED_SUGGESTION';
  termMode: 'ALL';
  termModeStatus: 'UNAPPROVED_SUGGESTION';
  unresolvedFields: string[];
}

export type DraftDecision = 'UNDECIDED' | 'CONFIRMED' | 'REJECTED';

export type DraftClassification = 'CORE' | 'SPECIALIZATION' | 'EXPLORATORY' | 'OTHER';

export const DRAFT_CLASSIFICATIONS: DraftClassification[] = ['CORE', 'SPECIALIZATION', 'EXPLORATORY', 'OTHER'];

export type DraftTermMode = 'ALL' | 'SINGLE' | 'ROTATING';

export interface DraftRowState {
  decision: DraftDecision;
  /** Null until the operator picks one explicitly — never defaulted. */
  classification: DraftClassification | null;
  termMode: DraftTermMode;
  rotationFamily: string;
  rotationOrder: string;
  rotationTerm: string;
}

export interface TermDraft {
  /** Operator-entered term count text; empty means unconfigured. */
  countText: string;
  /** Operator-entered comma-separated identities; empty means unconfigured. */
  identitiesText: string;
}

/** Source-evidence revision binding for a draft. */
export interface DraftSourceRevision {
  activeSubjectCount: number;
  activeSectionCount: number;
  annualOwnershipCount: number;
  activeRequirementCount: number;
  subjectsUpdatedAtMax: string | null;
  ownershipsUpdatedAtMax: string | null;
}

export type DraftState = Record<string, DraftRowState>;

export function defaultRowForGroup(_group: WorkspaceCandidateGroup): DraftRowState {
  // SCA-03E-R.1: every reconstructed group defaults to UNDECIDED + unclassified.
  // No subject code/grade/program combination is ever pre-resolved from code.
  return {
    decision: 'UNDECIDED',
    classification: null,
    termMode: 'ALL',
    rotationFamily: '',
    rotationOrder: '',
    rotationTerm: '',
  };
}

export function buildDraftFromGroups(groups: WorkspaceCandidateGroup[]): DraftState {
  const draft: DraftState = {};
  for (const group of groups) draft[group.groupKey] = defaultRowForGroup(group);
  return draft;
}

/** Parse the operator-entered draft terms. Empty/invalid → unconfigured. */
export function parseDraftTerms(term: TermDraft): { count: number; identities: string[] } | null {
  const count = Number(term.countText.trim());
  const identities = term.identitiesText.split(',').map((s) => s.trim()).filter(Boolean);
  if (!Number.isInteger(count) || count < 1) return null;
  if (identities.length === 0) return null;
  // Count and identities must agree; a mismatch is unconfigured, never coerced.
  if (identities.length !== count) return null;
  if (new Set(identities).size !== identities.length) return null;
  return { count, identities };
}

export interface DraftOffering {
  subjectId: number;
  gradeLevel: number;
  programType: string;
  sectionMirrorId: null;
  cohortId: null;
  classification: DraftClassification;
  weeklyMinutes: number;
  rotationFamily: string | null;
  rotationOrder: number | null;
  termMode: 'ALL' | 'ROTATING_FAMILY_MEMBER';
  termIdentities: string[];
}

export interface DraftCompileResult {
  offerings: DraftOffering[];
  /** Group keys rejected or undecided (held out of the preview). */
  heldOut: string[];
  errors: Array<{ groupKey: string; message: string }>;
}

/**
 * Compile confirmed draft rows into preview-ready offerings. Rejected and
 * undecided rows never enter the offering set. Rotation is validated
 * against operator-entered draft terms only.
 */
export function compileDraftOfferings(
  groups: WorkspaceCandidateGroup[],
  draft: DraftState,
  term: TermDraft,
): DraftCompileResult {
  const draftTerms = parseDraftTerms(term);
  const offerings: DraftOffering[] = [];
  const heldOut: string[] = [];
  const errors: Array<{ groupKey: string; message: string }> = [];

  for (const group of groups) {
    const row = draft[group.groupKey];
    if (!row || row.decision !== 'CONFIRMED') {
      heldOut.push(group.groupKey);
      continue;
    }
    if (!row.classification) {
      errors.push({ groupKey: group.groupKey, message: 'Choose a classification before preview.' });
      continue;
    }
    if (row.termMode === 'ALL') {
      offerings.push({
        subjectId: group.subjectId,
        gradeLevel: group.gradeLevel,
        programType: group.programType,
        sectionMirrorId: null,
        cohortId: null,
        classification: row.classification,
        weeklyMinutes: group.weeklyMinutes,
        rotationFamily: null,
        rotationOrder: null,
        termMode: 'ALL',
        termIdentities: [],
      });
      continue;
    }
    // SINGLE and ROTATING both require operator-configured draft terms.
    if (!draftTerms) {
      errors.push({
        groupKey: group.groupKey,
        message: `${row.termMode === 'SINGLE' ? 'Single-term' : 'Rotating'} rows need configured draft terms first.`,
      });
      continue;
    }
    if (!draftTerms.identities.includes(row.rotationTerm)) {
      errors.push({
        groupKey: group.groupKey,
        message: `Term "${row.rotationTerm || '—'}" is not a configured draft term (${draftTerms.identities.join(', ')}).`,
      });
      continue;
    }
    if (row.termMode === 'SINGLE') {
      offerings.push({
        subjectId: group.subjectId,
        gradeLevel: group.gradeLevel,
        programType: group.programType,
        sectionMirrorId: null,
        cohortId: null,
        classification: row.classification,
        weeklyMinutes: group.weeklyMinutes,
        rotationFamily: null,
        rotationOrder: null,
        termMode: 'ALL',
        termIdentities: [row.rotationTerm],
      });
      continue;
    }
    // ROTATING: family + order + exactly one configured term, all explicit.
    if (row.rotationFamily.trim().length === 0) {
      errors.push({ groupKey: group.groupKey, message: 'Rotating rows need an explicit rotation family.' });
      continue;
    }
    const order = Number(row.rotationOrder);
    if (!Number.isInteger(order) || order < 1 || order > draftTerms.count) {
      errors.push({ groupKey: group.groupKey, message: `Rotation order must be an integer from 1 to ${draftTerms.count}.` });
      continue;
    }
    offerings.push({
      subjectId: group.subjectId,
      gradeLevel: group.gradeLevel,
      programType: group.programType,
      sectionMirrorId: null,
      cohortId: null,
      classification: row.classification,
      weeklyMinutes: group.weeklyMinutes,
      rotationFamily: row.rotationFamily.trim(),
      rotationOrder: order,
      termMode: 'ROTATING_FAMILY_MEMBER',
      termIdentities: [row.rotationTerm],
    });
  }

  return { offerings, heldOut, errors };
}

export interface SerializedDraft {
  format: 'atlas-curriculum-decision-draft';
  version: 3;
  schoolId: number;
  schoolYearId: number;
  /** Canonical semantic source-revision hash this draft was built against. */
  sourceRevisionHash: string;
  exportedAt: string;
  termDraft: TermDraft;
  rows: Record<string, DraftRowState>;
}

const DRAFT_DECISIONS: DraftDecision[] = ['UNDECIDED', 'CONFIRMED', 'REJECTED'];
const DRAFT_TERM_MODES: DraftTermMode[] = ['ALL', 'SINGLE', 'ROTATING'];

const ENVELOPE_KEYS = new Set(['format', 'version', 'schoolId', 'schoolYearId', 'sourceRevisionHash', 'exportedAt', 'termDraft', 'rows']);
const TERM_DRAFT_KEYS = new Set(['countText', 'identitiesText']);
const ROW_KEYS = new Set(['decision', 'classification', 'termMode', 'rotationFamily', 'rotationOrder', 'rotationTerm']);

/**
 * Decode JSON string escapes so raw-equivalent keys (e.g. "schoolId" and
 * "\u0073choolId") compare as equal. Handles the standard escape set plus
 * \uXXXX code points.
 */
export function decodeJsonString(raw: string): string {
  let out = '';
  let i = 0;
  while (i < raw.length) {
    const ch = raw[i];
    if (ch === '\\' && i + 1 < raw.length) {
      const next = raw[i + 1];
      if (next === 'u') {
        const hex = raw.slice(i + 2, i + 6);
        if (/^[0-9a-fA-F]{4}$/.test(hex)) {
          out += String.fromCharCode(parseInt(hex, 16));
          i += 6;
          continue;
        }
      }
      switch (next) {
        case '"': out += '"'; break;
        case '\\': out += '\\'; break;
        case '/': out += '/'; break;
        case 'b': out += '\b'; break;
        case 'f': out += '\f'; break;
        case 'n': out += '\n'; break;
        case 'r': out += '\r'; break;
        case 't': out += '\t'; break;
        default: out += next;
      }
      i += 2;
      continue;
    }
    out += ch;
    i += 1;
  }
  return out;
}

/**
 * Detect a duplicate member key anywhere in a JSON document, per object,
 * BEFORE JSON.parse. A string token followed by `:` is a key of the innermost
 * open object; key-looking text inside string values is never a key because a
 * value string is never followed by `:`. Keys are compared after decoding
 * JSON escapes, so raw-equivalent duplicates such as "schoolId" and
 * "\u0073choolId" are rejected. Returns the first duplicated key, or null.
 */
export function findFirstDuplicateJsonKey(text: string): string | null {
  const objectKeys: Array<Set<string>> = [];
  let i = 0;
  const n = text.length;
  while (i < n) {
    const ch = text[i];
    if (ch === '"') {
      let j = i + 1;
      let s = '';
      while (j < n) {
        const c = text[j];
        if (c === '\\') { s += c + (text[j + 1] ?? ''); j += 2; continue; }
        if (c === '"') { j += 1; break; }
        s += c; j += 1;
      }
      let k = j;
      while (k < n && (text[k] === ' ' || text[k] === '\t' || text[k] === '\n' || text[k] === '\r')) k += 1;
      if (text[k] === ':' && objectKeys.length > 0) {
        const key = decodeJsonString(s);
        const set = objectKeys[objectKeys.length - 1];
        if (set.has(key)) return key;
        set.add(key);
      }
      i = j;
      continue;
    }
    if (ch === '{') { objectKeys.push(new Set()); i += 1; continue; }
    if (ch === '}') { if (objectKeys.length > 0) objectKeys.pop(); i += 1; continue; }
    if (ch === '\\') { i += 2; continue; }
    i += 1;
  }
  return null;
}

/** Validate a plain object member against an exact allowed-key set. */
function assertOnlyKeys(what: string, value: unknown, allowed: Set<string>): asserts value is Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error(`${what} is malformed; restore rejected.`);
  }
  const rec = value as Record<string, unknown>;
  const unknown = Object.keys(rec).filter((k) => !allowed.has(k));
  if (unknown.length > 0) {
    throw new Error(`${what} contains unknown field(s): ${unknown.join(', ')}; restore rejected.`);
  }
}

/**
 * Strict fail-closed restore over raw file text. Rejects duplicate JSON keys
 * before parsing, then validates the whole document (schema/scope/hash/term/
 * rows) BEFORE applying anything. Any anomaly throws a visible error and the
 * current UI draft is left unchanged.
 */
export function restoreDraftText(
  text: string,
  groups: WorkspaceCandidateGroup[],
  context: { schoolId: number; schoolYearId: number; sourceRevisionHash: string },
): { draft: DraftState; term: TermDraft } {
  const duplicate = findFirstDuplicateJsonKey(text);
  if (duplicate !== null) {
    throw new Error(`Draft file contains a duplicate key "${duplicate}"; restore rejected.`);
  }
  let raw: unknown;
  try {
    raw = JSON.parse(text) as unknown;
  } catch {
    throw new Error('Draft file is not valid JSON.');
  }
  return restoreDraft(raw, groups, context);
}

/** Strict restore: unknown fields, wrong scope, or a stale source-revision hash reject. */
export function restoreDraft(
  raw: unknown,
  groups: WorkspaceCandidateGroup[],
  context: { schoolId: number; schoolYearId: number; sourceRevisionHash: string },
): { draft: DraftState; term: TermDraft } {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    throw new Error('Draft file must be a JSON object.');
  }
  const doc = raw as Record<string, unknown>;
  assertOnlyKeys('Draft envelope', doc, ENVELOPE_KEYS);
  if (doc.format !== 'atlas-curriculum-decision-draft' || doc.version !== 3) {
    throw new Error('Unrecognized draft format or version.');
  }
  if (doc.schoolId !== context.schoolId) {
    throw new Error(`Draft belongs to school ${String(doc.schoolId)}; this workspace is school ${context.schoolId}.`);
  }
  if (doc.schoolYearId !== context.schoolYearId) {
    throw new Error(`Draft targets school year ${String(doc.schoolYearId)}; this workspace is year ${context.schoolYearId}.`);
  }
  const draftHash = doc.sourceRevisionHash;
  if (typeof draftHash !== 'string' || !/^[0-9A-Fa-f]{64}$/.test(draftHash)) {
    throw new Error('Draft source-revision hash must be exactly 64 hexadecimal characters; restore rejected.');
  }
  if (draftHash !== context.sourceRevisionHash) {
    throw new Error('Draft was built from different source evidence (stale source revision). Reload candidates and re-export, or restore against the matching data set.');
  }
  if (typeof doc.exportedAt !== 'string') {
    throw new Error('Draft export timestamp is malformed; restore rejected.');
  }
  const termRaw = doc.termDraft as Record<string, unknown> | undefined;
  assertOnlyKeys('Draft term configuration', termRaw, TERM_DRAFT_KEYS);
  if (typeof termRaw.countText !== 'string' || typeof termRaw.identitiesText !== 'string') {
    throw new Error('Draft term configuration is malformed.');
  }
  const rowsRaw = doc.rows as Record<string, unknown> | undefined;
  assertOnlyKeys('Draft rows', rowsRaw, new Set(groups.map((g) => g.groupKey)));
  const savedKeys = new Set(Object.keys(rowsRaw));
  for (const g of groups) {
    if (!savedKeys.has(g.groupKey)) {
      throw new Error(`Draft is missing candidate row "${g.groupKey}"; the saved row set must exactly equal the current candidate set; restore rejected.`);
    }
  }
  const known = new Map(groups.map((g) => [g.groupKey, g]));
  const draft = buildDraftFromGroups(groups);
  for (const [key, value] of Object.entries(rowsRaw)) {
    if (!known.has(key)) {
      throw new Error(`Draft row "${key}" does not exist in the current candidate set; restore rejected.`);
    }
    const row = value as Record<string, unknown>;
    assertOnlyKeys(`Draft row "${key}"`, row, ROW_KEYS);
    if (!DRAFT_DECISIONS.includes(row.decision as DraftDecision)) {
      throw new Error(`Draft row "${key}" has an unknown decision; restore rejected.`);
    }
    if (row.classification !== null && !DRAFT_CLASSIFICATIONS.includes(row.classification as DraftClassification)) {
      throw new Error(`Draft row "${key}" has an unknown classification; restore rejected.`);
    }
    if (!DRAFT_TERM_MODES.includes(row.termMode as DraftTermMode)) {
      throw new Error(`Draft row "${key}" has an unknown term mode; restore rejected.`);
    }
    if (typeof row.rotationFamily !== 'string' || typeof row.rotationOrder !== 'string' || typeof row.rotationTerm !== 'string') {
      throw new Error(`Draft row "${key}" has malformed rotation fields; restore rejected.`);
    }
    draft[key] = {
      decision: row.decision as DraftDecision,
      classification: row.classification as DraftClassification | null,
      termMode: row.termMode as DraftTermMode,
      rotationFamily: row.rotationFamily as string,
      rotationOrder: row.rotationOrder as string,
      rotationTerm: row.rotationTerm as string,
    };
  }
  return {
    draft,
    term: { countText: termRaw.countText, identitiesText: termRaw.identitiesText },
  };
}

export function serializeDraft(
  schoolId: number,
  schoolYearId: number,
  sourceRevisionHash: string,
  term: TermDraft,
  draft: DraftState,
): SerializedDraft {
  return {
    format: 'atlas-curriculum-decision-draft',
    version: 3,
    schoolId,
    schoolYearId,
    sourceRevisionHash,
    exportedAt: new Date().toISOString(),
    termDraft: { ...term },
    rows: JSON.parse(JSON.stringify(draft)) as Record<string, DraftRowState>,
  };
}

/**
 * Bulk-apply one decision to selected rows. Applies to EVERY selected row —
 * no row is skipped because of a code-derived lock. Skipped rows (selected
 * keys absent from the draft/group set) are returned so the caller can
 * surface them; nothing is skipped silently.
 */
export function applyBulkDecision(
  draft: DraftState,
  groups: WorkspaceCandidateGroup[],
  selected: Set<string>,
  decision: DraftDecision,
  classification: DraftClassification | null,
): { draft: DraftState; applied: string[]; skipped: string[] } {
  const next: DraftState = { ...draft };
  const byKey = new Map(groups.map((g) => [g.groupKey, g]));
  const applied: string[] = [];
  const skipped: string[] = [];
  for (const key of selected) {
    const group = byKey.get(key);
    const row = next[key];
    if (!group || !row) {
      skipped.push(key);
      continue;
    }
    next[key] = {
      ...row,
      decision,
      classification: decision === 'CONFIRMED' && classification ? classification : row.classification,
    };
    applied.push(key);
  }
  return { draft: next, applied, skipped };
}
