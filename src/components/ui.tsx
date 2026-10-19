import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import { cn } from "../utils/cn";
import type { InstStatus, LoanType } from "../lib/data";

/* ---------- official MSH Microfinance SVG brand logo ---------- */
export function MSHLogo({ className = "h-11 w-11" }: { className?: string }) {
  const uid = useId().replace(/:/g, "");
  const bgId = `msh-bg-${uid}`;
  const goldId = `msh-gold-${uid}`;
  return (
    <svg
      viewBox="0 0 64 64"
      className={cn("shrink-0 select-none", className)}
      role="img"
      aria-label="MSH Microfinance Logo"
    >
      <defs>
        <linearGradient id={bgId} x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#0b192c" />
          <stop offset="100%" stopColor="#152a4a" />
        </linearGradient>
        <linearGradient id={goldId} x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#f5dc8c" />
          <stop offset="50%" stopColor="#d4af37" />
          <stop offset="100%" stopColor="#b89123" />
        </linearGradient>
      </defs>
      <rect width="64" height="64" rx="16" fill={`url(#${bgId})`} stroke="#d4af37" strokeWidth="1.5" strokeOpacity="0.45" />
      <path
        d="M32 7L51 15V31C51 43.8 42.9 53.2 32 57C21.1 53.2 13 43.8 13 31V15L32 7Z"
        fill={`url(#${goldId})`}
        fillOpacity="0.14"
        stroke={`url(#${goldId})`}
        strokeWidth="2.5"
        strokeLinejoin="round"
      />
      <path
        d="M21 40V24L27.5 33L32 26.5L36.5 33L43 24V40"
        fill="none"
        stroke={`url(#${goldId})`}
        strokeWidth="3.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx="32" cy="16.5" r="2.3" fill="#f5dc8c" />
    </svg>
  );
}

/* ---------- animated number ---------- */
export function useCountUp(target: number, dur = 600): number {
  const [v, setV] = useState(0);
  const fromRef = useRef(0);
  useEffect(() => {
    const from = fromRef.current;
    if (from === target) {
      setV(target);
      return;
    }
    const t0 = performance.now();
    let raf = 0;
    const step = (t: number) => {
      const p = Math.min(1, (t - t0) / dur);
      const e = 1 - Math.pow(1 - p, 3);
      setV(from + (target - from) * e);
      if (p < 1) raf = requestAnimationFrame(step);
      else fromRef.current = target;
    };
    raf = requestAnimationFrame(step);
    return () => {
      cancelAnimationFrame(raf);
      fromRef.current = target;
    };
  }, [target, dur]);
  return v;
}

/* ---------- banking modal / bottom sheet ---------- */
export function Modal({
  onClose,
  children,
  maxW = "max-w-lg",
}: {
  onClose: () => void;
  children: ReactNode;
  maxW?: string;
}) {
  const onCloseRef = useRef(onClose);
  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  useEffect(() => {
    const h = (e: KeyboardEvent) => e.key === "Escape" && onCloseRef.current();
    window.addEventListener("keydown", h);
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", h);
      document.body.style.overflow = "";
    };
  }, []);

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center p-0 sm:items-center sm:p-6">
      <div
        className="anim-fade-in absolute inset-0 bg-navy-950/65 backdrop-blur-sm"
        onClick={onClose}
      />
      <div
        className={cn(
          "anim-scale-in relative max-h-[92vh] w-full overflow-y-auto rounded-t-3xl bg-card pb-[env(safe-area-inset-bottom)] shadow-2xl shadow-navy-950/20 sm:rounded-3xl border border-slate-100",
          maxW
        )}
      >
        {/* mobile drag handle affordance */}
        <div className="pt-3 pb-1 flex justify-center sm:hidden">
          <div className="h-1.5 w-12 rounded-full bg-slate-200" />
        </div>
        {children}
      </div>
    </div>
  );
}

/* ---------- badges ---------- */
export function TypeBadge({ type }: { type: LoanType }) {
  return type === "daily" ? (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-navy-50 border border-navy-100/80 px-2.5 py-0.5 text-[11px] font-semibold text-navy-800">
      <i className="fa-solid fa-calendar-day text-[10px] text-navy-500" /> បង់រាល់ថ្ងៃ
    </span>
  ) : (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-gold-50 border border-gold-200/80 px-2.5 py-0.5 text-[11px] font-semibold text-gold-700">
      <i className="fa-solid fa-calendar-check text-[10px] text-gold-600" /> បង់ប្រចាំខែ
    </span>
  );
}

export function StatusBadge({ s }: { s: InstStatus | "done" }) {
  const map: Record<string, { cls: string; icon: string; label: string }> = {
    paid: {
      cls: "bg-emerald-50 text-emerald-700 border border-emerald-200/80 font-bold",
      icon: "fa-circle-check",
      label: "បង់រួច",
    },
    partial: {
      cls: "bg-amber-50 text-amber-800 border border-amber-300 font-bold",
      icon: "fa-triangle-exclamation",
      label: "ជំពាក់ខ្វះ",
    },
    overdue: {
      cls: "bg-rose-50 text-rose-700 border border-rose-200/80 font-bold",
      icon: "fa-circle-exclamation",
      label: "ហួសកំណត់",
    },
    today: {
      cls: "bg-amber-100/80 text-amber-900 border border-amber-300 font-bold",
      icon: "fa-bell",
      label: "ដល់ថ្ងៃនេះ",
    },
    upcoming: {
      cls: "bg-slate-100 text-slate-600 border border-slate-200/80 font-medium",
      icon: "fa-clock",
      label: "មិនទាន់ដល់",
    },
    done: {
      cls: "bg-emerald-50 text-emerald-700 border border-emerald-200/80 font-bold",
      icon: "fa-award",
      label: "រួចរាល់",
    },
  };
  const m = map[s] ?? map.upcoming;
  return (
    <span className={cn("inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-semibold shadow-xs", m.cls)}>
      <i className={cn("fa-solid text-[10px]", m.icon)} /> {m.label}
    </span>
  );
}

/* ---------- progress bar ---------- */
export function Bar({ pct, className, barClass }: { pct: number; className?: string; barClass?: string }) {
  return (
    <div className={cn("h-2 w-full overflow-hidden rounded-full bg-slate-100 border border-slate-200/40", className)}>
      <div
        className={cn("h-full rounded-full bg-mint-500 transition-all duration-700", barClass)}
        style={{ width: `${Math.min(100, Math.max(0, pct))}%` }}
      />
    </div>
  );
}

/* ---------- banking avatar ---------- */
const AV_GRADIENTS = [
  "from-navy-800 to-navy-950",
  "from-[#1E3D68] to-[#0B192C]",
  "from-[#152A4A] to-[#0A192F]",
  "from-navy-700 to-navy-900",
];

export function Avatar({ name, size = "h-10 w-10 text-sm" }: { name: string; size?: string }) {
  const ch = name.trim().charAt(0) || "?";
  const idx = name.length % AV_GRADIENTS.length;
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center justify-center rounded-2xl font-bold text-gold-400 bg-gradient-to-br border border-gold-400/25 shadow-sm",
        AV_GRADIENTS[idx],
        size
      )}
    >
      {ch}
    </span>
  );
}

/* ---------- sparkline ---------- */
export function Sparkline({
  data,
  className,
  stroke = "var(--color-gold-500)",
}: {
  data: number[];
  className?: string;
  stroke?: string;
}) {
  const w = 120;
  const h = 36;
  const max = Math.max(...data, 1);
  const pts = data.map((v, i) => `${(i / (data.length - 1 || 1)) * w},${h - (v / max) * (h - 6) - 3}`);
  return (
    <svg viewBox={`0 0 ${w} ${h}`} className={cn("overflow-visible", className)} preserveAspectRatio="none">
      <polyline points={pts.join(" ")} fill="none" stroke={stroke} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
      <polyline points={`0,${h} ${pts.join(" ")} ${w},${h}`} fill={stroke} opacity="0.1" stroke="none" />
    </svg>
  );
}

/* ---------- empty state ---------- */
export function Empty({ icon, title, sub, action }: { icon: string; title: string; sub?: string; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 py-14 px-4 text-center">
      <span className="flex h-16 w-16 items-center justify-center rounded-3xl bg-slate-50 text-2xl text-slate-400 border border-slate-100 shadow-inner">
        <i className={cn("fa-solid", icon)} />
      </span>
      <p className="mt-2 font-bold text-navy-900 text-base">{title}</p>
      {sub && <p className="max-w-xs text-xs leading-5 text-slate-500">{sub}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

/* ---------- section card ---------- */
export function Card({ className, children }: { className?: string; children: ReactNode }) {
  return (
    <div className={cn("rounded-2xl sm:rounded-3xl border border-slate-100 bg-card shadow-[0_4px_20px_-4px_rgba(11,25,44,0.06)]", className)}>
      {children}
    </div>
  );
}

export function CardHead({ icon, title, en, right }: { icon: string; title: string; en?: string; right?: ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3 border-b border-slate-100/90 px-4 py-3.5 sm:px-6 sm:py-4">
      <div className="flex items-center gap-3">
        <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-navy-50 text-navy-800 border border-navy-100/60 shadow-xs">
          <i className={cn("fa-solid", icon)} />
        </span>
        <div>
          <h3 className="text-sm font-bold text-navy-900 sm:text-base leading-snug">{title}</h3>
          {en && <p className="font-num text-[10px] font-medium tracking-wide text-slate-400">{en}</p>}
        </div>
      </div>
      {right}
    </div>
  );
}
