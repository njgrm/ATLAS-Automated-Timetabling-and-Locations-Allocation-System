import { Button } from '@/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/ui/dialog';

export type FacultyIssuePivotDialogProps = {
	open: boolean;
	teacherLabel: string | null;
	onOpenChange: (open: boolean) => void;
	onCancel: () => void;
	onConfirm: () => void;
};

export function TimetableFacultyIssuePivotDialog({
	open,
	teacherLabel,
	onOpenChange,
	onCancel,
	onConfirm,
}: FacultyIssuePivotDialogProps) {
	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent data-testid="timetable-faculty-issue-pivot-dialog">
				<DialogHeader>
					<DialogTitle>Open {teacherLabel}&apos;s timetable?</DialogTitle>
					<DialogDescription>
						This issue belongs to {teacherLabel}. Switch to that teacher&apos;s timetable and highlight the affected session?
					</DialogDescription>
				</DialogHeader>
				<DialogFooter>
					<Button type="button" variant="outline" onClick={onCancel}>Cancel</Button>
					<Button type="button" onClick={onConfirm}>Open teacher timetable</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}
