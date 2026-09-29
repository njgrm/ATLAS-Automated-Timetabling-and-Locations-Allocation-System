import * as React from 'react';
import * as DropdownMenuPrimitive from '@radix-ui/react-dropdown-menu';
import { Check, ChevronRight, Circle } from 'lucide-react';

import { cn } from '@/lib/utils';

/**
 * A5 c8b (2026-09-29) — THE ONE ROW-MENU RECIPE, and the reason it is opt-in.
 *
 * The operator's teachers.docx round, item 6: *"Row 3-dots menu items wrap to
 * two lines."* Every roster fixed its row menu at one hand-picked width
 * (`w-52` on Teachers, `w-48` on Sections, `w-56`/`min-w-[13rem]` on Subjects,
 * `w-44` on the Subjects mobile card and the Teaching Load teacher grid), and on
 * the Teachers roster the fixed 208px box wrapped "Edit temporary teacher
 * details" onto two lines. A menu item is a VERB PHRASE, not a word, and a
 * phrase that breaks after "temporary" is what makes the menu look broken to
 * the older, mouse-first scheduler who has to read it before clicking it.
 *
 * So the width stops being a per-page decision. The menu is as wide as its
 * longest item (`w-max`), never narrower than 13rem so a two-word menu does not
 * look collapsed, and never wider than `min(28rem, 90vw)` so a long label cannot
 * spill off the right edge of the window. The item side is the half that
 * actually stops the wrap: `whitespace-nowrap` plus the `gap-2` that every row
 * menu wants between its icon and its label.
 *
 * WHY IT IS NOT THE PRIMITIVE'S BASE, and this is the part that must not be
 * "tidied" later. `DropdownMenuContent` / `DropdownMenuItem` are shared with
 * pickers, toolbars, the app sidebar and the timetable menus, whose items
 * (`ScheduleReviewWorkspaceHeader`, `WorkspaceToolbar`, `TimetableSimpleHeader`)
 * are long SENTENCES that are meant to wrap and are read as a help panel. Forcing
 * `whitespace-nowrap` on the primitive would push those off the viewport. The
 * recipe therefore stays a CALL-SITE contract: a roster row opts in, everything
 * else keeps exactly the look it has today. The primitive's own base classes
 * (`min-w-[8rem]`, padding, animations) are unchanged, which is what
 * `subjects-ux-a3.test.ts` A3-19 asserts.
 *
 * `min-w-52` is 13rem — deliberately the same 208px the Subjects call site had
 * hand-written as `min-w-[13rem]`, so adopting the recipe there moved nothing.
 */
const rowMenuContentClassName = 'w-max min-w-52 max-w-[min(28rem,90vw)]';
const rowMenuItemClassName = 'gap-2 whitespace-nowrap';

const DropdownMenu = DropdownMenuPrimitive.Root;

const DropdownMenuTrigger = DropdownMenuPrimitive.Trigger;

const DropdownMenuGroup = DropdownMenuPrimitive.Group;

const DropdownMenuPortal = DropdownMenuPrimitive.Portal;

const DropdownMenuSub = DropdownMenuPrimitive.Sub;

const DropdownMenuRadioGroup = DropdownMenuPrimitive.RadioGroup;

const DropdownMenuSubTrigger = React.forwardRef<
	React.ElementRef<typeof DropdownMenuPrimitive.SubTrigger>,
	React.ComponentPropsWithoutRef<typeof DropdownMenuPrimitive.SubTrigger> & {
		inset?: boolean;
	}
>(({ className, inset, children, ...props }, ref) => (
	<DropdownMenuPrimitive.SubTrigger
		ref={ref}
		className={cn(
			'flex cursor-default select-none items-center rounded-sm px-2 py-1.5 text-sm font-medium outline-none focus:bg-accent focus:text-accent-foreground focus:[&_*]:text-accent-foreground data-[highlighted]:text-accent-foreground data-[highlighted]:[&_*]:text-accent-foreground data-[state=open]:bg-accent data-[state=open]:text-accent-foreground data-[state=open]:[&_*]:text-accent-foreground',
			inset && 'pl-8',
			className,
		)}
		{...props}
	>
		{children}
		<ChevronRight className='ml-auto h-4 w-4' />
	</DropdownMenuPrimitive.SubTrigger>
));
DropdownMenuSubTrigger.displayName =
	DropdownMenuPrimitive.SubTrigger.displayName;

const DropdownMenuSubContent = React.forwardRef<
	React.ElementRef<typeof DropdownMenuPrimitive.SubContent>,
	React.ComponentPropsWithoutRef<typeof DropdownMenuPrimitive.SubContent>
>(({ className, ...props }, ref) => (
	<DropdownMenuPrimitive.SubContent
		ref={ref}
		className={cn(
			'z-50 min-w-[8rem] overflow-hidden rounded-md border bg-popover p-1 text-popover-foreground shadow-lg data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2',
			className,
		)}
		{...props}
	/>
));
DropdownMenuSubContent.displayName =
	DropdownMenuPrimitive.SubContent.displayName;

const DropdownMenuContent = React.forwardRef<
	React.ElementRef<typeof DropdownMenuPrimitive.Content>,
	React.ComponentPropsWithoutRef<typeof DropdownMenuPrimitive.Content>
>(({ className, sideOffset = 4, ...props }, ref) => (
	<DropdownMenuPrimitive.Portal>
		<DropdownMenuPrimitive.Content
			ref={ref}
			sideOffset={sideOffset}
			className={cn(
				'z-50 min-w-[8rem] overflow-hidden rounded-md border bg-popover p-1 text-popover-foreground shadow-md',
				'data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2',
				className,
			)}
			{...props}
		/>
	</DropdownMenuPrimitive.Portal>
));
DropdownMenuContent.displayName = DropdownMenuPrimitive.Content.displayName;

const DropdownMenuItem = React.forwardRef<
	React.ElementRef<typeof DropdownMenuPrimitive.Item>,
	React.ComponentPropsWithoutRef<typeof DropdownMenuPrimitive.Item> & {
		inset?: boolean;
	}
>(({ className, inset, ...props }, ref) => (
	<DropdownMenuPrimitive.Item
		ref={ref}
		className={cn(
			'relative flex cursor-default select-none items-center rounded-sm px-2 py-1.5 text-sm font-medium outline-none transition-colors focus:bg-accent focus:text-accent-foreground focus:[&_*]:text-accent-foreground data-[highlighted]:bg-accent data-[highlighted]:text-accent-foreground data-[highlighted]:[&_*]:text-accent-foreground data-[disabled]:pointer-events-none data-[disabled]:opacity-50',
			inset && 'pl-8',
			className,
		)}
		{...props}
	/>
));
DropdownMenuItem.displayName = DropdownMenuPrimitive.Item.displayName;

const DropdownMenuCheckboxItem = React.forwardRef<
	React.ElementRef<typeof DropdownMenuPrimitive.CheckboxItem>,
	React.ComponentPropsWithoutRef<typeof DropdownMenuPrimitive.CheckboxItem>
>(({ className, children, checked, ...props }, ref) => (
	<DropdownMenuPrimitive.CheckboxItem
		ref={ref}
		className={cn(
			'relative flex cursor-default select-none items-center rounded-sm py-1.5 pl-8 pr-2 text-sm font-medium outline-none transition-colors focus:bg-accent focus:text-accent-foreground focus:[&_*]:text-accent-foreground data-[highlighted]:bg-accent data-[highlighted]:text-accent-foreground data-[highlighted]:[&_*]:text-accent-foreground data-[state=checked]:bg-accent data-[state=checked]:text-accent-foreground data-[state=checked]:[&_*]:text-accent-foreground data-[disabled]:pointer-events-none data-[disabled]:opacity-50',
			className,
		)}
		checked={checked}
		{...props}
	>
		<span className='absolute left-2 flex h-3.5 w-3.5 items-center justify-center'>
			<DropdownMenuPrimitive.ItemIndicator>
				<Check className='h-4 w-4' />
			</DropdownMenuPrimitive.ItemIndicator>
		</span>
		{children}
	</DropdownMenuPrimitive.CheckboxItem>
));
DropdownMenuCheckboxItem.displayName =
	DropdownMenuPrimitive.CheckboxItem.displayName;

const DropdownMenuRadioItem = React.forwardRef<
	React.ElementRef<typeof DropdownMenuPrimitive.RadioItem>,
	React.ComponentPropsWithoutRef<typeof DropdownMenuPrimitive.RadioItem>
>(({ className, children, ...props }, ref) => (
	<DropdownMenuPrimitive.RadioItem
		ref={ref}
		className={cn(
			'relative flex cursor-default select-none items-center rounded-sm py-1.5 pl-8 pr-2 text-sm font-medium outline-none transition-colors focus:bg-accent focus:text-accent-foreground focus:[&_*]:text-accent-foreground data-[highlighted]:bg-accent data-[highlighted]:text-accent-foreground data-[highlighted]:[&_*]:text-accent-foreground data-[state=checked]:bg-accent data-[state=checked]:text-accent-foreground data-[state=checked]:[&_*]:text-accent-foreground data-[disabled]:pointer-events-none data-[disabled]:opacity-50',
			className,
		)}
		{...props}
	>
		<span className='absolute left-2 flex h-3.5 w-3.5 items-center justify-center'>
			<DropdownMenuPrimitive.ItemIndicator>
				<Circle className='h-2 w-2 fill-current' />
			</DropdownMenuPrimitive.ItemIndicator>
		</span>
		{children}
	</DropdownMenuPrimitive.RadioItem>
));
DropdownMenuRadioItem.displayName = DropdownMenuPrimitive.RadioItem.displayName;

const DropdownMenuLabel = React.forwardRef<
	React.ElementRef<typeof DropdownMenuPrimitive.Label>,
	React.ComponentPropsWithoutRef<typeof DropdownMenuPrimitive.Label> & {
		inset?: boolean;
	}
>(({ className, inset, ...props }, ref) => (
	<DropdownMenuPrimitive.Label
		ref={ref}
		className={cn(
			'px-2 py-1.5 text-sm font-semibold',
			inset && 'pl-8',
			className,
		)}
		{...props}
	/>
));
DropdownMenuLabel.displayName = DropdownMenuPrimitive.Label.displayName;

const DropdownMenuSeparator = React.forwardRef<
	React.ElementRef<typeof DropdownMenuPrimitive.Separator>,
	React.ComponentPropsWithoutRef<typeof DropdownMenuPrimitive.Separator>
>(({ className, ...props }, ref) => (
	<DropdownMenuPrimitive.Separator
		ref={ref}
		className={cn('-mx-1 my-1 h-px bg-muted', className)}
		{...props}
	/>
));
DropdownMenuSeparator.displayName = DropdownMenuPrimitive.Separator.displayName;

const DropdownMenuShortcut = ({
	className,
	...props
}: React.HTMLAttributes<HTMLSpanElement>) => {
	return (
		<span
			className={cn('ml-auto text-xs tracking-widest opacity-60', className)}
			{...props}
		/>
	);
};
DropdownMenuShortcut.displayName = 'DropdownMenuShortcut';

export {
	DropdownMenu,
	rowMenuContentClassName,
	rowMenuItemClassName,
	DropdownMenuTrigger,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuCheckboxItem,
	DropdownMenuRadioItem,
	DropdownMenuLabel,
	DropdownMenuSeparator,
	DropdownMenuShortcut,
	DropdownMenuGroup,
	DropdownMenuPortal,
	DropdownMenuSub,
	DropdownMenuSubContent,
	DropdownMenuSubTrigger,
	DropdownMenuRadioGroup,
};
