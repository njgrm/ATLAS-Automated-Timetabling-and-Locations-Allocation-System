import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
	return twMerge(clsx(inputs));
}

/** Convert "HH:MM" (24h) to "h:mm AM/PM" display format. */
export function formatTime(hhmm: string): string {
	const [hStr, mStr] = hhmm.split(':');
	let h = Number(hStr);
	const suffix = h >= 12 ? 'PM' : 'AM';
	if (h === 0) h = 12;
	else if (h > 12) h -= 12;
	return `${h}:${mStr} ${suffix}`;
}
