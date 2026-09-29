import * as React from 'react';
import * as SelectPrimitive from '@radix-ui/react-select';
import { Check, ChevronDown, ChevronUp } from 'lucide-react';
import { cn } from '@/lib/utils';

/**
 * AGENTS.md §8 "One look per control" — the ONE picker chrome, in `@/ui`.
 *
 * The operator's 2026-09-29 ruling: "Subject dropdowns look different from the
 * Section and Teacher dropdowns", and the fix is not a per-page override but a
 * single shared look. §8 is explicit that a page may not keep a local
 * `className` override that changes a primitive's look, so the string lives HERE,
 * next to the primitive, and every page adopts it by importing it.
 *
 * IT STARTED AS TEACHING LOAD'S `CONTROL_CHROME`, IN THAT ORDER:
 * `atlas-client/src/components/faculty-assignments/TeachingLoadFilterBar.tsx:65`
 * (`h-9 rounded-xl border border-border/60 bg-background px-2.5 text-xs
 * transition-colors hover:bg-muted/40`). That bar is the reference control the
 * operator named, so the shared constant started from its exact classes rather
 * than from a fresh design. A5 owns the cross-page picker sweep and A6 owns the
 * Teaching Load header; both adopt THIS constant, which is the handoff.
 *
 * A7 C8 SLICE 1 (2026-09-29) — THE ONE DEPARTURE FROM "VERBATIM": `h-9` (36px)
 * is now `h-10` (40px), so this string is no longer byte-identical to
 * `TeachingLoadFilterBar.tsx:65` and the sentence above has been corrected rather
 * than left standing. The reason is the packet's floor for a control that acts,
 * and it applies to the shared picker exactly as it does to the shared button: a
 * control a scheduler has to hit accurately is unusable to this audience. It is
 * recorded here rather than made silently, because a constant that claims to be
 * another file's string verbatim and is not is a lie the next reader will act on.
 * Any test that pins this exact string is a test pinning the OLD height and is
 * re-pinned by name, not deleted.
 *
 * `text-xs` is unchanged here and is now 14px, not 12px (A7 C8 also raised
 * `--text-xs` in `index.css`), which widens every composed face this trigger has
 * to hold. `px-2.5` is deliberately NOT increased: the trigger is a fixed-width
 * rectangle and the re-fit pass owns the width arithmetic with a rendered row to
 * measure it against.
 *
 * WHY A STRING AND NOT A COMPONENT: the pickers differ in WIDTH and in whether
 * they are a Radix `Select` or the one searchable combobox, and §8 also requires
 * the same SEARCH BEHAVIOUR for the same control — so a wrapper component would
 * have to paper over three real differences. `cn()`/tailwind-merge resolves each
 * conflicting group (height, radius, border colour, padding, text size) in favour
 * of the class passed last, which is exactly what `SelectTrigger` already does
 * for its own base classes.
 */
export const SELECT_TRIGGER_PICKER_CLASS =
	'h-10 rounded-xl border border-border/60 bg-background px-2.5 text-xs transition-colors hover:bg-muted/40';

/**
 * §8 "One look per control", and now also one BEHAVIOUR for the same control — the
 * ONE value that means "this picker is controlled and nothing is chosen yet".
 *
 * Radix reads `value={undefined}` as "be UNCONTROLLED", so a picker that passes
 * `undefined` while its options are still loading mounts uncontrolled and becomes
 * controlled when they arrive. React then warns — "Select is changing from
 * uncontrolled to controlled. Components should not switch from controlled to
 * uncontrolled (or vice versa). Decide between using a controlled or uncontrolled
 * value for the lifetime of the component." — which is a real defect on every
 * platform, not a nuisance to be suppressed. The empty string is the DEFINED
 * "nothing chosen" value: the picker stays controlled for its whole lifetime and
 * `SelectValue` renders its placeholder, so the control claims only what is true.
 *
 * It lives here, beside the primitive, for the reason the chrome constant does: two
 * call sites had the same shape and must not grow two different workarounds. It is
 * safe as a value because Radix REJECTS an empty-string `SelectItem`, so a blank
 * item can never collide with it — the sentinel belongs on the control, never in
 * the list.
 */
export const SELECT_NO_VALUE = '';

const Select = SelectPrimitive.Root;
const SelectGroup = SelectPrimitive.Group;
const SelectValue = SelectPrimitive.Value;

const SelectTrigger = React.forwardRef<
	React.ElementRef<typeof SelectPrimitive.Trigger>,
	React.ComponentPropsWithoutRef<typeof SelectPrimitive.Trigger>
>(({ className, children, ...props }, ref) => (
	<SelectPrimitive.Trigger
		ref={ref}
		className={cn(
			'flex h-10 w-full items-center justify-between rounded-md border border-input bg-background px-4 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 [&>span]:line-clamp-1',
			className,
		)}
		{...props}
	>
		{children}
		<SelectPrimitive.Icon asChild>
			<ChevronDown className='h-4 w-4 opacity-50' />
		</SelectPrimitive.Icon>
	</SelectPrimitive.Trigger>
));
SelectTrigger.displayName = SelectPrimitive.Trigger.displayName;

const SelectScrollUpButton = React.forwardRef<
	React.ElementRef<typeof SelectPrimitive.ScrollUpButton>,
	React.ComponentPropsWithoutRef<typeof SelectPrimitive.ScrollUpButton>
>(({ className, ...props }, ref) => (
	<SelectPrimitive.ScrollUpButton
		ref={ref}
		className={cn(
			'flex cursor-default items-center justify-center py-1.5 transition-all duration-500 ease-in-out hover:bg-primary/10 text-primary-foreground data-[state=visible]:animate-in data-[state=visible]:fade-in-0 data-[state=visible]:slide-in-from-bottom-2 data-[state=hidden]:animate-out data-[state=hidden]:fade-out-0 data-[state=hidden]:slide-out-to-top-2',
			className,
		)}
		{...props}
	>
		<ChevronUp className='h-4 w-4 stroke-3' />
	</SelectPrimitive.ScrollUpButton>
));
SelectScrollUpButton.displayName = SelectPrimitive.ScrollUpButton.displayName;

const SelectScrollDownButton = React.forwardRef<
	React.ElementRef<typeof SelectPrimitive.ScrollDownButton>,
	React.ComponentPropsWithoutRef<typeof SelectPrimitive.ScrollDownButton>
>(({ className, ...props }, ref) => (
	<SelectPrimitive.ScrollDownButton
		ref={ref}
		className={cn(
			'flex cursor-default items-center justify-center py-1.5 transition-all duration-500 ease-in-out hover:bg-primary/10 text-primary-foreground data-[state=visible]:animate-in data-[state=visible]:fade-in-0 data-[state=visible]:slide-in-from-top-2 data-[state=hidden]:animate-out data-[state=hidden]:fade-out-0 data-[state=hidden]:slide-out-to-bottom-2',
			className,
		)}
		{...props}
	>
		<ChevronDown className='h-4 w-4 stroke-3' />
	</SelectPrimitive.ScrollDownButton>
));
SelectScrollDownButton.displayName = SelectPrimitive.ScrollDownButton.displayName;

const SelectContent = React.forwardRef<
	React.ElementRef<typeof SelectPrimitive.Content>,
	React.ComponentPropsWithoutRef<typeof SelectPrimitive.Content>
>(({ className, children, position = 'popper', ...props }, ref) => {
	return (
		<SelectPrimitive.Portal>
			<SelectPrimitive.Content
				ref={ref}
				className={cn(
					'relative z-50 max-h-96 min-w-32 overflow-hidden rounded-md border border-border bg-popover text-popover-foreground shadow-md data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2',
					position === 'popper' &&
						'data-[side=bottom]:translate-y-1 data-[side=left]:-translate-x-1 data-[side=right]:translate-x-1 data-[side=top]:-translate-y-1',
					className,
				)}
				position={position}
				{...props}
			>
				<SelectScrollUpButton />
				<SelectPrimitive.Viewport
					className={cn(
						'p-1 scroll-smooth scrollbar-thin scrollbar-track-transparent scrollbar-thumb-border hover:scrollbar-thumb-muted-foreground/50',
						position === 'popper' &&
							'h-(--radix-select-trigger-height) w-full min-w-(--radix-select-trigger-width)',
					)}
				>
					{children}
				</SelectPrimitive.Viewport>
				<SelectScrollDownButton />
			</SelectPrimitive.Content>
		</SelectPrimitive.Portal>
	);
});
SelectContent.displayName = SelectPrimitive.Content.displayName;

const SelectLabel = React.forwardRef<
	React.ElementRef<typeof SelectPrimitive.Label>,
	React.ComponentPropsWithoutRef<typeof SelectPrimitive.Label>
>(({ className, ...props }, ref) => (
	<SelectPrimitive.Label
		ref={ref}
		className={cn('py-1.5 pl-8 pr-2 text-sm font-semibold', className)}
		{...props}
	/>
));
SelectLabel.displayName = SelectPrimitive.Label.displayName;

const SelectItem = React.forwardRef<
	React.ElementRef<typeof SelectPrimitive.Item>,
	React.ComponentPropsWithoutRef<typeof SelectPrimitive.Item>
>(({ className, children, ...props }, ref) => (
	<SelectPrimitive.Item
		ref={ref}
		className={cn(
			// The checked state needs a BACKGROUND, not just a foreground.
			//
			// This used to set only `data-[state=checked]:text-primary-foreground`
			// with no background, so a selected-but-not-hovered option rendered
			// white text on the white `--popover` surface (220 14% 96% is
			// `--popover` 0 0% 100%): the selection was invisible, and hovering
			// merely *appeared* to fix it because `focus:`/`data-[highlighted]:`
			// do supply `bg-primary`.
			//
			// `dropdown-menu.tsx` pairs `bg-accent` with `text-accent-foreground`,
			// but in THIS theme `--accent` is an alias of `--primary` (158 64% 40%)
			// and `--accent-foreground` is an alias of `--primary-foreground`
			// (0 0% 100%). Copying that pairing literally would render the checked
			// state pixel-identical to the highlighted state and reintroduce the
			// exact missing-differentiation defect this fix exists to close.
			//
			// The `secondary` family keeps the pairing intact while staying
			// visibly distinct: checked = light `--secondary` with near-black
			// text; highlighted/focused = solid `--primary` with white text.
			'relative flex w-full cursor-default select-none items-center rounded-sm py-1.5 pl-8 pr-2 text-sm outline-none focus:bg-primary focus:text-primary-foreground focus:[&_*]:text-primary-foreground data-[highlighted]:bg-primary data-[highlighted]:text-primary-foreground data-[highlighted]:[&_*]:text-primary-foreground data-[state=checked]:bg-secondary data-[state=checked]:text-secondary-foreground data-[state=checked]:[&_*]:text-secondary-foreground data-disabled:pointer-events-none data-disabled:opacity-50',
			className,
		)}
		{...props}
	>
		<span className='absolute left-2 flex h-3.5 w-3.5 items-center justify-center'>
			<SelectPrimitive.ItemIndicator>
				<Check className='h-4 w-4' />
			</SelectPrimitive.ItemIndicator>
		</span>

		<SelectPrimitive.ItemText>{children}</SelectPrimitive.ItemText>
	</SelectPrimitive.Item>
));
SelectItem.displayName = SelectPrimitive.Item.displayName;

const SelectSeparator = React.forwardRef<
	React.ElementRef<typeof SelectPrimitive.Separator>,
	React.ComponentPropsWithoutRef<typeof SelectPrimitive.Separator>
>(({ className, ...props }, ref) => (
	<SelectPrimitive.Separator
		ref={ref}
		className={cn('-mx-1 my-1 h-px bg-muted', className)}
		{...props}
	/>
));
SelectSeparator.displayName = SelectPrimitive.Separator.displayName;

export {
	Select,
	SelectGroup,
	SelectValue,
	SelectTrigger,
	SelectContent,
	SelectLabel,
	SelectItem,
	SelectSeparator,
	SelectScrollUpButton,
	SelectScrollDownButton,
};
