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
				/**
				 * A7 C8 SLICE 1 — the acting sizes, raised to the packet's floor.
				 *
				 * The operator, 2026-09-29: *"Our default text and sizes should
				 * naturally be bigger"*, for older, mouse-first schedulers. A
				 * control is the easiest thing on the page to hit, so it is the
				 * first thing that has to be big enough to hit.
				 *
				 * THE NUMBERS, AND WHERE THEY COME FROM. `default` and `icon` were
				 * `h-8`/`size-8` (32px) and are now `h-10`/`size-10` (40px).
				 * `lg` and `icon-lg` were `h-9`/`size-9` (36px) and are now
				 * `h-11`/`size-11` (44px) — the packet's 44px floor for a PRIMARY
				 * action, and `lg` is the size a page reaches for when it means
				 * "this is the thing to press". `sm` (`h-10`) and `icon-sm`
				 * (`size-10`) were ALREADY 40px, which is why `sm` is the most
				 * used size in the app (413 call sites) and why the fix lands on
				 * `default` rather than on the common case.
				 *
				 * `default` MOVING TO `h-10` IS THE POINT, NOT A SIDE EFFECT: after
				 * this change `default` and `sm` are the same height, so a page can
				 * no longer produce a 32px button next to a 40px one and call it
				 * styling. §8 "One look per control" is about exactly that.
				 *
				 * WHY `xs` AND `icon-xs` ARE DELIBERATELY NOT IN THIS TABLE'S 40px
				 * SET. They stay at `h-6`/`size-6` (24px) and are recorded as an
				 * open deviation, because their 32 call sites are not in page
				 * furniture — they are INSIDE things that have a fixed geometry:
				 * `CampusMapEditorZoomControls` stacks three of them in a map
				 * corner, `TimetableGridConflictBadge` and `ScheduleEntryCell` sit
				 * in timetable cells, and `BuildingPanel`/`SubjectRow`/`FacultyRow`
				 * put them in repeated table rows. 40px there is not "bigger", it
				 * is a broken grid, and this slice has no rendered row to catch it.
				 * The honest fix is a re-fit pass that decides what each of those
				 * surfaces gives up, which is the planner's next slice, not a
				 * number typed into a variant here. 24px does clear WCAG 2.2 AA
				 * 2.5.8 Target Size (Minimum).
				 */
				default: 'h-10 gap-1.5 px-2.5',
				xs: "h-6 gap-1 rounded-[min(var(--radius-md),10px)] px-2 text-xs in-data-[slot=button-group]:rounded-md has-data-[icon=inline-end]:pr-1.5 has-data-[icon=inline-start]:pl-1.5 [&_svg:not([class*='size-'])]:size-3",
				sm: "h-10 gap-1 rounded-[min(var(--radius-md),12px)] px-2.5 text-[0.8rem] in-data-[slot=button-group]:rounded-md has-data-[icon=inline-end]:pr-2 has-data-[icon=inline-start]:pl-2 [&_svg:not([class*='size-'])]:size-3.5",
				lg: 'h-11 gap-1.5 px-2.5',
				icon: 'size-10',
				'icon-xs':
					"size-6 rounded-[min(var(--radius-md),10px)] in-data-[slot=button-group]:rounded-md [&_svg:not([class*='size-'])]:size-3",
				'icon-sm':
					'size-10 rounded-[min(var(--radius-md),12px)] in-data-[slot=button-group]:rounded-md [&_svg:not([class*="size-"])]:size-3.5',
				'icon-lg': 'size-11',
			},
		},
		defaultVariants: {
			variant: 'default',
			size: 'default',
		},
	},
);
