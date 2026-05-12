import { AlertCircle, ArrowRight, CheckCircle2, FileEdit, Info } from 'lucide-react';
import { Link } from 'react-router-dom';

import { Button } from '@/ui/button';
import { Card, CardContent } from '@/ui/card';

type ActionItem = {
	id: string;
	title: string;
	description: string;
	icon: any;
	color: string;
	link: string;
	linkText: string;
};

type ActionQueueProps = {
	counts: {
		total: number;
		pending: number;
		approved: number;
		rejected: number;
		unchanged: number;
	};
	hasDraftPreferences?: boolean;
	hasDraftRoomRequests?: boolean;
};

export default function ActionQueue({ counts, hasDraftPreferences, hasDraftRoomRequests }: ActionQueueProps) {
	const actions: ActionItem[] = [];

	if (counts.rejected > 0) {
		actions.push({
			id: 'rejected-requests',
			title: `${counts.rejected} request${counts.rejected > 1 ? 's' : ''} rejected`,
			description: 'The scheduler has declined some room changes. Review reasons and resubmit.',
			icon: AlertCircle,
			color: 'text-destructive bg-destructive/10 border-destructive/20',
			link: '/my/room-preferences',
			linkText: 'Review Rejections',
		});
	}

	if (hasDraftRoomRequests) {
		actions.push({
			id: 'draft-room-requests',
			title: 'Unsaved room requests',
			description: 'You have room change drafts that haven\'t been submitted for review.',
			icon: FileEdit,
			color: 'text-amber-600 bg-amber-50 border-amber-200',
			link: '/my/room-preferences',
			linkText: 'Finish Request',
		});
	}

	if (hasDraftPreferences) {
		actions.push({
			id: 'draft-preferences',
			title: 'Unsaved availability',
			description: 'Your teaching hour preferences are in draft mode and not yet final.',
			icon: FileEdit,
			color: 'text-amber-600 bg-amber-50 border-amber-200',
			link: '/my/preferences',
			linkText: 'Submit Preferences',
		});
	}

	if (actions.length === 0) {
		return (
			<Card className="rounded-2xl border-emerald-100 bg-emerald-50/50 shadow-sm overflow-hidden">
				<CardContent className="p-4 flex items-center gap-3">
					<div className="size-10 rounded-full bg-emerald-100 flex items-center justify-center shrink-0">
						<CheckCircle2 className="size-5 text-emerald-600" />
					</div>
					<div className="min-w-0 flex-1">
						<p className="text-sm font-bold text-emerald-900">Your schedule is up to date</p>
						<p className="text-xs text-emerald-700/80">No immediate actions required from your side.</p>
					</div>
					<Info className="size-4 text-emerald-400 shrink-0" />
				</CardContent>
			</Card>
		);
	}

	return (
		<div className="space-y-3">
			<p className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider px-1">Attention Required</p>
			{actions.map((action) => (
				<Card key={action.id} className={`rounded-2xl border shadow-sm overflow-hidden ${action.color}`}>
					<CardContent className="p-4 flex items-start gap-4">
						<div className="mt-0.5 shrink-0">
							<action.icon className="size-5" />
						</div>
						<div className="min-w-0 flex-1">
							<p className="text-sm font-bold">{action.title}</p>
							<p className="text-xs opacity-80 mt-0.5 leading-relaxed">{action.description}</p>
							<Button asChild variant="ghost" size="sm" className="mt-3 -ml-2 h-8 text-xs font-bold gap-1.5 hover:bg-current/10">
								<Link to={action.link}>
									{action.linkText} <ArrowRight className="size-3" />
								</Link>
							</Button>
						</div>
					</CardContent>
				</Card>
			))}
		</div>
	);
}
