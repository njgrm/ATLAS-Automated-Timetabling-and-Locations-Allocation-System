export type UpstreamProgramType =
	| 'REGULAR'
	| 'SCIENCE_TECHNOLOGY_AND_ENGINEERING'
	| 'SPECIAL_PROGRAM_IN_THE_ARTS'
	| 'SPECIAL_PROGRAM_IN_SPORTS'
	| 'SPECIAL_PROGRAM_IN_JOURNALISM'
	| 'SPECIAL_PROGRAM_IN_FOREIGN_LANGUAGE'
	| 'SPECIAL_PROGRAM_IN_TECHNICAL_VOCATIONAL_EDUCATION';

export interface RealisticTeacherSeed {
	sequence: number;
	employeeId: string;
	firstName: string;
	lastName: string;
	middleName: string | null;
	specialization: string | null;
	email: string;
	contactNumber: string;
	employmentStatus: 'PERMANENT' | 'PROBATIONARY';
	maxHoursPerWeek: number;
	canTeachOutsideDepartment: boolean;
}

export interface RealisticJhsDatasetOptions {
	/**
	 * Explicit non-JHS opt-in for deployments that still need MTB staffing.
	 * JHS runs must leave this disabled.
	 */
	includeNonJhsSpecializations?: boolean;
	/** @deprecated Use includeNonJhsSpecializations for explicit non-JHS opt-in. */
	includeMotherTongue?: boolean;
}

export interface RealisticSectionBlueprint {
	sequence: number;
	name: string;
	gradeLevelName: string;
	displayOrder: number;
	maxCapacity: number;
	enrolledCount: number;
	upstreamProgramType: UpstreamProgramType;
	programCode: string | null;
	programName: string | null;
	admissionMode: 'REGULAR' | 'COMPETITIVE' | null;
}

export interface RealisticGradeBlueprint {
	gradeLevelName: string;
	displayOrder: number;
	sections: RealisticSectionBlueprint[];
}

interface ProgramMetadata {
	upstreamProgramType: UpstreamProgramType;
	programCode: string | null;
	programName: string | null;
	admissionMode: 'REGULAR' | 'COMPETITIVE' | null;
}

const FILIPINO_SURNAMES = [
	'Santos', 'Reyes', 'Cruz', 'Garcia', 'Del Rosario', 'Ramos', 'Bautista',
	'Gonzales', 'Aquino', 'Fernandez', 'Mendoza', 'Torres', 'Villanueva', 'De Leon',
	'Manalo', 'Flores', 'Lopez', 'Castillo', 'Tan', 'Lim', 'Chua', 'Sy', 'Go',
	'Morales', 'Pascual', 'Navarro', 'Perez', 'Rivera', 'Mercado', 'Aguilar',
	'Tolentino', 'Magno', 'Diaz', 'Salazar', 'Ocampo', 'Francisco', 'Panganiban',
	'Delos Santos', 'De Guzman', 'Miranda', 'Guerrero', 'Valdez', 'Serrano',
];

const FILIPINO_FIRST_NAMES_F = [
	'Maria', 'Ana', 'Liza', 'Cristina', 'Rosa', 'Elena', 'Josefina', 'Teresa',
	'Carmen', 'Angela', 'Patricia', 'Jennifer', 'Michelle', 'Angelica', 'Grace',
	'Jasmine', 'Kathleen', 'Maricel', 'Rowena', 'Aileen', 'Glenda', 'Mildred',
];

const FILIPINO_FIRST_NAMES_M = [
	'Jose', 'Juan', 'Pedro', 'Antonio', 'Carlos', 'Manuel', 'Roberto', 'Francisco',
	'Ricardo', 'Eduardo', 'Fernando', 'Rafael', 'Miguel', 'Gabriel', 'Danilo',
	'Ernesto', 'Benjamin', 'Romeo', 'Rodolfo', 'Reynaldo', 'Armando', 'Rolando',
];

const CORE_DEPARTMENTS = [
	{ specialization: 'Filipino', count: 18 },
	{ specialization: 'English', count: 18 },
	{ specialization: 'Mathematics', count: 18 },
	{ specialization: 'Science', count: 18 },
	{ specialization: 'Araling Panlipunan', count: 16 },
	{ specialization: 'MAPEH', count: 16 },
	{ specialization: 'Edukasyon sa Pagpapakatao', count: 14 },
	{ specialization: 'Technology and Livelihood Education', count: 16 },
	{ specialization: 'Homeroom Guidance', count: 8 },
];

const OPTIONAL_DEPARTMENTS = [
	{ specialization: 'Mother Tongue-Based', count: 8 },
];

function getDepartments(options: RealisticJhsDatasetOptions = {}) {
	const includeNonJhsSpecializations = options.includeNonJhsSpecializations || options.includeMotherTongue;
	return includeNonJhsSpecializations
		? [...CORE_DEPARTMENTS, ...OPTIONAL_DEPARTMENTS]
		: CORE_DEPARTMENTS;
}

// ─── EnrollPro-aligned section naming (from seed-sections.ts) ───
const STARS = ['SIRIUS', 'VEGA', 'RIGEL', 'ARCTURUS', 'CAPELLA', 'CANOPUS', 'ALTAIR', 'PROCYON'];
const HEROES = [
	'JOSE RIZAL', 'ANDRES BONIFACIO', 'APOLINARIO MABINI', 'MARCELO DEL PILAR',
	'JUAN LUNA', 'EMILIO JACINTO', 'GABRIELA SILANG', 'EMILIO AGUINALDO',
	'GRACIANO LOPEZ JAENA', 'GREGORIO DEL PILAR', 'MELCHORA AQUINO', 'DIEGO SILANG',
	'FRANCISCO BALAGTAS', 'MARCIANA AGONCILLO', 'TERESA MAGBANUA', 'TRINIDAD TECSON',
];
const CORE_VALUES = [
	'MAKA-DIYOS', 'MAKATAO', 'MAKAKALIKASAN', 'MAKABANSA', 'KARANGALAN',
	'KATAPATAN', 'KATAPANGAN', 'KAGALINGAN', 'KAAYUSAN', 'KALAYAAN',
	'KATARUNGAN', 'KASIPAGAN', 'PAGKAKAISA', 'PAGMAMAHAL', 'PAGMALASAKIT',
	'PAGTITIPID', 'PAGKAMALIKHAIN',
];
const FLOWERS = [
	'SAMPAGUITA', 'GUMAMELA', 'ROSAS', 'ORCHID', 'SUNFLOWER', 'DAISY',
	'LILY', 'TULIP', 'JASMINE', 'HIBISCUS', 'ANTHURIUM', 'CATTLEYA',
];
const MINERALS = [
	'GOLD', 'SILVER', 'COPPER', 'IRON', 'NICKEL', 'CHROMITE',
	'QUARTZ', 'FELDSPAR', 'MICA', 'TALC', 'GYPSUM', 'CALCITE', 'APATITE',
];

const SECTION_NAMES_BY_GRADE: Array<{
	displayOrder: number;
	gradeLevelName: string;
	names: string[];
}> = [
	{
		displayOrder: 7,
		gradeLevelName: 'Grade 7',
		// 2 SCP sections (stars) + 5 numeric + 16 HEROES = 23 total
		names: [
			...STARS.slice(0, 2), // SIRIUS, VEGA
			'1', '2', '3', '4', '5',
			...HEROES,
		],
	},
	{
		displayOrder: 8,
		gradeLevelName: 'Grade 8',
		// 2 SCP sections (stars) + 5 numeric + 17 CORE_VALUES = 24 total
		names: [
			...STARS.slice(2, 4), // RIGEL, ARCTURUS
			'1', '2', '3', '4', '5',
			...CORE_VALUES,
		],
	},
	{
		displayOrder: 9,
		gradeLevelName: 'Grade 9',
		// 2 SCP sections (stars) + 5 numeric + 12 FLOWERS = 19 total
		names: [
			...STARS.slice(4, 6), // CAPELLA, CANOPUS
			'1', '2', '3', '4', '5',
			...FLOWERS,
		],
	},
	{
		displayOrder: 10,
		gradeLevelName: 'Grade 10',
		// 2 SCP sections (stars) + 5 numeric + 13 MINERALS = 20 total
		names: [
			...STARS.slice(6, 8), // ALTAIR, PROCYON
			'1', '2', '3', '4', '5',
			...MINERALS,
		],
	},
];

function toEmailSlug(value: string): string {
	return value.toLowerCase().replace(/[^a-z0-9]+/g, '');
}

// Determine program type based on section index (SCP sections are 0-1 per grade)
function getProgramMetadata(displayOrder: number, index: number): ProgramMetadata {
	// First star section is STE for all grades
	if (index === 0) {
		return {
			upstreamProgramType: 'SCIENCE_TECHNOLOGY_AND_ENGINEERING',
			programCode: 'STE',
			programName: 'Science, Technology, and Engineering',
			admissionMode: 'COMPETITIVE',
		};
	}

	// Second star section is SPS (Sports) for grades 9-10
	if (index === 1 && displayOrder >= 9) {
		return {
			upstreamProgramType: 'SPECIAL_PROGRAM_IN_SPORTS',
			programCode: 'SPS',
			programName: 'Special Program in Sports',
			admissionMode: 'COMPETITIVE',
		};
	}

	// For other grades, second star is regular
	if (index === 1 && displayOrder < 9) {
		return {
			upstreamProgramType: 'REGULAR',
			programCode: null,
			programName: null,
			admissionMode: 'REGULAR',
		};
	}

	return {
		upstreamProgramType: 'REGULAR',
		programCode: null,
		programName: null,
		admissionMode: 'REGULAR',
	};
}

export function buildRealisticGradeBlueprints(): RealisticGradeBlueprint[] {
	let sectionSequence = 0;

	return SECTION_NAMES_BY_GRADE.map((grade) => ({
		gradeLevelName: grade.gradeLevelName,
		displayOrder: grade.displayOrder,
		sections: grade.names.map((name, index) => {
			const program = getProgramMetadata(grade.displayOrder, index);
			sectionSequence += 1;

			return {
				sequence: sectionSequence,
				name: `${grade.displayOrder}-${name}`,
				gradeLevelName: grade.gradeLevelName,
				displayOrder: grade.displayOrder,
				maxCapacity: 45,
				enrolledCount: 36 + ((grade.displayOrder + index * 2) % 9),
				upstreamProgramType: program.upstreamProgramType,
				programCode: program.programCode,
				programName: program.programName,
				admissionMode: program.admissionMode,
			};
			}),
	}));
}

export function flattenRealisticSections(
	gradeBlueprints: RealisticGradeBlueprint[] = buildRealisticGradeBlueprints(),
): RealisticSectionBlueprint[] {
	return gradeBlueprints.flatMap((grade) => grade.sections);
}

export function buildRealisticTeacherSeeds(options: RealisticJhsDatasetOptions = {}): RealisticTeacherSeed[] {
	const teachers: RealisticTeacherSeed[] = [];
	let teacherSequence = 0;

	for (const department of getDepartments(options)) {
		for (let index = 0; index < department.count; index += 1) {
			const isFemale = teacherSequence % 5 !== 0 && teacherSequence % 7 !== 0;
			const firstName = isFemale
				? FILIPINO_FIRST_NAMES_F[(teacherSequence + index) % FILIPINO_FIRST_NAMES_F.length]
				: FILIPINO_FIRST_NAMES_M[(teacherSequence + index) % FILIPINO_FIRST_NAMES_M.length];
			const lastName = FILIPINO_SURNAMES[(teacherSequence + index * 3) % FILIPINO_SURNAMES.length];
			const sequence = teacherSequence + 1;

			teachers.push({
				sequence,
				employeeId: `ATLSRC-T${String(sequence).padStart(3, '0')}`,
				firstName,
				lastName,
				middleName: null,
				specialization: department.specialization,
				email: `${toEmailSlug(firstName)}.${toEmailSlug(lastName)}.${String(sequence).padStart(3, '0')}@enrollpro.local`,
				contactNumber: `0917${String(sequence).padStart(7, '0')}`,
				employmentStatus: teacherSequence % 11 === 0 ? 'PROBATIONARY' : 'PERMANENT',
				maxHoursPerWeek: teacherSequence % 12 === 0 ? 24 : 30,
				canTeachOutsideDepartment: teacherSequence % 9 === 0,
			});

			teacherSequence += 1;
		}
	}

	return teachers;
}

export const REALISTIC_SECTION_COUNT = flattenRealisticSections().length;
export const REALISTIC_TEACHER_COUNT = buildRealisticTeacherSeeds().length;