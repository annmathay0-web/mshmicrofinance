import { useMemo, useRef, useState } from "react";
import { useApp, downloadBackup, backupJSON, canShareFiles, shareBackup, markBackupDone } from "../lib/state";
import { copyText, fmtKHFull, KH_DAYS, parseISO } from "../lib/data";
import { isISODate, isValidSheetUrl, khmerToGlobalDigits, sanitizeText } from "../lib/security";
import { Card, CardHead } from "../components/ui";
import { cn } from "../utils/cn";
import { builtinHolidaysOfYear, fmtLunarShort } from "../lib/khmerDate";

const APPS_SCRIPT = `// MSH Microfinance - Google Sheets sync endpoint.
// Paste into Extensions -> Apps Script, then Deploy -> Web app (access: Anyone).
var HEADERS = ["កូដកម្ចី", "ឈ្មោះអតិថិជន", "លេខទូរស័ព្ទ", "ចំនួនប្រាក់", "កាលបរិច្ឆេទ", "ស្ថានភាព"];

function getSheet_() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sh = ss.getSheetByName("MSH Sync");
  if (!sh) {
    sh = ss.insertSheet("MSH Sync");
    sh.appendRow(HEADERS);
    sh.getRange(1, 1, 1, HEADERS.length)
      .setFontWeight("bold").setBackground("#0B192C").setFontColor("#D4AF37");
    sh.setFrozenRows(1);
    sh.setColumnWidths(1, HEADERS.length, 150);
  }
  return sh;
}

function doPost(e) {
  var lock = LockService.getScriptLock();
  lock.waitLock(15000);
  try {
    var body = JSON.parse(e.postData.contents);
    var sh = getSheet_();
    var count = 0;
    if (body.action === "appendRows" && body.rows) {
      body.rows.forEach(function (r) {
        sh.appendRow(HEADERS.map(function (h) { return r[h] !== undefined ? r[h] : ""; }));
        count++;
      });
    } else if (body.loans) {
      sh.clearContents();
      sh.appendRow(HEADERS);
      (body.payments || []).forEach(function (p) {
        var loan = (body.loans || []).filter(function (l) { return l.id === p.loanId; })[0] || {};
        sh.appendRow([loan.code || "", loan.customer || "", loan.phone || "", p.amount, p.date, "ទូទាត់រួច"]);
        count++;
      });
    }
    return ContentService
      .createTextOutput(JSON.stringify({ ok: true, appended: count }))
      .setMimeType(ContentService.MimeType.JSON);
  } catch (err) {
    return ContentService
      .createTextOutput(JSON.stringify({ ok: false, error: String(err) }))
      .setMimeType(ContentService.MimeType.JSON);
  } finally {
    lock.releaseLock();
  }
}

function doGet() {
  return ContentService.createTextOutput("MSH Microfinance sync endpoint is running!");
}`;

export default function Settings() {
  const { db, updateSettings, requestImport, toast, syncNow, flushQueue, queue, syncing } = useApp();
  const s = db.settings;
  const [url, setUrl] = useState(s.sheetUrl);
  const [hDate, setHDate] = useState("");
  const [hName, setHName] = useState("");
  const [copied, setCopied] = useState(false);
  const [showPaste, setShowPaste] = useState(false);
  const [pasteText, setPasteText] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  const shareOk = useMemo(() => canShareFiles(), []);

  const onDownload = () => {
    const ok = downloadBackup(db);
    if (ok) markBackupDone();
    toast(ok ? "បានទាញយកឯកសារ Backup ជាទម្រង់ JSON" : "មិនអាចបង្កើតឯកសារ Backup បានទេ", ok ? "success" : "error");
  };

  const onShare = async () => {
    const r = await shareBackup(db);
    if (r === "shared") toast("បានចែករំលែកឯកសារ Backup");
    else if (r === "cancelled") toast("បានបោះបង់", "info");
    else toast("ឧបករណ៍នេះមិនគាំទ្រការចែករំលែកឯកសារទេ", "info");
  };

  const onCopy = async () => {
    const ok = await copyText(backupJSON(db));
    if (ok) {
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2200);
      toast("បានចម្លងទិន្នន័យ JSON ទៅក្ដារតម្បៀតខ្ទាស់");
    } else {
      toast("មិនអាចចម្លងបានទេ", "error");
    }
  };

  const onRestorePaste = () => {
    if (!pasteText.trim()) {
      toast("សូមបញ្ចូលទិន្នន័យ JSON ជាមុនសិន", "error");
      return;
    }
    if (requestImport(pasteText, "clipboard paste")) {
      setShowPaste(false);
      setPasteText("");
    }
  };

  const toggleDay = (i: number) => {
    const next = [...s.workingDays];
    if (next[i] && next.filter(Boolean).length === 1) {
      toast("ត្រូវតែមានយ៉ាងហោចណាស់ថ្ងៃធ្វើការ ១ ថ្ងៃក្នុងសប្តាហ៍", "error");
      return;
    }
    next[i] = !next[i];
    updateSettings({ workingDays: next });
    toast("បានធ្វើបច្ចុប្បន្នភាពថ្ងៃធ្វើការ", "info");
  };

  const addHoliday = () => {
    const name = sanitizeText(hName, 60);
    if (!isISODate(hDate) || !name) {
      toast("សូមបំពេញកាលបរិច្ឆេទ និងឈ្មោះថ្ងៃឈប់សម្រាក", "error");
      return;
    }
    if (s.holidays.some((h) => h.date === hDate)) {
      toast("កាលបរិច្ឆេទនេះមានរួចហើយ", "error");
      return;
    }
    updateSettings({
      holidays: [...s.holidays, { date: hDate, name }].sort((a, b) => a.date.localeCompare(b.date)),
    });
    setHDate("");
    setHName("");
    toast("បានបន្ថែមថ្ងៃឈប់សម្រាក");
  };

  const jsonSize = useMemo(() => (JSON.stringify(db).length / 1024).toFixed(1), [db]);
  const thisYear = new Date().getFullYear();
  const [holidayYear, setHolidayYear] = useState(thisYear);

  const holidayRows = useMemo(() => {
    const ignored = s.ignoredHolidays ?? [];
    const customForYear = s.holidays.filter((h) => Number(h.date.slice(0, 4)) === holidayYear);
    const customDates = new Set(customForYear.map((h) => h.date));
    const auto = builtinHolidaysOfYear(holidayYear)
      .filter((h) => !customDates.has(h.date))
      .map((h) => ({
        ...h,
        kind: "auto" as const,
        ignored: ignored.includes(h.date),
      }));
    const custom = customForYear.map((h) => ({ ...h, kind: "custom" as const, ignored: false }));
    return [...auto, ...custom].sort((a, b) => a.date.localeCompare(b.date));
  }, [holidayYear, s.holidays, s.ignoredHolidays]);

  const removeHoliday = (row: (typeof holidayRows)[number]) => {
    if (row.kind === "custom") {
      updateSettings({ holidays: s.holidays.filter((x) => x.date !== row.date) });
      toast(`បានលុបថ្ងៃឈប់សម្រាក ${row.name}`, "info");
    } else {
      updateSettings({ ignoredHolidays: [...(s.ignoredHolidays ?? []), row.date] });
      toast(`បានកំណត់ឱ្យធ្វើការនៅថ្ងៃ ${row.name}`, "info");
    }
  };

  const restoreHoliday = (row: (typeof holidayRows)[number]) => {
    updateSettings({ ignoredHolidays: (s.ignoredHolidays ?? []).filter((x) => x !== row.date) });
    toast(`បានកំណត់ថ្ងៃឈប់សម្រាក ${row.name} ឡើងវិញ`);
  };

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-12 gap-5">
        {/* Working Days */}
        <Card className="anim-fade-up col-span-12 lg:col-span-5 overflow-hidden">
          <CardHead icon="fa-calendar-week" title="ថ្ងៃធ្វើការក្នុងសប្តាហ៍" en="Working Days Configuration" />
          <div className="p-5 sm:p-6">
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-2 xl:grid-cols-4">
              {KH_DAYS.map((d, i) => (
                <button
                  key={d}
                  onClick={() => toggleDay(i)}
                  className={cn(
                    "tap-press flex items-center justify-between rounded-xl border p-3 text-xs font-bold transition-all",
                    s.workingDays[i]
                      ? "border-emerald-300 bg-emerald-50 text-emerald-800 shadow-2xs"
                      : "border-slate-200 bg-slate-50 text-slate-400 line-through"
                  )}
                >
                  <span>{d}</span>
                  <i
                    className={cn(
                      "fa-solid text-xs",
                      s.workingDays[i] ? "fa-circle-check text-emerald-600" : "fa-circle-minus text-slate-300"
                    )}
                  />
                </button>
              ))}
            </div>
            <p className="mt-4 flex items-start gap-2 rounded-2xl bg-slate-50 p-3.5 text-xs text-slate-600 border border-slate-100">
              <i className="fa-solid fa-circle-info text-navy-600 mt-0.5" />
              <span>កាលវិភាគកម្ចីបង់រាល់ថ្ងៃ នឹងរំលងថ្ងៃដែលមិនបានធីកដោយស្វ័យប្រវត្តិ</span>
            </p>
          </div>
        </Card>

        {/* Holidays */}
        <Card className="anim-fade-up d1 col-span-12 lg:col-span-7 overflow-hidden">
          <CardHead
            icon="fa-umbrella-beach"
            title="ថ្ងៃឈប់សម្រាកបុណ្យជាតិ & ចន្ទគតិ (២០២០-២០៤៥+)"
            en="National & Lunar Holidays (2020 2045+)"
            right={
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => setHolidayYear((y) => Math.max(2020, y - 1))}
                  title="ឆ្នាំមុន"
                  className="tap-press flex h-11 w-11 items-center justify-center rounded-xl border border-slate-200 bg-white text-navy-800 hover:bg-slate-50"
                >
                  <i className="fa-solid fa-chevron-left text-xs" />
                </button>
                <span className="font-num rounded-xl bg-navy-900 px-3 py-2 text-xs font-bold text-gold-400">
                  {holidayYear}
                </span>
                <button
                  type="button"
                  onClick={() => setHolidayYear((y) => Math.min(2050, y + 1))}
                  title="ឆ្នាំបន្ទាប់"
                  className="tap-press flex h-11 w-11 items-center justify-center rounded-xl border border-slate-200 bg-white text-navy-800 hover:bg-slate-50"
                >
                  <i className="fa-solid fa-chevron-right text-xs" />
                </button>
                <span className="font-num hidden sm:inline-flex rounded-full bg-gold-50 border border-gold-200 px-2.5 py-1 text-xs font-bold text-gold-800 whitespace-nowrap">
                  {holidayRows.length} ថ្ងៃ
                </span>
              </div>
            }
          />
          <div className="p-5 sm:p-6">
            <div className="flex flex-wrap items-center gap-2">
              <input
                type="date"
                value={hDate}
                onChange={(e) => setHDate(e.target.value)}
                className="font-num h-11 rounded-xl border border-slate-200 bg-slate-50 px-3 text-xs font-bold text-navy-900 outline-none focus:border-navy-500 focus:bg-white"
              />
              <input
                value={hName}
                onChange={(e) => setHName(khmerToGlobalDigits(e.target.value))}
                placeholder="ឈ្មោះថ្ងៃឈប់សម្រាកបន្ថែម..."
                className="min-w-[160px] flex-1 h-11 rounded-xl border border-slate-200 bg-slate-50 px-3 text-xs font-semibold outline-none placeholder:text-slate-400 focus:border-navy-500 focus:bg-white"
              />
              <button
                onClick={addHoliday}
                className="tap-press h-11 rounded-xl bg-navy-900 hover:bg-navy-800 px-4 text-xs font-bold text-white shadow-xs whitespace-nowrap"
              >
                <i className="fa-solid fa-plus mr-1" /> បន្ថែម
              </button>
            </div>

            <ul className="mt-4 max-h-72 space-y-1.5 overflow-y-auto pr-1">
              {holidayRows.map((h) => {
                const dow = parseISO(h.date).getDay();
                const isWeekend = !s.workingDays[dow];
                return (
                  <li
                    key={h.date + h.kind}
                    className={cn(
                      "flex items-center gap-3 rounded-xl border p-3 transition-colors text-xs",
                      h.ignored
                        ? "border-slate-200 bg-slate-50 text-slate-400"
                        : "border-slate-100 bg-white hover:bg-slate-50"
                    )}
                  >
                    <i
                      className={cn(
                        "fa-solid text-sm",
                        h.ignored
                          ? "fa-calendar-xmark text-slate-300"
                          : h.kind === "auto"
                            ? "fa-moon text-gold-600"
                            : "fa-calendar-plus text-navy-600"
                      )}
                    />
                    <div className="min-w-0 flex-1">
                      <p className={cn("font-bold truncate", h.ignored ? "line-through text-slate-400" : "text-navy-900")}>
                        {h.name}
                      </p>
                      <p className="font-num text-[11px] text-slate-400 flex flex-wrap items-center gap-1.5 mt-0.5">
                        <span>{fmtKHFull(h.date)}</span>
                        <span>•</span>
                        <span className="text-gold-700 font-medium">{fmtLunarShort(h.date)}</span>
                        {isWeekend && (
                          <span className="rounded bg-amber-50 border border-amber-200 px-1.5 py-0.2 text-[9.5px] font-bold text-amber-700">
                            ចំថ្ងៃចុងសប្តាហ៍
                          </span>
                        )}
                      </p>
                    </div>
                    <span
                      className={cn(
                        "rounded-full px-2 py-0.5 text-[10px] font-bold border shrink-0",
                        h.ignored
                          ? "bg-slate-100 text-slate-500 border-slate-200"
                          : h.kind === "auto"
                            ? "bg-gold-50 text-gold-800 border-gold-200"
                            : "bg-navy-50 text-navy-800 border-navy-100"
                      )}
                    >
                      {h.ignored ? "រំលង" : h.kind === "auto" ? "ស្វ័យប្រវត្តិ" : "បន្ថែម"}
                    </span>
                    {h.ignored ? (
                      <button
                        onClick={() => restoreHoliday(h)}
                        title="កំណត់ជាថ្ងៃឈប់សម្រាកវិញ"
                        className="tap-press flex h-7 w-7 items-center justify-center rounded-lg border border-emerald-300 bg-emerald-50 text-emerald-700 shrink-0"
                      >
                        <i className="fa-solid fa-rotate-left text-xs" />
                      </button>
                    ) : (
                      <button
                        onClick={() => removeHoliday(h)}
                        title="លុប ឬកំណត់ឱ្យធ្វើការ"
                        className="tap-press flex h-7 w-7 items-center justify-center rounded-lg border border-slate-200 hover:border-rose-300 hover:bg-rose-50 text-slate-400 hover:text-rose-600 shrink-0"
                      >
                        <i className="fa-solid fa-xmark text-xs" />
                      </button>
                    )}
                  </li>
                );
              })}
            </ul>
          </div>
        </Card>

        {/* Backup & Restore */}
        <Card className="anim-fade-up d2 col-span-12 lg:col-span-5 overflow-hidden">
          <CardHead icon="fa-database" title="Backup & Restore ទិន្នន័យ" en="JSON Database Storage" />
          <div className="p-5 sm:p-6 space-y-4">
            <div className="grid grid-cols-3 gap-2 text-center">
              {[
                [String(db.loans.length), "កម្ចីសរុប"],
                [String(db.payments.length), "ការបង់ប្រាក់"],
                [`${jsonSize} KB`, "ទំហំទិន្នន័យ"],
              ].map(([v, l]) => (
                <div key={l} className="rounded-xl bg-slate-50 border border-slate-100 p-2.5">
                  <p className="font-num text-base font-black text-navy-950">{v}</p>
                  <p className="text-[10px] font-semibold text-slate-400 mt-0.5">{l}</p>
                </div>
              ))}
            </div>

            <div className="space-y-2">
              <button
                onClick={onDownload}
                className="tap-press w-full flex items-center justify-center gap-2 rounded-2xl bg-navy-900 hover:bg-navy-800 text-white py-3 text-xs font-bold shadow-md shadow-navy-950/15"
              >
                <i className="fa-solid fa-file-arrow-down text-gold-400" />
                <span>ទាញយក Backup (JSON File)</span>
              </button>

              {shareOk && (
                <button
                  onClick={() => void onShare()}
                  className="tap-press w-full flex items-center justify-center gap-2 rounded-2xl bg-emerald-500 hover:bg-emerald-600 text-white py-3 text-xs font-bold shadow-md shadow-emerald-500/20"
                >
                  <i className="fa-solid fa-share-nodes" />
                  <span>ចែករំលែក Backup (Share)</span>
                </button>
              )}

              <button
                onClick={() => void onCopy()}
                className={cn(
                  "tap-press w-full flex items-center justify-center gap-2 rounded-2xl border-2 border-dashed py-2.5 text-xs font-bold transition-all",
                  copied
                    ? "border-emerald-400 bg-emerald-50 text-emerald-700"
                    : "border-gold-300 bg-gold-50/70 text-gold-800 hover:bg-gold-50"
                )}
              >
                <i className={cn("fa-solid", copied ? "fa-circle-check" : "fa-copy")} />
                <span>{copied ? "បានចម្លងរួចរាល់!" : "ចម្លងទិន្នន័យ JSON (Copy)"}</span>
              </button>
            </div>

            <div className="pt-2 border-t border-slate-100 flex gap-2">
              <button
                onClick={() => fileRef.current?.click()}
                className="tap-press flex-1 flex items-center justify-center gap-1.5 rounded-xl border border-slate-200 bg-white py-2.5 text-xs font-bold text-navy-800 hover:bg-slate-50"
              >
                <i className="fa-solid fa-file-arrow-up text-slate-500" />
                <span>ជ្រើសរើសឯកសារ</span>
              </button>
              <button
                onClick={() => setShowPaste((v) => !v)}
                className="tap-press flex-1 flex items-center justify-center gap-1.5 rounded-xl border border-slate-200 bg-white py-2.5 text-xs font-bold text-navy-800 hover:bg-slate-50"
              >
                <i className="fa-solid fa-paste text-gold-600" />
                <span>បិទភ្ជាប់ JSON</span>
              </button>
            </div>

            {showPaste && (
              <div className="anim-scale-in pt-2">
                <textarea
                  value={pasteText}
                  onChange={(e) => setPasteText(khmerToGlobalDigits(e.target.value))}
                  rows={3}
                  placeholder='បិទភ្ជាប់កូដ JSON នៅទីនេះ...'
                  className="font-num w-full rounded-xl border border-slate-200 bg-slate-50 p-2.5 text-xs outline-none focus:border-navy-600 focus:bg-white resize-none"
                />
                <button
                  onClick={onRestorePaste}
                  className="tap-press mt-2 w-full rounded-xl bg-gold-gradient py-2 text-xs font-bold text-navy-950 shadow-xs"
                >
                  <i className="fa-solid fa-rotate-left mr-1" /> ស្តារទិន្នន័យ
                </button>
              </div>
            )}

            <input
              ref={fileRef}
              type="file"
              accept=".json,application/json"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                e.target.value = "";
                if (!f) return;
                if (f.size > 25_000_000) {
                  toast("ឯកសារធំពេក (លើសពី 25MB)", "error");
                  return;
                }
                f.text()
                  .then((t) => requestImport(t, f.name))
                  .catch(() => toast("មិនអាចអានឯកសារបានទេ", "error"));
              }}
            />
          </div>
        </Card>

        {/* Google Sheets Sync */}
        <Card className="anim-fade-up d3 col-span-12 lg:col-span-7 overflow-hidden">
          <CardHead
            icon="fa-cloud-arrow-up"
            title="ការភ្ជាប់ Google Sheets Sync"
            en="Real-Time Cloud Synchronization"
            right={
              s.lastSync ? (
                <span className="font-num rounded-full bg-emerald-50 border border-emerald-200 px-3 py-0.5 text-xs font-bold text-emerald-700">
                  Sync: {new Date(s.lastSync).toLocaleString("en-GB")}
                </span>
              ) : (
                <span className="rounded-full bg-slate-100 px-3 py-0.5 text-xs font-semibold text-slate-500">
                  មិនទាន់បាន Sync
                </span>
              )
            }
          />
          <div className="p-5 sm:p-6 space-y-4">
            <div>
              <label className="block text-xs font-bold text-navy-900 mb-1.5">
                Google Apps Script Web App URL
              </label>
              <div className="flex flex-wrap gap-2">
                <input
                  value={url}
                  onChange={(e) => setUrl(khmerToGlobalDigits(e.target.value))}
                  placeholder="https://script.google.com/macros/s/AKfycb.../exec"
                  className="font-num min-w-0 flex-1 rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-xs font-semibold outline-none focus:border-navy-600 focus:bg-white"
                />
                <button
                  onClick={() => {
                    const u = url.trim();
                    if (!isValidSheetUrl(u)) {
                      toast("URL ត្រូវតែចាប់ផ្តើមដោយ https://", "error");
                      return;
                    }
                    updateSettings({ sheetUrl: u });
                    toast("បានរក្សាទុក URL");
                  }}
                  className="tap-press rounded-xl bg-navy-900 hover:bg-navy-800 text-white px-4 py-2.5 text-xs font-bold shadow-xs"
                >
                  <i className="fa-solid fa-floppy-disk mr-1" /> រក្សាទុក
                </button>
                <button
                  onClick={() => {
                    const u = url.trim();
                    if (!isValidSheetUrl(u)) {
                      toast("URL មិនត្រឹមត្រូវ", "error");
                      return;
                    }
                    if (u !== s.sheetUrl) updateSettings({ sheetUrl: u });
                    void syncNow(u);
                  }}
                  className="tap-press flex items-center gap-1.5 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-white px-4 py-2.5 text-xs font-bold shadow-xs"
                >
                  <i className={cn("fa-solid", syncing ? "fa-circle-notch fa-spin" : "fa-rotate")} />
                  <span>Sync ឥឡូវ</span>
                </button>
              </div>
            </div>

            <div
              className={cn(
                "flex flex-wrap items-center justify-between gap-2 rounded-2xl border p-3.5 text-xs",
                queue.length > 0
                  ? "border-amber-300 bg-amber-50 text-amber-900"
                  : "border-emerald-200 bg-emerald-50 text-emerald-900"
              )}
            >
              <div className="flex items-center gap-2">
                <i className={cn("fa-solid", queue.length > 0 ? "fa-clock text-amber-600" : "fa-circle-check text-emerald-600")} />
                <span className="font-semibold">
                  {queue.length > 0
                    ? `មាន ${queue.length} កំណត់ត្រារង់ចាំ Sync ទៅ Google Sheets`
                    : "Real-time sync ដំណើរការធម្មតា"}
                </span>
              </div>
              {queue.length > 0 && (
                <button
                  onClick={() => void flushQueue()}
                  className="tap-press rounded-xl bg-amber-400 text-navy-950 px-3 py-1 font-bold shadow-2xs"
                >
                  {syncing ? "កំពុង Sync..." : "Sync ឥឡូវនេះ"}
                </button>
              )}
            </div>

            <details className="rounded-2xl border border-slate-200 bg-white overflow-hidden">
              <summary className="flex cursor-pointer items-center justify-between p-3.5 text-xs font-bold text-navy-900 hover:bg-slate-50 transition-colors">
                <span className="flex items-center gap-2">
                  <i className="fa-solid fa-code text-emerald-600" />
                  កូដ Google Apps Script សម្រាប់ Google Sheets
                </span>
                <i className="fa-solid fa-chevron-down text-[10px] text-slate-400" />
              </summary>
              <div className="p-3.5 border-t border-slate-100 bg-slate-50">
                <pre className="font-num max-h-60 overflow-auto rounded-xl bg-navy-950 p-3.5 text-[11px] leading-5 text-emerald-300">
                  {APPS_SCRIPT}
                </pre>
                <button
                  onClick={() =>
                    void copyText(APPS_SCRIPT).then((ok) =>
                      toast(ok ? "បានចម្លង Apps Script" : "មិនអាចចម្លងបានទេ", ok ? "success" : "error")
                    )
                  }
                  className="tap-press mt-2.5 rounded-xl bg-navy-900 text-white px-4 py-2 text-xs font-bold flex items-center gap-1.5"
                >
                  <i className="fa-solid fa-copy text-gold-400" />
                  <span>ចម្លងកូដ</span>
                </button>
              </div>
            </details>
          </div>
        </Card>
      </div>
    </div>
  );
}
