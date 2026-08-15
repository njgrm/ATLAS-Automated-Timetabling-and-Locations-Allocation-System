import { Save, Undo2 } from 'lucide-react';

import { Button } from '@/ui/button';

type TeachingLoadDraftActionBarProps = {
	activeDraftCount: number;
	canUndo: boolean;
	isReadOnlyMode: boolean;
	saving: boolean;
	statusMessage: string;
	writeBlockedReason: string | null;
	onUndo: () => void;
	onDiscard: () => void;
	onSave: () => void;
};

export function TeachingLoadDraftActionBar({
	activeDraftCount,
	canUndo,
	isReadOnlyMode,
	saving,
	statusMessage,
	writeBlockedReason,
	onUndo,
	onDiscard,
	onSave,
}: TeachingLoadDraftActionBarProps) {
	const saveDisabled = activeDraftCount === 0 || saving || isReadOnlyMode;

	return (
		<div className="shrink-0 border-t border-border/40 bg-background px-3 py-2" data-testid="teaching-load-draft-action-bar">
			<div className="flex flex-wrap items-center gap-2">
				<div className="min-w-0 flex-1">
					<p className="hidden text-xs font-bold uppercase tracking-wider text-muted-foreground sm:block">Draft status</p>
					<p className="truncate text-sm font-semibold text-foreground" aria-live="polite">{statusMessage}</p>
					{(isReadOnlyMode || activeDraftCount === 0) && (
						<p className="mt-1 hidden text-xs font-medium text-muted-foreground sm:block" data-testid="teaching-load-draft-save-reason">
							{isReadOnlyMode ? writeBlockedReason : 'Save stays disabled until you prepare a draft change.'}
						</p>
					)}
				</div>
				<Button type="button" variant="outline" size="sm" className="h-8 gap-1.5 px-2 font-bold sm:h-9 sm:gap-2 sm:px-3" onClick={onUndo} disabled={!canUndo || saving || isReadOnlyMode}>
					<Undo2 className="size-4" />
					<span className="hidden sm:inline">Undo last</span>
				</Button>
				<Button type="button" variant="outline" size="sm" className="hidden h-9 font-bold sm:inline-flex" onClick={onDiscard} disabled={activeDraftCount === 0 || saving || isReadOnlyMode}>
					Discard draft
				</Button>
				<Button type="button" size="sm" className="h-8 gap-1.5 px-2 font-bold sm:h-9 sm:gap-2 sm:px-3" onClick={onSave} disabled={saveDisabled}>
					<Save className="size-4" />
					{saving ? 'Saving...' : activeDraftCount > 0 ? `Save ${activeDraftCount}` : 'Save'}
				</Button>
			</div>
		</div>
	);
}
