import { History } from 'lucide-react';

import type { ScheduleReviewDialogsContext } from '@/components/timetable/timetableContexts.types';
import { Badge } from '@/ui/badge';
import { Button } from '@/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/ui/dialog';

export function TimetableAssignmentDialogs({ context }: { context: ScheduleReviewDialogsContext }) {
	const {
		showEditHistory, setShowEditHistory, editHistory,
	} = context;

	return <>
		<Dialog open={showEditHistory} onOpenChange={setShowEditHistory}>
			<DialogContent className="max-w-lg"><DialogHeader><DialogTitle className="flex items-center gap-2"><History className="size-4" />Manual edit history</DialogTitle><DialogDescription>{editHistory.length === 0 ? 'No manual edits have been made on this run.' : `${editHistory.length} edit${editHistory.length === 1 ? '' : 's'} recorded.`}</DialogDescription></DialogHeader><div className="max-h-64 space-y-2 overflow-auto py-2">{editHistory.map((edit) => { const summary = edit.validationSummary as Record<string, number> | null; return <div key={edit.id} className="rounded-md border p-3 text-xs"><div className="flex items-center justify-between gap-2"><Badge variant="outline" className="text-xs">{edit.editType.replaceAll('_', ' ')}</Badge><span className="text-muted-foreground">{new Date(edit.createdAt).toLocaleString()}</span></div>{summary && <p className="mt-1 text-muted-foreground">Blocking: {summary.hardCount ?? 0}, warnings: {summary.softCount ?? 0}</p>}</div>; })}</div><DialogFooter><Button variant="outline" onClick={() => setShowEditHistory(false)}>Close</Button></DialogFooter></DialogContent>
		</Dialog>
	</>;
}
