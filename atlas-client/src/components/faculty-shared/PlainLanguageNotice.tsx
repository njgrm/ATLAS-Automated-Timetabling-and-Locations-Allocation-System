import type { ReactNode } from 'react';

type PlainLanguageVariant = 'info' | 'warning' | 'success' | 'destructive';

type PlainLanguageNoticeProps = {
	variant?: PlainLanguageVariant;
	title: string;
	whatHappened?: string;
	whatNow?: string;
	whoToContact?: string;
	actionSlot?: ReactNode;
};

const VARIANT_CLASSES: Record<PlainLanguageVariant, string> = {
	info: 'border-blue-200 bg-blue-50 text-blue-900',
	warning: 'border-amber-200 bg-amber-50 text-amber-900',
	success: 'border-emerald-200 bg-emerald-50 text-emerald-900',
	destructive: 'border-destructive/30 bg-destructive/5 text-destructive',
};

function withPrefix(prefix: string, value?: string) {
	if (!value) return null;
	if (value.toLowerCase().startsWith(prefix.toLowerCase())) {
		return value;
	}
	return `${prefix}: ${value}`;
}

export default function PlainLanguageNotice({
	variant = 'info',
	title,
	whatHappened,
	whatNow,
	whoToContact,
	actionSlot,
}: PlainLanguageNoticeProps) {
	return (
		<div className={`rounded-xl border px-4 py-3 text-sm ${VARIANT_CLASSES[variant]}`}>
			<div className='flex flex-wrap items-start justify-between gap-2'>
				<p className='font-semibold'>{title}</p>
				{actionSlot}
			</div>
			<div className='mt-1 space-y-1'>
				{withPrefix('What happened', whatHappened) && <p>{withPrefix('What happened', whatHappened)}</p>}
				{withPrefix('What to do now', whatNow) && <p>{withPrefix('What to do now', whatNow)}</p>}
				{withPrefix('Who to contact', whoToContact) && <p>{withPrefix('Who to contact', whoToContact)}</p>}
			</div>
		</div>
	);
}
