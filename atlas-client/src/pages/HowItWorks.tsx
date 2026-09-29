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
	Settings,
	ShieldAlert,
	Zap,
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

import { PageHeader } from '@/components/app-shell/PageHeader';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/ui/accordion';
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
			{ term: 'Teachers', desc: 'Teachers have assigned subjects, grade levels, and weekly hour limits. Support preferences are collected beforehand.' },
			{ term: 'Sections', desc: 'Student sections are pulled from your enrollment system — grade level and section size determine how many class sessions are needed.' },
			{ term: 'Rooms', desc: 'Each room has a type (lab, classroom, etc.), capacity, and belongs to a building floor. The scheduler matches rooms to subject requirements.' },
			{ term: 'Scheduling Policy', desc: 'Your policy sets things like max consecutive teaching minutes, break requirements, travel limits, and lunch windows.' },
		],
	},
	{
		icon: ShieldAlert,
		title: 'Two Kinds of Problem',
		color: 'text-red-600 bg-red-50',
		span: 'col-span-1',
		items: [
			{ term: 'Must be fixed (red)', desc: 'These stop the timetable being published. For example, a teacher cannot be in two rooms at the same time, or a room cannot hold two classes at once.' },
			{ term: 'Preferences it could not meet (amber)', desc: 'Things it was asked to respect but could not all fit together — a teacher prefers mornings, a teacher asked not to teach too many hours in a row. These are warnings. You can still publish.' },
		],
		callout: 'Red problems must be fixed. Amber warnings do not have to be — only red stops publication.',
	},
	{
		icon: Scale,
		title: 'What the Generator Balances',
		color: 'text-violet-600 bg-violet-50',
		span: 'col-span-1',
		items: [
			{ term: 'Preferences it could not meet', desc: 'When two preferences cannot both be satisfied, the generator keeps the one it was told matters more. The ones it could not meet are counted and shown to you as warnings — you can still publish the timetable.' },
			{ term: 'Tradeoffs', desc: "Sometimes satisfying one teacher's preference means not satisfying another's. The generator picks the combination that leaves the fewest unmet preferences." },
			{ term: 'Changing how it decides', desc: 'If the generator keeps leaving the wrong preferences unmet, you can tell it which preferences matter more. That setting is under Advanced below.' },
		],
	},
	{
		icon: AlertTriangle,
		title: 'Why Sessions Become Unassigned',
		color: 'text-amber-600 bg-amber-50',
		span: 'col-span-1 xl:col-span-2',
		items: [
			{ term: 'No Qualified Teacher', desc: "No teacher is assigned to this subject+grade combination, or all qualified teachers are already scheduled at the available times." },
			{ term: 'Teacher Overloaded', desc: "All qualified teachers have hit their weekly or daily hour limits." },
			{ term: 'No Available Slot', desc: "Every potential time slot creates a hard conflict or violates a hard constraint." },
			{ term: 'No Compatible Room', desc: "No room of the required type is free at any potential time slot." },
		],
		callout: 'Unassigned sessions are publish blockers. You must either fix them manually or adjust your setup (add teachers, rooms, or relax constraints) and regenerate.',
	},
	{
		icon: Eye,
		title: 'Checking a Change Before You Keep It',
		color: 'text-emerald-600 bg-emerald-50',
		span: 'col-span-1',
		items: [
			{ term: 'See it first', desc: 'Before any change takes effect, the system shows you exactly what will happen — new problems, fixed problems, and affected classes. Nothing changes until you confirm.' },
			{ term: 'Apply this change', desc: "When you confirm, the change is applied to the draft. If it leaves preferences unmet you'll be told and can still proceed. Changes that would create a hard problem are blocked." },
			{ term: 'Take it back', desc: 'Every applied change can be undone one at a time, with the Undo button or the change history.' },
		],
		callout: 'Changes never save or publish on their own. You stay in control.',
	},
	{
		icon: Send,
		title: 'How Publish Gating Works',
		color: 'text-primary bg-primary/10',
		span: 'col-span-1',
		items: [
			{ term: 'No problems left', desc: 'The Publish button stays disabled until every hard problem is resolved. You can see how many are left in the header.' },
			{ term: 'Accepting what could not be met', desc: "If any preferences were left unmet, you'll be asked to accept them before publishing." },
			{ term: 'After publish', desc: 'Published schedules become visible to teachers and students. Teachers receive push notifications for any changes that affect their classes.' },
		],
	},
];

/**
 * A7 C6 — technical tuning, folded away. "Constraint weights (0–100)" is the
 * single most technical thing on this page and the older-user audit named it as
 * the worst item: it reads as a tuning panel, not as help. It is still here in
 * full, one click away, for whoever does tune.
 *
 * It uses the shared `@/ui/accordion` primitive — NOT a raw `<details>` (§8).
 */
const ADVANCED_SECTIONS = [
	{
		icon: Scale,
		title: 'Constraint weights',
		color: 'text-violet-600 bg-violet-50',
		items: [
			{ term: 'What a weight is', desc: 'Each soft constraint has a weight from 0 to 100. A higher weight means the generator tries harder to satisfy it, even if that means some other preference goes unmet.' },
			{ term: 'How the total is read', desc: 'The generator tries to minimise the combined score of all soft violations across the whole timetable. A lower total means more preferences were met.' },
			{ term: 'Where to change them', desc: 'Weights are edited in the Scheduling Policy pane. Raise a weight when the generator keeps leaving that particular preference unmet.' },
		],
	},
];

const LIFECYCLE_STEPS = [
	{ step: '1', title: 'Setup', desc: 'Define subjects, sections, rooms, and policy rules.' },
	{ step: '2', title: 'Preferences', desc: 'Collect teacher support preferences & room requests.' },
	{ step: '3', title: 'Generate', desc: 'Run the engine to automatically schedule classes.' },
	{ step: '4', title: 'Review', desc: 'Preview manual tweaks and resolve soft warnings.' },
	{ step: '5', title: 'Publish', desc: 'Lock the schedule and open teacher/student portals.' },
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
					<PageHeader
						title='How Scheduling Works'
						subtitle='A plain-language guide to how ATLAS generates, scores, and publishes your schedule.'
						source={(
							<div className="flex size-9 items-center justify-center rounded-lg bg-primary/10">
								<Lightbulb className="size-5 text-primary" />
							</div>
						)}
						className="min-w-0 flex-1"
					/>
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
													ATLAS takes your subjects, teachers, sections, rooms, and policies — then automatically
													builds a timetable that avoids conflicts and respects everyone's constraints. What it can't
													place automatically becomes "unassigned" for you to fix manually. Once all hard issues are
													resolved, you can publish.
												</p>
											</div>
										</div>
									</CardContent>
								</Card>
							</motion.div>

							{/* The Timetabling Lifecycle Stepper */}
							<motion.div variants={itemVariants}>
								<Card className="shadow-sm border-border bg-card overflow-hidden">
									<CardHeader className="pb-3 border-b border-border bg-muted/20">
										<CardTitle className="text-sm font-bold flex items-center gap-2 text-foreground">
											<span className="flex size-5 items-center justify-center rounded bg-primary text-primary-foreground text-xs font-extrabold">A</span>
											The Timetabling Lifecycle
										</CardTitle>
									</CardHeader>
									<CardContent className="pt-6 pb-6">
										<div className="grid grid-cols-1 md:grid-cols-5 gap-6 relative">
											{LIFECYCLE_STEPS.map((item) => (
												<div key={item.step} className="flex flex-col items-center text-center space-y-3 relative group">
													{/* Circular Step Badge */}
													<div className="flex size-11 items-center justify-center rounded-full bg-primary/10 border-2 border-primary text-xs font-extrabold text-primary shadow-sm group-hover:bg-primary group-hover:text-primary-foreground transition-all duration-300">
														{item.step}
													</div>
													
													{/* Step Details */}
													<div className="space-y-1">
														<h4 className="text-xs font-bold text-foreground uppercase tracking-wider">{item.title}</h4>
														<p className="text-xs text-muted-foreground leading-relaxed max-w-40 mx-auto">{item.desc}</p>
													</div>
												</div>
											))}
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
										Words You May See
									</CardTitle>
								</CardHeader>
								<CardContent className="pb-4">
									<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-x-6 gap-y-4 text-xs">
										{[
											['Draft', 'A timetable that has been made but not yet published.'],
											['Run', 'One attempt at making the timetable automatically.'],
											['Problem', 'Something in the timetable that breaks a rule or leaves a preference unmet.'],
											['Unassigned', 'A lesson the generator could not place anywhere. You place these yourself.'],
											['See it first', 'A what-if check that shows the impact of a change before you apply it.'],
											['Apply this change', 'Keeping a change and putting it into the draft.'],
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

						{/* A7 C6 — the technical tuning fold. The shared @/ui accordion,
						    never a raw <details> (§8). Closed by default: an older
						    user reads the whole page without ever meeting a weight. */}
						<motion.div variants={itemVariants} className="col-span-1 xl:col-span-2">
							<Card className="shadow-sm">
								<Accordion type="single" collapsible>
									<AccordionItem value="advanced">
										<AccordionTrigger className="px-6 py-4">
											<span className="flex items-center gap-2">
												<div className="flex size-7 items-center justify-center rounded-md bg-muted text-muted-foreground">
													<Settings className="size-4" />
												</div>
												Advanced
											</span>
										</AccordionTrigger>
										<AccordionContent className="px-6 pb-4">
											<p className="text-xs text-muted-foreground mb-4">Only needed if the generator keeps leaving the wrong preferences unmet.</p>
											<div className="grid gap-4">
												{ADVANCED_SECTIONS.map((section) => (
													<div key={section.title}>
														<CardTitle className="flex items-center gap-2 text-sm mb-3">
															<div className={`flex size-7 items-center justify-center rounded-md ${section.color}`}>
																<section.icon className="size-4" />
															</div>
															{section.title}
														</CardTitle>
														<div className="grid gap-4">
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
													</div>
												))}
											</div>
										</AccordionContent>
									</AccordionItem>
								</Accordion>
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

