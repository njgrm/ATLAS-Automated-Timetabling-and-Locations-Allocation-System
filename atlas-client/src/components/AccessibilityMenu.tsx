import { Accessibility, Type, Minus, Plus, RotateCcw } from 'lucide-react';
import { useRef, useState, useEffect, useCallback } from 'react';
import { Button } from '@/ui/button';
import {
	Tooltip,
	TooltipContent,
	TooltipProvider,
	TooltipTrigger,
} from '@/ui/tooltip';

interface AccessibilityMenuProps {
	fontSize: number;
	setFontSize: (size: number) => void;
}

export function AccessibilityMenu({ fontSize, setFontSize }: AccessibilityMenuProps) {
	const [open, setOpen] = useState(false);
	const ref = useRef<HTMLDivElement>(null);

	const handleClickOutside = useCallback(
		(e: MouseEvent) => {
			if (ref.current && !ref.current.contains(e.target as Node)) {
				setOpen(false);
			}
		},
		[],
	);

	useEffect(() => {
		if (open) {
			document.addEventListener('mousedown', handleClickOutside);
			return () => document.removeEventListener('mousedown', handleClickOutside);
		}
	}, [open, handleClickOutside]);

	return (
		<div ref={ref} className='relative'>
			<TooltipProvider>
				<Tooltip>
					<TooltipTrigger asChild>
						<Button
							variant='outline'
							size='sm'
							className='h-8 w-8 p-0'
							aria-label='Accessibility options'
							onClick={() => setOpen(!open)}
						>
							<Accessibility className='size-4' />
						</Button>
					</TooltipTrigger>
					<TooltipContent>Accessibility Options</TooltipContent>
				</Tooltip>
			</TooltipProvider>

			{open && (
				<div className='absolute right-0 top-full z-50 mt-1 w-64 rounded-md border border-border bg-white p-4 shadow-md'>
					<div className='space-y-4'>
						{/* Header */}
						<div className='flex items-center justify-between border-b pb-2'>
							<h4 className='flex items-center gap-2 text-sm font-bold'>
								<Accessibility className='size-4' /> Accessibility
							</h4>
							{fontSize !== 100 && (
								<Button
									variant='ghost'
									size='sm'
									className='h-7 px-2 text-sm font-bold text-primary hover:bg-primary/10 hover:text-primary'
									onClick={() => setFontSize(100)}
								>
									<RotateCcw className='mr-1 size-3' /> Reset
								</Button>
							)}
						</div>

						{/* Text Size */}
						<div className='space-y-2'>
							<div className='flex items-center justify-between'>
								<span className='flex items-center gap-2 text-sm font-bold'>
									<Type className='size-3.5' /> Text Size
								</span>
								<span className='text-sm font-bold text-muted-foreground'>
									{fontSize}%
								</span>
							</div>
							<div className='flex items-center gap-2'>
								<Button
									variant='outline'
									size='xs'
									className='flex-1'
									onClick={() => setFontSize(Math.max(80, fontSize - 10))}
									disabled={fontSize <= 80}
									aria-label='Decrease text size'
								>
									<Minus className='size-3' />
								</Button>
								<Button
									variant='outline'
									size='xs'
									className='flex-1'
									onClick={() => setFontSize(Math.min(150, fontSize + 10))}
									disabled={fontSize >= 150}
									aria-label='Increase text size'
								>
									<Plus className='size-3' />
								</Button>
							</div>
						</div>
					</div>
				</div>
			)}
		</div>
	);
}
