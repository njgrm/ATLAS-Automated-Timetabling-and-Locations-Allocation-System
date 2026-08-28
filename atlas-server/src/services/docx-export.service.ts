/**
 * Teacher Program DOCX Export Service
 *
 * Generates the official teacher-program Word document from ATLAS timetable data.
 * Uses the `docx` library for programmatic DOCX creation.
 */

import {
	Document,
	Packer,
	Paragraph,
	Table,
	TableRow,
	TableCell,
	WidthType,
	AlignmentType,
	HeadingLevel,
	BorderStyle,
	TextRun,
	TableLayoutType,
	VerticalAlign,
	ShadingType,
} from 'docx';
import type { TeacherProgramExportShape, TeacherProgramWorkloadRow } from './teacher-program-export.service.js';

// ─── Constants ───

const FONT_NAME = 'Arial Narrow';
const FONT_SIZE = 18; // half-points (9pt)

const BORDER_STYLE = {
	top: { style: BorderStyle.SINGLE, size: 1, color: '000000' },
	bottom: { style: BorderStyle.SINGLE, size: 1, color: '000000' },
	left: { style: BorderStyle.SINGLE, size: 1, color: '000000' },
	right: { style: BorderStyle.SINGLE, size: 1, color: '000000' },
};

const DAY_LABELS: Record<string, string> = {
	MONDAY: 'Monday',
	TUESDAY: 'Tuesday',
	WEDNESDAY: 'Wednesday',
	THURSDAY: 'Thursday',
	FRIDAY: 'Friday',
	WEEKLY: 'Weekly',
};

// ─── Helpers ───

function cell(text: string, options?: {
	width?: number;
	bold?: boolean;
	alignment?: (typeof AlignmentType)[keyof typeof AlignmentType];
	span?: number;
}): TableCell {
	return new TableCell({
		width: options?.width ? { size: options.width, type: WidthType.DXA } : undefined,
		children: [
			new Paragraph({
				children: [
					new TextRun({
						text,
						font: FONT_NAME,
						size: FONT_SIZE,
						bold: options?.bold,
					}),
				],
				alignment: options?.alignment ?? AlignmentType.LEFT,
			}),
		],
		borders: BORDER_STYLE,
		columnSpan: options?.span,
		verticalAlign: VerticalAlign.CENTER,
	});
}

function headerCell(text: string, width?: number): TableCell {
	return new TableCell({
		width: width ? { size: width, type: WidthType.DXA } : undefined,
		children: [
			new Paragraph({
				children: [
					new TextRun({
						text,
						font: FONT_NAME,
						size: FONT_SIZE,
						bold: true,
					}),
				],
				alignment: AlignmentType.CENTER,
			}),
		],
		borders: BORDER_STYLE,
		shading: { type: ShadingType.CLEAR, fill: 'D9E2F3' },
		verticalAlign: VerticalAlign.CENTER,
	});
}

// ─── Main Export Function ───

export async function generateTeacherProgramDocx(
	shape: TeacherProgramExportShape,
): Promise<Buffer> {
	const { teacher, schoolYear, rows, summary } = shape;

	// ─── Title Block ───
	const titleParagraphs = [
		new Paragraph({
			children: [
				new TextRun({
					text: "TEACHER'S PROGRAM",
					font: FONT_NAME,
					size: 28, // 14pt
					bold: true,
				}),
			],
			alignment: AlignmentType.CENTER,
			spacing: { after: 100 },
		}),
		new Paragraph({
			children: [
				new TextRun({
					text: `SY ${schoolYear.label}`,
					font: FONT_NAME,
					size: 24, // 12pt
					bold: true,
				}),
			],
			alignment: AlignmentType.CENTER,
			spacing: { after: 200 },
		}),
	];

	// ─── Schedule Table ───
	const scheduleHeaderRow = new TableRow({
		children: [
			headerCell('Time', 1500),
			headerCell('No. of min', 1000),
			headerCell('Subject', 2000),
			headerCell('Grade and section', 2000),
			headerCell('Day', 1200),
			headerCell('Bldg/Room #', 1500),
		],
		tableHeader: true,
	});

	// Separate daily schedule rows from weekly credited work rows
	const dailyRows = rows.filter(r => r.day !== 'WEEKLY');
	const weeklyRows = rows.filter(r => r.day === 'WEEKLY');

	const scheduleDataRows = dailyRows.map((row) => {
		const isBreak = row.kind === 'BREAK';
		const isSpecial = isBreak;

		return new TableRow({
			children: [
				cell(row.timeSlot || (isSpecial ? row.label : ''), {
					width: 1500,
					bold: isSpecial,
				}),
				cell(row.minutes > 0 ? String(row.minutes) : '', { width: 1000 }),
				cell(row.label, {
					width: 2000,
					bold: isSpecial,
				}),
				cell(row.gradeAndSection ?? '', { width: 2000 }),
				cell(DAY_LABELS[row.day] ?? row.day, { width: 1200 }),
				cell(row.room ?? '', { width: 1500 }),
			],
		});
	});

	// Weekly credited work section (ancillary + advisory)
	const creditedWorkHeaderRow = new TableRow({
		children: [
			headerCell('Credited Work', 1500),
			headerCell('Minutes/Week', 1000),
			headerCell('Type', 2000),
			headerCell('Details', 2000),
			headerCell('Frequency', 1200),
			headerCell('Source', 1500),
		],
		tableHeader: true,
	});

	const creditedWorkRows = weeklyRows.map((row) => new TableRow({
		children: [
			cell(row.label, { width: 1500, bold: true }),
			cell(String(row.minutes), { width: 1000 }),
			cell(row.kind, { width: 2000 }),
			cell(row.gradeAndSection ?? '', { width: 2000 }),
			cell('Weekly', { width: 1200 }),
			cell(row.source, { width: 1500 }),
		],
	}));

	const scheduleTable = new Table({
		rows: [scheduleHeaderRow, ...scheduleDataRows],
		width: {
			size: 100,
			type: WidthType.PERCENTAGE,
		},
		layout: TableLayoutType.FIXED,
	});

	const creditedWorkTable = weeklyRows.length > 0
		? new Table({
			rows: [creditedWorkHeaderRow, ...creditedWorkRows],
			width: { size: 100, type: WidthType.PERCENTAGE },
			layout: TableLayoutType.FIXED,
		})
		: null;

	// ─── Daily Total Minutes ───
	const dailyOrder = ['MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY'];
	const dailyTotalRows = dailyOrder.map((day) => {
		const total = summary.dailyTotals[day] ?? 0;
		return new TableRow({
			children: [
				cell(DAY_LABELS[day] ?? day, { width: 2000, bold: true }),
				cell(`${total} min`, { width: 2000 }),
			],
		});
	});

	const dailyTotalTable = new Table({
		rows: [
			new TableRow({
				children: [
					headerCell('Day', 2000),
					headerCell('Total Minutes', 2000),
				],
				tableHeader: true,
			}),
			...dailyTotalRows,
		],
		width: { size: 50, type: WidthType.PERCENTAGE },
		layout: TableLayoutType.FIXED,
	});

	// ─── Teaching Load Summary ───
	const formatMin = (min: number) => {
		const h = Math.floor(min / 60);
		const m = min % 60;
		return h > 0 ? `${h}h ${m}m` : `${m}m`;
	};

	const summaryRows = [
		['Class Advising Duty', formatMin(summary.advisoryMinutes), summary.advisorySectionLabel ?? ''],
		['Actual Teaching Load', formatMin(summary.actualTeachingMinutes), ''],
		['ARAL Program', formatMin(summary.aralMinutes), summary.aralSource === 'NOT_CONFIGURED' ? '(Not configured)' : ''],
		['Ancillary Work', formatMin(summary.ancillaryMinutes), summary.ancillaryLabels.join(', ') || ''],
		['Total Teaching Load', formatMin(summary.totalTeachingLoad), ''],
	];

	const summaryTable = new Table({
		rows: [
			new TableRow({
				children: [
					headerCell('Teaching Load Summary', 3000),
					headerCell('Duration', 2000),
					headerCell('Details', 2000),
				],
				tableHeader: true,
			}),
			...summaryRows.map(([label, duration, details]) =>
				new TableRow({
					children: [
						cell(label, { width: 3000, bold: label === 'Total Teaching Load' }),
						cell(duration, { width: 2000, bold: label === 'Total Teaching Load' }),
						cell(details, { width: 2000 }),
					],
				}),
			),
		],
		width: { size: 100, type: WidthType.PERCENTAGE },
		layout: TableLayoutType.FIXED,
	});

	// ─── Profile Block ───
	const profileTable = new Table({
		rows: [
			new TableRow({
				children: [
					cell('Name', { width: 2000, bold: true }),
					cell(teacher.fullName, { width: 5000 }),
				],
			}),
			new TableRow({
				children: [
					cell('Position', { width: 2000, bold: true }),
					cell(teacher.plantillaPosition ?? teacher.designationTitle ?? 'N/A', { width: 5000 }),
				],
			}),
			new TableRow({
				children: [
					cell("Bachelor's Degree", { width: 2000, bold: true }),
					cell(teacher.undergraduateDegree ?? 'N/A', { width: 5000 }),
				],
			}),
			new TableRow({
				children: [
					cell('Post Graduate Degree', { width: 2000, bold: true }),
					cell(teacher.postgraduateDegree ?? 'N/A', { width: 5000 }),
				],
			}),
		],
		width: { size: 100, type: WidthType.PERCENTAGE },
		layout: TableLayoutType.FIXED,
	});

	// ─── Signature Block ───
	const signatureRows = [
		['Teacher', teacher.fullName],
		['School Head', ''],
		['District Supervisor', ''],
		['CID Chief', ''],
		['ASDS', ''],
	];

	const signatureTable = new Table({
		rows: signatureRows.map(([role, name]) =>
			new TableRow({
				children: [
					cell(role, { width: 2500, bold: true }),
					cell(name || '________________________', { width: 3000 }),
					cell('________________________', { width: 2500 }),
				],
			}),
		),
		width: { size: 100, type: WidthType.PERCENTAGE },
		layout: TableLayoutType.FIXED,
	});

	// ─── Assemble Document ───
	const doc = new Document({
		sections: [
			{
				children: [
					...titleParagraphs,
					scheduleTable,
					...(creditedWorkTable ? [
						new Paragraph({ spacing: { before: 200 } }),
						new Paragraph({
							children: [
								new TextRun({
									text: 'CREDITED NON-TEACHING WORK',
									font: FONT_NAME,
									size: 20,
									bold: true,
								}),
							],
						}),
						creditedWorkTable,
					] : []),
					new Paragraph({ spacing: { before: 200 } }),
					dailyTotalTable,
					new Paragraph({ spacing: { before: 200 } }),
					summaryTable,
					new Paragraph({ spacing: { before: 300 } }),
					new Paragraph({
						children: [
							new TextRun({
								text: 'PROFILE',
								font: FONT_NAME,
								size: 24,
								bold: true,
							}),
						],
						heading: HeadingLevel.HEADING_2,
					}),
					profileTable,
					new Paragraph({ spacing: { before: 300 } }),
					new Paragraph({
						children: [
							new TextRun({
								text: 'SIGNATORIES',
								font: FONT_NAME,
								size: 24,
								bold: true,
							}),
						],
						heading: HeadingLevel.HEADING_2,
					}),
					signatureTable,
				],
			},
		],
	});

	const buffer = await Packer.toBuffer(doc);
	return Buffer.from(buffer);
}
