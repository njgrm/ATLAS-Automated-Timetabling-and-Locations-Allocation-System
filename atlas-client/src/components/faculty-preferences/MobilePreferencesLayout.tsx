import { motion } from 'motion/react';
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

type MobilePreferencesLayoutProps = {
	slots: any[];
	onSlotsChange: (slots: any[]) => void;
	wellbeing: WellbeingState;
	onWellbeingChange: (key: keyof WellbeingState, checked: boolean) => void;
	notes: string;
	onNotesChange: (value: string) => void;
	canEdit: boolean;
	banners?: ReactNode;
};

export default function MobilePreferencesLayout({
	slots,
	onSlotsChange,
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

			{/* Section 1: Availability */}
			<section className='space-y-4'>
				<div className='flex items-center gap-2 px-1'>
					<Clock className='size-5 text-primary' />
					<h2 className='text-lg font-bold tracking-tight'>Weekly Availability</h2>
				</div>
				<AvailabilityPicker
					slots={slots}
					onChange={onSlotsChange}
					disabled={!canEdit}
				/>
			</section>

			{/* Section 2: Well-being */}
			<section className='space-y-4'>
				<div className='flex items-center gap-2 px-1'>
					<Heart className='size-5 text-rose-500' />
					<h2 className='text-lg font-bold tracking-tight'>Well-being Preferences</h2>
				</div>
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

			{/* Section 3: Notes */}
			<section className='space-y-4'>
				<div className='flex items-center gap-2 px-1'>
					<MessageSquare className='size-5 text-amber-500' />
					<h2 className='text-lg font-bold tracking-tight'>Additional Notes</h2>
				</div>
				<Card className='rounded-2xl border-border/50 overflow-hidden shadow-sm'>
					<CardContent className='p-0'>
						<Textarea
							placeholder='Any other specific requests or considerations for the scheduling officer...'
							value={notes}
							onChange={(e) => onNotesChange(e.target.value)}
							disabled={!canEdit}
							className='min-h-[120px] resize-none border-0 rounded-none focus-visible:ring-0 p-4 text-sm'
						/>
					</CardContent>
				</Card>
			</section>
		</div>
	);
}
