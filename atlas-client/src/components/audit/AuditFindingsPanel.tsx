/**
 * A5 C4 ITEM 5 (2026-09-29) — the `/audit` findings-by-next-action renderer,
 * extracted from `pages/Audit.tsx`.
 *
 * WHY THIS FILE EXISTS. `pages/Audit.tsx` measured **1003 physical lines** at base
 * `d2be382d` — over the AGENTS.md §8 cap of 1000 — and A5's own `ac8adf09` took it
 * over. The repo's B5 cap guard
 * (`src/components/timetable/__tests__/timetable-relaxed-main-b02.test.tsx`, "no
 * non-test component anywhere under src exceeds the 1000-physical-line cap") is RED
 * because of that file. This is a real breach of a rule this project enforces, and
 * the fix is a SPLIT, not a token-window trim.
 *
 * THE SEAM IS A REAL COMPONENT BOUNDARY, NOT A LINE RANGE. The block that moved is
 * the whole "Findings by next action" region: the group tab strip, each group's
 * header (what is blocked / why it matters), its two repair actions, the scrollable
 * findings accordion, and the per-group empty state. It is self-contained: it reads
 * only the `findingGroups` array, the search query, and the default tab, and it owns
 * no state of its own. The page keeps ownership of data, the fetch, the search box
 * and the focus param — which is what `pages/Audit.tsx` is for.
 *
 * NOTHING IS ADDED. A split moves code; it does not add copy, and the comments that
 * belong to the moved block travelled with it. The page gains one import and one
 * element.
 *
 * THE TYPES TRAVEL TOO, and they are exported rather than duplicated, because
 * `a3-c8-audit-calm` and `a5-c2b-surface-truth` read `Audit.tsx`'s source and must
 * keep finding the same identifiers. `Finding`, `FindingGroup` and
 * `FindingSeverity` are declared HERE and re-exported from the page, so the page's
 * public surface (including the `SEVERITY_TREATMENT` / `SeverityBadge` pair that
 * row 3 of that suite imports) is unchanged.
 */
import { ArrowRight, ShieldCheck } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Badge } from '@/ui/badge';
import { Button } from '@/ui/button';
import { ScrollArea } from '@/ui/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/ui/tabs';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/ui/accordion';


export type FindingSeverity = 'blocker' | 'warning' | 'info';

export type Finding = {
	id: string;
	title: string;
	blockedLabel: string;
	detail: string;
	why: string;
	actionLabel: string;
	route: string;
	repairTarget: string;
	severity: FindingSeverity;
};

export type FindingGroup = {
	id: string;
	label: string;
	description: string;
	icon: typeof ShieldCheck;
	findings: Finding[];
	blockedLabel: string;
	why: string;
	primaryActionLabel: string;
	primaryRoute: string;
	repairTarget: string;
	secondaryActionLabel?: string;
	secondaryRoute?: string;
	emptyTitle: string;
	emptyBody: string;
};

/**
 * The search predicate, moved with the block it filters. It was a closure over the
 * page's `searchQuery`; as a pure function of the query it is the same filter, and it
 * is now decidable on its own rather than only through a render.
 */
export function filterFindings(findings: Finding[], searchQuery: string): Finding[] {
	const query = searchQuery.trim().toLowerCase();
	if (!query) return findings;
	return findings.filter((finding) =>
		finding.title.toLowerCase().includes(query) ||
		finding.detail.toLowerCase().includes(query) ||
		finding.why.toLowerCase().includes(query),
	);
}

type Props = {
	findingGroups: FindingGroup[];
	/** The shared severity badge. Passed in, not imported: the page owns it, and importing the page here would be a cycle. */
	SeverityBadge: (props: { severity: FindingSeverity }) => React.ReactElement;
	searchQuery: string;
	/** The focus-param-resolved default tab, so `/audit?focus=…` still opens the right group. */
	defaultGroupId: string;
};

export function AuditFindingsPanel({ findingGroups, searchQuery, defaultGroupId, SeverityBadge }: Props) {
	return (
		<Tabs defaultValue={defaultGroupId} className="flex min-h-0 flex-col">
			<TabsList className="flex h-auto w-full flex-wrap justify-start gap-2 bg-muted p-1">
				{findingGroups.map((group) => {
					const GroupIcon = group.icon;
					return (
						<TabsTrigger key={group.id} value={group.id} className="h-auto gap-2 rounded-xl px-3 py-2 text-xs data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
							<GroupIcon className="size-4" />
							<span>{group.label}</span>
							<Badge variant="secondary" className="h-5 rounded-full px-1.5 text-xs">{group.findings.length}</Badge>
						</TabsTrigger>
					);
				})}
			</TabsList>

			{findingGroups.map((group) => {
				const visibleFindings = filterFindings(group.findings, searchQuery);
				return (
					<TabsContent key={group.id} value={group.id} className="mt-4 focus-visible:ring-0">
						<div className="rounded-2xl border border-border bg-muted/70">
							<div className="border-b border-border px-4 py-3">
								<p className="font-bold text-foreground">{group.label}</p>
								<p className="text-sm text-muted-foreground">{group.description}</p>
							</div>
							<div className="grid gap-3 border-b border-border bg-white px-4 py-4 lg:grid-cols-[1fr_auto] lg:items-center">
								<div className="grid gap-3 text-sm md:grid-cols-2">
									<div className="rounded-xl bg-muted px-3 py-2">
										<p className="text-[0.68rem] font-bold uppercase tracking-wide text-muted-foreground">What is blocked</p>
										<p className="mt-1 font-semibold text-foreground">{group.blockedLabel}</p>
									</div>
									<div className="rounded-xl bg-muted px-3 py-2">
										<p className="text-[0.68rem] font-bold uppercase tracking-wide text-muted-foreground">Why it matters</p>
										<p className="mt-1 text-slate-600">{group.why}</p>
									</div>
								</div>
								<div className="flex flex-wrap gap-2 lg:justify-end">
									<Button asChild size="sm" className="h-9 rounded-xl gap-1.5 bg-primary text-primary-foreground hover:bg-primary/90">
										<Link to={group.primaryRoute} data-repair-target={group.repairTarget}>
											{group.primaryActionLabel}
											<ArrowRight className="size-3.5" />
										</Link>
									</Button>
									{group.secondaryActionLabel && group.secondaryRoute ? (
										<Button asChild variant="outline" size="sm" className="h-9 rounded-xl bg-white">
											<Link to={group.secondaryRoute} data-repair-target={`${group.repairTarget}-inspect`}>
												{group.secondaryActionLabel}
											</Link>
										</Button>
									) : null}
								</div>
							</div>
							<ScrollArea className="max-h-[46svh] min-h-72">
								<div className="divide-y divide-border bg-white">
									{visibleFindings.length === 0 ? (
										<div className="px-6 py-16 text-center">
											<ShieldCheck className="mx-auto mb-3 size-10 text-accent/40" />
											<p className="font-bold text-foreground">{searchQuery ? 'No matching findings' : group.emptyTitle}</p>
											<p className="mx-auto mt-1 max-w-lg text-sm text-muted-foreground">{searchQuery ? 'Clear the search to see the full report.' : group.emptyBody}</p>
										</div>
									) : (
										<Accordion type="single" collapsible className="w-full divide-y divide-border">
											{visibleFindings.map((finding) => (
												<AccordionItem key={finding.id} value={finding.id} className="border-b last:border-b-0">
													<AccordionTrigger className="px-4 py-4 hover:no-underline [&[data-state=open]]:bg-muted/10">
														<div className="flex flex-wrap items-center gap-2">
															<SeverityBadge severity={finding.severity} />
															<span className="font-bold text-foreground text-sm text-left">{finding.title}</span>
														</div>
													</AccordionTrigger>
													<AccordionContent className="px-4 pb-4 pt-1 bg-muted/5">
														<div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
															<div className="space-y-1.5 max-w-2xl">
																<p className="text-sm text-slate-600 leading-relaxed">{finding.detail}</p>
																<p className="text-xs font-semibold text-slate-600">What is blocked: <span className="font-normal text-muted-foreground">{finding.blockedLabel}</span></p>
																<p className="text-xs font-semibold text-slate-600">Why it matters: <span className="font-normal text-muted-foreground">{finding.why}</span></p>
															</div>
															<Button asChild variant="outline" size="sm" className="h-9 shrink-0 rounded-xl bg-white shadow-sm mt-2 lg:mt-0">
																<Link to={finding.route} data-repair-target={finding.repairTarget}>
																	{finding.actionLabel}
																	<ArrowRight className="ml-1 size-3.5" />
																</Link>
															</Button>
														</div>
													</AccordionContent>
												</AccordionItem>
											))}
										</Accordion>
									)}
								</div>
							</ScrollArea>
						</div>
					</TabsContent>
				);
			})}
		</Tabs>
	);
}
