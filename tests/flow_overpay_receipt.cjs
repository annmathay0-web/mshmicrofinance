async (page) => {
  // Fill 1,500,000 into the open payment input
  const inputs = await page.$$('input');
  for (const inp of inputs) {
    const val = await inp.inputValue();
    if (val === '1120000') {
      await inp.fill('1500000');
      break;
    }
  }

  // Click confirm payment
  await page.click('button:has-text("បញ្ជាក់ការទទួលប្រាក់")');
  await page.waitForTimeout(700);

  // Take screenshot of Single Receipt Modal
  await page.screenshot({ path: '.playwright-cli/evidence/10-single-receipt-modal.png' });
  console.log('Successfully saved 10-single-receipt-modal.png');

  // Close receipt modal
  const closeBtn = await page.$('button:has-text("បិទ")');
  if (closeBtn) await closeBtn.click();
  await page.waitForTimeout(400);

  // Now open "តារាង A4 / Save PDF"
  const a4Btn = await page.$('button:has-text("តារាង A4")');
  if (a4Btn) {
    await a4Btn.click();
    await page.waitForTimeout(600);
    await page.screenshot({ path: '.playwright-cli/evidence/09-schedule-print-preview-a4.png' });
    console.log('Successfully saved 09-schedule-print-preview-a4.png');
    await page.keyboard.press('Escape');
    await page.waitForTimeout(400);
  }

  // Open "បង់ជាកញ្ចប់" (Batch Settlement)
  const batchBtn = await page.$('button:has-text("បង់ជាកញ្ចប់")');
  if (batchBtn) {
    await batchBtn.click();
    await page.waitForTimeout(500);
    await page.screenshot({ path: '.playwright-cli/evidence/11-batch-receipt-modal.png' });
    console.log('Successfully saved 11-batch-receipt-modal.png');
    // Close modal
    await page.keyboard.press('Escape');
    await page.waitForTimeout(400);
  }

  // Navigate to Loans view on Tablet (768x1024)
  await page.click('button:has-text("បញ្ជីកម្ចីទាំងអស់")');
  await page.waitForTimeout(400);
  await page.setViewportSize({ width: 768, height: 1024 });
  await page.waitForTimeout(400);
  await page.screenshot({ path: '.playwright-cli/evidence/05-loans-tablet-768.png' });
  console.log('Successfully saved 05-loans-tablet-768.png');

  // Navigate to Collection view on Desktop (1440x900)
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.waitForTimeout(300);
  await page.click('button:has-text("ប្រមូលប្រាក់")');
  await page.waitForTimeout(400);
  await page.screenshot({ path: '.playwright-cli/evidence/06-collection-desktop-1440.png' });
  console.log('Successfully saved 06-collection-desktop-1440.png');

  // Zoom 200% check (640x450 viewport)
  await page.setViewportSize({ width: 640, height: 450 });
  await page.waitForTimeout(300);
  await page.screenshot({ path: '.playwright-cli/evidence/13-zoom-200pct-test.png' });
  console.log('Successfully saved 13-zoom-200pct-test.png');
}
