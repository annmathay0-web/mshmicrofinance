async (page) => {
  // Go to loan detail
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.click('button:has-text("បញ្ជីកម្ចីទាំងអស់")');
  await page.waitForTimeout(400);

  // Click on the first row to open loan detail
  await page.evaluate(() => {
    const row = document.querySelector('tbody tr');
    if (row) row.click();
  });
  await page.waitForTimeout(600);

  // Click "កាលវិភាគ A4 / Save PDF"
  await page.click('button:has-text("កាលវិភាគ A4")');
  await page.waitForTimeout(900);

  // Save screenshot of Schedule Print Modal
  await page.screenshot({ path: '.playwright-cli/evidence/09-schedule-print-preview-a4.png' });
  console.log('Saved 09-schedule-print-preview-a4.png');

  // Dismiss via Escape
  await page.keyboard.press('Escape');
  await page.waitForTimeout(400);
}
