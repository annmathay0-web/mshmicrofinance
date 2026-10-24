async (page) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('http://localhost:3000');
  await page.waitForTimeout(500);

  // Navigate to loans list
  await page.click('button:has-text("បញ្ជីកម្ចីទាំងអស់")');
  await page.waitForTimeout(500);

  // Click on the loan to open loan detail
  const loanRow = await page.$('text=ចាន់ ពិសិដ្ឋ');
  if (loanRow) {
    await loanRow.click();
    await page.waitForTimeout(600);
  }

  // Click "តារាង A4 / Save PDF"
  const a4Btn = await page.$('button:has-text("តារាង A4")');
  if (a4Btn) {
    await a4Btn.click();
    await page.waitForTimeout(800);
    await page.screenshot({ path: '.playwright-cli/evidence/09-schedule-print-preview-a4.png' });
    console.log('Successfully captured 09-schedule-print-preview-a4.png');
    await page.keyboard.press('Escape');
    await page.waitForTimeout(400);
  }
}
