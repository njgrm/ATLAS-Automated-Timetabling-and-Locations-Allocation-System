import { AlertTriangle, Loader2, RefreshCw, RotateCw, SearchCheck, ShieldAlert, Wrench } from 'lucide-react';

import { cn } from '@/lib/utils';
import { Badge } from '@/ui/badge';
import { Button } from '@/ui/button';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/ui/tooltip';
import { formatCheckedAtAge } from '@/components/timetable/timetableWorkspaceTruth';
import type { GenerationInputComparison } from '@/types';

export type InputStateBannerProps = {
	inputState: GenerationInputComparison | null | undefined;
	changedDomainLabels: string[];
	loading: boolean;
	syncing: boolean;
	hasSelectedEntry: boolean;
	generationEnabled: boolean;
	onPreviewImpact: () => void;
	onSync: () => void;
	onManualRepair: () => void;
	onRegenerate: () => void;
};

/**
 * B-14/B-10 — the Advanced run-input freshness banner. Extracted from the
 * header to keep that file within the component-size budget and to surface the
 * comparison's checked-at age so a cached read never looks current.
 */
export function ScheduleReviewInputStateBanner({
	inputState,
	changedDomainLabels,
	loading,
	syncing,
	hasSelectedEntry,
	generationEnabled,
	onPreviewImpact,
	onSync,
	onManualRepair,
	onRegenerate,
}: InputStateBannerProps) {
	const isStale = inputState?.status === 'STALE';
	const checkedAge = formatCheckedAtAge(inputState?.checkedAt);
	return (
		<div className={cn(
			'mx-2 mb-1 flex h-8 flex-nowrap items-center justify-between gap-2 overflow-hidden rounded-lg border px-2 py-0 text-xs shadow-sm sm:mx-4 [@media(max-height:500px)]:hidden',
			isStale ? 'border-amber-200 bg-amber-50 text-amber-950' : 'border-sky-200 bg-sky-50 text-sky-950',
		)}>
			<div className="flex min-w-0 items-center gap-2">
				<div className={cn(
					'flex size-6 shrink-0 items-center justify-center rounded-md',
					isStale ? 'bg-amber-100 text-amber-700' : 'bg-sky-100 text-sky-700',
				)}>
					{isStale ? <AlertTriangle className="size-4" /> : <ShieldAlert className="size-4" />}
				</div>
				<div className="min-w-0">
					<div className="flex min-w-0 items-center gap-2">
						<p className="shrink-0 text-xs font-bold">{isStale ? 'Setup changes detected' : 'Setup comparison unavailable'}</p>
						{isStale && changedDomainLabels.slice(0, 3).map((label) => (
							<Badge key={label} variant="outline" className="h-5 border-amber-300 bg-white/70 px-1.5 text-xs font-bold text-amber-800">
								{label}
							</Badge>
						))}
					</div>
					<p className="hidden truncate text-xs font-medium leading-relaxed text-current/80 lg:block">
						{inputState?.message ?? 'ATLAS could not check this run against the latest setup data.'}
						{checkedAge ? ` · ${checkedAge}` : ''}
					</p>
				</div>
			</div>

			<div className="flex shrink-0 items-center gap-1.5 lg:justify-end">
				<Button variant="outline" size="sm" className="h-8 gap-1.5 bg-background/80" onClick={onPreviewImpact}>
					<SearchCheck className="size-3.5" />
					<span className="hidden sm:inline">Preview Impact</span>
				</Button>
				<Button
					variant="outline"
					size="sm"
					className="h-8 gap-1.5 bg-background/80 font-semibold border-amber-300 text-amber-900 hover:bg-amber-100 hover:text-amber-950"
					onClick={onSync}
					disabled={loading || syncing}
				>
					{syncing ? <Loader2 className="size-3.5 animate-spin" /> : <RefreshCw className="size-3.5" />}
					<span className="hidden sm:inline">Sync with Setup</span>
				</Button>
				<TooltipProvider>
					<Tooltip>
						<TooltipTrigger asChild>
							<span>
								<Button
									variant="outline"
									size="sm"
									className="h-8 gap-1.5 bg-background/80"
									disabled={!hasSelectedEntry}
									onClick={onManualRepair}
								>
									<Wrench className="size-3.5" />
									<span className="hidden sm:inline">Manually Repair</span>
								</Button>
							</span>
						</TooltipTrigger>
						<TooltipContent>{hasSelectedEntry ? 'Repair the selected class without regenerating.' : 'Select a timetable class before using manual repair.'}</TooltipContent>
					</Tooltip>
				</TooltipProvider>
				{/* LANE-C-PLAIN-LANGUAGE-C03 (J4.5) — this was the only
				    destructive-styled header button, worn by a routine rebuild. The
				    action is unchanged; only the register is. Expert-only today. */}
				<Button variant="outline" size="sm" className="h-8 gap-1.5" disabled={!generationEnabled || loading} onClick={onRegenerate}>
					<RotateCw className="size-3.5" />
					<span className="hidden sm:inline">Regenerate Draft</span>
				</Button>
			</div>
		</div>
	);
}
