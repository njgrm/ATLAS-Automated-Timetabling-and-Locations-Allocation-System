import { Heart, Clock, MessageSquare } from 'lucide-react';
import type { ReactNode } from 'react';

import { Card, CardContent } from '@/ui/card';
import { Label } from '@/ui/label';
import { Textarea } from '@/ui/textarea';
import { Switch } from '@/ui/switch';
import AvailabilityPicker from '@/components/faculty-shared/AvailabilityPicker';

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
	slots: any[];
	onSlotsChange: (slots: any[]) => void;
	wellbeing: WellbeingState;
	onWellbeingChange: (key: keyof WellbeingState, checked: boolean) => void;
	notes: string;
	onNotesChange: (value: string) => void;
	canEdit: boolean;
	banners?: ReactNode;
};

export default function DesktopPreferencesLayout({
	slots,
	onSlotsChange,
	wellbeing,
	onWellbeingChange,
	notes,
	onNotesChange,
	canEdit,
	banners,
}: DesktopPreferencesLayoutProps) {
	return (
		<div className='grid grid-cols-[1fr_400px] gap-8 h-full'>
			{/* Left Column: Availability Grid */}
			<div className='space-y-6 overflow-y-auto pr-2'>
				<div className='flex items-center justify-between'>
					<div className='flex items-center gap-3'>
						<div className='p-2 rounded-xl bg-primary/10 text-primary'>
							<Clock className='size-6' />
						</div>
						<div>
							<h2 className='text-xl font-bold tracking-tight'>Weekly Availability</h2>
							<p className='text-sm text-muted-foreground italic'>Drag to paint your preferred time slots.</p>
						</div>
					</div>
				</div>

				{banners && <div className='space-y-4'>{banners}</div>}

				<AvailabilityPicker
					slots={slots}
					onChange={onSlotsChange}
					disabled={!canEdit}
				/>
			</div>

			{/* Right Column: Well-being and Notes */}
			<div className='space-y-6 overflow-y-auto pr-1'>
				{/* Well-being Panel */}
				<Card className='rounded-3xl border-border/50 bg-card shadow-sm'>
					<CardContent className='p-6 space-y-6'>
						<div className='flex items-center gap-3'>
							<div className='p-2 rounded-xl bg-rose-50 text-rose-500'>
								<Heart className='size-5' />
							</div>
							<h3 className='text-lg font-bold'>Well-being</h3>
						</div>

						<div className='grid gap-4'>
							{WELLBEING_ITEMS.map(({ key, label, description }) => (
								<div
									key={key}
									className='flex items-start gap-3 p-4 rounded-2xl border border-border bg-muted/20 hover:bg-muted/30 transition-colors'
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
										<p className='text-[11px] text-muted-foreground mt-1 leading-normal'>
											{description}
										</p>
									</div>
								</div>
							))}
						</div>
					</CardContent>
				</Card>

				{/* Notes Panel */}
				<Card className='rounded-3xl border-border/50 bg-card shadow-sm'>
					<CardContent className='p-6 space-y-4'>
						<div className='flex items-center gap-3'>
							<div className='p-2 rounded-xl bg-amber-50 text-amber-500'>
								<MessageSquare className='size-5' />
							</div>
							<h3 className='text-lg font-bold'>Additional Notes</h3>
						</div>

						<div className='space-y-2'>
							<Label className='text-xs font-bold text-muted-foreground uppercase ml-1'>
								Message to Scheduler
							</Label>
							<Textarea
								placeholder='Any other specific requests or considerations...'
								value={notes}
								onChange={(e) => onNotesChange(e.target.value)}
								disabled={!canEdit}
								className='min-h-[160px] resize-none rounded-2xl p-4 text-sm'
							/>
						</div>
					</CardContent>
				</Card>
			</div>
		</div>
	);
}
