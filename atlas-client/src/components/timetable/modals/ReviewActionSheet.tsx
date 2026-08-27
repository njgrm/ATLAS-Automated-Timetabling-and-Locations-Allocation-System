import type { ReactNode } from 'react';

import { cn } from '@/lib/utils';

type ReviewActionSheetProps = {
	type: 'generated-placement' | 'draft-placement' | 'draft-swap' | 'generated-swap';
	children: ReactNode;
	className?: string;
};

type ReviewActionSectionProps = {
	title: 'What changes' | 'Blocks' | 'Warnings' | 'After save' | 'Room source' | 'Swap options' | 'Blocked' | `${string} status`;
	description?: string;
	children: ReactNode;
	tone?: 'neutral' | 'good' | 'warn' | 'bad';
};

const sectionToneClass: Record<NonNullable<ReviewActionSectionProps['tone']>, string> = {
	neutral: 'border-border bg-background',
	good: 'border-emerald-200 bg-emerald-50/80',
	warn: 'border-amber-200 bg-amber-50/80',
	bad: 'border-red-200 bg-red-50/80',
};

export function ReviewActionSheet({ type, children, className }: ReviewActionSheetProps) {
	return (
		<div
			data-testid="review-action-sheet"
			data-review-action-type={type}
			className={cn('grid gap-3 text-xs', className)}
		>
			{children}
		</div>
	);
}

export function ReviewActionSection({
	title,
	description,
	children,
	tone = 'neutral',
}: ReviewActionSectionProps) {
	return (
		<section className={cn('rounded-lg border p-3', sectionToneClass[tone])}>
			<div className="mb-2">
				<h3 className="text-xs font-semibold uppercase tracking-wide text-foreground">{title}</h3>
				{description ? <p className="mt-0.5 text-xs leading-snug text-muted-foreground">{description}</p> : null}
			</div>
			{children}
		</section>
	);
}

export function ReviewActionMiniCard({
	label,
	value,
	muted,
}: {
	label: string;
	value: ReactNode;
	muted?: boolean;
}) {
	return (
		<div className={cn('rounded-md border border-border bg-muted/20 p-2.5', muted && 'text-muted-foreground')}>
			<p className="text-[0.68rem] font-semibold uppercase tracking-wide text-muted-foreground">{label}</p>
			<div className="mt-1 text-sm font-medium text-foreground">{value}</div>
		</div>
	);
}
