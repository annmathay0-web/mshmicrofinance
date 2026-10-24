import { useMemo, useRef, useState } from "react";
import { useApp } from "../lib/state";
import {
  addDays,
  collectionSnapshotForDate,
  copyText,
  fmt,
  fmtKH,
  fmtShort,
  isWorking,
  KH_DAYS_SHORT,
  KH_MONTHS,
  parseISO,
  reminderTextForDate,
  round2,
  toISO,
  todayISO,
  toKhmerNum,
} from "../lib/data";
import type { CollectionSnapshot, Loan, Payment } from "../lib/data";
import { Avatar, Bar, Card, CardHead, Empty, Modal, StatusBadge, TypeBadge, useCountUp } from "../components/ui";
import ReceiptModal, { BulkReceiptModal } from "../components/Receipt";
import type { PayResult } from "../lib/state";
import { cn } from "../utils/cn";
import { fmtLunarShort, holidayName, mergedHolidayMap } from "../lib/khmerDate";
import { sanitizeNumericInput } from "../lib/security";
import { fromDate, MoonPhase } from "../lib/momentkh";

function CountMoney({ v, className }: { v: number; className?: string }) {
  const n = useCountUp(v);
  return <span className={cn("font-num", className)}>{fmt(n)}</span>;
}

export default function Collection() {
  const { db, go, recordSmartPayment, toast } = useApp();
  const t = todayISO();
  const s = db.settings;
  const [amounts, setAmounts] = useState<Record<string, string>>({});
  const [collectingId, setCollectingId] = useState<string | null>(null);
  const [dateSwitching, setDateSwitching] = useState(false);
  const [receipt, setReceipt] = useState<{ loan: Loan; payment: Payment } | null>(null);
  const [bulk, setBulk] = useState<{ loan: Loan; result: PayResult; title: string } | null>(null);
  const [viewDate, setViewDate] = useState(t);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [calYm, setCalYm] = useState<[number, number]>(() => {
    const d = parseISO(t);
    return [d.getFullYear(), d.getMonth()];
  });
  const nativeDateRef = useRef<HTMLInputElement>(null);

  const isTodayView = viewDate === t;

  const selectDate = (iso: string) => {
    if (!iso) return;
    setDateSwitching(true);
    setViewDate(iso);
    setAmounts({});
    const d = parseISO(iso);
    if (!isNaN(d.getTime())) {
      setCalYm([d.getFullYear(), d.getMonth()]);
    }
    window.setTimeout(() => setDateSwitching(false), 220);
  };

  const shiftDay = (n: number) => {
    const nextIso = toISO(addDays(parseISO(viewDate), n));
    selectDate(nextIso);
  };

  // Compute cumulative rollover snapshot for every loan as of viewDate
  const snapshots = useMemo(
    () => db.loans.map((loan) => collectionSnapshotForDate(loan, db.payments, s, viewDate)),
    [db.loans, db.payments, s, viewDate]
  );

  // Active collection queue for viewDate: includes all loans with cumulative unpaid dues up to viewDate
  const dueQueue = useMemo(
    () =>
      snapshots
        .filter((x) => !x.st.done && x.cumulativeDue > 0.005)
        .sort((a, b) => b.cumulativeDue - a.cumulativeDue),
    [snapshots]
  );

  // Loans that have installments <= viewDate and are fully settled up to viewDate
  const settledUpToDate = useMemo(
    () => snapshots.filter((x) => x.dueUpTo.length > 0 && x.cumulativeDue <= 0.005),
    [snapshots]
  );

  // Loans whose first installment is strictly after viewDate (or no due installments yet)
  const notDueRows = useMemo(
    () => snapshots.filter((x) => !x.st.done && x.dueUpTo.length === 0),
    [snapshots]
  );

  // Payments recorded on today / selected date
  const paidOnSelectedDate = useMemo(
    () => db.payments.filter((p) => p.date === viewDate),
    [db.payments, viewDate]
  );

  const paidToday = useMemo(
    () => db.payments.filter((p) => p.date === t),
    [db.payments, t]
  );

  const sumRemaining = useMemo(
    () => round2(dueQueue.reduce((acc, r) => acc + r.cumulativeDue, 0)),
    [dueQueue]
  );

  const sumPaid = useMemo(() => {
    if (isTodayView) {
      return round2(paidToday.reduce((a, b) => a + b.amount, 0));
    }
    const directOnDate = round2(paidOnSelectedDate.reduce((a, b) => a + b.amount, 0));
    const paidInScheduleUpTo = round2(snapshots.reduce((a, x) => a + x.paidUpToDate, 0));
    return Math.max(directOnDate, paidInScheduleUpTo);
  }, [isTodayView, paidToday, paidOnSelectedDate, snapshots]);

  const sumExpected = useMemo(() => round2(sumRemaining + sumPaid), [sumRemaining, sumPaid]);
  const workSelected = isWorking(parseISO(viewDate), s);
  const holiday = holidayName(viewDate, s);
  const pct = sumExpected > 0 ? Math.min(100, (sumPaid / sumExpected) * 100) : 100;

  // Calendar modal grid for calYm
  const [calY, calM] = calYm;
  const calHolidays = useMemo(() => mergedHolidayMap(s, [calY]), [s, calY]);

  const calCells = useMemo(() => {
    const firstDow = new Date(calY, calM, 1).getDay();
    const dim = new Date(calY, calM + 1, 0).getDate();
    const list: ({
      d: number;
      iso: string;
      lunar: string;
      isSun: boolean;
      dayNums: number[];
      unpaidLoans: number;
    } | null)[] = [];

    for (let i = 0; i < firstDow; i++) list.push(null);

    for (let d = 1; d <= dim; d++) {
      const dateObj = new Date(calY, calM, d);
      const iso = toISO(dateObj);
      const kh = fromDate(dateObj).khmer;
      const lunar = `${toKhmerNum(kh.day)}${kh.moonPhase === MoonPhase.Waxing ? "ក" : "រ"}`;

      const dayNums: number[] = [];
      let unpaidLoans = 0;
      for (const snap of snapshots) {
        if (snap.st.done) continue;
        const found = snap.st.schedule.find((i) => i.due === iso);
        if (found) {
          if (!dayNums.includes(found.i + 1)) dayNums.push(found.i + 1);
        }
        const hasUnpaidUpTo = snap.st.schedule.some((i) => i.due <= iso && i.balance > 0.005);
        if (hasUnpaidUpTo && found) unpaidLoans++;
      }

      list.push({
        d,
        iso,
        lunar,
        isSun: kh.dayOfWeek === 0,
        dayNums,
        unpaidLoans,
      });
    }
    while (list.length % 7 !== 0) list.push(null);
    return list;
  }, [calY, calM, snapshots]);

  const collect = (snap: CollectionSnapshot) => {
    const defaultAmt = snap.cumulativeDue;
    if (defaultAmt <= 0.005 || collectingId === snap.loan.id) return;
    const raw = amounts[snap.loan.id] ?? String(defaultAmt);
    const amt = parseFloat(raw);
    if (isNaN(amt) || amt <= 0) {
      toast("ចំនួនទឹកប្រាក់មិនត្រឹមត្រូវ", "error");
      return;
    }

    setCollectingId(snap.loan.id);
    window.setTimeout(() => {
      const res = recordSmartPayment(snap.loan.id, amt);
      setCollectingId(null);
      if (!res) return;

      setAmounts((a) => {
        const n = { ...a };
        delete n[snap.loan.id];
        return n;
      });

      const shortageAfter = round2(Math.max(0, defaultAmt - res.total));
      if (res.payments.length === 1) {
        if (shortageAfter > 0.005) {
          toast(`បានបង់ ${fmt(res.total)} នៅខ្វះ ${fmt(shortageAfter)} (បង្វិលទៅមុខ)`, "info");
        } else {
          toast(`បានប្រមូលប្រាក់ ${fmt(res.total)} ពី ${snap.loan.customer}`);
        }
        setReceipt({ loan: snap.loan, payment: res.payments[0] });
      } else {
        if (shortageAfter > 0.005) {
          toast(
            `បានបង់ ${fmt(res.total)} (${res.cleared} លើក) នៅខ្វះ ${fmt(shortageAfter)} (បង្វិលទៅមុខ)`,
            "info"
          );
        } else {
          toast(`បានប្រមូល ${res.payments.length} លើកពី ${snap.loan.customer} សរុប ${fmt(res.total)}`);
        }
        setBulk({
          loan: snap.loan,
          result: res,
          title: isTodayView ? "CUMULATIVE COLLECTION" : `COLLECTION UP TO ${viewDate}`,
        });
      }
    }, 140);
  };

  const remind = async (snap: CollectionSnapshot) => {
    const ok = await copyText(reminderTextForDate(snap, s.orgName));
    toast(ok ? "បានចម្លងសារសម្រាប់ Telegram" : "មិនអាចចម្លងបានទេ", ok ? "success" : "error");
  };

  return (
    <div className="space-y-4 sm:space-y-5">
      {/* Date Filter Header Toolbar */}
      <div className="anim-fade-up flex flex-wrap items-center justify-between gap-2.5 rounded-2xl sm:rounded-3xl border border-slate-100 bg-white px-4 py-3 sm:p-4 shadow-sm">
        <div className="flex items-center gap-1.5 flex-wrap">
          {/* Prev / Next Day Stepper */}
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => shiftDay(-1)}
              title="ថ្ងៃមុន"
              aria-label="ថ្ងៃមុន"
              className="tap-press flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-slate-200 bg-slate-50 hover:bg-white text-navy-800"
            >
              <i className="fa-solid fa-chevron-left text-xs" />
            </button>
            <button
              type="button"
              onClick={() => shiftDay(1)}
              title="ថ្ងៃបន្ទាប់"
              aria-label="ថ្ងៃបន្ទាប់"
              className="tap-press flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-slate-200 bg-slate-50 hover:bg-white text-navy-800"
            >
              <i className="fa-solid fa-chevron-right text-xs" />
            </button>
          </div>

          {/* Today & Interactive Date Picker Toggle */}
          <div className="flex items-center rounded-xl border border-slate-200 bg-slate-50 p-1 gap-1 min-h-[44px]">
            <button
              type="button"
              onClick={() => selectDate(t)}
              className={cn(
                "tap-press rounded-lg px-3 py-2 text-xs font-bold transition-all min-h-[36px] whitespace-nowrap",
                isTodayView ? "bg-navy-900 text-white shadow-xs" : "text-slate-600 hover:text-navy-900"
              )}
            >
              ថ្ងៃនេះ
            </button>
            <button
              type="button"
              onClick={() => setPickerOpen(true)}
              className={cn(
                "tap-press flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-bold transition-all min-h-[36px] whitespace-nowrap",
                !isTodayView
                  ? "bg-navy-900 text-gold-400 shadow-xs"
                  : "text-slate-700 hover:bg-white hover:text-navy-900"
              )}
            >
              <i className="fa-regular fa-calendar-days text-xs text-gold-500" />
              <span>រើសថ្ងៃ</span>
            </button>
          </div>

          {/* Direct Native Date Input */}
          <div className="relative flex items-center">
            <input
              ref={nativeDateRef}
              type="date"
              value={viewDate}
              onChange={(e) => e.target.value && selectDate(e.target.value)}
              aria-label="ជ្រើសរើសកាលបរិច្ឆេទ"
              className="font-num h-11 rounded-xl border border-slate-200 bg-slate-50 hover:bg-white px-3 text-xs font-bold text-navy-900 outline-none focus:border-navy-900 cursor-pointer"
            />
          </div>
        </div>

        {/* Active Date & Khmer Lunar Display */}
        <div className="flex items-center gap-1.5 text-xs text-navy-900 font-bold ml-auto sm:ml-0">
          <button
            type="button"
            onClick={() => setPickerOpen(true)}
            className="tap-press flex items-center gap-1.5 rounded-xl bg-navy-50 border border-navy-100 px-3 py-2 min-h-[44px] text-xs font-bold text-navy-900 hover:border-navy-300 whitespace-nowrap"
          >
            {dateSwitching ? (
              <i className="fa-solid fa-circle-notch fa-spin text-gold-600 text-xs" />
            ) : (
              <i className="fa-solid fa-calendar-check text-gold-600 text-xs" />
            )}
            <span>{fmtKH(viewDate)}</span>
          </button>
          <span className="rounded-xl border border-gold-300 bg-gold-50 px-2.5 py-2 min-h-[44px] text-[11px] text-gold-800 font-semibold hidden xs:inline-flex items-center gap-1 whitespace-nowrap">
            <i className="fa-solid fa-moon text-[9px] text-gold-600" />
            {fmtLunarShort(viewDate)}
          </span>
        </div>
      </div>

      {/* 3 Metrics Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 sm:gap-4">
        <div className="rounded-2xl sm:rounded-3xl border border-slate-100 bg-white p-3.5 sm:p-5 shadow-xs">
          <p className="text-[10px] sm:text-[11px] font-bold uppercase tracking-wider text-slate-400 truncate">
            {isTodayView ? "ត្រូវប្រមូលសរុប (ថ្ងៃនេះ)" : `ត្រូវប្រមូលសរុប (ដល់ ${fmtShort(viewDate)})`}
          </p>
          <CountMoney v={sumExpected} className="mt-1 block text-lg sm:text-2xl font-black text-navy-900 leading-tight" />
          <p className="mt-1 text-[10px] text-slate-400 font-medium truncate">
            រួមបញ្ចូលបំណុលជំពាក់ខ្វះបង្វិលមក
          </p>
        </div>

        <div className="rounded-2xl sm:rounded-3xl border border-slate-100 bg-white p-3.5 sm:p-5 shadow-xs">
          <p className="text-[10px] sm:text-[11px] font-bold uppercase tracking-wider text-slate-400 truncate">
            ប្រមូលបានជាក់ស្តែង
          </p>
          <CountMoney v={sumPaid} className="mt-1 block text-lg sm:text-2xl font-black text-emerald-600 leading-tight" />
          <p className="mt-1 text-[10px] text-slate-400 font-medium truncate">
            {isTodayView ? "ទូទាត់ថ្ងៃនេះ" : `ទូទាត់ដល់ ${fmtShort(viewDate)}`}
          </p>
        </div>

        <div className="rounded-2xl sm:rounded-3xl border border-slate-100 bg-white p-3.5 sm:p-5 shadow-xs col-span-2 sm:col-span-1">
          <div className="flex items-center justify-between">
            <p className="text-[10px] sm:text-[11px] font-bold uppercase tracking-wider text-slate-400 truncate">
              នៅខ្វះ (Remaining)
            </p>
            <span className="font-num text-[11px] sm:text-xs font-bold text-gold-700">{Math.round(pct)}%</span>
          </div>
          <CountMoney v={sumRemaining} className="mt-1 block text-lg sm:text-2xl font-black text-gold-600 leading-tight" />
          <Bar pct={pct} className="mt-2" barClass="bg-mint-500" />
        </div>
      </div>

      {!workSelected && (
        <div className="anim-fade-up d1 flex items-start gap-3 rounded-2xl border border-gold-300 bg-gold-50 p-3.5 sm:p-4 text-xs text-gold-800">
          <i className="fa-solid fa-umbrella-beach text-base mt-0.5 shrink-0" />
          <div>
            <p className="font-bold text-sm">
              ថ្ងៃ {fmtKH(viewDate)} ជាថ្ងៃឈប់សម្រាក {holiday ? `(${holiday})` : "(ចុងសប្តាហ៍)"}
            </p>
            <p className="mt-0.5 text-gold-700 leading-relaxed">
              កាលវិភាគធម្មតានឹងរំលងថ្ងៃនេះដោយស្វ័យប្រវត្តិ។ ប៉ុន្តែប្រសិនបើអតិថិជនមានប្រាក់ជំពាក់ខ្វះពីមុនមក អ្នកនៅតែអាចកត់ត្រាការប្រមូលប្រាក់បានធម្មតា។
            </p>
          </div>
        </div>
      )}

      {/* Cumulative Rollover Collection Queue Card */}
      <Card className="anim-fade-up d2 overflow-hidden">
        <CardHead
          icon="fa-money-bill-wave"
          title={
            isTodayView
              ? "បញ្ជីប្រមូលប្រាក់ថ្ងៃនេះ (Rollover Arrears)"
              : `បញ្ជីប្រមូលប្រាក់គិតត្រឹម ${fmtKH(viewDate)}`
          }
          en={
            isTodayView
              ? "Today's Cumulative Collection Queue"
              : `Cumulative Rollover Collection Queue • ${viewDate}`
          }
          right={
            <div className="flex items-center gap-2">
              {!isTodayView && (
                <button
                  type="button"
                  onClick={() => selectDate(t)}
                  className="tap-press hidden sm:inline-flex items-center gap-1 rounded-full border border-slate-200 bg-white px-2.5 py-1 text-[11px] font-bold text-navy-700 hover:bg-slate-50"
                >
                  <i className="fa-solid fa-rotate-left text-[10px]" />
                  <span>ត្រឡប់មកថ្ងៃនេះ</span>
                </button>
              )}
              <span className="font-num rounded-full bg-navy-50 border border-navy-100 px-3 py-1 text-xs font-bold text-navy-800">
                {dueQueue.length} កម្ចី
              </span>
            </div>
          }
        />

        {dueQueue.length === 0 ? (
          db.loans.length === 0 ? (
            <Empty
              icon="fa-folder-plus"
              title="មិនទាន់មានកម្ចីនៅឡើយទេ"
              sub="សូមបង្កើតកម្ចីដំបូងរបស់អ្នក ដើម្បីចាប់ផ្តើមកាលវិភាគប្រមូលប្រាក់"
              action={
                <button
                  onClick={() => go({ name: "new" })}
                  className="tap-press rounded-xl bg-gold-gradient px-5 py-2.5 text-xs font-bold text-navy-950 shadow-md"
                >
                  <i className="fa-solid fa-plus mr-1" /> បង្កើតកម្ចីថ្មី
                </button>
              }
            />
          ) : (
            <Empty
              icon="fa-circle-check"
              title={`ការប្រមូលប្រាក់ត្រឹមថ្ងៃ ${fmtKH(viewDate)} បានទូទាត់រួចរាល់ទាំងអស់`}
              sub="គ្មានបំណុលជំពាក់ខ្វះដែលនៅសេសសល់សម្រាប់កាលបរិច្ឆេទនេះទេ"
            />
          )
        ) : (
          <ul className="divide-y divide-slate-100">
            {dueQueue.map((snap) => {
              const {
                loan,
                targetInst,
                firstUnpaidInst,
                cumulativeDue,
                currentDayBase,
                rolledArrears,
                advanceCredit,
                unpaidCount,
              } = snap;
              if (!targetInst) return null;

              const currentInputVal = amounts[loan.id] ?? String(cumulativeDue);
              const isCustomAmt =
                amounts[loan.id] !== undefined &&
                Math.abs(parseFloat(amounts[loan.id]) - cumulativeDue) > 0.005;

              return (
                <li
                  key={loan.id}
                  className="p-3.5 sm:p-5 hover:bg-slate-50/60 transition-colors flex flex-col md:grid md:grid-cols-[1.3fr_1.2fr_1.5fr] gap-3"
                >
                  {/* Block 1: Customer Identification */}
                  <div className="flex items-center gap-3 min-w-0">
                    <Avatar name={loan.customer} />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => go({ name: "loan", id: loan.id })}
                          className="truncate text-sm font-bold text-navy-900 hover:text-gold-600 text-left transition-colors"
                        >
                          {loan.customer}
                        </button>
                        <TypeBadge type={loan.type} />
                      </div>
                      <p className="mt-0.5 text-xs text-slate-400 flex items-center gap-2 font-num">
                        <span className="font-semibold text-slate-600">{loan.code}</span>
                        <span>•</span>
                        <span>{loan.phone}</span>
                      </p>
                    </div>
                  </div>

                  {/* Block 2: Cumulative Rollover & Installment Breakdown */}
                  <div className="text-xs flex flex-col justify-center">
                    <p className="font-bold text-navy-800 flex items-center gap-1.5 flex-wrap">
                      <span>
                        លើកទី{" "}
                        <span className="font-num">
                          {unpaidCount > 1 && firstUnpaidInst
                            ? `#${firstUnpaidInst.i + 1} ដល់ #${targetInst.i + 1}/${loan.term}`
                            : `#${targetInst.i + 1}/${loan.term}`}
                        </span>
                      </span>
                      <span>•</span>
                      <span className="text-slate-600">{fmtKH(targetInst.due)}</span>
                      <span className="text-[11px] text-gold-600 font-medium">
                        ({fmtLunarShort(targetInst.due)})
                      </span>
                    </p>
                    <div className="mt-1.5 flex flex-wrap gap-1.5">
                      {rolledArrears > 0.005 && (
                        <span className="inline-flex items-center rounded-md bg-amber-50 border border-amber-300 px-2 py-0.5 text-[10px] font-bold text-amber-900">
                          <i className="fa-solid fa-triangle-exclamation mr-1 text-amber-600" />
                          +{fmt(rolledArrears)} (ជំពាក់ខ្វះ)
                        </span>
                      )}
                      {unpaidCount > 1 && (
                        <span className="inline-flex items-center rounded-md bg-rose-50 border border-rose-200 px-2 py-0.5 text-[10px] font-bold text-rose-700 font-num">
                          <i className="fa-solid fa-layer-group mr-1 text-[9px]" />
                          សរុប {unpaidCount} លើក
                        </span>
                      )}
                      {advanceCredit > 0.005 && (
                        <span className="inline-flex items-center rounded-md bg-emerald-50 border border-emerald-200 px-2 py-0.5 text-[10px] font-bold text-emerald-800">
                          <i className="fa-solid fa-circle-check mr-1 text-emerald-600" />
                          លើស -{fmt(advanceCredit)}
                        </span>
                      )}
                    </div>
                    {rolledArrears > 0.005 && currentDayBase > 0.005 && (
                      <p className="mt-1 text-[10px] text-slate-500 font-num">
                        ថ្ងៃនេះ: <span className="font-bold text-navy-800">{fmt(currentDayBase)}</span> + ជំពាក់ចាស់:{" "}
                        <span className="font-bold text-amber-700">{fmt(rolledArrears)}</span>
                      </p>
                    )}
                  </div>

                  {/* Block 3: Cumulative Total & Collection Controls */}
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between md:justify-end gap-2.5 pt-2.5 md:pt-0 border-t md:border-t-0 border-slate-100">
                    <div className="flex items-center justify-between sm:block text-left md:text-right md:mr-2">
                      <div>
                        <p className="font-num text-base sm:text-lg font-black text-navy-900 leading-tight">
                          {fmt(cumulativeDue)}
                        </p>
                        <p className="text-[10px] text-slate-400 font-semibold">
                          {unpaidCount > 1
                            ? `សរុប ${unpaidCount} លើក`
                            : rolledArrears > 0.005
                              ? "បូកប្រាក់ជំពាក់ខ្វះ"
                              : "ប្រាក់ត្រូវបង់លើកនេះ"}
                        </p>
                      </div>
                      <div className="sm:hidden">
                        <StatusBadge s={unpaidCount > 1 ? "overdue" : targetInst.status} />
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5 w-full sm:w-auto">
                      <div className="relative flex-1 min-w-[90px] sm:w-32">
                        <input
                          type="text"
                          inputMode="decimal"
                          value={currentInputVal}
                          onChange={(e) =>
                            setAmounts((a) => ({
                              ...a,
                              [loan.id]: sanitizeNumericInput(e.target.value, true),
                            }))
                          }
                          onFocus={(e) => e.target.select()}
                          aria-label={`ចំនួនទឹកប្រាក់ប្រមូលសម្រាប់ ${loan.customer}`}
                          className="font-num h-11 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 text-xs font-bold text-navy-900 outline-none focus:border-emerald-500 focus:bg-white"
                        />
                        {isCustomAmt && (
                          <button
                            type="button"
                            onClick={() =>
                              setAmounts((a) => {
                                const n = { ...a };
                                delete n[loan.id];
                                return n;
                              })
                            }
                            title="កំណត់ចំនួនឡើងវិញ"
                            aria-label="កំណត់ចំនួនឡើងវិញ"
                            className="tap-press absolute right-1.5 top-1/2 -translate-y-1/2 text-[10px] text-slate-400 hover:text-navy-800 px-1.5 py-1"
                          >
                            <i className="fa-solid fa-rotate-left" />
                          </button>
                        )}
                      </div>

                      <button
                        type="button"
                        disabled={collectingId === loan.id}
                        onClick={() => collect(snap)}
                        aria-label={`ប្រមូលប្រាក់ ${loan.customer}`}
                        className="tap-press flex h-11 items-center justify-center gap-1.5 rounded-xl bg-emerald-500 hover:bg-emerald-600 px-3.5 sm:px-4 text-xs font-bold text-white shadow-xs shadow-emerald-500/30 shrink-0 min-w-[76px] sm:min-w-[84px] disabled:opacity-70 whitespace-nowrap"
                      >
                        {collectingId === loan.id ? (
                          <i className="fa-solid fa-circle-notch fa-spin text-xs" />
                        ) : (
                          <i className="fa-solid fa-check text-xs" />
                        )}
                        <span>ប្រមូល</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => void remind(snap)}
                        title="ផ្ញើសាររំលឹក Telegram"
                        aria-label="ផ្ញើសាររំលឹក Telegram"
                        className="tap-press flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-slate-200 bg-white text-[#229ED9] hover:bg-[#229ED9]/10"
                      >
                        <i className="fa-brands fa-telegram text-sm" />
                      </button>

                      <button
                        type="button"
                        onClick={() => go({ name: "loan", id: loan.id })}
                        title="មើលលម្អិត"
                        aria-label="មើលលម្អិតកម្ចី"
                        className="tap-press flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-slate-200 bg-white text-navy-700 hover:bg-slate-50"
                      >
                        <i className="fa-solid fa-eye text-xs" />
                      </button>
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </Card>

      {/* Bottom Grid: Already Collected / Settled Feed & Upcoming Loans */}
      <div className="grid grid-cols-12 gap-5">
        <Card className="anim-fade-up d3 col-span-12 lg:col-span-7 overflow-hidden">
          <CardHead
            icon="fa-circle-check"
            title={isTodayView ? "បានទូទាត់រួចថ្ងៃនេះ" : `បានទូទាត់ដល់ថ្ងៃ ${fmtKH(viewDate)}`}
            en={isTodayView ? "Already Settled Today" : "Settled Up To Selected Date"}
            right={<span className="font-num text-xs font-bold text-emerald-600">{fmt(sumPaid)}</span>}
          />

          {isTodayView ? (
            paidToday.length === 0 ? (
              <Empty icon="fa-inbox" title="មិនទាន់មានការបង់ប្រាក់នៅឡើយទេ" />
            ) : (
              <ul className="divide-y divide-slate-100">
                {[...paidToday].reverse().map((p) => {
                  const loan = db.loans.find((l) => l.id === p.loanId);
                  if (!loan) return null;
                  return (
                    <li key={p.id} className="p-3.5 sm:px-5 flex items-center gap-3 hover:bg-slate-50/60">
                      <Avatar name={loan.customer} />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-bold text-navy-900">{loan.customer}</p>
                        <p className="font-num text-[11px] text-slate-400">
                          {loan.code} • លើកទី #{p.inst + 1}/{loan.term}
                        </p>
                      </div>
                      <span className="font-num font-black text-emerald-600 text-sm">+{fmt(p.amount)}</span>
                      <button
                        type="button"
                        onClick={() => setReceipt({ loan, payment: p })}
                        title="មើលបង្កាន់ដៃ"
                        aria-label={`មើលបង្កាន់ដៃសម្រាប់ ${loan.customer}`}
                        className="tap-press flex h-11 w-11 min-h-[44px] min-w-[44px] items-center justify-center rounded-xl border border-slate-200 bg-white text-gold-600 hover:border-gold-400 shrink-0"
                      >
                        <i className="fa-solid fa-receipt text-xs" />
                      </button>
                    </li>
                  );
                })}
              </ul>
            )
          ) : settledUpToDate.length === 0 ? (
            <Empty icon="fa-inbox" title="គ្មានកម្ចីដែលបានបង់គ្រប់ទេ" />
          ) : (
            <ul className="divide-y divide-slate-100">
              {settledUpToDate.map((snap) => {
                const lastDue = snap.dueUpTo[snap.dueUpTo.length - 1];
                return (
                  <li key={snap.loan.id} className="p-3.5 sm:px-5 flex items-center gap-3 hover:bg-slate-50/60">
                    <Avatar name={snap.loan.customer} />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-bold text-navy-900">{snap.loan.customer}</p>
                      <p className="font-num text-[11px] text-slate-400">
                        {snap.loan.code} • លើកទី #{lastDue ? lastDue.i + 1 : 1}/{snap.loan.term}
                      </p>
                    </div>
                    <span className="font-num font-black text-emerald-600 text-sm">
                      +{fmt(snap.paidUpToDate)}
                    </span>
                    <button
                      type="button"
                      onClick={() => go({ name: "loan", id: snap.loan.id })}
                      title="មើលលម្អិត"
                      aria-label={`មើលលម្អិតកម្ចី ${snap.loan.customer}`}
                      className="tap-press flex h-11 w-11 min-h-[44px] min-w-[44px] items-center justify-center rounded-xl border border-slate-200 bg-white text-navy-700 hover:bg-slate-50 shrink-0"
                    >
                      <i className="fa-solid fa-eye text-xs" />
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </Card>

        {/* Not Due Yet (After viewDate) */}
        <Card className="anim-fade-up d4 col-span-12 lg:col-span-5 overflow-hidden">
          <CardHead icon="fa-hourglass-start" title="មិនទាន់ដល់ថ្ងៃកំណត់" en="Upcoming Installments" />
          {notDueRows.length === 0 ? (
            <Empty icon="fa-layer-group" title="គ្មានកម្ចីរង់ចាំទេ" />
          ) : (
            <ul className="divide-y divide-slate-100 max-h-96 overflow-y-auto">
              {notDueRows.map((x) => {
                const nx = x.st.next;
                return (
                  <li key={x.loan.id} className="p-3.5 sm:p-4 flex items-center gap-3 hover:bg-slate-50/60">
                    <Avatar name={x.loan.customer} size="h-9 w-9 text-xs" />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-xs sm:text-sm font-bold text-navy-900">{x.loan.customer}</p>
                      <p className="text-[11px] text-slate-400">
                        {nx ? `ដល់កំណត់: ${fmtKH(nx.due)}` : "—"}
                      </p>
                    </div>
                    <TypeBadge type={x.loan.type} />
                    <button
                      type="button"
                      onClick={() => void remind(x)}
                      title="ផ្ញើសាររំលឹក Telegram"
                      aria-label={`ផ្ញើសាររំលឹក Telegram ទៅ ${x.loan.customer}`}
                      className="tap-press flex h-11 w-11 min-h-[44px] min-w-[44px] items-center justify-center rounded-xl border border-slate-200 text-[#229ED9] hover:bg-[#229ED9]/10 shrink-0"
                    >
                      <i className="fa-brands fa-telegram text-xs" />
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </Card>
      </div>

      {/* Interactive Khmer & Gregorian Date Picker Modal */}
      {pickerOpen && (
        <Modal onClose={() => setPickerOpen(false)} maxW="max-w-md">
          <div className="overflow-hidden rounded-3xl">
            <div className="bg-navy-900 p-4 sm:p-5 text-white relative">
              <div className="bg-grid-dark absolute inset-0 pointer-events-none" />
              <div className="relative flex items-center justify-between">
                <div>
                  <p className="font-num text-[10px] font-bold uppercase tracking-[0.2em] text-gold-400">
                    Collection Date Picker
                  </p>
                  <h3 className="text-base sm:text-lg font-extrabold mt-0.5">
                    ជ្រើសរើសកាលបរិច្ឆេទប្រមូលប្រាក់
                  </h3>
                  <p className="text-xs text-navy-200 mt-0.5">
                    {fmtKH(viewDate)} • {fmtLunarShort(viewDate)}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setPickerOpen(false)}
                  aria-label="បិទផ្ទាំងរើសកាលបរិច្ឆេទ"
                  className="tap-press flex h-11 w-11 min-h-[44px] min-w-[44px] items-center justify-center rounded-xl bg-white/10 text-white hover:bg-white/20"
                >
                  <i className="fa-solid fa-xmark" />
                </button>
              </div>
            </div>

            <div className="p-4 sm:p-5 space-y-4 bg-white">
              {/* Month Navigation */}
              <div className="flex items-center justify-between">
                <button
                  type="button"
                  onClick={() => {
                    const d = new Date(calY, calM - 1, 1);
                    setCalYm([d.getFullYear(), d.getMonth()]);
                  }}
                  aria-label="ខែមុន"
                  className="tap-press flex h-11 w-11 min-h-[44px] min-w-[44px] items-center justify-center rounded-xl border border-slate-200 text-navy-800 hover:bg-slate-50"
                >
                  <i className="fa-solid fa-chevron-left text-xs" />
                </button>
                <div className="text-center">
                  <p className="text-sm font-black text-navy-900">
                    ខែ {KH_MONTHS[calM]} <span className="font-num text-gold-600">{calY}</span>
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    const d = new Date(calY, calM + 1, 1);
                    setCalYm([d.getFullYear(), d.getMonth()]);
                  }}
                  aria-label="ខែបន្ទាប់"
                  className="tap-press flex h-11 w-11 min-h-[44px] min-w-[44px] items-center justify-center rounded-xl border border-slate-200 text-navy-800 hover:bg-slate-50"
                >
                  <i className="fa-solid fa-chevron-right text-xs" />
                </button>
              </div>

              {/* Calendar Grid */}
              <div className="grid grid-cols-7 gap-1">
                {KH_DAYS_SHORT.map((w, idx) => (
                  <p
                    key={w}
                    className={cn(
                      "py-1 text-center text-[11px] font-bold",
                      idx === 0 ? "text-rose-500" : "text-slate-400"
                    )}
                  >
                    {w}
                  </p>
                ))}
                {calCells.map((c, idx) => {
                  if (!c) return <div key={`empty-${idx}`} className="min-h-[46px]" />;
                  const isSelected = c.iso === viewDate;
                  const isToday = c.iso === t;
                  const hol = calHolidays.get(c.iso);

                  return (
                    <button
                      key={c.iso}
                      type="button"
                      onClick={() => {
                        selectDate(c.iso);
                        setPickerOpen(false);
                      }}
                      className={cn(
                        "tap-press relative flex min-h-[48px] flex-col items-center justify-center rounded-xl border p-1 transition-all",
                        isSelected
                          ? "border-navy-900 bg-navy-900 text-white shadow-md"
                          : isToday
                            ? "border-gold-400 bg-gold-50 text-navy-900"
                            : hol
                              ? "border-amber-200 bg-amber-50/60 text-navy-900"
                              : "border-transparent bg-slate-50/80 hover:bg-slate-100 text-navy-900"
                      )}
                    >
                      <span
                        className={cn(
                          "font-num text-xs font-black leading-tight",
                          isSelected
                            ? "text-gold-400"
                            : c.isSun
                              ? "text-rose-500"
                              : "text-navy-900"
                        )}
                      >
                        {c.d}
                      </span>
                      <span
                        className={cn(
                          "text-[8.5px] font-semibold leading-tight",
                          isSelected ? "text-white/80" : "text-slate-400"
                        )}
                      >
                        {c.dayNums.length > 0 ? `លើកទី ${c.dayNums[0]}` : c.lunar}
                      </span>
                      {c.unpaidLoans > 0 && (
                        <span
                          className={cn(
                            "absolute top-1 right-1 h-1.5 w-1.5 rounded-full",
                            isSelected ? "bg-gold-400" : "bg-emerald-500"
                          )}
                        />
                      )}
                    </button>
                  );
                })}
              </div>

              {/* Direct Date Input & Quick Actions */}
              <div className="pt-2 border-t border-slate-100 flex items-center gap-2">
                <input
                  type="date"
                  value={viewDate}
                  onChange={(e) => {
                    if (e.target.value) {
                      selectDate(e.target.value);
                      setPickerOpen(false);
                    }
                  }}
                  className="font-num flex-1 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-xs font-bold text-navy-900 outline-none focus:border-navy-900"
                />
                <button
                  type="button"
                  onClick={() => {
                    selectDate(t);
                    setPickerOpen(false);
                  }}
                  className="tap-press rounded-xl bg-gold-gradient px-4 py-2.5 text-xs font-bold text-navy-950 shadow-xs"
                >
                  ថ្ងៃនេះ
                </button>
              </div>
            </div>
          </div>
        </Modal>
      )}

      {receipt && <ReceiptModal loan={receipt.loan} payment={receipt.payment} onClose={() => setReceipt(null)} />}
      {bulk && <BulkReceiptModal loan={bulk.loan} result={bulk.result} title={bulk.title} onClose={() => setBulk(null)} />}
    </div>
  );
}
