/**
 * A2 C11 S2 (item 2) — the Expert header's ONE generation control, extracted
 * verbatim.
 *
 * `ScheduleReviewWorkspaceHeader.tsx` stood at 999 physical lines, one under the
 * §8 1000-line cap, and this cycle had to add the change notice to the Expert
 * layout so the two layouts could not drift onto two different banners. §8's
 * answer is to extract a sub-component, not to delete a comment, so the
 * tooltip-wrapped Generate/repair control — 33 physical lines of a purely
 * presentational cluster — moved here unchanged.
 *
 * NOTHING DECIDES HERE. `repairHref`, `repairLabel`, `enabled` and the blocked
 * reason all arrive derived from the ONE shared capability model
 * (`deriveTimetableCapabilities`), so this control cannot become a second
 * generation authority. The testids, the class names, the `Tooltip` and the
 * `Wrench`/`Play`/`Loader2` signs are byte-for-byte the ones the header rendered
 * before, so every existing row that clicks `timetable-advanced-generate` or
 * `timetable-advanced-generate-repair` still decides on the same element.
 *
 * A disabled control states its reason in a `@/ui` `Tooltip` here, exactly as it
 * did in the header, and the header's own `timetable-advanced-generate` tooltip
 * text is unchanged.
 */
import { Link } from 'react-router-dom';
import { Loader2, Play, Wrench } from 'lucide-react';

import { Button } from '@/ui/button';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/ui/tooltip';

export function ExpertGenerationControl({
	repairHref,
	repairLabel,
	enabled,
	blockedReason,
	generating,
	loading,
	onTrigger,
}: {
	/** A real repair destination, or null when the gate offers no route. */
	repairHref: string | null;
	repairLabel: string;
	/** The shared generation gate. */
	enabled: boolean;
	/** The gate's own reason; the tooltip states it and never invents one. */
	blockedReason: string;
	generating: boolean;
	loading: boolean;
	onTrigger: () => void;
}) {
	return (
		<TooltipProvider>
			<Tooltip>
				<TooltipTrigger asChild>
					{repairHref ? (
						<Button asChild variant="default" size="sm" className="h-8 gap-1.5" data-testid="timetable-advanced-generate-repair">
							<Link to={repairHref}>
								<Wrench className="size-3.5" />
								{repairLabel}
							</Link>
						</Button>
					) : (
						<Button
							variant="default"
							size="sm"
							className="h-8 gap-1.5"
							disabled={!enabled || loading}
							onClick={onTrigger}
							data-testid="timetable-advanced-generate"
						>
							{generating ? <Loader2 className="size-3.5 animate-spin" /> : <Play className="size-3.5" />}
							{generating ? 'Generating…' : 'Generate'}
						</Button>
					)}
				</TooltipTrigger>
				<TooltipContent>
					{enabled
						? 'Trigger a new schedule generation run'
						: blockedReason}
				</TooltipContent>
			</Tooltip>
		</TooltipProvider>
	);
}
