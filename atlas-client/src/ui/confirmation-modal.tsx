import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from '@/ui/dialog';
import { Button } from '@/ui/button';
import { cn } from '@/lib/utils';
import {
	AlertTriangle,
	Info,
	CheckCircle2,
	AlertCircle,
	HelpCircle,
	type LucideIcon,
} from 'lucide-react';

export type ConfirmationModalVariant =
	| 'danger'
	| 'info'
	| 'warning'
	| 'success'
	| 'primary';

interface ConfirmationModalProps {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	title: string;
	description: React.ReactNode;
	onConfirm: () => void;
	confirmText?: string;
	loading?: boolean;
	confirmClassName?: string;
	variant?: ConfirmationModalVariant;
	icon?: LucideIcon;
}

const variantStyles: Record<
	ConfirmationModalVariant,
	{
		icon: LucideIcon;
		iconBg: string;
		iconRing: string;
		iconText: string;
		btnBg: string;
		btnText: string;
	}
> = {
	danger: {
		icon: AlertTriangle,
		iconBg: 'bg-[hsl(var(--primary))]',
		iconRing: 'ring-[6px] ring-[hsl(var(--primary)/0.1)]',
		iconText: 'text-[hsl(var(--primary-foreground))]',
		btnBg: 'bg-red-500 hover:bg-red-600',
		btnText: 'text-white',
	},
	warning: {
		icon: AlertCircle,
		iconBg: 'bg-[hsl(var(--primary))]',
		iconRing: 'ring-[6px] ring-[hsl(var(--primary)/0.1)]',
		iconText: 'text-[hsl(var(--primary-foreground))]',
		btnBg: 'bg-amber-500 hover:bg-amber-600',
		btnText: 'text-white',
	},
	info: {
		icon: Info,
		iconBg: 'bg-[hsl(var(--primary))]',
		iconRing: 'ring-[6px] ring-[hsl(var(--primary)/0.1)]',
		iconText: 'text-[hsl(var(--primary-foreground))]',
		btnBg: 'bg-blue-500 hover:bg-blue-600',
		btnText: 'text-white',
	},
	success: {
		icon: CheckCircle2,
		iconBg: 'bg-[hsl(var(--primary))]',
		iconRing: 'ring-[6px] ring-[hsl(var(--primary)/0.1)]',
		iconText: 'text-[hsl(var(--primary-foreground))]',
		btnBg: 'bg-green-500 hover:bg-green-600',
		btnText: 'text-white',
	},
	primary: {
		icon: HelpCircle,
		iconBg: 'bg-[hsl(var(--primary))]',
		iconRing: 'ring-[6px] ring-[hsl(var(--primary)/0.1)]',
		iconText: 'text-[hsl(var(--primary-foreground))]',
		btnBg: 'bg-[hsl(var(--primary))] hover:bg-[hsl(var(--primary)/0.9)]',
		btnText: 'text-[hsl(var(--primary-foreground))]',
	},
};

export function ConfirmationModal({
	open,
	onOpenChange,
	title,
	description,
	onConfirm,
	confirmText = 'Confirm',
	loading = false,
	confirmClassName,
	variant = 'danger',
	icon: CustomIcon,
}: ConfirmationModalProps) {
	const style = variantStyles[variant];
	const Icon = CustomIcon || style.icon;

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent
				className={cn(
					'w-[calc(100%-2rem)] sm:max-w-sm rounded-3xl p-8 overflow-hidden',
					'bg-sidebar shadow-2xl',
				)}
			>
				{/* Icon badge */}
				<div className="flex justify-center mb-5">
					<span
						className={cn(
							'flex items-center justify-center',
							'w-14 h-14 rounded-full',
							style.iconBg,
							style.iconRing,
							style.iconText,
						)}
					>
						<Icon className="w-6 h-6" strokeWidth={2.5} />
					</span>
				</div>

				{/* Header — centred */}
				<DialogHeader className="space-y-2 text-center items-center">
					<DialogTitle className="text-xl font-bold tracking-tight text-gray-900">
						{title}
					</DialogTitle>
					<DialogDescription className="text-sm leading-relaxed text-gray-500 text-center">
						{description}
					</DialogDescription>
				</DialogHeader>

				{/* Footer — side-by-side */}
				<DialogFooter className="flex flex-row gap-3 mt-7 sm:justify-center">
					<Button
						variant="outline"
						onClick={() => onOpenChange(false)}
						disabled={loading}
						className={cn(
							'flex-1 h-12 rounded-2xl font-semibold text-sm',
							'border border-gray-200 bg-white text-gray-700',
							'hover:bg-gray-50 active:bg-gray-100',
							'transition-all duration-150 active:scale-[0.97]',
						)}
					>
						Cancel
					</Button>

					<Button
						variant="default"
						onClick={() => {
							onConfirm();
							if (!loading) onOpenChange(false);
						}}
						disabled={loading}
						className={cn(
							'flex-1 h-12 rounded-2xl font-semibold text-sm',
							style.btnBg,
							style.btnText,
							'shadow-md',
							'transition-all duration-150 active:scale-[0.97]',
							confirmClassName,
						)}
					>
						{loading ? (
							<span className="flex items-center gap-2">
								<span className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
								Processing...
							</span>
						) : (
							confirmText
						)}
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}
