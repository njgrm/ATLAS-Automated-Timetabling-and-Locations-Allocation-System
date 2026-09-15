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
	ImageRun,
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
import {
	sortTeacherProgramWorkloadRows,
	type TeacherProgramExportShape,
	type TeacherProgramWorkloadRow,
} from './teacher-program-export.service.js';

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

const WEEKDAY_ORDER = ['MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY'];

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
	const { teacher, schoolYear, branding, term, publication, notes, rows, summary } = shape;

	// C05 T10/M23 — explicit publication state from persisted run data.
	const publicationText = publication.isPublished
		? `PUBLISHED${publication.revisionId != null ? ` — Revision ${publication.revisionId}` : ''}${publication.publishedAt ? ` (${publication.publishedAt.slice(0, 10)})` : ''}`
		: 'NOT PUBLISHED — DRAFT/REVIEW';

	function brandingLine(text: string): Paragraph {
		return new Paragraph({
			children: [
				new TextRun({ text: text.length > 0 ? text : ' ', font: FONT_NAME, size: FONT_SIZE }),
			],
			alignment: AlignmentType.CENTER,
			spacing: { after: 20 },
		});
	}

	// C05 T6 — configurable branding block. Unset address lines render as
	// blank-line placeholders; school identity is never invented.
	const brandingParagraphs = [
		brandingLine(branding.schoolName),
		brandingLine(branding.regionLine || '________________________'),
		brandingLine(branding.divisionLine || '________________________'),
		brandingLine(branding.districtLine || '________________________'),
	];

	// ─── Title Block ───
	const titleParagraphs = [
		...brandingParagraphs,
		new Paragraph({
			children: [
				new TextRun({
					text: publicationText,
					font: FONT_NAME,
					size: 20, // 10pt
					bold: true,
					color: publication.isPublished ? '1F7A1F' : 'B00020',
				}),
			],
			alignment: AlignmentType.CENTER,
			spacing: { after: 120 },
		}),
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
					text: term.label ? `SY ${schoolYear.label} — ${term.label}` : `SY ${schoolYear.label}`,
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

	// Weekday compaction: group identical teaching rows by timeSlot/label/gradeAndSection/room
	// and render as "Monday to Friday" when all 5 weekdays are covered
	function compactDayLabel(days: string[]): string {
		const sorted = [...days].sort((a, b) => WEEKDAY_ORDER.indexOf(a) - WEEKDAY_ORDER.indexOf(b));
		if (sorted.length === 5 && sorted.every((d, i) => d === WEEKDAY_ORDER[i])) {
			return 'Monday to Friday';
		}
		return sorted.map(d => DAY_LABELS[d] ?? d).join(', ');
	}

	// Build compaction groups for teaching rows only
	const teachingGroups = new Map<string, { row: typeof dailyRows[0]; days: string[] }>();
	const breakRows: typeof dailyRows = [];
	for (const row of dailyRows) {
		if (row.kind === 'TEACHING') {
			const key = [row.timeSlot, row.minutes, row.label, row.gradeAndSection ?? '', row.room ?? ''].join('|||');
			const existing = teachingGroups.get(key);
			if (existing) {
				existing.days.push(row.day);
			} else {
				teachingGroups.set(key, { row, days: [row.day] });
			}
		} else {
			breakRows.push(row);
		}
	}

	// Build compacted teaching rows
	const compactedTeaching = [...teachingGroups.values()].map(({ row, days }) => ({
		...row,
		_dayLabel: compactDayLabel(days),
	})).sort((a, b) => {
		const dayDiff = WEEKDAY_ORDER.indexOf(a.day) - WEEKDAY_ORDER.indexOf(b.day);
		if (dayDiff !== 0) return dayDiff;
		return a.timeSlot.localeCompare(b.timeSlot);
	});

	// Merge compacted teaching + breaks, sorted by original day order
	// Reuse the production workload ordering so the printable artifact keeps
	// numeric chronological order for formatted 12-hour labels (e.g. 7:30 AM
	// before 1:00 PM). A lexical timeSlot sort would invert those rows.
	const compactedAll = sortTeacherProgramWorkloadRows([...compactedTeaching, ...breakRows]);

	const scheduleDataRows = compactedAll.map((row) => {
		const isBreak = row.kind === 'BREAK';
		const isSpecial = isBreak;
		const dayLabel = ('_dayLabel' in row) ? (row as { _dayLabel: string })._dayLabel : (DAY_LABELS[row.day] ?? row.day);

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
				cell(dayLabel, { width: 1200 }),
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

	// C05 T6 — daily-total annotation convention: the reference documents state
	// a single Monday–Friday total, with the HGP/PEACE note only when policy
	// defines that window.
	const weekdayTotal = dailyOrder.reduce((total, day) => total + (summary.dailyTotals[day] ?? 0), 0);
	const hasAnyDaily = dailyOrder.some((day) => (summary.dailyTotals[day] ?? 0) > 0);
	const dailyTotalNote = new Paragraph({
		children: [
			new TextRun({
				text: hasAnyDaily
					? `${weekdayTotal} mins. (Monday–Friday)${notes.hgpPeaceIncluded ? ' — Inclusive of HGP/PEACE Campaign (Monday)' : ''}`
					: '',
				font: FONT_NAME,
				size: FONT_SIZE,
				italics: true,
			}),
		],
		spacing: { before: 80 },
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

	// ─── Photo Placeholder ───
	// C05 T6 — embed only when an existing faculty image value is a usable inline
	// data URL. No schema change and no network fetch; otherwise a bordered
	// placeholder box is rendered.
	function avatarDataUrl(value: string | null): { base64: string; type: 'png' | 'jpg' | 'gif' | 'bmp' } | null {
		if (!value) return null;
		const match = value.match(/^data:image\/(png|jpe?g|gif|bmp);base64,(.+)$/is);
		if (!match) return null;
		const extension = match[1].toLowerCase();
		const type = extension === 'jpeg' || extension === 'jpg' ? 'jpg' : extension;
		return { base64: match[2].replace(/\s+/g, ''), type: type as 'png' | 'jpg' | 'gif' | 'bmp' };
	}
	const avatar = avatarDataUrl(teacher.avatarUrl);
	const photoCell = new TableCell({
		width: { size: 1900, type: WidthType.DXA },
		borders: BORDER_STYLE,
		verticalAlign: VerticalAlign.CENTER,
		children: avatar
			? [new Paragraph({
				children: [new ImageRun({
					type: avatar.type,
					data: Buffer.from(avatar.base64, 'base64'),
					transformation: { width: 95, height: 115 },
				})],
				alignment: AlignmentType.CENTER,
			})]
			: [
				new Paragraph({
					children: [new TextRun({ text: 'PHOTO', font: FONT_NAME, size: FONT_SIZE, bold: true })],
					alignment: AlignmentType.CENTER,
				}),
				new Paragraph({
					children: [new TextRun({ text: '(2 x 2)', font: FONT_NAME, size: FONT_SIZE })],
					alignment: AlignmentType.CENTER,
				}),
			],
	});
	const photoTable = new Table({
		rows: [new TableRow({ children: [photoCell] })],
		width: { size: 18, type: WidthType.PERCENTAGE },
		layout: TableLayoutType.FIXED,
	});

	// ─── Signature Block ───
	const signatureRows = [
		['Noted:', 'School Head', ''],
		['Recommending Approval:', 'District Supervisor', ''],
		['', 'CID Chief', ''],
		['', 'ASDS', ''],
	];

	const signatureTable = new Table({
		rows: signatureRows.map(([action, role, name]) =>
			new TableRow({
				children: [
					cell(action, { width: 2000, bold: !!action }),
					cell(role, { width: 2000, bold: true }),
					cell(name || '________________________', { width: 2500 }),
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
					dailyTotalNote,
					new Paragraph({ spacing: { before: 200 } }),
					summaryTable,
					new Paragraph({ spacing: { before: 300 } }),
					photoTable,
					new Paragraph({ spacing: { before: 200 } }),
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
