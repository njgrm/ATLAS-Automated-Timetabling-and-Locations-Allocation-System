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

const QUICK_REASONS = [
	'Too far from previous class',
	'Accessibility / mobility requirement',
	'Shared equipment needed in target room',
	'Ventilation or lighting issues in current room',
	'Previous agreement with department head',
];

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
		<div className='space-y-4'>
			<div className='space-y-2'>
				<p className='text-sm font-bold'>Schedule check</p>
				{previewLoading && (
					<div className='flex items-center gap-2 text-xs text-muted-foreground animate-pulse'>
						<div className='size-2 rounded-full bg-primary' />
						Checking for conflicts...
					</div>
				)}
				{!previewLoading && !preview && (
					<p className='text-xs text-muted-foreground'>Pick a target and action type to preview impact.</p>
				)}
				{!previewLoading && preview && (
					<>
						<div className='flex flex-wrap gap-2'>
							<Badge variant={hardCount > 0 ? 'warning' : 'success'}>
								{hardCount === 0 ? 'No hard conflicts' : `${hardCount} hard conflict${hardCount !== 1 ? 's' : ''}`}
							</Badge>
							{softCount > 0 && (
								<Badge variant='secondary'>{softCount} minor note{softCount !== 1 ? 's' : ''}</Badge>
							)}
						</div>
						{hardCount === 0 && softCount === 0 && (
							<p className='text-xs font-medium text-emerald-700'>No conflicts found. You can submit this request.</p>
						)}
						{hardCount > 0 && (
							<p className='text-xs font-medium text-amber-800'>
								This request causes {hardCount} hard conflict{hardCount !== 1 ? 's' : ''}. Add a clear reason below so the scheduling officer can decide.
							</p>
						)}
						<div className='space-y-2'>
							{preview.humanConflicts.map((conflict, index) => (
								<div key={`${conflict.code}-${conflict.humanTitle}-${index}`} className='rounded-xl border border-border bg-muted/30 p-3'>
									<p className='text-xs font-bold'>{conflict.humanTitle}</p>
									<p className='mt-1 text-[11px] text-muted-foreground leading-relaxed'>{conflict.humanDetail}</p>
								</div>
							))}
						</div>
					</>
				)}
			</div>

			{reasonRequired && (
				<div className='space-y-3 pt-2 border-t border-border'>
					<div className='flex items-center justify-between'>
						<p className='text-xs font-bold'>Why is this change needed?</p>
						<span className='text-[10px] uppercase font-bold text-destructive'>Required</span>
					</div>
					
					<div className='flex flex-wrap gap-2'>
						{QUICK_REASONS.map((q) => (
							<button
								key={q}
								type='button'
								onClick={() => onReasonChange(q)}
								className='text-[10px] px-2 py-1 rounded-full border border-border bg-background hover:bg-muted transition-colors'
							>
								{q}
							</button>
						))}
					</div>

					<Textarea
						value={reason}
						onChange={(event) => onReasonChange(event.target.value)}
						placeholder='Explain why this conflict should still be considered...'
						className='min-h-24 text-xs rounded-xl resize-none'
					/>

					{!reason.trim() && (
						<p className='text-[10px] text-destructive font-medium animate-pulse'>
							âš  Please provide a reason to continue.
						</p>
					)}
				</div>
			)}
		</div>
	);
}
