import * as React from 'react';
import { ChevronDown } from 'lucide-react';

import { cn } from '@/lib/utils';

type AccordionValue = string | null;

type AccordionContextValue = {
	openValue: AccordionValue;
	setOpenValue: (value: AccordionValue) => void;
	collapsible: boolean;
};

const AccordionContext = React.createContext<AccordionContextValue | null>(null);
const AccordionItemContext = React.createContext<{ value: string } | null>(null);

function Accordion({
	children,
	type = 'single',
	collapsible = false,
	defaultValue,
	className,
}: {
	children: React.ReactNode;
	type?: 'single';
	collapsible?: boolean;
	defaultValue?: string;
	className?: string;
}) {
	const [openValue, setOpenValue] = React.useState<AccordionValue>(defaultValue ?? null);

	const contextValue = React.useMemo(
		() => ({
			openValue,
			setOpenValue,
			collapsible: collapsible || type !== 'single',
		}),
		[openValue, collapsible, type],
	);

	return (
		<AccordionContext.Provider value={contextValue}>
			<div data-slot="accordion" className={className}>{children}</div>
		</AccordionContext.Provider>
	);
}

function AccordionItem({ value, className, children }: { value: string; className?: string; children: React.ReactNode }) {
	return (
		<AccordionItemContext.Provider value={{ value }}>
			<div data-slot="accordion-item" className={cn('border-b last:border-b-0', className)}>
				{children}
			</div>
		</AccordionItemContext.Provider>
	);
}

function AccordionTrigger({
	className,
	children,
}: {
	className?: string;
	children: React.ReactNode;
}) {
	const root = React.useContext(AccordionContext);
	const item = React.useContext(AccordionItemContext);
	if (!root || !item) return null;

	const isOpen = root.openValue === item.value;

	return (
		<button
			type="button"
			data-slot="accordion-trigger"
			data-state={isOpen ? 'open' : 'closed'}
			className={cn(
				'flex w-full items-center justify-between gap-2 py-2 text-left text-xs font-medium transition-all hover:underline [&[data-state=open]>svg]:rotate-180',
				className,
			)}
			onClick={() => {
				if (isOpen) {
					if (root.collapsible) root.setOpenValue(null);
					return;
				}
				root.setOpenValue(item.value);
			}}
		>
			{children}
			<ChevronDown className="size-3 shrink-0 text-muted-foreground transition-transform duration-200" />
		</button>
	);
}

function AccordionContent({ className, children }: { className?: string; children: React.ReactNode }) {
	const root = React.useContext(AccordionContext);
	const item = React.useContext(AccordionItemContext);
	if (!root || !item) return null;
	const isOpen = root.openValue === item.value;

	return (
		<div
			data-slot="accordion-content"
			data-state={isOpen ? 'open' : 'closed'}
			className={cn(
				'grid transition-all duration-200 ease-out',
				isOpen ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0',
			)}
		>
			<div className="overflow-hidden">
				<div className={cn('pb-2', className)}>{children}</div>
			</div>
		</div>
	);
}

export { Accordion, AccordionContent, AccordionItem, AccordionTrigger };
