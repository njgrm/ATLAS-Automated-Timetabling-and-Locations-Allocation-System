import { Search, Filter } from 'lucide-react';
import { Input } from '@/ui/input';
import { Button } from '@/ui/button';
import { Badge } from '@/ui/badge';
import { Skeleton } from '@/ui/skeleton';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/ui/select';
import { SearchableSelect } from '@/ui/searchable-select';
import { AlertTriangle, CheckCircle2 } from 'lucide-react';
import type { FacultySummary, FacultyAssignmentDraft } from '@/types';
import { getFacultyComparableLoadHours } from '@/lib/faculty-assignment-helpers';

type RosterSidebarProps = {
	loading: boolean;
	faculty: FacultySummary[];
	filteredFaculty: FacultySummary[];
	groupedFaculty: [string, FacultySummary[]][];
	searchQuery: string;
	onSearchQueryChange: (query: string) => void;
	filterStatus: 'all' | 'assigned' | 'unassigned';
	onFilterStatusChange: (status: 'all' | 'assigned' | 'unassigned') => void;
	departmentFilter: string;
	onDepartmentFilterChange: (dept: string) => void;
	departmentOptions: string[];
	sortOrder: 'load-asc' | 'load-desc';
	onSortOrderChange: (order: 'load-asc' | 'load-desc') => void;
	showFilters: boolean;
	onToggleFilters: () => void;
	selectedId: number | null;
	onSelectTeacher: (id: number) => void;
	effectiveAssignmentsByFaculty: Record<number, FacultyAssignmentDraft[]>;
	effectiveDraftAssignmentsByFaculty: Record<number, FacultyAssignmentDraft[]>;
	coverageHeadline: {
		realAssigned: number;
		syntheticAssigned: number;
		unassigned: number;
	};
};

export function RosterSidebar({
	loading,
	faculty,
	filteredFaculty,
	groupedFaculty,
	searchQuery,
	onSearchQueryChange,
	filterStatus,
	onFilterStatusChange,
	departmentFilter,
	onDepartmentFilterChange,
	departmentOptions,
	sortOrder,
	onSortOrderChange,
	showFilters,
	onToggleFilters,
	selectedId,
	onSelectTeacher,
	effectiveAssignmentsByFaculty,
	effectiveDraftAssignmentsByFaculty,
	coverageHeadline,
}: RosterSidebarProps) {
	return (
		<div className="flex w-64 shrink-0 flex-col rounded-xl border border-border bg-card shadow-sm overflow-hidden">
			<div className="border-b border-border p-1.5 space-y-1.5 bg-muted/10">
				<div className="flex items-center gap-2">
					<div className="relative flex-1">
						<Search className="absolute left-2.5 top-1/2 size-3 -translate-y-1/2 text-muted-foreground" />
						<Input
							placeholder="Search roster..."
							value={searchQuery}
							onChange={(event) => onSearchQueryChange(event.target.value)}
							className="h-7 pl-8 text-[0.7rem] bg-background"
						/>
					</div>
					<Button
						variant={showFilters ? 'secondary' : 'outline'}
						size="icon-sm"
						className="h-7 w-7"
						onClick={onToggleFilters}
					>
						<Filter className="size-3" />
					</Button>
				</div>

				{showFilters && (
					<div className="space-y-1 pt-1 animate-in slide-in-from-top-2 duration-200">
						<div className="flex gap-1">
							{(['all', 'assigned', 'unassigned'] as const).map((status) => (
								<Button
									key={status}
									type="button"
									variant={filterStatus === status ? 'default' : 'outline'}
									size="sm"
									onClick={() => onFilterStatusChange(status)}
									className="h-5 flex-1 px-0 text-[0.6rem] font-bold uppercase tracking-tight"
								>
									{status === 'all' ? 'Any' : status.charAt(0).toUpperCase() + status.slice(1)}
								</Button>
							))}
						</div>

						<div className="grid grid-cols-1 gap-1">
							<SearchableSelect
								value={departmentFilter}
								onValueChange={onDepartmentFilterChange}
								placeholder="All Departments"
								triggerClassName="h-6 w-full justify-between text-[0.65rem] font-semibold bg-background"
								className="w-full"
								items={[
									{ value: 'all', label: 'All Departments' },
									...departmentOptions.map((department) => ({ value: department, label: department })),
								]}
							/>
						</div>

						<div className="grid grid-cols-1 gap-1">
							<Select value={sortOrder} onValueChange={(value) => onSortOrderChange(value as 'load-asc' | 'load-desc')}>
								<SelectTrigger className="h-6 w-full text-[0.65rem] font-semibold bg-background">
									<SelectValue placeholder="Sort by load" />
								</SelectTrigger>
								<SelectContent>
									<SelectItem value="load-asc" className="text-[0.65rem] font-semibold uppercase">Load: Low to High</SelectItem>
									<SelectItem value="load-desc" className="text-[0.65rem] font-semibold uppercase">Load: High to Low</SelectItem>
								</SelectContent>
							</Select>
						</div>
					</div>
				)}
			</div>

			<div className="flex-1 overflow-auto">
				{loading ? (
					Array.from({ length: 12 }).map((_, index) => (
						<div key={index} className="flex items-center gap-3 border-b border-border px-4 py-3">
							<Skeleton className="size-8 shrink-0 rounded-full" />
							<div className="flex-1 space-y-1.5">
								<Skeleton className="h-4 w-28" />
								<Skeleton className="h-3 w-20" />
							</div>
							<Skeleton className="h-5 w-12 shrink-0" />
						</div>
					))
				) : filteredFaculty.length === 0 ? (
					<p className="p-8 text-center text-xs text-muted-foreground italic">
						{faculty.length === 0 ? 'No teachers synced.' : 'No matches found.'}
					</p>
				) : (
					groupedFaculty.map(([departmentName, members]) => (
						<div key={departmentName} className="border-b border-border/80">
							<div className="bg-muted/40 px-3 py-1 text-[0.55rem] font-bold uppercase tracking-widest text-muted-foreground/60 flex items-center justify-between">
								<span className="truncate">{departmentName}</span>
								<span className="shrink-0 ml-2 opacity-40">{members.length}</span>
							</div>
							{members.map((member) => {
								const effectiveSubjectCount = effectiveAssignmentsByFaculty[member.id]?.length ?? 0;
								const hasDraft = Boolean(effectiveDraftAssignmentsByFaculty[member.id]);
								const displayHours = getFacultyComparableLoadHours(member);
								const actualLoadPercentage = member.isPlaceholder
									? 0
									: Math.round(member.policyLoadPercentage ?? (member.maxHoursPerWeek > 0 ? (displayHours / member.maxHoursPerWeek) * 100 : 0));
								const loadColorClass = actualLoadPercentage > 150
									? 'text-red-600'
									: actualLoadPercentage > 100
										? 'text-amber-600'
										: 'text-emerald-600';
								return (
									<Button
										key={member.id}
										type="button"
										variant="ghost"
										onClick={() => onSelectTeacher(member.id)}
										className={`h-auto w-full justify-start rounded-none border-b border-border/50 px-3 py-1.5 text-left transition-all ${
											selectedId === member.id ? 'bg-primary/5 border-l-2 border-l-primary' : 'hover:bg-muted/50 border-l-2 border-l-transparent'
										}`}
									>
										<div className="flex w-full items-center gap-2">
											<div className="flex size-6 shrink-0 items-center justify-center rounded-full bg-primary/10 text-[0.6rem] font-bold text-primary border border-primary/5">
												{member.firstName[0]}
												{member.lastName[0]}
											</div>
											<div className="flex-1 min-w-0">
												<p className={`truncate text-sm ${selectedId === member.id ? 'font-black text-foreground' : 'font-bold text-muted-foreground'}`}>
													{member.lastName}, {member.firstName}
												</p>
												<div className="flex items-center gap-2 mt-0.5">
													<span className="truncate text-xs text-muted-foreground/80 font-bold flex-1">
														{member.specialization || member.department || 'General'}
													</span>
													<span className={`text-xs font-black tabular-nums ${loadColorClass}`}>
														{member.isPlaceholder ? `${Math.round(displayHours * 10) / 10}h` : `${actualLoadPercentage}%`}
													</span>
												</div>
											</div>
											<div className="flex items-center gap-1 shrink-0">
												{hasDraft && <div className="size-2 rounded-full bg-sky-500 animate-pulse" />}
												{effectiveSubjectCount === 0 ? (
													<AlertTriangle className="size-3.5 text-amber-500 opacity-70" />
												) : (
													<CheckCircle2 className="size-3.5 text-emerald-500 opacity-70" />
												)}
											</div>
										</div>
									</Button>
								);
							})}
						</div>
					))
				)}
			</div>
			<div className="border-t border-border bg-muted/20 px-4 py-2 text-xs font-bold text-muted-foreground/80 flex items-center justify-between uppercase tracking-tight">
				<div className="flex items-center gap-4">
					<span className="cursor-help hover:text-foreground transition-colors">{coverageHeadline.realAssigned} Staffed</span>
					<span className="opacity-30">/</span>
					<span className="cursor-help hover:text-foreground transition-colors">{coverageHeadline.syntheticAssigned} Temp</span>
				</div>
				<span className={coverageHeadline.unassigned > 0 ? 'text-amber-600' : 'text-emerald-600'}>
					{coverageHeadline.unassigned} Unassigned
				</span>
			</div>
		</div>
	);
}
