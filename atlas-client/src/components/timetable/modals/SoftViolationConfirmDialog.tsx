import { AlertTriangle } from 'lucide-react';

import type { Violation } from '@/types';
import { getViolationPresentation, resolveViolationTitle } from '@/lib/violation-presentation';
import { Button } from '@/ui/button';
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from '@/ui/dialog';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/ui/tooltip';

type SoftViolationConfirmDialogProps = {
	open: boolean;
	warnings: Violation[];
	commitLoading: boolean;
	onCancel: () => void;
	onConfirm: () => void;
	formatConstraintMessage: (message: string) => string;
};

/**
 * PLAIN-LANGUAGE-J2J3-C01 (J4) — this is the LAST dialog an operator passes
 * through before a write is committed, and it introduced itself with the engine
 * phrase "Soft Constraint Warnings", then listed each warning as a raw
 * `FACULTY_DAILY_STANDARD_EXCEEDED`-shaped code in dim monospace followed by a
 * validator sentence. The code was the most prominent thing in the row, and the
 * plain title the rest of the product already uses for that code
 * ("Daily teaching target exceeded") was not shown at all.
 *
 * Each row now leads with the real presentation title and the same
 * meaning/action copy the explainability drawer uses, so the warning reads
 * identically here and everywhere else.
 *
 * The raw code is NOT deleted. It is the machine diagnostic an operator or a
 * support engineer needs, so it moves into the established Tooltip affordance
 * (AGENTS.md §8 forbids a native `title`/`<details>`) beside the meaning. The
 * tooltip is closed by default, so the default dialog text carries no enum —
 * which is the property T4 asserts — while the diagnostic is still one hover
 * away and still present in the committed source.
 */
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
						Warnings about this move
					</DialogTitle>
					<DialogDescription>
						This edit introduces {warnings.length} warning{warnings.length === 1 ? '' : 's'}.
						 You can still apply it, but review the issues below.
					</DialogDescription>
				</DialogHeader>
				<div className="max-h-48 overflow-auto scrollbar-thin space-y-1.5 py-2">
					{warnings.map((warning, index) => {
						// `getViolationPresentation` is total over the canonical client
						// union; the resolver covers a code the server may add before
						// the client learns it, so the title is never an enum and never
						// empty.
						const copy = getViolationPresentation(warning.code);
						const title = resolveViolationTitle(warning.code);
						return (
							<div
								key={index}
								className="rounded border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800"
							>
								<p className="font-semibold">
									<TooltipProvider delayDuration={200}>
										<Tooltip>
											<TooltipTrigger asChild>
												<span className="cursor-help underline decoration-dotted underline-offset-2">{title}</span>
											</TooltipTrigger>
											<TooltipContent side="left" className="max-w-62.5 text-xs">
												<p className="font-mono text-[0.65rem] opacity-80">{warning.code}</p>
												{copy ? (
													<>
														<p className="leading-normal">{copy.meaning}</p>
														<p className="leading-normal">{copy.action}</p>
													</>
												) : null}
											</TooltipContent>
										</Tooltip>
									</TooltipProvider>
								</p>
								<p className="mt-0.5 leading-snug">{formatConstraintMessage(warning.message)}</p>
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
