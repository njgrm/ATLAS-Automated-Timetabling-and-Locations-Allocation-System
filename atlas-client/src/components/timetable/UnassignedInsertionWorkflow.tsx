import { useEffect, useMemo, useState } from 'react';
import { BookOpen, CalendarClock, CircleAlert, DoorOpen, Loader2, RefreshCw, UserRoundCog } from 'lucide-react';
import { Link } from 'react-router-dom';
import atlasApi from '@/lib/api';
import {
  groupInsertionReadiness,
  placementSaveAvailability,
  type InsertionPreview,
  type InsertionReadinessSummary,
} from '@/lib/timetable-ttc02-insertion';
import { Badge } from '@/ui/badge';
import { Button } from '@/ui/button';
import { Input } from '@/ui/input';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/ui/dialog';
import { ScrollArea } from '@/ui/scroll-area';

export interface UnassignedInsertionWorkflowProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  schoolId: number;
  schoolYearId: number;
}

type LoadState =
  | { phase: 'loading' }
  | { phase: 'empty' }
  | { phase: 'error'; message: string }
  | { phase: 'ready'; summary: InsertionReadinessSummary }
  | { phase: 'degraded'; summary: InsertionReadinessSummary; message: string };

const REASON_ACTION_ICONS: Record<string, typeof CircleAlert> = {
  FIX_TEACHING_LOAD: UserRoundCog,
  REVIEW_OWNER_SCOPE: UserRoundCog,
  REVIEW_TEACHER_AVAILABILITY: CalendarClock,
  REVIEW_ROOM_READINESS: DoorOpen,
  RESOLVE_CONFLICT: CircleAlert,
  REVIEW_TERMS: CalendarClock,
  REFRESH_SOURCE: RefreshCw,
  REVIEW_CURRICULUM: BookOpen,
  OPEN_DRAFT: CalendarClock,
};

export function UnassignedInsertionWorkflow(props: UnassignedInsertionWorkflowProps) {
  const { open, onOpenChange, schoolId, schoolYearId } = props;
  const [loadState, setLoadState] = useState<LoadState>({ phase: 'loading' });
  const [preview, setPreview] = useState<InsertionPreview | null>(null);
  const [previewingKey, setPreviewingKey] = useState<string | null>(null);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [query, setQuery] = useState('');
  const [page, setPage] = useState(1);

  const scope = `/generation/${schoolId}/${schoolYearId}`;

  async function loadSummary() {
    setLoadState({ phase: 'loading' });
    setPreview(null);
    setPreviewingKey(null);
    setPreviewError(null);
    setPage(1);
    try {
      const { data } = await atlasApi.get<InsertionReadinessSummary>(`${scope}/unassigned-workflow/summary`);
      if (!data || data.demand.totalLines === 0) {
        setLoadState({ phase: 'empty' });
        return;
      }
      setLoadState({ phase: 'ready', summary: data });
    } catch (error) {
      const message = (error as { response?: { data?: { message?: string } } }).response?.data?.message ?? 'Unassigned insertion readiness is unavailable right now.';
      setLoadState({ phase: 'error', message });
    }
  }

  useEffect(() => {
    if (open) void loadSummary();
  }, [open, scope]);

  const groups = useMemo(() => {
    if (loadState.phase !== 'ready' && loadState.phase !== 'degraded') return [];
    return groupInsertionReadiness(loadState.summary);
  }, [loadState]);

  async function handlePreview(demandKey: string) {
    setPreviewingKey(demandKey);
    setPreviewError(null);
    setPreview(null);
    try {
      const { data } = await atlasApi.post<InsertionPreview>(`${scope}/unassigned-workflow/preview`, { demandKey });
      setPreview(data);
    } catch (error) {
      const message = (error as { response?: { data?: { message?: string } } }).response?.data?.message ?? 'Preview failed. Refresh and try again.';
      setPreviewError(message);
    } finally {
      setPreviewingKey(null);
    }
  }

  async function handleRefresh() {
    setRefreshing(true);
    try {
      await loadSummary();
    } finally {
      setRefreshing(false);
    }
  }

  const summary = loadState.phase === 'ready' || loadState.phase === 'degraded' ? loadState.summary : null;
  const previewLine = summary?.lineStates.find((line) => line.demandKey === preview?.demandKey) ?? null;
  const save = placementSaveAvailability({
    state: preview?.state ?? 'NO_AVAILABLE_SLOT',
    hasCandidates: Boolean(preview && preview.candidates.length > 0),
    allowApply: false,
  });
  const pageSize = 20;
  const filteredLines = (summary?.lineStates ?? []).filter((line) =>
    `${line.subjectName} ${line.subjectCode} ${line.sectionName} ${line.ownerFacultyName ?? ''} ${line.termIdentity} ${line.state}`
      .toLowerCase()
      .includes(query.trim().toLowerCase()),
  );
  const pageCount = Math.max(1, Math.ceil(filteredLines.length / pageSize));
  const effectivePage = Math.min(page, pageCount);
  const visibleLines = filteredLines.slice((effectivePage - 1) * pageSize, effectivePage * pageSize);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex h-[min(92svh,760px)] max-w-3xl flex-col gap-0 p-0">
        <DialogHeader className="shrink-0 border-b px-5 py-4">
          <div className="flex items-center justify-between gap-2">
            <div>
              <DialogTitle className="text-base">Unassigned insertion</DialogTitle>
              <DialogDescription className="text-xs">
                Curriculum-demanded meetings that are not yet placed. Teaching Load ownership is read-only here.
              </DialogDescription>
            </div>
            <Button type="button" variant="outline" size="sm" className="h-11 w-11 px-0" aria-label="Refresh readiness" onClick={() => void handleRefresh()} disabled={refreshing}>
              {refreshing ? <Loader2 className="size-4 animate-spin" aria-hidden="true" /> : <RefreshCw className="size-4" aria-hidden="true" />}
            </Button>
          </div>
        </DialogHeader>

        <div className="min-h-0 flex-1 overflow-auto p-4" data-testid="unassigned-insertion-scroll">
          {loadState.phase === 'loading' && (
            <div className="flex h-full min-h-24 items-center justify-center gap-2 text-sm text-muted-foreground" role="status">
              <Loader2 className="size-4 animate-spin" aria-hidden="true" />
              Checking curriculum demand, ownership, rooms, and slots…
            </div>
          )}
          {loadState.phase === 'empty' && (
            <p className="py-8 text-center text-sm text-muted-foreground" role="status">
              No curriculum-demanded meetings exist for this school year yet. Configure Curriculum Requirements first.
            </p>
          )}
          {loadState.phase === 'error' && (
            <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-4 text-sm" role="alert">
              <p className="flex items-center gap-2 font-semibold text-destructive">
                <CircleAlert className="size-4" aria-hidden="true" />
                {loadState.message}
              </p>
              <p className="mt-1 text-muted-foreground">Refresh the timetable or open Curriculum Requirements to repair setup gaps.</p>
            </div>
          )}
          {(loadState.phase === 'ready' || loadState.phase === 'degraded') && summary && (
            <div className="space-y-3">
              <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground" data-testid="unassigned-insertion-stats">
                <Badge variant="secondary" className="h-7 px-2 text-xs">Demand {summary.demand.totalLines} lines</Badge>
                <Badge variant="secondary" className="h-7 px-2 text-xs">{summary.demand.totalSessions} weekly sessions</Badge>
                <Badge variant="secondary" className="h-7 px-2 text-xs">Individually previewable {summary.insertionReadyLines}</Badge>
                <Badge variant="secondary" className="h-7 px-2 text-xs">Unresolved {summary.unresolvedLines}</Badge>
                <Badge variant="secondary" className="h-7 px-2 text-xs">Globally scheduled 0</Badge>
                <Badge variant="secondary" className="h-7 px-2 text-xs">Runs {summary.liveGenerationRunCount}</Badge>
              </div>
              <p className="text-xs text-muted-foreground">
                Preview-only: candidates check room compatibility and interval overlap against persisted draft locks. They do not run the canonical generator's full policy set and do not prove that all demand can coexist.
              </p>

              {groups.map((group) => {
                const Icon = group.guidance ? REASON_ACTION_ICONS[group.guidance.action] ?? CircleAlert : CircleAlert;
                return (
                  <section key={group.reason} className="rounded-lg border border-border bg-muted/10 p-3" data-testid={`insertion-reason-group-${group.reason}`}>
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex min-w-0 items-center gap-2">
                        <Icon className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
                        <h3 className="truncate text-sm font-semibold">{group.reason.replace(/_/g, ' ')}</h3>
                      </div>
                      <Badge variant={group.reason === 'INDIVIDUALLY_PREVIEWABLE' ? 'default' : 'secondary'} className="h-7 px-2 text-xs">
                        {group.count}
                      </Badge>
                    </div>
                    {group.guidance && (
                      <div className="mt-2 space-y-1 text-xs">
                        <p className="text-foreground">{group.guidance.message}</p>
                        <p className="text-muted-foreground">
                          <span className="font-semibold">Prerequisite: </span>
                          {group.guidance.prerequisite}
                        </p>
                        <p className="text-muted-foreground">
                          <span className="font-semibold">Next: </span>
                          {group.guidance.primaryAction}
                        </p>
                      </div>
                    )}
                    {group.reason === 'MISSING_TEACHING_LOAD_OWNER' && (
                      <Button asChild type="button" size="sm" className="mt-2 h-11" data-testid="insertion-goto-teaching-load">
                        <Link to="/teaching-load">Fix Teaching Load ownership</Link>
                      </Button>
                    )}
                  </section>
                );
              })}
              <section className="space-y-2 rounded-lg border border-border bg-background p-3" aria-label="Demand line browser">
                <p className="text-xs text-muted-foreground">Search all {summary.demand.totalLines} demand lines, including unresolved lines, then inspect a read-only preview.</p>
                <Input value={query} onChange={(event) => { setQuery(event.target.value); setPage(1); }} placeholder="Search subject, code, section, teacher, term, or status" aria-label="Search all timetable demand" className="h-11" />
                <ul className="space-y-1">
                  {visibleLines.map((line) => (
                    <li key={line.demandKey} className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-border bg-background px-2 py-1.5">
                      <div className="min-w-0">
                        <p className="truncate text-xs font-medium" data-testid="insertion-line-label">{line.subjectName} · {line.sectionName} · {line.termIdentity}</p>
                        <p className="truncate text-[0.7rem] text-muted-foreground">{line.ownerFacultyName ?? 'No owner'} · {line.sessionsPerWeek} session{line.sessionsPerWeek === 1 ? '' : 's'}/week · {line.state.replace(/_/g, ' ')}</p>
                      </div>
                      <Button type="button" variant="outline" size="sm" className="h-11 min-w-28 px-3 text-xs" disabled={previewingKey === line.demandKey} onClick={() => void handlePreview(line.demandKey)} data-testid={`insertion-preview-${line.demandKey}`}>
                        {previewingKey === line.demandKey ? <Loader2 className="size-3.5 animate-spin" aria-hidden="true" /> : <CalendarClock className="size-3.5" aria-hidden="true" />}
                        Inspect preview
                      </Button>
                    </li>
                  ))}
                </ul>
                <div className="flex flex-wrap items-center justify-between gap-2 pt-1 text-xs text-muted-foreground">
                  <span>{filteredLines.length} matching lines · page {effectivePage} of {pageCount}</span>
                  <div className="flex gap-2">
                    <Button type="button" variant="outline" size="sm" className="h-11" disabled={effectivePage <= 1} onClick={() => setPage((value) => Math.max(1, value - 1))}>Previous</Button>
                    <Button type="button" variant="outline" size="sm" className="h-11" disabled={effectivePage >= pageCount} onClick={() => setPage((value) => Math.min(pageCount, value + 1))}>Next</Button>
                  </div>
                </div>
              </section>
            </div>
          )}
        </div>

        {previewError && <p className="shrink-0 border-t px-4 py-2 text-xs text-destructive" role="alert" data-testid="insertion-preview-error">{previewError}</p>}

        {preview && previewLine && (
          <div className="shrink-0 border-t px-4 py-3">
            <div className="flex items-center justify-between gap-2">
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold" data-testid="insertion-preview-title">
                  {previewLine.subjectName} · {previewLine.sectionName} · {previewLine.termIdentity}
                </p>
                <p className="truncate text-xs text-muted-foreground">
                  Teacher {previewLine.ownerFacultyName ?? '—'} · {previewLine.subjectCode} · Grade {previewLine.gradeLevel} {previewLine.programType}
                </p>
              </div>
              <Badge variant={preview.state === 'INDIVIDUALLY_PREVIEWABLE' ? 'default' : 'secondary'} className="h-7 shrink-0 px-2 text-xs" data-testid="insertion-preview-state">
                {preview.state === 'INDIVIDUALLY_PREVIEWABLE' ? 'Individually previewable' : preview.state}
              </Badge>
            </div>
            {preview.state === 'INDIVIDUALLY_PREVIEWABLE' && preview.candidates.length > 0 && (
              <ScrollArea className="mt-2 max-h-28">
                <ul className="space-y-1 pr-2">
                  {preview.candidates.map((candidate, index) => (
                    <li key={`${candidate.day}-${candidate.startTime}-${candidate.roomId}`} className="flex flex-wrap items-center gap-2 text-xs">
                      <Badge variant="outline" className="h-6 px-2">
                        {index + 1}
                      </Badge>
                      <span className="font-medium">{candidate.day}</span>
                      <span className="text-muted-foreground">
                        {candidate.startTime}–{candidate.endTime}
                      </span>
                      <span className="text-muted-foreground">Room {candidate.roomName}</span>
                    </li>
                  ))}
                </ul>
              </ScrollArea>
            )}
          </div>
        )}

        <DialogFooter className="shrink-0 border-t px-4 py-3">
          <div className="flex w-full flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <p className="max-w-md text-xs text-muted-foreground" data-testid="insertion-save-boundary-note">
              {preview ? save.detail : 'Preview an individually previewable line to review teacher, subject, section, term, day/time, and room.'}
            </p>
            <Button
              type="button"
              size="sm"
              className="h-11 px-4"
              disabled={!preview || !save.canSave}
              data-testid="insertion-save-boundary"
            >
              {preview && preview.candidates.length > 0 ? save.label : 'Save placement'}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
