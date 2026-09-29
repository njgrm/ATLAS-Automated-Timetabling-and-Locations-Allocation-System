import { cva } from 'class-variance-authority';

export const badgeVariants = cva(
	// `leading-none` is load-bearing, not cosmetic: a single-line pill must not inherit
	// `--text-xs--line-height` (1.25rem = 20px) inside a fixed `h-5` box. With
	// `box-sizing: border-box`, `h-5` = 20px minus `border` 1px x2 minus `py-0.5` 2px x2
	// leaves a 14px content box, so a 20px line box overflows and `overflow-hidden` cuts
	// the glyphs (measured on staging at 1366x768: `scrollHeight` 21 / `clientHeight` 18
	// on every `<Badge>` chip once `--text-xs` was raised to 14px). `leading-none` sets the
	// line box to 14px, which fits exactly. The pill stays 20px tall -- we do not grow it.
	'inline-flex h-5 w-fit shrink-0 items-center justify-center gap-1 overflow-hidden rounded-4xl border border-transparent px-2 py-0.5 text-xs font-medium leading-none whitespace-nowrap transition-all focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2',
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
