const fs = require('fs');
const code = fs.readFileSync('src/pages/FacultyAssignments.tsx', 'utf8');
const outerDivStart = code.indexOf('<div className="flex items-center gap-2 border-b border-border bg-muted/30 px-5 py-2">');
const cardContentIdx = code.indexOf('<CardContent', outerDivStart);
const toReplace = code.slice(outerDivStart, cardContentIdx);
console.log('END OF REPLACEMENT BLOCK:');
console.log(JSON.stringify(toReplace.slice(-120)));
