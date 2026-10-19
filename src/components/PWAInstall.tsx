import { useEffect, useState } from "react";
import { Modal, MSHLogo } from "./ui";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>;
}

let globalDeferredPrompt: BeforeInstallPromptEvent | null = null;
const promptListeners = new Set<(e: BeforeInstallPromptEvent | null) => void>();

if (typeof window !== "undefined") {
  window.addEventListener("beforeinstallprompt", (e: Event) => {
    e.preventDefault();
    globalDeferredPrompt = e as BeforeInstallPromptEvent;
    promptListeners.forEach((fn) => fn(globalDeferredPrompt));
  });

  window.addEventListener("appinstalled", () => {
    globalDeferredPrompt = null;
    promptListeners.forEach((fn) => fn(null));
  });
}

export function usePWAInstall() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(
    () => globalDeferredPrompt
  );
  const [isInstalled, setIsInstalled] = useState(false);
  const [isIOS, setIsIOS] = useState(false);

  useEffect(() => {
    const checkStandalone = () => {
      const standalone =
        window.matchMedia("(display-mode: standalone)").matches ||
        (window.navigator as unknown as { standalone?: boolean }).standalone === true;
      setIsInstalled(standalone);
    };
    checkStandalone();

    const ua = window.navigator.userAgent.toLowerCase();
    const isIOSDevice =
      /iphone|ipad|ipod/.test(ua) ||
      (window.navigator.platform === "MacIntel" && window.navigator.maxTouchPoints > 1);
    setIsIOS(isIOSDevice);

    const listener = (p: BeforeInstallPromptEvent | null) => {
      setDeferredPrompt(p);
      if (!p) checkStandalone();
    };
    promptListeners.add(listener);

    const mql = window.matchMedia("(display-mode: standalone)");
    const onMql = () => checkStandalone();
    mql.addEventListener?.("change", onMql);

    return () => {
      promptListeners.delete(listener);
      mql.removeEventListener?.("change", onMql);
    };
  }, []);

  const install = async (): Promise<boolean> => {
    if (!deferredPrompt) return false;
    try {
      await deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      if (outcome === "accepted") {
        globalDeferredPrompt = null;
        setDeferredPrompt(null);
        setIsInstalled(true);
        return true;
      }
    } catch {
      /* ignore */
    }
    return false;
  };

  return {
    isInstallable: !!deferredPrompt,
    isInstalled,
    isIOS,
    install,
  };
}

export function PWAInstallGuideModal({
  isIOS,
  onClose,
}: {
  isIOS: boolean;
  onClose: () => void;
}) {
  return (
    <Modal onClose={onClose} maxW="max-w-md">
      <div className="p-5 sm:p-6">
        <div className="flex items-center gap-3 border-b border-slate-100 pb-4">
          <MSHLogo className="h-12 w-12 shadow-md" />
          <div className="min-w-0 flex-1">
            <p className="font-num text-[10px] font-bold uppercase tracking-[0.18em] text-gold-600">
              Add to Home Screen
            </p>
            <h3 className="text-base sm:text-lg font-black text-navy-950 leading-snug">
              ដំឡើងកម្មវិធី MSH លើអេក្រង់ទូរស័ព្ទ
            </h3>
          </div>
        </div>
        <div className="mt-4 space-y-3 text-xs sm:text-sm text-navy-800">
          <p className="text-xs leading-relaxed text-slate-600">
            {isIOS
              ? "សម្រាប់ទូរស័ព្ទ iPhone / iPad (Safari) សូមអនុវត្តតាមជំហានងាយៗខាងក្រោម៖"
              : "ដើម្បីដំណើរការ MSH Microfinance ដូចកម្មវិធីទូរស័ព្ទ (Add to Home Screen) សូមធ្វើតាមជំហាន៖"}
          </p>
          {isIOS ? (
            <div className="space-y-2.5">
              <div className="flex items-start gap-3 rounded-2xl border border-slate-200/80 bg-slate-50 p-3.5">
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-navy-900 font-num text-xs font-black text-gold-400">
                  1
                </span>
                <div>
                  <p className="font-bold text-navy-950 text-xs sm:text-sm">
                    ចុចប៊ូតុង <span className="text-blue-600">Share</span> លើ Safari
                  </p>
                  <p className="mt-0.5 text-[11px] text-slate-500">
                    នៅរបារខាងក្រោមនៃអេក្រង់{" "}
                    <i className="fa-solid fa-arrow-up-from-bracket text-blue-600 mx-1" /> (Tap the Share button)
                  </p>
                </div>
              </div>
              <div className="flex items-start gap-3 rounded-2xl border border-slate-200/80 bg-slate-50 p-3.5">
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-navy-900 font-num text-xs font-black text-gold-400">
                  2
                </span>
                <div>
                  <p className="font-bold text-navy-950 text-xs sm:text-sm">
                    ជ្រើសរើស <span className="text-emerald-700">"Add to Home Screen"</span>
                  </p>
                  <p className="mt-0.5 text-[11px] text-slate-500">
                    រំកិលចុះក្រោម រួចចុច{" "}
                    <i className="fa-regular fa-square-plus text-navy-800 mx-1" />{" "}
                    <strong>Add to Home Screen</strong> រួចចុច <strong>Add</strong>
                  </p>
                </div>
              </div>
            </div>
          ) : (
            <div className="space-y-2.5">
              <div className="flex items-start gap-3 rounded-2xl border border-slate-200/80 bg-slate-50 p-3.5">
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-navy-900 font-num text-xs font-black text-gold-400">
                  1
                </span>
                <div>
                  <p className="font-bold text-navy-950 text-xs sm:text-sm">
                    ចុចម៉ឺនុយ Browser <i className="fa-solid fa-ellipsis-vertical mx-1 text-navy-800" /> ឬ Share
                  </p>
                  <p className="mt-0.5 text-[11px] text-slate-500">
                    នៅជ្រុងខាងលើ ឬខាងក្រោមនៃ Chrome / Edge ឬ Safari
                  </p>
                </div>
              </div>
              <div className="flex items-start gap-3 rounded-2xl border border-slate-200/80 bg-slate-50 p-3.5">
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-navy-900 font-num text-xs font-black text-gold-400">
                  2
                </span>
                <div>
                  <p className="font-bold text-navy-950 text-xs sm:text-sm">
                    ជ្រើសរើស <span className="text-emerald-700">"Install App"</span> ឬ{" "}
                    <span className="text-emerald-700">"Add to Home Screen"</span>
                  </p>
                  <p className="mt-0.5 text-[11px] text-slate-500">
                    ដើម្បីប្រើប្រាស់ MSH ដូចជា Native App ពេញលេញ
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>
        <button
          type="button"
          onClick={onClose}
          className="tap-press mt-5 w-full rounded-2xl bg-navy-900 hover:bg-navy-800 py-3.5 text-xs sm:text-sm font-bold text-white shadow-md"
        >
          យល់ព្រម (Got it)
        </button>
      </div>
    </Modal>
  );
}

export function PWAInstallButton({
  variant = "header",
}: {
  variant?: "header" | "sidebar" | "banner";
}) {
  const { isInstallable, isInstalled, isIOS, install } = usePWAInstall();
  const [showGuide, setShowGuide] = useState(false);

  if (isInstalled) {
    return null;
  }

  const handleClick = async () => {
    if (isInstallable) {
      const accepted = await install();
      if (!accepted) {
        setShowGuide(true);
      }
    } else {
      setShowGuide(true);
    }
  };

  if (variant === "sidebar") {
    return (
      <>
        <button
          type="button"
          onClick={() => void handleClick()}
          className="tap-press mx-1 mt-2 flex w-[calc(100%-0.5rem)] items-center justify-center gap-2 rounded-2xl border border-gold-400/35 bg-gold-500/15 hover:bg-gold-500/25 px-3.5 py-2.5 text-xs font-bold text-gold-300 transition-all"
        >
          <i className="fa-solid fa-mobile-screen-button text-gold-400" />
          <span>ដំឡើង App លើទូរស័ព្ទ (Install App)</span>
        </button>
        {showGuide && <PWAInstallGuideModal isIOS={isIOS} onClose={() => setShowGuide(false)} />}
      </>
    );
  }

  if (variant === "banner") {
    if (!isInstallable && !isIOS) return null;
    return (
      <>
        <div className="anim-fade-up flex items-center justify-between gap-3 rounded-2xl border border-navy-200 bg-gradient-to-r from-navy-900 to-navy-800 p-3.5 text-white shadow-md">
          <div className="flex items-center gap-3 min-w-0">
            <MSHLogo className="h-10 w-10 shrink-0" />
            <div className="min-w-0">
              <p className="text-xs font-extrabold text-white truncate">
                ដំឡើងកម្មវិធី MSH Microfinance លើទូរស័ព្ទ
              </p>
              <p className="text-[11px] text-navy-200 truncate">
                ដំណើរការរលូន លឿនរហ័ស ដូចកម្មវិធីទូរស័ព្ទ (Install App)
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => void handleClick()}
            className="tap-press shrink-0 rounded-xl bg-gold-gradient px-3.5 py-2.5 text-xs font-black text-navy-950 shadow-sm min-h-[40px] whitespace-nowrap"
          >
            <i className="fa-solid fa-download mr-1.5" /> ដំឡើង App
          </button>
        </div>
        {showGuide && <PWAInstallGuideModal isIOS={isIOS} onClose={() => setShowGuide(false)} />}
      </>
    );
  }

  return (
    <>
      <button
        type="button"
        onClick={() => void handleClick()}
        title="ដំឡើង App លើទូរស័ព្ទ / Install App"
        className="tap-press flex h-11 px-3 sm:px-3.5 items-center justify-center gap-1.5 rounded-xl bg-gold-gradient text-xs font-black text-navy-950 shadow-xs hover:brightness-105 whitespace-nowrap"
      >
        <i className="fa-solid fa-download text-xs text-navy-900" />
        <span className="hidden md:inline">ដំឡើង App</span>
        <span className="md:hidden text-[11px]">App</span>
      </button>
      {showGuide && <PWAInstallGuideModal isIOS={isIOS} onClose={() => setShowGuide(false)} />}
    </>
  );
}
