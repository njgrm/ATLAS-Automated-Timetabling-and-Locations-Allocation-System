import { Link } from 'react-router-dom';
import { AlertTriangle, CheckCircle2, Circle } from 'lucide-react';

import { Badge } from '@/ui/badge';

export type SetupCheck = {
	label: string;
	done: boolean;
	link?: string;
	subMessage?: string;
};

export function SetupChecklist({ items }: { items: SetupCheck[] }) {
	const done = items.filter((c) => c.done).length;
	const allDone = done === items.length;

	return (
		<div className="rounded-lg border border-border bg-muted/30 p-3">
			<div className="flex items-center justify-between mb-2">
				<p className="text-sm font-semibold text-foreground">Setup checklist</p>
				<Badge
					variant="secondary"
					className={`text-xs ${
						allDone ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'
					}`}
				>
					{done}/{items.length} done
				</Badge>
			</div>
			<ul className="space-y-1.5">
				{items.map((item) => (
					<li key={item.label} className="flex items-start gap-2 text-sm">
						{item.done ? (
							<CheckCircle2 className="size-4 text-emerald-500 shrink-0 mt-0.5" />
						) : (
							<Circle className="size-4 text-muted-foreground/40 shrink-0 mt-0.5" />
						)}
						<div>
							{item.link ? (
								<Link
									to={item.link}
									className={`hover:underline ${
										item.done ? 'text-muted-foreground line-through' : 'text-foreground'
									}`}
								>
									{item.label}
								</Link>
							) : (
								<span className={item.done ? 'text-muted-foreground line-through' : 'text-foreground'}>
									{item.label}
								</span>
							)}
							{item.subMessage && !item.done && (
								<div className="mt-1.5 inline-flex items-center gap-1 text-[0.625rem] text-amber-700 bg-amber-50 px-2 py-0.5 rounded-full border border-amber-200/50">
									<AlertTriangle className="size-2.5 shrink-0" />
									{item.subMessage}
								</div>
							)}
						</div>
					</li>
				))}
			</ul>
			{allDone && (
				<div className="mt-3 rounded-md border border-emerald-200 bg-emerald-50/60 px-3 py-2">
					<p className="text-xs font-semibold text-emerald-700 flex items-center gap-1.5">
						<CheckCircle2 className="size-3.5 shrink-0" />
						Setup complete
					</p>
				</div>
			)}
		</div>
	);
}
