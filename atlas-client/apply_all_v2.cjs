const fs = require('fs');
const path = 'src/pages/FacultyAssignments.tsx';
let code = fs.readFileSync(path, 'utf8');

// ─── Change 1: Compact alert ribbons ────────────────────────────────────────
// The file uses CRLF (\r\n) and no leading tabs (mixed indentation from editor)
// Find and replace by scanning for unique substrings

// Alert 1: subjectsLackingFaculty big block
const lack1 = 'rounded-lg border border-red-200 bg-red-50 p-3 shadow-sm';
const pend1 = 'rounded-lg border border-sky-200 bg-sky-50 p-3 shadow-sm';

const idx1 = code.indexOf(lack1);
const idx2 = code.indexOf(pend1);

if (idx1 !== -1 && idx2 !== -1) {
    // Find start of the first block (after the preceding {subjectsLackingFaculty check)
    const blockStart = code.lastIndexOf('{subjectsLackingFaculty.length > 0', idx1);
    // Find end of the second block (closing </div>\n\t\t\t\t\t)}\n\n\t\t\t\t\t<Card)
    const cardStart = code.indexOf('<Card ', idx2);
    const blockEnd = code.lastIndexOf('\r\n', cardStart) + 2; // up to right before <Card

    const toReplace = code.slice(blockStart, blockEnd);

    const replacement = `{subjectsLackingFaculty.length > 0 && (
					<div className="mt-2 flex items-center gap-2 rounded border border-red-200 bg-red-50/60 px-3 py-1.5">
						<AlertTriangle className="size-3.5 shrink-0 text-red-600" />
						<span className="shrink-0 text-xs font-semibold text-red-700">{subjectsLackingFaculty.length} lacking faculty:</span>
						<div className="flex flex-1 items-center gap-1 overflow-x-auto">
							{subjectsLackingFaculty.map((s) => (
								<Badge key={s.id} variant="outline" className="shrink-0 border-red-300 bg-white px-1.5 py-0 text-[0.5625rem] text-red-700">{s.code}</Badge>
							))}
						</div>
					</div>
				)}

				{pendingEntries.length > 0 && (
					<div className="mt-1.5 flex items-center gap-2 rounded border border-sky-200 bg-sky-50/60 px-3 py-1.5">
						<Badge className="shrink-0 border-sky-300 bg-white text-[0.5625rem] text-sky-700">{pendingEntries.length} pending</Badge>
						<span className="shrink-0 text-xs font-semibold text-sky-800">Ownership transfers:</span>
						<div className="flex flex-1 items-center gap-1 overflow-x-auto">
							{pendingEntries.map((e) => (
								<Badge key={e.key} variant="outline" className="shrink-0 whitespace-nowrap border-sky-200 bg-white px-1.5 py-0 text-[0.5625rem] text-sky-800">
									{e.facultyName} | {e.subjectCode} | G{e.gradeLevel} {e.sectionName}
								</Badge>
							))}
						</div>
					</div>
				)}\r\n\r\n				`;

    code = code.slice(0, blockStart) + replacement + code.slice(blockEnd);
    console.log('✓ Change 1: Alert ribbons applied');
} else {
    console.log('✗ Change 1: Could not find alert blocks (idx1=' + idx1 + ', idx2=' + idx2 + ')');
}

// ─── Change 2: Omnisearch + section filter dropdown ─────────────────────────
// Replace the search input placeholder="Search subjects..." and its container
const searchTarget = 'placeholder="Search subjects..."';
const sidx = code.indexOf(searchTarget);
if (sidx !== -1) {
    // Find the wrapping div start (relative flex-1 max-w-xs)
    const divStart = code.lastIndexOf('<div className="relative flex-1 max-w-xs">', sidx);
    // Find the closing </div> of the ml-auto div which is what ends the search bar container
    // The container ends with </div>\r\n\t\t\t\t\t\t</div>\r\n\r\n\t\t\t\t\t\t<CardContent
    const cardContentIdx = code.indexOf('<CardContent ', sidx);
    const barEnd = code.lastIndexOf('\r\n', cardContentIdx) + 2;
    // But we only want to cut the toolbar div, not the CardContent line
    // Actually the search divs end just before CardContent, let's find the </div> that closes the toolbar
    const toolbarDiv = code.slice(divStart, cardContentIdx);
    const lastDivClose = toolbarDiv.lastIndexOf('</div>');
    const toolbarEnd = divStart + lastDivClose + 6; // 6 = length of '</div>'
    
    const toReplace = code.slice(divStart, toolbarEnd);
    
    const newToobar = `<div className="relative w-52 shrink-0">
						<Search className="absolute left-2.5 top-1/2 size-3 -translate-y-1/2 text-muted-foreground" />
						<Input
							placeholder="Search subjects or sections..."
							value={subjectSearch}
							onChange={(event) => setSubjectSearch(event.target.value)}
							className="h-7 pl-8 text-xs"
						/>
					</div>
					<Select value={sectionFilter} onValueChange={(v) => setSectionFilter(v as 'all' | 'unassigned' | 'assigned')}>
						<SelectTrigger className="h-7 w-36 text-xs">
							<SelectValue />
						</SelectTrigger>
						<SelectContent>
							<SelectItem value="all" className="text-xs">All Sections</SelectItem>
							<SelectItem value="unassigned" className="text-xs">Unassigned Only</SelectItem>
							<SelectItem value="assigned" className="text-xs">Assigned Only</SelectItem>
						</SelectContent>
					</Select>
					<div className="ml-auto flex items-center gap-2">
						<ShieldAlert className={\`size-3.5 \${allowOutsideDepartment ? 'text-amber-600' : 'text-muted-foreground'}\`} />
						<span className="text-[0.625rem] text-muted-foreground">Outside dept.</span>
						<Switch
							checked={allowOutsideDepartment}
							onCheckedChange={setAllowOutsideDepartment}
							aria-label="Allow outside department assignments"
						/>
					</div>`;
    
    code = code.slice(0, divStart) + newToobar + code.slice(toolbarEnd);
    console.log('✓ Change 2: Omnisearch + filter applied');
} else {
    console.log('✗ Change 2: Could not find search input');
}

// ─── Change 3: isOpen defaults to false ─────────────────────────────────────
const isOpenOld = 'const isOpen = openGrades[gradeLevel] ?? (searchTerm ? true : false);';
const isOpenNew = 'const isOpen = openGrades[gradeLevel] ?? (!!searchTerm);';
if (code.includes(isOpenOld)) {
    code = code.replace(isOpenOld, isOpenNew);
    console.log('✓ Change 3: isOpen defaulting correctly');
} else {
    // Try the original true default
    const isOpenOldOrig = 'const isOpen = openGrades[gradeLevel] ?? true;';
    if (code.includes(isOpenOldOrig)) {
        code = code.replace(isOpenOldOrig, 'const isOpen = openGrades[gradeLevel] ?? (!!searchTerm);');
        console.log('✓ Change 3: isOpen patched from original');
    } else {
        console.log('✗ Change 3: Could not find isOpen');
    }
}

// ─── Change 4: Grid layout for sections ─────────────────────────────────────
const gridOld = `{isOpen && (\r\n<div className="space-y-1 border-t border-border/70 px-3 py-2">`;
const gridNew = `{isOpen && (\r\n<div className="grid grid-cols-2 gap-1.5 border-t border-border/70 p-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">`;
if (code.includes(gridOld)) {
    code = code.replace(gridOld, gridNew);
    console.log('✓ Change 4: Grid layout applied');
} else {
    // Try without \r
    const gridOld2 = `{isOpen && (\n<div className="space-y-1 border-t border-border/70 px-3 py-2">`;
    if (code.includes(gridOld2)) {
        code = code.replace(gridOld2, `{isOpen && (\n<div className="grid grid-cols-2 gap-1.5 border-t border-border/70 p-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">`);
        console.log('✓ Change 4: Grid layout applied (LF variant)');
    } else {
        // Just do a regex
        const gridMatch = code.match(/\{isOpen && \(\s*<div className="space-y-1 border-t border-border\/70 px-3 py-2">/);
        if (gridMatch) {
            code = code.replace(gridMatch[0], `{isOpen && (\r\n<div className="grid grid-cols-2 gap-1.5 border-t border-border/70 p-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">`);
            console.log('✓ Change 4: Grid layout applied (regex)');
        } else {
            console.log('✗ Change 4: Could not find section grid container');
        }
    }
}

// ─── Change 5: Grade color badges on section tiles ───────────────────────────
// Replace tile className + internal structure
const tileClassOld = `flex items-center justify-between gap-3 rounded-md border px-2.5 py-2`;
const tileClassNew = `flex flex-col gap-1.5 rounded-md border p-2 transition-colors`;
if (code.includes(tileClassOld)) {
    code = code.replace(new RegExp(tileClassOld.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g'), tileClassNew);
    console.log('✓ Change 5a: Tile flex-col layout');
} else {
    console.log('✗ Change 5a: tile class not found');
}

// Update the blocked/selected conditional classes
const tileCondOld = `blocked ? 'border-red-200 bg-red-50/60' : isSelected ? 'border-primary/30 bg-primary/5' : 'border-border/70'`;
const tileCondNew = `blocked ? 'cursor-not-allowed border-red-200 bg-red-50/50 opacity-70' : isSelected ? 'border-primary/40 bg-primary/5 ring-1 ring-primary/20' : 'border-border/60 hover:bg-muted/30'`;
if (code.includes(tileCondOld)) {
    code = code.replace(tileCondOld, tileCondNew);
    console.log('✓ Change 5b: Tile state colors updated');
} else {
    console.log('✗ Change 5b: tile cond not found');
}

// Replace the checkbox + text group with grade-labeled version
const innerOld = `<div className="flex min-w-0 items-center gap-2">
<Checkbox checked={isSelected} onCheckedChange={() => toggleSection(section.id)} disabled={disabled || blocked} />
<div className="min-w-0">
<p className="truncate text-sm font-medium">{section.name}</p>
<p className="truncate text-[0.6875rem] text-muted-foreground">
G{section.displayOrder}{section.programCode && section.programCode !== 'REGULAR' ? \` | \${section.programCode}\` : ''}
</p>
</div>
</div>
<div className="flex items-center gap-1.5">`;

const innerNew = `<div className="flex items-start gap-1.5">
<Checkbox checked={isSelected} onCheckedChange={() => toggleSection(section.id)} disabled={disabled || blocked} className="mt-0.5 shrink-0" />
<div className="min-w-0 flex-1">
<span className={\`mb-0.5 inline-block rounded px-1 py-0 text-[0.5rem] font-bold uppercase leading-tight tracking-wider \${GRADE_COLORS[String(section.displayOrder)] ?? 'bg-muted text-muted-foreground'}\`}>
G{section.displayOrder}
</span>
<p className="truncate text-xs font-semibold leading-tight">{section.name}</p>
{section.programCode && section.programCode !== 'REGULAR' && (
<p className="truncate text-[0.6rem] text-muted-foreground">{section.programCode}</p>
)}
</div>
</div>
<div className="flex items-center gap-1.5 pl-5">`;

if (code.includes(innerOld)) {
    code = code.replace(innerOld, innerNew);
    console.log('✓ Change 5c: Grade badge inner applied');
} else {
    // Try normalized (collapse whitespace variants)
    const innerIdx = code.indexOf('flex min-w-0 items-center gap-2');
    if (innerIdx !== -1) {
        // Find start and end of this block roughly
        const chkStart = code.lastIndexOf('<div className="flex min-w-0', innerIdx);
        const afterGap15 = code.indexOf('<div className="flex items-center gap-1.5">', innerIdx);
        if (chkStart !== -1 && afterGap15 !== -1) {
            code = code.slice(0, chkStart) + innerNew + code.slice(afterGap15 + '<div className="flex items-center gap-1.5">'.length);
            console.log('✓ Change 5c: Grade badge inner applied (index mode)');
        } else {
            console.log('✗ Change 5c: Could not find inner tile block');
        }
    } else {
        console.log('✗ Change 5c: Could not find tile inner block at all');
    }
}

fs.writeFileSync(path, code, 'utf8');
console.log('\nDone. Run npm run build to verify.');
