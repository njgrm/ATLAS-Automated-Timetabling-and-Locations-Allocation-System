import { Undo2 } from 'lucide-react';

import { Button } from '@/ui/button';

export function TimetablePublishedReturnAction({ visible, onReturn }: { visible: boolean; onReturn: () => void }) {
	if (!visible) return null;
	return (
		<Button
			type="button"
			variant="outline"
			size="sm"
			className="h-11 shrink-0 gap-1.5 px-3 text-sm"
			onClick={onReturn}
			data-testid="timetable-return-to-published"
		>
			<Undo2 className="size-3.5" aria-hidden="true" />
			Return to published
		</Button>
	);
}
