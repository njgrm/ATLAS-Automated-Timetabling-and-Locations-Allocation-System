const fs = require('fs');
const code = fs.readFileSync('src/pages/FacultyAssignments.tsx', 'utf8');

const outerDivStart = code.indexOf('<div className="flex items-center gap-2 border-b border-border bg-muted/30 px-5 py-2">');
if (outerDivStart === -1) { console.log('not found'); process.exit(); }

const cardContentIdx = code.indexOf('<CardContent ', outerDivStart);
console.log('BEFORE CARDCONTENT:');
console.log(JSON.stringify(code.slice(cardContentIdx - 100, cardContentIdx + 20)));
