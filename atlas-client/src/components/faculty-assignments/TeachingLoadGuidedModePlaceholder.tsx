import { CheckCircle2 } from 'lucide-react';

import { Button } from '@/ui/button';

type TeachingLoadGuidedModePlaceholderProps = {
	onOpenAdvancedGrid: () => void;
};

export function TeachingLoadGuidedModePlaceholder({ onOpenAdvancedGrid }: TeachingLoadGuidedModePlaceholderProps) {
	return (
		<div className="flex-1 min-h-0 overflow-auto bg-muted/5 p-4">
			<div className="flex min-h-64 flex-col items-center justify-center rounded-2xl border border-dashed border-border/60 bg-background p-6 text-center">
				<CheckCircle2 className="mb-3 size-9 text-emerald-600" />
				<h3 className="text-sm font-bold text-foreground">Guided mode is active</h3>
				<p className="mt-1 max-w-md text-xs font-medium leading-5 text-muted-foreground">
					Use the repair queue above for the next safe action. Open the advanced grid only when you need to inspect every teacher, subject, and section manually.
				</p>
				<Button type="button" variant="outline" size="sm" className="mt-4 h-9 font-bold" data-testid="teaching-load-advanced-grid-toggle" onClick={onOpenAdvancedGrid}>
					Open advanced grid
				</Button>
			</div>
		</div>
	);
}
