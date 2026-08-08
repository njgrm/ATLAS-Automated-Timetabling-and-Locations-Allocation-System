import type { ReactNode } from 'react';
import { ArrowDown, ArrowUp, ArrowUpDown, ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight, MoreHorizontal } from 'lucide-react';

import { AdminStatePanel, AdminTableShell } from '@/components/admin-workspace/AdminWorkspace';
import { cn } from '@/lib/utils';
import { Button } from '@/ui/button';
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
} from '@/ui/dropdown-menu';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/ui/select';
import { Skeleton } from '@/ui/skeleton';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/ui/tooltip';

export type AdminDataTableSortDirection = 'asc' | 'desc';

export type AdminDataTableColumn<TData, TSort extends string = string> = {
	id: string;
	label: string;
	description?: string;
	sortKey?: TSort;
	headerClassName?: string;
	cellClassName?: string;
	render: (row: TData) => ReactNode;
	skeleton?: ReactNode;
};

export type AdminDataTableMenuAction = {
	label: string;
	onSelect: () => void;
	icon?: ReactNode;
	disabled?: boolean;
};

export type AdminDataTableRowActions<TData> = {
	label: string;
	primary: (row: TData) => ReactNode;
	secondary?: (row: TData) => AdminDataTableMenuAction[];
	destructive?: (row: TData) => AdminDataTableMenuAction[];
	menuTestId?: string;
};

export type AdminDataTablePagination = {
	page: number;
	pageSize: number;
	total: number;
	totalPages?: number;
	pageSizeOptions?: number[];
	onPageChange?: (page: number) => void;
	onPageSizeChange?: (pageSize: number) => void;
};

export type AdminDataTableState = {
	icon: ReactNode;
	title: string;
	description?: string;
	action?: ReactNode;
};

type AdminDataTableMobileContext = {
	primaryAction?: ReactNode;
	secondaryActionMenu?: ReactNode;
};

type AdminDataTableProps<TData, TSort extends string = string> = {
	data: TData[];
	columns: AdminDataTableColumn<TData, TSort>[];
	getRowKey: (row: TData) => string | number;
	loading?: boolean;
	loadingRowCount?: number;
	isFiltered?: boolean;
	sort?: { key: TSort; direction: AdminDataTableSortDirection };
	onSortChange?: (key: TSort) => void;
	rowActions?: AdminDataTableRowActions<TData>;
	pagination?: AdminDataTablePagination;
	emptyState: AdminDataTableState;
	noResultsState: AdminDataTableState;
	errorState?: AdminDataTableState | null;
	renderMobileCard?: (row: TData, context: AdminDataTableMobileContext) => ReactNode;
};

function renderSortIcon<TSort extends string>(
	column: AdminDataTableColumn<unknown, TSort>,
	sort?: { key: TSort; direction: AdminDataTableSortDirection },
) {
	if (!column.sortKey) return null;
	if (sort?.key !== column.sortKey) return <ArrowUpDown className="size-3 text-muted-foreground/50" />;
	return sort.direction === 'asc' ? <ArrowUp className="size-3" /> : <ArrowDown className="size-3" />;
}

/** Build the sort button's accessible name: "Sort by {column}, currently {ascending|descending|unsorted}". */
function sortAriaLabel<TSort extends string>(
	column: AdminDataTableColumn<unknown, TSort>,
	sort?: { key: TSort; direction: AdminDataTableSortDirection },
): string {
	const direction = sort?.key === column.sortKey && sort ? (sort.direction === 'asc' ? 'ascending' : 'descending') : 'unsorted';
	return `Sort by ${column.label}, currently ${direction}`;
}

/** Return the aria-sort value for a column, or undefined when not the active sort column. */
function ariaSortValue<TSort extends string>(
	column: AdminDataTableColumn<unknown, TSort>,
	sort?: { key: TSort; direction: AdminDataTableSortDirection },
): 'ascending' | 'descending' | 'none' | undefined {
	if (!column.sortKey) return undefined;
	if (sort?.key !== column.sortKey) return 'none';
	return sort.direction === 'asc' ? 'ascending' : 'descending';
}

function AdminDataTableActionMenu({
	actions,
	destructiveActions = [],
	label,
	testId,
}: {
	actions: AdminDataTableMenuAction[];
	destructiveActions?: AdminDataTableMenuAction[];
	label: string;
	testId?: string;
}) {
	if (actions.length === 0 && destructiveActions.length === 0) return null;

	return (
		<DropdownMenu>
			<DropdownMenuTrigger asChild>
				<Button variant="ghost" size="icon-sm" aria-label={label} data-testid={testId}>
					<MoreHorizontal className="size-4" />
				</Button>
			</DropdownMenuTrigger>
			<DropdownMenuContent align="end" className="w-52">
				{actions.map((action, index) => (
					<DropdownMenuItem key={`${action.label}-${index}`} disabled={action.disabled} onSelect={action.onSelect} className="gap-2 font-semibold">
						{action.icon}
						{action.label}
					</DropdownMenuItem>
				))}
				{actions.length > 0 && destructiveActions.length > 0 && <DropdownMenuSeparator />}
				{destructiveActions.map((action, index) => (
					<DropdownMenuItem key={`${action.label}-${index}`} disabled={action.disabled} onSelect={action.onSelect} className="gap-2 font-semibold text-destructive">
						{action.icon}
						{action.label}
					</DropdownMenuItem>
				))}
			</DropdownMenuContent>
		</DropdownMenu>
	);
}

function AdminDataTableFooter({ pagination }: { pagination: AdminDataTablePagination }) {
	const totalPages = pagination.totalPages ?? Math.max(1, Math.ceil(pagination.total / Math.max(pagination.pageSize, 1)));
	const start = pagination.total === 0 ? 0 : (pagination.page - 1) * pagination.pageSize + 1;
	const end = Math.min(pagination.page * pagination.pageSize, pagination.total);
	const pageSizeOptions = pagination.pageSizeOptions ?? [10, 25, 50, 100];

	return (
		<div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
			<div className="flex flex-wrap items-center gap-3 text-xs font-medium text-muted-foreground">
				<span>{pagination.total === 0 ? 'No results' : `Showing ${start}-${end} of ${pagination.total} results`}</span>
				{pagination.onPageSizeChange && (
					<div className="flex items-center gap-2 border-border/50 md:border-l md:pl-4">
						<span>Rows per page</span>
						<Select value={String(pagination.pageSize)} onValueChange={(value) => pagination.onPageSizeChange?.(Number(value))}>
							<SelectTrigger className="h-9 w-20 bg-background text-xs" aria-label="Rows per page">
								<SelectValue />
							</SelectTrigger>
							<SelectContent>
								{pageSizeOptions.map((size) => <SelectItem key={size} value={String(size)}>{size}</SelectItem>)}
							</SelectContent>
						</Select>
					</div>
				)}
			</div>
			<div className="flex items-center gap-1.5">
				<Button variant="outline" size="icon" className="size-9" onClick={() => pagination.onPageChange?.(1)} disabled={pagination.page <= 1 || !pagination.onPageChange} aria-label="First page"><ChevronsLeft className="size-4" /></Button>
				<Button variant="outline" size="icon" className="size-9" onClick={() => pagination.onPageChange?.(Math.max(1, pagination.page - 1))} disabled={pagination.page <= 1 || !pagination.onPageChange} aria-label="Previous page"><ChevronLeft className="size-4" /></Button>
				<div className="flex h-9 items-center gap-1.5 rounded-md border bg-background px-3 text-[0.7rem] font-bold tabular-nums">
					<span>{pagination.page}</span><span className="font-normal text-muted-foreground/50">/</span><span className="font-normal text-muted-foreground">{totalPages}</span>
				</div>
				<Button variant="outline" size="icon" className="size-9" onClick={() => pagination.onPageChange?.(Math.min(totalPages, pagination.page + 1))} disabled={pagination.page >= totalPages || !pagination.onPageChange} aria-label="Next page"><ChevronRight className="size-4" /></Button>
				<Button variant="outline" size="icon" className="size-9" onClick={() => pagination.onPageChange?.(totalPages)} disabled={pagination.page >= totalPages || !pagination.onPageChange} aria-label="Last page"><ChevronsRight className="size-4" /></Button>
			</div>
		</div>
	);
}

export function AdminDataTable<TData, TSort extends string = string>({
	data,
	columns,
	getRowKey,
	loading = false,
	loadingRowCount = 8,
	isFiltered = false,
	sort,
	onSortChange,
	rowActions,
	pagination,
	emptyState,
	noResultsState,
	errorState,
	renderMobileCard,
}: AdminDataTableProps<TData, TSort>) {
	const state = errorState ?? (isFiltered ? noResultsState : emptyState);
	const hasActions = Boolean(rowActions);
	const footer = !loading && pagination && pagination.total > 0 ? <AdminDataTableFooter pagination={pagination} /> : undefined;
	const statePanelProps = { icon: state.icon, title: state.title, description: state.description, action: state.action };

	return (
		<AdminTableShell footer={footer}>
			{loading ? (
				<div className="space-y-0">
					<div data-admin-table-view="desktop" className="hidden md:block">
						<table className="w-full text-sm">
							<thead className="sticky top-0 z-10 bg-muted/90 backdrop-blur-md">
								<tr className="border-b">
									{columns.map((column) => <th key={column.id} className={cn('px-4 py-3 text-left', column.headerClassName)}>{column.label}</th>)}
									{hasActions && <th className="px-4 py-3 text-right text-[0.7rem] font-semibold uppercase tracking-wider text-muted-foreground">Actions</th>}
								</tr>
							</thead>
							<tbody>
								{Array.from({ length: loadingRowCount }).map((_, index) => (
									<tr key={index} className="border-b last:border-0">
										{columns.map((column) => <td key={column.id} className={cn('px-4 py-4', column.cellClassName)}>{column.skeleton ?? <Skeleton className="h-5 w-28" />}</td>)}
										{hasActions && <td className="px-4 py-4"><Skeleton className="ml-auto h-8 w-32" /></td>}
									</tr>
								))}
							</tbody>
						</table>
					</div>
					<div data-admin-table-view="mobile" className="space-y-3 p-4 md:hidden">
						{Array.from({ length: 4 }).map((_, index) => <Skeleton key={index} className="h-36 rounded-xl" />)}
					</div>
				</div>
			) : data.length === 0 ? (
				<div className="flex min-h-88 items-center justify-center px-4 py-16">
					<AdminStatePanel {...statePanelProps} />
				</div>
			) : (
				<>
					<div data-admin-table-view="desktop" className="hidden md:block">
						<table className="w-full text-sm">
							<thead className="sticky top-0 z-10 bg-muted/90 backdrop-blur-md">
								<tr className="border-b">
{columns.map((column) => {
									const headerContent = (
										<div className="flex min-w-0 flex-col items-start gap-0.5">
											<span className="flex items-center gap-1.5 whitespace-nowrap">{column.label}{renderSortIcon(column as AdminDataTableColumn<unknown, TSort>, sort)}</span>
											{column.description && <span className="max-w-44 text-left text-[0.7rem] font-medium normal-case leading-4 text-muted-foreground/70">{column.description}</span>}
										</div>
									);

									const isSortable = Boolean(column.sortKey && onSortChange);
								const handleSort = isSortable ? () => onSortChange?.(column.sortKey as TSort) : undefined;
								return (
									<th
										key={column.id}
										className={cn('px-4 py-3 text-left align-bottom', column.headerClassName)}
										aria-sort={isSortable ? ariaSortValue(column as AdminDataTableColumn<unknown, TSort>, sort) : undefined}
									>
										{isSortable && handleSort ? (
											<TooltipProvider delayDuration={200}>
												<Tooltip>
													<TooltipTrigger asChild>
														<Button
															variant="ghost"
															size="sm"
															onClick={handleSort}
															aria-label={sortAriaLabel(column as AdminDataTableColumn<unknown, TSort>, sort)}
															className="h-auto px-0 py-0 font-semibold text-muted-foreground hover:text-foreground"
														>
															{headerContent}
														</Button>
													</TooltipTrigger>
													<TooltipContent side="top" className="text-xs">
														{sortAriaLabel(column as AdminDataTableColumn<unknown, TSort>, sort)}
													</TooltipContent>
												</Tooltip>
											</TooltipProvider>
										) : (
											<div className="text-[0.7rem] font-semibold uppercase tracking-wider text-muted-foreground">{headerContent}</div>
										)}
									</th>
								);
								})}
									{hasActions && <th className="px-4 py-3 text-right align-bottom text-[0.7rem] font-semibold uppercase tracking-wider text-muted-foreground">Actions</th>}
								</tr>
							</thead>
							<tbody className="divide-y divide-border/40">
								{data.map((row) => {
									const secondary = rowActions?.secondary?.(row) ?? [];
									const destructive = rowActions?.destructive?.(row) ?? [];
									return (
										<tr key={getRowKey(row)} className="transition-colors hover:bg-muted/30">
											{columns.map((column) => <td key={column.id} className={cn('px-4 py-3 align-middle', column.cellClassName)}>{column.render(row)}</td>)}
											{rowActions && (
												<td className="px-4 py-3 text-right">
													<div className="flex items-center justify-end gap-2">
								{rowActions.primary(row)}
								<AdminDataTableActionMenu actions={secondary} destructiveActions={destructive} label={rowActions.label} testId={rowActions.menuTestId} />
							</div>
						</td>
											)}
										</tr>
									);
								})}
							</tbody>
						</table>
					</div>

					<div data-admin-table-view="mobile" className="space-y-3 p-4 md:hidden">
						{data.map((row) => {
							const secondary = rowActions?.secondary?.(row) ?? [];
							const destructive = rowActions?.destructive?.(row) ?? [];
							const primaryAction = rowActions?.primary(row);
							const secondaryActionMenu = rowActions ? <AdminDataTableActionMenu actions={secondary} destructiveActions={destructive} label={rowActions.label} testId={rowActions.menuTestId} /> : undefined;

							return renderMobileCard ? (
								<div key={getRowKey(row)}>{renderMobileCard(row, { primaryAction, secondaryActionMenu })}</div>
							) : (
								<div key={getRowKey(row)} className="rounded-xl border border-slate-100 bg-slate-50/70 p-4">
									<div className="space-y-3">{columns.map((column) => <div key={column.id}>{column.render(row)}</div>)}</div>
									{rowActions && <div className="mt-4 flex items-center gap-2">{primaryAction}<div className="ml-auto">{secondaryActionMenu}</div></div>}
								</div>
							);
						})}
					</div>
				</>
			)}
		</AdminTableShell>
	);
}
