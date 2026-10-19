/* ============================================================
   Security layer - input sanitization, validation & escaping.
   ============================================================ */

import type { DB, Loan, Payment } from "./data";

const KHMER_DIGITS = ["០", "១", "២", "៣", "៤", "៥", "៦", "៧", "៨", "៩"] as const;

/**
 * Converts any Khmer digits (០-៩) in a string into standard Global/English digits (0-9).
 * Leaves standard digits (0-9) and all other characters intact.
 */
export function khmerToGlobalDigits(input: string): string {
  if (!input) return "";
  return input.replace(/[០-៩]/g, (ch) => {
    const idx = KHMER_DIGITS.indexOf(ch as (typeof KHMER_DIGITS)[number]);
    return idx !== -1 ? String(idx) : ch;
  });
}

/**
 * Sanitizes numeric string input by converting Khmer digits to English digits
 * and keeping only digits and an optional decimal point.
 */
export function sanitizeNumericInput(input: string, allowDecimal = true): string {
  const converted = khmerToGlobalDigits(input).replace(/,/g, "");
  if (!allowDecimal) {
    return converted.replace(/[^\d]/g, "");
  }
  const cleaned = converted.replace(/[^\d.]/g, "");
  const parts = cleaned.split(".");
  if (parts.length <= 2) return cleaned;
  return `${parts[0]}.${parts.slice(1).join("")}`;
}

/**
 * Installs global capture-phase event listeners for `input` and `paste` across the entire document.
 * Automatically converts Khmer digits (០-៩) to standard global digits (0-9) in any <input> or <textarea>
 * while preserving cursor selection and notifying React controlled state.
 */
export function installGlobalKhmerDigitConverter(): () => void {
  if (typeof document === "undefined") return () => {};

  const applyNativeValue = (el: HTMLInputElement | HTMLTextAreaElement, nextVal: string) => {
    const proto =
      el instanceof HTMLTextAreaElement
        ? window.HTMLTextAreaElement.prototype
        : window.HTMLInputElement.prototype;
    const setter = Object.getOwnPropertyDescriptor(proto, "value")?.set;
    if (setter) {
      setter.call(el, nextVal);
    } else {
      el.value = nextVal;
    }
  };

  const handleInput = (e: Event) => {
    const target = e.target;
    if (!(target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement)) return;
    if (target.type === "file" || target.type === "checkbox" || target.type === "radio" || target.type === "date") {
      return;
    }
    const raw = target.value;
    if (!raw || !/[០-៩]/.test(raw)) return;

    const converted = khmerToGlobalDigits(raw);
    if (converted === raw) return;

    const start = target.selectionStart;
    const end = target.selectionEnd;
    applyNativeValue(target, converted);
    try {
      if (start !== null && end !== null) {
        target.setSelectionRange(start, end);
      }
    } catch {
      /* ignore for input types that do not support selectionRange */
    }
    target.dispatchEvent(new Event("input", { bubbles: true }));
  };

  const handlePaste = (e: ClipboardEvent) => {
    const target = e.target;
    if (!(target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement)) return;
    if (target.type === "file" || target.type === "checkbox" || target.type === "radio") return;

    const pasted = e.clipboardData?.getData("text");
    if (!pasted || !/[០-៩]/.test(pasted)) return;

    e.preventDefault();
    const convertedPaste = khmerToGlobalDigits(pasted);
    const current = target.value || "";
    let start = current.length;
    let end = current.length;
    try {
      if (typeof target.selectionStart === "number") start = target.selectionStart;
      if (typeof target.selectionEnd === "number") end = target.selectionEnd;
    } catch {
      /* ignore */
    }

    const nextVal = khmerToGlobalDigits(current.slice(0, start) + convertedPaste + current.slice(end));
    applyNativeValue(target, nextVal);
    try {
      const nextCursor = start + convertedPaste.length;
      target.setSelectionRange(nextCursor, nextCursor);
    } catch {
      /* ignore */
    }
    target.dispatchEvent(new Event("input", { bubbles: true }));
  };

  document.addEventListener("input", handleInput, true);
  document.addEventListener("paste", handlePaste, true);
  return () => {
    document.removeEventListener("input", handleInput, true);
    document.removeEventListener("paste", handlePaste, true);
  };
}

export function sanitizeText(input: unknown, max = 120): string {
  if (typeof input !== "string") return "";
  return khmerToGlobalDigits(input)
    .replace(/[\u0000-\u001F\u007F\u200B-\u200D\uFEFF]/g, "")
    .replace(/[<>]/g, "")
    .replace(/\s{2,}/g, " ")
    .trim()
    .slice(0, max);
}

export function sanitizePhone(input: unknown): string {
  if (typeof input !== "string") return "";
  return khmerToGlobalDigits(input)
    .replace(/[^\d+\-\s]/g, "")
    .replace(/\s{2,}/g, " ")
    .trim()
    .slice(0, 20);
}

export function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export function isValidSheetUrl(url: string): boolean {
  if (!url) return true;
  try {
    const u = new URL(url);
    return u.protocol === "https:";
  } catch {
    return false;
  }
}

export function isISODate(s: unknown): s is string {
  return (
    typeof s === "string" &&
    /^\d{4}-\d{2}-\d{2}$/.test(s) &&
    !isNaN(new Date(s + "T00:00:00").getTime())
  );
}

export function toPositiveNumber(v: unknown, max = 1e12): number | null {
  const n = typeof v === "string" ? parseFloat(khmerToGlobalDigits(v)) : (v as number);
  if (typeof n !== "number" || !Number.isFinite(n) || n <= 0 || n > max) return null;
  return n;
}

export function toNonNegativeNumber(v: unknown, max = 1e9): number | null {
  const n = typeof v === "string" ? parseFloat(khmerToGlobalDigits(v)) : (v as number);
  if (typeof n !== "number" || !Number.isFinite(n) || n < 0 || n > max) return null;
  return n;
}

export function toPositiveInt(v: unknown, max = 10000): number | null {
  const n = typeof v === "string" ? parseInt(khmerToGlobalDigits(v), 10) : (v as number);
  if (typeof n !== "number" || !Number.isInteger(n) || n < 1 || n > max) return null;
  return n;
}

export function validateDB(parsed: unknown): parsed is DB {
  if (!parsed || typeof parsed !== "object") return false;
  const d = parsed as DB;
  if (!Array.isArray(d.loans) || !Array.isArray(d.payments)) return false;
  if (!d.settings || typeof d.settings !== "object") return false;
  if (
    !Array.isArray(d.settings.workingDays) ||
    d.settings.workingDays.length !== 7 ||
    !d.settings.workingDays.every((b) => typeof b === "boolean")
  )
    return false;
  if (
    !Array.isArray(d.settings.holidays) ||
    !d.settings.holidays.every(
      (h) => h && typeof h.name === "string" && h.name.length <= 120 && isISODate(h.date)
    )
  )
    return false;
  if (
    d.settings.ignoredHolidays !== undefined &&
    (!Array.isArray(d.settings.ignoredHolidays) ||
      !d.settings.ignoredHolidays.every((x) => isISODate(x)))
  )
    return false;
  if (d.settings.sheetUrl !== undefined && typeof d.settings.sheetUrl !== "string") return false;

  const okLoan = (l: Loan) =>
    !!l &&
    typeof l.id === "string" &&
    typeof l.code === "string" &&
    typeof l.customer === "string" &&
    l.customer.length > 0 &&
    l.customer.length <= 120 &&
    typeof l.phone === "string" &&
    l.phone.length <= 30 &&
    (l.type === "daily" || l.type === "monthly") &&
    Number.isFinite(l.principal) &&
    l.principal > 0 &&
    l.principal <= 1e12 &&
    Number.isFinite(l.interest) &&
    l.interest >= 0 &&
    l.interest <= 1e6 &&
    Number.isInteger(l.term) &&
    l.term >= 1 &&
    l.term <= 10000 &&
    (l.sameDay === undefined || typeof l.sameDay === "boolean") &&
    isISODate(l.startDate) &&
    isISODate(l.createdAt);

  if (!d.loans.every(okLoan)) return false;

  const okPay = (p: Payment) =>
    !!p &&
    typeof p.id === "string" &&
    typeof p.loanId === "string" &&
    Number.isInteger(p.inst) &&
    p.inst >= 0 &&
    p.inst < 10000 &&
    Number.isFinite(p.amount) &&
    p.amount > 0 &&
    p.amount <= 1e12 &&
    isISODate(p.date);

  return d.payments.every(okPay);
}
