import { AlertTriangle, Info } from 'lucide-react';

import { Badge } from '@/ui/badge';
import { Button } from '@/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/ui/popover';
import { cn } from '@/lib/utils';
import { resolveTermAuthorityCopy } from './subject-source-utils';
import { SubjectTermContractBadges } from './SubjectTermContractPopover';
import type { TermAuthority } from '@/types';

/**
 * A3-09/A3-C9: the EnrollPro term-authority EXCEPTION surface.
 *
 * A3-09 compacted only the ROUTINE healthy state into a one-line strip. A3-C9
 * removes that strip outright: a scheduler opens /subjects to work the catalog,
 * and a permanent "EnrollPro year and terms verified live" line is status they
 * did not ask for. It is the only thing between the page and its filters, and
 * it was pushing the filter row down on the 1366x768 target.
 *
 * `VERIFIED_CACHED` (amber, stale source) and `BLOCKED` (destructive,
 * `role="alert"`) are untouched and still loud. They are the states an operator
 * must never have to hunt for, so neither was in scope for removal.
 *
 * NO EVIDENCE IS DROPPED. The S.Y. year label, the ordered-term identities, the
 * active-term marker, the authority message and the ATLAS-ownership sentence
 * all remain reachable: inline in the two exception blocks below, and — for
 * the routine state, which renders nothing at all here — in
 * `SubjectTermContractPopover`, a quiet affordance pinned to the table footer.
 * That is the non-header, non-strip route; it is not a fallback for the
 * exceptions, it is where the ROUTINE contract now lives.
 */
type Props = {
	termAuthority: TermAuthority | null;
};

export function SubjectTermAuthorityBanner({ termAuthority }: Props) {
	if (!termAuthority) return null;

	// A3-C9: the routine healthy state renders NOTHING here. The contract is
	// still shown to the operator — just not as a header status, and not as a
	// freshness claim. See `SubjectTermContractPopover`.
	if (termAuthority.state === 'VERIFIED_LIVE') return null;

	const contract = termAuthority.contract ?? null;

	// A3-C4: `termAuthority.message` is SERVER-AUTHORED engineer prose
	// ("Saved term contract failed its semantic revision check."). The server
	// file is out of this stream's fence and is not edited; the client keys calm
	// operator copy off the `code` it already receives, in the same
	// description/nextAction tone as `resolveSubjectSourceCopy`, and keeps the
	// raw code plus the raw message in a labelled diagnostic affordance. An
	// empty message also falls back to calm copy rather than rendering an empty
	// element inside a coloured exception banner.
	const { description, nextAction, code } = resolveTermAuthorityCopy(termAuthority);
	const rawMessage = (termAuthority.message ?? '').trim();
	const hasDetail = Boolean(code) || rawMessage.length > 0;

	// VERIFIED_CACHED and BLOCKED keep the full, uncompacted block. A stale or
	// blocked source of term authority is an exception the operator must see.
	return (
		<div
			role={termAuthority.state === 'BLOCKED' ? 'alert' : 'status'}
			data-testid="subject-term-authority"
			data-term-state={termAuthority.state}
			data-presentation="full"
			className={cn(
				'mx-4 mt-3 rounded-xl border px-4 py-3 text-sm',
				termAuthority.state === 'VERIFIED_CACHED' && 'border-amber-200 bg-amber-50 text-amber-900',
				termAuthority.state === 'BLOCKED' && 'border-destructive/30 bg-destructive/10 text-destructive',
			)}
		>
			<div className="flex flex-wrap items-center gap-2">
				<AlertTriangle className="size-4" />
				<span className="font-bold">
					{termAuthority.state === 'VERIFIED_CACHED' ? 'Using saved EnrollPro year and terms' : 'EnrollPro year or term authority blocked'}
				</span>
				<Badge variant="outline" className="bg-background/70 font-semibold uppercase tracking-wide">Read-only source</Badge>
				{contract ? <Badge variant="outline">{contract.format}</Badge> : null}
			</div>
			<p className="mt-1 text-xs font-medium opacity-90">{description}</p>
			{nextAction && <p className="mt-1 text-xs font-medium opacity-90">{nextAction}</p>}
			{/* A3-C4: the raw code and the raw server sentence are never destroyed —
				they move behind a labelled @/ui diagnostic, which is what AGENTS.md §8
				requires (and forbids the `title` attribute). This is also the
				pass-through for runtime-sourced text: whatever the runtime supplies is
				preserved verbatim here for support, while the primary read above stays
				calm and actionable. */}
			{hasDetail ? (
				<Popover>
					<PopoverTrigger asChild>
						<Button
							type="button"
							variant="ghost"
							size="sm"
							data-testid="subject-term-authority-detail"
							aria-label={`Term authority details${code ? ` (${code})` : ''}`}
							className="mt-1 h-6 gap-1 px-1.5 text-xs font-semibold text-primary hover:underline"
						>
							<Info className="size-3" />
							<span className="font-mono text-[0.65rem]">{code ?? 'Details'}</span>
						</Button>
					</PopoverTrigger>
					<PopoverContent align="start" className="w-80 space-y-2 p-3 text-xs leading-relaxed">
						<p className="font-semibold uppercase tracking-wide text-muted-foreground">Technical detail</p>
						{code ? <p><span className="font-semibold">Code</span> · <span className="font-mono">{code}</span></p> : null}
						{rawMessage ? <p><span className="font-semibold">Server message</span> · {rawMessage}</p> : null}
						{!code && !rawMessage ? <p>No further technical detail was supplied.</p> : null}
					</PopoverContent>
				</Popover>
			) : null}
			{contract ? (
				<div className="mt-2">
					<p className="text-xs font-semibold uppercase tracking-wide opacity-80">S.Y. {contract.schoolYear.yearLabel} · ordered terms from EnrollPro</p>
					{/* A3-C9: the ordered-term badges are rendered by the SAME
						component the routine footer affordance uses, so the two can
						never drift apart on the active-term marker or the labels. */}
					<div className="mt-1.5">
						<SubjectTermContractBadges contract={contract} />
					</div>
				</div>
			) : null}
			<p className="mt-2 text-xs font-medium opacity-90">Participation, grade and program scope, weekly minutes, rotation, and room needs are ATLAS-owned and edited below.</p>
		</div>
	);
}
