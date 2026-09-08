import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, Loader2, RefreshCw } from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import { toast } from 'sonner';
import atlasApi from '@/lib/api';
import { resolveActiveSchoolYearContext } from '@/lib/enrollpro-public-settings';
import { resolveActorSchoolId } from '@/lib/settings';
import { resolveCurriculumYearScope } from '@/lib/curriculum-scope-states';
import { Button } from '@/ui/button';
import { Skeleton } from '@/ui/skeleton';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/ui/tooltip';
import {
  applyBulkDecision,
  buildDraftFromGroups,
  type DraftClassification,
  type DraftDecision,
  type DraftRowState,
  type DraftSourceRevision,
  type DraftState,
  type TermDraft,
  type WorkspaceCandidateGroup,
} from '@/lib/decision-draft';
import TermDraftEditor from '@/components/decision-workspace/TermDraftEditor';
import CandidateTable from '@/components/decision-workspace/CandidateTable';
import DraftPreviewPanel from '@/components/decision-workspace/DraftPreviewPanel';

interface CandidatesPayload {
  schoolId: number;
  schoolYearId: number;
  authorizesNoMutation: boolean;
  provenanceNote: string;
  sourceRevisionHash: string;
  termConfig: { id: number; termCount: number; termIdentities: string[]; updatedAt: string } | null;
  sourceRevisions: DraftSourceRevision;
  groups: WorkspaceCandidateGroup[];
  counts: { total: number; unresolved: number };
}

/**
 * SCA-03E-R — operator decision workspace (draft-only).
 *
 * Reconstructs candidates dynamically from the read-only
 * decision-candidates endpoint; every group is an unapproved suggestion
 * until the operator decides it. No code constant pre-resolves, locks, or
 * classifies any row. The draft lives in client state; preview is
 * read-only; export/restore never persists and is source-revision
 * validated. The batch-apply route and the term PUT are unwired here by
 * design (SCA-04 stays locked).
 */
export default function DecisionWorkspace() {
  const [actorSchoolId, setActorSchoolId] = useState<number | null>(null);
  const [schoolYearId, setSchoolYearId] = useState<number | null>(null);
  const [scopeBlockedReason, setScopeBlockedReason] = useState<string | null>(null);
  const refreshedOnce = useRef(false);
  const [payload, setPayload] = useState<CandidatesPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [draft, setDraft] = useState<DraftState>({});
  const [term, setTerm] = useState<TermDraft>({ countText: '', identitiesText: '' });
  const [selected, setSelected] = useState<Set<string>>(new Set());

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const actor = await resolveActorSchoolId();
        if (cancelled) return;
        setActorSchoolId(actor);
        let ctx = await resolveActiveSchoolYearContext({ allowStaleOnError: true, allowEnrollProFallback: false });
        if (cancelled) return;
        if (actor != null && ctx.schoolId != null && ctx.schoolId !== actor && !refreshedOnce.current) {
          refreshedOnce.current = true;
          ctx = await resolveActiveSchoolYearContext({ forceRefresh: true, allowStaleOnError: true, allowEnrollProFallback: false });
          if (cancelled) return;
        }
        const verdict = resolveCurriculumYearScope(actor, ctx ? { activeSchoolYearId: ctx.activeSchoolYearId ?? null, schoolId: ctx.schoolId ?? null } : null);
        if (!verdict.ok) {
          setScopeBlockedReason(
            verdict.reason === 'actor-unresolved'
              ? 'ATLAS could not determine the authenticated school. No candidates were loaded.'
              : verdict.reason === 'school-mismatch'
                ? 'The active-year context belongs to a different school. No candidates were loaded.'
                : 'The active school year is not configured. No candidates were loaded.',
          );
          setSchoolYearId(null);
          setLoading(false);
          return;
        }
        setScopeBlockedReason(null);
        setSchoolYearId(verdict.schoolYearId);
      } catch {
        if (!cancelled) {
          setActorSchoolId(null);
          setScopeBlockedReason('ATLAS could not determine the authenticated school. No candidates were loaded.');
          setLoading(false);
        }
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const load = useCallback(async () => {
    if (schoolYearId == null) return;
    setLoading(true);
    setError(null);
    try {
      const { data } = await atlasApi.get(`/curriculum-requirements/${schoolYearId}/decision-candidates`);
      const candidates = data.candidates as CandidatesPayload;
      setPayload(candidates);
      setDraft(buildDraftFromGroups(candidates.groups));
      setSelected(new Set());
    } catch (err: unknown) {
      const message = (err as { response?: { data?: { message?: string } } })?.response?.data?.message ?? 'Failed to load decision candidates.';
      setError(message);
    } finally {
      setLoading(false);
    }
  }, [schoolYearId]);

  useEffect(() => {
    void load();
  }, [load]);

  const stats = useMemo(() => {
    const groups = payload?.groups ?? [];
    let confirmed = 0;
    let rejected = 0;
    for (const g of groups) {
      const row = draft[g.groupKey];
      if (row?.decision === 'CONFIRMED') confirmed += 1;
      else if (row?.decision === 'REJECTED') rejected += 1;
    }
    return { total: groups.length, unresolved: payload?.counts.unresolved ?? 0, confirmed, rejected, undecided: groups.length - confirmed - rejected };
  }, [payload, draft]);

  const handleRowChange = useCallback((key: string, patch: Partial<DraftRowState>) => {
    setDraft((d) => (d[key] ? { ...d, [key]: { ...d[key], ...patch } } : d));
  }, []);

  const handleBulk = useCallback((decision: DraftDecision, classification: DraftClassification | null) => {
    if (selected.size === 0) return;
    setDraft((current) => {
      const result = applyBulkDecision(current, payload?.groups ?? [], selected, decision, classification);
      const label = decision === 'CONFIRMED' ? 'confirmed' : decision === 'REJECTED' ? 'rejected' : 'reset';
      if (result.skipped.length > 0) {
        toast.error(`${result.applied.length} row(s) ${label}; ${result.skipped.length} selected row(s) could not be found and were NOT changed.`);
      } else {
        toast.success(`${result.applied.length} row(s) ${label}.`);
      }
      return result.draft;
    });
    setSelected(new Set());
  }, [payload, selected]);

  const handleRestore = useCallback((restoredDraft: DraftState, restoredTerm: TermDraft) => {
    setDraft(restoredDraft);
    setTerm(restoredTerm);
    setSelected(new Set());
  }, []);

  return (
    <div className="flex flex-col h-[calc(100svh-3.5rem)]">
      <div className="shrink-0 border-b px-4 py-3 flex flex-wrap items-center gap-2">
        <Button asChild variant="ghost" size="sm">
          <Link to="/subjects/requirements"><ArrowLeft className="size-4" /> Requirements</Link>
        </Button>
        <div className="min-w-0">
          <h1 className="text-base font-bold leading-tight">Decision Workspace</h1>
          <p className="text-xs text-muted-foreground">
            Draft-only review of required-subject candidates. Nothing here persists or applies.
          </p>
        </div>
        <div className="ml-auto flex items-center gap-2 text-xs">
          <span className="text-muted-foreground">Year {schoolYearId ?? '…'}</span>
          <Button variant="outline" size="sm" onClick={() => void load()} disabled={loading}>
            <RefreshCw className={loading ? 'size-4 animate-spin' : 'size-4'} /> Reload candidates
          </Button>
        </div>
      </div>

      <div className="flex-1 min-h-0 overflow-auto px-4 py-3 space-y-3">
        <div className="flex flex-wrap gap-x-5 gap-y-1 text-xs text-muted-foreground">
          <span>Groups <strong className="text-foreground">{stats.total}</strong></span>
          <span>Unresolved <strong className="text-foreground">{stats.unresolved}</strong></span>
          <span>Confirmed <strong className="text-foreground">{stats.confirmed}</strong></span>
          <span>Rejected <strong className="text-foreground">{stats.rejected}</strong></span>
          <span>Undecided <strong className="text-foreground">{stats.undecided}</strong></span>
          {payload && (
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <span className="cursor-help">
                    Persisted <strong className="text-foreground">{payload.sourceRevisions.activeRequirementCount}</strong>
                  </span>
                </TooltipTrigger>
                <TooltipContent>
                  {payload.sourceRevisions.activeSubjectCount} active subjects · {payload.sourceRevisions.activeSectionCount} active sections · {payload.sourceRevisions.annualOwnershipCount} annual ownership rows (suggestion only). No row is pre-approved by code.
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          )}
          {payload && (
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <span className="cursor-help">
                    Source rev <code className="rounded bg-muted px-1 font-mono">{payload.sourceRevisionHash.slice(0, 8)}</code>
                  </span>
                </TooltipTrigger>
                <TooltipContent className="max-w-80">
                  {payload.sourceRevisionHash} — canonical hash of every semantic source value that can change the candidate set. Any source change invalidates saved drafts until you reload and re-export.
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          )}
        </div>

        {scopeBlockedReason && (
          <div className="rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
            {scopeBlockedReason}
          </div>
        )}

        {loading && !scopeBlockedReason && (
          <div className="space-y-2"><Skeleton className="h-10 w-full" /><Skeleton className="h-24 w-full" /></div>
        )}

        {error && !loading && (
          <div className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-800">
            {error} <Button variant="outline" size="sm" className="ml-2" onClick={() => void load()}>Retry</Button>
          </div>
        )}

        {!loading && !error && !scopeBlockedReason && payload && schoolYearId !== null && actorSchoolId !== null && (
          <AnimatePresence mode="wait">
            <motion.div key="workspace" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="space-y-3">
              <p className="text-xs text-muted-foreground">
                {payload.groups.length} reconstructed suggestions · {payload.groups.length - stats.unresolved === 0 ? '0 ' : ''}approved by code. Decide each row or use a bulk action; restore a previously exported draft to bring back prior operator choices.
              </p>
              <TermDraftEditor
                term={term}
                onChange={setTerm}
                persistedTermCount={payload.termConfig?.termCount ?? null}
              />
              <CandidateTable
                groups={payload.groups}
                draft={draft}
                term={term}
                selected={selected}
                onToggleSelect={(key) => setSelected((s) => {
                  const next = new Set(s);
                  if (next.has(key)) next.delete(key);
                  else next.add(key);
                  return next;
                })}
                onSelectVisible={(keys) => setSelected((s) => new Set([...s, ...keys]))}
                onClearSelection={() => setSelected(new Set())}
                onRowChange={handleRowChange}
                onBulk={handleBulk}
              />
              <DraftPreviewPanel
                schoolId={actorSchoolId}
                schoolYearId={schoolYearId}
                sourceRevisionHash={payload.sourceRevisionHash}
                groups={payload.groups}
                draft={draft}
                term={term}
                onRestore={handleRestore}
              />
              {payload.groups.length === 0 && (
                <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  {loading ? <Loader2 className="size-4 animate-spin" /> : null} No candidates reconstructed from current evidence.
                </p>
              )}
            </motion.div>
          </AnimatePresence>
        )}
      </div>
    </div>
  );
}
