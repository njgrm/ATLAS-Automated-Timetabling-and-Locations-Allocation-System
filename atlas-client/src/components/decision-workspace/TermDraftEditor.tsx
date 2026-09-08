import { useState } from 'react';
import { Button } from '@/ui/button';
import { Input } from '@/ui/input';
import { Label } from '@/ui/label';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/ui/tooltip';
import { Info } from 'lucide-react';
import { parseDraftTerms, type TermDraft } from '@/lib/decision-draft';

interface Props {
  term: TermDraft;
  onChange: (term: TermDraft) => void;
  persistedTermCount: number | null;
}

/**
 * SCA-03E capability 1 — operator-entered draft term configuration.
 * Empty until the operator types it: no [1,2,3], no termCount default.
 * Draft-local only: this editor never persists terms (no PUT call exists
 * in the workspace). Persisted state is shown for context, never inherited.
 */
export default function TermDraftEditor({ term, onChange, persistedTermCount }: Props) {
  const [open, setOpen] = useState(false);
  const parsed = parseDraftTerms(term);
  const status = parsed
    ? `${parsed.count} term(s): ${parsed.identities.join(', ')}`
    : 'not configured';

  return (
    <div className="rounded-md border p-3">
      <div className="flex flex-wrap items-center gap-2">
        <h2 className="text-sm font-bold">Step 1 · Draft terms</h2>
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold ${parsed ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-100 text-slate-700'}`}>
                <Info className="size-3" /> {status}
              </span>
            </TooltipTrigger>
            <TooltipContent className="max-w-72">
              Draft-only term identities typed by the operator for rotation gating and draft preview.
              Nothing here is persisted: saving terms belongs to a later approved step, not this workspace.
              {persistedTermCount !== null && ` Persisted terms exist (${persistedTermCount}); the draft does not inherit them.`}
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
        <div className="ml-auto">
          <Button variant="outline" size="sm" onClick={() => setOpen((o) => !o)}>
            {open ? 'Hide editor' : parsed ? 'Edit draft terms' : 'Configure draft terms'}
          </Button>
        </div>
      </div>
      {open && (
        <div className="mt-2 flex flex-wrap items-end gap-2">
          <div>
            <Label htmlFor="draft-term-count">Term count</Label>
            <Input
              id="draft-term-count"
              className="w-24"
              value={term.countText}
              onChange={(e) => onChange({ ...term, countText: e.target.value })}
              inputMode="numeric"
              placeholder="—"
            />
          </div>
          <div className="min-w-52 flex-1">
            <Label htmlFor="draft-term-identities">Term identities (comma-separated, in order)</Label>
            <Input
              id="draft-term-identities"
              value={term.identitiesText}
              onChange={(e) => onChange({ ...term, identitiesText: e.target.value })}
              placeholder="e.g. Q1, Q2"
            />
          </div>
          <Button variant="ghost" size="sm" onClick={() => onChange({ countText: '', identitiesText: '' })}>
            Clear
          </Button>
        </div>
      )}
      {open && (
        <p className="mt-1 text-xs text-muted-foreground">
          Count and identities must agree exactly; anything else stays unconfigured. Rotating and single-term rows unlock only against these draft terms.
        </p>
      )}
    </div>
  );
}
