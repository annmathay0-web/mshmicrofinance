async (page) => {
  // Click first row in tbody
  await page.evaluate(() => {
    const row = document.querySelector('tbody tr');
    if (row) row.click();
  });
  await page.waitForTimeout(600);

  // Now click "តារាង A4 / Save PDF"
  await page.evaluate(() => {
    const btn = Array.from(document.querySelectorAll('button')).find(b => b.innerText.includes('តារាង A4'));
    if (btn) btn.click();
  });
  await page.waitForTimeout(800);

  // Capture screenshot of A4 modal
  await page.screenshot({ path: '.playwright-cli/evidence/09-schedule-print-preview-a4.png' });
  console.log('Saved 09-schedule-print-preview-a4.png');

  // Dismiss with Escape
  await page.keyboard.press('Escape');
  await page.waitForTimeout(400);
}
