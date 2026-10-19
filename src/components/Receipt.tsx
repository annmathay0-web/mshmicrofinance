import { useEffect } from "react";
import { Modal, MSHLogo } from "./ui";
import { useApp, type PayResult } from "../lib/state";
import { fmt, fmtKHFull, ORG_NAME, scheduleOf, todayISO } from "../lib/data";
import type { Loan, Payment } from "../lib/data";
import { fmtLunar, fmtLunarShort } from "../lib/khmerDate";

export default function ReceiptModal({
  loan,
  payment,
  onClose,
}: {
  loan: Loan;
  payment: Payment;
  onClose: () => void;
}) {
  const { db } = useApp();
  const inst = scheduleOf(loan, db.payments, db.settings)[payment.inst];

  useEffect(() => {
    document.body.classList.add("printing-receipt");
    return () => document.body.classList.remove("printing-receipt");
  }, []);

  return (
    <Modal onClose={onClose} maxW="max-w-md">
      <div className="p-5 sm:p-6">
        {/* Printable Bank Slip */}
        <div
          id="print-slip"
          className="rounded-3xl border-2 border-dashed border-slate-200 bg-white p-6 sm:p-7 relative overflow-hidden shadow-xs"
        >
          {/* Watermark Seal */}
          <div className="absolute right-4 bottom-14 opacity-5 pointer-events-none select-none font-black text-7xl text-navy-950 -rotate-12">
            PAID
          </div>

          {/* Header Lockup */}
          <div className="flex items-center gap-3 border-b border-slate-100 pb-4">
            <MSHLogo className="h-12 w-12 shadow-xs" />
            <div className="flex-1 min-w-0">
              <p className="font-num text-sm sm:text-base font-black text-navy-950 leading-tight">
                {db.settings.orgName || ORG_NAME}
              </p>
              <p className="text-[11px] text-slate-400 font-medium">បង្កាន់ដៃទទួលប្រាក់ (Official Receipt)</p>
            </div>
            <span className="rounded-full bg-emerald-50 border border-emerald-200 px-3 py-1 text-[11px] font-bold text-emerald-700">
              បានបង់រួច
            </span>
          </div>

          <div className="mt-4 text-center">
            <p className="text-xs font-bold uppercase tracking-widest text-gold-600">Payment Receipt</p>
            <h3 className="text-lg font-black text-navy-950 mt-0.5">បង្កាន់ដៃទូទាត់ប្រាក់</h3>
          </div>

          <div className="mt-4 rounded-2xl bg-slate-50 border border-slate-100 p-3.5 text-xs font-semibold text-slate-600 space-y-1">
            <div className="flex items-center justify-between">
              <span>លេខបង្កាន់ដៃ:</span>
              <span className="font-num font-bold text-navy-900">#{payment.id.toUpperCase()}</span>
            </div>
            <div className="flex items-center justify-between">
              <span>កាលបរិច្ឆេទ:</span>
              <span className="font-bold text-navy-900">{fmtKHFull(payment.date)}</span>
            </div>
            <p className="text-center text-[11px] text-gold-700 font-medium pt-1 border-t border-slate-200/50 mt-1">
              <i className="fa-solid fa-moon mr-1" /> {fmtLunar(payment.date)}
            </p>
          </div>

          <div className="mt-4 space-y-2 text-xs">
            {[
              ["ឈ្មោះអតិថិជន:", loan.customer],
              ["លេខទូរស័ព្ទ:", loan.phone],
              ["លេខកូដកម្ចី:", loan.code],
              ["ប្រភេទកម្ចី:", loan.type === "daily" ? "បង់រាល់ថ្ងៃ (Daily)" : "បង់ប្រចាំខែ (Monthly)"],
              ["លើកទីត្រូវបង់:", `${payment.inst + 1} / ${loan.term}`],
            ].map(([k, v]) => (
              <div key={k} className="flex items-center justify-between border-b border-dotted border-slate-200 pb-1.5">
                <span className="text-slate-500 font-medium">{k}</span>
                <span className="font-bold text-navy-950 text-right">{v}</span>
              </div>
            ))}
          </div>

          {/* Amount Paid Box */}
          <div className="mt-5 rounded-2xl bg-gold-50 border border-gold-300 p-4 text-center">
            <p className="text-xs font-bold uppercase tracking-wider text-gold-800">ចំនួនទឹកប្រាក់បានបង់ (Amount Paid)</p>
            <p className="font-num mt-1 text-3xl font-black text-navy-950">{fmt(payment.amount)}</p>
          </div>

          {inst && (
            <div className="mt-3 flex items-center justify-between rounded-xl bg-slate-50 px-3.5 py-2 text-xs">
              <span className="text-slate-500 font-medium">សមតុល្យនៅសល់លើកនេះ:</span>
              <span className="font-num font-bold">
                {inst.shortage > 0.005 ? (
                  <span className="text-amber-800">នៅខ្វះ {fmt(inst.shortage)} (បង្វិលទៅមុខ)</span>
                ) : inst.balance > 0.005 ? (
                  <span className="text-rose-600">នៅសល់ {fmt(inst.balance)}</span>
                ) : (
                  <span className="text-emerald-700">0 ៛ (បង់គ្រប់)</span>
                )}
              </span>
            </div>
          )}

          {/* Signatures */}
          <div className="mt-6 flex items-end justify-between px-2 pt-2 border-t border-slate-100">
            <div className="text-center">
              <p className="text-[10px] text-slate-400 font-semibold">ហត្ថលេខាអ្នកទទួល</p>
              <div className="mt-7 w-24 border-t border-dashed border-slate-300" />
            </div>
            <div className="text-center">
              <p className="text-[10px] text-slate-400 font-semibold">ហត្ថលេខាអ្នកបង់</p>
              <div className="mt-7 w-24 border-t border-dashed border-slate-300" />
            </div>
          </div>

          <p className="mt-5 text-center text-[10px] text-slate-400 font-medium">
            សូមរក្សាទុកបង្កាន់ដៃនេះដើម្បីផ្ទៀងផ្ទាត់ • អរគុណ!
          </p>
        </div>

        {/* Buttons */}
        <div className="mt-4 flex gap-3">
          <button
            onClick={() => window.print()}
            className="tap-press flex-1 flex items-center justify-center gap-2 rounded-2xl bg-navy-900 text-white py-3.5 text-xs font-bold shadow-md"
          >
            <i className="fa-solid fa-print text-gold-400" />
            <span>បោះពុម្ព (Print)</span>
          </button>
          <button
            onClick={onClose}
            className="tap-press rounded-2xl border border-slate-200 bg-white px-6 py-3.5 text-xs font-bold text-navy-800 hover:bg-slate-50"
          >
            បិទ
          </button>
        </div>
      </div>
    </Modal>
  );
}

export function BulkReceiptModal({
  loan,
  result,
  title,
  onClose,
}: {
  loan: Loan;
  result: PayResult;
  title: string;
  onClose: () => void;
}) {
  const { db } = useApp();
  const sch = scheduleOf(loan, db.payments, db.settings);
  const first = result.payments[0];
  const last = result.payments[result.payments.length - 1];

  useEffect(() => {
    document.body.classList.add("printing-receipt");
    return () => document.body.classList.remove("printing-receipt");
  }, []);

  return (
    <Modal onClose={onClose} maxW="max-w-md">
      <div className="p-5 sm:p-6">
        <div
          id="print-slip"
          className="rounded-3xl border-2 border-dashed border-slate-200 bg-white p-6 sm:p-7 relative overflow-hidden shadow-xs"
        >
          <div className="flex items-center gap-3 border-b border-slate-100 pb-4">
            <MSHLogo className="h-12 w-12 shadow-xs" />
            <div className="flex-1 min-w-0">
              <p className="font-num text-sm sm:text-base font-black text-navy-950 leading-tight">
                {db.settings.orgName || ORG_NAME}
              </p>
              <p className="text-[11px] text-slate-400 font-medium">បង្កាន់ដៃទូទាត់រួម (Batch Settlement)</p>
            </div>
            <span className="rounded-full bg-emerald-50 border border-emerald-200 px-3 py-1 text-[11px] font-bold text-emerald-700">
              PAID
            </span>
          </div>

          <div className="mt-4 text-center">
            <p className="text-xs font-bold uppercase tracking-widest text-gold-600">{title}</p>
            <h3 className="text-lg font-black text-navy-950 mt-0.5">បង្កាន់ដៃទូទាត់ប្រាក់</h3>
          </div>

          <div className="mt-4 rounded-2xl bg-slate-50 border border-slate-100 p-3.5 text-xs font-semibold text-slate-600 space-y-1">
            <div className="flex items-center justify-between">
              <span>អតិថិជន:</span>
              <span className="font-bold text-navy-900">{loan.customer} ({loan.code})</span>
            </div>
            <div className="flex items-center justify-between">
              <span>កាលបរិច្ឆេទ:</span>
              <span className="font-bold text-navy-900">{fmtKHFull(todayISO())}</span>
            </div>
            <p className="text-center text-[11px] text-gold-700 font-medium pt-1 border-t border-slate-200/50 mt-1">
              <i className="fa-solid fa-moon mr-1" /> {fmtLunar(todayISO())}
            </p>
          </div>

          <div className="mt-4">
            <p className="mb-2 text-[11px] font-bold uppercase tracking-wider text-slate-400">
              ការបង់ប្រាក់ ({result.payments.length})
            </p>
            <ul className="max-h-40 space-y-1 overflow-y-auto pr-1">
              {result.payments.map((p) => (
                <li
                  key={p.id}
                  className="flex items-center justify-between rounded-xl bg-slate-50 p-2 text-xs"
                >
                  <span className="font-num font-bold text-navy-800">លើកទី #{p.inst + 1}</span>
                  <span className="text-slate-500 font-medium">
                    {sch[p.inst] ? fmtLunarShort(sch[p.inst].due) : ""}
                  </span>
                  <span className="font-num font-black text-navy-950">{fmt(p.amount)}</span>
                </li>
              ))}
            </ul>
          </div>

          <div className="mt-4 rounded-2xl bg-gold-50 border border-gold-300 p-4 text-center">
            <p className="text-xs font-bold uppercase tracking-wider text-gold-800">
              សរុបបានទូទាត់ {first && last ? `(លើកទី #${first.inst + 1} ដល់ #${last.inst + 1})` : ""}
            </p>
            <p className="font-num mt-1 text-3xl font-black text-navy-950">{fmt(result.total)}</p>
          </div>

          <div className="mt-6 flex items-end justify-between px-2 pt-2 border-t border-slate-100">
            <div className="text-center">
              <p className="text-[10px] text-slate-400 font-semibold">ហត្ថលេខាអ្នកទទួល</p>
              <div className="mt-7 w-24 border-t border-dashed border-slate-300" />
            </div>
            <div className="text-center">
              <p className="text-[10px] text-slate-400 font-semibold">ហត្ថលេខាអ្នកបង់</p>
              <div className="mt-7 w-24 border-t border-dashed border-slate-300" />
            </div>
          </div>
        </div>

        <div className="mt-4 flex gap-3">
          <button
            onClick={() => window.print()}
            className="tap-press flex-1 flex items-center justify-center gap-2 rounded-2xl bg-navy-900 text-white py-3.5 text-xs font-bold shadow-md"
          >
            <i className="fa-solid fa-print text-gold-400" />
            <span>បោះពុម្ព (Print)</span>
          </button>
          <button
            onClick={onClose}
            className="tap-press rounded-2xl border border-slate-200 bg-white px-6 py-3.5 text-xs font-bold text-navy-800 hover:bg-slate-50"
          >
            បិទ
          </button>
        </div>
      </div>
    </Modal>
  );
}
