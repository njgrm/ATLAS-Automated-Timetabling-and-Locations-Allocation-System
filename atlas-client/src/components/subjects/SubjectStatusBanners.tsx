import { AlertTriangle, RefreshCw } from 'lucide-react';
import { Button } from '@/ui/button';

type Props = {
	syncError: boolean;
	error: string | null;
	syncPreviewLoading: boolean;
	onRetrySync: () => void;
	onRetryLoad: () => void;
};

export function SubjectStatusBanners({ syncError, error, syncPreviewLoading, onRetrySync, onRetryLoad }: Props) {
	return (
		<>
			{syncError && (
				<div className="shrink-0 mx-6 mt-3 flex items-center gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-2.5 text-sm text-amber-900 shadow-sm animate-in fade-in duration-300">
					<AlertTriangle className="size-4 shrink-0 text-amber-600" />
					<span className="flex-1 font-medium">ATLAS could not refresh the active subject offerings. The last saved curriculum list is still shown.</span>
					<Button size="sm" variant="outline" onClick={onRetrySync} disabled={syncPreviewLoading} className="shrink-0 h-7 border-amber-300 hover:bg-amber-100 text-amber-900 font-bold">
						<RefreshCw className={`mr-1.5 size-3 ${syncPreviewLoading ? 'animate-spin' : ''}`} /> Retry refresh
					</Button>
				</div>
			)}

			{error && !syncError && (
				<div
					role="alert"
					data-testid="subjects-error-banner"
					className="shrink-0 mx-6 mt-3 rounded-xl border border-destructive/30 bg-destructive/10 px-4 py-2.5 text-sm text-destructive flex items-center justify-between shadow-sm"
				>
					<div className="flex items-center gap-2">
						<AlertTriangle className="size-4 shrink-0" />
						<span className="font-medium">{error}</span>
					</div>
					<Button size="sm" variant="outline" onClick={onRetryLoad} className="shrink-0 h-7">
						<RefreshCw className="mr-1.5 size-3" /> Retry
					</Button>
				</div>
			)}
		</>
	);
}
