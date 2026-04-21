const fs = require('fs');
const path = 'src/pages/FacultyAssignments.tsx';
let code = fs.readFileSync(path, 'utf8');

// 1. Add formatOwnerName
const anchor = 'type SubjectRowProps = {';
const newHelper = `const formatOwnerName = (name?: string) => {
	if (!name) return '';
	const lastName = name.split(',')[0].trim();
	return lastName.charAt(0).toUpperCase() + lastName.slice(1).toLowerCase();
};

type SubjectRowProps = {`;
if (code.includes(anchor) && !code.includes('const formatOwnerName')) {
    code = code.replace(anchor, newHelper);
    console.log('✓ Added formatOwnerName');
}

// 2. Fix the tile rendering structure
const tileOld = `const badgeLabel = isPendingOther
? \`Pending: \${pendingOwner?.facultyName}\`
: isSavedOther
? \`Saved: \${savedOwner?.facultyName}\`
: isPendingCurrent
? 'Pending'
: isSavedCurrent
? 'Saved'
: null;
return (
<div
key={section.id}
className={\`flex flex-col gap-1.5 rounded-md border p-2 transition-colors \${
blocked ? 'cursor-not-allowed border-red-300 bg-red-50/50 opacity-70' : isSelected ? 'border-primary/40 bg-primary/5 ring-1 ring-primary/20' : gradeStyle.card
}\`}
>
<div className="flex items-start gap-1.5">
<Checkbox checked={isSelected} onCheckedChange={() => toggleSection(section.id)} disabled={disabled || blocked} className="mt-0.5 shrink-0" />
<div className="min-w-0 flex-1">
<div className="flex items-center gap-1">
<p className="truncate text-xs font-semibold leading-tight">{section.name}</p>
{advisedSectionId && section.id === advisedSectionId && (
<Badge className="shrink-0 gap-0.5 border-amber-300 bg-amber-50 px-1 py-0 text-[0.5rem] text-amber-700 flex items-center">
<Star className="size-2.5 fill-amber-500 text-amber-500" />Advisory
</Badge>
)}
</div>
{section.programCode && section.programCode !== 'REGULAR' && (
<p className="truncate text-[0.6rem] text-muted-foreground">{section.programCode}</p>
)}
</div>
</div>
<div className="flex items-center gap-1.5 pl-5">
{badgeLabel && (
<Tooltip>
<TooltipTrigger asChild>
<Badge
variant="outline"
className={\`text-[0.5625rem] \${
isPendingOther
? 'border-red-200 text-red-700'
: isSavedOther
? 'border-amber-200 text-amber-700'
: isPendingCurrent
? 'border-sky-200 text-sky-700'
: 'border-emerald-200 text-emerald-700'
}\`}
>
{badgeLabel}
</Badge>
</TooltipTrigger>
<TooltipContent side="top" className="max-w-xs text-xs">
{isPendingOther && <p>{pendingOwner?.facultyName} has this subject-section pair in an unsaved session draft.</p>}
{isSavedOther && <p>{savedOwner?.facultyName} already owns this subject-section pair in saved data.</p>}
{isPendingCurrent && <p>This selection is pending in the current session and has not been saved yet.</p>}
{isSavedCurrent && !isPendingCurrent && <p>This subject-section pair is already saved for the selected teacher.</p>}
</TooltipContent>
</Tooltip>
)}
</div>
</div>
);`;

// To ensure a safe match regardless of line ending or exact spacing, let's normalize everything
function normalize(str) {
    return str.replace(/\\s+/g, ' ').trim();
}

const normalizedOld = normalize(tileOld);
const codeNormalized = normalize(code);

if (codeNormalized.includes(normalizedOld)) {
    // Instead of string match, use a regex to replace from 'const badgeLabel' to the end of the return statement
    const regex = /const badgeLabel = isPendingOther[\s\S]*?<\/div>\s*<\/div>\s*\);\s*\}\)/;
    
    const tileNew = `const badgeLabel = isPendingOther
\t\t\t\t\t\t\t\t\t\t? \`Pending: \${formatOwnerName(pendingOwner?.facultyName)}\`
\t\t\t\t\t\t\t\t\t\t: isSavedOther
\t\t\t\t\t\t\t\t\t\t? \`Saved: \${formatOwnerName(savedOwner?.facultyName)}\`
\t\t\t\t\t\t\t\t\t\t: isPendingCurrent
\t\t\t\t\t\t\t\t\t\t? 'Pending'
\t\t\t\t\t\t\t\t\t\t: isSavedCurrent
\t\t\t\t\t\t\t\t\t\t? 'Saved'
\t\t\t\t\t\t\t\t\t\t: null;
\t\t\t\t\t\t\t\t\treturn (
\t\t\t\t\t\t\t\t\t\t<div
\t\t\t\t\t\t\t\t\t\t\tkey={section.id}
\t\t\t\t\t\t\t\t\t\t\tclassName={\`flex flex-col gap-1.5 rounded-md border p-2 transition-colors \${
\t\t\t\t\t\t\t\t\t\t\t\tblocked ? 'cursor-not-allowed border-red-300 bg-red-50/50 opacity-70' : isSelected ? 'border-primary/40 bg-primary/5 ring-1 ring-primary/20' : gradeStyle.card
\t\t\t\t\t\t\t\t\t\t\t}\`}
\t\t\t\t\t\t\t\t\t\t>
\t\t\t\t\t\t\t\t\t\t\t<div className="flex items-start gap-1.5">
\t\t\t\t\t\t\t\t\t\t\t\t<Checkbox checked={isSelected} onCheckedChange={() => toggleSection(section.id)} disabled={disabled || blocked} className="mt-0.5 shrink-0" />
\t\t\t\t\t\t\t\t\t\t\t\t<div className="min-w-0 flex-1 flex flex-col gap-1">
\t\t\t\t\t\t\t\t\t\t\t\t\t<div className="min-w-0">
\t\t\t\t\t\t\t\t\t\t\t\t\t\t<p className="text-[0.6875rem] font-semibold leading-tight break-words">{section.name}</p>
\t\t\t\t\t\t\t\t\t\t\t\t\t\t{section.programCode && section.programCode !== 'REGULAR' && (
\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t<p className="text-[0.5625rem] text-muted-foreground break-words mt-[2px]">{section.programCode}</p>
\t\t\t\t\t\t\t\t\t\t\t\t\t\t)}
\t\t\t\t\t\t\t\t\t\t\t\t\t</div>
\t\t\t\t\t\t\t\t\t\t\t\t\t
\t\t\t\t\t\t\t\t\t\t\t\t\t{(advisedSectionId === section.id || badgeLabel) && (
\t\t\t\t\t\t\t\t\t\t\t\t\t\t<div className="flex flex-wrap items-center gap-1 mt-0.5">
\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t{advisedSectionId === section.id && (
\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t<Badge className="shrink-0 gap-0.5 border-amber-300 bg-amber-50 px-1 py-0 text-[0.5rem] tracking-tight text-amber-700 flex items-center">
\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t<Star className="size-2 fill-amber-500 text-amber-500" />Advisory
\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t</Badge>
\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t)}
\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t
\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t{badgeLabel && (
\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t<Tooltip>
\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t<TooltipTrigger asChild>
\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t<Badge
\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\tvariant="outline"
\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\tclassName={\`px-1 py-0 text-[0.5rem] tracking-tight leading-tight block w-fit max-w-full truncate \${
\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\tisPendingOther
\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t? 'border-red-200 bg-white/50 text-red-700'
\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t: isSavedOther
\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t? 'border-amber-200 bg-white/50 text-amber-700'
\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t: isPendingCurrent
\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t? 'border-sky-200 bg-white/50 text-sky-700'
\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t: 'border-emerald-200 bg-white/50 text-emerald-700'
\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t}\`}
\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t>
\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t{badgeLabel}
\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t</Badge>
\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t</TooltipTrigger>
\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t<TooltipContent side="top" className="max-w-xs text-xs">
\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t{isPendingOther && <p>{pendingOwner?.facultyName} has this subject-section pair in an unsaved session draft.</p>}
\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t{isSavedOther && <p>{savedOwner?.facultyName} already owns this subject-section pair in saved data.</p>}
\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t{isPendingCurrent && <p>This selection is pending in the current session and has not been saved yet.</p>}
\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t{isSavedCurrent && !isPendingCurrent && <p>This subject-section pair is already saved for the selected teacher.</p>}
\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t</TooltipContent>
\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t</Tooltip>
\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t)}
\t\t\t\t\t\t\t\t\t\t\t\t\t\t</div>
\t\t\t\t\t\t\t\t\t\t\t\t\t)}
\t\t\t\t\t\t\t\t\t\t\t\t</div>
\t\t\t\t\t\t\t\t\t\t\t</div>
\t\t\t\t\t\t\t\t\t\t</div>
\t\t\t\t\t\t\t\t\t);
\t\t\t\t\t\t\t\t})`;
    
    code = code.replace(regex, tileNew);
    console.log('✓ Restructured tile');
} else {
    console.log('✗ Tile structure not found');
}

fs.writeFileSync(path, code, 'utf8');
