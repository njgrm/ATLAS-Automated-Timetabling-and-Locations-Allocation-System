import re

with open('src/pages/FacultyAssignments.tsx', 'r', encoding='utf-8') as f:
    code = f.read()

target = '''function SubjectRow({
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
	const [openGrades, setOpenGrades] = useState<Record<number, boolean>>({});
	const groupedSections = useMemo(() => {
		const sectionGroups = new Map<number, ExternalSection[]>();'''

replacement = '''function SubjectRow({
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
}: SubjectRowProps & { searchTerm?: string; sectionFilter?: 'all' | 'unassigned' | 'assigned' }) {
	const [openGrades, setOpenGrades] = useState<Record<number, boolean>>({});

	// Compute filtered sections locally based on global searchTerm and sectionFilter
	const displaySections = useMemo(() => {
		let result = sections;
		
		if (sectionFilter !== 'all') {
			result = result.filter(sec => {
				const key = getOwnershipKey(subject.id, sec.id);
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

	const groupedSections = useMemo(() => {
		const sectionGroups = new Map<number, ExternalSection[]>();'''

if target in code:
    code = code.replace(target, replacement)
    with open('src/pages/FacultyAssignments.tsx', 'w', encoding='utf-8') as f:
        f.write(code)
    print('Fixed displaySections error.')
else:
    print('Could not find target block.')
