import re

with open("D:\\ATLAS\\atlas-client\\src\\pages\\FacultyAssignments.tsx", "r", encoding="utf-8") as f:
    content = f.read()

# 1. Fix Subject separation (sort department subjects before Homeroom)
old_primary = """const { primarySubjects, otherSubjects } = useMemo(() => {
const department = selected?.department ?? null;
const primary: Subject[] = [];
const other: Subject[] = [];
for (const subject of subjects) {
if (matchesFacultyDepartment(department, subject.code, subject.name)) {
primary.push(subject);
} else {
other.push(subject);
}
}
return { primarySubjects: primary, otherSubjects: other };
}, [selected, subjects]);"""

new_primary = """const { primarySubjects, otherSubjects } = useMemo(() => {
const department = selected?.department ?? null;
const primary: Subject[] = [];
const other: Subject[] = [];
for (const subject of subjects) {
if (matchesFacultyDepartment(department, subject.code, subject.name)) {
primary.push(subject);
} else {
other.push(subject);
}
}

primary.sort((a, b) => {
    const aIsHR = a.name.toLowerCase().includes('homeroom') || a.code.toLowerCase().includes('homeroom');
    const bIsHR = b.name.toLowerCase().includes('homeroom') || b.code.toLowerCase().includes('homeroom');
    if (aIsHR && !bIsHR) return 1;
    if (!aIsHR && bIsHR) return -1;
    return a.name.localeCompare(b.name);
});

other.sort((a, b) => a.name.localeCompare(b.name));

return { primarySubjects: primary, otherSubjects: other };
}, [selected, subjects]);"""
content = content.replace(old_primary, new_primary)

# 2. Fix filterBySubjectSearch
old_filter_search = """const filterBySubjectSearch = useCallback(
        (subjectList: Subject[]) => {
                if (!subjectSearch.trim()) {
                        return subjectList;
                }
                const normalizedQuery = subjectSearch.toLowerCase();
                // Check if any subject directly matches the search term
                const anySubjectMatches = subjectList.some(
                        (subject) => subject.name.toLowerCase().includes(normalizedQuery) || subject.code.toLowerCase().includes(normalizedQuery),
                );
                // If no subjects directly match, it might be a section/grade search — show all subjects
                // so SubjectRow can filter down to matching sections
                if (!anySubjectMatches) {
                        return subjectList;
                }
                return subjectList.filter(
                        (subject) => subject.name.toLowerCase().includes(normalizedQuery) || subject.code.toLowerCase().includes(normalizedQuery),
                );
        },
        [subjectSearch],
);
},
[subjectSearch],
);"""
new_filter_search = """const filterBySubjectSearch = useCallback(
        (subjectList: Subject[]) => {
                return subjectList; // Rendering visibility is completely handled by SubjectRow filter down algorithm now
        },
        [],
);"""
content = content.replace(old_filter_search, new_filter_search)

# Also there might be a simpler old_filter_search if the syntax error was different
content = re.sub(r'const filterBySubjectSearch = useCallback\([\s\S]*?(?=\nconst loadProfile = useMemo)', new_filter_search + '\n\n', content)

# 3. Add Star to lucide-react imports
if "Star" not in content and "lucide-react" in content:
    content = content.replace("UserCog,", "UserCog,\nStar,")

with open("D:\\ATLAS\\atlas-client\\src\\pages\\FacultyAssignments.tsx", "w", encoding="utf-8") as f:
    f.write(content)
