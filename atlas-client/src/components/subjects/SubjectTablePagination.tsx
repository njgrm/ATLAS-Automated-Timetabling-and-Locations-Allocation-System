import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from 'lucide-react';
import { Button } from '@/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/ui/select';

const PAGE_SIZES = [10, 25, 50, 100];

type Props = {
	page: number;
	pageSize: number;
	totalFiltered: number;
	totalPages: number;
	onPageChange: (page: number) => void;
	onPageSizeChange: (size: number) => void;
};

export function SubjectTablePagination({
	page,
	pageSize,
	totalFiltered,
	totalPages,
	onPageChange,
	onPageSizeChange,
}: Props) {
	return (
		<div className="flex items-center justify-between gap-3">
			<div className="flex items-center gap-4 text-xs text-muted-foreground font-medium">
				<span>
					{totalFiltered === 0
						? 'No results'
						: `Showing ${(page - 1) * pageSize + 1}-${Math.min(page * pageSize, totalFiltered)} of ${totalFiltered} results`}
				</span>
				<div className="flex items-center gap-2 border-l pl-4 border-border/50">
					<span>Rows per page:</span>
					<Select value={String(pageSize)} onValueChange={(v) => onPageSizeChange(Number(v))}>
						<SelectTrigger className="h-7 w-20 text-xs bg-background">
							<SelectValue />
						</SelectTrigger>
						<SelectContent>
							{PAGE_SIZES.map((s) => <SelectItem key={s} value={String(s)}>{s}</SelectItem>)}
						</SelectContent>
					</Select>
				</div>
			</div>
			<div className="flex items-center gap-1.5">
				<Button variant="outline" size="icon" className="h-8 w-8" onClick={() => onPageChange(1)} disabled={page <= 1}>
					<ChevronsLeft className="size-4" />
				</Button>
				<Button variant="outline" size="icon" className="h-8 w-8" onClick={() => onPageChange(Math.max(1, page - 1))} disabled={page <= 1}>
					<ChevronLeft className="size-4" />
				</Button>
				<div className="flex items-center gap-1.5 px-3 h-8 rounded-md border bg-background text-xs font-bold tabular-nums">
					<span>{page}</span>
					<span className="text-muted-foreground/50 font-normal">/</span>
					<span className="text-muted-foreground font-normal">{totalPages}</span>
				</div>
				<Button variant="outline" size="icon" className="h-8 w-8" onClick={() => onPageChange(Math.min(totalPages, page + 1))} disabled={page >= totalPages}>
					<ChevronRight className="size-4" />
				</Button>
				<Button variant="outline" size="icon" className="h-8 w-8" onClick={() => onPageChange(totalPages)} disabled={page >= totalPages}>
					<ChevronsRight className="size-4" />
				</Button>
			</div>
		</div>
	);
}
