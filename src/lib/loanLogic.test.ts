import test from "node:test";
import assert from "node:assert/strict";
import {
  round2,
  installmentAmount,
  totalInterestOf,
  scheduleOf,
  makeInitialDB,
  planPayUpToIndex,
} from "./data.ts";
import { khmerToGlobalDigits, sanitizeNumericInput } from "./security.ts";

test("Khmer to Global digits converts correctly", () => {
  assert.equal(khmerToGlobalDigits("០១២៣៤៥៦៧៨៩"), "0123456789");
  assert.equal(khmerToGlobalDigits("កម្ចី ១,២០០,០០០ ៛"), "កម្ចី 1,200,000 ៛");
  assert.equal(sanitizeNumericInput("៤,០០០,០០០"), "4000000");
  assert.equal(sanitizeNumericInput("១២.៥០"), "12.50");
});

test("Daily loan installment and total interest calculation", () => {
  const dailyLoan = {
    id: "l1",
    code: "LN-001",
    customer: "សុខ ពិសិដ្ឋ",
    phone: "012345678",
    type: "daily" as const,
    principal: 4000000,
    interest: 800000, // flat interest 800,000 Riel
    term: 30, // 30 days
    startDate: "2026-03-01",
    createdAt: "2026-03-01",
  };

  assert.equal(totalInterestOf(dailyLoan), 800000);
  // (4,000,000 + 800,000) / 30 = 160,000
  assert.equal(round2(installmentAmount(dailyLoan)), 160000);
});

test("Monthly loan interest and installment calculation", () => {
  const monthlyLoan = {
    id: "l2",
    code: "LN-002",
    customer: "ចាន់ តារា",
    phone: "098765432",
    type: "monthly" as const,
    principal: 10000000,
    interest: 2, // 2% per month
    term: 6, // 6 months
    startDate: "2026-01-01",
    createdAt: "2026-01-01",
  };

  // Total interest = 10,000,000 * 2% * 6 = 1,200,000
  assert.equal(totalInterestOf(monthlyLoan), 1200000);
  // Total due = 11,200,000 / 6 = 1,866,666.67
  assert.equal(round2(installmentAmount(monthlyLoan)), 1866666.67);
});

test("Sequential Rollover Arrears: underpaid installment rolls shortage to next installment", () => {
  const db = makeInitialDB();
  const loan = {
    id: "l-roll",
    code: "LN-ROLL",
    customer: "កែវ ណារ៉ា",
    phone: "011223344",
    type: "daily" as const,
    principal: 3000000,
    interest: 0,
    term: 3,
    startDate: "2026-03-02", // Monday
    createdAt: "2026-03-02",
  };

  // Base schedule: 3 installments of 1,000,000 each
  // Customer pays only 600,000 on installment 0 (shortage 400,000)
  const payments = [
    { id: "p1", loanId: "l-roll", inst: 0, date: "2026-03-03", amount: 600000 },
  ];

  const sched = scheduleOf(loan, payments, db.settings);
  assert.equal(sched.length, 3);

  // Inst 0: paid 600,000, shortage 400,000, marked partial
  assert.equal(sched[0].paid, 600000);
  assert.equal(sched[0].shortage, 400000);
  assert.equal(sched[0].status, "partial");

  // Inst 1: base 1,000,000 + rolled 400,000 = requiredDue 1,400,000
  assert.equal(sched[1].carriedIn, 400000);
  assert.equal(sched[1].requiredDue, 1400000);
  assert.equal(sched[1].balance, 1400000);
});

test("Zero-Gap Sequential Bulk Repayment up to index", () => {
  const db = makeInitialDB();
  const loan = {
    id: "l-bulk",
    code: "LN-BULK",
    customer: "ហេង សុផល",
    phone: "077889900",
    type: "daily" as const,
    principal: 1000000,
    interest: 0,
    term: 5,
    startDate: "2026-04-01",
    createdAt: "2026-04-01",
  };

  // Plan paying up to index 2 (Day 1, 2, 3)
  const plan = planPayUpToIndex(loan, [], db.settings, 2);
  assert.ok(plan);
  assert.equal(plan.rows.length, 3);
  assert.equal(plan.total, 600000); // 200,000 * 3
});

test("Overpayment & Advance Credit: excess payment rolls forward as credit to reduce next installment", () => {
  const db = makeInitialDB();
  const loan = {
    id: "l-overpay",
    code: "LN-OVER",
    customer: "អ៊ុច វុទ្ធី",
    phone: "012888999",
    type: "daily" as const,
    principal: 3000000,
    interest: 0,
    term: 3,
    startDate: "2026-03-02",
    createdAt: "2026-03-02",
  };

  // 3 installments of 1,000,000 each.
  // Customer pays 1,400,000 on Inst 0 (excess 400,000)
  const payments = [
    { id: "p1", loanId: "l-overpay", inst: 0, date: "2026-03-03", amount: 1400000 },
  ];

  const sched = scheduleOf(loan, payments, db.settings);
  assert.equal(sched.length, 3);

  // Inst 0: paid 1,400,000, requiredDue 1,000,000, excess 400,000, status paid
  assert.equal(sched[0].paid, 1400000);
  assert.equal(sched[0].excess, 400000);
  assert.equal(sched[0].status, "paid");

  // Inst 1: carriedIn = -400,000 (advance credit), base 1,000,000 -> requiredDue = 600,000
  assert.equal(sched[1].carriedIn, -400000);
  assert.equal(sched[1].requiredDue, 600000);
  assert.equal(sched[1].balance, 600000);
});

test("Overpayment clearing an entire future installment sequentially", () => {
  const db = makeInitialDB();
  const loan = {
    id: "l-bigpay",
    code: "LN-BIG",
    customer: "សេង គឹមសាន",
    phone: "088776655",
    type: "daily" as const,
    principal: 2000000,
    interest: 0,
    term: 3,
    startDate: "2026-03-02",
    createdAt: "2026-03-02",
  };

  // Base installment: ~666,666.66.
  // Total exact = 2,000,000. Customer pays 1,500,000 on Inst 0.
  const payments = [
    { id: "p1", loanId: "l-bigpay", inst: 0, date: "2026-03-03", amount: 1500000 },
  ];

  const sched = scheduleOf(loan, payments, db.settings);
  assert.equal(sched[0].status, "paid");
  assert.ok(sched[0].excess > 800000); // 1,500,000 - 666,666.66 = 833,333.34
  // Inst 1 is completely covered by advance credit
  assert.equal(sched[1].status, "paid");
  assert.equal(sched[1].balance, 0);
  // Remaining excess rolls into Inst 2
  assert.ok(sched[2].carriedIn < 0);
  assert.ok(sched[2].balance < sched[2].amount);
});

