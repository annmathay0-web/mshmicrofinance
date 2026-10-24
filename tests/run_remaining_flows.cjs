async (page) => {
  console.log('--- RUNNING REMAINING FLOWS ---');

  // Ensure Desktop 1440
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.waitForTimeout(300);

  // 1. SCHEDULE PRINT PREVIEW & PDF MODAL
  console.log('Flow 1: Schedule Print Modal...');
  // Find "តារាង A4 / Save PDF"
  const a4Btn = await page.$('button:has-text("តារាង A4")');
  if (a4Btn) {
    await a4Btn.click();
    await page.waitForTimeout(700);
    await page.screenshot({ path: '.playwright-cli/evidence/09-schedule-print-preview-a4.png' });
    console.log('Saved 09-schedule-print-preview-a4.png');

    // Close via Escape key
    await page.keyboard.press('Escape');
    await page.waitForTimeout(400);
  }

  // 2. OVERPAYMENT & SINGLE RECEIPT MODAL
  console.log('Flow 2: Overpayment & Single Receipt...');
  // Find first "ប្រមូល" button in schedule table
  const quickCollectBtn = await page.$('table button:has-text("ប្រមូល")');
  if (quickCollectBtn) {
    await quickCollectBtn.click();
    await page.waitForTimeout(500);

    // Fill amount input with 1,500,000 (exceeding 1,120,000 installment)
    const amountInput = await page.$('input[placeholder*="ចំនួនទឹកប្រាក់"]');
    if (amountInput) {
      await amountInput.fill('1500000');
      // Confirm payment
      const confirmBtn = await page.$('button:has-text("យល់ព្រមបង់"), button:has-text("កត់ត្រា")');
      if (confirmBtn) await confirmBtn.click();
      await page.waitForTimeout(800);

      // Save Single Receipt screenshot
      await page.screenshot({ path: '.playwright-cli/evidence/10-single-receipt-modal.png' });
      console.log('Saved 10-single-receipt-modal.png');

      // Close receipt
      const closeBtn = await page.$('button:has-text("បិទ")');
      if (closeBtn) await closeBtn.click();
      await page.waitForTimeout(400);
    }
  }

  // 3. BATCH SETTLEMENT & BATCH RECEIPT MODAL
  console.log('Flow 3: Batch Settlement Modal...');
  const batchBtn = await page.$('button:has-text("បង់ជាកញ្ចប់")');
  if (batchBtn) {
    await batchBtn.click();
    await page.waitForTimeout(600);
    await page.screenshot({ path: '.playwright-cli/evidence/11-batch-receipt-modal.png' });
    console.log('Saved 11-batch-receipt-modal.png');

    // Close batch modal
    const closeBtn = await page.$('button:has-text("បិទ"), button:has-text("បោះបង់")');
    if (closeBtn) await closeBtn.click();
    await page.waitForTimeout(400);
  }

  // 4. COLLECTION VIEW (Desktop 1440)
  console.log('Flow 4: Collection View Desktop...');
  await page.click('button:has-text("ប្រមូលប្រាក់")');
  await page.waitForTimeout(500);
  await page.screenshot({ path: '.playwright-cli/evidence/06-collection-desktop-1440.png' });
  console.log('Saved 06-collection-desktop-1440.png');

  // 5. LOANS VIEW (Tablet 768x1024)
  console.log('Flow 5: Loans View Tablet 768x1024...');
  // Click on Loans while still desktop/visible or navigate
  await page.click('button:has-text("បញ្ជីកម្ចីទាំងអស់")');
  await page.waitForTimeout(500);
  await page.setViewportSize({ width: 768, height: 1024 });
  await page.waitForTimeout(500);
  await page.screenshot({ path: '.playwright-cli/evidence/05-loans-tablet-768.png' });
  console.log('Saved 05-loans-tablet-768.png');

  // 6. ZOOM 200% TEST (640x450 equivalent)
  console.log('Flow 6: 200% Zoom check...');
  await page.setViewportSize({ width: 640, height: 450 });
  await page.waitForTimeout(400);
  await page.screenshot({ path: '.playwright-cli/evidence/13-zoom-200pct-test.png' });
  console.log('Saved 13-zoom-200pct-test.png');

  console.log('--- REMAINING FLOWS COMPLETE ---');
}
