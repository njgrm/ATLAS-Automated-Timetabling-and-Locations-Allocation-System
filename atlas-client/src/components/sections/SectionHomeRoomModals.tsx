import * as React from 'react';
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from '@/ui/dialog';
import { Button } from '@/ui/button';
import { Badge } from '@/ui/badge';
import {
	ArrowRight,
	AlertTriangle,
	RefreshCw,
	DoorOpen,
	ArrowDownToLine,
	AlertCircle,
} from 'lucide-react';

interface SwapConfirmationModalProps {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	onConfirm: () => void;
	sourceSectionName: string;
	targetRoomName: string;
	displacedSectionName: string;
	currentRoomName?: string | null;
	isSaving?: boolean;
}

export function SwapConfirmationModal({
	open,
	onOpenChange,
	onConfirm,
	sourceSectionName,
	targetRoomName,
	displacedSectionName,
	currentRoomName,
	isSaving,
}: SwapConfirmationModalProps) {
	const displacedBecomesUnassigned = !currentRoomName;
	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent className="max-w-xl rounded-3xl p-0 overflow-hidden border-border/40 shadow-2xl">
				<div className="bg-amber-50/50 border-b border-amber-100 px-6 py-4 flex items-center gap-3">
					<div className="size-10 rounded-full bg-amber-100 flex items-center justify-center text-amber-600 shadow-inner">
						<AlertTriangle className="size-5" />
					</div>
					<div>
						{/* Phase 1.2: plain-language title + description. */}
						<DialogTitle className="text-lg font-bold text-amber-900">Move to {targetRoomName}?</DialogTitle>
						<DialogDescription className="text-amber-700/70 text-xs font-medium">
							That room already has a home section. ATLAS needs your confirmation before swapping.
						</DialogDescription>
					</div>
				</div>

				<div className="p-6 space-y-6">
					{/* Swap Visualization */}
					<div className="grid grid-cols-[1fr_auto_1fr] items-center gap-4">
						<div className="space-y-3">
							<p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground px-1">This section</p>
							<div className="p-4 rounded-2xl border-2 border-primary/20 bg-primary/5 shadow-sm">
								<p className="font-bold text-foreground truncate">{sourceSectionName}</p>
								<div className="mt-3 flex items-center gap-2 text-xs text-muted-foreground">
									<DoorOpen className="size-3.5" />
									{currentRoomName ?? <span className="italic">No home room yet</span>}
								</div>
							</div>
						</div>

						<div className="flex flex-col items-center gap-2 mt-6">
							<ArrowRight className="size-5 text-primary" />
						</div>

						<div className="space-y-3">
							<p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground px-1">The other section</p>
							<div className="p-4 rounded-2xl border-2 border-amber-200 bg-amber-50/50 shadow-sm">
								<p className="font-bold text-amber-900 truncate">{displacedSectionName}</p>
								<div className="mt-3 flex items-center gap-2 text-xs text-amber-700/70 font-semibold">
									<Badge variant="outline" className="bg-white/50 border-amber-200 text-amber-600 h-5 px-1.5 text-xs font-bold">
										{targetRoomName}
									</Badge>
								</div>
							</div>
						</div>
					</div>

					{/* Result Summary */}
					<div className="rounded-2xl bg-muted/30 border p-4 space-y-3">
						<p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">After this swap</p>

						<div className="space-y-2.5">
							<div className="flex items-center gap-3 text-sm">
								<div className="size-6 rounded-full bg-emerald-100 flex items-center justify-center text-emerald-600">
									<ArrowRight className="size-3.5" />
								</div>
								<span className="font-medium text-foreground">{sourceSectionName} moves to <span className="font-bold text-emerald-600">{targetRoomName}</span></span>
							</div>

							<div className="flex items-center gap-3 text-sm">
								<div className="size-6 rounded-full bg-amber-100 flex items-center justify-center text-amber-600">
									<ArrowDownToLine className="size-3.5" />
								</div>
								<span className="font-medium text-foreground">
									{displacedSectionName}{' '}
									{currentRoomName ? (
										<>moves to <span className="font-bold text-amber-600">{currentRoomName}</span></>
									) : (
										<span className="font-bold text-amber-600 italic">will have no home room</span>
									)}
								</span>
							</div>
						</div>
					</div>

					{/* Phase 1.2: explicit warning when the displaced section will lose
						its home room. Without this, a non-technical user cannot tell
						that "moves to" with no room name means "becomes unassigned." */}
					{displacedBecomesUnassigned ? (
						<div
							role="alert"
							data-testid="swap-displaced-unassigned-warning"
							className="rounded-2xl border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900"
						>
							<p className="font-semibold">Warning: {displacedSectionName} will no longer have a home room.</p>
							<p className="mt-0.5 text-amber-800/80">Reassign it before generating the timetable.</p>
						</div>
					) : null}
				</div>

				<DialogFooter className="bg-muted/50 p-4 border-t flex gap-3 sm:justify-end">
					<Button variant="outline" onClick={() => onOpenChange(false)} disabled={isSaving} className="h-10 rounded-xl px-6 font-bold border-muted-foreground/20">
						Cancel
					</Button>
					<Button onClick={onConfirm} disabled={isSaving} className="h-10 rounded-xl px-6 font-bold shadow-lg shadow-primary/20">
						{isSaving ? <RefreshCw className="mr-2 size-4 animate-spin" /> : <ArrowRight className="mr-2 size-4" />}
						Confirm swap
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}

interface UnassignConfirmationModalProps {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	onConfirm: () => void;
	sectionName: string;
	currentRoomName: string;
	isSaving?: boolean;
}

export function UnassignConfirmationModal({
	open,
	onOpenChange,
	onConfirm,
	sectionName,
	currentRoomName,
	isSaving,
}: UnassignConfirmationModalProps) {
	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent className="max-w-sm rounded-3xl p-8 overflow-hidden border-border/40 shadow-2xl">
				<div className="flex flex-col items-center text-center space-y-4">
					<div className="size-14 rounded-full bg-amber-100 flex items-center justify-center text-amber-600 shadow-inner">
						<AlertCircle className="size-7" />
					</div>

					<div className="space-y-2">
						{/* Phase 1.3: title clarifies the question, body uses plain
							language. The section will become unassigned and need a new
							home room before generation. */}
						<DialogTitle className="text-xl font-bold tracking-tight">Remove the home room for {sectionName}?</DialogTitle>
						<DialogDescription className="text-sm leading-relaxed">
							{sectionName} will be removed from <span className="text-foreground font-bold">{currentRoomName}</span> and will not have a home room until you assign a new one.
						</DialogDescription>
					</div>

					<div className="w-full pt-4 flex flex-col gap-2">
						{/* Phase 1.3: standard a11y ordering for destructive confirmations.
							Safe (default focus) is first; destructive is second and
							visually distinct. */}
						<Button
							variant="outline"
							onClick={() => onOpenChange(false)}
							disabled={isSaving}
							autoFocus
							className="h-11 rounded-xl font-bold border-muted-foreground/20"
							data-testid="unassign-modal-keep"
						>
							Keep {currentRoomName}
						</Button>
						<Button
							variant="destructive"
							onClick={onConfirm}
							disabled={isSaving}
							className="h-11 rounded-xl font-bold shadow-lg shadow-red-200"
							data-testid="unassign-modal-confirm"
						>
							{isSaving ? 'Processing...' : 'Yes, remove home room'}
						</Button>
					</div>
				</div>
			</DialogContent>
		</Dialog>
	);
}
