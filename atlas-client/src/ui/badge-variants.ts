import { cva } from 'class-variance-authority';

export const badgeVariants = cva(
	// A SINGLE-LINE PILL MUST FIT ITS BOX, AND THE FIT HAS TO SURVIVE A CONSUMER.
	// With `box-sizing: border-box`, `h-5` = 20px minus `border` 1px x2 minus
	// `py-0.5` 2px x2 leaves a 14px content box, so the line box has to be the font
	// size and nothing else. Since A7 C8 raised `--text-xs` to 14px/20px, every
	// `<Badge>` that re-states a size (`text-xs`, `text-sm`, …) came back with a
	// 20px line box inside that 14px box and `overflow-hidden` cut the glyphs:
	// measured on staging at 1366x768, 119 clipped chips across 11 pages, all of
	// them rendering through this primitive.
	//
	// `leading-none` alone cannot hold the line, because `cn()` runs tailwind-merge
	// and in Tailwind v4 a `text-*` size utility emits font-size AND line-height, so
	// twMerge sees a conflict with the `leading-*` group and DELETES the primitive's
	// `leading-none` when a consumer states a size. `badge-line-box` is a class name
	// of our own (declared in `index.css`), so twMerge does not recognise it, cannot
	// merge it away, and it carries specificity (0,2,0) that outranks the utility.
	// The rendered proof is that the line box stays 14px on a chip whose consumer
	// re-states `text-xs`; the gate is `src/lib/__tests__/a7-c9-refit.test.ts`.
	//
	// `leading-none` is kept as well: it costs nothing and it is what a consumer
	// that states a `leading-*` of its own falls back to. The pill stays 20px tall.
	'inline-flex h-5 w-fit shrink-0 items-center justify-center gap-1 overflow-hidden rounded-4xl border border-transparent px-2 py-0.5 text-xs font-medium leading-none badge-line-box whitespace-nowrap transition-all focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2',
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
