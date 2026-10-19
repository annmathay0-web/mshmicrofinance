import { useEffect, useRef, useState, type ReactNode } from "react";
import { cn } from "../utils/cn";
import { useApp, downloadBackup, backupJSON, markBackupDone, type View } from "../lib/state";
import { copyText, fmtKHFull, todayISO } from "../lib/data";
import { getSession } from "../lib/auth";
import { MSHLogo } from "./ui";
import { PWAInstallButton } from "./PWAInstall";

const NAV: { v: View["name"]; icon: string; label: string; en: string }[] = [
  { v: "dashboard", icon: "fa-gauge-high", label: "ផ្ទាំងគ្រប់គ្រង", en: "Dashboard" },
  { v: "collection", icon: "fa-money-bill-trend-up", label: "ប្រមូលប្រាក់", en: "Collection" },
  { v: "loans", icon: "fa-file-invoice-dollar", label: "បញ្ជីកម្ចីទាំងអស់", en: "Loans" },
  { v: "settings", icon: "fa-gear", label: "ការកំណត់ & Sync", en: "Settings" },
];

const MOBILE_NAV: { v: View["name"]; icon: string; label: string }[] = [
  { v: "dashboard", icon: "fa-house", label: "ទំព័រដើម" },
  { v: "collection", icon: "fa-wallet", label: "ប្រមូលប្រាក់" },
  { v: "loans", icon: "fa-receipt", label: "កម្ចី" },
  { v: "settings", icon: "fa-sliders", label: "ការកំណត់" },
];

const TITLES: Record<View["name"], [string, string]> = {
  dashboard: ["ផ្ទាំងគ្រប់គ្រង", "Dashboard Overview"],
  collection: ["ការប្រមូលប្រាក់", "Today's Collection"],
  loans: ["បញ្ជីកម្ចីទាំងអស់", "All Loans"],
  new: ["បង្កើតកម្ចីថ្មី", "Create New Loan"],
  loan: ["ព័ត៌មានលម្អិតកម្ចី", "Loan Detail"],
  settings: ["ការកំណត់ & Sync", "Settings & Sync"],
};

export default function Shell({
  children,
  onLogout,
}: {
  children: ReactNode;
  onLogout: () => void;
}) {
  const { db, view, go, requestImport, toast, syncNow, flushQueue, queue, syncing } = useApp();
  const [drawer, setDrawer] = useState(false);
  const [menu, setMenu] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const [online, setOnline] = useState(() => (typeof navigator === "undefined" ? true : navigator.onLine));

  useEffect(() => {
    const up = () => setOnline(true);
    const down = () => setOnline(false);
    window.addEventListener("online", up);
    window.addEventListener("offline", down);
    return () => {
      window.removeEventListener("online", up);
      window.removeEventListener("offline", down);
    };
  }, []);

  const isActive = (v: View["name"]) =>
    view.name === v || (v === "loans" && (view.name === "loan" || view.name === "new"));

  const mobActive = (v: View["name"]) =>
    v === "loans" ? view.name === "loans" || view.name === "loan" : view.name === v;

  const [title] = TITLES[view.name];
  const who = getSession()?.user;
  const whoName = who?.displayName ?? "Admin";
  const whoLetter = whoName.trim().charAt(0) || "A";

  const onRestoreFile = async (f: File | undefined) => {
    if (!f) return;
    if (f.size > 25_000_000) {
      toast("ឯកសារធំពេក (លើសពី 25MB)", "error");
      return;
    }
    try {
      requestImport(await f.text(), f.name);
    } catch {
      toast("មិនអាចអានឯកសារបានទេ", "error");
    }
  };

  const nav = (v: View) => {
    go(v);
    setDrawer(false);
  };

  return (
    <div className="min-h-screen bg-paper text-navy-900">
      {/* ================= desktop sidebar ================= */}
      {drawer && (
        <div
          className="anim-fade-in fixed inset-0 z-40 bg-navy-950/65 backdrop-blur-xs lg:hidden"
          onClick={() => setDrawer(false)}
        />
      )}

      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-50 flex w-[270px] flex-col bg-navy-900 border-r border-navy-800 transition-transform duration-300 ease-in-out lg:translate-x-0 shadow-2xl lg:shadow-none",
          drawer ? "translate-x-0" : "-translate-x-full"
        )}
      >
        <div className="bg-grid-dark absolute inset-0 pointer-events-none" />

        {/* Brand Header */}
        <div className="pt-safe relative flex items-center gap-3 px-6 pb-5 pt-6 border-b border-navy-800/80">
          <MSHLogo className="h-11 w-11 shadow-md shadow-gold-500/20" />
          <div className="min-w-0">
            <p className="font-num text-[17px] font-bold tracking-tight text-white flex items-center gap-1.5">
              MSH <span className="text-gold-400 font-semibold">Microfinance</span>
            </p>
            <p className="text-[10px] font-medium text-navy-300 truncate">ប្រព័ន្ធគ្រប់គ្រងឥណទាន</p>
          </div>
          <button
            className="ml-auto text-navy-300 hover:text-white lg:hidden h-8 w-8 flex items-center justify-center rounded-lg hover:bg-white/10"
            onClick={() => setDrawer(false)}
          >
            <i className="fa-solid fa-xmark text-lg" />
          </button>
        </div>

        {/* Quick CTA */}
        <div className="relative px-4 pt-5">
          <button
            onClick={() => nav({ name: "new" })}
            className={cn(
              "tap-press group flex w-full items-center justify-center gap-2.5 rounded-2xl py-3.5 font-bold shadow-lg transition-all",
              view.name === "new"
                ? "bg-white text-navy-900 shadow-white/20"
                : "bg-gold-gradient text-navy-950 shadow-gold-500/25 hover:shadow-gold-500/35"
            )}
          >
            <i className="fa-solid fa-circle-plus text-base" />
            <span className="text-sm">បង្កើតកម្ចីថ្មី</span>
          </button>
        </div>

        {/* Nav Links */}
        <nav className="relative mt-6 flex-1 space-y-1.5 overflow-y-auto px-4">
          <p className="px-3 pb-2 font-num text-[10px] font-bold uppercase tracking-[0.2em] text-navy-400">
            Menu Navigation
          </p>
          {NAV.map((n) => (
            <button
              key={n.v}
              onClick={() => nav({ name: n.v } as View)}
              className={cn(
                "group relative flex w-full items-center gap-3.5 rounded-2xl px-4 py-3 text-left text-sm font-semibold transition-all tap-press",
                isActive(n.v)
                  ? "bg-white/10 text-white shadow-inner"
                  : "text-navy-200 hover:bg-white/5 hover:text-white"
              )}
            >
              {isActive(n.v) && (
                <span className="absolute left-0 top-1/2 h-6 w-1.5 -translate-y-1/2 rounded-r-full bg-gold-400 shadow-sm shadow-gold-400" />
              )}
              <i
                className={cn(
                  "fa-solid w-5 text-center text-base",
                  n.icon,
                  isActive(n.v) ? "text-gold-400" : "text-navy-400 group-hover:text-navy-200"
                )}
              />
              <span className="flex-1">{n.label}</span>
              <span className="font-num text-[9px] font-medium tracking-wider text-navy-500 uppercase">
                {n.en}
              </span>
            </button>
          ))}

          {/* Google Sheets Sync Card */}
          <div className="mx-1 my-5 rounded-2xl border border-navy-700/60 bg-navy-850/60 p-4">
            <div className="flex items-center justify-between">
              <p className="flex items-center gap-2 text-xs font-bold text-white">
                <i className="fa-solid fa-cloud-arrow-up text-mint-400" /> Google Sheets Sync
              </p>
              {queue.length > 0 && (
                <span className="font-num text-[10px] font-bold bg-gold-500/20 text-gold-300 px-2 py-0.5 rounded-full border border-gold-400/30">
                  {queue.length}
                </span>
              )}
            </div>
            <p className="mt-1.5 text-[11px] leading-4 text-navy-300">
              {db.settings.sheetUrl ? "ភ្ជាប់ជាមួយ Web App រួចរាល់" : "សូមកំណត់ URL ក្នុង Settings"}
            </p>
            {db.settings.lastSync && (
              <p className="font-num mt-1 text-[10px] text-navy-400">
                Sync ចុងក្រោយ:{" "}
                {new Date(db.settings.lastSync).toLocaleString("en-GB", {
                  day: "2-digit",
                  month: "2-digit",
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </p>
            )}
            <button
              onClick={() => {
                void (queue.length > 0 ? flushQueue() : syncNow());
              }}
              className="mt-3 w-full rounded-xl border border-white/10 bg-white/10 hover:bg-white/15 py-2 text-xs font-bold text-white transition-all tap-press flex items-center justify-center gap-1.5"
            >
              {syncing ? (
                <i className="fa-solid fa-circle-notch fa-spin text-mint-400" />
              ) : (
                <i className="fa-solid fa-rotate text-mint-300" />
              )}
              <span>Sync ឥឡូវនេះ</span>
            </button>
          </div>

          <PWAInstallButton variant="sidebar" />
        </nav>

        {/* User Card */}
        <div className="relative border-t border-navy-800 p-4">
          <div className="flex items-center gap-3 rounded-2xl bg-white/5 border border-white/5 p-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-gold-300 to-gold-600 text-sm font-bold text-navy-950 shadow-xs">
              {whoLetter}
            </span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-bold text-white">{whoName}</p>
              <p className="text-[11px] text-gold-400 font-medium">{who?.role ?? "Admin"}</p>
            </div>
            <button
              onClick={onLogout}
              title="ចាកចេញ (Logout)"
              className="text-navy-300 hover:text-rose-400 p-1.5 rounded-lg hover:bg-white/5 transition-colors"
            >
              <i className="fa-solid fa-arrow-right-from-bracket" />
            </button>
          </div>
        </div>
      </aside>

      {/* ================= main viewport ================= */}
      <div className="flex min-h-screen flex-col pb-36 lg:pb-0 lg:pl-[270px]">
        {/* Mobile & Desktop App Bar */}
        <header className="pt-safe-header sticky top-0 z-30 border-b border-slate-200/80 bg-white/95 backdrop-blur-md">
          <div className="flex items-center justify-between gap-2.5 px-3.5 py-2.5 sm:px-6 sm:py-3.5 lg:px-8">
            {/* Left: Menu & Brand Lockup */}
            <div className="flex items-center gap-2.5 min-w-0 flex-1">
              <button
                className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-slate-200 bg-white text-navy-800 shadow-xs tap-press lg:hidden"
                onClick={() => setDrawer(true)}
                aria-label="បើកម៉ឺនុយ"
              >
                <i className="fa-solid fa-bars text-base" />
              </button>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5">
                  <span className="h-1.5 w-1.5 rounded-full bg-gold-500 anim-pulse-glow shrink-0" />
                  <p className="font-num text-[10px] font-bold uppercase tracking-[0.15em] text-gold-600 truncate">
                    MSH Microfinance
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 mt-0.5">
                  <h1 className="truncate text-sm sm:text-lg lg:text-xl font-bold text-navy-950 leading-tight">
                    {title}
                  </h1>
                  <span className="inline-flex xl:hidden items-center gap-1 rounded-md bg-slate-100 px-1.5 py-0.5 text-[10px] font-semibold text-navy-700 shrink-0">
                    <i className="fa-regular fa-calendar text-[9px] text-gold-600" />
                    <span>{fmtKHFull(todayISO())}</span>
                  </span>
                </div>
              </div>
            </div>

            {/* Right: Actions & Profile */}
            <div className="flex items-center gap-2 sm:gap-3 shrink-0">
              <span className="hidden items-center gap-2 rounded-full border border-slate-200 bg-slate-50 px-3.5 py-1.5 text-xs font-semibold text-navy-700 xl:flex shadow-2xs">
                <i className="fa-regular fa-calendar text-gold-600" /> {fmtKHFull(todayISO())}
              </span>

              {/* Install PWA Button */}
              <PWAInstallButton variant="header" />

              {/* Sync Trigger */}
              <button
                onClick={() => {
                  void (queue.length > 0 ? flushQueue() : syncNow());
                }}
                title={queue.length > 0 ? `${queue.length} រង់ចាំ Sync` : "Sync ទៅ Google Sheets"}
                className="relative flex h-11 w-11 sm:w-auto sm:px-3.5 items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white text-xs font-bold text-navy-800 shadow-xs hover:border-mint-300 tap-press"
              >
                <i
                  className={cn(
                    "fa-solid text-sm",
                    syncing
                      ? "fa-circle-notch fa-spin text-mint-500"
                      : !online && queue.length > 0
                        ? "fa-cloud-arrow-up text-rose-500"
                        : queue.length > 0
                          ? "fa-cloud-arrow-up text-gold-500"
                          : "fa-cloud-arrow-up text-mint-600"
                  )}
                />
                <span className="hidden sm:inline">{syncing ? "Sync..." : "Sync"}</span>
                {queue.length > 0 && (
                  <span
                    className={cn(
                      "font-num absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full px-1 text-[9px] font-bold text-navy-950 shadow-xs",
                      online ? "bg-gold-400" : "bg-rose-400 text-white"
                    )}
                  >
                    {queue.length}
                  </span>
                )}
              </button>

              {/* Backup Menu Dropdown */}
              <div className="relative">
                <button
                  onClick={() => setMenu((m) => !m)}
                  className="flex h-11 w-11 sm:w-auto sm:px-3.5 items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white text-xs font-bold text-navy-800 shadow-xs hover:border-slate-300 tap-press"
                >
                  <i className="fa-solid fa-database text-slate-500 text-sm" />
                  <span className="hidden sm:inline">Backup</span>
                  <i className="fa-solid fa-chevron-down hidden text-[10px] text-slate-400 sm:inline" />
                </button>
                {menu && (
                  <>
                    <div className="fixed inset-0 z-40" onClick={() => setMenu(false)} />
                    <div className="anim-scale-in absolute right-0 z-50 mt-2 w-64 overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-xl shadow-navy-950/10">
                      <div className="border-b border-slate-100 px-4 py-3 bg-slate-50/70">
                        <p className="font-num text-[10px] font-bold uppercase tracking-[0.18em] text-slate-500">
                          Data & Backup
                        </p>
                        <p className="text-xs font-bold text-navy-900 mt-0.5">ការគ្រប់គ្រងទិន្នន័យ JSON</p>
                      </div>
                      <button
                        onClick={() => {
                          const ok = downloadBackup(db);
                          if (ok) markBackupDone();
                          setMenu(false);
                          toast(
                            ok ? "បានទាញយកឯកសារ Backup ជាទម្រង់ JSON" : "មិនអាចបង្កើតឯកសារ Backup",
                            ok ? "success" : "error"
                          );
                        }}
                        className="flex w-full items-center gap-3 px-4 py-3 text-xs font-bold text-navy-800 hover:bg-slate-50 transition-colors"
                      >
                        <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-navy-50 text-navy-700">
                          <i className="fa-solid fa-file-arrow-down" />
                        </span>
                        <span>ទាញយក Backup (Download)</span>
                      </button>
                      <button
                        onClick={() => {
                          void copyText(backupJSON(db)).then((ok) =>
                            toast(
                              ok ? "បានចម្លងកូដ JSON រួចរាល់" : "មិនអាចចម្លងបានទេ",
                              ok ? "success" : "error"
                            )
                          );
                          setMenu(false);
                        }}
                        className="flex w-full items-center gap-3 border-t border-slate-100 px-4 py-3 text-xs font-bold text-navy-800 hover:bg-slate-50 transition-colors"
                      >
                        <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-mint-50 text-mint-700">
                          <i className="fa-solid fa-copy" />
                        </span>
                        <span>ចម្លងទិន្នន័យ JSON (Copy)</span>
                      </button>
                      <button
                        onClick={() => {
                          fileRef.current?.click();
                          setMenu(false);
                        }}
                        className="flex w-full items-center gap-3 border-t border-slate-100 px-4 py-3 text-xs font-bold text-navy-800 hover:bg-slate-50 transition-colors"
                      >
                        <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-gold-50 text-gold-700">
                          <i className="fa-solid fa-file-arrow-up" />
                        </span>
                        <span>នាំចូលទិន្នន័យ (Restore)</span>
                      </button>
                    </div>
                  </>
                )}
              </div>

              {/* Hidden file input for restore */}
              <input
                ref={fileRef}
                type="file"
                accept=".json,application/json"
                className="hidden"
                onChange={(e) => {
                  void onRestoreFile(e.target.files?.[0]);
                  e.target.value = "";
                }}
              />

              {/* Profile Badge & Logout */}
              <div className="flex items-center gap-1.5 sm:gap-2 border-l border-slate-200 pl-2 sm:pl-3">
                <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br from-navy-800 to-navy-950 text-sm font-bold text-gold-400 border border-gold-400/30 shadow-xs">
                  {whoLetter}
                </span>
                <div className="hidden lg:block">
                  <p className="text-xs font-bold text-navy-900 leading-tight">{whoName}</p>
                  <p className="font-num text-[10px] text-gold-600 font-semibold">{who?.role ?? "Admin"}</p>
                </div>
                <button
                  onClick={onLogout}
                  title="ចាកចេញ (Logout)"
                  className="hidden sm:flex h-11 w-11 items-center justify-center rounded-xl border border-slate-200 bg-white text-navy-600 hover:border-rose-300 hover:bg-rose-50 hover:text-rose-600 tap-press"
                >
                  <i className="fa-solid fa-arrow-right-from-bracket text-xs" />
                </button>
              </div>
            </div>
          </div>
        </header>

        {/* Content Body */}
        <main className="flex-1 px-4 py-4 sm:px-6 sm:py-6 lg:px-8 max-w-[1340px] w-full mx-auto pb-16 sm:pb-8">
          {children}
        </main>

        <footer className="border-t border-slate-200/70 px-6 py-4 text-center text-xs text-slate-400 mb-6 lg:mb-0">
          MSH Microfinance • 2026 រក្សាសិទ្ធិគ្រប់យ៉ាង
        </footer>
      </div>

      {/* ================= Top-Tier Mobile Banking Bottom Bar ================= */}
      <nav className="anim-fade-up fixed inset-x-0 bottom-0 z-40 border-t border-slate-200/80 bg-white/95 backdrop-blur-lg shadow-[0_-10px_30px_rgba(11,25,44,0.08)] lg:hidden">
        <div className="pb-safe grid grid-cols-5 items-center px-2 pt-1.5 min-h-[64px]">
          {/* Tab 1: Dashboard */}
          <button
            onClick={() => go({ name: "dashboard" })}
            className={cn(
              "relative flex flex-col items-center justify-center min-h-[48px] gap-1 text-[10px] font-bold tap-press transition-colors",
              mobActive("dashboard") ? "text-navy-950 font-extrabold" : "text-slate-400 hover:text-slate-600"
            )}
          >
            <div className="relative">
              <i className={cn("fa-solid text-[19px]", MOBILE_NAV[0].icon, mobActive("dashboard") ? "text-navy-900" : "text-slate-400")} />
              {mobActive("dashboard") && (
                <span className="absolute -bottom-1 left-1/2 -translate-x-1/2 h-1 w-4 rounded-full bg-gold-500 shadow-xs shadow-gold-500" />
              )}
            </div>
            <span className="whitespace-nowrap">{MOBILE_NAV[0].label}</span>
          </button>

          {/* Tab 2: Collection */}
          <button
            onClick={() => go({ name: "collection" })}
            className={cn(
              "relative flex flex-col items-center justify-center min-h-[48px] gap-1 text-[10px] font-bold tap-press transition-colors",
              mobActive("collection") ? "text-navy-950 font-extrabold" : "text-slate-400 hover:text-slate-600"
            )}
          >
            <div className="relative">
              <i className={cn("fa-solid text-[19px]", MOBILE_NAV[1].icon, mobActive("collection") ? "text-navy-900" : "text-slate-400")} />
              {mobActive("collection") && (
                <span className="absolute -bottom-1 left-1/2 -translate-x-1/2 h-1 w-4 rounded-full bg-gold-500 shadow-xs shadow-gold-500" />
              )}
            </div>
            <span className="whitespace-nowrap">{MOBILE_NAV[1].label}</span>
          </button>

          {/* Elevated Center Banking Action: Create New Loan */}
          <div className="flex justify-center -mt-6">
            <button
              onClick={() => go({ name: "new" })}
              aria-label="បង្កើតកម្ចីថ្មី"
              className={cn(
                "tap-press flex h-14 w-14 items-center justify-center rounded-full text-xl shadow-xl transition-all border-4 border-white",
                view.name === "new"
                  ? "bg-navy-900 text-gold-400 shadow-navy-900/30 ring-2 ring-gold-400"
                  : "bg-gold-gradient text-navy-950 shadow-gold-500/40 ring-1 ring-gold-400/40"
              )}
            >
              <i className="fa-solid fa-plus text-lg" />
            </button>
          </div>

          {/* Tab 3: Loans */}
          <button
            onClick={() => go({ name: "loans" })}
            className={cn(
              "relative flex flex-col items-center justify-center min-h-[48px] gap-1 text-[10px] font-bold tap-press transition-colors",
              mobActive("loans") ? "text-navy-950 font-extrabold" : "text-slate-400 hover:text-slate-600"
            )}
          >
            <div className="relative">
              <i className={cn("fa-solid text-[19px]", MOBILE_NAV[2].icon, mobActive("loans") ? "text-navy-900" : "text-slate-400")} />
              {mobActive("loans") && (
                <span className="absolute -bottom-1 left-1/2 -translate-x-1/2 h-1 w-4 rounded-full bg-gold-500 shadow-xs shadow-gold-500" />
              )}
            </div>
            <span className="whitespace-nowrap">{MOBILE_NAV[2].label}</span>
          </button>

          {/* Tab 4: Settings */}
          <button
            onClick={() => go({ name: "settings" })}
            className={cn(
              "relative flex flex-col items-center justify-center min-h-[48px] gap-1 text-[10px] font-bold tap-press transition-colors",
              mobActive("settings") ? "text-navy-950 font-extrabold" : "text-slate-400 hover:text-slate-600"
            )}
          >
            <div className="relative">
              <i className={cn("fa-solid text-[19px]", MOBILE_NAV[3].icon, mobActive("settings") ? "text-navy-900" : "text-slate-400")} />
              {mobActive("settings") && (
                <span className="absolute -bottom-1 left-1/2 -translate-x-1/2 h-1 w-4 rounded-full bg-gold-500 shadow-xs shadow-gold-500" />
              )}
            </div>
            <span className="whitespace-nowrap">{MOBILE_NAV[3].label}</span>
          </button>
        </div>
      </nav>
    </div>
  );
}
