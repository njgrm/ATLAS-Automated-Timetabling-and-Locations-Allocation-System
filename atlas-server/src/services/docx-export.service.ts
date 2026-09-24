/**
 * Teacher Program DOCX Export Service
 *
 * BENEFICIARY-EXPORT-PARITY-C05R1 — reproduces the authoritative afternoon
 * teacher-program form: portrait print setup with a decorative page border,
 * DepEd/school identity header, centered government/region/division/district/
 * school/title/SY block, the exact six-column schedule table
 * (`Time | No. of min | Subject | Grade and section | Day | Bldg/Room #`),
 * full-width merged break bands, `Monday to Friday` compaction, the
 * teaching-load block (actual teaching + adviser credit only), the
 * photo/profile block, and the signature/approval hierarchy.
 *
 * The generic `CREDITED NON-TEACHING WORK`, `PROFILE`, and `SIGNATORIES`
 * report sections of the superseded builder are intentionally NOT emitted:
 * the reference expresses those elements through its compact form layout, and
 * ancillary work is an export-only projection with zero teaching-load effect.
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
	BorderStyle,
	TextRun,
	TableLayoutType,
	VerticalAlign,
	VerticalMergeType,
	ShadingType,
	Header,
	Footer,
	PageOrientation,
	PageBorderDisplay,
	PageBorderOffsetFrom,
} from 'docx';
import type { TeacherProgramExportShape } from './teacher-program-export.service.js';

// ─── Constants ───

const FONT_NAME = 'Arial Narrow';
const FONT_SIZE = 18; // half-points (9pt)
const SMALL_SIZE = 16; // 8pt
const TITLE_SIZE = 26; // 13pt
const SY_SIZE = 22; // 11pt

const COLUMN_WIDTHS = { time: 1400, minutes: 900, subject: 2400, gradeSection: 2200, day: 1300, room: 1500 } as const;

const BORDER_STYLE = {
	top: { style: BorderStyle.SINGLE, size: 1, color: '000000' },
	bottom: { style: BorderStyle.SINGLE, size: 1, color: '000000' },
	left: { style: BorderStyle.SINGLE, size: 1, color: '000000' },
	right: { style: BorderStyle.SINGLE, size: 1, color: '000000' },
};

const NO_BORDER = {
	top: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' },
	bottom: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' },
	left: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' },
	right: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' },
};

// ─── Cell helpers ───

type CellOptions = {
	width?: number;
	bold?: boolean;
	alignment?: (typeof AlignmentType)[keyof typeof AlignmentType];
	span?: number;
	rowSpan?: number;
	verticalMerge?: (typeof VerticalMergeType)[keyof typeof VerticalMergeType];
	shading?: string;
	borders?: typeof BORDER_STYLE;
	size?: number;
};

function run(text: string, options?: { bold?: boolean; size?: number; italics?: boolean; color?: string }): TextRun {
	return new TextRun({
		text,
		font: FONT_NAME,
		size: options?.size ?? FONT_SIZE,
		bold: options?.bold,
		italics: options?.italics,
		color: options?.color,
	});
}

function cell(text: string, options?: CellOptions): TableCell {
	const paragraphs = text.length > 0
		? [new Paragraph({
			children: [run(text, { bold: options?.bold, size: options?.size })],
			alignment: options?.alignment ?? AlignmentType.LEFT,
			spacing: { before: 0, after: 0 },
		})]
		: [new Paragraph({ children: [run('')], spacing: { before: 0, after: 0 } })];
	return new TableCell({
		width: options?.width ? { size: options.width, type: WidthType.DXA } : undefined,
		children: paragraphs,
		borders: options?.borders ?? BORDER_STYLE,
		columnSpan: options?.span,
		rowSpan: options?.rowSpan,
		verticalMerge: options?.verticalMerge,
		shading: options?.shading ? { type: ShadingType.CLEAR, fill: options.shading } : undefined,
		verticalAlign: VerticalAlign.CENTER,
	});
}

function headerCell(text: string, width: number): TableCell {
	return cell(text, {
		width,
		bold: true,
		alignment: AlignmentType.CENTER,
		shading: 'D9E2F3',
	});
}

/**
 * A full-width merged break band: the configured break/event label spans
 * Subject..Bldg/Room # while the time and duration stay in their columns.
 */
function mergedBandRow(label: string, timeSlot: string, minutes: number): TableRow {
	return new TableRow({
		children: [
			cell(timeSlot, { width: COLUMN_WIDTHS.time, bold: true }),
			cell(minutes > 0 ? String(minutes) : '', { width: COLUMN_WIDTHS.minutes }),
			cell(label, { width: COLUMN_WIDTHS.subject + COLUMN_WIDTHS.gradeSection + COLUMN_WIDTHS.day + COLUMN_WIDTHS.room, bold: true, span: 4 }),
		],
	});
}

// ─── Main Export Function ───

export async function generateTeacherProgramDocx(
	shape: TeacherProgramExportShape,
): Promise<Buffer> {
	const { teacher, schoolYear, branding, term, publication, notes, signatories, rows, summary } = shape;

	const identityLines = [
		'Republic of the Philippines',
		signatories.headerLine || 'Department of Education',
		branding.regionLine,
		branding.divisionLine,
		branding.districtLine,
		branding.schoolName,
	].filter((line) => line.length > 0);

	// ─── Header (repeats on continuation pages) ───
	const headerIdentity = new Table({
		rows: [new TableRow({
			children: [
				new TableCell({
					width: { size: 1100, type: WidthType.DXA },
					borders: BORDER_STYLE,
					children: [
						new Paragraph({ children: [run('LOGO', { bold: true, size: SMALL_SIZE })], alignment: AlignmentType.CENTER }),
						new Paragraph({ children: [run('DepEd', { size: SMALL_SIZE })], alignment: AlignmentType.CENTER }),
					],
				}),
				new TableCell({
					width: { size: 7200, type: WidthType.DXA },
					borders: NO_BORDER,
					children: identityLines.map((line) => new Paragraph({
						children: [run(line, { bold: line === identityLines[identityLines.length - 1] })],
						alignment: AlignmentType.CENTER,
						spacing: { before: 0, after: 0 },
					})),
				}),
				new TableCell({
					width: { size: 1100, type: WidthType.DXA },
					borders: BORDER_STYLE,
					children: [
						new Paragraph({ children: [run('LOGO', { bold: true, size: SMALL_SIZE })], alignment: AlignmentType.CENTER }),
						new Paragraph({ children: [run('School', { size: SMALL_SIZE })], alignment: AlignmentType.CENTER }),
					],
				}),
			],
		})],
		width: { size: 100, type: WidthType.PERCENTAGE },
		layout: TableLayoutType.FIXED,
	});

	// ─── Title Block ───
	const publicationText = publication.isPublished
		? `PUBLISHED${publication.revisionId != null ? ` — Revision ${publication.revisionId}` : ''}${publication.publishedAt ? ` (${publication.publishedAt.slice(0, 10)})` : ''}`
		: 'NOT PUBLISHED — DRAFT/REVIEW';

	const titleBlock: Paragraph[] = [
		new Paragraph({
			children: [run("TEACHER'S PROGRAM", { bold: true, size: TITLE_SIZE })],
			alignment: AlignmentType.CENTER,
			spacing: { before: 0, after: 40 },
		}),
		new Paragraph({
			children: [run(term.label ? `SY ${schoolYear.label} — ${term.label}` : `SY ${schoolYear.label}`, { bold: true, size: SY_SIZE })],
			alignment: AlignmentType.CENTER,
			spacing: { before: 0, after: 40 },
		}),
		new Paragraph({
			children: [run(publicationText, {
				bold: true,
				size: SMALL_SIZE,
				color: publication.isPublished ? '1F7A1F' : 'B00020',
			})],
			alignment: AlignmentType.CENTER,
			spacing: { before: 0, after: 80 },
		}),
	];

	// ─── Schedule Table ───
	const scheduleHeaderRow = new TableRow({
		children: [
			headerCell('Time', COLUMN_WIDTHS.time),
			headerCell('No. of min', COLUMN_WIDTHS.minutes),
			headerCell('Subject', COLUMN_WIDTHS.subject),
			headerCell('Grade and section', COLUMN_WIDTHS.gradeSection),
			headerCell('Day', COLUMN_WIDTHS.day),
			headerCell('Bldg/Room #', COLUMN_WIDTHS.room),
		],
		tableHeader: true,
	});

	const scheduleDataRows = rows.map((row) => {
		if (row.isEvent && row.kind === 'BREAK') {
			return mergedBandRow(row.label, row.timeSlot, row.minutes);
		}
		return new TableRow({
			children: [
				cell(row.timeSlot, { width: COLUMN_WIDTHS.time }),
				cell(row.minutes > 0 ? String(row.minutes) : '', { width: COLUMN_WIDTHS.minutes, alignment: AlignmentType.CENTER }),
				cell(row.label, { width: COLUMN_WIDTHS.subject, bold: row.kind === 'ANCILLARY' }),
				cell(row.gradeAndSection ?? '', { width: COLUMN_WIDTHS.gradeSection }),
				cell(row.dayLabel, { width: COLUMN_WIDTHS.day }),
				cell(row.room ?? '', { width: COLUMN_WIDTHS.room }),
			],
		});
	});

	// ─── Total minutes per day + load block (same table, template layout) ───
	const weekdayTeachingTotal = summary.perDayTeachingMinutes;
	const totalMinutesRow = new TableRow({
		children: [
			cell('Total minutes per day', { width: COLUMN_WIDTHS.time, bold: true }),
			cell('', { width: COLUMN_WIDTHS.minutes }),
			cell(`${weekdayTeachingTotal} mins. (Monday-Friday)`, { width: COLUMN_WIDTHS.subject + COLUMN_WIDTHS.gradeSection, span: 2, alignment: AlignmentType.CENTER }),
			cell(
				notes.hgpPeaceIncluded ? '45 mins Inclusive of HGP/PEACE Campaign (Monday)' : '',
				{ width: COLUMN_WIDTHS.day + COLUMN_WIDTHS.room, span: 2, alignment: AlignmentType.CENTER, size: SMALL_SIZE },
			),
		],
	});

	const minutesLabel = (value: number) => `${Math.max(0, Math.round(value))} mins`;
	const loadRows: TableRow[] = [
		new TableRow({
			children: [
				cell('Total Teaching Load', { width: COLUMN_WIDTHS.time, bold: true, verticalMerge: VerticalMergeType.RESTART }),
				cell('Class Advising Duty', { width: COLUMN_WIDTHS.minutes + COLUMN_WIDTHS.subject, span: 2 }),
				cell(minutesLabel(summary.advisoryMinutes), { width: COLUMN_WIDTHS.gradeSection + COLUMN_WIDTHS.day + COLUMN_WIDTHS.room, span: 3 }),
			],
		}),
		new TableRow({
			children: [
				cell('', { width: COLUMN_WIDTHS.time, verticalMerge: VerticalMergeType.CONTINUE }),
				cell('Actual Teaching Load', { width: COLUMN_WIDTHS.minutes + COLUMN_WIDTHS.subject, span: 2 }),
				cell(minutesLabel(summary.perDayTeachingMinutes), { width: COLUMN_WIDTHS.gradeSection + COLUMN_WIDTHS.day + COLUMN_WIDTHS.room, span: 3 }),
			],
		}),
		new TableRow({
			children: [
				cell('', { width: COLUMN_WIDTHS.time, verticalMerge: VerticalMergeType.CONTINUE }),
				cell('Total Teaching Load', { width: COLUMN_WIDTHS.minutes + COLUMN_WIDTHS.subject, span: 2, bold: true }),
				cell(minutesLabel(summary.perDayTotalTeachingLoad), { width: COLUMN_WIDTHS.gradeSection + COLUMN_WIDTHS.day + COLUMN_WIDTHS.room, span: 3, bold: true }),
			],
		}),
	];

	const scheduleTable = new Table({
		rows: [scheduleHeaderRow, ...scheduleDataRows, totalMinutesRow, ...loadRows],
		width: { size: 100, type: WidthType.PERCENTAGE },
		layout: TableLayoutType.FIXED,
	});

	// ─── Photo + profile block ───
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
		width: { size: 1700, type: WidthType.DXA },
		rowSpan: 4,
		borders: BORDER_STYLE,
		verticalAlign: VerticalAlign.CENTER,
		children: avatar
			? [new Paragraph({
				children: [new ImageRun({
					type: avatar.type,
					data: Buffer.from(avatar.base64, 'base64'),
					transformation: { width: 90, height: 110 },
				})],
				alignment: AlignmentType.CENTER,
			})]
			: [
				new Paragraph({ children: [run('Picture', { bold: true, size: SMALL_SIZE })], alignment: AlignmentType.CENTER }),
				new Paragraph({ children: [run('(2 x 2)', { size: SMALL_SIZE })], alignment: AlignmentType.CENTER }),
			],
	});

	function profileLineRow(label: string, value: string | null, leadingCell?: TableCell): TableRow {
		const children: TableCell[] = [];
		if (leadingCell) children.push(leadingCell);
		children.push(
			new TableCell({
				width: { size: 2200, type: WidthType.DXA },
				borders: NO_BORDER,
				children: [new Paragraph({ children: [run(label, { bold: true })], spacing: { before: 0, after: 0 } })],
			}),
			new TableCell({
				width: { size: 5400, type: WidthType.DXA },
				borders: { ...NO_BORDER, bottom: { style: BorderStyle.SINGLE, size: 1, color: '000000' } },
				children: [new Paragraph({ children: [run(value && value.trim().length > 0 ? value : '')], spacing: { before: 0, after: 0 } })],
			}),
		);
		return new TableRow({ children });
	}

	const profileTable = new Table({
		rows: [
			profileLineRow('Name:', teacher.fullName || null, photoCell),
			profileLineRow('Position:', teacher.plantillaPosition ?? teacher.designationTitle ?? null),
			profileLineRow("Bachelor's Degree:", teacher.undergraduateDegree ?? null),
			profileLineRow('Post Graduate Degree:', teacher.postgraduateDegree ?? null),
		],
		width: { size: 100, type: WidthType.PERCENTAGE },
		layout: TableLayoutType.FIXED,
	});

	// ─── Signature hierarchy (reference roles and order) ───
	function signatoryBlock(name: string | null, roleTitle: string): TableCell {
		return new TableCell({
			width: { size: 4680, type: WidthType.DXA },
			borders: NO_BORDER,
			children: [
				new Paragraph({ children: [run(name && name.trim().length > 0 ? name : '________________________', { bold: true })], alignment: AlignmentType.CENTER, spacing: { before: 120, after: 0 } }),
				new Paragraph({ children: [run(roleTitle, { size: SMALL_SIZE })], alignment: AlignmentType.CENTER, spacing: { before: 0, after: 0 } }),
			],
		});
	}

	function signatureLabel(label: string): Paragraph {
		return new Paragraph({ children: [run(label, { bold: true })], spacing: { before: 160, after: 0 } });
	}

	function signatureRow(cells: TableCell[]): Table {
		return new Table({
			rows: [new TableRow({ children: cells })],
			width: { size: 100, type: WidthType.PERCENTAGE },
			layout: TableLayoutType.FIXED,
		});
	}

	const signatureRegion = [
		signatureLabel('Checked by:'),
		signatureRow([
			signatoryBlock(teacher.fullName || null, 'Teacher'),
			signatoryBlock(signatories.schoolHead.name, signatories.schoolHead.title),
		]),
		signatureLabel('Noted:'),
		signatureRow([signatoryBlock(signatories.psds.name, signatories.psds.title)]),
		signatureLabel('Recommending Approval:'),
		signatureRow([signatoryBlock(signatories.cidChief.name, signatories.cidChief.title)]),
		signatureLabel('Approved:'),
		signatureRow([signatoryBlock(signatories.asds.name, signatories.asds.title)]),
	];

	// ─── Footer (configured treatment only) ───
	const footerText = (signatories.footerText ?? '').trim();
	const footer = footerText.length > 0
		? new Footer({
			children: [new Paragraph({
				children: [run(footerText, { italics: true, size: SMALL_SIZE })],
				alignment: AlignmentType.CENTER,
				spacing: { before: 0, after: 0 },
			})],
		})
		: undefined;

	const header = new Header({ children: [headerIdentity] });

	// ─── Assemble Document ───
	const doc = new Document({
		sections: [
			{
				properties: {
					page: {
						size: { orientation: PageOrientation.PORTRAIT },
						margin: { top: 720, right: 720, bottom: 720, left: 720, header: 360, footer: 360 },
						borders: {
							pageBorders: { display: PageBorderDisplay.ALL_PAGES, offsetFrom: PageBorderOffsetFrom.TEXT },
							pageBorderTop: { style: BorderStyle.SINGLE, size: 8, color: '1F3864' },
							pageBorderRight: { style: BorderStyle.SINGLE, size: 8, color: '1F3864' },
							pageBorderBottom: { style: BorderStyle.SINGLE, size: 8, color: '1F3864' },
							pageBorderLeft: { style: BorderStyle.SINGLE, size: 8, color: '1F3864' },
						},
					},
				},
				headers: { default: header },
				footers: footer ? { default: footer } : undefined,
				children: [
					...titleBlock,
					scheduleTable,
					new Paragraph({ spacing: { before: 200, after: 0 } }),
					profileTable,
					...signatureRegion,
				],
			},
		],
	});

	const buffer = await Packer.toBuffer(doc);
	return Buffer.from(buffer);
}
