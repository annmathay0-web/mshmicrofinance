/* ============================================================
   MSH Microfinance - Data model, Khmer formatting & loan math
   ============================================================ */

import { fmtLunarShort, isBuiltinHoliday } from "./khmerDate";

/** Official institution name - used on receipts, Telegram reminders & branding. */
export const ORG_NAME = "MSH Microfinance";

export type LoanType = "daily" | "monthly";

export interface Loan {
  id: string;
  code: string;
  customer: string;
  phone: string;
  type: LoanType;
  principal: number;
  /** daily => total interest (ប្រាក់ចំណេញសរុប), monthly => rate (% / month) */
  interest: number;
  /** daily => number of payment days, monthly => number of months */
  term: number;
  startDate: string; // ISO yyyy-mm-dd (disbursement day)
  /** daily only: collect installment #1 on the disbursement day itself (default false) */
  sameDay?: boolean;
  note?: string;
  createdAt: string;
}

export interface Payment {
  id: string;
  loanId: string;
  inst: number; // installment index (0-based)
  date: string; // ISO paid date
  amount: number;
}

export interface Holiday {
  date: string;
  name: string;
}

export interface Settings {
  orgName: string;
  /** index 0 = Sunday ... 6 = Saturday */
  workingDays: boolean[];
  holidays: Holiday[];
  /** built-in (auto-computed) holiday dates the admin chose to un-skip */
  ignoredHolidays?: string[];
  sheetUrl: string;
  lastSync?: string;
}

export interface DB {
  loans: Loan[];
  payments: Payment[];
  settings: Settings;
  seq: number;
}

/* ---------------- dates & formatting ---------------- */

export const uid = () => Math.random().toString(36).slice(2, 10);
export const round2 = (n: number) => Math.round(n * 100) / 100;

export function parseISO(s: string): Date {
  const [y, m, d] = s.split("-").map(Number);
  return new Date(y, m - 1, d);
}

export function toISO(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export const todayISO = () => toISO(new Date());

export function addDays(d: Date, n: number): Date {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x;
}

export function addMonths(d: Date, n: number): Date {
  const x = new Date(d);
  const day = x.getDate();
  x.setDate(1);
  x.setMonth(x.getMonth() + n);
  const last = new Date(x.getFullYear(), x.getMonth() + 1, 0).getDate();
  x.setDate(Math.min(day, last));
  return x;
}

export const KH_MONTHS = [
  "មករា", "កុម្ភៈ", "មីនា", "មេសា", "ឧសភា", "មិថុនា",
  "កក្កដា", "សីហា", "កញ្ញា", "តុលា", "វិច្ឆិកា", "ធ្នូ"
];

export const KH_DAYS = ["អាទិត្យ", "ច័ន្ទ", "អង្គារ", "ពុធ", "ព្រហស្បតិ៍", "សុក្រ", "សៅរ៍"];
export const KH_DAYS_SHORT = ["អា", "ច", "អ", "ពុ", "ព្រ", "សុ", "ស"];

export const fmt = (n: number) =>
  n.toLocaleString("en-US", { maximumFractionDigits: 2 }) + " ៛";

export const fmt0 = (n: number) =>
  n.toLocaleString("en-US", { maximumFractionDigits: 0 }) + " ៛";

const KH_DIGITS = "០១២៣៤៥៦៧៨៩";
export const toKhmerNum = (n: number | string) =>
  String(n).replace(/\d/g, (d) => KH_DIGITS[+d] ?? d);

export function fmtKH(iso: string): string {
  const d = parseISO(iso);
  return `${d.getDate()} ${KH_MONTHS[d.getMonth()]} ${d.getFullYear()}`;
}

export function fmtKHFull(iso: string): string {
  const d = parseISO(iso);
  return `ថ្ងៃ${KH_DAYS[d.getDay()]}, ${d.getDate()} ${KH_MONTHS[d.getMonth()]} ${d.getFullYear()}`;
}

export function fmtShort(iso: string): string {
  const d = parseISO(iso);
  return `${d.getDate()}/${d.getMonth() + 1}`;
}

/* ---------------- working-day engine ---------------- */

export function isWorking(d: Date, s: Settings): boolean {
  const iso = toISO(d);
  const ignored = s.ignoredHolidays ?? [];
  return (
    Boolean(s.workingDays[d.getDay()]) &&
    !s.holidays.some((h) => h.date === iso) &&
    (ignored.includes(iso) || !isBuiltinHoliday(iso))
  );
}

export function workingDatesFrom(startISO: string, count: number, s: Settings): string[] {
  const res: string[] = [];
  let d = parseISO(startISO);
  let guard = 0;
  while (res.length < count && guard < 25000) {
    if (isWorking(d, s)) res.push(toISO(d));
    d = addDays(d, 1);
    guard++;
  }
  return res;
}

export function workingDatesAfter(startISO: string, count: number, s: Settings): string[] {
  const res: string[] = [];
  let d = addDays(parseISO(startISO), 1);
  let guard = 0;
  while (res.length < count && guard < 25000) {
    if (isWorking(d, s)) res.push(toISO(d));
    d = addDays(d, 1);
    guard++;
  }
  return res;
}

export function shiftToWorking(d: Date, s: Settings): Date {
  let x = new Date(d);
  let guard = 0;
  while (!isWorking(x, s) && guard < 1000) {
    x = addDays(x, 1);
    guard++;
  }
  return x;
}

export function workingDaysAgo(fromISO: string, k: number, s: Settings): string {
  let d = parseISO(fromISO);
  let c = 0;
  let guard = 0;
  while (c < k && guard < 25000) {
    d = addDays(d, -1);
    if (isWorking(d, s)) c++;
    guard++;
  }
  return toISO(d);
}

/* ---------------- loan math ---------------- */

export function installmentAmount(l: Loan): number {
  if (l.type === "daily") return (l.principal + l.interest) / l.term;
  const totalInterest = l.principal * (l.interest / 100) * l.term;
  return (l.principal + totalInterest) / l.term;
}

export function totalInterestOf(l: Loan): number {
  return l.type === "daily" ? l.interest : round2(l.principal * (l.interest / 100) * l.term);
}

export type InstStatus = "paid" | "partial" | "overdue" | "today" | "upcoming";

export interface Inst {
  i: number;
  due: string;
  amount: number;
  carriedIn: number; // positive = rolled shortage (+), negative = advance credit (-)
  carriedFrom?: number;
  requiredDue: number; // effective required due for this installment (amount + carriedIn)
  paid: number;
  shortage: number; // shortage amount if underpaid (ជំពាក់ខ្វះ)
  excess: number; // overpayment advance credit
  balance: number; // currently owed amount
  status: InstStatus;
  paidDates: string[];
}

const NO_PAYMENTS: Payment[] = [];

export function loanScheduleDates(loan: Loan, s: Settings): string[] {
  if (loan.type === "daily") {
    return loan.sameDay
      ? workingDatesFrom(loan.startDate, loan.term, s)
      : workingDatesAfter(loan.startDate, loan.term, s);
  }
  const dates: string[] = [];
  const start = parseISO(loan.startDate);
  let lastIso = "";
  for (let i = 0; i < loan.term; i++) {
    let candidate = shiftToWorking(addMonths(start, i + 1), s);
    let iso = toISO(candidate);
    let guard = 0;
    while (lastIso && iso <= lastIso && guard < 1000) {
      candidate = shiftToWorking(addDays(candidate, 1), s);
      iso = toISO(candidate);
      guard++;
    }
    dates.push(iso);
    lastIso = iso;
  }
  return dates;
}

export function scheduleOf(loan: Loan, payments: Payment[], s: Settings): Inst[] {
  const dates = loanScheduleDates(loan, s);
  if (dates.length === 0) return [];

  const totalExact = round2(
    loan.type === "daily" ? loan.principal + loan.interest : loan.principal + totalInterestOf(loan)
  );
  const base = Math.floor((totalExact / loan.term) * 100) / 100;
  const lastAmount = round2(totalExact - base * (dates.length - 1));

  const t = todayISO();
  const byInst = new Map<number, Payment[]>();
  for (const p of payments) {
    if (p.loanId !== loan.id) continue;
    const arr = byInst.get(p.inst);
    if (arr) arr.push(p);
    else byInst.set(p.inst, [p]);
  }

  let rollShortage = 0; // Cumulative shortage from previous underpaid installments
  let rollCredit = 0;   // Cumulative advance credit from overpayments

  return dates.map((due, i) => {
    const amount = i === dates.length - 1 ? lastAmount : base;
    const mine = byInst.get(i) ?? NO_PAYMENTS;
    let paidSum = 0;
    for (const p of mine) paidSum += p.amount;
    const paid = round2(paidSum);

    // Carried in: positive for rolled shortage, negative for advance credit
    const carriedIn = round2(rollShortage - rollCredit);
    const carriedFrom = rollShortage > 0.005 ? i - 1 : undefined;

    // Effective required due for this installment
    const netDue = round2(amount + carriedIn);
    const requiredDue = round2(Math.max(0, netDue));

    let status: InstStatus;
    let shortage = 0;
    let excess = 0;
    let balance = 0;

    if (paid > 0) {
      if (paid < requiredDue - 0.005) {
        // Underpaid row: marked as "partial" (ជំពាក់ខ្វះ)
        status = "partial";
        shortage = round2(requiredDue - paid);
        // Sequential Arrears Roll-over:
        // This exact shortage carries over to the very next unpaid day
        rollShortage = shortage;
        rollCredit = 0;
        // Its debt is transferred forward into the next installment.
        // If it is the last installment, it retains the remaining shortage balance.
        balance = i === dates.length - 1 ? shortage : 0;
      } else {
        // Fully paid row
        status = "paid";
        balance = 0;
        shortage = 0;
        rollShortage = 0;
        if (paid > requiredDue + 0.005) {
          // Excess overpayment rolls over as advance credit
          excess = round2(paid - requiredDue);
          rollCredit = excess;
        } else {
          rollCredit = 0;
        }
      }
    } else {
      // No payment recorded directly on this installment
      if (carriedIn < 0 && Math.abs(carriedIn) >= amount - 0.005) {
        // Covered completely by advance credit from prior overpayment
        status = "paid";
        balance = 0;
        excess = round2(Math.abs(carriedIn) - amount);
        rollCredit = excess;
        rollShortage = 0;
      } else {
        // Unpaid installment
        balance = requiredDue;
        status = due < t ? "overdue" : due === t ? "today" : "upcoming";
        // The rolled shortage/credit is now actively parked on this installment,
        // so subsequent future rows evaluate from base amount until this one is addressed.
        rollShortage = 0;
        rollCredit = 0;
      }
    }

    return {
      i,
      due,
      amount,
      carriedIn,
      carriedFrom,
      requiredDue,
      paid,
      shortage,
      excess,
      balance,
      status,
      paidDates: mine.map((p) => p.date),
    };
  });
}

export interface LoanStats {
  schedule: Inst[];
  totalDue: number;
  totalPaid: number;
  outstanding: number;
  next: Inst | null;
  paidCount: number;
  done: boolean;
  remaining: number;
}

export interface AllocRow {
  i: number;
  pay: number;
  full: boolean;
  due: string;
}

export interface AllocPreview {
  rows: AllocRow[];
  total: number;
  cleared: number;
  partial: number;
  capped: boolean;
}

export function transitArrears(st: LoanStats): number {
  return round2(
    st.schedule.reduce((acc, i) => acc + (i.carriedIn > 0 ? i.carriedIn : 0), 0)
  );
}

export function trueOwed(st: LoanStats, filter?: (i: Inst) => boolean): number {
  let sum = 0;
  for (const inst of st.schedule) {
    if (inst.status === "paid") continue;
    if (!filter || filter(inst)) {
      sum = round2(sum + inst.balance);
    }
  }
  return sum;
}

export interface SettlementRow {
  i: number;
  pay: number;
  due: string;
}

export function planSettlement(
  st: LoanStats,
  include: (i: Inst) => boolean
): { rows: SettlementRow[]; total: number } {
  const rows: SettlementRow[] = [];
  for (const inst of st.schedule) {
    if (!include(inst)) continue;
    if (inst.status === "paid" && inst.balance <= 0.005) continue;
    const needed = round2(Math.max(0, inst.balance));
    if (needed > 0.005) {
      rows.push({ i: inst.i, pay: needed, due: inst.due });
    }
  }
  return { rows, total: round2(rows.reduce((s, r) => s + r.pay, 0)) };
}

/**
 * Sequential Bulk Repayment up to a specific row index with ZERO GAPS.
 * Checks off every single daily installment from Day 0 up to targetIdx sequentially.
 */
export function planPayUpToIndex(
  loan: Loan,
  payments: Payment[],
  settings: Settings,
  targetIdx: number
): { rows: SettlementRow[]; total: number } | null {
  if (targetIdx < 0 || targetIdx >= loan.term) return null;
  const simPayments = [...payments];
  const rows: SettlementRow[] = [];

  for (let k = 0; k <= targetIdx; k++) {
    const sched = scheduleOf(loan, simPayments, settings);
    const inst = sched[k];
    if (inst.status === "paid" && inst.balance <= 0.005) continue;
    const needed = round2(
      Math.max(0, inst.balance > 0.005 ? inst.balance : inst.requiredDue - inst.paid)
    );
    if (needed > 0.005) {
      rows.push({ i: k, pay: needed, due: inst.due });
      simPayments.push({
        id: "sim-" + k,
        loanId: loan.id,
        inst: k,
        date: todayISO(),
        amount: needed,
      });
    }
  }

  return {
    rows,
    total: round2(rows.reduce((s, r) => s + r.pay, 0)),
  };
}

/**
 * Sequential Bulk Repayment up to Target Date with ZERO GAPS.
 * Checks off every single daily installment from Day 0 up to target date sequentially.
 */
export function planPayUpToDate(
  loan: Loan,
  payments: Payment[],
  settings: Settings,
  targetISO: string
): { rows: SettlementRow[]; total: number } | null {
  const dates = loanScheduleDates(loan, settings);
  if (dates.length === 0) return null;
  let maxIdx = dates.findIndex((d) => d === targetISO);
  if (maxIdx === -1) {
    for (let i = dates.length - 1; i >= 0; i--) {
      if (dates[i] <= targetISO) {
        maxIdx = i;
        break;
      }
    }
  }
  if (maxIdx < 0) return null;
  return planPayUpToIndex(loan, payments, settings, maxIdx);
}

export function allocatePreview(st: LoanStats, amount: number): AllocPreview | null {
  if (!Number.isFinite(amount) || amount <= 0 || st.remaining <= 0.005) return null;
  const capped = amount > st.remaining + 0.005;
  let remaining = round2(Math.min(amount, st.remaining));
  const rows: AllocRow[] = [];

  for (const inst of st.schedule) {
    if (remaining <= 0.005) break;
    if (inst.balance <= 0.005) continue;
    const needed = round2(Math.max(0, inst.balance));
    if (needed <= 0.005) continue;

    const pay = round2(Math.min(needed, remaining));
    const full = pay >= needed - 0.005;
    rows.push({ i: inst.i, pay, full, due: inst.due });
    remaining = round2(remaining - pay);
  }

  const last = rows[rows.length - 1];
  return {
    rows,
    total: round2(rows.reduce((s, r) => s + r.pay, 0)),
    cleared: rows.filter((r) => r.full).length,
    partial: last && !last.full ? last.pay : 0,
    capped,
  };
}

export interface CollectionSnapshot {
  loan: Loan;
  st: LoanStats;
  viewDate: string;
  dueUpTo: Inst[];
  unpaidUpTo: Inst[];
  instOnDate: Inst | null;
  targetInst: Inst | null;
  firstUnpaidInst: Inst | null;
  /** Total cumulative amount due on viewDate (all unpaid days + rolled shortages up to viewDate) */
  cumulativeDue: number;
  /** Base installment amount for the selected date itself */
  currentDayBase: number;
  /** Cumulative rollover arrears (ជំពាក់ខ្វះ) from previous days up to viewDate */
  rolledArrears: number;
  /** Advance credit (ប្រាក់បង់លើស) reducing the selected date's installment */
  advanceCredit: number;
  /** Number of unpaid installments accumulated up to viewDate */
  unpaidCount: number;
  /** Total paid across installments due on or before viewDate */
  paidUpToDate: number;
  /** Total scheduled across installments due on or before viewDate */
  scheduledUpToDate: number;
}

export function collectionSnapshotForDate(
  loan: Loan,
  payments: Payment[],
  s: Settings,
  viewDate: string
): CollectionSnapshot {
  const st = loanStats(loan, payments, s);
  const dueUpTo = st.schedule.filter((i) => i.due <= viewDate);
  const unpaidUpTo = dueUpTo.filter((i) => i.balance > 0.005);
  const instOnDate = st.schedule.find((i) => i.due === viewDate) ?? null;
  const targetInst =
    instOnDate ??
    unpaidUpTo[unpaidUpTo.length - 1] ??
    dueUpTo[dueUpTo.length - 1] ??
    null;
  const firstUnpaidInst = unpaidUpTo[0] ?? null;

  const cumulativeDue = round2(unpaidUpTo.reduce((sum, i) => sum + i.balance, 0));
  const hasUnpaidOnDate = instOnDate !== null && instOnDate.balance > 0.005;
  const currentDayBase = hasUnpaidOnDate
    ? round2(Math.max(0, instOnDate.amount - instOnDate.paid))
    : 0;
  const rolledArrears =
    cumulativeDue > 0.005 ? round2(Math.max(0, cumulativeDue - currentDayBase)) : 0;
  const advanceCredit =
    hasUnpaidOnDate && cumulativeDue < currentDayBase - 0.005
      ? round2(currentDayBase - cumulativeDue)
      : instOnDate && instOnDate.carriedIn < -0.005
        ? round2(Math.abs(instOnDate.carriedIn))
        : 0;

  const scheduledUpToDate = round2(dueUpTo.reduce((sum, i) => sum + i.amount, 0));
  const paidUpToDate = round2(dueUpTo.reduce((sum, i) => sum + i.paid, 0));

  return {
    loan,
    st,
    viewDate,
    dueUpTo,
    unpaidUpTo,
    instOnDate,
    targetInst,
    firstUnpaidInst,
    cumulativeDue,
    currentDayBase,
    rolledArrears,
    advanceCredit,
    unpaidCount: unpaidUpTo.length,
    paidUpToDate,
    scheduledUpToDate,
  };
}

export function reminderTextForDate(snap: CollectionSnapshot, org: string): string {
  const { loan, st, targetInst, firstUnpaidInst, cumulativeDue, rolledArrears, unpaidCount, viewDate } = snap;
  if (cumulativeDue <= 0.005 || !targetInst) {
    return reminderText(loan, st, org);
  }

  const typeKh = loan.type === "daily" ? "កម្ចីបង់រាល់ថ្ងៃ (Daily Loan)" : "កម្ចីបង់ប្រចាំខែ (Monthly Loan)";
  const instLabel =
    unpaidCount > 1 && firstUnpaidInst
      ? `#${firstUnpaidInst.i + 1} ដល់ #${targetInst.i + 1} (${unpaidCount} ថ្ងៃ)`
      : `${targetInst.i + 1}/${loan.term}`;

  return [
    `🔔 *សេចក្តីជូនដំណឹងអំពីការបង់ប្រាក់*`,
    `🏢 *${org}*`,
    ``,
    `👤 អតិថិជន: *${loan.customer}*`,
    `📞 ទូរស័ព្ទ: ${loan.phone}`,
    ``,
    `📑 លេខកូដកម្ចី: ${loan.code}`,
    `🏷️ ប្រភេទកម្ចី: ${typeKh}`,
    `🔢 លើកទី: ${instLabel}`,
    `💰 ចំនួនទឹកប្រាក់ត្រូវបង់: *${fmt(cumulativeDue)}*` +
      (rolledArrears > 0.005 ? ` (រួមបញ្ចូលប្រាក់ជំពាក់ខ្វះ +${fmt(rolledArrears)})` : ""),
    `📅 កាលបរិច្ឆេទកំណត់: ${fmtKH(viewDate)} (${fmtLunarShort(viewDate)})`,
    ``,
    `🙏 សូមអរគុណសម្រាប់ការសហការល្អជាមួយស្ថាប័នយើងខ្ញុំ!`,
  ].join("\n");
}

export function loanStats(loan: Loan, payments: Payment[], s: Settings): LoanStats {
  const schedule = scheduleOf(loan, payments, s);
  const t = todayISO();
  const totalDue = round2(schedule.reduce((a, b) => a + b.amount, 0));
  let paidSum = 0;
  for (const p of payments) if (p.loanId === loan.id) paidSum += p.amount;
  const totalPaid = round2(paidSum);
  const remaining = round2(Math.max(0, totalDue - totalPaid));
  const outstanding = round2(
    schedule
      .filter((i) => i.due <= t && i.balance > 0.005)
      .reduce((a, b) => a + b.balance, 0)
  );
  const next = schedule.find((i) => i.balance > 0.005) ?? null;
  const paidCount = schedule.filter(
    (i) => i.status === "paid" || (i.status === "partial" && i.balance <= 0.005)
  ).length;

  return {
    schedule,
    totalDue,
    totalPaid,
    outstanding,
    next,
    paidCount,
    done: remaining <= 0.005,
    remaining,
  };
}

export type LoanStatus = "done" | "overdue" | "today" | "upcoming";

export function loanStatusOf(st: LoanStats): LoanStatus {
  if (st.done) return "done";
  const t = todayISO();
  if (st.schedule.some((i) => i.balance > 0.005 && i.due < t)) return "overdue";
  if (st.outstanding > 0) return "today";
  return "upcoming";
}

export function collectionsByDay(payments: Payment[], days: number) {
  const out: { date: string; total: number }[] = [];
  const base = new Date();
  for (let i = days - 1; i >= 0; i--) {
    const iso = toISO(addDays(base, -i));
    out.push({
      date: iso,
      total: round2(payments.filter((p) => p.date === iso).reduce((a, b) => a + b.amount, 0)),
    });
  }
  return out;
}

export function reminderText(loan: Loan, st: LoanStats, org: string): string {
  const next = st.next;
  if (!next) return `កម្ចី ${loan.code} របស់អតិថិជន ${loan.customer} បានទូទាត់រួចរាល់ហើយ។`;
  const typeKh = loan.type === "daily" ? "កម្ចីបង់រាល់ថ្ងៃ (Daily Loan)" : "កម្ចីបង់ប្រចាំខែ (Monthly Loan)";
  return [
    `🔔 *សេចក្តីជូនដំណឹងអំពីការបង់ប្រាក់*`,
    `🏢 *${org}*`,
    ``,
    `👤 អតិថិជន: *${loan.customer}*`,
    `📞 ទូរស័ព្ទ: ${loan.phone}`,
    ``,
    `📑 លេខកូដកម្ចី: ${loan.code}`,
    `🏷️ ប្រភេទកម្ចី: ${typeKh}`,
    `🔢 លើកទី: ${next.i + 1}/${loan.term}`,
    `💰 ចំនួនទឹកប្រាក់ត្រូវបង់: *${fmt(next.balance)}*` +
      (next.carriedIn > 0.005 ? ` (រួមបញ្ចូលប្រាក់ជំពាក់ខ្វះ +${fmt(next.carriedIn)})` : ""),
    `📅 កាលបរិច្ឆេទកំណត់: ${fmtKH(next.due)} (${fmtLunarShort(next.due)})`,
    ``,
    `🙏 សូមអរគុណសម្រាប់ការសហការល្អជាមួយស្ថាប័នយើងខ្ញុំ!`,
  ].join("\n");
}

export async function copyText(s: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(s);
    return true;
  } catch {
    const ta = document.createElement("textarea");
    ta.value = s;
    ta.style.position = "fixed";
    ta.style.opacity = "0";
    document.body.appendChild(ta);
    ta.select();
    let ok = false;
    try {
      ok = document.execCommand("copy");
    } catch {
      ok = false;
    }
    ta.remove();
    return ok;
  }
}

export function makeInitialDB(): DB {
  const settings: Settings = {
    orgName: ORG_NAME,
    workingDays: [false, true, true, true, true, true, false],
    holidays: [],
    ignoredHolidays: [],
    sheetUrl: "",
  };
  return { loans: [], payments: [], settings, seq: 0 };
}
