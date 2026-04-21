import re

with open("D:\\ATLAS\\atlas-client\\src\\pages\\FacultyAssignments.tsx", "r", encoding="utf-8") as f:
    text = f.read()

# Fix Star import
if "Star" not in text[:500]:
    text = re.sub(
        r"(UserCog,\n)",
        r"\1Star,\n",
        text
    )

# Clean up duplication in SubjectRow component calls
text = re.sub(r'sectionFilter=\{sectionFilter\}\s+sectionFilter=\{sectionFilter\}', r'sectionFilter={sectionFilter}', text)
text = re.sub(r'gradeLevelFilter=\{gradeLevelFilter\}\s+gradeLevelFilter=\{gradeLevelFilter\}', r'gradeLevelFilter={gradeLevelFilter}', text)

# Ensure advisedSectionId is correctly specified in SubjectRowProps
props_block_pat = re.compile(r'type SubjectRowProps = \{.*?\};', re.DOTALL)
props_match = props_block_pat.search(text)
if props_match:
    props_str = props_match.group(0)
    # clean out any gradeLevelFilter and advisedSectionId lines
    props_str = re.sub(r'\s*gradeLevelFilter\?\: string;', '', props_str)
    props_str = re.sub(r'\s*advisedSectionId\?\: number \| null;', '', props_str)
    # insert them right before };
    props_str = props_str.replace('};', '\tgradeLevelFilter?: string;\n\tadvisedSectionId?: number | null;\n};')
    text = text.replace(props_match.group(0), props_str)

# Ensure arguments are in SubjectRow function properly
text = re.sub(
    r"(searchTerm = '',\s+sectionFilter = 'all',(?:\s+gradeLevelFilter = 'all',)?(?:\s+advisedSectionId = null,)?)\s+}: SubjectRowProps",
    r"searchTerm = '',\n\tsectionFilter = 'all',\n\tgradeLevelFilter = 'all',\n\tadvisedSectionId = null,\n}: SubjectRowProps",
    text
)

# Remove the duplicate getGradeColors block completely, keep the upper one
old_dup = """if (groupedSections.length === 0 && (searchTerm || sectionFilter !== 'all' || gradeLevelFilter !== 'all')) {
    return null;
}

const getGradeColors = (grade: number) => {
        switch (grade) {
                case 7: return { container: 'border-green-200 bg-green-50/30', card: 'border-green-200 bg-green-50', text: 'text-green-700' };
                case 8: return { container: 'border-yellow-200 bg-yellow-50/30', card: 'border-yellow-200 bg-yellow-50', text: 'text-yellow-700' };
                case 9: return { container: 'border-red-200 bg-red-50/30', card: 'border-red-200 bg-red-50', text: 'text-red-700' };
                case 10: return { container: 'border-blue-200 bg-blue-50/30', card: 'border-blue-200 bg-blue-50', text: 'text-blue-700' };
                default: return { container: 'border-border/70 bg-background', card: 'border-border/60 hover:bg-muted/30', text: 'text-muted-foreground' };
        }
};"""
text = text.replace(old_dup, "")

with open("D:\\ATLAS\\atlas-client\\src\\pages\\FacultyAssignments.tsx", "w", encoding="utf-8") as f:
    f.write(text)
