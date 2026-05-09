import type { PreviewResult } from '@/types';
import { Badge } from '@/ui/badge';
import { Textarea } from '@/ui/textarea';

type ConflictInspectorProps = {
	previewLoading: boolean;
	preview: PreviewResult | null;
	reasonRequired: boolean;
	reason: string;
	onReasonChange: (value: string) => void;
};

export default function ConflictInspector({
	previewLoading,
	preview,
	reasonRequired,
	reason,
	onReasonChange,
}: ConflictInspectorProps) {
	const hardCount = preview?.hardViolations.length ?? 0;
	const softCount = preview?.softViolations.length ?? 0;

	return (
		<div className='space-y-2'>
			<p className='text-sm font-semibold'>Schedule check</p>
			{previewLoading && <p className='text-xs text-muted-foreground'>Checking for conflicts...</p>}
			{!previewLoading && !preview && (
				<p className='text-xs text-muted-foreground'>Pick a target and action type to preview impact.</p>
			)}
			{!previewLoading && preview && (
				<>
					<div className='flex flex-wrap gap-2'>
						<Badge variant={hardCount > 0 ? 'warning' : 'success'}>{hardCount} hard</Badge>
						<Badge variant={softCount > 0 ? 'secondary' : 'outline'}>{softCount} soft</Badge>
					</div>
					{hardCount === 0 && softCount === 0 && (
						<p className='text-xs font-medium text-emerald-700'>No conflicts found. You can submit this request.</p>
					)}
					{hardCount > 0 && (
						<p className='text-xs font-medium text-amber-800'>
							This request causes {hardCount} hard conflict{hardCount !== 1 ? 's' : ''}. Add a clear reason below so the scheduling officer can decide.
						</p>
					)}
					{softCount > 0 && hardCount === 0 && (
						<p className='text-xs text-muted-foreground'>
							{softCount} minor scheduling note{softCount !== 1 ? 's' : ''}. You can still submit.
						</p>
					)}
					<div className='space-y-2'>
						{preview.humanConflicts.map((conflict, index) => (
							<div key={`${conflict.code}-${conflict.humanTitle}-${index}`} className='rounded-lg border border-border bg-background p-2'>
								<p className='text-xs font-semibold'>{conflict.humanTitle}</p>
								<p className='mt-1 text-xs text-muted-foreground'>{conflict.humanDetail}</p>
							</div>
						))}
					</div>
				</>
			)}

			{reasonRequired && (
				<Textarea
					value={reason}
					onChange={(event) => onReasonChange(event.target.value)}
					placeholder='Reason required: explain why this conflict should still be considered.'
					className='min-h-24'
				/>
			)}

			{reasonRequired && !reason.trim() && (
				<div className='rounded-xl border border-destructive/30 bg-destructive/5 px-3 py-2 text-xs text-destructive'>
					Please enter a reason above so the scheduling officer can review this request.
				</div>
			)}
		</div>
	);
}
