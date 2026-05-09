import { motion } from 'motion/react';
import type { ReactNode } from 'react';

type StepFlowItem = {
	id: number;
	label: string;
};

type StepFlowHeaderProps = {
	title: string;
	subtitle?: string;
	steps: StepFlowItem[];
	activeStep: number;
	meta?: ReactNode;
};

export default function StepFlowHeader({ title, subtitle, steps, activeStep, meta }: StepFlowHeaderProps) {
	return (
		<div className='space-y-2'>
			<div className='flex flex-wrap items-start justify-between gap-2'>
				<div>
					<h1 className='text-xl font-semibold tracking-tight'>{title}</h1>
					{subtitle && <p className='text-sm text-muted-foreground'>{subtitle}</p>}
				</div>
				{meta}
			</div>
			<div className='flex flex-wrap gap-1.5'>
				{steps.map((step) => (
					<motion.span
						key={step.id}
						layout
						transition={{ type: 'spring', stiffness: 400, damping: 30 }}
						className={`rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
							step.id === activeStep
								? 'border-primary bg-primary text-primary-foreground'
								: step.id < activeStep
									? 'border-primary/30 bg-primary/15 text-primary'
									: 'border-transparent bg-muted text-muted-foreground'
						}`}
					>
						{step.label}
					</motion.span>
				))}
			</div>
		</div>
	);
}
