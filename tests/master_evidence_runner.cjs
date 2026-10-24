async (page) => {
  console.log('=== STARTING MASTER EVIDENCE RUNNER ===');

  // Step 1: Login page mobile screenshot (390x844)
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('http://localhost:3000');
  await page.waitForTimeout(600);
  await page.screenshot({ path: '.playwright-cli/evidence/01-login-mobile-390.png' });
  console.log('Saved 01-login-mobile-390.png');

  // Step 2: Log in as Super Admin
  await page.setViewportSize({ width: 1440, height: 900 });
  const usernameInput = await page.$('input[placeholder*="ឈ្មោះគណនី"]');
  if (usernameInput) {
    await page.fill('input[placeholder*="ឈ្មោះគណនី"]', 'superadmin1');
    await page.fill('input[placeholder*="ពាក្យសម្ងាត់"]', '19012026');
    await page.click('button:has-text("ចូលប្រើប្រព័ន្ធ")');
    await page.waitForTimeout(1000);
  }

  // Confirm Dashboard is loaded
  await page.waitForSelector('text=ផ្ទាំងគ្រប់គ្រង');
  console.log('Logged in successfully. Dashboard loaded.');

  // Step 3: Desktop Dashboard (1440x900)
  await page.screenshot({ path: '.playwright-cli/evidence/02-dashboard-desktop-1440.png' });
  console.log('Saved 02-dashboard-desktop-1440.png');

  // Step 4: Full HD Desktop (1920x1080)
  await page.setViewportSize({ width: 1920, height: 1080 });
  await page.waitForTimeout(300);
  await page.screenshot({ path: '.playwright-cli/evidence/12-desktop-1920.png' });
  console.log('Saved 12-desktop-1920.png');

  // Step 5: Mobile Dashboard (390x844)
  await page.setViewportSize({ width: 390, height: 844 });
  await page.waitForTimeout(300);
  await page.screenshot({ path: '.playwright-cli/evidence/03-dashboard-mobile-390.png' });
  console.log('Saved 03-dashboard-mobile-390.png');

  // Step 6: Smallest Mobile Dashboard (320x568)
  await page.setViewportSize({ width: 320, height: 568 });
  await page.waitForTimeout(300);
  await page.screenshot({ path: '.playwright-cli/evidence/04-dashboard-small-mobile-320.png' });
  console.log('Saved 04-dashboard-small-mobile-320.png');

  // Step 7: Create a new Monthly Loan
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.click('button:has-text("បង្កើតកម្ចីថ្មី")');
  await page.waitForTimeout(600);

  await page.fill('input[placeholder*="ពិសិដ្ឋ"]', 'ចាន់ ពិសិដ្ឋ (E2E Test)');
  await page.fill('input[placeholder*="012"]', '099887766');
  await page.click('button:has-text("បង់ប្រចាំខែ")');
  await page.waitForTimeout(300);
  await page.fill('input[placeholder="4000000"]', '6000000');

  const interestInput = await page.$('input[placeholder="3"]');
  if (interestInput) await interestInput.fill('2');
  const termInput = await page.$('input[placeholder="6"]');
  if (termInput) await termInput.fill('6');

  await page.screenshot({ path: '.playwright-cli/evidence/07-new-monthly-loan-form.png' });
  console.log('Saved 07-new-monthly-loan-form.png');

  await page.click('button:has-text("រក្សាទុកកម្ចី")');
  await page.waitForTimeout(1000);

  // Step 8: Monthly Loan Detail Schedule
  await page.screenshot({ path: '.playwright-cli/evidence/08-monthly-loan-detail-schedule.png' });
  console.log('Saved 08-monthly-loan-detail-schedule.png');

  // Step 9: Schedule Print Preview (A4 / PDF)
  const a4Btn = await page.$('button:has-text("តារាង A4")');
  if (a4Btn) {
    await a4Btn.click();
    await page.waitForTimeout(800);
    await page.screenshot({ path: '.playwright-cli/evidence/09-schedule-print-preview-a4.png' });
    console.log('Saved 09-schedule-print-preview-a4.png');
    await page.keyboard.press('Escape');
    await page.waitForTimeout(400);
  }

  // Step 10: Overpayment and Single Receipt Modal
  const quickCollectBtn = await page.$('table button:has-text("ប្រមូល")');
  if (quickCollectBtn) {
    await quickCollectBtn.click();
    await page.waitForTimeout(500);

    const amountInput = await page.$('input[inputmode="decimal"], input[placeholder*="ចំនួន"]');
    if (amountInput) {
      await amountInput.fill('1500000');
      const confirmBtn = await page.$('button:has-text("បញ្ជាក់ការទទួលប្រាក់")');
      if (confirmBtn) await confirmBtn.click();
      await page.waitForTimeout(800);

      await page.screenshot({ path: '.playwright-cli/evidence/10-single-receipt-modal.png' });
      console.log('Saved 10-single-receipt-modal.png');

      const closeBtn = await page.$('button:has-text("បិទ")');
      if (closeBtn) await closeBtn.click();
      await page.waitForTimeout(400);
    }
  }

  // Step 11: Batch Settlement Modal
  const batchBtn = await page.$('button:has-text("បង់ជាកញ្ចប់")');
  if (batchBtn) {
    await batchBtn.click();
    await page.waitForTimeout(600);
    await page.screenshot({ path: '.playwright-cli/evidence/11-batch-receipt-modal.png' });
    console.log('Saved 11-batch-receipt-modal.png');
    await page.keyboard.press('Escape');
    await page.waitForTimeout(400);
  }

  // Step 12: Loans list on Tablet (768x1024)
  await page.click('button:has-text("បញ្ជីកម្ចីទាំងអស់")');
  await page.waitForTimeout(400);
  await page.setViewportSize({ width: 768, height: 1024 });
  await page.waitForTimeout(400);
  await page.screenshot({ path: '.playwright-cli/evidence/05-loans-tablet-768.png' });
  console.log('Saved 05-loans-tablet-768.png');

  // Step 13: Collection view on Desktop (1440x900)
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.waitForTimeout(300);
  await page.click('button:has-text("ប្រមូលប្រាក់")');
  await page.waitForTimeout(400);
  await page.screenshot({ path: '.playwright-cli/evidence/06-collection-desktop-1440.png' });
  console.log('Saved 06-collection-desktop-1440.png');

  // Step 14: Zoom 200% Check (640x450)
  await page.setViewportSize({ width: 640, height: 450 });
  await page.waitForTimeout(400);
  await page.screenshot({ path: '.playwright-cli/evidence/13-zoom-200pct-test.png' });
  console.log('Saved 13-zoom-200pct-test.png');

  console.log('=== MASTER EVIDENCE RUNNER COMPLETED SUCCESSFULLY ===');
}
