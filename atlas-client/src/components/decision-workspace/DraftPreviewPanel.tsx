import { useCallback, useRef, useState } from 'react';
import { Button } from '@/ui/button';
import { Label } from '@/ui/label';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/ui/tooltip';
import { CheckCircle2, Copy, Download, Loader2, Upload } from 'lucide-react';
import { toast } from 'sonner';
import atlasApi from '@/lib/api';
import {
  compileDraftOfferings,
  restoreDraftText,
  serializeDraft,
  type DraftState,
  type TermDraft,
  type WorkspaceCandidateGroup,
} from '@/lib/decision-draft';

interface PreviewResult {
  offerings: unknown[];
  totalCount: number;
  newCount: number;
  unchangedCount: number;
  retiredCount: number;
  termConfigValid: boolean;
  fingerprint: string;
  sourceVersions: Record<string, number>;
  termConfigRevision: { id: number; updatedAt: string } | null;
}

interface Props {
  schoolId: number;
  schoolYearId: number;
  sourceRevisionHash: string;
  groups: WorkspaceCandidateGroup[];
  draft: DraftState;
  term: TermDraft;
  onRestore: (draft: DraftState, term: TermDraft) => void;
}

/**
 * SCA-03E-R2 — read-only batch preview + fingerprint, and draft
 * export/restore without persisting anything. Restore is explicit, strict,
 * and bound to the canonical sourceRevisionHash: a draft from a different
 * school/year or from any changed semantic source evidence is rejected
 * visibly. This panel contains no apply call and never dispatches a term
 * PUT: the workspace stops here.
 */
export default function DraftPreviewPanel({ schoolId, schoolYearId, sourceRevisionHash, groups, draft, term, onRestore }: Props) {
  const [preview, setPreview] = useState<PreviewResult | null>(null);
  const [previewBusy, setPreviewBusy] = useState(false);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [compileInfo, setCompileInfo] = useState<{ heldOut: number } | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const handlePreview = useCallback(async () => {
    setPreviewBusy(true);
    setPreviewError(null);
    try {
      const compiled = compileDraftOfferings(groups, draft, term);
      setCompileInfo({ heldOut: compiled.heldOut.length });
      if (compiled.errors.length > 0) {
        setPreview(null);
        setPreviewError(compiled.errors.map((e) => `${e.groupKey}: ${e.message}`).join('\n'));
        return;
      }
      // Read-only preview computation only. The batch-apply endpoint is
      // never called from this workspace.
      const { data } = await atlasApi.post(
        `/curriculum-requirements/${schoolYearId}/requirements/preview`,
        { offerings: compiled.offerings },
      );
      setPreview(data.preview as PreviewResult);
    } catch (err: unknown) {
      const message = (err as { response?: { data?: { code?: string; message?: string } } })?.response?.data;
      setPreview(null);
      setPreviewError(message ? `${message.code ?? 'ERROR'}: ${message.message}` : 'Preview failed.');
    } finally {
      setPreviewBusy(false);
    }
  }, [schoolYearId, groups, draft, term]);

  const handleExport = useCallback((asClipboard: boolean) => {
    const doc = serializeDraft(schoolId, schoolYearId, sourceRevisionHash, term, draft);
    const text = JSON.stringify(doc, null, 2);
    if (asClipboard) {
      void navigator.clipboard.writeText(text).then(
        () => toast.success('Draft copied to clipboard (client-side only).'),
        () => toast.error('Clipboard copy failed.'),
      );
      return;
    }
    const blob = new Blob([text], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'curriculum-decision-draft.json';
    a.click();
    URL.revokeObjectURL(url);
    toast.success('Draft downloaded. Nothing was persisted.');
  }, [schoolId, schoolYearId, sourceRevisionHash, term, draft]);

  const handleRestoreFile = useCallback(async (file: File) => {
    try {
      const text = await file.text();
      // Strict, fail-closed restore: school/year/source-revision hash + row
      // validation all reject with visible errors; nothing is applied unless
      // every check passes, so the current UI draft is left unchanged.
      const restored = restoreDraftText(text, groups, { schoolId, schoolYearId, sourceRevisionHash });
      onRestore(restored.draft, restored.term);
      toast.success('Draft restored (client-side draft only; nothing persisted).');
    } catch (err: unknown) {
      toast.error((err as Error)?.message ?? 'Draft restore failed.');
    }
  }, [groups, schoolId, schoolYearId, sourceRevisionHash, onRestore]);

  return (
    <div className="rounded-md border p-3">
      <div className="flex flex-wrap items-center gap-2">
        <h2 className="text-sm font-bold">Step 3 · Read-only preview + draft handoff</h2>
        <div className="ml-auto flex gap-1.5">
          <Button size="sm" variant="outline" onClick={() => void handlePreview()} disabled={previewBusy}>
            {previewBusy ? <Loader2 className="size-4 animate-spin" /> : null} Preview draft
          </Button>
          <Button size="sm" variant="outline" onClick={() => handleExport(false)}>
            <Download className="size-4" /> Export
          </Button>
          <Button size="sm" variant="outline" onClick={() => handleExport(true)}>
            <Copy className="size-4" /> Copy
          </Button>
          <Button size="sm" variant="outline" onClick={() => fileRef.current?.click()}>
            <Upload className="size-4" /> Restore
          </Button>
          <input
            ref={fileRef}
            type="file"
            accept="application/json"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) void handleRestoreFile(file);
              e.target.value = '';
            }}
          />
        </div>
      </div>
      <p className="mt-1 text-xs text-muted-foreground">
        Preview computes a fingerprint without writing anything. Export/restore moves the unfinished draft as a file or clipboard JSON. Restore is validated against this school, school year, and the canonical source-revision hash; it never writes offerings or terms.
      </p>
      <p className="mt-1 text-xs text-muted-foreground">
        Source revision <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <code className="cursor-help rounded bg-muted px-1 font-mono">{sourceRevisionHash.slice(0, 8)}…</code>
            </TooltipTrigger>
            <TooltipContent className="max-w-80">
              {sourceRevisionHash} — a canonical hash of every subject, section, ownership, term-config, and persisted-requirement value that can change the candidate set. Any source change invalidates saved drafts; restore then fails closed until you reload and re-export.
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </p>

      {compileInfo && (
        <p className="mt-1 text-xs text-muted-foreground">
          Last compile: {compileInfo.heldOut} rejected or undecided rows held out of the preview.
        </p>
      )}
      {previewError && (
        <div className="mt-2 whitespace-pre-wrap rounded-md border border-amber-200 bg-amber-50 p-2 text-xs text-amber-800">
          {previewError}
        </div>
      )}
      {preview && (
        <div className="mt-2 rounded-md border border-emerald-200 bg-emerald-50/50 p-2 text-xs">
          <div className="flex flex-wrap items-center gap-2">
            <CheckCircle2 className="size-4 text-emerald-700" />
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <span className="cursor-help font-mono font-semibold">{preview.fingerprint}</span>
                </TooltipTrigger>
                <TooltipContent className="max-w-80">
                  Canonical JSON sorted by identity key, SHA-256. Any semantic change invalidates it.
                  Binds termConfigRevision {preview.termConfigRevision ? `(${preview.termConfigRevision.id} · ${preview.termConfigRevision.updatedAt})` : '(none — terms unpersisted)'}
                  {' '}plus {Object.keys(preview.sourceVersions).length} persisted source version(s).
                  Read-only and draft-session only: it authorizes no mutation and persists nothing.
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>
          <div className="mt-1 flex flex-wrap gap-x-4 gap-y-0.5 text-muted-foreground">
            <span>Total <strong className="text-foreground">{preview.totalCount}</strong></span>
            <span>New <strong className="text-foreground">{preview.newCount}</strong></span>
            <span>Unchanged <strong className="text-foreground">{preview.unchangedCount}</strong></span>
            <span>To retire <strong className="text-foreground">{preview.retiredCount}</strong></span>
            <span>Terms valid <strong className="text-foreground">{preview.termConfigValid ? 'yes' : 'no (terms unpersisted)'}</strong></span>
          </div>
          <Label className="mt-1 block text-muted-foreground">
            Applying this batch is a separately approved step (SCA-04, locked). This workspace stops here.
          </Label>
        </div>
      )}
    </div>
  );
}
