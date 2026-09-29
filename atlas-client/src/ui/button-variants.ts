import { cva } from 'class-variance-authority';

export const buttonVariants = cva(
	"inline-flex shrink-0 items-center justify-center rounded-lg border border-transparent bg-clip-padding text-sm font-medium whitespace-nowrap transition-all outline-none select-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 active:not-aria-[haspopup]:translate-y-px disabled:pointer-events-none disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/20 dark:aria-invalid:border-destructive/50 dark:aria-invalid:ring-destructive/40 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
	{
		variants: {
			variant: {
				default: 'bg-primary text-primary-foreground [a]:hover:bg-primary/80 hover:bg-primary/80 shadow-sm',
				outline:
					'border-border bg-background hover:bg-muted hover:text-foreground aria-expanded:bg-muted aria-expanded:text-foreground shadow-sm dark:border-input dark:bg-input/30 dark:hover:bg-input/50',
				secondary:
					'bg-secondary text-secondary-foreground hover:bg-secondary/80 aria-expanded:bg-secondary aria-expanded:text-secondary-foreground shadow-sm',
				ghost:
					'hover:bg-muted hover:text-foreground aria-expanded:bg-muted aria-expanded:text-foreground dark:hover:bg-muted/50',
				destructive:
					'bg-destructive/10 text-destructive hover:bg-destructive/20 focus-visible:border-destructive/40 focus-visible:ring-destructive/20 dark:bg-destructive/20 dark:hover:bg-destructive/30 dark:focus-visible:ring-destructive/40 shadow-sm',
				link: 'text-primary underline-offset-4 hover:underline',
				/**
				 * A2 C13 (item 3a) — the ONE "plainly unavailable" look, in `@/ui`, so
				 * every page that needs it gets the same one (AGENTS.md §8 "One look per
				 * control").
				 *
				 * WHY IT EXISTS. `variant="default"` is `bg-primary` (a solid green)
				 * and the shared base adds `disabled:opacity-50`. A solid green button
				 * at 50% opacity is a PALE GREEN button: it still reads as a primary
				 * that is "almost ready". The operator's words on `/timetable` were
				 * *"the disabled Generate reads as a pale-green near-miss"* — and for
				 * this user the worst possible reading is a control that looks like
				 * the next step and is not.
				 *
				 * WHY IT IS GREY, NOT A FADED GREEN. The defect is specifically the
				 * retained `bg-primary`, not the opacity.
				 *
				 * WHY THERE IS NO `disabled:opacity-100` HERE. Two same-property
				 * Tailwind utilities (`disabled:opacity-50` vs `disabled:opacity-100`)
				 * are resolved by STYLESHEET order, not by class order, so "fixing" it
				 * that way is a coin flip that flips on the next Tailwind build. The
				 * base string is left exactly as it is. A pale GREY control already
				 * reads as unavailable; the base's `disabled:opacity-50` only deepens
				 * that, and a half-opacity neutral has no colour to misread.
				 *
				 * No `bg-primary`, no green, no `shadow-sm`: a raised edge is a
				 * "pressable" signal and this control is not pressable.
				 */
				unavailable:
					'border-border bg-muted text-muted-foreground shadow-none dark:border-input dark:bg-muted/40',
			},
			size: {
				default: 'h-8 gap-1.5 px-2.5',
				xs: "h-6 gap-1 rounded-[min(var(--radius-md),10px)] px-2 text-xs in-data-[slot=button-group]:rounded-md has-data-[icon=inline-end]:pr-1.5 has-data-[icon=inline-start]:pl-1.5 [&_svg:not([class*='size-'])]:size-3",
				sm: "h-10 gap-1 rounded-[min(var(--radius-md),12px)] px-2.5 text-[0.8rem] in-data-[slot=button-group]:rounded-md has-data-[icon=inline-end]:pr-2 has-data-[icon=inline-start]:pl-2 [&_svg:not([class*='size-'])]:size-3.5",
				lg: 'h-9 gap-1.5 px-2.5',
				icon: 'size-8',
				'icon-xs':
					"size-6 rounded-[min(var(--radius-md),10px)] in-data-[slot=button-group]:rounded-md [&_svg:not([class*='size-'])]:size-3",
				'icon-sm':
					'size-10 rounded-[min(var(--radius-md),12px)] in-data-[slot=button-group]:rounded-md [&_svg:not([class*="size-"])]:size-3.5',
				'icon-lg': 'size-9',
			},
		},
		defaultVariants: {
			variant: 'default',
			size: 'default',
		},
	},
);
