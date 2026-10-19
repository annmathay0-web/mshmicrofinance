import { useMemo, useState } from "react";
import { useApp } from "../lib/state";
import { fromDate, MoonPhase } from "../lib/momentkh";
import type { KhmerDateInfo } from "../lib/momentkh";
import { KH_MONTHS, toISO, toKhmerNum } from "../lib/data";
import { holidayName, mergedHolidayMap } from "../lib/khmerDate";
import { Card } from "./ui";
import { cn } from "../utils/cn";

const WEEK_HEAD = [
  { full: "អាទិត្យ", short: "អា" },
  { full: "ច័ន្ទ", short: "ច" },
  { full: "អង្គារ", short: "អ" },
  { full: "ពុធ", short: "ពុ" },
  { full: "ព្រហស្បតិ៍", short: "ព្រ" },
  { full: "សុក្រ", short: "សុ" },
  { full: "សៅរ៍", short: "ស" },
];

type Cell = { d: number; iso: string; kh: KhmerDateInfo } | null;

export default function KhmerCalendar() {
  const { db } = useApp();
  const now = new Date();
  const tISO = toISO(now);
  const [ym, setYm] = useState<[number, number]>([now.getFullYear(), now.getMonth()]);
  const [y, m] = ym;

  const today = useMemo(() => fromDate(now).khmer, []);
  const holidays = useMemo(() => mergedHolidayMap(db.settings, [y]), [db.settings, y]);
  const todayHoliday = holidayName(tISO, db.settings);

  const cells = useMemo<Cell[]>(() => {
    const firstDow = new Date(y, m, 1).getDay();
    const dim = new Date(y, m + 1, 0).getDate();
    const list: Cell[] = [];
    for (let i = 0; i < firstDow; i++) list.push(null);
    for (let d = 1; d <= dim; d++) {
      list.push({ d, iso: toISO(new Date(y, m, d)), kh: fromDate(new Date(y, m, d)).khmer });
    }
    while (list.length % 7 !== 0) list.push(null);
    return list;
  }, [y, m]);

  const nav = (dir: number) => {
    const d = new Date(y, m + dir, 1);
    setYm([d.getFullYear(), d.getMonth()]);
  };

  const waxing = today.moonPhase === MoonPhase.Waxing;

  return (
    <Card className="anim-fade-up d4 overflow-hidden">
      {/* ------- today banner ------- */}
      <div className="relative bg-navy-900 p-4 sm:p-5 text-white">
        <div className="bg-grid-dark absolute inset-0 pointer-events-none" />
        <div className="absolute -right-8 -top-10 h-36 w-36 rounded-full bg-gold-400/15 blur-2xl" />
        <div className="relative flex items-start justify-between gap-3">
          <div>
            <p className="font-num text-[10px] font-bold uppercase tracking-[0.22em] text-navy-300">
              Khmer Lunar Calendar
            </p>
            <p className="mt-1.5 text-base sm:text-xl font-bold leading-tight">
              ថ្ងៃ {today.dayOfWeekName}{" "}
              <span className="text-gold-400">
                {toKhmerNum(today.day)} {today.moonPhaseName}
              </span>
            </p>
            <p className="mt-0.5 text-xs sm:text-sm text-navy-200">
              ខែ {today.monthName} ឆ្នាំ {today.animalYearName} {today.sakName}
            </p>
            <div className="mt-2.5 flex flex-wrap gap-1.5">
              <span className="rounded-md bg-white/10 px-2 py-0.5 font-num text-[10px] sm:text-[11px] font-bold text-gold-400">
                ព.ស. {toKhmerNum(today.beYear)}
              </span>
              <span className="rounded-md bg-white/10 px-2 py-0.5 font-num text-[10px] sm:text-[11px] font-bold text-navy-200">
                ច.ស. {toKhmerNum(today.jsYear)}
              </span>
              <span className="rounded-md bg-white/10 px-2 py-0.5 text-[10px] sm:text-[11px] font-bold text-navy-200">
                {waxing ? "ខ្នើត (Waxing)" : "រោច (Waning)"}
              </span>
              {todayHoliday && (
                <span className="anim-fade-in rounded-md bg-gold-400/25 px-2 py-0.5 text-[10px] sm:text-[11px] font-bold text-gold-300">
                  <i className="fa-solid fa-star mr-1" /> {todayHoliday}
                </span>
              )}
            </div>
          </div>
          <span className="anim-float flex h-11 w-11 sm:h-14 sm:w-14 shrink-0 items-center justify-center rounded-2xl border border-gold-400/30 bg-white/5 text-xl sm:text-2xl text-gold-400 shadow-xs">
            <i className={cn("fa-solid", waxing ? "fa-moon" : "fa-cloud-moon")} />
          </span>
        </div>
      </div>

      {/* ------- month grid ------- */}
      <div className="p-3.5 sm:p-4">
        <div className="mb-2.5 flex items-center justify-between px-1">
          <button
            onClick={() => nav(-1)}
            className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 text-navy-700 transition-all hover:bg-slate-50"
            aria-label="ខែមុន"
          >
            <i className="fa-solid fa-chevron-left text-xs" />
          </button>
          <p className="text-xs sm:text-sm font-bold text-navy-900">
            ខែ {KH_MONTHS[m]} <span className="font-num text-gold-600">{toKhmerNum(y)}</span>
          </p>
          <button
            onClick={() => nav(1)}
            className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 text-navy-700 transition-all hover:bg-slate-50"
            aria-label="ខែបន្ទាប់"
          >
            <i className="fa-solid fa-chevron-right text-xs" />
          </button>
        </div>

        <div className="grid grid-cols-7 gap-1">
          {WEEK_HEAD.map((w, i) => (
            <p key={w.full} className={cn("py-1 text-center text-[10px] sm:text-[11px] font-bold", i === 0 ? "text-red-500" : "text-slate-400")}>
              <span className="sm:hidden">{w.short}</span>
              <span className="hidden sm:inline">{w.full}</span>
            </p>
          ))}
          {cells.map((c, idx) => {
            if (!c) return <div key={`e${idx}`} className="min-h-[44px] sm:min-h-[48px]" />;
            const isToday = c.iso === tISO;
            const holName = holidays.get(c.iso);
            const isSun = c.kh.dayOfWeek === 0;
            const lunar = `${toKhmerNum(c.kh.day)}${c.kh.moonPhase === MoonPhase.Waxing ? "ក" : "រ"}`;
            return (
              <div
                key={c.iso}
                title={`${c.d} ${KH_MONTHS[m]} — ${toKhmerNum(c.kh.day)} ${c.kh.moonPhaseName} ខែ${c.kh.monthName}${holName ? " • " + holName : ""}`}
                className={cn(
                  "anim-fade-in group flex min-h-[44px] sm:min-h-[48px] cursor-default flex-col items-center justify-center rounded-lg border py-0.5 sm:py-1 transition-all",
                  isToday
                    ? "border-navy-800 bg-navy-900 shadow-sm"
                    : holName
                      ? "border-gold-300 bg-gold-50"
                      : "border-transparent bg-slate-50/80 hover:bg-slate-100"
                )}
                style={{ animationDelay: `${Math.min(idx * 12, 300)}ms` }}
              >
                <span
                  className={cn(
                    "font-num text-xs sm:text-[13px] font-bold leading-tight",
                    isToday ? "text-gold-400" : isSun ? "text-red-500" : holName ? "text-gold-700" : "text-navy-800"
                  )}
                >
                  {c.d}
                </span>
                <span className={cn("text-[8.5px] sm:text-[9px] font-semibold leading-tight", isToday ? "text-white/85" : "text-slate-400 group-hover:text-navy-500")}>
                  {lunar}
                </span>
              </div>
            );
          })}
        </div>

        <div className="mt-2.5 flex flex-wrap items-center gap-x-3 gap-y-1 px-1 text-[9.5px] sm:text-[10px] font-semibold text-slate-400">
          <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded bg-navy-900" /> ថ្ងៃនេះ</span>
          <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded border border-gold-400 bg-gold-100" /> ថ្ងៃបុណ្យ</span>
          <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded bg-red-400/70" /> អាទិត្យ</span>
        </div>
      </div>
    </Card>
  );
}
