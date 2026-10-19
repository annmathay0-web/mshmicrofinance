import { useMemo, useState } from "react";
import { useApp } from "../lib/state";
import { copyText, fmt, fmtKH, loanStats, loanStatusOf, reminderText } from "../lib/data";
import type { LoanType } from "../lib/data";
import { khmerToGlobalDigits } from "../lib/security";
import { Avatar, Bar, Card, Empty, StatusBadge, TypeBadge } from "../components/ui";
import { cn } from "../utils/cn";

export default function Loans() {
  const { db, go, toast, deleteLoan } = useApp();
  const [q, setQ] = useState("");
  const [type, setType] = useState<"all" | LoanType>("all");
  const [status, setStatus] = useState<"all" | "active" | "done">("all");
  const [confirmId, setConfirmId] = useState<string | null>(null);

  const all = useMemo(
    () => db.loans.map((loan) => ({ loan, st: loanStats(loan, db.payments, db.settings) })),
    [db]
  );

  const rows = all.filter((x) => {
    const text = (x.loan.customer + " " + x.loan.code + " " + x.loan.phone).toLowerCase();
    if (q && !text.includes(q.toLowerCase())) return false;
    if (type !== "all" && x.loan.type !== type) return false;
    if (status === "active" && x.st.done) return false;
    if (status === "done" && !x.st.done) return false;
    return true;
  });

  const doneCount = all.filter((x) => x.st.done).length;

  const remind = (x: (typeof all)[number]) => {
    void copyText(reminderText(x.loan, x.st, db.settings.orgName)).then((ok) =>
      toast(ok ? `បានចម្លងសារសម្រាប់ ${x.loan.customer}` : "មិនអាចចម្លងបានទេ", ok ? "success" : "error")
    );
  };

  const askDelete = (id: string, name: string) => {
    if (confirmId === id) {
      deleteLoan(id);
      setConfirmId(null);
      toast(`បានលុបកម្ចី ${name} រួចរាល់`, "info");
    } else {
      setConfirmId(id);
      window.setTimeout(() => setConfirmId((c) => (c === id ? null : c)), 2600);
    }
  };

  const renderActions = (x: (typeof all)[number]) => (
    <>
      <button
        onClick={() => go({ name: "loan", id: x.loan.id })}
        title="មើលលម្អិត"
        className="tap-press flex h-11 w-11 items-center justify-center rounded-xl border border-slate-200 bg-white text-navy-700 hover:bg-slate-50 hover:border-slate-300"
      >
        <i className="fa-solid fa-eye text-xs" />
      </button>
      <button
        onClick={() => remind(x)}
        title="ផ្ញើសាររំលឹក Telegram"
        className="tap-press flex h-11 w-11 items-center justify-center rounded-xl border border-slate-200 bg-white text-[#229ED9] hover:bg-[#229ED9]/5"
      >
        <i className="fa-brands fa-telegram text-xs" />
      </button>
      <button
        onClick={() => askDelete(x.loan.id, x.loan.customer)}
        title="លុបកម្ចី"
        className={cn(
          "tap-press flex h-11 items-center justify-center rounded-xl border px-3 text-xs font-bold transition-all whitespace-nowrap",
          confirmId === x.loan.id
            ? "border-rose-500 bg-rose-600 text-white"
            : "w-11 border-slate-200 bg-white text-rose-500 hover:border-rose-200 hover:bg-rose-50"
        )}
      >
        {confirmId === x.loan.id ? "លុប?" : <i className="fa-solid fa-trash-can text-xs" />}
      </button>
    </>
  );

  return (
    <div className="space-y-4">
      {/* Search & Filters */}
      <div className="anim-fade-up flex flex-wrap items-center gap-2.5 sm:gap-3 bg-white px-4 py-3 sm:p-4 rounded-2xl sm:rounded-3xl border border-slate-100 shadow-sm">
        <div className="relative w-full sm:flex-1 sm:max-w-xs">
          <i className="fa-solid fa-magnifying-glass absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 text-xs" />
          <input
            value={q}
            onChange={(e) => setQ(khmerToGlobalDigits(e.target.value))}
            placeholder="ស្វែងរកឈ្មោះ, លេខកូដ, ទូរស័ព្ទ..."
            className="w-full h-11 rounded-xl border border-slate-200 bg-slate-50 pl-9 pr-4 text-xs sm:text-sm font-medium outline-none focus:border-navy-500 focus:bg-white"
          />
        </div>
        <div className="flex flex-1 sm:flex-initial rounded-xl border border-slate-200 bg-slate-50 p-1 min-h-[44px] items-center">
          {([["all", "ទាំងអស់"], ["daily", "បង់រាល់ថ្ងៃ"], ["monthly", "បង់ប្រចាំខែ"]] as const).map(([v, l]) => (
            <button
              key={v}
              onClick={() => setType(v)}
              className={cn(
                "flex-1 sm:flex-initial rounded-lg px-2.5 sm:px-3 py-2 min-h-[36px] text-xs font-bold transition-all tap-press text-center whitespace-nowrap",
                type === v ? "bg-navy-900 text-white shadow-xs" : "text-slate-600 hover:text-navy-900"
              )}
            >
              {l}
            </button>
          ))}
        </div>
        <select
          value={status}
          onChange={(e) => setStatus(e.target.value as typeof status)}
          className="w-full sm:w-auto h-11 rounded-xl border border-slate-200 bg-slate-50 px-3 text-xs font-bold text-navy-900 outline-none focus:border-navy-500"
        >
          <option value="all">ស្ថានភាពទាំងអស់</option>
          <option value="active">កំពុងដំណើរការ</option>
          <option value="done">បានបង់ដាច់</option>
        </select>
        <div className="ml-auto hidden items-center gap-2 text-xs font-semibold text-slate-500 md:flex">
          <span className="rounded-full bg-slate-100 px-3 py-1">សរុប: <span className="font-num font-bold text-navy-900">{all.length}</span></span>
          <span className="rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 px-3 py-1">សកម្ម: <span className="font-num font-bold">{all.length - doneCount}</span></span>
          <span className="rounded-full bg-gold-50 text-gold-800 border border-gold-300 px-3 py-1">ដាច់: <span className="font-num font-bold">{doneCount}</span></span>
        </div>
      </div>

      {rows.length === 0 && (
        <Card className="anim-fade-up d2">
          <Empty
            icon="fa-folder-open"
            title="រកមិនឃើញកម្ចីទេ"
            sub="មិនមានកម្ចីដែលត្រូវគ្នានឹងការស្វែងរក ឬតម្រងដែលបានជ្រើសរើសឡើយ"
            action={
              <button
                onClick={() => go({ name: "new" })}
                className="tap-press rounded-xl bg-gold-gradient px-5 py-2.5 text-xs font-bold text-navy-950 shadow-md"
              >
                <i className="fa-solid fa-plus mr-1" /> បង្កើតកម្ចីថ្មី
              </button>
            }
          />
        </Card>
      )}

      {/* ===== Mobile Bank Cards ===== */}
      {rows.length > 0 && (
        <ul className="anim-fade-up d2 space-y-3 md:hidden">
          {rows.map((x, idx) => {
            const pct = (x.st.paidCount / x.loan.term) * 100;
            return (
              <li key={x.loan.id} className="anim-fade-up" style={{ animationDelay: `${Math.min(idx * 35, 250)}ms` }}>
                <div className="rounded-2xl border border-slate-100 bg-white p-4 shadow-[0_4px_16px_-4px_rgba(11,25,44,0.06)]">
                  <div
                    className="flex cursor-pointer items-start gap-3 tap-press"
                    onClick={() => go({ name: "loan", id: x.loan.id })}
                  >
                    <Avatar name={x.loan.customer} />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <p className="truncate text-sm font-bold text-navy-950">{x.loan.customer}</p>
                        <TypeBadge type={x.loan.type} />
                      </div>
                      <p className="mt-0.5 text-xs text-slate-400 flex items-center gap-1.5 font-num">
                        <span className="font-semibold text-slate-600">{x.loan.code}</span>
                        <span>•</span>
                        <span>{x.loan.phone}</span>
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="font-num text-sm font-black text-navy-900 leading-tight">
                        {fmt(x.loan.principal)}
                      </p>
                      <StatusBadge s={loanStatusOf(x.st)} />
                    </div>
                  </div>

                  <div className="mt-3.5 space-y-1.5">
                    <div className="flex items-center justify-between text-xs text-slate-500 font-semibold">
                      <span>វឌ្ឍនភាពបង់ប្រាក់</span>
                      <span className="font-num">{x.st.paidCount}/{x.loan.term} ({Math.round(pct)}%)</span>
                    </div>
                    <Bar pct={pct} barClass={x.st.done ? "bg-emerald-500" : "bg-gold-500"} />
                  </div>

                  <div className="mt-3.5 pt-3 border-t border-slate-100 flex items-center justify-between gap-2">
                    <p className="text-xs text-slate-500 truncate min-w-0">
                      {x.st.next ? (
                        <>
                          លើកបន្ទាប់ #<span className="font-num font-bold text-navy-900">{x.st.next.i + 1}</span>:{" "}
                          <span className="font-num font-black text-gold-600">{fmt(x.st.next.balance)}</span>
                        </>
                      ) : (
                        <span className="font-bold text-emerald-600">
                          <i className="fa-solid fa-circle-check mr-1" /> បានបង់ដាច់
                        </span>
                      )}
                    </p>
                    <div className="flex items-center gap-1.5 shrink-0">{renderActions(x)}</div>
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      {/* ===== Desktop Ledger Table ===== */}
      <Card className="anim-fade-up d2 hidden overflow-hidden md:block">
        {rows.length > 0 && (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[900px] text-sm">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50/70 text-left text-xs font-bold text-slate-500 uppercase tracking-wider">
                  <th className="px-6 py-4">អតិថិជន</th>
                  <th className="px-6 py-4">ប្រភេទ</th>
                  <th className="px-6 py-4">ប្រាក់ដើម</th>
                  <th className="px-6 py-4">ការប្រាក់</th>
                  <th className="px-6 py-4">វឌ្ឍនភាព</th>
                  <th className="px-6 py-4">ស្ថានភាព</th>
                  <th className="px-6 py-4">លើកបន្ទាប់</th>
                  <th className="px-6 py-4 text-right">សកម្មភាព</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {rows.map((x) => {
                  const pct = (x.st.paidCount / x.loan.term) * 100;
                  return (
                    <tr
                      key={x.loan.id}
                      className="group cursor-pointer hover:bg-slate-50/70 transition-colors"
                      onClick={() => go({ name: "loan", id: x.loan.id })}
                    >
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <Avatar name={x.loan.customer} />
                          <div>
                            <p className="font-bold text-navy-900 group-hover:text-gold-600 transition-colors">
                              {x.loan.customer}
                            </p>
                            <p className="font-num text-xs text-slate-400">
                              {x.loan.code} • {x.loan.phone}
                            </p>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <TypeBadge type={x.loan.type} />
                      </td>
                      <td className="font-num px-6 py-4 font-black text-navy-900">{fmt(x.loan.principal)}</td>
                      <td className="font-num px-6 py-4 font-bold text-emerald-600">
                        {x.loan.type === "daily" ? fmt(x.loan.interest) : `${x.loan.interest}% / ខែ`}
                      </td>
                      <td className="px-6 py-4">
                        <div className="w-32">
                          <div className="mb-1 flex justify-between text-[11px] font-semibold">
                            <span className="font-num text-navy-800">{x.st.paidCount}/{x.loan.term}</span>
                            <span className="font-num text-slate-400">{Math.round(pct)}%</span>
                          </div>
                          <Bar pct={pct} barClass={x.st.done ? "bg-emerald-500" : "bg-gold-500"} />
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <StatusBadge s={loanStatusOf(x.st)} />
                      </td>
                      <td className="px-6 py-4 text-xs font-semibold text-slate-500">
                        {x.st.next ? fmtKH(x.st.next.due) : "—"}
                      </td>
                      <td className="px-6 py-4 text-right" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center justify-end gap-1.5">{renderActions(x)}</div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}
