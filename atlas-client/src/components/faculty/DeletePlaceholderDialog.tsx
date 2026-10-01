import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/ui/dialog';
import { Button } from '@/ui/button';
import type { FacultySummary } from '@/types';

export function DeletePlaceholderDialog({
	teacher,
	deleting,
	onClose,
	onConfirm,
}: {
	teacher: FacultySummary | null;
	deleting: boolean;
	onClose: () => void;
	onConfirm: () => void;
}) {
	return (
		<Dialog open={teacher !== null} onOpenChange={(open) => !open && onClose()}>
			<DialogContent resizable={false} className="sm:max-w-md">
				<DialogHeader>
					<DialogTitle className="text-lg font-bold text-red-600">Delete Temporary Teacher</DialogTitle>
					<DialogDescription>
						Are you sure you want to delete <span className="font-semibold text-foreground">{teacher?.firstName} {teacher?.lastName}</span>? This action is permanent and will remove all their assigned teaching load sections.
					</DialogDescription>
				</DialogHeader>
				<DialogFooter className="gap-2 sm:gap-0">
					<Button variant="outline" onClick={onClose} disabled={deleting} className="h-9">Cancel</Button>
					<Button variant="destructive" onClick={onConfirm} disabled={deleting} className="h-9 font-semibold">
						{deleting ? 'Deleting...' : 'Delete Permanently'}
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}
