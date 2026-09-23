import test from 'node:test';
import assert from 'node:assert/strict';
import ExcelJS from 'exceljs';
import JSZip from 'jszip';
import { scheduleWorkbookToDocx } from '../services/schedule-workbook-docx.service.js';

test('schedule workbook DOCX conversion preserves printable grid text in a real DOCX table', async () => {
	const workbook = new ExcelJS.Workbook();
	const sheet = workbook.addWorksheet('Grade 7');
	sheet.addRow(['CLASS PROGRAM — Grade 7']);
	sheet.addRow(['GRADE 7 — SECTION: Rizal', 'MALE', 18, 'FEMALE', 17, 'TOTAL', 35]);
	sheet.addRow(['TIME', 'MINUTES', 'MONDAY', 'TUESDAY']);
	sheet.addRow(['6:00 AM-6:45 AM', 45, 'Mathematics', '']);
	sheet.addRow(['HEALTH BREAK', 15, 'HEALTH BREAK', 'HEALTH BREAK']);
	sheet.pageSetup = { orientation: 'landscape', fitToPage: true, fitToWidth: 1, fitToHeight: 0, paperSize: 9 };
	const xlsx = Buffer.from(await workbook.xlsx.writeBuffer());
	const docx = await scheduleWorkbookToDocx(xlsx);
	assert.ok(docx.length > 1000);
	assert.equal(docx.subarray(0, 2).toString('latin1'), 'PK');
	const archive = await JSZip.loadAsync(docx);
	const xml = await archive.file('word/document.xml')?.async('string');
	assert.ok(xml);
	for (const expected of ['Grade 7', 'Rizal', '18', '17', '35', 'HEALTH BREAK', 'Mathematics']) {
		assert.ok(xml!.includes(expected), `DOCX retains ${expected}`);
	}
	assert.match(xml!, /<w:tbl>/, 'DOCX contains a structural table');
});
