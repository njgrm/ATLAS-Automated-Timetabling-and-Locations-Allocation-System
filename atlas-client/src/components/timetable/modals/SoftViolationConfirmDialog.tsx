import { AlertTriangle } from 'lucide-react';

import type { Violation } from '@/types';
import { Button } from '@/ui/button';
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from '@/ui/dialog';

type SoftViolationConfirmDialogProps = {
	open: boolean;
	warnings: Violation[];
	commitLoading: boolean;
	onCancel: () => void;
	onConfirm: () => void;
	formatConstraintMessage: (message: string) => string;
};

export function SoftViolationConfirmDialog({
	open,
	warnings,
	commitLoading,
	onCancel,
	onConfirm,
	formatConstraintMessage,
}: SoftViolationConfirmDialogProps) {
	return (
		<Dialog open={open} onOpenChange={(isOpen) => { if (!isOpen) onCancel(); }}>
			<DialogContent className="max-w-md">
				<DialogHeader>
					<DialogTitle className="flex items-center gap-2">
						<AlertTriangle className="size-4 text-amber-500" />
						Soft Constraint Warnings
					</DialogTitle>
					<DialogDescription>
						This edit introduces {warnings.length} soft warning(s).
						 You can still apply it, but review the issues below.
					</DialogDescription>
				</DialogHeader>
				<div className="max-h-48 overflow-auto space-y-1.5 py-2">
					{warnings.map((warning, index) => (
						<div
							key={index}
							className="rounded border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800"
						>
							<span className="font-mono text-[0.625rem] opacity-60 mr-1.5">{warning.code}</span>
							{formatConstraintMessage(warning.message)}
						</div>
					))}
				</div>
				<DialogFooter className="gap-2 sm:gap-0">
					<Button variant="outline" size="sm" onClick={onCancel}>Cancel</Button>
					<Button variant="default" size="sm" disabled={commitLoading} onClick={onConfirm}>
						{commitLoading ? 'Applying…' : 'Apply Anyway'}
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}
