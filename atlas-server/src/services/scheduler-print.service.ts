import archiver from 'archiver';
import { exportGradeClassProgramDocx, exportRoomProgramDocx, exportSectionProgramDocx, getOfficialPrintOptions } from './official-program-docx.service.js';
import type { ExportOptions } from './workbook-export.service.js';
import { buildTeacherProgramExportShape } from './teacher-program-export.service.js';
import { generateTeacherProgramDocx } from './docx-export.service.js';

export type SchedulerPrintProgram = 'grade' | 'section' | 'teacher' | 'room';
export type SchedulerPrintFile = { filename: string; content: Buffer };

export async function renderSchedulerPrintFiles(
	options: ExportOptions,
	program: SchedulerPrintProgram,
	requestedIds: number[],
): Promise<SchedulerPrintFile[]> {
	const available = await getOfficialPrintOptions(options);
	const choices = program === 'grade' ? available.grades
		: program === 'section' ? available.sections
			: program === 'teacher' ? available.teachers : available.rooms;
	const requestedSet = new Set(requestedIds);
	if (requestedSet.size !== requestedIds.length) throw new Error('DUPLICATE_PRINT_ENTITY');
	const missing = requestedIds.find((id) => !choices.some((choice) => choice.value === id));
	if (missing !== undefined) throw new Error('PRINT_ENTITY_NOT_FOUND');
	if (requestedIds.length === 0) throw new Error('PRINT_ENTITY_REQUIRED');

	// Every requested entity is checked against the same school, run, and term
	// before any document is rendered or handed to the ZIP writer.
	const yearToken = (available.yearLabel || 'UNLABELED').replace(/[^a-zA-Z0-9-]/g, '');
	const render = async (id: number): Promise<SchedulerPrintFile> => {
		let content: Buffer;
		let identity: string;
		switch (program) {
			case 'grade':
				content = await exportGradeClassProgramDocx({ ...options, gradeLevel: id });
				identity = `G${id}`;
				break;
			case 'section':
				content = await exportSectionProgramDocx({ ...options, sectionId: id });
				identity = String(id);
				break;
			case 'teacher': {
				const shape = await buildTeacherProgramExportShape({
					schoolId: options.schoolId, schoolYearId: options.schoolYearId, runId: options.runId,
					facultyId: id, termIndex: options.termIndex,
				});
				content = await generateTeacherProgramDocx(shape);
				identity = String(id);
				break;
			}
			case 'room':
				content = await exportRoomProgramDocx({ ...options, roomId: id });
				identity = String(id);
				break;
		}
		return { filename: `${program}-program-${identity}-SY${yearToken}-term${options.termIndex}.docx`, content };
	};

	return Promise.all(requestedIds.map(render));
}

export async function createSchedulerPrintZip(files: SchedulerPrintFile[]): Promise<Buffer> {
	if (files.length < 2) throw new Error('PRINT_ZIP_REQUIRES_MULTIPLE_FILES');
	const archive = archiver('zip', { zlib: { level: 9 } });
	const chunks: Buffer[] = [];
	let rejectArchive!: (error: Error) => void;
	const finished = new Promise<void>((resolve, reject) => {
		rejectArchive = reject;
		archive.on('data', (chunk: Buffer | Uint8Array) => chunks.push(Buffer.from(chunk)));
		archive.once('end', resolve);
		archive.once('error', reject);
		archive.once('warning', reject);
	});
	for (const file of files) archive.append(file.content, { name: file.filename });
	try {
		await archive.finalize();
		await finished;
	} catch (error) {
		rejectArchive(error instanceof Error ? error : new Error('ZIP_CREATION_FAILED'));
		throw error;
	}
	return Buffer.concat(chunks);
}
