import ExcelJS from 'exceljs';
import { Document, HeadingLevel, Packer, Paragraph, Table, TableCell, TableRow, WidthType } from 'docx';

function cellText(cell: ExcelJS.Cell): string {
	const value = cell.value;
	if (value == null) return '';
	if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') return String(value);
	const raw = value as any;
	if (Array.isArray(raw?.richText)) return raw.richText.map((part: { text?: string }) => part.text ?? '').join('');
	if (typeof raw?.text === 'string') return raw.text;
	return '';
}

/** Convert the already-authorized schedule workbook projection to a transient DOCX. */
export async function scheduleWorkbookToDocx(buffer: Buffer): Promise<Buffer> {
	const workbook = new ExcelJS.Workbook();
	await (workbook.xlsx as any).load(buffer);
	const children: Array<Paragraph | Table> = [];
	for (const sheet of workbook.worksheets) {
		if (children.length > 0) children.push(new Paragraph({ text: '' }));
		children.push(new Paragraph({ text: sheet.name, heading: HeadingLevel.HEADING_1 }));
		const rowCount = sheet.rowCount;
		const columnCount = sheet.columnCount;
		if (rowCount < 1 || columnCount < 1) continue;
		const rows: TableRow[] = [];
		for (let rowIndex = 1; rowIndex <= rowCount; rowIndex += 1) {
			const row = sheet.getRow(rowIndex);
			const cells: TableCell[] = [];
			for (let column = 1; column <= columnCount; column += 1) {
				const text = cellText(row.getCell(column));
				cells.push(new TableCell({
					children: [new Paragraph({ text, spacing: { after: 30 } })],
					width: { size: Math.floor(10000 / columnCount), type: WidthType.DXA },
				}));
			}
			rows.push(new TableRow({ children: cells }));
		}
		children.push(new Table({
			rows,
			width: { size: 100, type: WidthType.PERCENTAGE },
			columnWidths: Array.from({ length: columnCount }, () => Math.floor(100 / columnCount)),
		}));
	}
	if (children.length === 0) throw new Error('EMPTY_SCHEDULE_DOCUMENT');
	const doc = new Document({ sections: [{ children }] });
	return Buffer.from(await Packer.toBuffer(doc));
}
