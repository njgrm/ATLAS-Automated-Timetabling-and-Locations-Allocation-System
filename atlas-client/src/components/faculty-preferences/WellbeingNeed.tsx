import { useEffect, useRef, useState } from 'react';
import { Badge } from '@/ui/badge';
import { Button } from '@/ui/button';
import { Card, CardContent } from '@/ui/card';
import type { SchedulerWellbeingFlags, WellbeingReason } from '@/components/faculty-shared/teacher-concern-client';
import { wellbeingReasonFlags } from '@/components/faculty-shared/teacher-concern-client';

const reasons: Array<{ value: Exclude<WellbeingReason, null>; label: string }> = [
	{ value: 'pregnancy', label: 'Pregnancy' },
	{ value: 'injury', label: 'Injury / illness' },
	{ value: 'other', label: 'Other' },
];

function reasonFromFlags(flags: SchedulerWellbeingFlags): WellbeingReason {
	if (!flags.avoidUpperFloors) return null;
	if (flags.pregnancySupport) return 'pregnancy';
	if (flags.physicalAilmentSupport) return 'injury';
	return 'other';
}

export default function WellbeingNeed({
	flags,
	saving,
	onSave,
	onUndo,
}: {
	flags: SchedulerWellbeingFlags;
	saving: boolean;
	onSave: (flags: SchedulerWellbeingFlags) => Promise<void>;
	onUndo: (flags: SchedulerWellbeingFlags) => Promise<void>;
}) {
	const [saved, setSaved] = useState(flags);
	const [reason, setReason] = useState<WellbeingReason>(reasonFromFlags(flags));
	const [receipt, setReceipt] = useState('');
	const [error, setError] = useState('');
	const undoFlags = useRef<SchedulerWellbeingFlags | null>(null);
	useEffect(() => { setSaved(flags); setReason(reasonFromFlags(flags)); }, [flags]);
	const changed = JSON.stringify(wellbeingReasonFlags(reason)) !== JSON.stringify(saved);
	const save = async (next: SchedulerWellbeingFlags) => {
		setError('');
		try { undoFlags.current = saved; await onSave(next); setSaved(next); setReason(reasonFromFlags(next)); setReceipt(next.avoidUpperFloors ? 'Ground floor saved.' : 'Ground floor need removed.'); }
		catch { setError('This change was not saved. Try again.'); }
	};
	return <Card className='rounded-2xl border-border/60 shadow-sm' data-testid='wellbeing-need'>
		<CardContent className='space-y-3 p-4'>
			<div className='flex items-center justify-between gap-3'>
				<h2 className='text-sm font-semibold'>Ground floor only</h2>
				{saved.avoidUpperFloors ? <Badge variant='outline'>Ground floor</Badge> : null}
			</div>
			<fieldset className='flex flex-wrap gap-2' disabled={saving}>
				<legend className='mb-2 text-sm'>Choose one reason</legend>
				{reasons.map((item) => <Button key={item.value} type='button' variant={reason === item.value ? 'default' : 'outline'} aria-pressed={reason === item.value} onClick={() => setReason(item.value)}>{item.label}</Button>)}
				<Button type='button' variant={reason == null ? 'default' : 'outline'} aria-pressed={reason == null} onClick={() => setReason(null)}>None</Button>
			</fieldset>
			<div className='flex items-center gap-2'>
				<Button type='button' onClick={() => void save(wellbeingReasonFlags(reason))} disabled={!changed || saving}>Save</Button>
				{receipt ? <span role='status' className='text-sm text-muted-foreground'>{receipt}</span> : null}
				{receipt && undoFlags.current ? <Button type='button' variant='outline' onClick={() => void (async () => { const previous = undoFlags.current; if (!previous) return; await onUndo(previous); setSaved(previous); setReason(reasonFromFlags(previous)); undoFlags.current = null; setReceipt('Change undone.'); })()} disabled={saving}>Undo</Button> : null}
			</div>
			{error ? <p role='alert' className='text-sm text-destructive'>{error}</p> : null}
		</CardContent>
	</Card>;
}
