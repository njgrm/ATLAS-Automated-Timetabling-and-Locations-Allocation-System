import { AlertCircle, ArrowRight, CheckCircle2, FileEdit, type LucideIcon } from 'lucide-react';
import { Link } from 'react-router-dom';

import { Card, CardContent } from '@/ui/card';
import type { FacultyPortalObjectiveState } from '@/types';

type Tone = 'destructive' | 'warning' | 'success' | 'info';

type ActionItem = {
	id: string;
	title: string;
	description: string;
	icon: LucideIcon;
	tone: Tone;
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
	objectiveState?: FacultyPortalObjectiveState;
};

const TONE_STYLES: Record<Tone, { card: string; iconWrap: string; icon: string; title: string; body: string; cta: string }> = {
	destructive: {
		card: 'border-red-200 bg-red-50',
		iconWrap: 'bg-red-100',
		icon: 'text-red-700',
		title: 'text-red-900',
		body: 'text-red-800/80',
		cta: 'text-red-800 hover:text-red-900',
	},
	warning: {
		card: 'border-amber-200 bg-amber-50',
		iconWrap: 'bg-amber-100',
		icon: 'text-amber-700',
		title: 'text-amber-900',
		body: 'text-amber-800/80',
		cta: 'text-amber-800 hover:text-amber-900',
	},
	success: {
		card: 'border-emerald-200 bg-emerald-50',
		iconWrap: 'bg-emerald-100',
		icon: 'text-emerald-700',
		title: 'text-emerald-900',
		body: 'text-emerald-800/80',
		cta: 'text-emerald-800 hover:text-emerald-900',
	},
	info: {
		card: 'border-sky-200 bg-sky-50',
		iconWrap: 'bg-sky-100',
		icon: 'text-sky-700',
		title: 'text-sky-900',
		body: 'text-sky-800/80',
		cta: 'text-sky-800 hover:text-sky-900',
	},
};

function ToneCard({ tone, icon: Icon, title, body, link, linkText }: { tone: Tone; icon: LucideIcon; title: string; body: string; link?: string; linkText?: string }) {
	const s = TONE_STYLES[tone];
	return (
		<Card className={`overflow-hidden rounded-2xl border shadow-sm ${s.card}`}>
			<CardContent className='flex items-start gap-3 p-4'>
				<span className={`flex size-9 shrink-0 items-center justify-center rounded-xl ${s.iconWrap}`}>
					<Icon className={`size-4 ${s.icon}`} />
				</span>
				<div className='min-w-0 flex-1'>
					<p className={`text-[13px] font-semibold leading-tight ${s.title}`}>{title}</p>
					<p className={`mt-0.5 text-[12px] leading-snug ${s.body}`}>{body}</p>
					{link && linkText && (
						<Link to={link} className={`mt-2 inline-flex items-center gap-1 text-[12px] font-semibold ${s.cta}`}>
							{linkText} <ArrowRight className='size-3' />
						</Link>
					)}
				</div>
			</CardContent>
		</Card>
	);
}

export default function ActionQueue({ counts, hasDraftPreferences, hasDraftRoomRequests, objectiveState }: ActionQueueProps) {
	const actions: ActionItem[] = [];

	if (counts.rejected > 0) {
		actions.push({
			id: 'rejected',
			title: `${counts.rejected} request${counts.rejected > 1 ? 's' : ''} need attention`,
			description: 'The scheduler declined some room changes. Open them to read the reason and revise.',
			icon: AlertCircle,
			tone: 'destructive',
			link: '/my/room-preferences',
			linkText: 'Review',
		});
	}
	if (hasDraftRoomRequests) {
		actions.push({
			id: 'draft-rooms',
			title: 'Unsubmitted room request',
			description: 'You have a room-change draft that hasn’t been sent for review yet.',
			icon: FileEdit,
			tone: 'warning',
			link: '/my/room-preferences',
			linkText: 'Finish and submit',
		});
	}
	if (hasDraftPreferences) {
		actions.push({
			id: 'draft-prefs',
			title: 'Support preferences not submitted',
			description: 'Your support notes are saved as a draft. Submit them so the scheduler can use them.',
			icon: FileEdit,
			tone: 'warning',
			link: '/my/preferences',
			linkText: 'Submit preferences',
		});
	}

	if (actions.length === 0) {
		if (objectiveState && counts.total === 0) {
			return (
				<ToneCard
					tone={objectiveState.hasTeachingLoad ? 'info' : 'warning'}
					icon={objectiveState.hasTeachingLoad ? CheckCircle2 : AlertCircle}
					title={objectiveState.title}
					body={objectiveState.roomRequestMessage}
				/>
			);
		}
		return (
			<ToneCard
				tone='success'
				icon={CheckCircle2}
				title='Nothing needs your attention'
				body='Your schedule is up to date. We’ll notify you if anything changes.'
			/>
		);
	}

	return (
		<section className='space-y-2'>
			<p className='px-1 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground'>Needs your attention</p>
			<div className='space-y-2'>
				{actions.map((a) => (
					<ToneCard key={a.id} tone={a.tone} icon={a.icon} title={a.title} body={a.description} link={a.link} linkText={a.linkText} />
				))}
			</div>
		</section>
	);
}
