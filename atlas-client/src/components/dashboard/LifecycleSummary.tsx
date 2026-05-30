import { Fragment, type ReactNode } from 'react';
import { Check, Circle } from 'lucide-react';

import { Card, CardContent } from '@/ui/card';

const LIFECYCLE_PHASES = [
	{ key: 'SETUP', label: 'Setup' },
	{ key: 'PREFERENCE_COLLECTION', label: 'Preferences' },
	{ key: 'GENERATION', label: 'Generation' },
	{ key: 'REVIEW', label: 'Review' },
	{ key: 'PUBLISHED', label: 'Published' },
	{ key: 'ARCHIVED', label: 'Archived' },
] as const;

export function LifecycleSummary({
	currentPhase,
	children,
}: {
	currentPhase: string;
	children?: ReactNode;
}) {
	const currentIdx = LIFECYCLE_PHASES.findIndex((p) => p.key === currentPhase);

	return (
		<Card className="shadow-sm flex-1">
			<CardContent className="pt-5 h-full flex flex-col">
				<div className="flex items-center gap-1">
					{LIFECYCLE_PHASES.map((phase, idx) => {
						const isCurrent = phase.key === currentPhase;
						const isPast = currentIdx > idx;
						return (
							<Fragment key={phase.key}>
								{idx > 0 && (
									<div
										className={`h-0.5 flex-1 rounded ${isPast ? 'bg-primary' : 'bg-border'}`}
									/>
								)}
								<div className="flex flex-col items-center">
									<div
										className={`flex size-8 items-center justify-center rounded-full border-2 text-xs font-bold transition-colors ${
											isCurrent
												? 'border-primary bg-primary text-primary-foreground'
												: isPast
													? 'border-primary bg-primary/10 text-primary'
													: 'border-border bg-background text-muted-foreground'
										}`}
									>
										{isPast ? (
											<Check className="size-3.5" />
										) : (
											<Circle className="size-3" fill={isCurrent ? 'currentColor' : 'none'} />
										)}
									</div>
									<span
										className={`mt-1 text-[0.6875rem] font-medium ${
											isCurrent ? 'text-primary' : 'text-muted-foreground'
										}`}
									>
										{phase.label}
									</span>
								</div>
							</Fragment>
						);
					})}
				</div>

				{children}
			</CardContent>
		</Card>
	);
}
