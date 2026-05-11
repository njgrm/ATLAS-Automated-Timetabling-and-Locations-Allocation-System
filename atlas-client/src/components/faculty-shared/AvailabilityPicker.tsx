import { useMemo, useState, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Copy, Trash2, Undo2 } from 'lucide-react';
import { formatTime } from '@/lib/utils';
import type { DayOfWeek, TimeSlotPreference } from '@/types';
import { Button } from '@/ui/button';
import { Badge } from '@/ui/badge';

type SlotData = {
	day: DayOfWeek;
	startTime: string;
	endTime: string;
	preference: TimeSlotPreference;
};

type AvailabilityPickerProps = {
	slots: SlotData[];
	onChange: (slots: SlotData[]) => void;
	disabled?: boolean;
};

const DAYS: DayOfWeek[] = ['MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY'];

// Standardized school periods (e.g., every 15 mins from 7am to 7pm)
const START_HOUR = 7;
const END_HOUR = 19;
const STEP_MINUTES = 15;

const TIME_SLOTS: string[] = [];
for (let h = START_HOUR; h < END_HOUR; h++) {
	for (let m = 0; m < 60; m += STEP_MINUTES) {
		const hour = h.toString().padStart(2, '0');
		const minute = m.toString().padStart(2, '0');
		TIME_SLOTS.push(`${hour}:${minute}`);
	}
}

const PREF_COLORS: Record<TimeSlotPreference, string> = {
	PREFERRED: 'bg-green-500 border-green-600 text-white',
	AVAILABLE: 'bg-blue-400 border-blue-500 text-white',
	UNAVAILABLE: 'bg-rose-500 border-rose-600 text-white',
};

const PREF_ORDER: TimeSlotPreference[] = ['AVAILABLE', 'PREFERRED', 'UNAVAILABLE'];

export default function AvailabilityPicker({ slots, onChange, disabled }: AvailabilityPickerProps) {
	const [activePref, setActivePref] = useState<TimeSlotPreference>('PREFERRED');
	const [isDragging, setIsDragging] = useState(false);
	const [dragValue, setDragValue] = useState<TimeSlotPreference | null>(null);
	const containerRef = useRef<HTMLDivElement>(null);

	const slotMap = useMemo(() => {
		const map = new Map<string, TimeSlotPreference>();
		slots.forEach((s) => {
			// This is a simplified mapper. In a real app, we'd handle overlapping/partial slots.
			// For this interactive grid, we assume slots align to our grid steps.
			map.set(`${s.day}|${s.startTime}`, s.preference);
		});
		return map;
	}, [slots]);

	const handleCellInteraction = useCallback((day: DayOfWeek, time: string, isClick = false) => {
		if (disabled) return;

		const current = slotMap.get(`${day}|${time}`);
		let next: TimeSlotPreference | null = activePref;

		if (isClick && current === activePref) {
			// Toggle off if clicking the same pref
			next = null;
		}

		if (isDragging && dragValue !== null) {
			next = dragValue;
		} else if (isClick) {
			setDragValue(next);
		}

		const nextSlots = [...slots].filter(s => !(s.day === day && s.startTime === time));
		if (next) {
			// Calculate end time
			const [h, m] = time.split(':').map(Number);
			const date = new Date();
			date.setHours(h, m + STEP_MINUTES);
			const endTime = `${date.getHours().toString().padStart(2, '0')}:${date.getMinutes().toString().padStart(2, '0')}`;
			
			nextSlots.push({
				day,
				startTime: time,
				endTime,
				preference: next
			});
		}
		onChange(nextSlots);
	}, [slots, slotMap, activePref, disabled, isDragging, dragValue, onChange]);

	const copyMondayToAll = () => {
		const mondaySlots = slots.filter(s => s.day === 'MONDAY');
		const nextSlots = [...mondaySlots];
		DAYS.slice(1).forEach(day => {
			mondaySlots.forEach(s => {
				nextSlots.push({ ...s, day });
			});
		});
		onChange(nextSlots);
	};

	const clearAll = () => onChange([]);

	return (
		<div className='flex flex-col gap-4' onMouseUp={() => { setIsDragging(false); setDragValue(null); }}>
			<div className='flex flex-wrap items-center justify-between gap-3 p-4 bg-muted/30 rounded-2xl border border-border'>
				<div className='flex items-center gap-2'>
					{PREF_ORDER.map(pref => (
						<button
							key={pref}
							onClick={() => setActivePref(pref)}
							className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition-all ${
								activePref === pref ? PREF_COLORS[pref] : 'bg-background border-border text-muted-foreground'
							}`}
						>
							{pref.charAt(0) + pref.slice(1).toLowerCase()}
						</button>
					))}
				</div>
				<div className='flex items-center gap-2'>
					<Button variant='outline' size='sm' onClick={copyMondayToAll} className='h-8 text-[11px] gap-1.5'>
						<Copy className='size-3.5' /> Copy Mon to All
					</Button>
					<Button variant='ghost' size='sm' onClick={clearAll} className='h-8 text-[11px] gap-1.5 text-destructive hover:bg-destructive/10'>
						<Trash2 className='size-3.5' /> Clear
					</Button>
				</div>
			</div>

			<div className='overflow-x-auto rounded-2xl border border-border bg-card shadow-sm select-none'>
				<div className='min-w-[700px]'>
					<div className='grid grid-cols-[80px_repeat(5,1fr)] border-b border-border bg-muted/20'>
						<div className='p-2 text-[10px] font-bold uppercase text-muted-foreground border-r border-border' />
						{DAYS.map(day => (
							<div key={day} className='p-2 text-[10px] font-bold uppercase text-center text-muted-foreground border-r border-border last:border-r-0'>
								{day.slice(0, 3)}
							</div>
						))}
					</div>

					<div className='divide-y divide-border'>
						{TIME_SLOTS.map(time => (
							<div key={time} className='grid grid-cols-[80px_repeat(5,1fr)] group'>
								<div className='p-1 text-[10px] font-medium text-muted-foreground border-r border-border bg-muted/5 flex items-center justify-center'>
									{formatTime(time)}
								</div>
								{DAYS.map(day => {
									const pref = slotMap.get(`${day}|${time}`);
									return (
										<div
											key={day}
											onMouseDown={() => {
												setIsDragging(true);
												const nextVal = pref === activePref ? null : activePref;
												setDragValue(nextVal);
												handleCellInteraction(day, time, true);
											}}
											onMouseEnter={() => {
												if (isDragging) handleCellInteraction(day, time);
											}}
											className={`h-8 border-r border-border last:border-r-0 transition-colors cursor-pointer relative ${
												pref ? PREF_COLORS[pref] : 'hover:bg-primary/5'
											}`}
										>
											{pref && (
												<div className='absolute inset-0.5 rounded-sm opacity-50 bg-white/20' />
											)}
										</div>
									);
								})}
							</div>
						))}
					</div>
				</div>
			</div>
			<p className='text-[11px] text-muted-foreground italic px-1'>
				Click or drag to paint your availability. Green for preferred, Blue for available, Red for unavailable.
			</p>
		</div>
	);
}
