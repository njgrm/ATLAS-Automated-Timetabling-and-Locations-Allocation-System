import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/ui/select';
import { programShortLabel, programFullLabel } from '@/lib/deped-glossary';

type SectionsFilterToolbarProps = {
	gradeFilter: string;
	onGradeFilterChange: (value: string) => void;
	availableGrades: string[];
	programFilter: string;
	onProgramFilterChange: (value: string) => void;
	availablePrograms: string[];
	homeRoomFilter: string;
	onHomeRoomFilterChange: (value: string) => void;
};

export function SectionsFilterToolbar({
	gradeFilter,
	onGradeFilterChange,
	availableGrades,
	programFilter,
	onProgramFilterChange,
	availablePrograms,
	homeRoomFilter,
	onHomeRoomFilterChange,
}: SectionsFilterToolbarProps) {
	return (
		<>
			<div className="grid w-full grid-cols-1 gap-2 sm:grid-cols-3">
				<Select value={gradeFilter} onValueChange={onGradeFilterChange}>
					<SelectTrigger className="h-10 text-sm">
						<SelectValue placeholder="All Grades" />
					</SelectTrigger>
					<SelectContent>
						<SelectItem value="all">All Grades</SelectItem>
						{availableGrades.map((g) => (
							<SelectItem key={g} value={g}>Grade {g}</SelectItem>
						))}
					</SelectContent>
				</Select>
				<Select value={programFilter} onValueChange={onProgramFilterChange}>
					<SelectTrigger className="h-10 text-sm">
						<SelectValue placeholder="All Programs" />
					</SelectTrigger>
					<SelectContent>
						<SelectItem value="all">All Programs</SelectItem>
						<SelectItem value="REGULAR">Regular Program</SelectItem>
						{availablePrograms.map((p) => (
							<SelectItem key={p} value={p}>{programShortLabel(p)}</SelectItem>
						))}
					</SelectContent>
				</Select>
				<Select value={homeRoomFilter} onValueChange={onHomeRoomFilterChange}>
					<SelectTrigger className="h-10 text-sm">
						<SelectValue placeholder="All home-room states" />
					</SelectTrigger>
					<SelectContent>
						<SelectItem value="all">All home-room states</SelectItem>
						<SelectItem value="missing">Needs a home room</SelectItem>
						<SelectItem value="assigned">Home room assigned</SelectItem>
					</SelectContent>
				</Select>
			</div>
			{availablePrograms.length > 0 ? (
				<p className="text-xs text-muted-foreground" data-testid="program-code-legend">
					<span className="font-semibold">Program codes:</span>{' '}
					{availablePrograms
						.map((p) => `${programShortLabel(p)} = ${programFullLabel(p)}`)
						.join('; ')}
				</p>
			) : null}
		</>
	);
}
