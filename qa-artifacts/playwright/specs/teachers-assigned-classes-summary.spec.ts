import { expect, test, type Page } from '@playwright/test';

import { assertNoGlobalOverflow, loginAdmin } from './timetable-layout-helpers';

const ROUTE = '/teachers';

async function openTeachers(page: Page) {
	await page.goto(ROUTE, { waitUntil: 'domcontentloaded', timeout: 60_000 });
	await page.waitForLoadState('networkidle', { timeout: 10_000 }).catch(() => null);
	await page.waitForTimeout(1000);
}

test.describe('Teachers assigned classes summary', () => {
	test.beforeEach(async ({ page }) => {
		await loginAdmin(page);
		await openTeachers(page);
	});

	test('assigned classes cell does not show only generic aggregate text', async ({ page }) => {
		const rows = await page.locator('[data-admin-table-view="desktop"] table tbody tr').all();
		expect(rows.length, 'Expected at least one teacher row').toBeGreaterThan(0);

		for (let i = 0; i < Math.min(rows.length, 5); i++) {
			const text = await rows[i].innerText();
			// Skip rows that have no classes assigned (they should show "No classes assigned")
			if (text.includes('No classes assigned')) continue;

			// Fail if the cell matches only the generic pattern "N subject(s) · N section(s)"
			const genericMatch = text.match(/^\d+ subjects? \u00B7 \d+ sections?$/);
			expect(
				genericMatch,
				`Row ${i}: assigned classes should not be generic aggregate "${text.slice(0, 60)}"`,
			).toBeNull();
		}
	});

	test('assigned classes cell includes subject code for assigned teachers', async ({ page }) => {
		const rows = await page.locator('[data-admin-table-view="desktop"] table tbody tr').all();
		expect(rows.length, 'Expected at least one teacher row').toBeGreaterThan(0);

		let foundSubjectCode = false;
		for (let i = 0; i < Math.min(rows.length, 10); i++) {
			const text = await rows[i].innerText();
			// Look for subject code patterns: uppercase letters + optional digits + middle dot or section count
			if (/\b[A-Z]{2,}[_A-Z0-9]*\b/.test(text) && /section/i.test(text)) {
				foundSubjectCode = true;
				break;
			}
		}
		expect(foundSubjectCode, 'At least one teacher row should show a subject code (e.g., FIL, MATH, SCI_BIO)').toBeTruthy();
	});

	test('no raw IDs appear in the assigned classes cell', async ({ page }) => {
		const rows = await page.locator('[data-admin-table-view="desktop"] table tbody tr').all();
		for (let i = 0; i < Math.min(rows.length, 5); i++) {
			const cells = await rows[i].locator('td').allTextContents();
			// The assigned classes cell is the 4th cell (index 3)
			if (cells.length >= 4) {
				const assignedText = cells[3];
				// Should not contain raw numeric IDs like "12345" as the primary content
				expect(
					assignedText.match(/^\d+$/),
					`Row ${i}: assigned classes should not be a raw numeric ID "${assignedText.slice(0, 30)}"`,
				).toBeNull();
			}
		}
	});

	test('assigned classes cells must not contain literal \\u00B7 or invalid grade labels', async ({ page }) => {
		const vp = page.viewportSize();
		if (vp && vp.width < 768) {
			test.skip(true, 'Desktop table not visible on mobile');
			return;
		}

		const rows = await page.locator('[data-admin-table-view="desktop"] table tbody tr').all();
		for (let i = 0; i < Math.min(rows.length, 10); i++) {
			const cells = await rows[i].locator('td').allTextContents();
			if (cells.length >= 4) {
				const text = cells[3];
				// Must not contain literal Unicode escape text
				expect(text, `Row ${i}: must not contain literal \\u00B7`).not.toContain('\\u00B7');
				// Must not contain invalid grade labels (GR17, GR18, GR19, GR20, etc.)
				const badGrades = text.match(/GR(1[1-9]|[2-9]\d)/g);
				expect(badGrades, `Row ${i}: must not contain invalid grade labels: ${JSON.stringify(badGrades)}`).toBeNull();
			}
		}
	});

	test('grade labels in assigned classes must match valid JHS range', async ({ page }) => {
		const vp = page.viewportSize();
		if (vp && vp.width < 768) {
			test.skip(true, 'Desktop table not visible on mobile');
			return;
		}

		const rows = await page.locator('[data-admin-table-view="desktop"] table tbody tr').all();
		for (let i = 0; i < Math.min(rows.length, 10); i++) {
			const cells = await rows[i].locator('td').allTextContents();
			if (cells.length >= 4) {
				const text = cells[3];
				// Find all GR labels — each must be GR7, GR8, GR9, or GR10
				const gradeLabels = text.match(/\bGR\d+\b/g) ?? [];
				for (const label of gradeLabels) {
					expect(
						/^GR(7|8|9|10)$/.test(label),
						`Row ${i}: grade label "${label}" is not a valid JHS grade (expected GR7, GR8, GR9, or GR10)`,
					).toBeTruthy();
				}
			}
		}
	});

	test('assigned classes cells must not contain First: and must use Sections: for section preview', async ({ page }) => {
		const vp = page.viewportSize();
		if (vp && vp.width < 768) {
			test.skip(true, 'Desktop table not visible on mobile');
			return;
		}

		const rows = await page.locator('[data-admin-table-view="desktop"] table tbody tr').all();
		for (let i = 0; i < Math.min(rows.length, 10); i++) {
			const cells = await rows[i].locator('td').allTextContents();
			if (cells.length >= 4) {
				const text = cells[3];
				// Must not contain "First:"
				expect(text, `Row ${i}: assigned classes must not contain "First:"`).not.toMatch(/First:/);
				// If GR grade labels are present, "Sections:" should appear as the section preview prefix
				if (/\bGR(7|8|9|10)\b/.test(text)) {
					expect(text, `Row ${i}: section preview should use "Sections:" not "First:"`).toMatch(/Sections:/);
				}
			}
		}
	});

	test('popover shows full breakdown when clicked', async ({ page }) => {
		// Find an info popover trigger in the assigned classes column
		const popoverTrigger = page.locator('button[aria-label="View class breakdown"]').first();
		const isVisible = await popoverTrigger.isVisible({ timeout: 3000 }).catch(() => false);

		if (!isVisible) {
			// No assigned classes with breakdown — skip
			return;
		}

		await popoverTrigger.click();

		// Popover should appear with "Assigned classes" heading
		const popover = page.locator('[role="dialog"], [data-radix-popover-content]');
		await expect(popover.first()).toBeVisible({ timeout: 3000 });
		await expect(popover.first()).toContainText('Assigned classes');
	});

	test('no header/cell count mismatch', async ({ page }) => {
		const vp = page.viewportSize();
		if (vp && vp.width < 768) {
			test.skip(true, 'Desktop table not visible on mobile');
			return;
		}
		const headerCount = await page.locator('[data-admin-table-view="desktop"] table thead th').count();
		const firstRow = page.locator('[data-admin-table-view="desktop"] table tbody tr').first();
		await expect(firstRow).toBeVisible({ timeout: 10_000 });
		const cellCount = await firstRow.locator('td').count();
		expect(cellCount, `Header count ${headerCount} should match cell count ${cellCount}`).toBe(headerCount);
	});

	test('no global scrollbar or horizontal overflow', async ({ page }) => {
		await assertNoGlobalOverflow(page);
	});

	test('mobile card mode still works', async ({ page }) => {
		await page.setViewportSize({ width: 390, height: 844 });
		await page.waitForTimeout(500);

		const card = page.locator('[data-testid="teacher-mobile-card"]').first();
		await expect(card).toBeVisible({ timeout: 10_000 });
	});

	test('teachers with different section assignments show different visible labels', async ({ page }) => {
		const vp = page.viewportSize();
		if (vp && vp.width < 768) {
			test.skip(true, 'Desktop table not visible on mobile');
			return;
		}

		// Intercept the faculty-assignments/summary API to capture assignment data
		type AssignmentEntry = { subjectId: number; subjectCode: string; sectionIds: number[] };
		type FacultyResponse = { id: number; assignments: AssignmentEntry[] }[];
		const capturedFaculty: FacultyResponse = [];

		await page.route('**/faculty-assignments/summary*', async (route) => {
			const response = await route.fetch();
			const json = await response.json().catch(() => null);
			if (json?.faculty) {
				for (const f of json.faculty) {
					capturedFaculty.push({
						id: f.id,
						assignments: (f.assignments ?? []).map((a: any) => ({
							subjectId: a.subjectId,
							subjectCode: a.subject?.code ?? '',
							sectionIds: (a.sectionIds ?? []).sort(),
						})),
					});
				}
			}
			await route.fulfill({ response });
		});

		// Reload to capture fresh data
		await page.reload({ waitUntil: 'networkidle' });
		await page.waitForTimeout(1000);

		// Build fingerprints from API data
		const fingerprints = new Map<number, string>();
		for (const f of capturedFaculty) {
			const parts = f.assignments
				.filter((a) => a.sectionIds.length > 0)
				.map((a) => `${a.subjectCode}:${a.sectionIds.join(',')}`)
				.sort();
			fingerprints.set(f.id, parts.join('|'));
		}

		// Extract visible labels from the table
		const rows = await page.locator('[data-admin-table-view="desktop"] table tbody tr').all();
		expect(rows.length, 'Expected at least one teacher row').toBeGreaterThan(0);

		const visibleLabels: string[] = [];
		for (let i = 0; i < Math.min(rows.length, 15); i++) {
			const cells = await rows[i].locator('td').allTextContents();
			if (cells.length >= 4) {
				visibleLabels.push(cells[3].replace(/\s+/g, ' ').trim());
			}
		}

		// Check: if two visible labels are identical, their fingerprints must also be identical
		const labelToFingerprints = new Map<string, Set<string>>();
		for (let i = 0; i < visibleLabels.length; i++) {
			const label = visibleLabels[i];
			if (!label || label === 'No classes assigned') continue;

			// Get the corresponding faculty fingerprint
			const fp = [...fingerprints.values()][i] ?? '';
			if (!fp) continue;

			if (!labelToFingerprints.has(label)) {
				labelToFingerprints.set(label, new Set());
			}
			labelToFingerprints.get(label)!.add(fp);
		}

		for (const [label, fps] of labelToFingerprints) {
			expect(
				fps.size,
				`Visible label "${label.slice(0, 50)}" is shared by teachers with ${fps.size} different assignment fingerprints — the cell must be more specific`,
			).toBe(1);
		}
	});

	test('assigned classes cell includes at least one section name or grade label', async ({ page }) => {
		const vp = page.viewportSize();
		if (vp && vp.width < 768) {
			test.skip(true, 'Desktop table not visible on mobile');
			return;
		}

		const rows = await page.locator('[data-admin-table-view="desktop"] table tbody tr').all();
		expect(rows.length, 'Expected at least one teacher row').toBeGreaterThan(0);

		let foundSectionDetail = false;
		for (let i = 0; i < Math.min(rows.length, 10); i++) {
			const text = await rows[i].innerText();
			if (text.includes('No classes assigned')) continue;
			// Look for grade labels (GR7, GR8, etc.) or section names (word patterns after GR)
			if (/GR\d/.test(text) || /\d+ section/.test(text)) {
				foundSectionDetail = true;
				break;
			}
		}
		expect(foundSectionDetail, 'At least one assigned teacher row should include grade labels (GR7, GR8...) or section details').toBeTruthy();
	});

	test('mobile cards with different section assignments show different visible labels', async ({ page }) => {
		await page.setViewportSize({ width: 390, height: 844 });

		type AssignmentEntry = { subjectId: number; subjectCode: string; sectionIds: number[] };
		type FacultyResponse = { id: number; assignments: AssignmentEntry[] }[];
		const capturedFaculty: FacultyResponse = [];

		await page.route('**/faculty-assignments/summary*', async (route) => {
			const response = await route.fetch();
			const json = await response.json().catch(() => null);
			if (json?.faculty) {
				for (const f of json.faculty) {
					capturedFaculty.push({
						id: f.id,
						assignments: (f.assignments ?? []).map((a: any) => ({
							subjectId: a.subjectId,
							subjectCode: a.subject?.code ?? '',
							sectionIds: (a.sectionIds ?? []).sort(),
						})),
					});
				}
			}
			await route.fulfill({ response });
		});

		await page.goto(ROUTE, { waitUntil: 'domcontentloaded', timeout: 60_000 });
		await page.waitForLoadState('networkidle', { timeout: 10_000 }).catch(() => null);
		await page.waitForTimeout(1000);

		// Build fingerprints from API data
		const fingerprints = new Map<number, string>();
		for (const f of capturedFaculty) {
			const parts = f.assignments
				.filter((a) => a.sectionIds.length > 0)
				.map((a) => `${a.subjectCode}:${a.sectionIds.join(',')}`)
				.sort();
			fingerprints.set(f.id, parts.join('|'));
		}

		// Extract visible labels from mobile cards
		const cards = await page.locator('[data-testid="teacher-mobile-card"]').all();
		expect(cards.length, 'Expected at least one mobile teacher card').toBeGreaterThan(0);

		const visibleLabels: string[] = [];
		for (let i = 0; i < Math.min(cards.length, 15); i++) {
			const text = await cards[i].innerText();
			// Extract the assigned-classes portion (after load status and hours)
			const lines = text.split('\n').map((l) => l.trim()).filter(Boolean);
			// Find lines that look like assigned classes (contain subject codes or "No classes")
			const classLine = lines.find((l) => /[A-Z]{2,}/.test(l) || l.includes('No classes'));
			if (classLine) {
				visibleLabels.push(classLine);
			}
		}

		// Mobile cards must not contain "First:"
		for (let i = 0; i < Math.min(cards.length, 15); i++) {
			const text = await cards[i].innerText();
			expect(text, `Mobile card ${i}: must not contain "First:"`).not.toMatch(/First:/);
		}

		// Check: identical visible labels must have identical fingerprints
		const labelToFingerprints = new Map<string, Set<string>>();
		for (let i = 0; i < visibleLabels.length; i++) {
			const label = visibleLabels[i];
			if (!label || label.includes('No classes')) continue;

			const fp = [...fingerprints.values()][i] ?? '';
			if (!fp) continue;

			if (!labelToFingerprints.has(label)) {
				labelToFingerprints.set(label, new Set());
			}
			labelToFingerprints.get(label)!.add(fp);
		}

		for (const [label, fps] of labelToFingerprints) {
			expect(
				fps.size,
				`Mobile label "${label.slice(0, 50)}" is shared by teachers with ${fps.size} different fingerprints — must include section discriminator`,
			).toBe(1);
		}
	});
});
