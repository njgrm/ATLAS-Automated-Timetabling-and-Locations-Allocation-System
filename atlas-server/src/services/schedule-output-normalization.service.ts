type SubjectDisplayInput = {
  code?: string | null;
  name?: string | null;
  modularGroupId?: string | null;
};

const EXPLICIT_CODE_LABELS: Record<string, string> = {
  STE_APPLIED_CHEM: 'APPLIED CHEMISTRY',
  STE_APPLIED_PHYS: 'APPLIED PHYSICS',
  STE_BIOTECH: 'BIOTECH',
  STE_ICT: 'ICT',
  STE_ENV_SCI: 'ENVIRONMENTAL SCIENCE',
  STE_ROBOTICS: 'ROBOTICS',
};

function normalizeToken(value?: string | null): string {
  return (value ?? '').trim().toUpperCase();
}

export function normalizeSubjectDisplayLabel(input: SubjectDisplayInput): string {
  const code = normalizeToken(input.code);
  const name = normalizeToken(input.name);
  const modularGroupId = normalizeToken(input.modularGroupId);

  if (code in EXPLICIT_CODE_LABELS) {
    return EXPLICIT_CODE_LABELS[code];
  }

  if (code === 'SPA_SPEC' || code === 'SPS_SPEC') {
    return 'SPECIALIZATION';
  }

  if (code === 'STE_RESEARCH' || code.startsWith('RESEARCH') || name.includes('RESEARCH')) {
    return 'RESEARCH';
  }

  if (modularGroupId === 'SCIENCE' || code.startsWith('SCI_')) {
    return 'SCIENCE';
  }

  if (modularGroupId === 'TLE_EXPLORATORY' || code === 'TLE' || code.startsWith('TLE_') || code.startsWith('TLE_SPEC_')) {
    return 'TLE';
  }

  if (code.length > 0) {
    return code;
  }

  if (name.length > 0) {
    return name;
  }

  return 'UNKNOWN SUBJECT';
}