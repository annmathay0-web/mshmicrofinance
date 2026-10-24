import { useMemo, useState } from "react";
import { useApp } from "../lib/state";
import {
  collectionsByDay,
  fmt,
  fmtKH,
  fmtKHFull,
  fmtShort,
  isWorking,
  KH_DAYS_SHORT,
  loanStats,
  parseISO,
  todayISO,
  totalInterestOf,
} from "../lib/data";
import { fmtLunar, nextHoliday } from "../lib/khmerDate";
import { daysSinceLastBackup, downloadBackup, markBackupDone } from "../lib/state";
import type { Loan, Payment } from "../lib/data";
import { Avatar, Bar, Card, CardHead, Empty, StatusBadge, TypeBadge, useCountUp } from "../components/ui";
import ReceiptModal, { BulkReceiptModal } from "../components/Receipt";
import type { PayResult } from "../lib/state";
import KhmerCalendar from "../components/KhmerCalendar";
import { getSession } from "../lib/auth";
import { cn } from "../utils/cn";
import { PWAInstallButton } from "../components/PWAInstall";

function Money({ v, className }: { v: number; className?: string }) {
  const n = useCountUp(v);
  return <span className={cn("font-num", className)}>{fmt(n)}</span>;
}

export default function Dashboard() {
  const { db, go, recordSmartPayment, toast } = useApp();
  const t = todayISO();
  const [receipt, setReceipt] = useState<{ loan: Loan; payment: Payment } | null>(null);
  const [bulk, setBulk] = useState<{ loan: Loan; result: PayResult; title: string } | null>(null);

  const all = useMemo(
    () => db.loans.map((loan) => ({ loan, st: loanStats(loan, db.payments, db.settings) })),
    [db]
  );
  const active = all.filter((x) => !x.st.done);

  const totalPrincipal = active.reduce((a, x) => a + x.loan.principal, 0);
  const totalInterest = active.reduce((a, x) => a + totalInterestOf(x.loan), 0);
  const dueToday = active.reduce((a, x) => a + x.st.outstanding, 0);
  const collectedToday = db.payments.filter((p) => p.date === t).reduce((a, b) => a + b.amount, 0);

  const dailyCount = active.filter((x) => x.loan.type === "daily").length;
  const monthlyCount = active.length - dailyCount;

  const days14 = useMemo(() => collectionsByDay(db.payments, 14), [db.payments]);
  const chart = days14.slice(-7);
  const weekTotal = chart.reduce((a, b) => a + b.total, 0);
  const maxBar = Math.max(...chart.map((d) => d.total), 1);

  const dueRows = active
    .filter((x) => x.st.outstanding > 0)
    .sort((a, b) => b.st.outstanding - a.st.outstanding)
    .slice(0, 5);

  const recent = [...db.payments].reverse().slice(0, 5);

  const workToday = isWorking(parseISO(t), db.settings);
  const holiday = nextHoliday(t, db.settings);

  const [backupDismissed, setBackupDismissed] = useState(
    () => sessionStorage.getItem("msh_backup_reminder") === "1"
  );
  const sinceBackup = daysSinceLastBackup();
  const backupDue =
    db.loans.length > 0 && !backupDismissed && (sinceBackup === null || sinceBackup >= 7);

  const doBackupNow = () => {
    if (downloadBackup(db)) {
      markBackupDone();
      toast("បានទាញយក Backup រួចរាល់");
      setBackupDismissed(true);
      sessionStorage.setItem("msh_backup_reminder", "1");
    }
  };

  const quickCollect = (x: { loan: Loan; st: ReturnType<typeof loanStats> }) => {
    const dueAmt = x.st.outstanding > 0.005 ? x.st.outstanding : x.st.next?.balance ?? 0;
    if (dueAmt <= 0.005) return;
    const res = recordSmartPayment(x.loan.id, dueAmt);
    if (!res || res.payments.length === 0) return;
    toast(`បានកត់ត្រាការបង់ប្រាក់ ${fmt(res.total)} ពីអតិថិជន ${x.loan.customer}`);
    if (res.payments.length === 1) {
      setReceipt({ loan: x.loan, payment: res.payments[0] });
    } else {
      setBulk({ loan: x.loan, result: res, title: "CUMULATIVE COLLECTION" });
    }
  };

  return (
    <div className="space-y-5">
      {/* Greeting and Lunar Date Header */}
      <div className="anim-fade-up flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <h2 className="text-lg sm:text-2xl font-bold text-navy-950">
              សួស្តី, {getSession()?.user.displayName ?? "Admin"} 👋
            </h2>
          </div>
          <p className="mt-1 flex flex-wrap items-center gap-2 text-xs sm:text-sm text-slate-500">
            <span>{fmtKHFull(t)}</span>
            <span className="inline-flex items-center gap-1.5 rounded-full border border-gold-300 bg-gold-50/80 px-2.5 py-0.5 text-xs font-bold text-gold-700">
              <i className="fa-solid fa-moon text-[10px] text-gold-600" /> {fmtLunar(t)}
            </span>
            {holiday && (
              <span className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-slate-50 px-2.5 py-0.5 text-xs font-semibold text-slate-600">
                <i className="fa-solid fa-umbrella-beach text-[10px] text-slate-400" />
                {holiday.name.split(" (")[0]}
              </span>
            )}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span
            className={cn(
              "inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-bold border",
              workToday
                ? "bg-emerald-50 text-emerald-700 border-emerald-200/80"
                : "bg-amber-50 text-amber-800 border-amber-300"
            )}
          >
            <span className={cn("h-2 w-2 rounded-full", workToday ? "bg-emerald-500" : "bg-amber-500 anim-pulse-glow")} />
            {workToday ? "ថ្ងៃធ្វើការផ្លូវការ" : "ថ្ងៃឈប់សម្រាក"}
          </span>
        </div>
      </div>

      {/* PWA Install Prompt Banner */}
      <PWAInstallButton variant="banner" />

      {/* Backup Alert Banner */}
      {backupDue && (
        <div className="anim-fade-up flex items-start gap-3 rounded-2xl border border-gold-300 bg-gold-50 p-4 sm:items-center">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gold-400/20 text-gold-700 text-lg">
            <i className="fa-solid fa-shield-halved" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-xs sm:text-sm font-bold text-gold-900">
              {sinceBackup === null
                ? "មិនទាន់បាន Backup ទិន្នន័យនៅឡើយទេ"
                : `មិនទាន់បាន Backup ទិន្នន័យ ${sinceBackup} ថ្ងៃហើយ`}
            </p>
            <p className="text-xs text-gold-700/90 mt-0.5">
              សូមទាញយកឯកសារ JSON រក្សាទុកក្នុងកុំព្យូទ័រ ឬ Google Drive ដើម្បីការពារការបាត់បង់ទិន្នន័យ
            </p>
          </div>
          <button
            onClick={doBackupNow}
            className="tap-press shrink-0 rounded-xl bg-gold-gradient text-navy-950 px-4 py-2.5 text-xs font-bold shadow-sm"
          >
            <i className="fa-solid fa-file-arrow-down mr-1.5" /> Backup ឥឡូវនេះ
          </button>
        </div>
      )}

      {/* ================= Master Banking Card & Quick Shortcuts ================= */}
      <div className="grid grid-cols-12 gap-3.5 sm:gap-5">
        {/* Main Bank Card */}
        <div className="col-span-12 xl:col-span-7">
          <div className="anim-fade-up d1 bg-banking-card rounded-2xl sm:rounded-3xl p-4 sm:p-6 text-white shadow-xl shadow-navy-950/15 border border-white/10 relative">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-[10px] sm:text-[11px] font-bold uppercase tracking-[0.2em] text-gold-400/90 flex items-center gap-1.5">
                  <span className="h-1.5 w-1.5 rounded-full bg-gold-400 shrink-0" />
                  Master Loan Portfolio
                </p>
                <h3 className="text-xs sm:text-sm font-bold text-navy-100 mt-0.5 sm:mt-1">
                  ទំហំឥណទានសរុបកំពុងដំណើរការ
                </h3>
              </div>
              <div className="flex items-center gap-2">
                {/* Chip Icon */}
                <span className="flex h-7 w-10 sm:h-9 sm:w-12 rounded-lg bg-gradient-to-tr from-gold-300 via-gold-400 to-gold-200 border border-gold-500/40 shadow-xs relative overflow-hidden shrink-0">
                  <span className="absolute inset-x-0 top-1/2 -translate-y-1/2 h-px bg-gold-600/50" />
                  <span className="absolute inset-y-0 left-1/2 -translate-x-1/2 w-px bg-gold-600/50" />
                </span>
                <span className="font-num text-xs sm:text-sm font-black tracking-widest text-white/90">
                  MSH
                </span>
              </div>
            </div>

            {/* Big Primary Metric */}
            <div className="mt-3.5 sm:mt-5">
              <Money
                v={totalPrincipal}
                className="text-2xl xs:text-3xl sm:text-4xl font-extrabold text-white tracking-tight leading-none break-words"
              />
              <div className="mt-2.5 sm:mt-3 flex flex-wrap items-center gap-x-3 gap-y-1.5 text-xs text-navy-200">
                <span className="flex items-center gap-1.5">
                  <i className="fa-solid fa-users text-gold-400 text-xs" /> អតិថិជនសកម្ម:{" "}
                  <span className="font-num font-bold text-white">{active.length}</span> នាក់
                </span>
                <span className="text-white/30 hidden xs:inline">•</span>
                <span className="flex items-center gap-1.5">
                  <i className="fa-solid fa-coins text-mint-400 text-xs" /> ការប្រាក់រំពឹងទុក:{" "}
                  <Money v={totalInterest} className="text-white font-bold" />
                </span>
              </div>
            </div>

            {/* Quick Action Ribbon inside Card */}
            <div className="mt-4 pt-3.5 sm:mt-6 sm:pt-5 border-t border-white/10 grid grid-cols-3 gap-1.5 sm:gap-2">
              <button
                onClick={() => go({ name: "collection" })}
                aria-label="ប្រមូលប្រាក់"
                className="tap-press min-h-[44px] flex flex-col items-center justify-center gap-1 rounded-xl sm:rounded-2xl bg-white/10 hover:bg-white/15 p-2 sm:p-2.5 transition-all text-center"
              >
                <i className="fa-solid fa-money-bill-trend-up text-gold-400 text-sm sm:text-base" />
                <span className="text-[10px] sm:text-[11px] font-bold text-white">ប្រមូលប្រាក់</span>
              </button>
              <button
                onClick={() => go({ name: "new" })}
                aria-label="បង្កើតកម្ចីថ្មី"
                className="tap-press min-h-[44px] flex flex-col items-center justify-center gap-1 rounded-xl sm:rounded-2xl bg-gold-gradient text-navy-950 p-2 sm:p-2.5 shadow-md shadow-gold-500/20 font-bold transition-all text-center"
              >
                <i className="fa-solid fa-circle-plus text-sm sm:text-base" />
                <span className="text-[10px] sm:text-[11px]">បង្កើតកម្ចី</span>
              </button>
              <button
                onClick={() => go({ name: "loans" })}
                aria-label="បញ្ជីកម្ចីទាំងអស់"
                className="tap-press min-h-[44px] flex flex-col items-center justify-center gap-1 rounded-xl sm:rounded-2xl bg-white/10 hover:bg-white/15 p-2 sm:p-2.5 transition-all text-center"
              >
                <i className="fa-solid fa-file-invoice-dollar text-mint-300 text-sm sm:text-base" />
                <span className="text-[10px] sm:text-[11px] font-bold text-white">បញ្ជីកម្ចី</span>
              </button>
            </div>
          </div>
        </div>

        {/* 3 Banking Summary Cards */}
        <div className="col-span-12 xl:col-span-5 grid grid-cols-2 sm:grid-cols-2 xl:grid-cols-1 gap-2.5 sm:gap-3.5">
          {/* Card 1: Due Today */}
          <div className="anim-fade-up d2 rounded-2xl sm:rounded-3xl border border-slate-100 bg-white p-3.5 sm:p-5 shadow-xs flex flex-col justify-between">
            <div className="flex items-start justify-between gap-2">
              <p className="text-[10px] sm:text-[11px] font-bold uppercase tracking-wider text-slate-400">
                ត្រូវប្រមូលថ្ងៃនេះ
              </p>
              <span className="flex h-7 w-7 sm:h-9 sm:w-9 shrink-0 items-center justify-center rounded-xl bg-amber-50 text-amber-600 border border-amber-200/80">
                <i className="fa-solid fa-hand-holding-dollar text-xs sm:text-sm" />
              </span>
            </div>
            <div className="mt-2 min-w-0">
              <Money
                v={dueToday}
                className="block text-base xs:text-lg sm:text-2xl font-black text-navy-900 leading-tight break-words whitespace-normal"
              />
              <p className="text-[10px] sm:text-xs text-slate-500 mt-1 flex items-center gap-1.5 flex-wrap">
                <span className="h-1.5 w-1.5 rounded-full bg-amber-500 shrink-0" />
                <span>
                  <span className="font-num font-bold text-navy-800">{dueRows.length}</span> កម្ចីត្រូវបង់
                </span>
              </p>
            </div>
          </div>

          {/* Card 2: Collected Today */}
          <div className="anim-fade-up d3 rounded-2xl sm:rounded-3xl border border-slate-100 bg-white p-3.5 sm:p-5 shadow-xs flex flex-col justify-between">
            <div className="flex items-start justify-between gap-2">
              <p className="text-[10px] sm:text-[11px] font-bold uppercase tracking-wider text-slate-400">
                ប្រមូលបានថ្ងៃនេះ
              </p>
              <span className="flex h-7 w-7 sm:h-9 sm:w-9 shrink-0 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600 border border-emerald-200/80">
                <i className="fa-solid fa-circle-check text-xs sm:text-sm" />
              </span>
            </div>
            <div className="mt-2 min-w-0">
              <Money
                v={collectedToday}
                className="block text-base xs:text-lg sm:text-2xl font-black text-emerald-600 leading-tight break-words whitespace-normal"
              />
              <p className="text-[10px] sm:text-xs text-slate-500 mt-1 flex items-center gap-1.5 flex-wrap">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 shrink-0" />
                <span>
                  {db.payments.filter((p) => p.date === t).length} ប្រតិបត្តិការ
                </span>
              </p>
            </div>
          </div>

          {/* Card 3: Loan Distribution */}
          <div className="anim-fade-up d4 rounded-2xl sm:rounded-3xl border border-slate-100 bg-white p-3.5 sm:p-5 shadow-xs col-span-2 sm:col-span-2 xl:col-span-1">
            <div className="flex items-center justify-between text-xs font-bold text-slate-500 mb-2">
              <span className="text-[11px] sm:text-xs">សមាមាត្រប្រភេទកម្ចី</span>
              <span className="font-num text-navy-900">{active.length} កម្ចី</span>
            </div>
            <div className="flex h-2 sm:h-2.5 overflow-hidden rounded-full bg-slate-100 border border-slate-200/40">
              <div
                className="bg-navy-800 transition-all duration-500"
                style={{ width: active.length ? `${(dailyCount / active.length) * 100}%` : "0%" }}
              />
              <div
                className="bg-gold-500 transition-all duration-500"
                style={{ width: active.length ? `${(monthlyCount / active.length) * 100}%` : "0%" }}
              />
            </div>
            <div className="mt-2 flex items-center justify-between text-[11px] sm:text-xs">
              <span className="flex items-center gap-1.5 font-semibold text-navy-800">
                <span className="h-2 w-2 rounded-full bg-navy-800" /> បង់រាល់ថ្ងៃ:{" "}
                <span className="font-num font-bold">{dailyCount}</span>
              </span>
              <span className="flex items-center gap-1.5 font-semibold text-gold-700">
                <span className="h-2 w-2 rounded-full bg-gold-500" /> បង់ប្រចាំខែ:{" "}
                <span className="font-num font-bold">{monthlyCount}</span>
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* ================= Collection Rows & Analytics ================= */}
      <div className="grid grid-cols-12 gap-5">
        {/* Today's due list */}
        <div className="col-span-12 xl:col-span-7 space-y-5">
          <Card className="anim-fade-up d2 overflow-hidden">
            <CardHead
              icon="fa-money-bill-transfer"
              title="បញ្ជីត្រូវប្រមូលថ្ងៃនេះ"
              en="Today's Priority Collection"
              right={
                <button
                  onClick={() => go({ name: "collection" })}
                  className="text-xs font-bold text-navy-700 hover:text-gold-600 transition-colors flex items-center gap-1"
                >
                  <span>មើលទាំងអស់</span>
                  <i className="fa-solid fa-arrow-right text-[10px]" />
                </button>
              }
            />
            {db.loans.length === 0 ? (
              <Empty
                icon="fa-folder-plus"
                title="មិនទាន់មានកម្ចីនៅឡើយទេ"
                sub="សូមចុចប៊ូតុងខាងក្រោមដើម្បីបង្កើតកិច្ចសន្យាកម្ចីដំបូងរបស់អ្នក"
                action={
                  <button
                    onClick={() => go({ name: "new" })}
                    className="tap-press rounded-xl bg-gold-gradient px-5 py-2.5 text-xs font-bold text-navy-950 shadow-md"
                  >
                    <i className="fa-solid fa-plus mr-1" /> បង្កើតកម្ចីថ្មី
                  </button>
                }
              />
            ) : dueRows.length === 0 ? (
              <Empty
                icon="fa-champagne-glasses"
                title="គ្មានកម្ចីដែលត្រូវប្រមូលថ្ងៃនេះទេ"
                sub="រាល់ការបង់ប្រាក់សម្រាប់ថ្ងៃនេះត្រូវបានទូទាត់រួចរាល់ទាំងអស់ហើយ!"
              />
            ) : (
              <ul className="divide-y divide-slate-100">
                {dueRows.map((x) => {
                  const dueUpTo = x.st.schedule.filter((i) => i.due <= t && i.balance > 0.005);
                  const inst = dueUpTo[dueUpTo.length - 1] ?? x.st.next!;
                  const rolled = Math.max(0, x.st.outstanding - inst.amount);
                  return (
                    <li
                      key={x.loan.id}
                      className="p-3 sm:p-4 sm:px-6 hover:bg-slate-50/70 transition-colors flex items-center justify-between gap-2.5 sm:gap-4"
                    >
                      <Avatar name={x.loan.customer} size="h-9 w-9 sm:h-10 sm:w-10 text-xs sm:text-sm" />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5 sm:gap-2">
                          <p className="truncate text-xs sm:text-sm font-bold text-navy-900">{x.loan.customer}</p>
                          <TypeBadge type={x.loan.type} />
                        </div>
                        <p className="mt-0.5 text-[11px] sm:text-xs text-slate-400 flex items-center gap-1.5 sm:gap-2 truncate">
                          <span className="font-num font-semibold text-slate-500">{x.loan.code}</span>
                          <span>លើកទី {inst.i + 1}/{x.loan.term}</span>
                          {rolled > 0.005 && (
                            <span className="text-amber-600 font-semibold font-num truncate">
                              (+{fmt(rolled)} ជំពាក់ខ្វះ)
                            </span>
                          )}
                        </p>
                      </div>
                      <div className="text-right shrink-0">
                        <p className="font-num text-xs sm:text-base font-extrabold text-navy-900 leading-tight">
                          {fmt(x.st.outstanding)}
                        </p>
                        <p className="text-[10px] text-slate-400 mt-0.5">{fmtKH(inst.due)}</p>
                      </div>
                      <button
                        onClick={() => quickCollect(x)}
                        title="ប្រមូលប្រាក់រហ័ស"
                        aria-label={`ប្រមូលប្រាក់រហ័សសម្រាប់ ${x.loan.customer}`}
                        className="tap-press flex h-11 w-11 min-h-[44px] min-w-[44px] shrink-0 items-center justify-center rounded-xl bg-emerald-500 hover:bg-emerald-600 text-white shadow-sm shadow-emerald-500/25 font-bold"
                      >
                        <i className="fa-solid fa-check text-xs sm:text-sm" />
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </Card>

          {/* Weekly Collection Chart */}
          <Card className="anim-fade-up d3 overflow-hidden">
            <CardHead
              icon="fa-chart-column"
              title="ស្ថិតិប្រមូលប្រាក់ ៧ ថ្ងៃចុងក្រោយ"
              en="Weekly Collection Trend"
              right={<span className="font-num text-xs font-bold text-emerald-600">{fmt(weekTotal)}</span>}
            />
            <div className="p-5 sm:p-6">
              <div className="flex h-40 items-end gap-3 sm:gap-4">
                {chart.map((d, i) => {
                  const isLatest = i === chart.length - 1;
                  return (
                    <div
                      key={d.date}
                      className="group relative flex h-full flex-1 flex-col items-center justify-end gap-2"
                      title={`${fmt(d.total)} នៅ ${fmtKH(d.date)}`}
                    >
                      <span className="font-num pointer-events-none absolute -top-2 rounded-lg bg-navy-900 px-2 py-1 text-[10px] font-bold text-white opacity-0 shadow-md transition-opacity group-hover:opacity-100 z-10">
                        {fmt(d.total)}
                      </span>
                      <div
                        className={cn(
                          "w-full rounded-t-xl transition-all group-hover:opacity-90",
                          isLatest
                            ? "bg-gold-gradient shadow-xs shadow-gold-500/30"
                            : "bg-navy-800"
                        )}
                        style={{
                          height: `${Math.max((d.total / maxBar) * 100, d.total > 0 ? 8 : 4)}%`,
                        }}
                      />
                    </div>
                  );
                })}
              </div>
              <div className="mt-2.5 flex gap-3 sm:gap-4 border-t border-slate-100 pt-2.5">
                {chart.map((d, i) => (
                  <p
                    key={d.date}
                    className={cn(
                      "flex-1 text-center font-num text-[11px] font-bold",
                      i === chart.length - 1 ? "text-gold-600 font-extrabold" : "text-slate-400"
                    )}
                  >
                    {KH_DAYS_SHORT[parseISO(d.date).getDay()]}
                  </p>
                ))}
              </div>
            </div>
          </Card>
        </div>

        {/* Right side: Lunar Calendar & Recent Payments */}
        <div className="col-span-12 xl:col-span-5 space-y-5">
          <KhmerCalendar />

          {/* Recent Payments Feed */}
          <Card className="anim-fade-up d4 overflow-hidden">
            <CardHead
              icon="fa-clock-rotate-left"
              title="ប្រវត្តិបង់ប្រាក់ថ្មីៗ"
              en="Recent Payment History"
            />
            {recent.length === 0 ? (
              <Empty icon="fa-receipt" title="មិនទាន់មានការបង់ប្រាក់នៅឡើយទេ" />
            ) : (
              <ul className="divide-y divide-slate-100">
                {recent.map((p) => {
                  const loan = db.loans.find((l) => l.id === p.loanId);
                  if (!loan) return null;
                  return (
                    <li key={p.id} className="p-4 sm:px-5 flex items-center gap-3 hover:bg-slate-50/60 transition-colors">
                      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600 border border-emerald-200/60">
                        <i className="fa-solid fa-arrow-down-left text-xs" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-xs sm:text-sm font-bold text-navy-900">{loan.customer}</p>
                        <p className="font-num text-[10px] sm:text-[11px] text-slate-400">
                          {loan.code} • លើកទី {p.inst + 1} • {fmtShort(p.date)}
                        </p>
                      </div>
                      <div className="text-right">
                        <span className="font-num text-xs sm:text-sm font-black text-emerald-600">
                          +{fmt(p.amount)}
                        </span>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </Card>
        </div>
      </div>

      {receipt && <ReceiptModal loan={receipt.loan} payment={receipt.payment} onClose={() => setReceipt(null)} />}
      {bulk && <BulkReceiptModal loan={bulk.loan} result={bulk.result} title={bulk.title} onClose={() => setBulk(null)} />}
    </div>
  );
}
