const fs = require('fs');

const path = 'src/pages/FacultyAssignments.tsx';
let code = fs.readFileSync(path, 'utf8');

const target = `type SubjectRowProps = {
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
	const [openGrades, setOpenGrades] = useState<Record<number, boolean>>({});
	const groupedSections = useMemo(() => {
		const sectionGroups = new Map<number, ExternalSection[]>();`;


const replacement = `type SubjectRowProps = {
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
				const key = getOwnershipKey(subject.id, sec.id);
				const isAssigned = Boolean(savedOwnershipMap[key]) || Boolean(pendingOwnershipMap[key]);
				return sectionFilter === 'assigned' ? isAssigned : !isAssigned;
			});
		}

		if (searchTerm) {
			const term = searchTerm.toLowerCase();
			if (subject.name.toLowerCase().includes(term) || subject.code.toLowerCase().includes(term)) {
				// subject matches
			} else {
				// strict filter sections
				result = result.filter(sec => sec.name.toLowerCase().includes(term) || \`g\${sec.displayOrder}\`.includes(term));
			}
		}

		return result;
	}, [sections, sectionFilter, searchTerm, subject, savedOwnershipMap, pendingOwnershipMap]);

	const groupedSections = useMemo(() => {
		const sectionGroups = new Map<number, ExternalSection[]>();`;

if (code.includes(target)) {
    code = code.replace(target, replacement);
    fs.writeFileSync(path, code);
    console.log("Fix injected successfully.");
} else {
    console.log("Could not find the target block exactly.");
}
