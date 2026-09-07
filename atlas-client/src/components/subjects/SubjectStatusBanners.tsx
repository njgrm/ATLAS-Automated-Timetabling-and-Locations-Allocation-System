import { AlertTriangle, RefreshCw } from 'lucide-react';
import { Button } from '@/ui/button';

type Props = {
	error: string | null;
	onRetryLoad: () => void;
};

export function SubjectStatusBanners({ error, onRetryLoad }: Props) {
	// SCA-01.4: the upstream-offering refresh is retired, so there is no sync
	// error state. Only the catalog load error remains.
	return (
		<>
			{error && (
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
