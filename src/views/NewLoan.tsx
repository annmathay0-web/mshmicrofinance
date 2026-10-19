import { useMemo, useState, type ReactNode } from "react";
import { useApp } from "../lib/state";
import { fmt, fmtKH, round2, scheduleOf, todayISO, totalInterestOf } from "../lib/data";
import type { Loan, LoanType } from "../lib/data";
import {
  isISODate,
  khmerToGlobalDigits,
  sanitizeNumericInput,
  sanitizePhone,
  sanitizeText,
  toNonNegativeNumber,
  toPositiveInt,
  toPositiveNumber,
} from "../lib/security";
import { fmtLunar, fmtLunarShort, holidayName } from "../lib/khmerDate";
import { Card, CardHead } from "../components/ui";
import { cn } from "../utils/cn";

const inputCls =
  "w-full rounded-2xl border border-slate-200 bg-slate-50/70 px-4 py-3 text-sm font-semibold text-navy-900 outline-none transition-all placeholder:text-slate-300 focus:border-navy-600 focus:bg-white focus:ring-4 focus:ring-navy-600/10";

function Field({
  label,
  en,
  error,
  children,
}: {
  label: string;
  en: string;
  error?: string;
  children: ReactNode;
}) {
  return (
    <div>
      <label className="mb-1.5 block text-xs font-bold text-navy-900">
        {label} <span className="font-num font-medium text-slate-400">({en})</span>
      </label>
      {children}
      {error && (
        <p className="anim-fade-in mt-1 flex items-center gap-1.5 text-xs font-bold text-rose-600">
          <i className="fa-solid fa-circle-exclamation" /> {error}
        </p>
      )}
    </div>
  );
}

export default function NewLoan() {
  const { db, addLoan, go, toast } = useApp();
  const [customer, setCustomer] = useState("");
  const [phone, setPhone] = useState("");
  const [type, setType] = useState<LoanType>("daily");
  const [principal, setPrincipal] = useState("");
  const [interest, setInterest] = useState("");
  const [term, setTerm] = useState("");
  const [startDate, setStartDate] = useState(todayISO());
  const [sameDay, setSameDay] = useState(false);
  const [note, setNote] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});

  const preview = useMemo(() => {
    const p = parseFloat(principal);
    const i = parseFloat(interest || "0");
    const n = parseInt(term);
    if (!customer.trim() || isNaN(p) || p <= 0 || isNaN(i) || i < 0 || isNaN(n) || n < 1 || !startDate)
      return null;

    const loan: Loan = {
      id: "preview",
      code: "LN-NEW",
      customer: customer.trim(),
      phone: phone.trim(),
      sameDay,
      type,
      principal: p,
      interest: i,
      term: n,
      startDate,
      createdAt: todayISO(),
    };
    const sch = scheduleOf(loan, [], db.settings);
    return {
      loan,
      sch,
      amount: sch[0]?.amount ?? 0,
      totalRepay: round2(loan.principal + totalInterestOf(loan)),
    };
  }, [customer, phone, type, principal, interest, term, startDate, sameDay, db.settings]);

  const submit = () => {
    const errs: Record<string, string> = {};
    const name = sanitizeText(customer, 60);
    const tel = sanitizePhone(phone);
    const p = toPositiveNumber(principal, 1e12);
    const i = toNonNegativeNumber(interest === "" ? 0 : interest, 1e6);
    const n = toPositiveInt(term, type === "daily" ? 5000 : 240);

    if (!name) errs.customer = "សូមបញ្ចូលឈ្មោះអតិថិជន";
    if (tel.replace(/\D/g, "").length < 6) errs.phone = "លេខទូរស័ព្ទមិនត្រឹមត្រូវ";
    if (p === null) errs.principal = "ចំនួនប្រាក់ដើមត្រូវតែធំជាង 0";
    if (i === null) errs.interest = "ការប្រាក់ត្រូវតែជាចំនួនវិជ្ជមាន";
    if (n === null) errs.term = `ចំនួនលើកត្រូវតែធំជាង 0 (អតិបរមា ${type === "daily" ? 5000 : 240})`;
    if (!isISODate(startDate)) errs.startDate = "កាលបរិច្ឆេទមិនត្រឹមត្រូវ";

    setErrors(errs);
    if (Object.keys(errs).length > 0) {
      toast("សូមពិនិត្យព័ត៌មានដែលបានបញ្ចូល", "error");
      return;
    }

    const loan = addLoan({
      customer: name,
      phone: tel,
      type,
      principal: p!,
      interest: i!,
      term: n!,
      startDate,
      sameDay: type === "daily" ? sameDay : undefined,
      note: note.trim() || undefined,
    });

    toast(`បានបង្កើតកម្ចី ${loan.code} ដោយជោគជ័យ!`);
    go({ name: "loan", id: loan.id });
  };

  return (
    <div className="grid grid-cols-12 gap-5">
      {/* ------------ form ------------ */}
      <Card className="anim-fade-up col-span-12 lg:col-span-7 overflow-hidden">
        <CardHead icon="fa-file-circle-plus" title="បង្កើតកិច្ចសន្យាកម្ចីថ្មី" en="Create Loan Contract" />
        <div className="space-y-5 p-5 sm:p-7">
          {/* Loan Type Selector */}
          <div>
            <p className="mb-2 text-xs font-bold text-navy-900">
              ប្រភេទកម្ចី <span className="font-num text-slate-400 font-medium">(Loan Type)</span>
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 sm:gap-3">
              {(
                [
                  ["daily", "fa-calendar-day", "បង់រាល់ថ្ងៃ", "Daily Loan", "បង់រៀងរាល់ថ្ងៃធ្វើការ (រំលងចុងសប្តាហ៍ និងថ្ងៃបុណ្យ)"],
                  ["monthly", "fa-calendar-check", "បង់ប្រចាំខែ", "Monthly Loan", "បង់ម្តងក្នុងមួយខែ តាមកាលបរិច្ឆេទកំណត់"],
                ] as const
              ).map(([v, icon, kh, en, desc]) => (
                <button
                  key={v}
                  type="button"
                  onClick={() => setType(v)}
                  className={cn(
                    "tap-press rounded-2xl border-2 p-4 text-left transition-all",
                    type === v
                      ? "border-navy-900 bg-navy-50/80 shadow-sm"
                      : "border-slate-100 bg-white hover:border-slate-300"
                  )}
                >
                  <span
                    className={cn(
                      "flex h-9 w-9 items-center justify-center rounded-xl text-sm font-bold",
                      type === v ? "bg-navy-900 text-gold-400 shadow-xs" : "bg-slate-100 text-slate-500"
                    )}
                  >
                    <i className={cn("fa-solid", icon)} />
                  </span>
                  <p className="mt-3 font-bold text-navy-900 text-sm">
                    {kh}{" "}
                    <span className="font-num text-[10px] font-semibold tracking-wider text-slate-400 uppercase">
                      {en}
                    </span>
                  </p>
                  <p className="mt-1 text-xs leading-4 text-slate-500">{desc}</p>
                </button>
              ))}
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="ឈ្មោះអតិថិជន" en="Customer Name" error={errors.customer}>
              <input
                value={customer}
                onChange={(e) => setCustomer(khmerToGlobalDigits(e.target.value))}
                placeholder="ឧ. សុខ ពិសិដ្ឋ"
                className={inputCls}
              />
            </Field>

            <Field label="លេខទូរស័ព្ទ" en="Phone" error={errors.phone}>
              <input
                type="tel"
                inputMode="tel"
                value={phone}
                onChange={(e) => setPhone(khmerToGlobalDigits(e.target.value))}
                placeholder="012 345 678"
                className={inputCls}
              />
            </Field>

            <Field label="ប្រាក់ដើម" en="Principal (៛)" error={errors.principal}>
              <div className="relative">
                <input
                  type="text"
                  inputMode="decimal"
                  value={principal}
                  onChange={(e) => setPrincipal(sanitizeNumericInput(e.target.value, true))}
                  placeholder="4000000"
                  className={cn(inputCls, "pr-9 font-num font-bold")}
                />
                <span className="absolute right-4 top-1/2 -translate-y-1/2 font-bold text-gold-600">៛</span>
              </div>
            </Field>

            <Field
              label={type === "daily" ? "ការប្រាក់សរុប" : "អត្រាការប្រាក់"}
              en={type === "daily" ? "Total Interest (៛)" : "Rate (% / month)"}
              error={errors.interest}
            >
              <div className="relative">
                <input
                  type="text"
                  inputMode="decimal"
                  value={interest}
                  onChange={(e) => setInterest(sanitizeNumericInput(e.target.value, true))}
                  placeholder={type === "daily" ? "800000" : "3"}
                  className={cn(inputCls, "pr-9 font-num font-bold")}
                />
                {type === "daily" ? (
                  <span className="absolute right-4 top-1/2 -translate-y-1/2 font-bold text-gold-600">៛</span>
                ) : (
                  <span className="font-num absolute right-4 top-1/2 -translate-y-1/2 font-bold text-emerald-600">%</span>
                )}
              </div>
            </Field>

            <Field
              label={type === "daily" ? "ចំនួនថ្ងៃបង់" : "ចំនួនខែ"}
              en={type === "daily" ? "Payment Days" : "Months"}
              error={errors.term}
            >
              <input
                type="text"
                inputMode="numeric"
                value={term}
                onChange={(e) => setTerm(sanitizeNumericInput(e.target.value, false))}
                placeholder={type === "daily" ? "30" : "6"}
                className={cn(inputCls, "font-num font-bold")}
              />
            </Field>

            <Field label="ថ្ងៃបើកប្រាក់កម្ចី" en="Disbursement Date" error={errors.startDate}>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className={cn(inputCls, "font-num font-bold")}
              />
            </Field>
          </div>

          {type === "daily" && (
            <label className="flex cursor-pointer select-none items-center gap-3 rounded-2xl border border-slate-200 bg-slate-50/70 p-3.5 hover:bg-slate-50 transition-colors">
              <input
                type="checkbox"
                checked={sameDay}
                onChange={(e) => setSameDay(e.target.checked)}
                className="h-4 w-4 shrink-0 accent-navy-900"
              />
              <span className="text-xs leading-5 text-navy-800">
                <span className="font-bold">បង់លើកទី១ នៅថ្ងៃបើកប្រាក់ភ្លាម</span>{" "}
                <span className="font-num font-semibold text-slate-400">(Same-day collection)</span>
                <span className="block text-[11px] text-slate-500">
                  បើមិនធីកទេ ការប្រមូលលើកទី១ នឹងចាប់ផ្តើមនៅថ្ងៃធ្វើការបន្ទាប់
                </span>
              </span>
            </label>
          )}

          {startDate && isISODate(startDate) && (
            <div className="anim-fade-in space-y-1 rounded-2xl border border-slate-100 bg-slate-50 p-4 text-xs font-semibold">
              <p className="flex items-center gap-2 text-navy-800">
                <i className="fa-solid fa-moon text-gold-600" /> ថ្ងៃបើកប្រាក់:{" "}
                <span className="text-gold-700 font-bold">{fmtLunar(startDate)}</span>
              </p>
              {preview && preview.sch.length > 0 && (
                <p className="flex items-center gap-2 text-emerald-700">
                  <i className="fa-solid fa-calendar-check" /> ថ្ងៃបង់លើកទី១:{" "}
                  <span className="font-bold text-navy-900">{fmtKH(preview.sch[0].due)}</span>
                  <span className="text-gold-600"> ({fmtLunarShort(preview.sch[0].due)})</span>
                </p>
              )}
              {sameDay && holidayName(startDate, db.settings) && (
                <p className="flex items-center gap-2 text-amber-700">
                  <i className="fa-solid fa-triangle-exclamation" /> ថ្ងៃបើកប្រាក់ចំថ្ងៃបុណ្យ:{" "}
                  {holidayName(startDate, db.settings)}
                </p>
              )}
            </div>
          )}

          <Field label="កំណត់សម្គាល់ / ទ្រព្យបញ្ចាំ" en="Note / Collateral">
            <textarea
              value={note}
              onChange={(e) => setNote(khmerToGlobalDigits(e.target.value))}
              rows={2}
              placeholder="ព័ត៌មានបន្ថែម..."
              className={cn(inputCls, "resize-none")}
            />
          </Field>

          <div className="flex gap-3 pt-3 border-t border-slate-100">
            <button
              onClick={submit}
              className="tap-press flex-1 flex items-center justify-center gap-2.5 rounded-2xl bg-navy-900 hover:bg-navy-800 py-3.5 text-sm font-bold text-white shadow-lg shadow-navy-950/20"
            >
              <i className="fa-solid fa-circle-check text-gold-400" />
              <span>រក្សាទុកកម្ចី (Save Loan)</span>
            </button>
            <button
              onClick={() => go({ name: "loans" })}
              className="tap-press rounded-2xl border border-slate-200 bg-white px-6 py-3.5 text-sm font-bold text-navy-700 hover:bg-slate-50"
            >
              បោះបង់
            </button>
          </div>
        </div>
      </Card>

      {/* ------------ live banking preview ------------ */}
      <div className="col-span-12 lg:col-span-5 space-y-4">
        <div className="anim-fade-up d2 space-y-4 lg:sticky lg:top-24">
          {/* Preview Banking Card */}
          <div className="bg-banking-card rounded-3xl p-6 text-white shadow-xl shadow-navy-950/15 border border-white/10 relative">
            <div className="flex items-center justify-between">
              <p className="text-[11px] font-bold uppercase tracking-wider text-gold-400">
                {type === "daily" ? "បង់រាល់ថ្ងៃ (Daily)" : "បង់ប្រចាំខែ (Monthly)"}
              </p>
              <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-gold-400/20 text-gold-300 text-sm">
                <i className="fa-solid fa-calculator" />
              </span>
            </div>
            <p className="font-num mt-3 text-3xl sm:text-4xl font-black text-white">
              {preview ? fmt(preview.amount) : "0 ៛"}
            </p>
            <p className="mt-1 text-xs text-navy-200">
              {preview ? `បង់មួយលើក (សរុប ${preview.loan.term} លើក)` : "ទឹកប្រាក់ត្រូវបង់ក្នុងមួយលើក"}
            </p>
          </div>

          <Card className="p-5 space-y-3">
            <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider">សង្ខេបកិច្ចសន្យា</h4>
            {preview ? (
              <div className="space-y-2 text-xs">
                {[
                  ["ប្រាក់ដើម:", fmt(preview.loan.principal)],
                  ["ការប្រាក់សរុប:", fmt(totalInterestOf(preview.loan))],
                  ["សរុបត្រូវបង់:", fmt(preview.totalRepay)],
                  ["ថ្ងៃបង់ដំបូង:", `${fmtKH(preview.sch[0].due)} (${fmtLunarShort(preview.sch[0].due)})`],
                  ["ថ្ងៃបញ្ចប់:", fmtKH(preview.sch[preview.sch.length - 1].due)],
                ].map(([k, v]) => (
                  <div key={k} className="flex items-center justify-between border-b border-slate-100 pb-1.5">
                    <span className="text-slate-500 font-semibold">{k}</span>
                    <span className="font-num font-bold text-navy-900 text-right">{v}</span>
                  </div>
                ))}
                <div className="pt-2">
                  <p className="mb-2 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                    កាលវិភាគបង់ប្រាក់បឋម
                  </p>
                  <ul className="space-y-1">
                    {preview.sch.slice(0, 6).map((i) => (
                      <li key={i.i} className="flex items-center justify-between p-2 rounded-xl bg-slate-50 text-xs">
                        <span className="font-num font-bold text-navy-700">#{i.i + 1}</span>
                        <span className="text-slate-600 font-semibold">{fmtKH(i.due)}</span>
                        <span className="font-num font-black text-navy-900">{fmt(i.amount)}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            ) : (
              <div className="py-8 text-center">
                <i className="fa-solid fa-wand-magic-sparkles text-2xl text-slate-300" />
                <p className="text-xs font-bold text-navy-900 mt-2">ការគណនាកម្ចីផ្ទាល់</p>
                <p className="text-[11px] text-slate-400 mt-0.5">សូមបញ្ចូលព័ត៌មានកម្ចីដើម្បីមើលការគណនា</p>
              </div>
            )}
          </Card>
        </div>
      </div>
    </div>
  );
}
