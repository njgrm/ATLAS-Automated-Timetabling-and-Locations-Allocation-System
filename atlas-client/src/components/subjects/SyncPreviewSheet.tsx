import { Loader2 } from 'lucide-react';
import { Badge } from '@/ui/badge';
import { Button } from '@/ui/button';
import {
	Sheet,
	SheetContent,
	SheetDescription,
	SheetHeader,
	SheetTitle,
} from '@/ui/sheet';

export type SyncPreviewData = {
	schoolId: number;
	schoolYearId: number;
	sourceRevision: string;
	mutations: Array<{ action: string; code: string; name: string; reason: string }>;
	summary: {
		activationCount: number;
		deactivationCount: number;
		creationCount: number;
		updateCount: number;
		totalChanges: number;
	};
	fingerprint: string;
};

type Props = {
	preview: SyncPreviewData | null;
	applyLoading: boolean;
	onApply: () => void;
	onCancel: () => void;
};

export function SyncPreviewSheet({ preview, applyLoading, onApply, onCancel }: Props) {
	return (
		<Sheet open={preview !== null} onOpenChange={(open) => { if (!open) onCancel(); }}>
			<SheetContent className="sm:max-w-md">
				<SheetHeader>
					<SheetTitle>Review subject offering changes</SheetTitle>
					<SheetDescription>
						ATLAS will apply {preview?.summary.totalChanges} change(s) to the subject catalog. Review before confirming.
					</SheetDescription>
				</SheetHeader>
				{preview && (
					<div className="flex-1 min-h-0 overflow-auto py-4 space-y-4">
						<div className="space-y-2">
							<h4 className="text-sm font-semibold">Changes to apply</h4>
							<div className="space-y-1.5">
								{preview.mutations.map((m, i) => (
									<div key={i} className="flex items-start gap-2 text-xs rounded-md border p-2">
										<Badge variant={m.action === 'DEACTIVATE' ? 'destructive' : m.action === 'CREATE' ? 'default' : 'secondary'} className="h-4 px-1.5 text-[0.6rem] shrink-0">
											{m.action}
										</Badge>
										<div className="min-w-0">
											<p className="font-medium truncate">{m.name} <code className="text-muted-foreground">{m.code}</code></p>
											<p className="text-muted-foreground">{m.reason}</p>
										</div>
									</div>
								))}
							</div>
						</div>
						<div className="text-[0.65rem] text-muted-foreground font-mono break-all">
							Fingerprint: {preview.fingerprint.slice(0, 16)}...
						</div>
						<div className="flex gap-2 pt-2">
							<Button variant="ghost" size="sm" onClick={onCancel} disabled={applyLoading}>
								Cancel
							</Button>
							<Button size="sm" onClick={onApply} disabled={applyLoading} className="gap-1.5">
								{applyLoading && <Loader2 className="size-3.5 animate-spin" />}
								Confirm and apply
							</Button>
						</div>
					</div>
				)}
			</SheetContent>
		</Sheet>
	);
}
