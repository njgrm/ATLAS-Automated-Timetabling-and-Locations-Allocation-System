import * as React from 'react';
import { cn } from '@/lib/utils';

const Card = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
	({ className, ...props }, ref) => (
		<div
			ref={ref}
			className={cn(
				'flex flex-col overflow-hidden rounded-xl bg-white text-sm text-card-foreground border border-zinc-200/80 shadow-[0_2px_8px_-3px_rgba(0,0,0,0.06),0_10px_22px_-6px_rgba(0,0,0,0.04)] transition-shadow duration-200 py-0 gap-0',
				className
			)}
			{...props}
		/>
	),
);
Card.displayName = 'Card';

const CardHeader = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
	({ className, ...props }, ref) => (
		<div
			ref={ref}
			className={cn('grid auto-rows-min items-start gap-1 rounded-t-xl px-6 py-4 bg-zinc-50/60 border-b border-zinc-100', className)}
			{...props}
		/>
	),
);
CardHeader.displayName = 'CardHeader';

const CardTitle = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
	({ className, ...props }, ref) => (
		<div
			ref={ref}
			className={cn('font-heading text-base leading-snug font-semibold tracking-tight text-zinc-900', className)}
			{...props}
		/>
	),
);
CardTitle.displayName = 'CardTitle';

const CardDescription = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
	({ className, ...props }, ref) => (
		<div
			ref={ref}
			className={cn('font-mono text-xs tracking-wider font-medium text-zinc-400 uppercase', className)}
			{...props}
		/>
	),
);
CardDescription.displayName = 'CardDescription';

const CardContent = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
	({ className, ...props }, ref) => <div ref={ref} className={cn('px-6 py-5', className)} {...props} />,
);
CardContent.displayName = 'CardContent';

const CardFooter = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
	({ className, ...props }, ref) => (
		<div
			ref={ref}
			className={cn('flex items-center rounded-b-xl border-t bg-muted/50 p-4', className)}
			{...props}
		/>
	),
);
CardFooter.displayName = 'CardFooter';

export { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter };
