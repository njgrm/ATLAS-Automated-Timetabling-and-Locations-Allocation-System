import { AlertTriangle, CheckCircle2, ChevronDown } from 'lucide-react';

import { Badge } from '@/ui/badge';
import { Button } from '@/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/ui/popover';
import { cn } from '@/lib/utils';
import type { TermAuthority } from '@/types';

/**
 * A3-09: the EnrollPro term-authority banner.
 *
 * Only the ROUTINE healthy state compacts. `VERIFIED_LIVE` is a one-line inline
 * stat status whose ordered-term badges live in a `@/ui` Popover — never a raw
 * `<details>` and never a `title` attribute (AGENTS.md §8). The
 * `VERIFIED_CACHED` (amber) and `BLOCKED` (destructive, `role="alert"`)
 * presentations are byte-for-byte the pre-existing blocks: an operator must
 * never have to hunt for a broken source-of-term authority.
 *
 * Nothing here is deleted. The authority `message`, the S.Y. year label, the
 * ordered-term identities, which term is active, and the
 * participation/ownership sentence all remain reachable — for `VERIFIED_LIVE`
 * inside the popover, and inline for the other two states.
 */
type Props = {
	termAuthority: TermAuthority | null;
};

export function SubjectTermAuthorityBanner({ termAuthority }: Props) {
	if (!termAuthority) return null;

	const isRoutineLive = termAuthority.state === 'VERIFIED_LIVE';
	const contract = termAuthority.contract ?? null;
	const termCount = contract?.terms.length ?? 0;

	if (isRoutineLive) {
		return (
			<div
				role="status"
				data-testid="subject-term-authority"
				data-term-state={termAuthority.state}
				data-presentation="compact"
				className="mx-4 mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground"
			>
				<CheckCircle2 className="size-3.5 shrink-0 text-emerald-600" aria-hidden="true" />
				<span className="font-semibold text-foreground">EnrollPro year and terms verified live</span>
				<span aria-hidden="true">·</span>
				<span className="font-mono">
					{contract ? `S.Y. ${contract.schoolYear.yearLabel} · ${termCount} ordered term${termCount === 1 ? '' : 's'}` : 'read-only source'}
				</span>
				<span className="sr-only">{termAuthority.message}</span>
				{contract ? (
					<Popover>
						<PopoverTrigger asChild>
							<Button
								type="button"
								variant="ghost"
								size="sm"
								data-testid="subject-term-authority-terms-trigger"
								className="h-6 shrink-0 gap-1 px-1.5 text-xs font-semibold text-primary hover:underline"
							>
								View terms
								<ChevronDown className="size-3" />
							</Button>
						</PopoverTrigger>
						<PopoverContent align="start" className="w-80 space-y-2 p-3" data-testid="subject-term-authority-terms">
							<p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
								S.Y. {contract.schoolYear.yearLabel} · ordered terms from EnrollPro
							</p>
							<div className="flex flex-wrap gap-1.5">
								{contract.terms.map((term) => (
									<Badge key={term.identity} variant="outline" className="bg-background/70">
										{term.displayLabel}{term.identity === contract.activeTerm?.identity ? ' · Active' : ''}
									</Badge>
								))}
							</div>
							<p className="text-xs leading-relaxed text-muted-foreground">{termAuthority.message}</p>
							<p className="text-xs font-medium text-muted-foreground">
								Participation, grade and program scope, weekly minutes, rotation, and room needs are ATLAS-owned and edited below.
							</p>
						</PopoverContent>
					</Popover>
				) : null}
			</div>
		);
	}

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
			<p className="mt-1 text-xs font-medium opacity-90">{termAuthority.message}</p>
			{contract ? (
				<div className="mt-2">
					<p className="text-xs font-semibold uppercase tracking-wide opacity-80">S.Y. {contract.schoolYear.yearLabel} · ordered terms from EnrollPro</p>
					<div className="mt-1.5 flex flex-wrap gap-1.5">
						{contract.terms.map((term) => (
							<Badge key={term.identity} variant="outline" className="bg-background/70">
								{term.displayLabel}{term.identity === contract.activeTerm?.identity ? ' · Active' : ''}
							</Badge>
						))}
					</div>
				</div>
			) : null}
			<p className="mt-2 text-xs font-medium opacity-90">Participation, grade and program scope, weekly minutes, rotation, and room needs are ATLAS-owned and edited below.</p>
		</div>
	);
}
