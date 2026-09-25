import { AlertTriangle } from 'lucide-react';

import type { Violation, ViolationCode } from '@/types';
import { Button } from '@/ui/button';
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from '@/ui/dialog';
import { UNLABELLED_RULE_SENTENCE } from '@/lib/timetable-plain-language';
import { VIOLATION_PRESENTATION } from '@/lib/violation-presentation';

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
						{warnings.length === 1
							? 'This edit introduces 1 warning. You can still apply it, but check the one below.'
							: `This edit introduces ${warnings.length} warnings. You can still apply it, but check them below.`}
					</DialogDescription>
				</DialogHeader>
				<div className="max-h-48 overflow-auto scrollbar-thin space-y-1.5 py-2">
					{warnings.map((warning, index) => {
						/* J2 (P1): the raw `warning.code` used to be printed in a
						 * monospace span. The code is an engine token, so the row
						 * leads with the rule's PLAIN name from the established
						 * presentation map and then the humanised message. An
						 * unlabelled rule degrades to the shared plain sentence —
						 * never to the token. */
						const named = VIOLATION_PRESENTATION[warning.code as ViolationCode];
						return (
							<div
								key={index}
								className="rounded border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800"
							>
								<p className="font-semibold">{named ? named.title : UNLABELLED_RULE_SENTENCE}</p>
								<p>{formatConstraintMessage(warning.message)}</p>
							</div>
						);
					})}
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
