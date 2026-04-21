import re

with open('src/pages/FacultyAssignments.tsx', 'r', encoding='utf-8') as f:
    code = f.read()

# Modify SubjectRow definition
row_def_old = '''type SubjectRowProps = {
	subject: Subject;
	assignment?: FacultyAssignmentDraft;
	sections: ExternalSection[];
	disabled: boolean;
	selectedFacultyId: number;
	savedOwnershipMap: Record<string, FacultyOwnershipState>;
	pendingOwnershipMap: Record<string, FacultyOwnershipState>;
	onSetSections: (subjectId: number, sectionIds: number[]) => void;
	isOutsideDepartment?: boolean;
};

function SubjectRow({
	subject,
	assignment,
	sections,
	disabled,
	selectedFacultyId,
	savedOwnershipMap,
	pendingOwnershipMap,
	onSetSections,
	isOutsideDepartment,
}: SubjectRowProps) {
	const [openGrades, setOpenGrades] = useState<Record<number, boolean>>({});'''

row_def_new = '''type SubjectRowProps = {
	subject: Subject;
	assignment?: FacultyAssignmentDraft;
	sections: ExternalSection[];
	disabled: boolean;
	selectedFacultyId: number;
	savedOwnershipMap: Record<string, FacultyOwnershipState>;
	pendingOwnershipMap: Record<string, FacultyOwnershipState>;
	onSetSections: (subjectId: number, sectionIds: number[]) => void;
	isOutsideDepartment?: boolean;
	searchTerm?: string;
	sectionFilter?: 'all' | 'unassigned' | 'assigned';
};

function SubjectRow({
	subject,
	assignment,
	sections,
	disabled,
	selectedFacultyId,
	savedOwnershipMap,
	pendingOwnershipMap,
	onSetSections,
	isOutsideDepartment,
	searchTerm = '',
	sectionFilter = 'all',
}: SubjectRowProps) {
	const [openGrades, setOpenGrades] = useState<Record<number, boolean>>({});

	// Compute filtered sections locally based on global searchTerm and sectionFilter
	const displaySections = useMemo(() => {
		let result = sections;
		
		if (sectionFilter !== 'all') {
			result = result.filter(sec => {
				const key = `${subject.id}:${sec.id}`;
				const isAssigned = Boolean(savedOwnershipMap[key]) || Boolean(pendingOwnershipMap[key]);
				return sectionFilter === 'assigned' ? isAssigned : !isAssigned;
			});
		}

		if (searchTerm) {
			const term = searchTerm.toLowerCase();
			if (subject.name.toLowerCase().includes(term) || subject.code.toLowerCase().includes(term)) {
				// subject matches, keep everything that passed sectionFilter
			} else {
				// strict filter sections
				result = result.filter(sec => sec.name.toLowerCase().includes(term) || `g${sec.displayOrder}`.includes(term));
			}
		}

		return result;
	}, [sections, sectionFilter, searchTerm, subject, savedOwnershipMap, pendingOwnershipMap]);
'''
code = code.replace(row_def_old, row_def_new)

# Modify groupedSections to use displaySections instead of sections
code = code.replace(
    "for (const section of sections) {",
    "for (const section of displaySections) {"
)
code = code.replace(
    "}, [sections]);",
    "}, [displaySections]);"
)

# Open state default closed, unless searched!
code = code.replace(
    "const isOpen = openGrades[gradeLevel] ?? true;",
    "const isOpen = openGrades[gradeLevel] ?? (searchTerm ? true : false);"
)

# Modify layout of the Section grid (grid-cols instead of col)
grid_old = '''								{isOpen && (
									<div className="space-y-1 border-t border-border/70 px-3 py-2">
										{gradeSections.map((section) => {'''
grid_new = '''								{isOpen && (
									<div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-2 border-t border-border/70 px-3 py-2">
										{gradeSections.map((section) => {'''
code = code.replace(grid_old, grid_new)

# Modify the Section tile to use GRADE_COLORS
tile_old = '''											<div
												key={section.id}
												className={`flex items-center justify-between gap-3 rounded-md border px-2.5 py-2 ${
													blocked ? 'border-red-200 bg-red-50/60' : isSelected ? 'border-primary/30 bg-primary/5' : 'border-border/70'
												}`}
											>
												<div className="flex min-w-0 items-center gap-2">
													<Checkbox checked={isSelected} onCheckedChange={() => toggleSection(section.id)} disabled={disabled || blocked} />
													<div className="min-w-0">
														<p className="truncate text-sm font-medium">{section.name}</p>
														<p className="truncate text-[0.6875rem] text-muted-foreground">
															G{section.displayOrder}{section.programCode && section.programCode !== 'REGULAR' ? ` | ${section.programCode}` : ''}
														</p>
													</div>
												</div>
												<div className="flex items-center gap-1.5">'''

tile_new = '''											<div
												key={section.id}
												className={`flex items-center justify-between gap-2 rounded-md border p-2 pl-2.5 transition-colors ${
													blocked 
														? 'border-red-200/50 bg-red-50/40 opacity-80 cursor-not-allowed' 
														: isSelected 
															? 'border-primary/40 bg-card shadow-sm ring-1 ring-primary/20' 
															: 'border-border/60 bg-card hover:bg-muted/30'
												}`}
											>
												<div className="flex min-w-0 items-center gap-2.5">
													<Checkbox checked={isSelected} onCheckedChange={() => toggleSection(section.id)} disabled={disabled || blocked} />
													<div className="min-w-0 flex flex-col justify-center">
														<div className="flex items-center gap-1.5">
															<span className={`px-1 py-0 rounded text-[0.5rem] font-bold uppercase tracking-wider ${GRADE_COLORS[section.displayOrder] || 'bg-muted text-muted-foreground'}`}>
																G{section.displayOrder}
															</span>
															<span className="truncate text-xs font-semibold leading-tight">{section.name}</span>
														</div>
														{section.programCode && section.programCode !== 'REGULAR' && (
															<p className="truncate text-[0.6rem] text-muted-foreground mt-0.5 max-w-[120px]">
																{section.programCode}
															</p>
														)}
													</div>
												</div>
												<div className="flex shrink-0 items-center gap-1">'''
code = code.replace(tile_old, tile_new)

with open('src/pages/FacultyAssignments.tsx', 'w', encoding='utf-8') as f:
    f.write(code)

print('FacultyAssignments.tsx updated 2.')
