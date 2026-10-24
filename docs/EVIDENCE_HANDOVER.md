# MSH Microfinance - Evidence-Based Final Handover Report

**កាលបរិច្ឆេទ:** ថ្ងៃទី ២៤ ខែ តុលា ឆ្នាំ ២០២៦  
**ប្រព័ន្ធ:** MSH Microfinance (ប្រព័ន្ធគ្រប់គ្រងឥណទានមីក្រូហិរញ្ញវត្ថុឆ្លាតវៃ)  
**បរិស្ថានផ្ទៀងផ្ទាត់:** Chromium Viewport Testing (Headless Chromium តាមរយៈ `playwright-cli`)  
**ស្ថានភាពជារួម:** ✅ ឆ្លងកាត់ការផ្ទៀងផ្ទាត់គ្រប់ចំណុច (All Verification Passed)

---

## ១. បញ្ជី Files ដែលបានកែប្រែ (List of Modified Files)

| File Path | ការកែប្រែចម្បង (Key Modifications) | គោលបំណង & Rationale |
|---|---|---|
| `src/index.css` | បន្ថែម `--breakpoint-xs: 400px;` ទៅក្នុង `@theme`, scoped 16px mobile input zoom fix ឱ្យដើរតែក្រោម `@media (max-width: 768px)`, បន្ថែម `font-size: inherit !important` ក្រោម `@media print` | ធានាឱ្យ Tailwind `xs:` breakpoint មាន rule ពិតប្រាកដ, ការពារកុំឱ្យ global font 16px ប៉ះពាល់ដល់ Desktop, Compact controls ឬ Print Layout |
| `src/components/Login.tsx` | កែ touch target ប៊ូតុងបង្ហាញ/លាក់ពាក្យសម្ងាត់ (`aria-label="បង្ហាញពាក្យសម្ងាត់"`) ឱ្យឡើងដល់ `h-11 w-11 min-h-[44px] min-w-[44px]` (44×44px) | ធានាស្របតាមបទដ្ឋាន Touch Target Accessibility $\ge 44\times 44\text{px}$ លើឧបករណ៍ចល័ត |
| `src/components/KhmerCalendar.tsx` | កែប៊ូតុងប្តូរខែ `<` និង `>` ឱ្យមានទំហំចុច 44×44px (`h-11 w-11 min-h-[44px] min-w-[44px]`) | សម្រួលការចុចប្តូរខែលើទូរស័ព្ទដៃ មិនឱ្យរអិល ឬចុចខុស |
| `src/views/Dashboard.tsx` | ដក `truncate` ចេញពីកាតសង្ខេបហិរញ្ញវត្ថុ (`dueToday`, `collectedToday`, Portfolio), កែប៊ូតុង Quick Collect ឱ្យមានទំហំ $\ge 44\text{px}$ ព្រមទាំង `aria-label` | បង្ហាញតួលេខប្រាក់ពេញលេញ គ្មានការកាត់តួលេខ និងគាំទ្រ Screen Reader |
| `src/views/Collection.tsx` | ពង្រីកទំហំប៊ូតុងរុករកកាលបរិច្ឆេទ `<` និង `>` ព្រមទាំងប៊ូតុងប្រតិបត្តិការលើបញ្ជីទូទាត់ឱ្យមានទំហំ $\ge 44\times 44\text{px}$ | ការពារការចុចខុសពេលមន្ត្រីឥណទានប្រមូលប្រាក់នៅទីវាល |
| `src/views/LoanDetail.tsx` | ដក `truncate` ពីកាតសង្ខេបហិរញ្ញវត្ថុ និង schedule metrics, ពង្រីកប៊ូតុង schedule card លើ mobile ឱ្យដល់ 44px | អតិថិជន និងមន្ត្រីអាចមើលសមតុល្យ ប្រាក់ដើម និងការប្រាក់ពេញលេញ |
| `src/views/Settings.tsx` | ពង្រីក action buttons សម្រាប់គ្រប់គ្រងថ្ងៃឈប់សម្រាកបុណ្យជាតិឱ្យមានទំហំ 44×44px និងបន្ថែម accessible label | ងាយស្រួលគ្រប់គ្រងប្រតិទិនឈប់សម្រាកលើអេក្រង់តូច |
| `src/components/Shell.tsx` | ពង្រីកប៊ូតុងបិទ drawer mobile (44×44px) និងប៊ូតុងចាកចេញពីគណនី (44×44px); លុប duplicate date badge ក្នុង header | សម្អាត UI Header និងសម្រួលការចុច Menu Drawer |
| `src/lib/loanLogic.test.ts` | បន្ថែម Pure Unit Tests សម្រាប់ Overpayment (ការបង់ប្រាក់លើស), Advance Credit Rollover និង Multi-installment clearing | ផ្ទៀងផ្ទាត់ភាពត្រឹមត្រូវនៃ Loan Math ដោយឯករាជ្យពី UI |

---

## ២. លទ្ធផល Unit Tests, Typecheck, Build & Linter

### ក. Unit Tests (`node:test` via `npx tsx --test src/lib/loanLogic.test.ts`)
```text
TAP version 13
# Subtest: Khmer to Global digits converts correctly
ok 1 - Khmer to Global digits converts correctly
  ---
  duration_ms: 1.361261
  type: 'test'
  ...
# Subtest: Daily loan installment and total interest calculation
ok 2 - Daily loan installment and total interest calculation
  ---
  duration_ms: 0.221226
  type: 'test'
  ...
# Subtest: Monthly loan interest and installment calculation
ok 3 - Monthly loan interest and installment calculation
  ---
  duration_ms: 0.127089
  type: 'test'
  ...
# Subtest: Sequential Rollover Arrears: underpaid installment rolls shortage to next installment
ok 4 - Sequential Rollover Arrears: underpaid installment rolls shortage to next installment
  ---
  duration_ms: 23.806881
  type: 'test'
  ...
# Subtest: Zero-Gap Sequential Bulk Repayment up to index
ok 5 - Zero-Gap Sequential Bulk Repayment up to index
  ---
  duration_ms: 0.925952
  type: 'test'
  ...
# Subtest: Overpayment & Advance Credit: excess payment rolls forward as credit to reduce next installment
ok 6 - Overpayment & Advance Credit: excess payment rolls forward as credit to reduce next installment
  ---
  duration_ms: 0.226358
  type: 'test'
  ...
# Subtest: Overpayment clearing an entire future installment sequentially
ok 7 - Overpayment clearing an entire future installment sequentially
  ---
  duration_ms: 0.395969
  type: 'test'
  ...
1..7
# tests 7
# suites 0
# pass 7
# fail 0
# cancelled 0
# skipped 0
# todo 0
# duration_ms 489.342617
```
**លទ្ធផល:** 7/7 tests passed (100% Pass) រយៈពេល 489ms។

### ខ. TypeScript Compilation Check (`npx tsc --noEmit`)
```text
Exit code: 0
Errors: 0
```
**លទ្ធផល:** គ្មានបញ្ហា type error ណាមួយកើតឡើងឡើយ។

### គ. Applet Compilation (`compile_applet`)
```text
Build succeeded - the applet is compiled
```
**លទ្ធផល:** Build ជោគជ័យតាម Vite production build pipeline។

### ឃ. Linter Validation (`lint_applet`)
```text
> react-example@0.0.0 lint
> tsc --noEmit
Linting completed successfully
```
**លទ្ធផល:** គ្មាន lint ឬ syntax errors។

---

## ៣. ការបញ្ជាក់វិសាលភាព Responsive & បរិស្ថានតេស្ត (Test Scope & Environment)

### កំណត់សម្គាល់បរិស្ថានតេស្ត (Testing Environment Boundary)
- **ឧបករណ៍តេស្តជាក់ស្តែង:** **Chromium viewport testing** (ដំណើរការលើ Headless Chromium តាមរយៈ `playwright-cli` engine)។
- **ឧបករណ៍ដែលមិនបានតេស្តផ្ទាល់ (Hardware Devices):** **Not tested on real physical iOS/Safari or physical Android hardware** (ការធ្វើតេស្តនេះត្រូវបានក្លែងធ្វើឡើងតាមរយៈ Chromium viewport emulation និង responsive media query simulation តែប៉ុណ្ណោះ)។
- **ម៉ាស៊ីនបោះពុម្ពពិត (Physical Printer):** **Not tested** (ការតេស្តត្រូវបានផ្ទៀងផ្ទាត់ត្រឹម DOM A4 Preview, CSS `@media print` rules, និង jsPDF client-side blob generation)។

### វិសាលភាពនៃការវាស់វែងលើ Responsive Viewports
ការវាស់វែងទាំងអស់ត្រូវបានធ្វើឡើង **ក្រោយពេលចូលប្រើប្រព័ន្ធ (Post-Login)** ដោយមាន **ទិន្នន័យពិតប្រាកដត្រូវបានផ្ទុក (Loaded Data)**៖
1. វាស់វែងលើគ្រប់ទំព័រចម្បង: Dashboard, Loans, Collection, Settings, New Loan, និង Loan Detail។
2. ផ្ទៀងផ្ទាត់លើ Viewport ទាំង ១០៖
   - Mobile: `320×568`, `360×800`, `390×844`, `430×932`
   - Tablet: `768×1024`, `820×1180`, `1024×768`
   - Desktop: `1280×800`, `1440×900`, `1920×1080`
3. ផ្ទៀងផ្ទាត់លក្ខខណ្ឌ `Math.max(doc.scrollWidth, body.scrollWidth) <= doc.clientWidth`: **គ្មាន page-level horizontal overflow កើតឡើងឡើយ** (Diff = 0px)។
4. ផ្ទៀងផ្ទាត់ Dialogs, Menus និង Modals ពេលកំពុងបើកដំណើរការ (Print Preview, Payment Modal, Receipt Modal) មិនហៀរចេញក្រៅ viewport ឬបាំងការចុច។
5. ផ្ទៀងផ្ទាត់ការ Zoom ២០០% (សាកល្បងលើ Viewport `640×450` តំណាងឱ្យ 1280×900 ពេល Zoom 200%)៖ Header, Navigation, និង Summary Cards រក្សាទ្រង់ទ្រាយបានត្រឹមត្រូវ គ្មានការកាត់អក្សរ។

---

## ៤. របាយការណ៍បច្ចេកទេសអំពីមុខងារ PDF (PDF Implementation Mechanism)

ប៊ូតុង **«កាលវិភាគ A4 / Save PDF»** ក្នុង `src/components/SchedulePrint.tsx` ដំណើរការតាមលក្ខណៈបច្ចេកទេសច្បាស់លាស់ដូចខាងក្រោម៖
1. **Multi-Page Chunking:** កាលវិភាគបង់ប្រាក់ត្រូវបានបែងចែកជាទំព័រ A4 ដោយស្វ័យប្រវត្តិ (ទំព័រទី១ ផ្ទុកកាតព័ត៌មានអតិថិជន និងតារាងរហូតដល់ ១៨ ជួរ, ទំព័របន្ទាប់ផ្ទុករហូតដល់ ២៤ ជួរ) ដើម្បីកុំឱ្យមានការច្របាច់អក្សរឱ្យតូច។
2. **Repeating Headers:** ក្បាលតារាង (Table Headers) ត្រូវបានបង្ហាញឡើងវិញនៅលើគ្រប់ទំព័រទាំងអស់។
3. **OKLCH Sanitization:** ប្រើអនុគមន៍ `sanitizeClonedDOMForPDF(clonedRoot)` ដើម្បីសម្អាត CSS color functions ទំនើប (`oklch()`, `color-mix()`) មុនពេលបញ្ជូនទៅ `html2canvas` ដើម្បីការពារកុំឱ្យបែកបាក់ពណ៌ ឬគាំង render។
4. **Export Engine:**
   - ប្រើ `html2canvas` (scale 2) ដើម្បី Render ទំព័រនីមួយៗជា Canvas រួចបញ្ជូនទៅ `jsPDF` (`new jsPDF("p", "mm", "a4")`) បង្កើតជា **PDF File / Blob** សម្រាប់ទាញយក (`pdfReady.url`) ឬចែករំលែកតាមរយៈ Web Share API (`navigator.share`) និង Telegram។
   - សម្រាប់ប៊ូតុង **«បោះពុម្ព»**: ប្រើ `window.print()` ដោយមាន CSS `@media print` គ្រប់គ្រង page breaks, margin A4, និង typography យ៉ាងស្អាត។
5. **ស្ថានភាពផ្ទៀងផ្ទាត់:**
   - ✅ **A4 Preview & Multi-page DOM structure:** ផ្ទៀងផ្ទាត់ជោគជ័យ (Verified in DOM & Preview Modal)។
   - ✅ **Client-side jsPDF Blob Export:** ផ្ទៀងផ្ទាត់ជោគជ័យតាមកូដ។
   - ⚠️ **Physical Printer Spooler:** Not tested (អាស្រ័យលើ Driver របស់ម៉ាស៊ីនបោះពុម្ពរបស់អ្នកប្រើប្រាស់)។

---

## ៥. តារាងផ្ទៀងផ្ទាត់រួម (Verification Matrix)

| ល.រ | ទំព័រ / Flow ដែលបានតេស្ត | Viewport(s) | លក្ខខណ្ឌផ្ទៀងផ្ទាត់ (Assertions) | លទ្ធផល | ភស្តុតាង (Evidence File) |
|---|---|---|---|---|---|
| **១** | Login & Password Toggle | 390×844 | Touch target $\ge 44\times 44\text{px}$, Password visibility toggle, SSL badge | ✅ **PASS** | `.playwright-cli/evidence/01-login-mobile-390.png` |
| **២** | Dashboard Desktop | 1440×900 | Financial figures មិនកាត់ (`truncate` removed), Calendar navigation buttons 44px, Zero overflow | ✅ **PASS** | `.playwright-cli/evidence/02-dashboard-desktop-1440.png` |
| **៣** | Dashboard Mobile | 390×844 | Bottom nav tabs 5 ចំណុច, Header drawer hamburger 44px, Single date badge | ✅ **PASS** | `.playwright-cli/evidence/03-dashboard-mobile-390.png` |
| **៤** | Dashboard Small Mobile | 320×568 | Narrowest viewport, scrollWidth === clientWidth, អក្សរខ្មែររៀបជួរស្អាត | ✅ **PASS** | `.playwright-cli/evidence/04-dashboard-small-mobile-320.png` |
| **៥** | Dashboard Ultra-wide | 1920×1080 | Grid layout រក្សាលំនឹង, គ្មាន content stretching ជ្រុល | ✅ **PASS** | `.playwright-cli/evidence/12-desktop-1920.png` |
| **៦** | New Monthly Loan Creation | 1440×900 | បង្កើតកម្ចីបង់ប្រចាំខែ (6,000,000 ៛, 2% / ខែ, រយៈពេល 6 ខែ), Live calculator គណនាត្រូវ | ✅ **PASS** | `.playwright-cli/evidence/07-new-monthly-loan-form.png` |
| **៧** | Loan Detail & Repayment Schedule | 1440×900 | Schedule បង្ហាញត្រូវ: 1,120,000 ៛/ខែ x 6 ខែ = 6,720,000 ៛, Actions buttons $\ge 44\text{px}$ | ✅ **PASS** | `.playwright-cli/evidence/08-monthly-loan-detail-schedule.png` |
| **៨** | Schedule Print Preview (A4 / PDF) | 1440×900 | ក្បាលតារាង MSH, ព័ត៌មានកម្ចីពេញលេញ, បន្ទាត់ចុះហត្ថលេខា ៣, ប៊ូតុងបោះពុម្ព & ទាញយក, Escape key dismisses | ✅ **PASS** | `.playwright-cli/evidence/09-schedule-print-preview-a4.png` |
| **៩** | Overpayment & Single Receipt Modal | 1440×900 | បង់ 1,500,000 ៛ (លើសការកំណត់ 1,120,000 ៛), បង្កើតបង្កាន់ដៃទូទាត់ដែលមាន PAID watermark និងបំបែកលើកទី១ & លើកទី២ | ✅ **PASS** | `.playwright-cli/evidence/10-single-receipt-modal.png` |
| **១០** | Batch Settlement Modal | 1440×900 | បង្ហាញបង្កាន់ដៃទូទាត់រួម (Batch Settlement) បង្ហាញចំនួនលើកដែលបានទូទាត់ | ✅ **PASS** | `.playwright-cli/evidence/11-batch-receipt-modal.png` |
| **១១** | Loans List View Tablet | 768×1024 | Tablet Portrait, Bottom Navigation, Table row touch target, Progress bar 33% (2/6) | ✅ **PASS** | `.playwright-cli/evidence/05-loans-tablet-768.png` |
| **១២** | Collection View Desktop | 1440×900 | បង្ហាញទិន្នន័យប្រមូលប្រាក់ថ្ងៃនេះ, បញ្ជីអ្នកបង់រួច, Date picker navigation 44px | ✅ **PASS** | `.playwright-cli/evidence/06-collection-desktop-1440.png` |
| **១៣** | 200% Browser Zoom Simulation | 640×450 | Viewport simulation សម្រាប់ 1280×900 ពេល Zoom 200%, គ្មាន overflow, មិនបាត់បង់ controls | ✅ **PASS** | `.playwright-cli/evidence/13-zoom-200pct-test.png` |

---

## ៦. Scripts ដែលបានប្រើក្នុងការតេស្ត (Test Scripts Included in Project)

រាល់ test scripts ត្រូវបានរក្សាទុកក្នុងគម្រោងស្រេចដើម្បីអាចដំណើរការឡើងវិញបានគ្រប់ពេល៖
1. `src/lib/loanLogic.test.ts` — Pure Unit test suite (គណនា Loan Math, Rollover Arrears, Advance Credit, Khmer Digits)។
2. `tests/master_evidence_runner.cjs` — Master Playwright automation runner សម្រាប់តេស្តគ្រប់ viewports និងថតរូប screenshots ទាំងអស់។
3. `tests/capture_a4_modal.cjs` — Script សម្រាប់បើកពិនិត្យ និងថតរូប A4 Schedule Preview Modal។
4. `tests/run_evidence_suite.cjs` — Script ផ្ទៀងផ្ទាត់ horizontal overflow នៅលើ viewports ទាំង ១០។

---

**សេចក្តីសន្និដ្ឋាន:** ការងារកែលម្អ UI, Accessibility (Touch Targets $\ge 44\text{px}$), Financial Typography (No truncation), Tailwind Breakpoints (`xs: 400px`), និង Business Logic Rollover/Advance Credit ត្រូវបានផ្ទៀងផ្ទាត់ដោយភស្តុតាងជាក់ស្តែង និងត្រៀមរួចរាល់សម្រាប់ការប្រគល់ជូនជាផ្លូវការ។
