import { useMemo, useState } from 'react';
import { Button } from '@/ui/button';
import { Input } from '@/ui/input';
import { Label } from '@/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/ui/select';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/ui/tooltip';
import { Info } from 'lucide-react';
import {
  DRAFT_CLASSIFICATIONS,
  parseDraftTerms,
  type DraftClassification,
  type DraftDecision,
  type DraftState,
  type TermDraft,
  type WorkspaceCandidateGroup,
} from '@/lib/decision-draft';
import CandidateRow, { GRADE_BADGE_TONES } from './CandidateRow';

interface Props {
  groups: WorkspaceCandidateGroup[];
  draft: DraftState;
  term: TermDraft;
  selected: Set<string>;
  onToggleSelect: (key: string) => void;
  onSelectVisible: (keys: string[]) => void;
  onClearSelection: () => void;
  onRowChange: (key: string, patch: Partial<import('@/lib/decision-draft').DraftRowState>) => void;
  onBulk: (decision: DraftDecision, classification: DraftClassification | null) => void;
}

/**
 * SCA-03E-R — grade/program/subject grouping with filters, per-row
 * decisions (in CandidateRow), and bulk confirm/reject/classify. Bulk
 * applies to EVERY selected row; nothing is skipped silently and the caller
 * reports applied/skipped counts.
 */
export default function CandidateTable({
  groups, draft, term, selected, onToggleSelect, onSelectVisible, onClearSelection, onRowChange, onBulk,
}: Props) {
  const [gradeFilter, setGradeFilter] = useState<string>('ALL');
  const [programFilter, setProgramFilter] = useState<string>('ALL');
  const [search, setSearch] = useState('');
  const [bulkClassification, setBulkClassification] = useState<DraftClassification>('CORE');

  const programs = useMemo(() => [...new Set(groups.map((g) => g.programType))].sort(), [groups]);

  const visible = useMemo(() => {
    const q = search.trim().toLowerCase();
    return groups.filter((g) => {
      if (gradeFilter !== 'ALL' && g.gradeLevel !== Number(gradeFilter)) return false;
      if (programFilter !== 'ALL' && g.programType !== programFilter) return false;
      if (q && !`${g.subjectCode} ${g.subjectName}`.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [groups, gradeFilter, programFilter, search]);

  const visibleKeys = useMemo(() => visible.map((g) => g.groupKey), [visible]);
  const selectedVisible = visibleKeys.filter((k) => selected.has(k));
  const parsedTerms = useMemo(() => parseDraftTerms(term), [term]);

  return (
    <div className="rounded-md border p-3">
      <div className="flex flex-wrap items-center gap-2">
        <h2 className="text-sm font-bold">Step 2 · Review candidates</h2>
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <span className="inline-flex cursor-help items-center gap-1 text-xs text-muted-foreground">
                <Info className="size-3" /> {visible.length} of {groups.length} shown
              </span>
            </TooltipTrigger>
            <TooltipContent className="max-w-72">
              Groups rebuild from live subjects, sections, and ownership on every load. Ownership is suggestion only.
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
        <div className="ml-auto flex flex-wrap items-center gap-1.5">
          <div className="flex gap-1">
            {['ALL', '7', '8', '9', '10'].map((g) => (
              <Button
                key={g}
                size="sm"
                variant={gradeFilter === g ? 'default' : 'outline'}
                onClick={() => setGradeFilter(g)}
                className={gradeFilter !== g && g !== 'ALL' ? GRADE_BADGE_TONES[Number(g)] : ''}
              >
                {g === 'ALL' ? 'All' : `G${g}`}
              </Button>
            ))}
          </div>
          <Select value={programFilter} onValueChange={setProgramFilter}>
            <SelectTrigger className="w-32"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">All programs</SelectItem>
              {programs.map((p) => (
                <SelectItem key={p} value={p}>{p}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Input
            className="w-40"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search subject…"
          />
        </div>
      </div>

      {selected.size > 0 && (
        <div className="mt-2 flex flex-wrap items-center gap-2 rounded-md bg-primary/5 p-2">
          <span className="text-xs font-semibold">{selected.size} selected ({selectedVisible.length} visible)</span>
          <div className="flex items-center gap-1">
            <Label className="text-xs">Classify as</Label>
            <Select value={bulkClassification} onValueChange={(v) => setBulkClassification(v as DraftClassification)}>
              <SelectTrigger className="w-36"><SelectValue /></SelectTrigger>
              <SelectContent>
                {DRAFT_CLASSIFICATIONS.map((c) => (
                  <SelectItem key={c} value={c}>{c}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <Button size="sm" onClick={() => onBulk('CONFIRMED', bulkClassification)}>Confirm + classify</Button>
          <Button size="sm" variant="outline" onClick={() => onBulk('REJECTED', null)}>Reject</Button>
          <Button size="sm" variant="ghost" onClick={onClearSelection}>Clear</Button>
          <span className="text-xs text-muted-foreground">Bulk applies to every selected row. Applied and skipped counts are reported after the action.</span>
        </div>
      )}

      <div className="mt-2 flex items-center gap-2 text-xs text-muted-foreground">
        <Button variant="link" size="sm" className="h-auto p-0 text-xs" onClick={() => onSelectVisible(visibleKeys)}>
          Select visible
        </Button>
      </div>

      <ul className="mt-2 space-y-2">
        {visible.map((group) => {
          const row = draft[group.groupKey];
          if (!row) return null;
          return (
            <CandidateRow
              key={group.groupKey}
              group={group}
              row={row}
              draftTerms={parsedTerms}
              selected={selected.has(group.groupKey)}
              onToggleSelect={() => onToggleSelect(group.groupKey)}
              onChange={(patch) => onRowChange(group.groupKey, patch)}
            />
          );
        })}
      </ul>
      {visible.length === 0 && (
        <p className="mt-2 text-xs text-muted-foreground">No candidates match these filters.</p>
      )}
    </div>
  );
}
