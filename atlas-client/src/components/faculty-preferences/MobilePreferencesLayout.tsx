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
		description: 'Prefer accessible rooms and minimize walking distance between classes.',
	},
	{
		key: 'minimizeTravelTime',
		label: 'Minimize travel time',
		description: 'Prefer back-to-back classes in the same or nearby rooms.',
	},
	{
		key: 'avoidUpperFloors',
		label: 'Avoid upper floors',
		description: 'Prefer ground-floor rooms when possible.',
	},
];

type MobilePreferencesLayoutProps = {
	wellbeing: WellbeingState;
	onWellbeingChange: (key: keyof WellbeingState, checked: boolean) => void;
	notes: string;
	onNotesChange: (value: string) => void;
	canEdit: boolean;
	banners?: ReactNode;
};

export default function MobilePreferencesLayout({
	wellbeing,
	onWellbeingChange,
	notes,
	onNotesChange,
	canEdit,
	banners,
}: MobilePreferencesLayoutProps) {
	return (
		<div className='flex flex-col gap-5 pb-32'>
			{banners && <div className='space-y-3'>{banners}</div>}

			<section>
				<div className='flex items-center gap-2 px-1'>
					<Heart className='size-4 text-primary' />
					<h2 className='text-base font-semibold text-foreground'>Support needs</h2>
				</div>
				<p className='mt-1 px-1 text-xs text-muted-foreground'>The scheduler reviews each toggle and tries to honour it where possible.</p>
				<Card className='mt-3 overflow-hidden rounded-2xl border-border/60 shadow-sm'>
					<CardContent className='divide-y divide-border/60 p-0'>
						{WELLBEING_ITEMS.map(({ key, label, description }) => (
							<div key={key} className='flex items-start justify-between gap-4 px-4 py-3.5'>
								<div className='min-w-0 flex-1'>
									<Label htmlFor={`mob-wb-${key}`} className='cursor-pointer text-sm font-semibold text-foreground'>
										{label}
									</Label>
									<p className='mt-0.5 text-xs leading-snug text-muted-foreground'>{description}</p>
								</div>
								<Switch
									id={`mob-wb-${key}`}
									checked={wellbeing[key]}
									onCheckedChange={(checked) => onWellbeingChange(key, checked)}
									disabled={!canEdit}
									className='mt-0.5 shrink-0'
								/>
							</div>
						))}
					</CardContent>
				</Card>
			</section>

			<section>
				<div className='flex items-center gap-2 px-1'>
					<MessageSquare className='size-4 text-primary' />
					<h2 className='text-base font-semibold text-foreground'>Notes for the scheduler</h2>
				</div>
				<p className='mt-1 px-1 text-xs text-muted-foreground'>Optional context to help the scheduler honour your support needs.</p>
				<Card className='mt-3 overflow-hidden rounded-2xl border-border/60 shadow-sm'>
					<CardContent className='p-0'>
						<Textarea
							placeholder='For example: prefer mornings, recovering from surgery, etc.'
							value={notes}
							onChange={(e) => onNotesChange(e.target.value)}
							disabled={!canEdit}
							className='min-h-32 resize-none rounded-none border-0 p-4 text-sm focus-visible:ring-0'
						/>
					</CardContent>
				</Card>
			</section>
		</div>
	);
}
