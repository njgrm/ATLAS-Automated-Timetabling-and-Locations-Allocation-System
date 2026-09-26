/**
 * TeachingLoadFilterBar — the By-teacher workspace discovery controls.
 *
 * Fix 14/16. Root cause of the old density: Department, Load, and Sort all sat
 * behind a `More filters` disclosure, so filtering the roster cost two clicks
 * for the three filters an operator actually reaches for. This bar promotes
 * Status, Department, and Load to one always-visible row and leaves only Sort
 * and the two optional inclusion switches behind the disclosure.
 *
 * The no-scroll architecture is untouched and load-bearing: this component adds
 * NO scroll container. It is a `shrink-0` block above the existing
 * `flex-1 overflow-auto` roster region in the Teaching Load shell, so the
 * workspace still never produces a global browser scrollbar
 * (`h-[calc(100svh-3.5rem)]` -> `flex-1 min-h-0` -> `overflow-y-auto`).
 *
 * Density is asserted structurally by
 * `src/components/faculty-assignments/__tests__/a3-teachers-load-a3.test.tsx`:
 * JSDOM performs no layout, so the control proves the reachable-in-one-row
 * contract and the absence of any new scroll container rather than pixels.
 */
import { AlertTriangle, Filter, LayoutGrid, ListFilter, RotateCcw, Search, Star } from 'lucide-react';
import { Button } from '@/ui/button';
import { Badge } from '@/ui/badge';
import { Input } from '@/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/ui/select';
import { Switch } from '@/ui/switch';
import { Label } from '@/ui/label';
import {
	type TeachingLoadStatusFilter,
	type TeachingLoadLoadFilter,
	type TeachingLoadFacet,
} from '@/lib/faculty-assignment-helpers';

type TeachingLoadFilterBarProps = {
	searchQuery: string;
	onSearchQueryChange: (q: string) => void;
	filterStatus: TeachingLoadStatusFilter;
	onFilterStatusChange: (s: TeachingLoadStatusFilter) => void;
	statusFacetCounts: Record<TeachingLoadFacet, number>;
	loadFilter: TeachingLoadLoadFilter;
	loadFacetCounts: Record<'below-standard' | 'at-standard' | 'excess', number>;
	onLoadFilterChange: (s: TeachingLoadLoadFilter) => void;
	departmentFilter: string;
	onDepartmentFilterChange: (d: string) => void;
	departmentOptions: { value: string; label: string; count: number }[];
	filterAnnouncement: string;
	onClearTeachingLoadFilters: () => void;
	sortOrder: string;
	onSortOrderChange: (o: any) => void;
	showFilters: boolean;
	onToggleFilters: () => void;
	showOutsideDept: boolean;
	onToggleOutsideDept: (s: boolean) => void;
	showUnmappedSpecialization: boolean;
	onShowUnmappedSpecializationChange: (s: boolean) => void;
	policyReady: boolean;
};

export function TeachingLoadFilterBar(props: TeachingLoadFilterBarProps) {
	const {
		searchQuery,
		onSearchQueryChange,
		filterStatus,
		onFilterStatusChange,
		statusFacetCounts,
		loadFilter,
		loadFacetCounts,
		onLoadFilterChange,
		departmentFilter,
		onDepartmentFilterChange,
		departmentOptions,
		filterAnnouncement,
		onClearTeachingLoadFilters,
		sortOrder,
		onSortOrderChange,
		showFilters,
		onToggleFilters,
		showOutsideDept,
		onToggleOutsideDept,
		showUnmappedSpecialization,
		onShowUnmappedSpecializationChange,
		policyReady,
	} = props;

	const hasActiveFilters = Boolean(
		searchQuery.trim()
		|| filterStatus !== 'all'
		|| departmentFilter !== 'all'
		|| loadFilter !== 'all',
	);

	return (
		<div className="space-y-2" data-testid="teaching-load-filter-bar">
			{/* One row: the three filters an operator reaches for are all here. */}
			<div className="flex flex-wrap items-center gap-2" data-testid="teaching-load-primary-filters">
				<div className="relative flex-1 min-w-44 max-w-xs">
					<Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
					<Input
						aria-label="Search teachers"
						placeholder="Search teachers..."
						value={searchQuery}
						onChange={(e) => onSearchQueryChange(e.target.value)}
						className="pl-10 h-9 bg-background shadow-sm border-border/60"
					/>
				</div>

				<Select value={filterStatus} onValueChange={(value) => onFilterStatusChange(value as TeachingLoadStatusFilter)}>
					<SelectTrigger aria-label="Filter by status" className="w-40 h-9 bg-background shadow-sm border-border/60 text-xs font-bold uppercase tracking-tight">
						<div className="flex items-center gap-2">
							<ListFilter className="size-3.5 opacity-50" />
							<SelectValue placeholder="Status" />
						</div>
					</SelectTrigger>
					<SelectContent>
						<SelectItem value="all" className="text-xs font-bold uppercase tracking-tight">All status</SelectItem>
						<SelectItem value="teaching-assigned" className="text-xs font-bold uppercase tracking-tight" disabled={(statusFacetCounts['teaching-assigned'] ?? 0) === 0}>Teaching assigned ({statusFacetCounts['teaching-assigned'] ?? 0})</SelectItem>
						<SelectItem value="no-teaching" className="text-xs font-bold uppercase tracking-tight" disabled={(statusFacetCounts['no-teaching'] ?? 0) === 0}>No teaching load ({statusFacetCounts['no-teaching'] ?? 0})</SelectItem>
						<SelectItem value="adviser-only" className="text-xs font-bold uppercase tracking-tight" disabled={(statusFacetCounts['adviser-only'] ?? 0) === 0}>Adviser only ({statusFacetCounts['adviser-only'] ?? 0}, subset)</SelectItem>
					</SelectContent>
				</Select>

				<Select value={departmentFilter} onValueChange={onDepartmentFilterChange}>
					<SelectTrigger aria-label="Filter by department" className="w-44 h-9 bg-background shadow-sm border-border/60 text-xs font-bold uppercase tracking-tight">
						<div className="flex items-center gap-2">
							<LayoutGrid className="size-3.5 opacity-50" />
							<SelectValue placeholder="Department" />
						</div>
					</SelectTrigger>
					<SelectContent>
						<SelectItem value="all" className="text-xs font-bold uppercase tracking-tight">All departments</SelectItem>
						{departmentOptions.map((option) => (
							<SelectItem key={option.value} value={option.value} disabled={option.count === 0} className="text-xs font-bold uppercase tracking-tight">{option.label} ({option.count})</SelectItem>
						))}
					</SelectContent>
				</Select>

				<Select value={loadFilter} onValueChange={(value) => onLoadFilterChange(value as TeachingLoadLoadFilter)}>
					<SelectTrigger aria-label="Filter by load" className="w-40 h-9 bg-background shadow-sm border-border/60 text-xs font-bold uppercase tracking-tight">
						<div className="flex items-center gap-2">
							<Star className="size-3.5 opacity-50" />
							<SelectValue placeholder="Load" />
						</div>
					</SelectTrigger>
					<SelectContent>
						<SelectItem value="all" className="text-xs font-bold uppercase tracking-tight">All loads</SelectItem>
						<SelectItem value="excess" className="text-xs font-bold uppercase tracking-tight text-amber-700" disabled={!policyReady || (loadFacetCounts.excess ?? 0) === 0}>Excess teaching load ({policyReady ? (loadFacetCounts.excess ?? 0) : '—'})</SelectItem>
						<SelectItem value="at-standard" className="text-xs font-bold uppercase tracking-tight text-emerald-700" disabled={!policyReady || (loadFacetCounts['at-standard'] ?? 0) === 0}>At standard ({policyReady ? (loadFacetCounts['at-standard'] ?? 0) : '—'})</SelectItem>
						<SelectItem value="below-standard" className="text-xs font-bold uppercase tracking-tight text-sky-700" disabled={!policyReady || (loadFacetCounts['below-standard'] ?? 0) === 0}>Below standard ({policyReady ? (loadFacetCounts['below-standard'] ?? 0) : '—'})</SelectItem>
					</SelectContent>
				</Select>

				<Button
					type="button"
					variant={showFilters ? 'secondary' : 'outline'}
					size="sm"
					className="h-9 shrink-0 gap-2 whitespace-nowrap font-bold"
					onClick={onToggleFilters}
					aria-expanded={showFilters}
				>
					<Filter className="size-4" />
					More filters
				</Button>
			</div>

			{hasActiveFilters && (
				<div className="flex flex-wrap items-center gap-1.5" data-testid="teaching-load-active-filters">
					<span className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground">Active filters:</span>
					{searchQuery.trim() && (
						<Badge variant="secondary" className="gap-1 text-[11px] font-bold">
							Search: {searchQuery.trim()}
						</Badge>
					)}
					{filterStatus !== 'all' && (
						<Badge variant="secondary" className="gap-1 text-[11px] font-bold">
							{filterStatus === 'teaching-assigned' ? 'Teaching assigned' : filterStatus === 'no-teaching' ? 'No teaching load' : 'Adviser only'}
						</Badge>
					)}
					{departmentFilter !== 'all' && (
						<Badge variant="secondary" className="gap-1 text-[11px] font-bold">
							{departmentOptions.find((option) => option.value === departmentFilter)?.label ?? departmentFilter}
						</Badge>
					)}
					{loadFilter !== 'all' && (
						<Badge variant="secondary" className="gap-1 text-[11px] font-bold">
							{loadFilter === 'excess' ? 'Excess teaching load' : loadFilter === 'at-standard' ? 'At standard' : 'Below standard'}
						</Badge>
					)}
					<Button type="button" variant="ghost" size="sm" className="h-7 gap-1 px-2 text-[11px] font-bold uppercase" onClick={onClearTeachingLoadFilters}>
						<RotateCcw className="size-3.5" />
						Clear all
					</Button>
				</div>
			)}

			<p className="sr-only" role="status" aria-live="polite" data-testid="teaching-load-filter-announcement">
				{filterAnnouncement}
			</p>

			{!policyReady && (
				<div className="rounded-xl border border-amber-200 bg-amber-50/70 px-4 py-2.5 text-amber-900" data-testid="teaching-load-policy-readiness">
					<div className="flex items-start gap-3">
						<AlertTriangle className="mt-0.5 size-4 shrink-0 text-amber-600" />
						<div>
							<p className="text-sm font-semibold">Teaching standard not configured</p>
							<p className="text-xs font-medium text-amber-800/80">ATLAS has no persisted workload policy for this school year, so utilization, remaining, and excess figures are unavailable. Teaching assignments and department filters still work. Ask an administrator to configure the teaching standard before generating.</p>
						</div>
					</div>
				</div>
			)}

			{/* Sort and the optional inclusion switches stay behind the disclosure. */}
			{showFilters && (
				<div className="flex flex-wrap items-center gap-2 rounded-xl border border-border/50 bg-background/80 p-2 shadow-sm" data-testid="teaching-load-secondary-filters">
					<Select value={sortOrder} onValueChange={onSortOrderChange}>
						<SelectTrigger aria-label="Sort teachers" className="w-44 h-9 bg-background shadow-sm border-border/60 text-xs font-bold uppercase tracking-tight">
							<SelectValue placeholder="Sort teachers" />
						</SelectTrigger>
						<SelectContent>
							<SelectItem value="load-desc" className="text-xs font-bold uppercase tracking-tight">Highest load</SelectItem>
							<SelectItem value="load-asc" className="text-xs font-bold uppercase tracking-tight">Lowest load</SelectItem>
						</SelectContent>
					</Select>

					<div className="flex items-center gap-2 border-l border-border/40 pl-3 h-9">
						<Switch
							id="show-outside-dept"
							checked={showOutsideDept}
							onCheckedChange={onToggleOutsideDept}
						/>
						<Label htmlFor="show-outside-dept" className="text-xs font-semibold uppercase tracking-widest cursor-pointer text-muted-foreground whitespace-nowrap">
							Cross-Dept
						</Label>
					</div>

					<div className="flex items-center gap-2 border-l border-border/40 pl-3 h-9">
						<Switch
							id="show-unmapped-specialization"
							checked={showUnmappedSpecialization}
							onCheckedChange={onShowUnmappedSpecializationChange}
						/>
						<Label htmlFor="show-unmapped-specialization" className="text-xs font-semibold uppercase tracking-widest cursor-pointer text-muted-foreground whitespace-nowrap">
							Unmapped Specialization
						</Label>
					</div>
				</div>
			)}
		</div>
	);
}
