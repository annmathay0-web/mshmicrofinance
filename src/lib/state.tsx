import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import type { DB, Loan, Payment, Settings } from "./data";
import { makeInitialDB, ORG_NAME, round2, todayISO, uid } from "./data";
import { isISODate, isValidSheetUrl, sanitizePhone, sanitizeText, validateDB } from "./security";
import { allocatePreview, loanStats, planPayUpToDate, planPayUpToIndex, planSettlement } from "./data";

const DB_KEY = "msh_db_v1";
const SIG_KEY = "msh_db_sig_v1";
const LEGACY_KEYS = ["loanpro_db_v1", "loanpro_db_v2", "loanpro_auth_v1", "loanpro_session_v1"];

function purgeLegacyKeys() {
  try {
    LEGACY_KEYS.forEach((k) => localStorage.removeItem(k));
  } catch {
    /* ignore */
  }
}

function fingerprint(s: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h.toString(16);
}

let integrityWarning = false;
export function consumeIntegrityWarning(): boolean {
  const v = integrityWarning;
  integrityWarning = false;
  return v;
}

export type View =
  | { name: "dashboard" }
  | { name: "collection" }
  | { name: "loans" }
  | { name: "new" }
  | { name: "loan"; id: string }
  | { name: "settings" };

export interface Toast {
  id: number;
  msg: string;
  kind: "success" | "error" | "info";
}

export interface PendingImport {
  db: DB;
  fileName?: string;
}

export const SHEET_HEADERS = [
  "កូដកម្ចី",
  "ឈ្មោះអតិថិជន",
  "លេខទូរស័ព្ទ",
  "ចំនួនប្រាក់",
  "កាលបរិច្ឆេទ",
  "ស្ថានភាព",
] as const;

export interface SyncEvent {
  id: string;
  t: number;
  row: Record<(typeof SHEET_HEADERS)[number], string | number>;
}

export interface PayResult {
  payments: Payment[];
  total: number;
  cleared: number;
  leftover: number;
}

const QUEUE_KEY = "msh_sync_queue";
const QUEUE_MAX = 500;

function loadQueue(): SyncEvent[] {
  try {
    const raw = localStorage.getItem(QUEUE_KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (e): e is SyncEvent =>
        !!e &&
        typeof e === "object" &&
        typeof (e as SyncEvent).id === "string" &&
        typeof (e as SyncEvent).row === "object"
    );
  } catch {
    return [];
  }
}

const LAST_BACKUP_KEY = "msh_last_backup";
export function markBackupDone() {
  try {
    localStorage.setItem(LAST_BACKUP_KEY, new Date().toISOString());
  } catch {
    /* ignore */
  }
}

export function daysSinceLastBackup(): number | null {
  try {
    const raw = localStorage.getItem(LAST_BACKUP_KEY);
    if (!raw) return null;
    return Math.floor((Date.now() - new Date(raw).getTime()) / 86_400_000);
  } catch {
    return null;
  }
}

interface AppCtx {
  db: DB;
  view: View;
  go: (v: View) => void;
  toast: (msg: string, kind?: Toast["kind"]) => void;
  addLoan: (l: Omit<Loan, "id" | "code" | "createdAt">) => Loan;
  recordPayment: (loanId: string, inst: number, amount: number) => Payment | null;
  recordSmartPayment: (loanId: string, amount: number) => PayResult | null;
  payUpToDate: (loanId: string, targetISO: string) => PayResult | null;
  payUpToIndex: (loanId: string, targetIdx: number) => PayResult | null;
  paySelected: (loanId: string, instIndexes: number[]) => PayResult | null;
  deleteLoan: (id: string) => void;
  updateSettings: (p: Partial<Settings>) => void;
  requestImport: (json: string, fileName?: string) => boolean;
  confirmImport: () => void;
  cancelImport: () => void;
  pendingImport: PendingImport | null;
  resetDB: () => void;
  syncNow: (urlOverride?: string) => Promise<void>;
  flushQueue: () => Promise<void>;
  queue: SyncEvent[];
  syncing: boolean;
}

const Ctx = createContext<AppCtx | null>(null);
const ToastCtx = createContext<{ toasts: Toast[]; dismissToast: (id: number) => void } | null>(null);

function sanitize(parsed: DB): DB {
  const seed = makeInitialDB();
  return {
    ...seed,
    ...parsed,
    settings: {
      ...seed.settings,
      ...parsed.settings,
      orgName: ORG_NAME,
      ignoredHolidays: Array.isArray(parsed.settings.ignoredHolidays)
        ? parsed.settings.ignoredHolidays.filter((x) => typeof x === "string")
        : [],
    },
  };
}

function loadDB(): DB {
  purgeLegacyKeys();
  try {
    const raw = localStorage.getItem(DB_KEY);
    if (raw) {
      const parsed: unknown = JSON.parse(raw);
      if (validateDB(parsed)) {
        const sig = localStorage.getItem(SIG_KEY);
        if (sig !== null && sig !== fingerprint(raw)) integrityWarning = true;
        return sanitize(parsed);
      }
    }
  } catch {
    integrityWarning = true;
  }
  return makeInitialDB();
}

const BACKUP_FORMAT = "msh-backup";
const BACKUP_VERSION = 2;
const MAX_IMPORT_CHARS = 25_000_000;

export const backupJSON = (db: DB) =>
  JSON.stringify(
    {
      app: "MSH Microfinance",
      format: BACKUP_FORMAT,
      version: BACKUP_VERSION,
      exportedAt: new Date().toISOString(),
      db,
    },
    null,
    2
  );

const backupBlob = (db: DB) =>
  new Blob(["\uFEFF" + backupJSON(db)], { type: "application/json;charset=utf-8" });

const backupFileName = () => {
  const s = new Date().toISOString().replace("T", "_").replace(/:/g, "").slice(0, 15);
  return `msh-microfinance-backup-${s}.json`;
};

export function downloadBackup(db: DB): boolean {
  try {
    JSON.parse(backupJSON(db).replace(/^\uFEFF/, ""));
    const url = URL.createObjectURL(backupBlob(db));
    const a = document.createElement("a");
    a.href = url;
    a.download = backupFileName();
    a.rel = "noopener";
    document.body.appendChild(a);
    a.click();
    a.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 2500);
    return true;
  } catch {
    return false;
  }
}

export function extractDB(raw: string): { db: DB | null; error: string | null } {
  const text = raw.replace(/^\uFEFF/, "").trim();
  if (!text) return { db: null, error: "ឯកសារទទេ" };
  if (text.length > MAX_IMPORT_CHARS) return { db: null, error: "ឯកសារធំពេក (លើសពី 25MB)" };
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    return { db: null, error: "ឯកសារមិនមែនជាទម្រង់ JSON ត្រឹមត្រូវ" };
  }
  let candidate: unknown = parsed;
  if (parsed && typeof parsed === "object" && "db" in (parsed as Record<string, unknown>)) {
    const env = parsed as { format?: unknown; db?: unknown };
    if (env.format !== BACKUP_FORMAT) {
      return { db: null, error: "ទម្រង់ឯកសារ Backup មិនត្រូវគ្នា (រំពឹង msh-backup)" };
    }
    candidate = env.db;
  }
  if (!validateDB(candidate)) {
    return { db: null, error: "រចនាសម្ព័ន្ធទិន្នន័យមិនត្រឹមត្រូវ (loans / payments / settings)" };
  }
  return { db: candidate, error: null };
}

type NavShare = Navigator & {
  canShare?: (d: { files: File[] }) => boolean;
  share?: (d: { files: File[]; title: string }) => Promise<void>;
};

export function canShareFiles(): boolean {
  try {
    const nav = navigator as NavShare;
    return (
      typeof nav.canShare === "function" &&
      typeof nav.share === "function" &&
      nav.canShare({ files: [new File(["{}"], "probe.json", { type: "application/json" })] })
    );
  } catch {
    return false;
  }
}

export async function shareBackup(db: DB): Promise<"shared" | "cancelled" | "unsupported"> {
  try {
    const file = new File([backupBlob(db)], backupFileName(), { type: "application/json" });
    const nav = navigator as NavShare;
    if (
      typeof nav.canShare !== "function" ||
      typeof nav.share !== "function" ||
      !nav.canShare({ files: [file] })
    ) {
      return "unsupported";
    }
    await nav.share({ files: [file], title: "MSH Microfinance Backup" });
    return "shared";
  } catch {
    return "cancelled";
  }
}

export function AppProvider({ children }: { children: ReactNode }) {
  const [db, setDb] = useState<DB>(loadDB);
  const [view, setView] = useState<View>({ name: "dashboard" });
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [syncing, setSyncing] = useState(false);
  const [pendingImport, setPendingImport] = useState<PendingImport | null>(null);
  const [queue, setQueue] = useState<SyncEvent[]>(loadQueue);
  const toastId = useRef(0);

  useEffect(() => {
    if (consumeIntegrityWarning()) {
      toast("ទិន្នន័យត្រូវបានផ្ទៀងផ្ទាត់ឡើងវិញ", "info");
    }
  }, []);

  const dismissToast = useCallback((id: number) => {
    setToasts((t) => t.filter((x) => x.id !== id));
  }, []);

  const toast = useCallback(
    (msg: string, kind: Toast["kind"] = "success") => {
      const id = ++toastId.current;
      setToasts((t) => [...t.slice(-3), { id, msg, kind }]);
      window.setTimeout(() => dismissToast(id), 4200);
    },
    [dismissToast]
  );

  const quotaWarned = useRef(false);
  useEffect(() => {
    try {
      const json = JSON.stringify(db);
      localStorage.setItem(DB_KEY, json);
      localStorage.setItem(SIG_KEY, fingerprint(json));
      quotaWarned.current = false;
    } catch {
      if (!quotaWarned.current) {
        quotaWarned.current = true;
        toast("អង្គចងចាំ Browser ពេញ! សូមទាញយកឯកសារ Backup រក្សាទុក", "error");
      }
    }
  }, [db, toast]);

  const go = useCallback((v: View) => {
    setView(v);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, []);

  const enqueue = useCallback((loan: Loan, status: string, amount?: number, date?: string) => {
    const row: SyncEvent["row"] = {
      "កូដកម្ចី": loan.code,
      "ឈ្មោះអតិថិជន": loan.customer,
      "លេខទូរស័ព្ទ": loan.phone,
      "ចំនួនប្រាក់": amount ?? loan.principal,
      "កាលបរិច្ឆេទ": date ?? todayISO(),
      "ស្ថានភាព": status,
    };
    setQueue((q) => [...q.slice(-(QUEUE_MAX - 1)), { id: uid(), t: Date.now(), row }]);
  }, []);

  const addLoan = useCallback(
    (l: Omit<Loan, "id" | "code" | "createdAt">): Loan => {
      const loan: Loan = {
        ...l,
        customer: sanitizeText(l.customer, 60),
        phone: sanitizePhone(l.phone),
        note: l.note ? sanitizeText(l.note, 200) : undefined,
        principal: round2(l.principal),
        id: uid(),
        code: "LN-" + String(Date.now()).slice(-6),
        createdAt: todayISO(),
      };
      setDb((d) => ({ ...d, loans: [loan, ...d.loans], seq: d.seq + 1 }));
      enqueue(
        loan,
        `បង្កើតកម្ចីថ្មី (${loan.type === "daily" ? "បង់រាល់ថ្ងៃ" : "បង់ប្រចាំខែ"})`,
        loan.principal,
        loan.startDate
      );
      return loan;
    },
    [enqueue]
  );

  const recordPayment = useCallback(
    (loanId: string, inst: number, amount: number): Payment | null => {
      if (
        typeof loanId !== "string" ||
        loanId.length === 0 ||
        !Number.isInteger(inst) ||
        inst < 0 ||
        inst >= 1000 ||
        !Number.isFinite(amount) ||
        amount <= 0 ||
        amount > 1e12
      ) {
        toast("ទិន្នន័យមិនត្រឹមត្រូវ", "error");
        return null;
      }
      const p: Payment = { id: uid(), loanId, inst, date: todayISO(), amount: round2(amount) };
      setDb((d) => ({ ...d, payments: [...d.payments, p] }));
      const loan = db.loans.find((l) => l.id === loanId);
      if (loan) enqueue(loan, `បង់លើកទី ${inst + 1}/${loan.term}`, round2(amount), p.date);
      return p;
    },
    [toast, db.loans, enqueue]
  );

  const recordSmartPayment = useCallback(
    (loanId: string, amount: number): PayResult | null => {
      const loan = db.loans.find((l) => l.id === loanId);
      if (!loan) return null;
      if (!Number.isFinite(amount) || amount <= 0) {
        toast("ចំនួនទឹកប្រាក់មិនត្រឹមត្រូវ", "error");
        return null;
      }
      const st = loanStats(loan, db.payments, db.settings);
      if (st.remaining <= 0.005) {
        toast("កម្ចីនេះបានបង់ដាច់រួចហើយ", "info");
        return null;
      }
      const plan = allocatePreview(st, amount);
      if (!plan || plan.rows.length === 0) return null;
      const pays: Payment[] = plan.rows.map((r) => ({
        id: uid(),
        loanId,
        inst: r.i,
        date: todayISO(),
        amount: r.pay,
      }));
      setDb((d) => ({ ...d, payments: [...d.payments, ...pays] }));
      pays.forEach((p) => enqueue(loan, `បង់លើកទី ${p.inst + 1}/${loan.term}`, p.amount, p.date));
      return {
        payments: pays,
        total: plan.total,
        cleared: plan.cleared,
        leftover: plan.capped ? round2(amount - st.remaining) : 0,
      };
    },
    [db.loans, db.payments, db.settings, toast, enqueue]
  );

  const payUpToDate = useCallback(
    (loanId: string, targetISO: string): PayResult | null => {
      const loan = db.loans.find((l) => l.id === loanId);
      if (!loan) return null;
      if (!isISODate(targetISO)) {
        toast("កាលបរិច្ឆេទមិនត្រឹមត្រូវ", "error");
        return null;
      }
      const plan = planPayUpToDate(loan, db.payments, db.settings, targetISO);
      if (!plan || plan.rows.length === 0) {
        toast("គ្មានការបង់ប្រាក់ដែលត្រូវកត់ត្រាទេ", "info");
        return null;
      }
      const pays: Payment[] = plan.rows.map((r) => ({
        id: uid(),
        loanId,
        inst: r.i,
        date: todayISO(),
        amount: r.pay,
      }));
      setDb((d) => ({ ...d, payments: [...d.payments, ...pays] }));
      pays.forEach((p) => enqueue(loan, `បង់លើកទី ${p.inst + 1}/${loan.term}`, p.amount, p.date));
      const total = round2(pays.reduce((a, b) => a + b.amount, 0));
      return { payments: pays, total, cleared: pays.length, leftover: 0 };
    },
    [db.loans, db.payments, db.settings, toast, enqueue]
  );

  const payUpToIndex = useCallback(
    (loanId: string, targetIdx: number): PayResult | null => {
      const loan = db.loans.find((l) => l.id === loanId);
      if (!loan) return null;
      const plan = planPayUpToIndex(loan, db.payments, db.settings, targetIdx);
      if (!plan || plan.rows.length === 0) {
        toast("គ្មានការបង់ប្រាក់ដែលត្រូវកត់ត្រាទេ", "info");
        return null;
      }
      const pays: Payment[] = plan.rows.map((r) => ({
        id: uid(),
        loanId,
        inst: r.i,
        date: todayISO(),
        amount: r.pay,
      }));
      setDb((d) => ({ ...d, payments: [...d.payments, ...pays] }));
      pays.forEach((p) => enqueue(loan, `បង់លើកទី ${p.inst + 1}/${loan.term}`, p.amount, p.date));
      const total = round2(pays.reduce((a, b) => a + b.amount, 0));
      return { payments: pays, total, cleared: pays.length, leftover: 0 };
    },
    [db.loans, db.payments, db.settings, toast, enqueue]
  );

  const paySelected = useCallback(
    (loanId: string, instIndexes: number[]): PayResult | null => {
      const loan = db.loans.find((l) => l.id === loanId);
      if (!loan) return null;
      const st = loanStats(loan, db.payments, db.settings);
      const want = new Set(instIndexes);
      const plan = planSettlement(st, (i) => want.has(i.i));
      if (plan.rows.length === 0) {
        toast("គ្មានការបង់ប្រាក់ដែលត្រូវកត់ត្រាទេ", "info");
        return null;
      }
      const pays: Payment[] = plan.rows.map((r) => ({
        id: uid(),
        loanId,
        inst: r.i,
        date: todayISO(),
        amount: r.pay,
      }));
      setDb((d) => ({ ...d, payments: [...d.payments, ...pays] }));
      pays.forEach((p) => enqueue(loan, `បង់លើកទី ${p.inst + 1}/${loan.term}`, p.amount, p.date));
      const total = round2(pays.reduce((a, b) => a + b.amount, 0));
      return { payments: pays, total, cleared: pays.length, leftover: 0 };
    },
    [db.loans, db.payments, db.settings, toast, enqueue]
  );

  const deleteLoan = useCallback(
    (id: string) => {
      const loan = db.loans.find((l) => l.id === id);
      setDb((d) => ({
        ...d,
        loans: d.loans.filter((l) => l.id !== id),
        payments: d.payments.filter((p) => p.loanId !== id),
      }));
      if (loan) enqueue(loan, "លុបកម្ចី", 0);
    },
    [db.loans, enqueue]
  );

  const updateSettings = useCallback((p: Partial<Settings>) => {
    setDb((d) => ({ ...d, settings: { ...d.settings, ...p } }));
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem(QUEUE_KEY, JSON.stringify(queue));
    } catch {
      /* ignore */
    }
  }, [queue]);

  const flushQueue = useCallback(async () => {
    const url = db.settings.sheetUrl.trim();
    if (syncing) return;
    if (!url) {
      toast("សូមបញ្ចូល Google Apps Script Web App URL នៅក្នុង Settings ជាមុនសិន", "error");
      return;
    }
    if (!isValidSheetUrl(url)) {
      toast("URL ត្រូវតែចាប់ផ្តើមដោយ https://", "error");
      return;
    }
    if (queue.length === 0) {
      toast("គ្មានទិន្នន័យថ្មីត្រូវ Sync ទេ", "info");
      return;
    }
    if (typeof navigator !== "undefined" && !navigator.onLine) {
      toast("កំពុងស្ថិតក្នុង Offline! នឹង Sync ពេលមានអ៊ីនធឺណិតឡើងវិញ", "info");
      return;
    }

    setSyncing(true);
    const batch = queue;
    try {
      await fetch(url, {
        method: "POST",
        mode: "no-cors",
        headers: { "Content-Type": "text/plain;charset=utf-8" },
        body: JSON.stringify({
          action: "appendRows",
          headers: [...SHEET_HEADERS],
          rows: batch.map((e) => e.row),
          exportedAt: new Date().toISOString(),
        }),
      });
      setQueue((q) => q.filter((e) => !batch.some((b) => b.id === e.id)));
      updateSettings({ lastSync: new Date().toISOString() });
      toast(`បាន Sync ${batch.length} កំណត់ត្រាទៅ Google Sheets ដោយជោគជ័យ!`);
    } catch {
      toast("Sync បរាជ័យ (ពិនិត្យការតភ្ជាប់អ៊ីនធឺណិត)", "error");
    } finally {
      setSyncing(false);
    }
  }, [db.settings.sheetUrl, queue, syncing, toast, updateSettings]);

  useEffect(() => {
    if (queue.length > 0 && db.settings.sheetUrl.trim() && navigator.onLine) {
      void flushQueue();
    }
  }, [queue.length, db.settings.sheetUrl, flushQueue]);

  useEffect(() => {
    const onOnline = () => {
      if (queue.length > 0) void flushQueue();
    };
    window.addEventListener("online", onOnline);
    return () => window.removeEventListener("online", onOnline);
  }, [flushQueue, queue.length]);

  const requestImport = useCallback(
    (json: string, fileName?: string): boolean => {
      const { db: parsed, error } = extractDB(json);
      if (!parsed) {
        toast(`ការនាំចូលបរាជ័យ: ${error}`, "error");
        return false;
      }
      setPendingImport({ db: parsed, fileName });
      return true;
    },
    [toast]
  );

  const confirmImport = useCallback(() => {
    setPendingImport((p) => {
      if (!p) return null;
      const clean = sanitize(p.db);
      setDb(clean);
      toast(`បានស្តារឡើងវិញនូវ ${clean.loans.length} កម្ចី និង ${clean.payments.length} ការបង់ប្រាក់!`);
      return null;
    });
  }, [toast]);

  const cancelImport = useCallback(() => setPendingImport(null), []);

  const resetDB = useCallback(() => {
    setDb(makeInitialDB());
    toast("បានកំណត់ទិន្នន័យឡើងវិញ", "info");
  }, [toast]);

  const syncNow = useCallback(
    async (urlOverride?: string) => {
      const url = (urlOverride ?? db.settings.sheetUrl).trim();
      if (!url) {
        toast("សូមបញ្ចូល Google Apps Script Web App URL នៅក្នុង Settings", "error");
        go({ name: "settings" });
        return;
      }
      if (!isValidSheetUrl(url)) {
        toast("URL ត្រូវតែចាប់ផ្តើមដោយ https:// និងមកពី script.google.com", "error");
        return;
      }
      setSyncing(true);
      try {
        await fetch(url, {
          method: "POST",
          mode: "no-cors",
          headers: { "Content-Type": "text/plain;charset=utf-8" },
          body: JSON.stringify({ exportedAt: new Date().toISOString(), ...db }),
        });
        updateSettings({ lastSync: new Date().toISOString() });
        toast("បានបញ្ជូនទិន្នន័យ Sync ទៅ Google Sheets រួចរាល់!");
      } catch {
        toast("Sync បរាជ័យ សូមពិនិត្យ URL និងសិទ្ធិ Deploy ក្នុង Google Apps Script", "error");
      } finally {
        setSyncing(false);
      }
    },
    [db, go, toast, updateSettings]
  );

  const value = useMemo<AppCtx>(
    () => ({
      db,
      view,
      go,
      toast,
      addLoan,
      recordPayment,
      recordSmartPayment,
      payUpToDate,
      payUpToIndex,
      paySelected,
      deleteLoan,
      updateSettings,
      requestImport,
      confirmImport,
      cancelImport,
      pendingImport,
      resetDB,
      syncNow,
      flushQueue,
      queue,
      syncing,
    }),
    [
      db,
      view,
      go,
      toast,
      addLoan,
      recordPayment,
      recordSmartPayment,
      payUpToDate,
      payUpToIndex,
      paySelected,
      deleteLoan,
      updateSettings,
      requestImport,
      confirmImport,
      cancelImport,
      pendingImport,
      resetDB,
      syncNow,
      flushQueue,
      queue,
      syncing,
    ]
  );

  const toastValue = useMemo(() => ({ toasts, dismissToast }), [toasts, dismissToast]);

  return (
    <Ctx.Provider value={value}>
      <ToastCtx.Provider value={toastValue}>{children}</ToastCtx.Provider>
    </Ctx.Provider>
  );
}

export function useApp(): AppCtx {
  const v = useContext(Ctx);
  if (!v) throw new Error("useApp must be used inside AppProvider");
  return v;
}

export function useToasts() {
  const v = useContext(ToastCtx);
  if (!v) throw new Error("useToasts must be used inside AppProvider");
  return v;
}
