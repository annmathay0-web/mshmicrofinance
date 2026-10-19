import { useEffect, useMemo, useState } from "react";
import jsPDF from "jspdf";
import html2canvas from "html2canvas";
import type { DB, Inst, Loan, LoanStats } from "../lib/data";
import { fmt, fmtKH, round2, todayISO, transitArrears } from "../lib/data";
import { fmtLunarShort } from "../lib/khmerDate";
import { MSHLogo } from "./ui";

const STATUS_TEXT: Record<Inst["status"], string> = {
  paid: "បង់រួច",
  partial: "ជំពាក់ខ្វះ",
  overdue: "ហួសកំណត់",
  today: "ដល់ថ្ងៃនេះ",
  upcoming: "មិនទាន់ដល់",
};

interface SchedulePrintProps {
  loan: Loan;
  st: LoanStats;
  db: DB;
  onClose: () => void;
}

/**
 * Sanitizes all elements inside the cloned node so html2canvas NEVER encounters
 * modern CSS color functions like oklch() or color-mix().
 */
function sanitizeClonedDOMForPDF(clonedRoot: HTMLElement) {
  const elements = clonedRoot.querySelectorAll("*");
  elements.forEach((node) => {
    const el = node as HTMLElement;
    const computed = window.getComputedStyle(el);
    if (computed.color && computed.color.includes("oklch")) {
      el.style.color = "#0f172a";
    }
    if (computed.backgroundColor && computed.backgroundColor.includes("oklch")) {
      el.style.backgroundColor = "transparent";
    }
    if (computed.borderColor && computed.borderColor.includes("oklch")) {
      el.style.borderColor = "#cbd5e1";
    }
    if (computed.outlineColor && computed.outlineColor.includes("oklch")) {
      el.style.outlineColor = "transparent";
    }
  });
}

/**
 * Multi-Page A4 Printable Repayment Schedule with Large Readable Typography.
 * - Zero forced single-page compression: naturally spans across 1, 2, or more A4 pages.
 * - Repeats table headers cleanly at the top of each page in both PDF export and browser print.
 * - Large, clear Khmer & numeric fonts for easy customer readability.
 * - 100% OKLCH-Free Hex colors for html2canvas compatibility.
 */
export default function SchedulePrint({ loan, st, db, onClose }: SchedulePrintProps) {
  const [generating, setGenerating] = useState(false);
  const [statusMsg, setStatusMsg] = useState<string | null>(null);
  const [pdfReady, setPdfReady] = useState<{
    blob: Blob;
    file: File;
    url: string;
    fileName: string;
  } | null>(null);

  const first = st.schedule[0];
  const last = st.schedule[st.schedule.length - 1];
  const arrears = transitArrears(st);
  const cleanCustomer = loan.customer.replace(/[/\\?%*:|"<>]/g, "_").trim();
  const defaultFileName = `MSH-Schedule-${loan.code}-${cleanCustomer}.pdf`;

  // Split schedule into comfortable multi-page chunks so each page has repeating headers,
  // large readable fonts (11px-12px), and generous row padding without ever squishing.
  // Page 1 holds up to 18 rows (alongside the customer summary card); subsequent pages hold up to 24 rows.
  const pageChunks = useMemo(() => {
    const rows = st.schedule;
    if (rows.length === 0) return [[] as Inst[]];
    const firstPageMax = 18;
    const nextPageMax = 24;

    if (rows.length <= firstPageMax) {
      return [rows];
    }

    const pages: Inst[][] = [rows.slice(0, firstPageMax)];
    let cursor = firstPageMax;
    while (cursor < rows.length) {
      pages.push(rows.slice(cursor, cursor + nextPageMax));
      cursor += nextPageMax;
    }
    return pages;
  }, [st.schedule]);

  const totalPages = pageChunks.length;

  // Isolate print target during the time this view is active
  useEffect(() => {
    document.body.classList.add("printing-schedule");
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      document.body.classList.remove("printing-schedule");
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [onClose]);

  useEffect(() => {
    return () => {
      if (pdfReady?.url) {
        URL.revokeObjectURL(pdfReady.url);
      }
    };
  }, [pdfReady]);

  const canNativeShareFile = (file: File): boolean => {
    try {
      const nav = navigator as Navigator & {
        canShare?: (data?: ShareData) => boolean;
      };
      return (
        typeof nav.share === "function" &&
        typeof nav.canShare === "function" &&
        nav.canShare({ files: [file] })
      );
    } catch {
      return false;
    }
  };

  const triggerBlobDownload = (blob: Blob, fileName: string) => {
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = fileName;
    a.rel = "noopener";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.setTimeout(() => URL.revokeObjectURL(url), 15000);
  };

  /**
   * Builds a multi-page A4 PDF Blob & File from each `.a4-schedule-page` inside `#print-schedule`.
   * Never compresses or shrinks long schedules onto a single page; each page is rendered at full A4 width
   * with large, crisp typography and repeating table headers.
   */
  const buildMultiPageA4Blob = async (): Promise<{
    blob: Blob;
    file: File;
    url: string;
    fileName: string;
  } | null> => {
    const container = document.getElementById("print-schedule");
    if (!container) return null;

    const pageNodes = Array.from(
      container.querySelectorAll<HTMLElement>(".a4-schedule-page")
    );
    const targets = pageNodes.length > 0 ? pageNodes : [container];

    const pdf = new jsPDF({
      orientation: "p",
      unit: "mm",
      format: "a4",
      compress: true,
    });

    const pageWidth = pdf.internal.pageSize.getWidth(); // 210mm
    const marginX = 8; // 8mm left/right margin
    const marginY = 8; // 8mm top/bottom margin
    const contentW = pageWidth - marginX * 2; // 194mm

    for (let idx = 0; idx < targets.length; idx++) {
      const pageEl = targets[idx];
      const canvas = await html2canvas(pageEl, {
        scale: 2,
        useCORS: true,
        logging: false,
        backgroundColor: "#ffffff",
        windowWidth: 920,
        scrollX: 0,
        scrollY: 0,
        onclone: (clonedDoc: Document) => {
          const root = clonedDoc.getElementById("print-schedule");
          if (root) {
            sanitizeClonedDOMForPDF(root);
          }
        },
      });

      const imgData = canvas.toDataURL("image/jpeg", 0.96);
      const renderW = contentW;
      const renderH = (canvas.height * renderW) / canvas.width;

      if (idx > 0) {
        pdf.addPage("a4", "p");
      }
      pdf.addImage(imgData, "JPEG", marginX, marginY, renderW, renderH, undefined, "FAST");
    }

    const blob = pdf.output("blob");
    const file = new File([blob], defaultFileName, {
      type: "application/pdf",
      lastModified: Date.now(),
    });
    const url = URL.createObjectURL(blob);
    if (pdfReady?.url) {
      URL.revokeObjectURL(pdfReady.url);
    }
    const pack = { blob, file, url, fileName: defaultFileName };
    setPdfReady(pack);
    return pack;
  };

  const handleGenerateAndAction = async (mode: "auto" | "share" | "download") => {
    if (generating) return;
    setGenerating(true);
    setStatusMsg("កំពុងបង្កើតឯកសារ PDF A4...");
    const timeoutGuard = window.setTimeout(() => {
      setGenerating(false);
      setStatusMsg(null);
    }, 8000);

    try {
      const pack = pdfReady ?? (await buildMultiPageA4Blob());
      if (!pack) throw new Error("Unable to generate PDF");

      const canShare = canNativeShareFile(pack.file);
      if ((mode === "share" || mode === "auto") && canShare) {
        try {
          await navigator.share({
            files: [pack.file],
            title: `កាលវិភាគសងប្រាក់ - ${loan.customer} (${loan.code})`,
            text: `កាលវិភាគសងប្រាក់ផ្លូវការ ${db.settings.orgName || "MSH Microfinance"} សម្រាប់ ${loan.customer} (${loan.code})`,
          });
          setStatusMsg("បានចែករំលែក PDF ដោយជោគជ័យ!");
          window.setTimeout(() => setStatusMsg(null), 2800);
          return;
        } catch (shareErr: unknown) {
          const isAbort =
            shareErr instanceof Error &&
            (shareErr.name === "AbortError" || shareErr.message.toLowerCase().includes("cancel"));
          if (isAbort) {
            setStatusMsg("បានបោះបង់ការចែករំលែក PDF");
            window.setTimeout(() => setStatusMsg(null), 3000);
            return;
          }
          // If share failed for technical reasons, fall through to direct download
        }
      }

      // Direct file download fallback
      triggerBlobDownload(pack.blob, pack.fileName);
      setStatusMsg("បានទាញយកឯកសារ PDF រួចរាល់!");
      window.setTimeout(() => setStatusMsg(null), 3000);
    } catch (err) {
      console.error("PDF generation fallback trigger:", err);
      setStatusMsg("កំពុងបើកផ្ទាំងបោះពុម្ព...");
      window.setTimeout(() => {
        window.print();
        setStatusMsg(null);
        setGenerating(false);
      }, 250);
    } finally {
      window.clearTimeout(timeoutGuard);
      setGenerating(false);
    }
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-navy-950/85 backdrop-blur-md overflow-y-auto print:bg-white print:p-0 print:overflow-visible print:block">
      {/* Top Floating Control Bar (Hidden when printing) */}
      <div className="pt-safe-header sticky top-0 z-20 flex flex-wrap items-center justify-between gap-2 border-b border-white/10 bg-navy-900/95 px-3.5 py-2.5 sm:px-6 sm:py-3 text-white backdrop-blur-md shadow-lg print:hidden">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gold-gradient text-navy-950 font-black shadow-md shadow-gold-500/20">
            <i className="fa-solid fa-file-pdf text-sm sm:text-base text-navy-900" />
          </div>
          <div className="min-w-0">
            <h3 className="text-xs sm:text-sm font-bold text-white truncate flex items-center gap-1.5">
              <span>កាលវិភាគ A4 ({totalPages} ទំព័រ)</span>
              {statusMsg && (
                <span className="text-[10px] sm:text-[11px] font-semibold text-gold-300 anim-fade-in hidden md:inline">
                  • {statusMsg}
                </span>
              )}
            </h3>
            <p className="text-[10px] sm:text-[11px] text-navy-200 truncate">
              {loan.code} • {loan.customer}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-1.5 sm:gap-2 shrink-0 ml-auto">
          {/* Primary Action: Native Share / Save PDF */}
          <button
            type="button"
            onClick={() => void handleGenerateAndAction("auto")}
            disabled={generating}
            className="tap-press flex items-center gap-1.5 rounded-xl bg-gold-gradient px-3.5 py-2.5 text-xs font-black text-navy-950 shadow-md shadow-gold-500/25 hover:brightness-105 disabled:opacity-50 min-h-[44px] whitespace-nowrap"
          >
            {generating ? (
              <i className="fa-solid fa-circle-notch fa-spin text-xs sm:text-sm" />
            ) : (
              <i className="fa-solid fa-share-from-square text-xs sm:text-sm" />
            )}
            <span>{generating ? "កំពុងរៀបចំ..." : "ចែករំលែក PDF"}</span>
          </button>

          {/* Direct Download Button */}
          <button
            type="button"
            onClick={() => void handleGenerateAndAction("download")}
            disabled={generating}
            title="ទាញយក PDF ផ្ទាល់ (Direct Download)"
            className="tap-press flex items-center gap-1.5 rounded-xl bg-emerald-500 hover:bg-emerald-600 px-3 py-2.5 text-xs font-bold text-white shadow-xs disabled:opacity-50 min-h-[44px] whitespace-nowrap"
          >
            <i className="fa-solid fa-download text-xs" />
            <span className="hidden sm:inline">ទាញយក PDF</span>
          </button>

          {/* Browser Print dialog */}
          <button
            type="button"
            onClick={handlePrint}
            title="បោះពុម្ពតាម Browser (Print)"
            className="tap-press hidden md:flex items-center gap-1.5 rounded-xl border border-white/20 bg-white/10 hover:bg-white/15 px-3 py-2.5 text-xs font-bold text-white min-h-[44px] whitespace-nowrap"
          >
            <i className="fa-solid fa-print text-gold-400" />
            <span>បោះពុម្ព</span>
          </button>

          {/* Close modal */}
          <button
            type="button"
            onClick={onClose}
            className="tap-press flex h-11 w-11 sm:w-auto items-center justify-center rounded-xl border border-white/20 bg-white/10 sm:px-3.5 py-2.5 text-xs font-bold text-white hover:bg-white/20 min-h-[44px]"
            title="បិទ (Close)"
          >
            <i className="fa-solid fa-xmark sm:mr-1.5" />
            <span className="hidden sm:inline">បិទ</span>
          </button>
        </div>
      </div>

      {/* Mobile Status & Action Banner (Appears when PDF is generated or status updates) */}
      {(statusMsg || pdfReady) && (
        <div className="bg-navy-900/95 border-b border-gold-400/30 px-4 py-2.5 text-white anim-fade-in print:hidden">
          <div className="max-w-[780px] mx-auto flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2 text-xs font-bold text-gold-300 min-w-0">
              <i className="fa-solid fa-circle-check text-emerald-400 shrink-0" />
              <span className="truncate">
                {statusMsg || `ឯកសារ PDF រួចរាល់៖ ${pdfReady?.fileName}`}
              </span>
            </div>
            {pdfReady && (
              <div className="flex items-center gap-2 w-full sm:w-auto">
                <button
                  type="button"
                  onClick={() => triggerBlobDownload(pdfReady.blob, pdfReady.fileName)}
                  className="tap-press flex-1 sm:flex-initial flex items-center justify-center gap-1.5 rounded-xl bg-emerald-500 hover:bg-emerald-600 px-3.5 py-2 text-xs font-bold text-white shadow-xs min-h-[44px] whitespace-nowrap"
                >
                  <i className="fa-solid fa-file-arrow-down" />
                  <span>ទាញយក PDF (Download)</span>
                </button>
                <button
                  type="button"
                  onClick={() => void handleGenerateAndAction("share")}
                  className="tap-press flex-1 sm:flex-initial flex items-center justify-center gap-1.5 rounded-xl bg-gold-gradient px-3.5 py-2 text-xs font-black text-navy-950 shadow-xs min-h-[44px] whitespace-nowrap"
                >
                  <i className="fa-solid fa-share-nodes" />
                  <span>ចែករំលែក (Share)</span>
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Dedicated Multi-Page A4 Sheet Preview Container (Large Readable Fonts, Zero Single-Page Compression) */}
      <div className="flex-1 w-full overflow-x-auto p-3 sm:p-6 flex justify-start sm:justify-center items-start print:p-0 print:m-0 print:overflow-visible print:block">
        <div
          id="print-schedule"
          style={{
            width: "780px",
            minWidth: "780px",
            maxWidth: "780px",
            margin: "0 auto",
            boxSizing: "border-box",
          }}
          className="shrink-0 mx-auto space-y-6 print:space-y-0 print:w-full print:min-w-0 print:max-w-none print:p-0 print:m-0"
        >
          {pageChunks.map((rowsChunk, pageIdx) => {
            const isFirstPage = pageIdx === 0;
            const isLastPage = pageIdx === totalPages - 1;

            return (
              <div
                key={pageIdx}
                style={{
                  width: "780px",
                  minWidth: "780px",
                  maxWidth: "780px",
                  padding: "20px 22px",
                  boxSizing: "border-box",
                  backgroundColor: "#ffffff",
                  color: "#0f172a",
                  borderColor: "#cbd5e1",
                  pageBreakAfter: isLastPage ? "auto" : "always",
                  breakAfter: isLastPage ? "auto" : "page",
                }}
                className="a4-schedule-page rounded-xl border shadow-xl print:w-full print:min-w-0 print:max-w-none print:border-none print:shadow-none print:p-0 print:m-0"
              >
                {/* Official Repeating Brand Header on Every Page */}
                <div
                  style={{ borderBottom: "2px solid #0b192c", width: "100%", boxSizing: "border-box" }}
                  className="flex items-center justify-between gap-4 pb-3"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <MSHLogo className="h-12 w-12 rounded-xl shadow-xs shrink-0" />
                    <div className="min-w-0">
                      <h1
                        style={{ color: "#071224", lineHeight: "1.35" }}
                        className="text-lg font-black uppercase tracking-wide"
                      >
                        {db.settings.orgName || "MSH Microfinance"}
                      </h1>
                      <p style={{ color: "#475569", lineHeight: "1.45" }} className="text-[11px] font-semibold mt-0.5">
                        ប្រព័ន្ធគ្រប់គ្រងឥណទាន • Loan Management System
                      </p>
                    </div>
                  </div>

                  {/* Right Header Lockup */}
                  <div className="flex items-center gap-3 shrink-0">
                    <div className="text-right">
                      <div
                        style={{ color: "#071224", lineHeight: "1.35" }}
                        className="text-base sm:text-lg font-extrabold whitespace-nowrap"
                      >
                        តារាងកាលវិភាគសងប្រាក់
                      </div>
                      <p
                        style={{ color: "#64748b", lineHeight: "1.35" }}
                        className="text-[10px] uppercase font-bold tracking-wider mt-0.5 whitespace-nowrap"
                      >
                        Official Repayment Schedule • {pageIdx + 1}/{totalPages}
                      </p>
                    </div>
                    <span
                      style={{
                        border: "1.5px solid #0b192c",
                        backgroundColor: "#f8fafc",
                        color: "#071224",
                        lineHeight: "1",
                      }}
                      className="font-num inline-flex items-center justify-center rounded-lg px-3 py-2 text-xs font-extrabold whitespace-nowrap shrink-0 self-center"
                    >
                      {loan.code}
                    </span>
                  </div>
                </div>

                {/* Page 1: Full Spacious Customer & Loan Summary Table */}
                {isFirstPage ? (
                  <div
                    style={{
                      backgroundColor: "#f8fafc",
                      border: "1px solid #cbd5e1",
                      width: "100%",
                      boxSizing: "border-box",
                    }}
                    className="mt-3.5 rounded-lg overflow-hidden"
                  >
                    {/* Row 1: Customer Identity & Contract Terms */}
                    <div
                      style={{ borderBottom: "1px solid #e2e8f0" }}
                      className="grid grid-cols-4 gap-4 px-4 py-3"
                    >
                      <div className="min-w-0">
                        <div style={{ color: "#64748b", lineHeight: "1.4" }} className="text-[10px] font-semibold">
                          ឈ្មោះអតិថិជន (Borrower)
                        </div>
                        <div
                          style={{ color: "#071224", lineHeight: "1.5" }}
                          className="mt-0.5 text-xs font-extrabold break-words"
                        >
                          {loan.customer}
                        </div>
                      </div>
                      <div className="min-w-0">
                        <div style={{ color: "#64748b", lineHeight: "1.4" }} className="text-[10px] font-semibold">
                          លេខទូរស័ព្ទ (Phone)
                        </div>
                        <div
                          style={{ color: "#0f172a", lineHeight: "1.5" }}
                          className="mt-0.5 font-num text-xs font-bold break-words"
                        >
                          {loan.phone}
                        </div>
                      </div>
                      <div className="min-w-0">
                        <div style={{ color: "#64748b", lineHeight: "1.4" }} className="text-[10px] font-semibold">
                          ប្រភេទកម្ចី (Loan Type)
                        </div>
                        <div
                          style={{ color: "#0f172a", lineHeight: "1.5" }}
                          className="mt-0.5 text-xs font-bold"
                        >
                          {loan.type === "daily" ? "បង់រាល់ថ្ងៃ (Daily)" : "បង់ប្រចាំខែ (Monthly)"}
                        </div>
                      </div>
                      <div className="min-w-0">
                        <div style={{ color: "#64748b", lineHeight: "1.4" }} className="text-[10px] font-semibold">
                          រយៈពេល (Term)
                        </div>
                        <div
                          style={{ color: "#0f172a", lineHeight: "1.5" }}
                          className="mt-0.5 font-num text-xs font-bold"
                        >
                          {loan.term} {loan.type === "daily" ? "ថ្ងៃ (Days)" : "ខែ (Months)"}
                        </div>
                      </div>
                    </div>

                    {/* Row 2: Principal, Interest, Installment Amount, Total Repayable */}
                    <div
                      style={{ borderBottom: "1px solid #e2e8f0", backgroundColor: "#ffffff" }}
                      className="grid grid-cols-4 gap-4 px-4 py-3"
                    >
                      <div className="min-w-0">
                        <div style={{ color: "#64748b", lineHeight: "1.4" }} className="text-[10px] font-semibold">
                          ប្រាក់ដើម (Principal)
                        </div>
                        <div
                          style={{ color: "#071224", lineHeight: "1.5" }}
                          className="mt-0.5 font-num text-xs font-extrabold"
                        >
                          {fmt(loan.principal)}
                        </div>
                      </div>
                      <div className="min-w-0">
                        <div style={{ color: "#64748b", lineHeight: "1.4" }} className="text-[10px] font-semibold">
                          ការប្រាក់ (Interest)
                        </div>
                        <div
                          style={{ color: "#0f172a", lineHeight: "1.5" }}
                          className="mt-0.5 font-num text-xs font-bold break-words"
                        >
                          {loan.type === "daily"
                            ? fmt(loan.interest)
                            : `${loan.interest}%/ខែ (${fmt(round2(loan.principal * (loan.interest / 100) * loan.term))})`}
                        </div>
                      </div>
                      <div className="min-w-0">
                        <div style={{ color: "#64748b", lineHeight: "1.4" }} className="text-[10px] font-semibold">
                          បង់មួយលើក (Per Inst.)
                        </div>
                        <div
                          style={{ color: "#b45309", lineHeight: "1.5" }}
                          className="mt-0.5 font-num text-xs font-extrabold"
                        >
                          {first ? fmt(first.amount) : "0 ៛"}
                        </div>
                      </div>
                      <div className="min-w-0">
                        <div style={{ color: "#64748b", lineHeight: "1.4" }} className="text-[10px] font-semibold">
                          សរុបត្រូវបង់ (Total Due)
                        </div>
                        <div
                          style={{ color: "#071224", lineHeight: "1.5" }}
                          className="mt-0.5 font-num text-xs font-extrabold"
                        >
                          {fmt(st.totalDue)}
                        </div>
                      </div>
                    </div>

                    {/* Row 3: Paid, Remaining, Status, Print Date */}
                    <div
                      style={{ borderBottom: "1px solid #e2e8f0" }}
                      className="grid grid-cols-4 gap-4 px-4 py-3"
                    >
                      <div className="min-w-0">
                        <div style={{ color: "#64748b", lineHeight: "1.4" }} className="text-[10px] font-semibold">
                          បានបង់សរុប (Total Paid)
                        </div>
                        <div
                          style={{ color: "#047857", lineHeight: "1.5" }}
                          className="mt-0.5 font-num text-xs font-extrabold"
                        >
                          {fmt(st.totalPaid)}
                        </div>
                      </div>
                      <div className="min-w-0">
                        <div style={{ color: "#64748b", lineHeight: "1.4" }} className="text-[10px] font-semibold">
                          នៅសល់ (Remaining)
                        </div>
                        <div
                          style={{ color: st.remaining > 0.005 ? "#b91c1c" : "#047857", lineHeight: "1.5" }}
                          className="mt-0.5 font-num text-xs font-extrabold"
                        >
                          {fmt(st.remaining)}
                        </div>
                      </div>
                      <div className="min-w-0">
                        <div style={{ color: "#64748b", lineHeight: "1.4" }} className="text-[10px] font-semibold">
                          ស្ថានភាព (Status)
                        </div>
                        <div
                          style={{ color: st.done ? "#047857" : "#b45309", lineHeight: "1.5" }}
                          className="mt-0.5 text-xs font-extrabold"
                        >
                          {st.done ? "រួចរាល់ (Settled)" : `កំពុងដំណើរការ (${st.paidCount}/${loan.term})`}
                        </div>
                      </div>
                      <div className="min-w-0">
                        <div style={{ color: "#64748b", lineHeight: "1.4" }} className="text-[10px] font-semibold">
                          កាលបរិច្ឆេទចេញ (Issued Date)
                        </div>
                        <div
                          style={{ color: "#0f172a", lineHeight: "1.5" }}
                          className="mt-0.5 text-xs font-bold"
                        >
                          {fmtKH(todayISO())}
                        </div>
                      </div>
                    </div>

                    {/* Row 4: Full-Width Disbursement & Maturity Dates with Khmer Lunar Calendar */}
                    <div
                      style={{ backgroundColor: "#ffffff" }}
                      className="grid grid-cols-2 gap-4 px-4 py-2.5"
                    >
                      <div className="min-w-0 flex items-baseline gap-1.5 flex-wrap text-[11px]" style={{ lineHeight: "1.5" }}>
                        <span style={{ color: "#64748b" }} className="font-semibold">
                          ថ្ងៃបើកប្រាក់កម្ចី:
                        </span>
                        <strong style={{ color: "#0f172a" }} className="font-bold">
                          {fmtKH(loan.startDate)}
                        </strong>
                        <span style={{ color: "#b45309" }} className="font-semibold text-[10px]">
                          ({fmtLunarShort(loan.startDate)})
                        </span>
                      </div>
                      <div className="min-w-0 flex items-baseline gap-1.5 flex-wrap text-[11px]" style={{ lineHeight: "1.5" }}>
                        <span style={{ color: "#64748b" }} className="font-semibold">
                          ថ្ងៃបញ្ចប់កិច្ចសន្យា:
                        </span>
                        <strong style={{ color: "#0f172a" }} className="font-bold">
                          {last ? fmtKH(last.due) : "—"}
                        </strong>
                        {last && (
                          <span style={{ color: "#b45309" }} className="font-semibold text-[10px]">
                            ({fmtLunarShort(last.due)})
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                ) : (
                  /* Page 2+: Compact Continuation Borrower Bar */
                  <div
                    style={{
                      backgroundColor: "#f8fafc",
                      border: "1px solid #cbd5e1",
                      width: "100%",
                      boxSizing: "border-box",
                      lineHeight: "1.5",
                    }}
                    className="mt-3 rounded-lg px-4 py-2.5 flex items-center justify-between text-xs"
                  >
                    <div className="flex items-center gap-4">
                      <span>
                        <span style={{ color: "#64748b" }} className="font-semibold">អតិថិជន:</span>{" "}
                        <strong style={{ color: "#071224" }} className="font-extrabold">{loan.customer}</strong>
                      </span>
                      <span>
                        <span style={{ color: "#64748b" }} className="font-semibold">ទូរស័ព្ទ:</span>{" "}
                        <strong style={{ color: "#0f172a" }} className="font-num font-bold">{loan.phone}</strong>
                      </span>
                      <span>
                        <span style={{ color: "#64748b" }} className="font-semibold">បង់មួយលើក:</span>{" "}
                        <strong style={{ color: "#b45309" }} className="font-num font-extrabold">
                          {first ? fmt(first.amount) : "0 ៛"}
                        </strong>
                      </span>
                    </div>
                    <span style={{ color: "#475569" }} className="font-bold text-[11px]">
                      តារាងបន្ត (លើកទី #{rowsChunk[0]?.i + 1} ដល់ #{rowsChunk[rowsChunk.length - 1]?.i + 1})
                    </span>
                  </div>
                )}

                {/* Large-Font, Customer-Readable Repayment Schedule Table with Repeating Header */}
                <table
                  style={{
                    width: "100%",
                    tableLayout: "fixed",
                    borderCollapse: "collapse",
                    borderColor: "#cbd5e1",
                    boxSizing: "border-box",
                    lineHeight: "1.5",
                  }}
                  className="mt-3.5 border text-[11px]"
                >
                  <colgroup>
                    <col style={{ width: "5%" }} />
                    <col style={{ width: "22%" }} />
                    <col style={{ width: "13%" }} />
                    <col style={{ width: "11%" }} />
                    <col style={{ width: "13%" }} />
                    <col style={{ width: "12%" }} />
                    <col style={{ width: "11%" }} />
                    <col style={{ width: "8%" }} />
                    <col style={{ width: "5%" }} />
                  </colgroup>
                  <thead style={{ display: "table-header-group" }}>
                    <tr
                      style={{
                        backgroundColor: "#0b192c",
                        color: "#ffffff",
                        textAlign: "center",
                        fontWeight: "bold",
                        pageBreakInside: "avoid",
                        breakInside: "avoid",
                      }}
                    >
                      <th style={{ border: "1px solid #cbd5e1", boxSizing: "border-box" }} className="py-2.5 px-1 text-center text-[11px]">
                        លើក
                      </th>
                      <th style={{ border: "1px solid #cbd5e1", boxSizing: "border-box" }} className="py-2.5 px-2 text-left text-[11px]">
                        កាលបរិច្ឆេទកំណត់
                      </th>
                      <th style={{ border: "1px solid #cbd5e1", boxSizing: "border-box" }} className="py-2.5 px-1.5 text-right text-[11px]">
                        ប្រាក់ត្រូវបង់
                      </th>
                      <th style={{ border: "1px solid #cbd5e1", boxSizing: "border-box" }} className="py-2.5 px-1.5 text-right text-[11px]">
                        ជំពាក់ខ្វះ (+)
                      </th>
                      <th style={{ border: "1px solid #cbd5e1", boxSizing: "border-box" }} className="py-2.5 px-1.5 text-right text-[11px]">
                        សរុបត្រូវបង់
                      </th>
                      <th style={{ border: "1px solid #cbd5e1", boxSizing: "border-box" }} className="py-2.5 px-1.5 text-right text-[11px]">
                        បានបង់ជាក់ស្តែង
                      </th>
                      <th style={{ border: "1px solid #cbd5e1", boxSizing: "border-box" }} className="py-2.5 px-1.5 text-right text-[11px]">
                        សមតុល្យនៅសល់
                      </th>
                      <th style={{ border: "1px solid #cbd5e1", boxSizing: "border-box" }} className="py-2.5 px-1 text-center text-[11px]">
                        ស្ថានភាព
                      </th>
                      <th style={{ border: "1px solid #cbd5e1", boxSizing: "border-box" }} className="py-2.5 px-1 text-center text-[11px]">
                        ធីក
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {rowsChunk.map((i, idx) => (
                      <tr
                        key={i.i}
                        style={{
                          backgroundColor: idx % 2 === 1 ? "#f8fafc" : "#ffffff",
                          pageBreakInside: "avoid",
                          breakInside: "avoid",
                        }}
                      >
                        <td
                          style={{ border: "1px solid #cbd5e1", color: "#334155", boxSizing: "border-box" }}
                          className="py-2 px-1 text-center font-num font-extrabold text-[11.5px]"
                        >
                          {i.i + 1}
                        </td>
                        <td style={{ border: "1px solid #cbd5e1", boxSizing: "border-box" }} className="py-2 px-2">
                          <span style={{ color: "#0f172a" }} className="font-bold text-[11.5px]">
                            {fmtKH(i.due)}
                          </span>
                          <span style={{ color: "#64748b" }} className="ml-1.5 text-[9.5px] font-medium">
                            ({fmtLunarShort(i.due)})
                          </span>
                        </td>
                        <td
                          style={{ border: "1px solid #cbd5e1", color: "#0f172a", boxSizing: "border-box" }}
                          className="py-2 px-1.5 text-right font-num font-bold text-[11.5px]"
                        >
                          {fmt(i.amount)}
                        </td>
                        <td style={{ border: "1px solid #cbd5e1", boxSizing: "border-box" }} className="py-2 px-1.5 text-right font-num">
                          {i.carriedIn > 0.005 ? (
                            <span style={{ color: "#b45309", fontWeight: "bold" }} className="text-[11px]">
                              +{fmt(i.carriedIn)}
                            </span>
                          ) : i.carriedIn < -0.005 ? (
                            <span style={{ color: "#047857", fontWeight: "bold" }} className="text-[11px]">
                              -{fmt(Math.abs(i.carriedIn))}
                            </span>
                          ) : (
                            <span style={{ color: "#94a3b8" }}>—</span>
                          )}
                        </td>
                        <td
                          style={{ border: "1px solid #cbd5e1", color: "#071224", boxSizing: "border-box" }}
                          className="py-2 px-1.5 text-right font-num font-extrabold text-[12px]"
                        >
                          {fmt(i.requiredDue ?? round2(Math.max(0, i.amount + i.carriedIn)))}
                        </td>
                        <td style={{ border: "1px solid #cbd5e1", boxSizing: "border-box" }} className="py-2 px-1.5 text-right font-num">
                          {i.paid > 0.005 ? (
                            <span style={{ color: "#047857", fontWeight: "bold" }} className="text-[11.5px]">
                              {fmt(i.paid)}
                            </span>
                          ) : (
                            <span style={{ color: "#94a3b8" }}>—</span>
                          )}
                        </td>
                        <td style={{ border: "1px solid #cbd5e1", boxSizing: "border-box" }} className="py-2 px-1.5 text-right font-num font-bold">
                          {i.shortage > 0.005 ? (
                            <span style={{ color: "#b45309" }} className="text-[11px]">ខ្វះ {fmt(i.shortage)}</span>
                          ) : i.balance > 0.005 ? (
                            <span style={{ color: "#b91c1c" }} className="text-[11.5px]">{fmt(i.balance)}</span>
                          ) : (
                            <span style={{ color: "#047857" }} className="text-[11.5px]">0 ៛</span>
                          )}
                        </td>
                        <td
                          style={{ border: "1px solid #cbd5e1", boxSizing: "border-box" }}
                          className="py-2 px-1 text-center font-bold text-[10px]"
                        >
                          {i.status === "paid" ? (
                            <span style={{ color: "#047857", fontWeight: "bold" }}>
                              {STATUS_TEXT.paid}
                            </span>
                          ) : i.status === "partial" ? (
                            <span style={{ color: "#b45309", fontWeight: "bold" }}>
                              ជំពាក់ខ្វះ
                            </span>
                          ) : i.status === "overdue" ? (
                            <span style={{ color: "#b91c1c", fontWeight: "bold" }}>
                              {STATUS_TEXT.overdue}
                            </span>
                          ) : i.status === "today" ? (
                            <span style={{ color: "#b45309", fontWeight: "bold" }}>
                              {STATUS_TEXT.today}
                            </span>
                          ) : (
                            <span style={{ color: "#64748b" }}>{STATUS_TEXT.upcoming}</span>
                          )}
                        </td>
                        <td style={{ border: "1px solid #cbd5e1", boxSizing: "border-box" }} className="py-2 px-1 text-center">
                          {i.status === "paid" ? (
                            <i style={{ color: "#047857" }} className="fa-solid fa-check text-xs" />
                          ) : (
                            <span
                              style={{ border: "1.5px solid #94a3b8" }}
                              className="inline-block h-3.5 w-3.5 rounded-xs align-middle"
                            />
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>

                  {/* Grand Total Footer appear on final page */}
                  {isLastPage && (
                    <tfoot style={{ display: "table-footer-group" }}>
                      <tr
                        style={{
                          backgroundColor: "#fef3c7",
                          color: "#0f172a",
                          fontWeight: "bold",
                          pageBreakInside: "avoid",
                          breakInside: "avoid",
                        }}
                      >
                        <td
                          colSpan={2}
                          style={{ border: "1px solid #cbd5e1", boxSizing: "border-box" }}
                          className="py-2.5 px-2 text-center font-extrabold text-xs"
                        >
                          សរុបរួម (Grand Total)
                        </td>
                        <td
                          style={{ border: "1px solid #cbd5e1", boxSizing: "border-box" }}
                          className="py-2.5 px-1.5 text-right font-num text-xs font-extrabold"
                        >
                          {fmt(st.totalDue)}
                        </td>
                        <td
                          style={{ border: "1px solid #cbd5e1", boxSizing: "border-box" }}
                          className="py-2.5 px-1.5 text-right font-num text-xs font-bold"
                        >
                          {arrears > 0.005 ? `+${fmt(arrears)}` : "—"}
                        </td>
                        <td
                          style={{ border: "1px solid #cbd5e1", boxSizing: "border-box" }}
                          className="py-2.5 px-1.5 text-right font-num text-xs font-extrabold"
                        >
                          {fmt(st.totalDue)}
                        </td>
                        <td
                          style={{ border: "1px solid #cbd5e1", color: "#047857", boxSizing: "border-box" }}
                          className="py-2.5 px-1.5 text-right font-num text-xs font-extrabold"
                        >
                          {fmt(st.totalPaid)}
                        </td>
                        <td
                          style={{ border: "1px solid #cbd5e1", color: "#b91c1c", boxSizing: "border-box" }}
                          className="py-2.5 px-1.5 text-right font-num text-xs font-extrabold"
                        >
                          {fmt(st.remaining)}
                        </td>
                        <td
                          colSpan={2}
                          style={{ border: "1px solid #cbd5e1", boxSizing: "border-box" }}
                          className="py-2.5 px-1 text-center text-[10px] font-bold"
                        >
                          {st.done ? "រួចរាល់" : `នៅសល់: ${fmt(st.remaining)}`}
                        </td>
                      </tr>
                    </tfoot>
                  )}
                </table>

                {/* Terms & Conditions and Signatures on Final Page */}
                {isLastPage && (
                  <>
                    <div
                      style={{
                        backgroundColor: "#f8fafc",
                        border: "1px solid #cbd5e1",
                        color: "#1e293b",
                        width: "100%",
                        boxSizing: "border-box",
                        pageBreakInside: "avoid",
                        breakInside: "avoid",
                      }}
                      className="print-avoid-break mt-4 rounded-lg p-3.5 text-[10.5px] leading-relaxed"
                    >
                      <div
                        className="flex items-center gap-1.5 font-extrabold mb-1.5 text-xs"
                        style={{ color: "#071224" }}
                      >
                        <i style={{ color: "#d97706" }} className="fa-solid fa-circle-exclamation text-xs" />
                        <span>លក្ខខណ្ឌសងប្រាក់ (Terms & Conditions)</span>
                      </div>
                      <ol className="list-decimal pl-5 space-y-1 text-[10.5px] leading-relaxed" style={{ color: "#1e293b" }}>
                        <li>
                          អតិថិជនត្រូវបង់ប្រាក់ឱ្យបានទៀងទាត់តាមកាលបរិច្ឆេទដែលបានកំណត់ក្នុងតារាងកាលវិភាគនេះ។
                        </li>
                        <li>
                          ករណីបង់ខ្វះ (Rollover Arrears) ចំនួនប្រាក់ដែលខ្វះនឹងត្រូវបង្វិលបញ្ចូលបន្ថែមជាមួយប្រាក់ត្រូវបង់នៃថ្ងៃបន្ទាប់ដោយស្វ័យប្រវត្តិ។
                        </li>
                        <li>
                          ករណីបង់លើស ចំនួនប្រាក់លើសនឹងត្រូវកាត់កងជា Advance Credit សម្រាប់លើកបន្ទាប់។
                        </li>
                      </ol>
                    </div>

                    {/* Signatures Grid */}
                    <div
                      style={{
                        width: "100%",
                        boxSizing: "border-box",
                        pageBreakInside: "avoid",
                        breakInside: "avoid",
                      }}
                      className="print-avoid-break mt-5 grid grid-cols-3 gap-4 px-2"
                    >
                      <div className="text-center">
                        <p style={{ color: "#0f172a", fontWeight: "bold" }} className="text-xs">
                          ប្រធានសាខា
                        </p>
                        <p style={{ color: "#64748b" }} className="text-[9px] uppercase font-semibold mt-0.5">
                          Branch Manager
                        </p>
                        <div style={{ borderTop: "1px solid #94a3b8" }} className="mx-auto mt-9 w-36" />
                        <p style={{ color: "#64748b" }} className="mt-1.5 text-[9.5px]">
                          កាលបរិច្ឆេទ: ...../...../..........
                        </p>
                      </div>
                      <div className="text-center">
                        <p style={{ color: "#0f172a", fontWeight: "bold" }} className="text-xs">
                          មន្ត្រីឥណទាន
                        </p>
                        <p style={{ color: "#64748b" }} className="text-[9px] uppercase font-semibold mt-0.5">
                          Credit Officer
                        </p>
                        <div style={{ borderTop: "1px solid #94a3b8" }} className="mx-auto mt-9 w-36" />
                        <p style={{ color: "#64748b" }} className="mt-1.5 text-[9.5px]">
                          កាលបរិច្ឆេទ: ...../...../..........
                        </p>
                      </div>
                      <div className="text-center">
                        <p style={{ color: "#0f172a", fontWeight: "bold" }} className="text-xs">
                          ហត្ថលេខាអតិថិជន
                        </p>
                        <p style={{ color: "#64748b" }} className="text-[9px] uppercase font-semibold mt-0.5">
                          Customer Signature
                        </p>
                        <div style={{ borderTop: "1px solid #94a3b8" }} className="mx-auto mt-9 w-36" />
                        <p style={{ color: "#64748b" }} className="mt-1.5 text-[9.5px]">
                          កាលបរិច្ឆេទ: ...../...../..........
                        </p>
                      </div>
                    </div>
                  </>
                )}

                {/* Clean Page Numbering & Document Footer on Every Page */}
                <div
                  style={{
                    width: "100%",
                    boxSizing: "border-box",
                    borderTop: "1px solid #cbd5e1",
                    color: "#475569",
                  }}
                  className="mt-4 pt-2.5 flex items-center justify-between text-[10px]"
                >
                  <div className="flex items-center gap-1.5">
                    <span className="font-semibold">{db.settings.orgName || "MSH Microfinance"}</span>
                    <span>•</span>
                    <span style={{ color: "#0f172a" }} className="font-num font-bold">{loan.code}</span>
                    <span>•</span>
                    <span>{loan.customer}</span>
                  </div>
                  <div style={{ color: "#0f172a" }} className="font-bold">
                    ទំព័រទី {pageIdx + 1} នៃ {totalPages}
                  </div>
                  <div>
                    <span>ចេញផ្សាយ៖ {fmtKH(todayISO())}</span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
