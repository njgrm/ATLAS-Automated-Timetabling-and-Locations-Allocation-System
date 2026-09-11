/**
 * TT-C02 client-side helpers for the /timetable unassigned-insertion workflow.
 *
 * The server owns blocker language (message/prerequisite/primaryAction). This
 * module only derives display grouping and deterministic ordering from the
 * server summary so the UI stays a thin presenter and tests can pin the
 * grouping contract hermetically.
 */

export type InsertionReason =
  | 'MISSING_TEACHING_LOAD_OWNER'
  | 'OWNER_INACTIVE_OR_STALE'
  | 'OWNER_OUTSIDE_SCOPE'
  | 'NO_QUALIFIED_OWNER'
  | 'NO_AVAILABLE_SLOT'
  | 'NO_COMPATIBLE_ROOM'
  | 'HARD_CONFLICT'
  | 'TERM_APPLICABILITY_MISMATCH'
  | 'SOURCE_STALE'
  | 'HG_FORBIDDEN'
  | 'INDIVIDUALLY_PREVIEWABLE';

export interface InsertionGuidance {
  reason: InsertionReason;
  action: string;
  message: string;
  prerequisite: string;
  primaryAction: string;
}

export interface InsertionReadinessLine {
  demandKey: string;
  subjectCode: string;
  subjectName: string;
  sectionName: string;
  gradeLevel: number;
  programType: string;
  termIdentity: string;
  termIndex: number;
  sessionsPerWeek: number;
  ownerFacultyName: string | null;
  state: InsertionReason;
  guidance: InsertionGuidance;
}

export interface InsertionReadinessSummary {
  scope: { schoolId: number; schoolYearId: number };
  demand: { totalLines: number; totalSessions: number; totalsByTerm: Record<string, number> };
  breakdown: Record<string, number>;
  insertionReadyLines: number;
  unresolvedLines: number;
  lineStates: InsertionReadinessLine[];
  liveGenerationRunCount: number;
}

export interface ReadinessGroup {
  reason: InsertionReason;
  count: number;
  guidance: InsertionGuidance | null;
  samples: InsertionReadinessLine[];
}

const REASON_ORDER: InsertionReason[] = [
  'HG_FORBIDDEN',
  'SOURCE_STALE',
  'MISSING_TEACHING_LOAD_OWNER',
  'OWNER_INACTIVE_OR_STALE',
  'OWNER_OUTSIDE_SCOPE',
  'NO_QUALIFIED_OWNER',
  'TERM_APPLICABILITY_MISMATCH',
  'NO_COMPATIBLE_ROOM',
  'NO_AVAILABLE_SLOT',
  'HARD_CONFLICT',
];

/**
 * Homeroom Guidance detection shared by the timetable demand surfaces.
 * Matches the Teaching Load exclusion contract (`HG` code or a
 * homeroom-named subject) so HG can never read as placeable demand.
 */
export function isHomeroomGuidanceCode(subjectCode: string | null | undefined): boolean {
  if (!subjectCode) return false;
  const normalized = subjectCode.trim().toUpperCase();
  return normalized === 'HG' || normalized.includes('HOMEROOM');
}

/**
 * Deterministically group the server readiness summary into reason groups,
 * ordered so authority/owner problems surface before slot/room/conflict
 * problems, with HG (if ever present) first as a hard stop.
 */
export function groupInsertionReadiness(summary: InsertionReadinessSummary): ReadinessGroup[] {
  const byReason = new Map<InsertionReason, InsertionReadinessLine[]>();
  for (const line of summary.lineStates) {
    const list = byReason.get(line.state) ?? [];
    list.push(line);
    byReason.set(line.state, list);
  }
  const orderedReasons = [...REASON_ORDER];
  for (const reason of orderedReasons) {
    void reason;
  }
  const reasons = new Set<InsertionReason>([...REASON_ORDER, 'INDIVIDUALLY_PREVIEWABLE']);
  const groups: ReadinessGroup[] = [];
  for (const reason of reasons) {
    const lines = byReason.get(reason) ?? [];
    if (lines.length === 0) continue;
    const sample = lines[0];
    groups.push({
      reason,
      count: lines.length,
      guidance: sample.guidance ?? null,
      samples: lines,
    });
  }
  return groups;
}

export interface InsertionPreviewCandidate {
  day: string;
  startTime: string;
  endTime: string;
  roomId: number;
  roomName: string;
}

export interface InsertionPreview {
  demandKey: string;
  state: InsertionReason;
  candidates: InsertionPreviewCandidate[];
  fingerprint: string;
  zeroWrite: boolean;
}

export function placementSaveAvailability(input: {
  state: InsertionReason;
  hasCandidates: boolean;
  allowApply: boolean;
  subjectCode?: string | null;
}): { canSave: boolean; label: string; detail: string } {
  // Homeroom Guidance is never timetable demand or teaching load. Even if a
  // line ever arrives mislabeled as previewable, the client must refuse to
  // present it as placeable and must point at the Subject catalog.
  if (isHomeroomGuidanceCode(input.subjectCode)) {
    return {
      canSave: false,
      label: 'Save blocked',
      detail: 'Homeroom Guidance is never timetable demand. Set its disposition to Reference only in Subjects instead of placing it.',
    };
  }
  if (input.state !== 'INDIVIDUALLY_PREVIEWABLE') {
    return { canSave: false, label: 'Save blocked', detail: 'Resolve the blocker above before saving.' };
  }
  if (!input.hasCandidates) {
    return { canSave: false, label: 'No candidate slot', detail: 'Re-preview to refresh candidate slots.' };
  }
  if (!input.allowApply) {
    return {
      canSave: false,
      label: 'Save placement (preview only)',
      detail: 'TT-C02 is preview-only. No production apply endpoint is mounted and this action cannot write timetable data.',
    };
  }
  return {
    canSave: true,
    label: 'Save placement',
    detail: 'Places this session into the pre-generation draft workspace.',
  };
}
