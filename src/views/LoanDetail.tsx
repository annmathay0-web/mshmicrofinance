import { useMemo, useState } from "react";
import { useApp, type PayResult } from "../lib/state";
import {
  allocatePreview,
  copyText,
  fmt,
  fmtKH,
  loanStats,
  loanStatusOf,
  planPayUpToDate,
  planPayUpToIndex,
  reminderText,
  round2,
  todayISO,
  transitArrears,
  trueOwed,
} from "../lib/data";
import { fmtLunarShort, holidayName } from "../lib/khmerDate";
import { sanitizeNumericInput } from "../lib/security";
import type { Loan, Payment } from "../lib/data";
import { Avatar, Bar, Card, CardHead, Empty, Modal, StatusBadge, TypeBadge, useCountUp } from "../components/ui";
import ReceiptModal, { BulkReceiptModal } from "../components/Receipt";
import SchedulePrint from "../components/SchedulePrint";
import { cn } from "../utils/cn";

export default function LoanDetail({ id }: { id: string }) {
  const { db, go, recordSmartPayment, payUpToDate, payUpToIndex, deleteLoan, toast } = useApp();
  const loan = db.loans.find((l) => l.id === id);
  const st = useMemo(() => (loan ? loanStats(loan, db.payments, db.settings) : null), [db, loan]);

  const [collectTargetIdx, setCollectTargetIdx] = useState<number | null>(null);
  const [amt, setAmt] = useState("");
  const [receipt, setReceipt] = useState<{ loan: Loan; payment: Payment } | null>(null);
  const [confirmDel, setConfirmDel] = useState(false);
  const [advOpen, setAdvOpen] = useState(false);
  const [advTab, setAdvTab] = useState<"smart" | "upto">("smart");
  const [advAmt, setAdvAmt] = useState("");
  const [advDate, setAdvDate] = useState(todayISO());
  const [bulk, setBulk] = useState<{ result: PayResult; title: string } | null>(null);
  const [printOpen, setPrintOpen] = useState(false);
  const [mobileTab, setMobileTab] = useState<"cards" | "table">("cards");

  const unpaid = useMemo(() => (st ? st.schedule.filter((i) => i.balance > 0.005) : []), [st]);
  const todayIso = todayISO();
  const overdue = useMemo(() => unpaid.filter((i) => i.due < todayIso), [unpaid, todayIso]);

  const totalUnpaid = st?.remaining ?? 0;
  const totalOverdue = useMemo(() => (st ? trueOwed(st, (i) => i.due < todayIso) : 0), [st, todayIso]);
  const arrears = useMemo(() => (st ? transitArrears(st) : 0), [st]);

  const animUnpaid = useCountUp(totalUnpaid);
  const animOverdue = useCountUp(totalOverdue);

  const smartPreview = useMemo(
    () => (st ? allocatePreview(st, parseFloat(advAmt)) : null),
    [st, advAmt]
  );

  const uptoPreview = useMemo(() => {
    if (!st || !loan) return { rows: [] as { i: number; pay: number; due: string }[], total: 0 };
    const plan = planPayUpToDate(loan, db.payments, db.settings, advDate);
    return plan ? { rows: plan.rows, total: plan.total } : { rows: [], total: 0 };
  }, [loan, db.payments, db.settings, advDate, st]);

  const animUpto = useCountUp(uptoPreview.total);

  const collectPlan = useMemo(() => {
    if (collectTargetIdx === null || !loan) return null;
    return planPayUpToIndex(loan, db.payments, db.settings, collectTargetIdx);
  }, [collectTargetIdx, loan, db.payments, db.settings]);

  if (!loan || !st) {
    return (
      <Card className="mx-auto max-w-lg p-6">
        <Empty
          icon="fa-circle-question"
          title="រកមិនឃើញកម្ចីនេះទេ"
          sub="កម្ចីនេះអាចត្រូវបានលុបចេញ ឬមិនមាននៅក្នុងប្រព័ន្ធ"
          action={
            <button
              onClick={() => go({ name: "loans" })}
              className="tap-press rounded-xl bg-navy-900 px-5 py-2.5 text-xs font-bold text-white shadow-xs"
            >
              <i className="fa-solid fa-arrow-left mr-1.5" /> ត្រឡប់ទៅបញ្ជីកម្ចី
            </button>
          }
        />
      </Card>
    );
  }

  const pct = (st.paidCount / loan.term) * 100;

  const confirmSmart = () => {
    const a = parseFloat(advAmt);
    if (!Number.isFinite(a) || a <= 0) {
      toast("ចំនួនទឹកប្រាក់មិនត្រឹមត្រូវ", "error");
      return;
    }
    const res = recordSmartPayment(loan.id, a);
    if (!res) return;
    setAdvOpen(false);
    setAdvAmt("");
    toast(
      `បានកាត់កង ${res.cleared} លើក សរុប ${fmt(res.total)}` +
        (res.leftover > 0.005 ? ` (នៅសល់លើស ${fmt(res.leftover)})` : "")
    );
    setBulk({ result: res, title: "ADVANCE PAYMENT" });
  };

  const confirmUpto = () => {
    const res = payUpToDate(loan.id, advDate);
    if (!res) return;
    setAdvOpen(false);
    toast(`បានកត់ត្រាការបង់ ${res.cleared} លើក សរុប ${fmt(res.total)}`);
    setBulk({ result: res, title: "BULK REPAYMENT" });
  };

  const paysByInst = new Map<number, Payment[]>();
  let lastPayment: Payment | null = null;
  for (const p of db.payments) {
    if (p.loanId !== loan.id) continue;
    lastPayment = p;
    const arr = paysByInst.get(p.inst);
    if (arr) arr.push(p);
    else paysByInst.set(p.inst, [p]);
  }

  const amtNum = parseFloat(amt);
  const previewRemaining = collectPlan
    ? round2(Math.max(0, collectPlan.total - (Number.isFinite(amtNum) && amtNum > 0 ? amtNum : 0)))
    : 0;

  const startCollectUpTo = (idx: number) => {
    if (!loan) return;
    const plan = planPayUpToIndex(loan, db.payments, db.settings, idx);
    setAmt(String(plan && plan.total > 0 ? plan.total : 0));
    setCollectTargetIdx(idx);
  };

  const confirmCollect = () => {
    if (collectTargetIdx === null || !loan || !collectPlan) return;
    const a = parseFloat(amt);
    if (isNaN(a) || a <= 0) {
      toast("ចំនួនទឹកប្រាក់មិនត្រឹមត្រូវ", "error");
      return;
    }
    const targetIdx = collectTargetIdx;
    setCollectTargetIdx(null);

    let res: PayResult | null = null;
    if (Math.abs(a - collectPlan.total) < 0.005) {
      res = payUpToIndex(loan.id, targetIdx);
    } else {
      res = recordSmartPayment(loan.id, a);
    }
    if (!res) return;

    if (res.payments.length === 1) {
      toast(`បានប្រមូលប្រាក់ ${fmt(res.total)}`);
      setReceipt({ loan, payment: res.payments[0] });
    } else {
      toast(`បានប្រមូល ${res.cleared} លើក សរុប ${fmt(res.total)}`);
      setBulk({ result: res, title: `CUMULATIVE COLLECTION (#${targetIdx + 1})` });
    }
  };

  const remind = async () => {
    const ok = await copyText(reminderText(loan, st, db.settings.orgName));
    toast(ok ? "បានចម្លងសារសម្រាប់ Telegram" : "មិនអាចចម្លងបានទេ", ok ? "success" : "error");
  };

  const askDelete = () => {
    if (confirmDel) {
      deleteLoan(loan.id);
      toast(`បានលុបកម្ចី ${loan.code}`, "info");
      go({ name: "loans" });
    } else {
      setConfirmDel(true);
      window.setTimeout(() => setConfirmDel(false), 2600);
    }
  };

  const stats: [string, string, string, string][] = [
    ["ប្រាក់ដើម", "Principal", fmt(loan.principal), "text-navy-950"],
    [
      "ការប្រាក់",
      "Interest",
      loan.type === "daily"
        ? fmt(loan.interest)
        : fmt(round2(loan.principal * (loan.interest / 100) * loan.term)),
      "text-emerald-600",
    ],
    ["សរុបត្រូវបង់", "Total Due", fmt(st.totalDue), "text-navy-950"],
    ["បានបង់", "Paid", fmt(st.totalPaid), "text-emerald-600"],
    ["នៅសល់", "Remaining", fmt(st.remaining), st.remaining > 0 ? "text-rose-600" : "text-emerald-600"],
  ];

  return (
    <div className="space-y-5">
      <button
        onClick={() => go({ name: "loans" })}
        className="tap-press inline-flex items-center gap-2 text-xs font-bold text-navy-800 hover:text-gold-600 transition-colors"
      >
        <i className="fa-solid fa-arrow-left text-xs" />
        <span>ត្រឡប់ទៅបញ្ជីកម្ចី</span>
      </button>

      {/* Hero Master Account Card */}
      <div className="anim-fade-up d1 rounded-2xl sm:rounded-3xl bg-banking-card p-4 sm:p-7 text-white shadow-xl shadow-navy-950/15 border border-white/10 relative overflow-hidden">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <Avatar name={loan.customer} size="h-12 w-12 sm:h-14 sm:w-14 text-lg sm:text-xl" />
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
                <h2 className="text-lg sm:text-2xl font-extrabold text-white truncate">{loan.customer}</h2>
                <span className="font-num rounded-md sm:rounded-full bg-white/10 border border-white/15 px-2 py-0.5 text-[11px] font-bold text-gold-400">
                  {loan.code}
                </span>
                <TypeBadge type={loan.type} />
                <StatusBadge s={loanStatusOf(st)} />
              </div>
              <p className="mt-1 text-[11px] sm:text-xs text-navy-200 flex flex-wrap items-center gap-2 font-medium">
                <span><i className="fa-solid fa-phone text-gold-400 mr-1" /> {loan.phone}</span>
                <span>•</span>
                <span>ថ្ងៃបើកប្រាក់: {fmtKH(loan.startDate)}</span>
                {loan.note && <span>• {loan.note}</span>}
              </p>
            </div>
          </div>

          {/* Quick Action Ribbon */}
          <div className="grid grid-cols-2 sm:flex sm:flex-wrap items-center gap-2 w-full lg:w-auto">
            <button
              onClick={() => setPrintOpen(true)}
              title="ទាញយក PDF / Save as PDF"
              className="tap-press col-span-2 sm:col-span-1 flex items-center justify-center gap-2 rounded-xl bg-gold-gradient text-navy-950 px-3.5 py-2.5 text-xs font-black shadow-md shadow-gold-500/25 hover:brightness-105 min-h-[44px] whitespace-nowrap"
            >
              <i className="fa-solid fa-file-pdf text-sm text-navy-900" />
              <span>កាលវិភាគ A4 / Save PDF</span>
            </button>
            <button
              onClick={() => {
                setAdvOpen(true);
                setAdvTab("smart");
                setAdvAmt(String(st.remaining > 0 ? st.next?.balance ?? "" : ""));
                setAdvDate(todayISO());
              }}
              className="tap-press flex items-center justify-center gap-1.5 rounded-xl border border-white/20 bg-white/10 hover:bg-white/15 text-white px-3 py-2.5 text-xs font-bold min-h-[44px] whitespace-nowrap"
            >
              <i className="fa-solid fa-layer-group text-gold-400 text-xs" />
              <span>បង់ជាកញ្ចប់</span>
            </button>
            <button
              onClick={() => void remind()}
              className="tap-press flex items-center justify-center gap-1.5 rounded-xl bg-[#229ED9] text-white px-3 py-2.5 text-xs font-bold shadow-xs min-h-[44px] whitespace-nowrap"
            >
              <i className="fa-brands fa-telegram text-sm" />
              <span>រំលឹក Telegram</span>
            </button>
            {lastPayment && (
              <button
                onClick={() => setReceipt({ loan, payment: lastPayment! })}
                className="tap-press flex items-center justify-center gap-1.5 rounded-xl border border-white/20 bg-white/10 text-white px-3 py-2.5 text-xs font-bold min-h-[44px] whitespace-nowrap"
              >
                <i className="fa-solid fa-receipt text-gold-400 text-xs" />
                <span>បង្កាន់ដៃ</span>
              </button>
            )}
            <button
              onClick={askDelete}
              className={cn(
                "tap-press flex items-center justify-center gap-1.5 rounded-xl px-3 py-2.5 text-xs font-bold transition-all min-h-[44px] whitespace-nowrap",
                confirmDel ? "bg-rose-600 text-white" : "border border-white/15 bg-white/5 text-rose-300 hover:bg-rose-500/20"
              )}
            >
              <i className="fa-solid fa-trash-can text-xs" />
              <span>{confirmDel ? "បញ្ជាក់?" : "លុបកម្ចី"}</span>
            </button>
          </div>
        </div>

        {/* 5 Financial Metric Blocks */}
        <div className="mt-4 sm:mt-6 pt-4 sm:pt-6 border-t border-white/10 grid grid-cols-2 sm:grid-cols-5 gap-2 sm:gap-3 text-center">
          {stats.map(([kh, en, v], idx) => (
            <div
              key={en}
              className={cn(
                "rounded-xl sm:rounded-2xl bg-white/5 border border-white/5 p-2 sm:p-3 min-w-0 overflow-hidden",
                idx === 4 && "col-span-2 sm:col-span-1"
              )}
            >
              <p className="text-[10px] uppercase font-bold tracking-wider text-navy-300 truncate">{kh}</p>
              <p className="font-num mt-0.5 text-xs sm:text-base font-black text-white truncate" title={v}>
                {v}
              </p>
            </div>
          ))}
        </div>

        {/* Progress Bar Ribbon */}
        <div className="mt-5 flex items-center gap-3">
          <div className="flex-1">
            <Bar pct={pct} barClass={st.done ? "bg-emerald-400" : "bg-gold-400"} />
          </div>
          <span className="font-num text-xs font-bold text-gold-300 shrink-0">
            {st.paidCount}/{loan.term} ({Math.round(pct)}%)
          </span>
        </div>
      </div>

      {/* Repayment Schedule with Quick Selection */}
      <Card className="anim-fade-up d2 overflow-hidden">
        <CardHead
          icon="fa-table-list"
          title="កាលវិភាគបង់ប្រាក់លម្អិត"
          en="Full Repayment Schedule"
          right={
            <div className="flex items-center gap-1.5 sm:gap-2">
              <div className="flex md:hidden items-center rounded-xl bg-slate-100 p-0.5 border border-slate-200">
                <button
                  onClick={() => setMobileTab("cards")}
                  className={cn(
                    "tap-press flex items-center gap-1 rounded-lg px-2.5 py-1 text-[11px] font-bold transition-all",
                    mobileTab === "cards" ? "bg-white text-navy-950 shadow-xs" : "text-slate-500"
                  )}
                >
                  <i className="fa-solid fa-grip-vertical text-[10px]" />
                  <span>កាត</span>
                </button>
                <button
                  onClick={() => setMobileTab("table")}
                  className={cn(
                    "tap-press flex items-center gap-1 rounded-lg px-2.5 py-1 text-[11px] font-bold transition-all",
                    mobileTab === "table" ? "bg-white text-navy-950 shadow-xs" : "text-slate-500"
                  )}
                >
                  <i className="fa-solid fa-table-list text-[10px]" />
                  <span>តារាង</span>
                </button>
              </div>
              {arrears > 0.005 && (
                <span className="hidden sm:inline-flex items-center gap-1.5 rounded-full bg-amber-50 border border-amber-300 px-3 py-1 font-num text-xs font-bold text-amber-800">
                  <span className="anim-pulse-glow h-2 w-2 rounded-full bg-amber-500" /> ជំពាក់ខ្វះបង្វិល: {fmt(arrears)}
                </span>
              )}
              <span className="font-num rounded-full bg-navy-50 border border-navy-100 px-2.5 sm:px-3 py-1 text-xs font-bold text-navy-900 shrink-0">
                {loan.term} លើក
              </span>
            </div>
          }
        />

        {unpaid.length > 0 && (
          <div className="border-b border-slate-100 bg-slate-50/80 p-3 sm:p-4 flex flex-wrap items-center justify-between gap-2.5">
            <div className="flex flex-wrap items-center gap-2.5 sm:gap-3 text-xs">
              <p className="text-slate-600 font-semibold">
                នៅសល់សរុប: <span className="font-num font-black text-navy-900 text-sm">{fmt(animUnpaid)}</span> ({unpaid.length} លើក)
              </p>
              {overdue.length > 0 && (
                <p className="text-rose-600 font-bold">
                  ហួសកំណត់: <span className="font-num">{fmt(animOverdue)}</span> ({overdue.length} លើក)
                </p>
              )}
            </div>
            <p className="text-[11px] text-slate-500 italic hidden sm:block">
              * ចុចលើប៊ូតុង <span className="font-bold text-emerald-700">"ប្រមូល"</span> ដើម្បីទូទាត់កម្ចីរហូតដល់លើកនោះ
            </p>
          </div>
        )}

        {/* Mobile View: High-Performance Touch Banking Cards */}
        {mobileTab === "cards" && (
          <div className="md:hidden divide-y divide-slate-100">
            {st.schedule.map((i) => {
              const instPays = paysByInst.get(i.i);
              const latest = instPays && instPays.length > 0 ? instPays[instPays.length - 1] : undefined;
              const isRowDone =
                i.status === "paid" &&
                i.balance <= 0.005 &&
                !st.schedule.slice(0, i.i).some((p) => p.status !== "paid" || p.balance > 0.005);
              const plan = planPayUpToIndex(loan, db.payments, db.settings, i.i);

              return (
                <div
                  key={i.i}
                  className={cn(
                    "p-3.5 space-y-2.5 transition-colors",
                    i.status === "today" && "bg-amber-50/50",
                    i.status === "overdue" && "bg-rose-50/40"
                  )}
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="font-num flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-navy-100 text-xs font-black text-navy-900">
                        #{i.i + 1}
                      </span>
                      <div className="min-w-0">
                        <p className="font-bold text-xs text-navy-950 truncate">{fmtKH(i.due)}</p>
                        <p className="text-[10px] text-slate-400 font-medium truncate">
                          {fmtLunarShort(i.due)}
                          {holidayName(i.due, db.settings) && ` • ${holidayName(i.due, db.settings)}`}
                        </p>
                      </div>
                    </div>
                    <StatusBadge s={i.status} />
                  </div>

                  <div className="grid grid-cols-3 gap-2 rounded-xl bg-slate-50 p-2.5 text-center text-xs">
                    <div>
                      <p className="text-[10px] text-slate-400 font-semibold">ត្រូវបង់</p>
                      <p className="font-num font-black text-navy-900 mt-0.5 truncate">
                        {fmt(i.requiredDue ?? round2(Math.max(0, i.amount + i.carriedIn)))}
                      </p>
                      {i.carriedIn > 0.005 ? (
                        <span className="text-[9px] text-amber-700 font-bold block truncate">
                          +{fmt(i.carriedIn)} ខ្វះចាស់
                        </span>
                      ) : i.carriedIn < -0.005 ? (
                        <span className="text-[9px] text-emerald-700 font-bold block truncate">
                          -{fmt(Math.abs(i.carriedIn))} លើស
                        </span>
                      ) : null}
                    </div>

                    <div>
                      <p className="text-[10px] text-slate-400 font-semibold">បានបង់</p>
                      <p className="font-num font-black text-emerald-600 mt-0.5 truncate">
                        {i.paid > 0 ? `+${fmt(i.paid)}` : "—"}
                      </p>
                    </div>

                    <div>
                      <p className="text-[10px] text-slate-400 font-semibold">សមតុល្យ</p>
                      <p className="font-num font-black mt-0.5 truncate">
                        {i.shortage > 0.005 ? (
                          <span className="text-amber-800">ខ្វះ {fmt(i.shortage)}</span>
                        ) : i.balance > 0.005 ? (
                          <span className="text-rose-600">{fmt(i.balance)}</span>
                        ) : (
                          <span className="text-emerald-600">0 ៛</span>
                        )}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center justify-between gap-2 pt-1">
                    <div className="min-w-0 flex-1">
                      {!isRowDone && plan && plan.rows.length > 1 ? (
                        <p className="text-[10px] text-gold-700 font-semibold truncate">
                          <i className="fa-solid fa-layer-group mr-1" />
                          សរុប {plan.rows.length} លើក: {fmt(plan.total)}
                        </p>
                      ) : null}
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0">
                      {!isRowDone ? (
                        <button
                          onClick={() => startCollectUpTo(i.i)}
                          title={`ប្រមូលដល់លើកទី ${i.i + 1}`}
                          className="tap-press flex h-9 items-center gap-1.5 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-white px-3.5 text-xs font-bold shadow-xs"
                        >
                          <i className="fa-solid fa-hand-holding-dollar text-xs" />
                          <span>ប្រមូល</span>
                        </button>
                      ) : (
                        <span className="inline-flex items-center gap-1 rounded-lg bg-emerald-50 px-2.5 py-1 text-xs font-bold text-emerald-700">
                          <i className="fa-solid fa-circle-check text-xs" />
                          <span>រួចរាល់</span>
                        </span>
                      )}
                      {latest && (
                        <button
                          onClick={() => setReceipt({ loan, payment: latest })}
                          title="មើលបង្កាន់ដៃ"
                          className="tap-press flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200 bg-white text-navy-700 hover:bg-slate-50"
                        >
                          <i className="fa-solid fa-receipt text-xs" />
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Tabular Ledger View (Desktop default or Mobile toggle) */}
        <div className={cn("overflow-x-auto", mobileTab === "cards" ? "hidden md:block" : "block")}>
          <div className="md:hidden px-3.5 py-1.5 bg-slate-100/70 border-b border-slate-200/60 text-[10px] text-slate-500 font-semibold flex items-center justify-between">
            <span className="flex items-center gap-1.5">
              <i className="fa-solid fa-arrows-left-right text-gold-600 text-xs" />
              <span>រំកិលទៅឆ្វេងស្តាំដើម្បីមើលតារាងពេញ</span>
            </span>
            <span className="font-num font-bold text-navy-800">{st.schedule.length} លើក</span>
          </div>

          <table className="w-full min-w-[840px] text-xs sm:text-sm">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50/70 text-left text-xs font-bold text-slate-500 uppercase tracking-wider">
                <th className="px-4 py-3.5">លើកទី</th>
                <th className="px-4 py-3.5">កាលបរិច្ឆេទ</th>
                <th className="px-4 py-3.5">ប្រាក់ត្រូវបង់</th>
                <th className="px-4 py-3.5">ជំពាក់ខ្វះបង្វិល (+)</th>
                <th className="px-4 py-3.5">បានបង់</th>
                <th className="px-4 py-3.5">សមតុល្យនៅខ្វះ</th>
                <th className="px-4 py-3.5">ស្ថានភាព</th>
                <th className="px-4 py-3.5 text-right">សកម្មភាព</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {st.schedule.map((i) => {
                const instPays = paysByInst.get(i.i);
                const latest = instPays && instPays.length > 0 ? instPays[instPays.length - 1] : undefined;
                const isRowDone =
                  i.status === "paid" &&
                  i.balance <= 0.005 &&
                  !st.schedule.slice(0, i.i).some((p) => p.status !== "paid" || p.balance > 0.005);

                return (
                  <tr
                    key={i.i}
                    className={cn(
                      "transition-colors hover:bg-slate-50/70",
                      i.status === "today" && "bg-amber-50/50",
                      i.status === "overdue" && "bg-rose-50/40"
                    )}
                  >
                    <td className="font-num px-4 py-3.5 font-bold text-navy-800">#{i.i + 1}</td>
                    <td className="px-4 py-3.5">
                      <p className="font-bold text-navy-900">{fmtKH(i.due)}</p>
                      <p className="text-[11px] text-slate-400 font-medium">
                        {fmtLunarShort(i.due)}
                        {holidayName(i.due, db.settings) && ` • ${holidayName(i.due, db.settings)}`}
                      </p>
                    </td>
                    <td className="font-num px-4 py-3.5">
                      <span className="font-black text-navy-900">
                        {fmt(i.requiredDue ?? round2(Math.max(0, i.amount + i.carriedIn)))}
                      </span>
                      {i.carriedIn > 0.005 ? (
                        <span className="block text-[10px] text-amber-700 font-bold">
                          {fmt(i.amount)} + {fmt(i.carriedIn)}
                        </span>
                      ) : i.carriedIn < -0.005 ? (
                        <span className="block text-[10px] text-emerald-700 font-bold">
                          {fmt(i.amount)} - {fmt(Math.abs(i.carriedIn))} (លើស)
                        </span>
                      ) : null}
                    </td>
                    <td className="font-num px-4 py-3.5">
                      {i.carriedIn > 0.005 ? (
                        <span className="font-bold text-amber-700">+{fmt(i.carriedIn)}</span>
                      ) : i.carriedIn < -0.005 ? (
                        <span className="font-bold text-emerald-700">-{fmt(Math.abs(i.carriedIn))}</span>
                      ) : (
                        <span className="text-slate-300">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3.5">
                      {i.paid > 0 ? (
                        <span className="font-num font-black text-emerald-600">+{fmt(i.paid)}</span>
                      ) : (
                        <span className="text-slate-300">—</span>
                      )}
                    </td>
                    <td className="font-num px-4 py-3.5 font-black">
                      {i.shortage > 0.005 ? (
                        <span className="text-amber-800 font-bold">ខ្វះ {fmt(i.shortage)}</span>
                      ) : i.balance > 0.005 ? (
                        <span className="text-rose-600">{fmt(i.balance)}</span>
                      ) : (
                        <span className="text-emerald-600">0 ៛</span>
                      )}
                    </td>
                    <td className="px-4 py-3.5">
                      <StatusBadge s={i.status} />
                    </td>
                    <td className="px-4 py-3.5 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        {!isRowDone ? (
                          <button
                            onClick={() => startCollectUpTo(i.i)}
                            title={`ប្រមូលដល់លើកទី ${i.i + 1}`}
                            className="tap-press inline-flex items-center gap-1.5 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-white px-3.5 py-2 text-xs font-bold shadow-xs min-h-[44px] whitespace-nowrap"
                          >
                            <i className="fa-solid fa-hand-holding-dollar text-xs" />
                            <span>ប្រមូល</span>
                          </button>
                        ) : (
                          <span className="inline-flex items-center gap-1 rounded-lg bg-emerald-50 px-2.5 py-1.5 text-xs font-bold text-emerald-700 whitespace-nowrap">
                            <i className="fa-solid fa-circle-check text-xs" />
                            <span>រួចរាល់</span>
                          </span>
                        )}
                        {latest && (
                          <button
                            onClick={() => setReceipt({ loan, payment: latest })}
                            title="មើលបង្កាន់ដៃ"
                            className="tap-press flex h-11 w-11 items-center justify-center rounded-xl border border-slate-200 bg-white text-navy-700 hover:bg-slate-50"
                          >
                            <i className="fa-solid fa-receipt text-xs" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Collect Modal (Cumulative Up To Row) */}
      {collectTargetIdx !== null && collectPlan && (
        <Modal onClose={() => setCollectTargetIdx(null)} maxW="max-w-md">
          <div className="p-6">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-600">
                Cash Collection
              </span>
              <span className="font-num text-xs font-bold text-navy-500">
                រហូតដល់លើកទី #{collectTargetIdx + 1}
              </span>
            </div>
            <h3 className="mt-1 text-lg font-bold text-navy-900">
              {collectPlan.rows.length > 1
                ? `ប្រមូលប្រាក់រួម (រហូតដល់លើកទី #${collectTargetIdx + 1})`
                : `ប្រមូលប្រាក់លើកទី #${collectTargetIdx + 1}`}
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              {loan.customer} • {fmtKH(st.schedule[collectTargetIdx].due)}
            </p>

            {collectPlan.rows.length > 1 && (
              <div className="mt-3 rounded-xl bg-gold-50/80 border border-gold-200 p-3 text-xs">
                <div className="flex items-center gap-2 text-gold-900 font-bold">
                  <i className="fa-solid fa-layer-group text-gold-600 text-sm" />
                  <span>
                    ការទូទាត់រៀបជាកញ្ចប់ {collectPlan.rows.length} លើកជាប់គ្នា
                  </span>
                </div>
                <p className="text-[11px] text-gold-800 mt-1">
                  ប្រព័ន្ធនឹងទូទាត់ជាស្វ័យប្រវត្តិចាប់ពីលើកទី #{collectPlan.rows[0].i + 1} ដល់ #{collectTargetIdx + 1} ដោយគ្មានចន្លោះ។
                </p>
              </div>
            )}

            <div className="mt-4 rounded-2xl bg-slate-50 border border-slate-100 p-4">
              <div className="flex items-center justify-between text-xs font-semibold text-slate-500">
                <span>ចំនួនទឹកប្រាក់សរុបត្រូវបង់:</span>
                <span className="font-num text-xl font-black text-navy-900">
                  {fmt(collectPlan.total)}
                </span>
              </div>
              {st.schedule[collectTargetIdx].carriedIn > 0.005 && (
                <p className="mt-1.5 text-[11px] text-amber-700 font-semibold flex items-center gap-1">
                  <i className="fa-solid fa-rotate-right text-[10px]" />
                  រួមបញ្ចូលប្រាក់ជំពាក់ខ្វះបង្វិលមក +{fmt(st.schedule[collectTargetIdx].carriedIn)}
                </p>
              )}
            </div>

            <label className="mt-4 block text-xs font-bold text-navy-900">
              ចំនួនប្រាក់បានទទួលជាក់ស្តែង (៛)
            </label>
            <input
              type="text"
              inputMode="decimal"
              value={amt}
              onChange={(e) => setAmt(sanitizeNumericInput(e.target.value, true))}
              onFocus={(e) => e.target.select()}
              className="font-num mt-1.5 w-full rounded-2xl border border-slate-200 bg-white p-3 text-lg font-black text-navy-900 outline-none focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/10"
            />

            <div className="mt-2.5 flex gap-2">
              <button
                type="button"
                onClick={() => setAmt(String(collectPlan.total))}
                className="tap-press flex-1 rounded-xl border border-emerald-300 bg-emerald-50 p-2 text-xs font-bold text-emerald-800"
              >
                បង់គ្រប់ ({fmt(collectPlan.total)})
              </button>
              {collectPlan.total > 1000 && (
                <button
                  type="button"
                  onClick={() => setAmt(String(round2(collectPlan.total / 2)))}
                  className="tap-press flex-1 rounded-xl border border-slate-200 bg-white p-2 text-xs font-bold text-slate-700"
                >
                  បង់ពាក់កណ្តាល
                </button>
              )}
            </div>

            <div className="mt-3 flex items-center justify-between text-xs text-slate-500 px-1 font-semibold">
              <span>សមតុល្យនៅសល់ប៉ាន់ស្មាន:</span>
              <span className="font-num font-bold text-navy-900">{fmt(previewRemaining)}</span>
            </div>

            <div className="mt-5 flex gap-3">
              <button
                onClick={confirmCollect}
                className="tap-press flex-1 flex items-center justify-center gap-2 rounded-2xl bg-emerald-500 hover:bg-emerald-600 py-3.5 text-xs font-bold text-white shadow-md shadow-emerald-500/25"
              >
                <i className="fa-solid fa-check" /> បញ្ជាក់ការទទួលប្រាក់
              </button>
              <button
                onClick={() => setCollectTargetIdx(null)}
                className="tap-press rounded-2xl border border-slate-200 px-5 py-3.5 text-xs font-bold text-navy-700 hover:bg-slate-50"
              >
                បោះបង់
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* Advanced Payment Modal */}
      {advOpen && (
        <Modal onClose={() => setAdvOpen(false)} maxW="max-w-lg">
          <div className="p-6">
            <div className="flex items-center gap-3">
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-gold-100 text-gold-700 text-lg">
                <i className="fa-solid fa-layer-group" />
              </span>
              <div>
                <h3 className="text-base font-bold text-navy-900">ទូទាត់ប្រាក់កម្ចីកម្រិតខ្ពស់</h3>
                <p className="text-xs text-slate-400 font-medium">{loan.customer} • {loan.code}</p>
              </div>
            </div>

            <div className="mt-4 grid grid-cols-2 gap-1 rounded-2xl bg-slate-100 p-1">
              {([["smart", "បង់ជាកញ្ចប់ប្រាក់"], ["upto", "បង់ដល់ថ្ងៃកំណត់"]] as const).map(([k, l]) => (
                <button
                  key={k}
                  onClick={() => setAdvTab(k)}
                  className={cn(
                    "rounded-xl py-2 text-xs font-bold transition-all tap-press",
                    advTab === k ? "bg-white text-navy-950 shadow-xs" : "text-slate-500 hover:text-navy-900"
                  )}
                >
                  {l}
                </button>
              ))}
            </div>

            {advTab === "smart" ? (
              <div className="mt-5 space-y-4">
                <div>
                  <label className="block text-xs font-bold text-navy-900 mb-1.5">
                    ចំនួនទឹកប្រាក់បង់ជាកញ្ចប់ (៛)
                  </label>
                  <input
                    type="text"
                    inputMode="decimal"
                    value={advAmt}
                    onChange={(e) => setAdvAmt(sanitizeNumericInput(e.target.value, true))}
                    onFocus={(e) => e.target.select()}
                    placeholder="បញ្ចូលចំនួនប្រាក់..."
                    className="font-num w-full rounded-2xl border border-slate-200 bg-white p-3.5 text-base font-black text-navy-900 outline-none focus:border-navy-900"
                  />
                  <button
                    onClick={() => setAdvAmt(String(st.remaining))}
                    className="tap-press mt-2 text-xs font-bold text-gold-700 hover:underline inline-flex items-center gap-1"
                  >
                    <i className="fa-solid fa-wand-magic-sparkles text-[10px]" /> បង់ផ្តាច់ទាំងអស់:{" "}
                    <span className="font-num font-black">{fmt(st.remaining)}</span>
                  </button>
                </div>

                {smartPreview && smartPreview.rows.length > 0 && (
                  <div className="rounded-2xl bg-slate-50 border border-slate-100 p-4 text-xs space-y-2">
                    <p className="font-bold text-slate-400 uppercase tracking-wider text-[10px]">
                      លទ្ធផលកាត់កងស្វ័យប្រវត្តិ
                    </p>
                    <div className="flex items-center justify-between font-bold text-navy-900">
                      <span>លើកដែលនឹងត្រូវទូទាត់ដាច់:</span>
                      <span className="font-num text-emerald-600 font-black">{smartPreview.cleared} លើក</span>
                    </div>
                    {smartPreview.partial > 0.005 && (
                      <div className="flex items-center justify-between text-gold-700 font-bold">
                        <span>លើកចុងក្រោយបង់បានខ្លះ:</span>
                        <span className="font-num">{fmt(smartPreview.partial)}</span>
                      </div>
                    )}
                  </div>
                )}

                <button
                  onClick={confirmSmart}
                  disabled={!smartPreview || smartPreview.rows.length === 0}
                  className="tap-press w-full rounded-2xl bg-gold-gradient py-3.5 text-xs font-bold text-navy-950 shadow-md shadow-gold-500/25 disabled:opacity-40"
                >
                  បញ្ជាក់ការបង់ប្រាក់
                </button>
              </div>
            ) : (
              <div className="mt-5 space-y-4">
                <div>
                  <label className="block text-xs font-bold text-navy-900 mb-1.5">
                    បង់ទូទាត់រាល់លើកគិតត្រឹមថ្ងៃ
                  </label>
                  <input
                    type="date"
                    value={advDate}
                    onChange={(e) => setAdvDate(e.target.value)}
                    className="font-num w-full rounded-2xl border border-slate-200 bg-white p-3.5 text-sm font-bold text-navy-900 outline-none"
                  />
                </div>

                <div className="rounded-2xl bg-slate-50 border border-slate-100 p-4 text-xs">
                  <p className="text-slate-500 font-semibold">សរុបត្រូវបង់សម្រាប់ {uptoPreview.rows.length} លើក:</p>
                  <p className="font-num text-2xl font-black text-navy-900 mt-1">{fmt(animUpto)}</p>
                </div>

                <button
                  onClick={confirmUpto}
                  disabled={uptoPreview.rows.length === 0}
                  className="tap-press w-full rounded-2xl bg-gold-gradient py-3.5 text-xs font-bold text-navy-950 shadow-md shadow-gold-500/25 disabled:opacity-40"
                >
                  បញ្ជាក់ការបង់ប្រាក់
                </button>
              </div>
            )}
          </div>
        </Modal>
      )}

      {receipt && <ReceiptModal loan={receipt.loan} payment={receipt.payment} onClose={() => setReceipt(null)} />}
      {bulk && <BulkReceiptModal loan={loan} result={bulk.result} title={bulk.title} onClose={() => setBulk(null)} />}
      {printOpen && <SchedulePrint loan={loan} st={st} db={db} onClose={() => setPrintOpen(false)} />}
    </div>
  );
}
