import { useState } from 'react';
import { Badge } from '@/ui/badge';
import { Button } from '@/ui/button';
import { Checkbox } from '@/ui/checkbox';
import { Input } from '@/ui/input';
import { Label } from '@/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/ui/select';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/ui/tooltip';
import {
  DRAFT_CLASSIFICATIONS,
  type DraftRowState,
  type WorkspaceCandidateGroup,
} from '@/lib/decision-draft';

export const GRADE_BADGE_TONES: Record<number, string> = {
  7: 'bg-green-100 text-green-800',
  8: 'bg-yellow-100 text-yellow-800',
  9: 'bg-red-100 text-red-800',
  10: 'bg-blue-100 text-blue-800',
};

interface Props {
  group: WorkspaceCandidateGroup;
  row: DraftRowState;
  draftTerms: { count: number; identities: string[] } | null;
  selected: boolean;
  onToggleSelect: () => void;
  onChange: (patch: Partial<DraftRowState>) => void;
}

/**
 * SCA-03E-R — one candidate row: explicit per-row confirm/reject,
 * rotation gated on explicit selection + draft terms, affected sections +
 * demand derivation. No row is pre-resolved, locked, or classified by code;
 * every group is an UNAPPROVED_SUGGESTION until the operator decides it.
 */
export default function CandidateRow({ group, row, draftTerms, selected, onToggleSelect, onChange }: Props) {
  const [showSections, setShowSections] = useState(false);
  const rotationChoicesEnabled = draftTerms !== null;
  const visibleSections = showSections ? group.affectedSections : group.affectedSections.slice(0, 3);

  return (
    <li className={`rounded-md border p-2.5 ${row.decision === 'CONFIRMED' ? 'border-emerald-300 bg-emerald-50/40' : row.decision === 'REJECTED' ? 'border-slate-200 bg-slate-50 opacity-75' : ''}`}>
      <div className="flex flex-wrap items-center gap-1.5">
        <Checkbox checked={selected} onCheckedChange={() => onToggleSelect()} aria-label={`Select ${group.groupKey}`} />
        <span className="font-semibold text-sm">{group.subjectCode} · {group.subjectName}</span>
        <Badge className={GRADE_BADGE_TONES[group.gradeLevel] ?? ''}>G{group.gradeLevel}</Badge>
        <Badge variant="outline">{group.programType}</Badge>
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <Badge variant="outline" className="cursor-help">SUGGESTION_ONLY</Badge>
            </TooltipTrigger>
            <TooltipContent className="max-w-72">
              Reconstructed suggestion from live subjects/sections and legacy ownership (staffing evidence only): never approved, never auto-applied, never curriculum authority until you decide it.
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
        <span className="ml-auto flex gap-1">
          <Button
            size="sm"
            variant={row.decision === 'CONFIRMED' ? 'default' : 'outline'}
            onClick={() => onChange({ decision: row.decision === 'CONFIRMED' ? 'UNDECIDED' : 'CONFIRMED' })}
          >
            {row.decision === 'CONFIRMED' ? 'Confirmed' : 'Confirm'}
          </Button>
          <Button
            size="sm"
            variant={row.decision === 'REJECTED' ? 'destructive' : 'outline'}
            onClick={() => onChange({ decision: row.decision === 'REJECTED' ? 'UNDECIDED' : 'REJECTED' })}
          >
            {row.decision === 'REJECTED' ? 'Rejected' : 'Reject'}
          </Button>
        </span>
      </div>

      <div className="mt-1.5 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <span className="cursor-help">
                {group.sectionCount} section(s) · {group.demandMinutesPerWeek} min/wk
              </span>
            </TooltipTrigger>
            <TooltipContent className="max-w-72">{group.demandDerivation}</TooltipContent>
          </Tooltip>
        </TooltipProvider>
        <span>
          {visibleSections.map((s) => s.name).join(', ')}
          {group.affectedSections.length > 3 && (
            <Button variant="link" size="sm" className="h-auto px-1 text-xs" onClick={() => setShowSections((v) => !v)}>
              {showSections ? 'show less' : `+${group.affectedSections.length - 3} more`}
            </Button>
          )}
        </span>
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <span className="cursor-help">{group.currentOwnershipEvidence.ownershipIds.length} ownership row(s)</span>
            </TooltipTrigger>
            <TooltipContent className="max-w-72">
              Ownership ids [{group.currentOwnershipEvidence.ownershipIds.join(', ') || 'none'}], faculty [{group.currentOwnershipEvidence.facultyIds.join(', ') || 'none'}]. Suggestion only.
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
        {group.catalogRotationFamily && (
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <span className="cursor-help">catalog family: {group.catalogRotationFamily}</span>
              </TooltipTrigger>
              <TooltipContent className="max-w-72">
                Catalog observation only — never rotation authority and never copied into the draft automatically.
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        )}
      </div>

      {row.decision === 'CONFIRMED' && (
        <div className="mt-2 flex flex-wrap items-end gap-2 rounded bg-white/60 p-2">
          <div>
            <Label>Classification (required)</Label>
            <Select value={row.classification ?? ''} onValueChange={(v) => onChange({ classification: v as DraftRowState['classification'] })}>
              <SelectTrigger className="w-40"><SelectValue placeholder="Pick one" /></SelectTrigger>
              <SelectContent>
                {DRAFT_CLASSIFICATIONS.map((c) => (
                  <SelectItem key={c} value={c}>{c}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Term mode</Label>
            <Select value={row.termMode} onValueChange={(v) => onChange({ termMode: v as DraftRowState['termMode'], rotationFamily: '', rotationOrder: '', rotationTerm: '' })}>
              <SelectTrigger className="w-36"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">All-year</SelectItem>
                <SelectItem value="SINGLE" disabled={!rotationChoicesEnabled}>
                  Single term{!rotationChoicesEnabled ? ' (configure draft terms first)' : ''}
                </SelectItem>
                <SelectItem value="ROTATING" disabled={!rotationChoicesEnabled}>
                  Rotating{!rotationChoicesEnabled ? ' (configure draft terms first)' : ''}
                </SelectItem>
              </SelectContent>
            </Select>
          </div>
          {row.termMode !== 'ALL' && (
            <>
              {row.termMode === 'ROTATING' && (
                <>
                  <div>
                    <Label>Rotation family</Label>
                    <Input
                      className="w-32"
                      value={row.rotationFamily}
                      onChange={(e) => onChange({ rotationFamily: e.target.value })}
                      placeholder="e.g. TLE_ROT"
                    />
                  </div>
                  <div>
                    <Label>Order (1–{draftTerms?.count})</Label>
                    <Input
                      className="w-20"
                      value={row.rotationOrder}
                      onChange={(e) => onChange({ rotationOrder: e.target.value })}
                      inputMode="numeric"
                      placeholder="—"
                    />
                  </div>
                </>
              )}
              <div>
                <Label>Term</Label>
                <Select value={row.rotationTerm} onValueChange={(v) => onChange({ rotationTerm: v })}>
                  <SelectTrigger className="w-28"><SelectValue placeholder="Pick" /></SelectTrigger>
                  <SelectContent>
                    {(draftTerms?.identities ?? []).map((t) => (
                      <SelectItem key={t} value={t}>{t}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </>
          )}
        </div>
      )}
    </li>
  );
}
