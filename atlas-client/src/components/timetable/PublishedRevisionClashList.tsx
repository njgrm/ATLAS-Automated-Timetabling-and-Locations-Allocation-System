import { AlertTriangle, LocateFixed } from 'lucide-react';

import type { DescribedClash } from '@/lib/published-revision-clashes';
import { Button } from '@/ui/button';

type PublishedRevisionClashListProps = {
	clashes: DescribedClash[];
	/** Highlights the clashing classes on the timetable. */
	onShowOnTimetable?: (entryIds: string[]) => void;
	/** Shown above the list; defaults to the count and a nothing-saved assurance. */
	heading?: string;
	maxVisible?: number;
};

/**
 * LANE-C POST-PUBLISH-C01 — the clashes a published change would cause, one
 * plain sentence each with what to do next. Shared by the teacher-leaving
 * sheet, the revision dialog and the published swap.
 */
export function PublishedRevisionClashList({ clashes, onShowOnTimetable, heading, maxVisible = 6 }: PublishedRevisionClashListProps) {
	if (clashes.length === 0) return null;
	const visible = clashes.slice(0, maxVisible);
	const hidden = clashes.length - visible.length;
	return (
		<div className="space-y-2 rounded-md border border-destructive/30 bg-destructive/5 p-3" role="alert" data-testid="published-revision-clash-list">
			<p className="flex items-start gap-1.5 text-sm font-semibold text-destructive">
				<AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
				{heading ?? `${clashes.length} clash${clashes.length === 1 ? '' : 'es'} found. Nothing was saved.`}
			</p>
			<ul className="space-y-2">
				{visible.map((clash) => (
					<li key={clash.key} className="rounded-md bg-background p-2 text-sm" data-testid="published-revision-clash">
						<p className="font-semibold text-foreground">{clash.title}</p>
						<p className="text-foreground">{clash.sentence}</p>
						{clash.action ? <p className="mt-0.5 text-muted-foreground">What to do: {clash.action}</p> : null}
						{onShowOnTimetable && clash.entryIds.length > 0 ? (
							<Button
								type="button"
								variant="ghost"
								size="sm"
								className="mt-1 h-8 gap-1.5 px-1.5 text-xs text-primary"
								onClick={() => onShowOnTimetable(clash.entryIds)}
							>
								<LocateFixed className="size-3.5" aria-hidden="true" />
								Show on timetable
							</Button>
						) : null}
					</li>
				))}
			</ul>
			{hidden > 0 ? <p className="text-xs text-muted-foreground">{hidden} more clash{hidden === 1 ? '' : 'es'} not shown.</p> : null}
		</div>
	);
}
