import { cva } from 'class-variance-authority';

export const badgeVariants = cva(
	'inline-flex h-5 w-fit shrink-0 items-center justify-center gap-1 overflow-hidden rounded-4xl border border-transparent px-2 py-0.5 text-xs font-medium whitespace-nowrap transition-all focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2',
	{
		variants: {
			variant: {
				default:
					'bg-primary text-primary-foreground hover:bg-primary/80',
				secondary:
					'bg-secondary text-secondary-foreground hover:bg-secondary/80',
				destructive:
					'bg-destructive/10 text-destructive hover:bg-destructive/20',
				outline: 'border-border text-foreground',
				ghost: 'hover:bg-muted hover:text-muted-foreground',
				success: 'bg-emerald-100 text-emerald-800',
				warning: 'bg-amber-100 text-amber-800',
				danger: 'bg-red-100 text-red-800',
			},
		},
		defaultVariants: {
			variant: 'default',
		},
	},
);
