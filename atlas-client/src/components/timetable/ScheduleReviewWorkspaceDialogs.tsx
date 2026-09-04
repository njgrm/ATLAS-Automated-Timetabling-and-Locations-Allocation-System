import { Badge } from '@/ui/badge';
import { Button } from '@/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/ui/dialog';
import { Loader2, RefreshCw } from 'lucide-react';

export type SetupImpactDialogProps = {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	inputState: { status: string; actionHint?: string } | null | undefined;
	changedDomainLabels: string[];
};

export function SetupImpactDialog({ open, onOpenChange, inputState, changedDomainLabels }: SetupImpactDialogProps) {
	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent className="sm:max-w-md">
				<DialogHeader>
					<DialogTitle>{inputState?.status === 'STALE' ? 'Setup changes detected' : 'Setup comparison unavailable'}</DialogTitle>
					<DialogDescription>
						{inputState?.status === 'STALE'
							? 'This draft was not changed automatically. Review the changed setup areas, then choose manual repair or regenerate when ready.'
							: 'This draft can still be reviewed, but ATLAS cannot prove whether its setup inputs match the latest data.'}
					</DialogDescription>
				</DialogHeader>
				<div className="rounded-lg border border-border bg-muted/30 p-3">
					<p className="mb-2 text-xs font-bold uppercase text-muted-foreground">Changed setup areas</p>
					<div className="flex flex-wrap gap-2">
						{changedDomainLabels.map((label) => (
							<Badge key={label} variant="outline" className="bg-background text-xs font-semibold">
								{label}
							</Badge>
						))}
					</div>
				</div>
				<p className="text-xs leading-relaxed text-muted-foreground">{inputState?.actionHint}</p>
				<DialogFooter>
					<Button variant="outline" size="sm" onClick={() => onOpenChange(false)}>Close</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}

export type SyncTimetableConfirmDialogProps = {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	syncing: boolean;
	onSyncNow: () => void;
};

export function SyncTimetableConfirmDialog({ open, onOpenChange, syncing, onSyncNow }: SyncTimetableConfirmDialogProps) {
	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent className="sm:max-w-md">
				<DialogHeader>
					<DialogTitle>Sync Timetable with Setup</DialogTitle>
					<DialogDescription className="space-y-2">
						<span>This will update the timetable draft to match live setup changes:</span>
						<ul className="list-disc list-inside text-xs space-y-1">
							<li>Sync scheduled classes with current teacher assignments.</li>
							<li>Import newly created sections or subjects into the unassigned queue.</li>
							<li>Remove entries for deleted sections or subjects.</li>
							<li>Re-evaluate policy violations.</li>
						</ul>
						<p className="text-xs font-semibold text-amber-600">
							Manual slot swaps and pins will be preserved, but new conflicts may be highlighted.
						</p>
					</DialogDescription>
				</DialogHeader>
				<DialogFooter>
					<Button variant="outline" size="sm" onClick={() => onOpenChange(false)} disabled={syncing}>
						Cancel
					</Button>
					<Button variant="default" size="sm" onClick={onSyncNow} disabled={syncing}>
						{syncing ? <Loader2 className="size-3 mr-1.5 animate-spin" /> : <RefreshCw className="size-3 mr-1.5" />}
						Sync Now
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}
