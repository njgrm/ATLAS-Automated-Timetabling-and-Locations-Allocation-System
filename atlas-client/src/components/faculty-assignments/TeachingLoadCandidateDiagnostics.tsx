import { Info } from 'lucide-react';

import { Badge } from '@/ui/badge';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/ui/tooltip';
import {
	summarizeCandidateRejections,
} from '@/lib/teaching-load-suggestion-diagnostics';
import type { TeachingLoadCandidateRejection } from '@/types';

type TeachingLoadCandidateDiagnosticsProps = {
	rejections: TeachingLoadCandidateRejection[];
};

/**
 * Concise candidate-eligibility diagnostics. Extracted from the suggestion modal
 * so the rendered grouping can be asserted directly (the modal itself renders
 * through a Radix portal and is not server-renderable).
 *
 * Invariant enforced by the helper: every rejection row appears in exactly one
 * group, so the header count always equals the sum of the group counts.
 */
export function TeachingLoadCandidateDiagnostics({ rejections }: TeachingLoadCandidateDiagnosticsProps) {
	if (!rejections || rejections.length === 0) return null;
	const rejectionGroups = summarizeCandidateRejections(rejections);

	return (
		<div className="max-w-3xl mx-auto space-y-2 pt-4 border-t border-border/40" data-testid="teaching-load-candidate-diagnostics">
			<div className="flex items-center justify-between">
				<h4 className="text-xs font-bold text-muted-foreground uppercase tracking-widest flex items-center gap-2">
					<Info className="size-3.5" /> Candidate eligibility
				</h4>
				<span className="text-xs text-muted-foreground font-bold uppercase" data-testid="teaching-load-candidate-skipped-count">
					{rejections.length} skipped
				</span>
			</div>
			<p className="text-xs font-medium text-muted-foreground leading-relaxed">
				Zero-load teachers are always evaluated. These candidates were skipped before an assignment was suggested:
			</p>
			<div className="grid gap-1.5" data-testid="teaching-load-rejection-groups">
				{rejectionGroups.map((group) => (
					<div
						key={group.reason}
						className="flex items-center justify-between gap-2 rounded-lg border border-border/50 bg-background px-2.5 py-1.5 text-xs"
						data-testid={`teaching-load-rejection-${group.reason}`}
						data-group-count={group.count}
					>
						<Tooltip>
							<TooltipTrigger asChild>
								<span className="shrink-0 font-bold text-foreground underline decoration-dotted decoration-muted-foreground/40 underline-offset-2">
									{group.label}
								</span>
							</TooltipTrigger>
							<TooltipContent side="top" className="max-w-72 text-xs leading-relaxed">{group.detail}</TooltipContent>
						</Tooltip>
						{group.facultyNames.length > 0 && (
							<TooltipProvider>
								<Tooltip>
									<TooltipTrigger asChild>
										<span className="min-w-0 truncate text-muted-foreground">
											{group.facultyNames.join(', ')}
											{group.count > group.facultyNames.length ? ` +${group.count - group.facultyNames.length}` : ''}
										</span>
									</TooltipTrigger>
									<TooltipContent side="top">{group.facultyNames.join(', ')}</TooltipContent>
								</Tooltip>
							</TooltipProvider>
						)}
						<Badge
							variant="outline"
							className="h-5 shrink-0 border-border/60 px-1.5 text-xs font-bold tabular-nums"
						>
							{group.count}
						</Badge>
					</div>
				))}
			</div>
		</div>
	);
}
