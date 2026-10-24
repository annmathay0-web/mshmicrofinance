import { useEffect, useState, type CSSProperties, type FormEvent } from "react";
import { cn } from "../utils/cn";
import {
  createSession,
  getLockRemaining,
  registerFailedAttempt,
  resetFailedAttempts,
  verifyCredentials,
} from "../lib/auth";
import { khmerToGlobalDigits } from "../lib/security";
import { MSHLogo } from "./ui";
import { PWAInstallButton } from "./PWAInstall";

const FEATURES = [
  {
    icon: "fa-bolt",
    title: "ដំណើរការរហ័ស & Offline-First",
    sub: "គណនាកាលវិភាគកម្ចីស្វ័យប្រវត្តិ មិនបាច់ពឹងផ្អែកលើអ៊ីនធឺណិតគ្រប់ពេល",
  },
  {
    icon: "fa-shield-halved",
    title: "សុវត្ថិភាពខ្ពស់លំដាប់ធនាគារ",
    sub: "ប្រព័ន្ធការពារ Salted SHA-256 Hashing និង Backup & Cloud Sync",
  },
  {
    icon: "fa-money-bill-trend-up",
    title: "ប្រព័ន្ធ Rollover ជំពាក់ខ្វះឆ្លាតវៃ",
    sub: "បង្វិលប្រាក់ជំពាក់ខ្វះ (Rollover Arrears) ទៅថ្ងៃបន្ទាប់ដោយស្វ័យប្រវត្តិតាមលំដាប់",
  },
];

export default function Login({ onSuccess }: { onSuccess: () => void }) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [show, setShow] = useState(false);
  const [remember, setRemember] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [shakeKey, setShakeKey] = useState(0);
  const [lockedUntil, setLockedUntil] = useState<number>(() => Date.now() + getLockRemaining());
  const [tick, setTick] = useState(0);

  const lockLeft = Math.max(0, lockedUntil - Date.now());
  const locked = lockLeft > 0;

  useEffect(() => {
    if (!locked) return;
    const id = window.setInterval(() => setTick((t) => t + 1), 250);
    return () => window.clearInterval(id);
  }, [locked]);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (loading || locked) return;
    setLoading(true);
    setError("");

    try {
      const user = await verifyCredentials(username, password);
      if (user) {
        resetFailedAttempts();
        createSession(user, remember);
        onSuccess();
        return;
      }
    } catch {
      /* ignore */
    }

    const r = registerFailedAttempt();
    if (r.locked) {
      setLockedUntil(Date.now() + r.remainingMs);
      setError("គណនីត្រូវបានចាក់សោបណ្តោះអាសន្ន ដោយសារព្យាយាមខុសច្រើនដង");
    } else {
      setError(
        r.attemptsLeft <= 2
          ? `ឈ្មោះ ឬពាក្យសម្ងាត់មិនត្រឹមត្រូវ (នៅសល់ ${r.attemptsLeft} លើក)`
          : "ឈ្មោះគណនី ឬពាក្យសម្ងាត់មិនត្រឹមត្រូវ"
      );
    }
    setShakeKey((k) => k + 1);
    setLoading(false);
  };

  void tick;

  return (
    <div className="flex min-h-screen bg-paper">
      {/* ------------ left brand banking showcase ------------ */}
      <div className="relative hidden w-[50%] overflow-hidden bg-navy-950 lg:flex lg:flex-col lg:justify-between p-12 xl:p-16">
        <div className="absolute inset-0 bg-gradient-to-br from-navy-950 via-navy-900 to-[#122b52]" />
        <div className="absolute inset-0 bg-grid-dark pointer-events-none" />
        <div className="absolute -right-32 -top-32 h-96 w-96 rounded-full bg-gold-500/10 blur-3xl pointer-events-none" />
        <div className="absolute -bottom-40 -left-24 h-96 w-96 rounded-full bg-navy-600/25 blur-3xl pointer-events-none" />

        {/* Floating elements */}
        <div className="anim-float absolute right-[14%] top-[18%]" style={{ "--rot": "6deg" } as CSSProperties}>
          <span className="flex h-16 w-16 items-center justify-center rounded-2xl border border-gold-400/40 bg-navy-850/90 text-2xl text-gold-400 shadow-xl backdrop-blur font-black">
            ៛
          </span>
        </div>

        <div className="relative z-10">
          <div className="flex items-center gap-3">
            <MSHLogo className="h-12 w-12 shadow-lg shadow-gold-500/30" />
            <div>
              <p className="font-num text-xl font-bold tracking-tight text-white">
                MSH <span className="text-gold-400 font-semibold">Microfinance</span>
              </p>
              <p className="text-[11px] font-medium text-navy-300">ស្ថាប័នមីក្រូហិរញ្ញវត្ថុ</p>
            </div>
          </div>

          <h1 className="mt-14 max-w-lg text-3xl xl:text-4xl font-black leading-tight text-white">
            ប្រព័ន្ធគ្រប់គ្រងឥណទាន{" "}
            <span className="text-gold-400 block mt-1">ប្រកបដោយទំនុកចិត្ត និងភាពត្រឹមត្រូវ</span>
          </h1>

          <p className="mt-4 text-xs font-bold uppercase tracking-[0.22em] text-navy-400">
            Smart Mobile Microfinance Platform
          </p>

          <p className="mt-4 max-w-md text-sm leading-relaxed text-navy-200">
            គ្រប់គ្រងកម្ចីបង់រាល់ថ្ងៃ និងបង់ប្រចាំខែ រួមបញ្ចូលប្រតិទិនចន្ទគតិ ថ្ងៃឈប់សម្រាកបុណ្យជាតិ និងការបង្វិលប្រាក់ជំពាក់ខ្វះដោយស្វ័យប្រវត្តិ។
          </p>

          <ul className="mt-10 space-y-4">
            {FEATURES.map((f, i) => (
              <li key={f.icon} className={cn("anim-fade-up flex items-start gap-3.5", `d${i + 2}`)}>
                <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-white/10 bg-white/5 text-gold-400">
                  <i className={cn("fa-solid", f.icon)} />
                </span>
                <div>
                  <p className="font-bold text-white text-sm">{f.title}</p>
                  <p className="mt-0.5 text-xs leading-5 text-navy-300">{f.sub}</p>
                </div>
              </li>
            ))}
          </ul>
        </div>

        <div className="relative z-10 flex items-center justify-between border-t border-white/10 pt-6 text-xs text-navy-400 font-medium">
          <span>រក្សាសិទ្ធិ © 2026 MSH Microfinance</span>
          <span className="flex items-center gap-1.5 text-gold-400">
            <i className="fa-solid fa-shield-halved" /> សុវត្ថិភាពខ្ពស់
          </span>
        </div>
      </div>

      {/* ------------ right form panel ------------ */}
      <div className="bg-dots pt-safe pb-safe relative flex flex-1 items-center justify-center p-3 sm:p-8 lg:p-10">
        <div key={shakeKey} className={cn("w-full max-w-md", shakeKey > 0 && "anim-shake")}>
          <div className="mb-5 sm:mb-6 flex items-center justify-between gap-3 lg:hidden">
            <div className="flex items-center gap-2.5 sm:gap-3">
              <MSHLogo className="h-10 w-10 sm:h-11 sm:w-11 shadow-md" />
              <div>
                <p className="font-num text-base sm:text-lg font-bold text-navy-950">
                  MSH <span className="text-gold-600 font-semibold">Microfinance</span>
                </p>
                <p className="text-[10px] font-medium text-slate-400">ប្រព័ន្ធគ្រប់គ្រងឥណទាន</p>
              </div>
            </div>
            <PWAInstallButton variant="header" />
          </div>

          <div className="anim-fade-up rounded-2xl sm:rounded-3xl border border-slate-100 bg-white p-5 sm:p-8 lg:p-9 shadow-xl shadow-navy-950/5">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-gold-600">
                Authentication
              </span>
              <span className="font-num flex items-center gap-1 text-[11px] font-semibold text-emerald-600 bg-emerald-50 px-2.5 py-0.5 rounded-full border border-emerald-200/60">
                <i className="fa-solid fa-lock text-[9px]" /> SSL Secure
              </span>
            </div>

            <h2 className="mt-2 text-xl sm:text-2xl font-black text-navy-950">ចូលប្រើប្រាស់ប្រព័ន្ធ</h2>
            <p className="mt-1 text-xs text-slate-500">
              សូមបញ្ចូលគណនី និងពាក្យសម្ងាត់របស់អ្នកដើម្បីគ្រប់គ្រងឥណទាន
            </p>

            {error && (
              <div className="anim-scale-in mt-4 sm:mt-5 mb-4 flex items-start gap-2.5 rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs font-semibold text-rose-700">
                <i className={cn("fa-solid mt-0.5", locked ? "fa-lock" : "fa-circle-exclamation")} />
                <span>
                  {error}
                  {locked && (
                    <span className="font-num ml-1 font-bold">({Math.ceil(lockLeft / 1000)}s)</span>
                  )}
                </span>
              </div>
            )}

            <form onSubmit={(e) => void submit(e)} className="mt-5 sm:mt-6 space-y-4">
              <div>
                <label className="mb-1.5 block text-xs font-bold text-navy-900">
                  ឈ្មោះគណនី <span className="font-num text-[10px] font-medium text-slate-400">(Username)</span>
                </label>
                <div className="group relative">
                  <i className="fa-regular fa-user absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 text-xs" />
                  <input
                    value={username}
                    onChange={(e) => setUsername(khmerToGlobalDigits(e.target.value))}
                    placeholder="ឈ្មោះគណនី..."
                    autoComplete="username"
                    maxLength={40}
                    disabled={locked}
                    className="w-full min-h-[44px] rounded-2xl border border-slate-200 bg-slate-50/70 py-3 pl-10 pr-4 text-xs sm:text-sm font-semibold text-navy-900 outline-none focus:border-navy-900 focus:bg-white transition-all disabled:opacity-50"
                  />
                </div>
              </div>

              <div>
                <label className="mb-1.5 block text-xs font-bold text-navy-900">
                  ពាក្យសម្ងាត់ <span className="font-num text-[10px] font-medium text-slate-400">(Password)</span>
                </label>
                <div className="group relative">
                  <i className="fa-solid fa-lock absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 text-xs" />
                  <input
                    type={show ? "text" : "password"}
                    value={password}
                    onChange={(e) => setPassword(khmerToGlobalDigits(e.target.value))}
                    placeholder="ពាក្យសម្ងាត់..."
                    autoComplete="current-password"
                    maxLength={72}
                    disabled={locked}
                    className="w-full min-h-[44px] rounded-2xl border border-slate-200 bg-slate-50/70 py-3 pl-10 pr-12 text-xs sm:text-sm font-semibold text-navy-900 outline-none focus:border-navy-900 focus:bg-white transition-all disabled:opacity-50"
                  />
                  <button
                    type="button"
                    onClick={() => setShow((s) => !s)}
                    className="tap-press absolute right-1 top-1/2 -translate-y-1/2 flex h-11 w-11 min-h-[44px] min-w-[44px] items-center justify-center text-slate-400 hover:text-navy-900 rounded-xl"
                    aria-label={show ? "លាក់ពាក្យសម្ងាត់" : "បង្ហាញពាក្យសម្ងាត់"}
                  >
                    <i className={cn("fa-solid text-xs", show ? "fa-eye-slash" : "fa-eye")} />
                  </button>
                </div>
              </div>

              <div className="flex items-center justify-between text-xs pt-1">
                <label className="flex cursor-pointer select-none items-center gap-2 text-slate-600 font-medium min-h-[32px]">
                  <input
                    type="checkbox"
                    checked={remember}
                    onChange={(e) => setRemember(e.target.checked)}
                    className="h-4 w-4 rounded accent-navy-900"
                  />
                  <span>ចងចាំការចូលប្រើ</span>
                </label>
                <span className="text-slate-400 font-medium text-[11px]">
                  Salted SHA-256 Auth
                </span>
              </div>

              <button
                type="submit"
                disabled={loading || locked}
                className="tap-press group relative mt-2 flex min-h-[48px] w-full items-center justify-center gap-2 rounded-2xl bg-navy-900 hover:bg-navy-850 py-3.5 font-bold text-white shadow-lg shadow-navy-950/20 text-xs sm:text-sm"
              >
                {loading ? (
                  <>
                    <i className="fa-solid fa-circle-notch fa-spin text-gold-400" />
                    <span>កំពុងផ្ទៀងផ្ទាត់...</span>
                  </>
                ) : (
                  <>
                    <span>ចូលប្រើប្រព័ន្ធ</span>
                    <i className="fa-solid fa-arrow-right text-gold-400 text-xs group-hover:translate-x-1 transition-transform" />
                  </>
                )}
              </button>
            </form>
          </div>

          <p className="mt-5 text-center text-xs text-slate-400">
            MSH Microfinance • Loan Management Platform
          </p>
        </div>
      </div>
    </div>
  );
}
