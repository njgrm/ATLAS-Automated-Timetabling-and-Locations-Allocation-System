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
    { specialization: 'MAPEH', count: 20 },
    { specialization: 'Edukasyon sa Pagpapakatao', count: 14 },
    { specialization: 'Technology and Livelihood Education', count: 16 },
    { specialization: 'Homeroom Guidance', count: 8 },
];
const OPTIONAL_DEPARTMENTS = [
    { specialization: 'Mother Tongue-Based', count: 8 },
];
function getDepartments(options = {}) {
    const includeNonJhsSpecializations = options.includeNonJhsSpecializations || options.includeMotherTongue;
    return includeNonJhsSpecializations
        ? [...CORE_DEPARTMENTS, ...OPTIONAL_DEPARTMENTS]
        : CORE_DEPARTMENTS;
}
const SECTION_NAMES_BY_GRADE = [
    {
        displayOrder: 7,
        gradeLevelName: 'Grade 7',
        names: [
            'Einstein', 'Curie', 'Newton', 'Galileo', 'Darwin', 'Mendel', 'Pasteur', 'Tesla',
            'Edison', 'Fermi', 'Hawking', 'Bohr', 'Archimedes', 'Pythagoras', 'Euclid', 'Pascal',
            'Kepler', 'Copernicus', 'Faraday', 'Lavoisier', 'Maxwell', 'Planck', 'Rutherford',
        ],
    },
    {
        displayOrder: 8,
        gradeLevelName: 'Grade 8',
        names: [
            'Rizal', 'Bonifacio', 'Mabini', 'Luna', 'Del Pilar', 'Aguinaldo', 'Jacinto',
            'Silang', 'Malvar', 'Tandang Sora', 'Plaridel', 'Jaena', 'Ponce', 'Paterno',
            'Legarda', 'Tavera', 'Buencamino', 'Araullo', 'Osmena', 'Quezon', 'Laurel',
        ],
    },
    {
        displayOrder: 9,
        gradeLevelName: 'Grade 9',
        names: [
            'Diamond', 'Ruby', 'Emerald', 'Sapphire', 'Pearl', 'Amethyst', 'Topaz', 'Opal',
            'Garnet', 'Jade', 'Onyx', 'Quartz', 'Turquoise', 'Coral', 'Amber', 'Jasper',
            'Obsidian', 'Citrine', 'Peridot',
        ],
    },
    {
        displayOrder: 10,
        gradeLevelName: 'Grade 10',
        names: [
            'Narra', 'Molave', 'Acacia', 'Mahogany', 'Kamagong', 'Ipil', 'Yakal', 'Tindalo',
            'Lauan', 'Apitong', 'Dao', 'Balayong', 'Bangkal', 'Almaciga', 'Pili', 'Anahaw',
            'Balete', 'Mango', 'Santol', 'Kaimito',
        ],
    },
];
function toEmailSlug(value) {
    return value.toLowerCase().replace(/[^a-z0-9]+/g, '');
}
function getProgramMetadata(displayOrder, index) {
    if (index === 0) {
        return {
            upstreamProgramType: 'SCIENCE_TECHNOLOGY_AND_ENGINEERING',
            programCode: 'STE',
            programName: 'Science, Technology, and Engineering',
            admissionMode: 'COMPETITIVE',
        };
    }
    if (displayOrder >= 9 && index === 1) {
        return {
            upstreamProgramType: 'SPECIAL_PROGRAM_IN_SPORTS',
            programCode: 'SPS',
            programName: 'Special Program in Sports',
            admissionMode: 'COMPETITIVE',
        };
    }
    if (displayOrder === 10 && index === 2) {
        return {
            upstreamProgramType: 'SPECIAL_PROGRAM_IN_THE_ARTS',
            programCode: 'SPA',
            programName: 'Special Program in the Arts',
            admissionMode: 'COMPETITIVE',
        };
    }
    return {
        upstreamProgramType: 'REGULAR',
        programCode: null,
        programName: null,
        admissionMode: 'REGULAR',
    };
}
export function buildRealisticGradeBlueprints() {
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
export function flattenRealisticSections(gradeBlueprints = buildRealisticGradeBlueprints()) {
    return gradeBlueprints.flatMap((grade) => grade.sections);
}
export function buildRealisticTeacherSeeds(options = {}) {
    const teachers = [];
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
//# sourceMappingURL=realistic-jhs-dataset.js.map