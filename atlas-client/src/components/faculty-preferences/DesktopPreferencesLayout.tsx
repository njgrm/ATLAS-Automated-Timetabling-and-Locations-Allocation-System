import { Heart, MessageSquare } from 'lucide-react';
import type { ReactNode } from 'react';

import { Card, CardContent } from '@/ui/card';
import { Label } from '@/ui/label';
import { Textarea } from '@/ui/textarea';
import { Switch } from '@/ui/switch';

type WellbeingState = {
	pregnancySupport: boolean;
	physicalAilmentSupport: boolean;
	minimizeTravelTime: boolean;
	avoidUpperFloors: boolean;
};

const WELLBEING_ITEMS: { key: keyof WellbeingState; label: string; description: string }[] = [
	{
		key: 'pregnancySupport',
		label: 'Pregnancy support',
		description: 'Avoid prolonged standing; prefer ground-floor rooms near restrooms.',
	},
	{
		key: 'physicalAilmentSupport',
		label: 'Mobility support',
		description: 'Prefer accessible rooms and minimize walking distance.',
	},
	{
		key: 'minimizeTravelTime',
		label: 'Minimize travel time',
		description: 'Prefer consecutive classes in the same or adjacent rooms.',
	},
	{
		key: 'avoidUpperFloors',
		label: 'Avoid upper floors',
		description: 'Prefer ground-floor rooms when possible.',
	},
];

type DesktopPreferencesLayoutProps = {
	wellbeing: WellbeingState;
	onWellbeingChange: (key: keyof WellbeingState, checked: boolean) => void;
	notes: string;
	onNotesChange: (value: string) => void;
	canEdit: boolean;
	banners?: ReactNode;
};

export default function DesktopPreferencesLayout({
	wellbeing,
	onWellbeingChange,
	notes,
	onNotesChange,
	canEdit,
	banners,
}: DesktopPreferencesLayoutProps) {
	const activeCount = Object.values(wellbeing).filter(Boolean).length;
	return (
		<div className='mx-auto grid h-full w-full max-w-6xl grid-cols-[minmax(0,1fr)_380px] gap-6'>
			{/* Left: support toggles */}
			<div className='flex min-h-0 flex-col gap-4'>
				{banners && <div className='space-y-3'>{banners}</div>}

				<Card className='flex min-h-0 flex-1 flex-col overflow-hidden rounded-2xl border-border/60 shadow-sm'>
					<div className='flex items-center justify-between border-b border-border/60 px-5 py-3'>
						<div className='flex items-center gap-2'>
							<Heart className='size-4 text-primary' />
							<h2 className='text-sm font-semibold text-foreground'>Support needs</h2>
						</div>
						<span className='text-xs text-muted-foreground'>{activeCount} selected</span>
					</div>
					<CardContent className='flex-1 divide-y divide-border/60 overflow-auto p-0'>
						{WELLBEING_ITEMS.map(({ key, label, description }) => (
							<div key={key} className='flex items-start justify-between gap-4 px-5 py-4 hover:bg-muted/30'>
								<div className='min-w-0 flex-1'>
									<Label htmlFor={`desk-wb-${key}`} className='cursor-pointer text-sm font-semibold text-foreground'>
										{label}
									</Label>
									<p className='mt-0.5 text-xs leading-snug text-muted-foreground'>{description}</p>
								</div>
								<Switch
									id={`desk-wb-${key}`}
									checked={wellbeing[key]}
									onCheckedChange={(checked) => onWellbeingChange(key, checked)}
									disabled={!canEdit}
									className='mt-0.5 shrink-0'
								/>
							</div>
						))}
					</CardContent>
				</Card>
			</div>

			{/* Right: notes */}
			<div className='flex min-h-0 flex-col gap-4'>
				<Card className='flex min-h-0 flex-1 flex-col overflow-hidden rounded-2xl border-border/60 shadow-sm'>
					<div className='flex items-center gap-2 border-b border-border/60 px-5 py-3'>
						<MessageSquare className='size-4 text-primary' />
						<h3 className='text-sm font-semibold text-foreground'>Notes for the scheduler</h3>
					</div>
					<CardContent className='flex-1 p-0'>
						<Textarea
							placeholder='For example: prefer mornings, recovering from surgery, etc.'
							value={notes}
							onChange={(e) => onNotesChange(e.target.value)}
							disabled={!canEdit}
							className='h-full min-h-64 resize-none rounded-none border-0 p-5 text-sm focus-visible:ring-0'
						/>
					</CardContent>
				</Card>

				<p className='text-xs leading-snug text-muted-foreground'>
					Submitted support needs are reviewed by the scheduler. They are not automatic blockers — think of them as context that helps the scheduler choose a better-fit room or slot.
				</p>
			</div>
		</div>
	);
}
