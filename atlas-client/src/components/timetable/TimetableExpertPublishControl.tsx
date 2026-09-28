/**
 * C11 D — the Expert header's publication gate, extracted from
 * `ScheduleReviewWorkspaceHeader.tsx` (961 physical lines against the 1000-line cap,
 * AGENTS.md §8) so the persistent draft strip could be added there.
 *
 * The gate is UNCHANGED — every clause, in the same order, with the same wording —
 * but it now has ONE definition in one place, so the header's own Publish control
 * and the strip's Publish control cannot disagree about whether publishing is
 * allowed. That is the C11 D boundary: the strip must not be a second publication
 * path, and it must not weaken this gate to fit.
 */
import { Send } from 'lucide-react';

import { Button } from '@/ui/button';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/ui/tooltip';

export type ExpertPublishGate = {
	allowed: boolean;
	/** The reason, shown beside a disabled control AND in its tooltip. */
	reason: string;
};

/**
 * One gate, one wording. `allowed` decides the `disabled` prop; `reason` is the
 * single sentence both the tooltip and the strip's visible status line render, so
 * a reason can never be shown in one place and contradicted in the other.
 */
export function resolveExpertPublishGate(input: {
	hasDraft: boolean;
	isRunPublished: boolean;
	blockingHardCount: number;
	unassignedCount: number;
	isPreGenerationView: boolean;
}): ExpertPublishGate {
	if (input.isRunPublished) {
		return {
			allowed: false,
			reason: 'This run is already published. Create an effective-dated revision instead of re-publishing.',
		};
	}
	if (input.blockingHardCount > 0) {
		return { allowed: false, reason: `Cannot publish: ${input.blockingHardCount} hard violation(s) remaining` };
	}
	if (input.unassignedCount > 0) {
		return { allowed: false, reason: `Cannot publish: ${input.unassignedCount} session(s) still need placing` };
	}
	if (!input.hasDraft) {
		return { allowed: false, reason: 'There is no generated run to publish yet.' };
	}
	if (input.isPreGenerationView) {
		return { allowed: false, reason: 'Publish a generated run, not the draft workspace.' };
	}
	return { allowed: true, reason: 'Publish this schedule' };
}

export function TimetableExpertPublishControl({
	gate,
	onPublish,
}: {
	gate: ExpertPublishGate;
	onPublish: () => void;
}) {
	return (
		<TooltipProvider>
			<Tooltip>
				<TooltipTrigger asChild>
					{/* AGENTS.md §8 — no raw `title`; the disabled reason is also rendered
					    as visible text by the draft strip, so it is never hover-only. */}
					<Button
						variant="outline"
						size="sm"
						className="h-8 shrink-0 gap-1.5"
						disabled={!gate.allowed}
						onClick={onPublish}
						data-testid="timetable-advanced-publish"
						aria-label={gate.allowed ? 'Publish this schedule' : `Publish this schedule. ${gate.reason}`}
					>
						<Send className="size-3.5" />
						Publish
					</Button>
				</TooltipTrigger>
				<TooltipContent>{gate.reason}</TooltipContent>
			</Tooltip>
		</TooltipProvider>
	);
}
