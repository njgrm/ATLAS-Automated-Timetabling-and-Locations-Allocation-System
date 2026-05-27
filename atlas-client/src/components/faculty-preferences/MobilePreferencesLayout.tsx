import { Heart, MessageSquare, Send } from 'lucide-react';
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
		label: 'Physical ailment / mobility support',
		description: 'Mobility limitation — prefer accessible rooms and minimize walking distance.',
	},
	{
		key: 'minimizeTravelTime',
		label: 'Minimize travel time between classes',
		description: 'Prefer consecutive classes in the same or adjacent rooms.',
	},
	{
		key: 'avoidUpperFloors',
		label: 'Avoid upper floors (2nd floor and above)',
		description: 'Prefer ground-floor rooms. Elevator access may not always be available.',
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
		<div className='flex flex-col gap-8 pb-24'>
			{banners && <div className='space-y-3'>{banners}</div>}

			{/* Section 1: Support needs */}
			<section className='space-y-4'>
				<div className='flex items-center gap-2 px-1'>
					<Heart className='size-5 text-rose-500' />
					<h2 className='text-lg font-bold tracking-tight'>Support Needs</h2>
				</div>
				<p className='px-1 text-sm text-muted-foreground'>These requests go to the scheduler for review and manual consideration.</p>
				<div className='grid gap-3'>
					{WELLBEING_ITEMS.map(({ key, label, description }) => (
						<div
							key={key}
							className='flex items-start gap-4 rounded-2xl border border-border p-4 bg-card shadow-sm'
						>
							<Switch
								id={`mob-wb-${key}`}
								checked={wellbeing[key]}
								onCheckedChange={(checked) => onWellbeingChange(key, checked)}
								disabled={!canEdit}
								className='mt-1 shrink-0'
							/>
							<div className='min-w-0'>
								<Label htmlFor={`mob-wb-${key}`} className='text-sm font-bold cursor-pointer'>
									{label}
								</Label>
								<p className='text-xs text-muted-foreground mt-1 leading-relaxed'>{description}</p>
							</div>
						</div>
					))}
				</div>
			</section>

			{/* Section 2: Notes */}
			<section className='space-y-4'>
				<div className='flex items-center gap-2 px-1'>
					<MessageSquare className='size-5 text-amber-500' />
					<h2 className='text-lg font-bold tracking-tight'>Notes For The Scheduler</h2>
				</div>
				<Card className='rounded-2xl border-border/50 overflow-hidden shadow-sm'>
					<CardContent className='p-0'>
						<Textarea
							placeholder='Add context the scheduler should know before reviewing your support request.'
							value={notes}
							onChange={(e) => onNotesChange(e.target.value)}
							disabled={!canEdit}
							className='min-h-30 resize-none border-0 rounded-none focus-visible:ring-0 p-4 text-sm'
						/>
					</CardContent>
				</Card>
			</section>

			<section className='rounded-2xl border border-dashed border-primary/30 bg-primary/5 p-4 text-sm text-muted-foreground'>
				<div className='flex items-center gap-2 font-semibold text-foreground'>
					<Send className='size-4 text-primary' />
					Submit when ready
				</div>
				<p className='mt-1'>The scheduler can see submitted support needs and mark each review as complete or needing follow-up.</p>
			</section>
		</div>
	);
}
