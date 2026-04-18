import { Link } from 'react-router-dom';
import {
	AlertTriangle,
	ArrowRight,
	BookOpen,
	Eye,
	Layers,
	Lightbulb,
	Scale,
	Send,
	ShieldAlert,
	Zap,
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

import { Badge } from '@/ui/badge';
import { Button } from '@/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/ui/card';
import { ScrollArea } from '@/ui/scroll-area';

/* ─── Section data ─── */

const SECTIONS = [
	{
		icon: Layers,
		title: 'Inputs the Generator Uses',
		color: 'text-blue-600 bg-blue-50',
		span: 'col-span-1 xl:col-span-2',
		items: [
			{ term: 'Subjects', desc: 'Each subject has a required room type and minimum weekly minutes — these come from your Subject setup page.' },
			{ term: 'Faculty', desc: 'Teachers have assigned subjects, grade levels, and weekly hour limits. Their preferences (available/unavailable slots) are collected beforehand.' },
			{ term: 'Sections', desc: 'Student sections are pulled from your enrollment system — grade level and section size determine how many class sessions are needed.' },
			{ term: 'Rooms', desc: 'Each room has a type (lab, classroom, etc.), capacity, and belongs to a building floor. The scheduler matches rooms to subject requirements.' },
			{ term: 'Scheduling Policy', desc: 'Your policy sets things like max consecutive teaching minutes, break requirements, travel limits, and lunch windows.' },
		],
	},
	{
		icon: ShieldAlert,
		title: 'Hard vs Soft Constraints',
		color: 'text-red-600 bg-red-50',
		span: 'col-span-1',
		items: [
			{ term: 'Hard constraints (red)', desc: 'Must never be broken. Examples: a teacher cannot be in two rooms at the same time, a room cannot hold two classes at once. If any hard constraint is violated, the schedule cannot be published.' },
			{ term: 'Soft constraints (amber)', desc: 'Strongly preferred but can be bent when needed. Examples: teacher prefers mornings, teacher teaches too many consecutive hours. Soft violations are shown as warnings. You can still publish.' },
		],
		callout: 'Think of hard constraints as "the law" and soft constraints as "best practice." Both matter, but only hard violations block publication.',
	},
	{
		icon: Scale,
		title: 'How Scoring & Tradeoffs Work',
		color: 'text-violet-600 bg-violet-50',
		span: 'col-span-1',
		items: [
			{ term: 'Constraint weights', desc: 'Each soft constraint has a configurable weight (0–100). Higher weight = more important. The generator tries to minimize the total score of all soft violations.' },
			{ term: 'Tradeoffs', desc: "Sometimes satisfying one teacher's preference means violating another. The generator picks the combination with the lowest overall soft-violation score." },
			{ term: 'Policy tuning', desc: 'You can adjust weights in the Scheduling Policy pane. Increasing a weight makes the generator try harder to satisfy that constraint, even at the expense of others.' },
		],
	},
	{
		icon: AlertTriangle,
		title: 'Why Sessions Become Unassigned',
		color: 'text-amber-600 bg-amber-50',
		span: 'col-span-1 xl:col-span-2',
		items: [
			{ term: 'No Qualified Faculty', desc: "No teacher is assigned to this subject+grade combination, or all qualified teachers are already scheduled at the available times." },
			{ term: 'Faculty Overloaded', desc: "All qualified teachers have hit their weekly or daily hour limits." },
			{ term: 'No Available Slot', desc: "Every potential time slot creates a hard conflict or violates a hard constraint." },
			{ term: 'No Compatible Room', desc: "No room of the required type is free at any potential time slot." },
		],
		callout: 'Unassigned sessions are publish blockers. You must either fix them manually or adjust your setup (add faculty, rooms, or relax constraints) and regenerate.',
	},
	{
		icon: Eye,
		title: 'Manual Edits: Preview vs Commit',
		color: 'text-emerald-600 bg-emerald-50',
		span: 'col-span-1',
		items: [
			{ term: 'Preview', desc: 'Before any change takes effect, the system shows you exactly what will happen — new violations, resolved violations, and affected classes. Nothing changes until you confirm.' },
			{ term: 'Commit', desc: "When you confirm, the edit is applied to the draft. If it introduces soft violations, you'll be warned and can still proceed. Hard violation edits are blocked." },
			{ term: 'Undo', desc: "Every commit is reversible — use the Undo button or edit history to roll back changes one at a time." },
		],
		callout: 'Edits never auto-save or auto-publish. You stay in control.',
	},
	{
		icon: Send,
		title: 'How Publish Gating Works',
		color: 'text-primary bg-primary/10',
		span: 'col-span-1',
		items: [
			{ term: 'Zero hard violations', desc: 'The Publish button is disabled until every hard violation is resolved. You can see the count in the header.' },
			{ term: 'Soft acknowledgement', desc: "If soft violations remain, you'll be asked to acknowledge them before publishing." },
			{ term: 'After publish', desc: 'Published schedules become visible to faculty and students. Faculty receive push notifications for any changes that affect their classes.' },
		],
	},
];

/* ─── Animations ─── */

const containerVariants = {
	hidden: { opacity: 0 },
	show: {
		opacity: 1,
		transition: { staggerChildren: 0.1 },
	},
};

const itemVariants = {
	hidden: { opacity: 0, y: 15 },
	show: { opacity: 1, y: 0, transition: { type: 'spring' as const, stiffness: 300, damping: 24 } },
};

export default function HowItWorks() {
	return (
		<div className="h-[calc(100svh-3.5rem)] flex flex-col">
			{/* Header */}
			<div className="shrink-0 border-b border-border bg-background px-6 py-4">
				<div className="flex items-center gap-3">
					<div className="flex size-9 items-center justify-center rounded-lg bg-primary/10">
						<Lightbulb className="size-5 text-primary" />
					</div>
					<div>
						<h1 className="text-lg font-bold text-foreground">How Timetabling Works</h1>
						<p className="text-xs text-muted-foreground">
							A plain-language guide to how ATLAS generates, scores, and publishes your schedule.
						</p>
					</div>
					<div className="flex-1" />
					<Button asChild variant="outline" size="sm">
						<Link to="/timetable">
							<ArrowRight className="size-3.5 mr-1.5" />
							Go to Timetable
						</Link>
					</Button>
				</div>
			</div>

			{/* Content */}
			<ScrollArea className="flex-1 min-h-0 bg-muted/20">
				<div className="max-w-6xl mx-auto px-6 py-8">
					<AnimatePresence mode="wait">
						<motion.div
							initial="hidden"
							animate="show"
							exit="hidden"
							variants={containerVariants}
							className="space-y-6"
						>
							{/* Quick summary */}
							<motion.div variants={itemVariants}>
								<Card className="shadow-sm border-primary/20 bg-primary/5">
									<CardContent className="pt-4 pb-4">
										<div className="flex items-start gap-3">
											<Zap className="size-6 text-primary shrink-0 mt-0.5" />
											<div>
												<p className="text-base font-semibold text-foreground">In a nutshell</p>
												<p className="text-sm text-muted-foreground leading-relaxed mt-1">
													ATLAS takes your subjects, faculty, sections, rooms, and policies — then automatically
													builds a timetable that avoids conflicts and respects everyone's constraints. What it can't
													place automatically becomes "unassigned" for you to fix manually. Once all hard issues are
													resolved, you can publish.
												</p>
											</div>
										</div>
									</CardContent>
								</Card>
							</motion.div>

							{/* Grid Container for Sections & Glossary */}
							<div className="grid grid-cols-1 xl:grid-cols-2 gap-6 items-start">
								{/* Sections */}
								{SECTIONS.map((section) => (
									<motion.div key={section.title} variants={itemVariants} className={`flex h-full ${section.span}`}>
										<Card className="shadow-sm flex-1 flex flex-col">
											<CardHeader className="pb-2">
												<CardTitle className="flex items-center gap-2 text-sm">
													<div className={`flex size-7 items-center justify-center rounded-md ${section.color}`}>
														<section.icon className="size-4" />
													</div>
													{section.title}
												</CardTitle>
											</CardHeader>
											<CardContent className="pb-4 flex-1 flex flex-col">
												<div className={`grid gap-4 ${section.span.includes('xl:col-span-2') ? 'md:grid-cols-2' : 'grid-cols-1'}`}>
													{section.items.map((item) => (
														<div key={item.term} className="flex gap-3 items-start">
															<div className="shrink-0 mt-1">
																<div className="size-1.5 rounded-full bg-muted-foreground/30" />
															</div>
															<div>
																<span className="text-xs font-semibold text-foreground">{item.term}</span>
																<p className="text-xs text-muted-foreground leading-relaxed mt-0.5">{item.desc}</p>
															</div>
														</div>
													))}
												</div>
												{section.callout && (
													<div className="mt-auto pt-4">
														<div className="flex items-start gap-2 rounded-md border border-border bg-muted/30 px-3 py-2">
															<Lightbulb className="size-3.5 text-amber-500 shrink-0 mt-0.5" />
															<p className="text-xs text-muted-foreground leading-relaxed italic">
																{section.callout}
															</p>
														</div>
													</div>
												)}
											</CardContent>
										</Card>
									</motion.div>
								))}

								{/* Glossary row */}
								<motion.div variants={itemVariants} className="col-span-1 xl:col-span-2">
									<Card className="shadow-sm">
										<CardHeader className="pb-2 border-b border-border mb-3">
											<CardTitle className="flex items-center gap-2 text-sm">
												<div className="flex size-7 items-center justify-center rounded-md text-muted-foreground bg-muted">
													<BookOpen className="size-4" />
												</div>
												Quick Glossary
											</CardTitle>
										</CardHeader>
										<CardContent className="pb-4">
											<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-x-6 gap-y-4 text-xs">
												{[
													['Draft', 'A schedule that has been generated but not yet published.'],
													['Run', 'A single execution of the schedule generation algorithm.'],
													['Violation', 'A constraint that is broken by the current schedule.'],
													['Follow-up', 'A flag you place on an entry to remind yourself to review it.'],
													['Preview', 'A what-if check that shows the impact of an edit before applying it.'],
													['Commit', 'Applying an edit to the draft permanently.'],
												].map(([term, desc]) => (
													<div key={term} className="flex flex-col gap-1 border-l-2 border-primary/20 pl-3 py-1">
														<span className="text-[0.6875rem] font-bold tracking-wide uppercase text-foreground">{term}</span>
														<span className="text-muted-foreground font-medium leading-normal">{desc}</span>
													</div>
												))}
											</div>
										</CardContent>
									</Card>
								</motion.div>
							</div>
						</motion.div>
					</AnimatePresence>
				</div>
			</ScrollArea>
		</div>
	);
}

