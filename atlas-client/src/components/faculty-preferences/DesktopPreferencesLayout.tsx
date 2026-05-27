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
	return (
		<div className='grid grid-cols-[minmax(0,1fr)_380px] gap-8 h-full'>
			{/* Left Column: Support needs */}
			<div className='space-y-6 overflow-y-auto pr-2'>
				<div className='flex items-center justify-between'>
					<div className='flex items-center gap-3'>
						<div className='p-2 rounded-xl bg-rose-50 text-rose-500'>
							<Heart className='size-6' />
						</div>
						<div>
							<h2 className='text-xl font-bold tracking-tight'>Teacher Support Needs</h2>
							<p className='text-sm text-muted-foreground'>These requests are visible to the scheduler for manual review.</p>
						</div>
					</div>
				</div>

				{banners && <div className='space-y-4'>{banners}</div>}


				<Card className='rounded-3xl border-border/50 bg-card shadow-sm'>
					<CardContent className='p-6 space-y-4'>
						{WELLBEING_ITEMS.map(({ key, label, description }) => (
							<div
								key={key}
								className='flex items-start gap-4 p-4 rounded-2xl border border-border bg-muted/20 hover:bg-muted/30 transition-colors'
							>
								<Switch
									id={`desk-wb-${key}`}
									checked={wellbeing[key]}
									onCheckedChange={(checked) => onWellbeingChange(key, checked)}
									disabled={!canEdit}
									className='mt-1 shrink-0'
								/>
								<div className='min-w-0'>
									<Label htmlFor={`desk-wb-${key}`} className='text-sm font-bold cursor-pointer'>
										{label}
									</Label>
									<p className='text-xs text-muted-foreground mt-1 leading-normal'>{description}</p>
								</div>
							</div>
						))}
					</CardContent>
				</Card>
			</div>

			{/* Right Column: Notes and submit context */}
			<div className='space-y-6 overflow-y-auto pr-1'>
				<Card className='rounded-3xl border-border/50 bg-card shadow-sm'>
					<CardContent className='p-6 space-y-4'>
						<div className='flex items-center gap-3'>
							<div className='p-2 rounded-xl bg-amber-50 text-amber-500'>
								<MessageSquare className='size-5' />
							</div>
							<h3 className='text-lg font-bold'>Notes For The Scheduler</h3>
						</div>

						<div className='space-y-2'>
							<Label className='text-xs font-bold text-muted-foreground uppercase ml-1'>
								Message to Scheduler
							</Label>
							<Textarea
								placeholder='Add context the scheduler should know before reviewing your support request.'
								value={notes}
								onChange={(e) => onNotesChange(e.target.value)}
								disabled={!canEdit}
								className='min-h-40 resize-none rounded-2xl p-4 text-sm'
							/>
						</div>
					</CardContent>
				</Card>

				<Card className='rounded-3xl border-dashed border-primary/30 bg-primary/5 shadow-sm'>
					<CardContent className='p-5 text-sm text-muted-foreground'>
						<div className='flex items-center gap-2 font-semibold text-foreground'>
							<Send className='size-4 text-primary' />
							Submit when ready
						</div>
						<p className='mt-1'>Submitted preferences are reviewed by the scheduler. These support needs are not automatic timetable blockers.</p>
					</CardContent>
				</Card>
			</div>
		</div>
	);
}
