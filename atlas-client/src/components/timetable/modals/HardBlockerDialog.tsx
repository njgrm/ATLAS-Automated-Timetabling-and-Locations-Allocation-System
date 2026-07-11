import { AlertCircle, ShieldAlert } from 'lucide-react';

import { Button } from '@/ui/button';
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from '@/ui/dialog';
import { ScrollArea } from '@/ui/scroll-area';

type BlockerItem = {
	humanTitle: string;
	humanDetail: string;
	delta?: string;
};

type HardBlockerDialogProps = {
	open: boolean;
	items: BlockerItem[];
	onClose: () => void;
};

export function HardBlockerDialog({ open, items, onClose }: HardBlockerDialogProps) {
	return (
		<Dialog open={open} onOpenChange={(isOpen) => { if (!isOpen) onClose(); }}>
			<DialogContent className="w-[calc(100%-2rem)] sm:max-w-md rounded-2xl p-6 overflow-hidden">
				<DialogHeader className="space-y-4">
					<div className="flex items-center justify-center w-12 h-12 rounded-full bg-red-100 ring-4 ring-red-50 mx-auto">
						<ShieldAlert className="size-6 text-red-600" />
					</div>
					<DialogTitle className="text-xl font-bold tracking-tight text-center text-red-900">Edit Blocked</DialogTitle>
					<DialogDescription className="text-center text-sm text-foreground">
						This change violates one or more <strong className="font-semibold text-red-700">hard constraints</strong> and cannot be applied to the schedule.
					</DialogDescription>
				</DialogHeader>

				<div className="mt-4 bg-red-50/50 border border-red-100 rounded-xl overflow-hidden max-h-[40vh]">
					<ScrollArea className="max-h-[40vh]">
						<div className="p-4 space-y-3">
							{items.map((item, index) => (
								<div key={index} className="flex items-start gap-2">
									<AlertCircle className="size-4 shrink-0 mt-0.5 text-red-500" />
									<div className="space-y-0.5">
										<p className="text-sm font-medium text-red-800 leading-snug">{item.humanTitle}</p>
										<p className="text-xs text-red-700/80 leading-snug">{item.humanDetail}</p>
										{item.delta && <p className="mt-0.5 font-mono text-xs text-red-500/70">{item.delta}</p>}
									</div>
								</div>
							))}
						</div>
					</ScrollArea>
				</div>

				<DialogFooter className="mt-6 sm:justify-center">
					<Button
						variant="outline"
						onClick={onClose}
						className="w-full sm:w-auto min-w-32 active:scale-95 transition-all text-red-700 border-red-200 hover:bg-red-50"
					>
						Understood
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}
