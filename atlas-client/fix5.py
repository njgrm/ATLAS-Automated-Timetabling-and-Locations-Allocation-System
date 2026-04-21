import re

with open("D:\\ATLAS\\atlas-client\\src\\pages\\FacultyAssignments.tsx", "r", encoding="utf-8") as f:
    text = f.read()

# Fix SubjectRow
text = re.sub(
    r"(onSetSections=\{setSubjectSections\}\s*searchTerm=\{subjectSearch\})",
    r"\1\n\t\t\t\t\t\t\t\tgradeLevelFilter={gradeLevelFilter}\n\t\t\t\t\t\t\t\tsectionFilter={sectionFilter}",
    text
)

text = re.sub(
    r"(searchTerm = '',\s*sectionFilter = 'all',\s*)(}: SubjectRowProps) \{",
    r"\1gradeLevelFilter = 'all',\n\2 {",
    text
)

with open("D:\\ATLAS\\atlas-client\\src\\pages\\FacultyAssignments.tsx", "w", encoding="utf-8") as f:
    f.write(text)
