// DEDUP ONLY - all other changes already applied
const fs = require('fs');
const path = 'd:/ATLAS/atlas-client/src/pages/Subjects.tsx';
let src = fs.readFileSync(path, 'utf8');

const hasCRLF = src.includes('\r\n');
if (hasCRLF) src = src.replace(/\r\n/g, '\n');

let changes = 0;

// 1. archiveTarget state
if (!src.includes('archiveTarget, setArchiveTarget')) {
  const old1 = '\tconst [deleteTarget, setDeleteTarget] = useState<Subject | null>(null);\n\tconst [archivingLoading, setArchivingLoading] = useState(false);';
  const new1 = '\tconst [deleteTarget, setDeleteTarget] = useState<Subject | null>(null);\n\tconst [archiveTarget, setArchiveTarget] = useState<Subject | null>(null);\n\tconst [archivingLoading, setArchivingLoading] = useState(false);';
  if (!src.includes(old1)) { console.error('MISS 1'); } else { src = src.replace(old1, new1); changes++; console.log('OK 1'); }
} else { console.log('SKIP 1: already present'); }

// 2. patch handleArchiveSubject to clear archiveTarget before fetchSubjects
const archiveCatchMarker = "} catch (err: any) {\n\t\t\ttoast.error(err?.response?.data?.message ?? 'Failed to archive subject.');";
const fetchMarker = '\t\t\tawait fetchSubjects();\n\t\t' + archiveCatchMarker;
if (!src.includes('setArchiveTarget(null);\n\t\t\tawait fetchSubjects()')) {
  if (!src.includes(fetchMarker)) { console.error('MISS 2'); } else {
    src = src.replace(fetchMarker, '\t\t\tsetArchiveTarget(null);\n\t\t\tawait fetchSubjects();\n\t\t' + archiveCatchMarker);
    changes++; console.log('OK 2');
  }
} else { console.log('SKIP 2: already patched'); }

// Restore CRLF
if (hasCRLF) src = src.replace(/\n/g, '\r\n');
fs.writeFileSync(path, src, 'utf8');
console.log('total changes:', changes);
const upd = fs.readFileSync(path, 'utf8');
console.log('archiveTarget state:', upd.includes('archiveTarget, setArchiveTarget'));
console.log('setArchiveTarget(null) in handler:', upd.includes('setArchiveTarget(null)'));
console.log('ConfirmationModal in JSX:', (upd.match(/ConfirmationModal/g) || []).length);
console.log('archiveTarget in JSX:', (upd.match(/archiveTarget/g) || []).length);

// 1. Add ConfirmationModal import after Card import
src = src.replace(
  "import { Card } from '@/ui/card';",
  "import { Card } from '@/ui/card';\nimport { ConfirmationModal } from '@/ui/confirmation-modal';"
);

// 2. Add archiveTarget state after deleteTarget
const stateOld = "\tconst [deleteTarget, setDeleteTarget] = useState<Subject | null>(null);\n\tconst [archivingLoading, setArchivingLoading] = useState(false);";
const stateNew = "\tconst [deleteTarget, setDeleteTarget] = useState<Subject | null>(null);\n\tconst [archiveTarget, setArchiveTarget] = useState<Subject | null>(null);\n\tconst [archivingLoading, setArchivingLoading] = useState(false);";
if (!src.includes(stateOld)) { console.error('MISS: stateOld not found'); } else { src = src.replace(stateOld, stateNew); }

// 3. Patch handleArchiveSubject to call setArchiveTarget(null)
const archOld = "\t\t\tawait fetchSubjects();\n\t\t} catch (err: any) {\n\t\t\ttoast.error(err?.response?.data?.message ?? 'Failed to archive subject.');";
const archNew = "\t\t\tsetArchiveTarget(null);\n\t\t\tawait fetchSubjects();\n\t\t} catch (err: any) {\n\t\t\ttoast.error(err?.response?.data?.message ?? 'Failed to archive subject.');";
if (!src.includes(archOld)) { console.error('MISS: archOld not found'); } else { src = src.replace(archOld, archNew); }

// 4. Change onArchive prop to setArchiveTarget
const propOld = "onArchive={(target) => handleArchiveSubject(target)}";
const propNew = "onArchive={(target) => setArchiveTarget(target)}";
if (!src.includes(propOld)) { console.error('MISS: propOld not found'); } else { src = src.replace(propOld, propNew); }

// 5. Add archive ConfirmationModal before DeleteSubjectDialog
const dialogOld = "\t\t\t<DeleteSubjectDialog";
const dialogNew = `\t\t\t<ConfirmationModal
\t\t\t\topen={!!archiveTarget}
\t\t\t\ttitle="Archive Subject"
\t\t\t\tdescription={archiveTarget ? \`Archive "\${archiveTarget.name}"? It will be hidden from new assignments but historical data is preserved.\` : ''}
\t\t\t\tconfirmText="Archive"
\t\t\t\tvariant="warning"
\t\t\t\tloading={archivingLoading}
\t\t\t\tonConfirm={() => archiveTarget && handleArchiveSubject(archiveTarget)}
\t\t\t\tonCancel={() => setArchiveTarget(null)}
\t\t\t/>

\t\t\t<DeleteSubjectDialog`;
if (!src.includes(dialogOld)) { console.error('MISS: dialogOld not found'); } else { src = src.replace(dialogOld, dialogNew); }

fs.writeFileSync(path, src, 'utf8');
const updated = fs.readFileSync(path, 'utf8');
console.log('archiveTarget:', (updated.match(/archiveTarget/g) || []).length);
console.log('ConfirmationModal:', (updated.match(/ConfirmationModal/g) || []).length);
console.log('handleArchiveSubject:', (updated.match(/handleArchiveSubject/g) || []).length);
console.log('setArchiveTarget:', (updated.match(/setArchiveTarget/g) || []).length);
