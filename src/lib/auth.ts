/* ============================================================
   Authentication & session layer.
   ============================================================ */

export interface SessionUser {
  username: string;
  displayName: string;
  role: string;
}

export interface Session {
  token: string;
  user: SessionUser;
  issuedAt: number;
  expiresAt: number;
}

const SALT = "LoanProKH::v1";
const SESSION_KEY = "msh_session_v3";
const LOCK_KEY = "msh_lock_v1";
const MAX_ATTEMPTS = 5;
const LOCK_MS = 30_000;
const REMEMBER_TTL = 30 * 86_400_000; // 30 days
const SHORT_TTL = 86_400_000; // 24h

export const ACCOUNTS: { username: string; passHash: string; displayName: string; role: string }[] = [
  {
    username: "superadmin1",
    // SHA-256("LoanProKH::v1|19012026")
    passHash: "fedde7802e139756522fb798f5605f245b8b1abe0a9ef5d843b4d1530a2e83ac",
    displayName: "Super Admin",
    role: "Super Admin",
  },
  {
    username: "senghongdmin",
    // SHA-256("LoanProKH::v1|012720094")
    passHash: "555bb83e8aa3a95dcd28e39bc1291bf56ec9367ed8cfc4d1f04c5ed99d099831",
    displayName: "សេងហុង Admin",
    role: "Admin",
  },
  {
    username: "annmathay",
    // SHA-256("LoanProKH::v1|0969192270")
    passHash: "bf4dc4be7696c72f051239f1b2ec0f5df8aa499a362b51b213e97aad282c5000",
    displayName: "អាន ម៉ាថាយ Admin",
    role: "Admin",
  },
];

const DUMMY_HASH = "0".repeat(64);

/* ---------------- hashing ---------------- */

export async function hashSecret(secret: string): Promise<string> {
  if (!crypto?.subtle) {
    // Fallback for non-subtle contexts
    let hash = 0;
    for (let i = 0; i < secret.length; i++) {
      hash = (hash << 5) - hash + secret.charCodeAt(i);
      hash |= 0;
    }
    return Math.abs(hash).toString(16).padStart(64, "0");
  }
  const data = new TextEncoder().encode(`${SALT}|${secret}`);
  const buf = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let r = 0;
  for (let i = 0; i < a.length; i++) r |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return r === 0;
}

const delay = (ms: number) => new Promise<void>((res) => setTimeout(res, ms));

const KH_DIGITS: Record<string, string> = {
  "០": "0", "១": "1", "២": "2", "៣": "3", "៤": "4",
  "៥": "5", "៦": "6", "៧": "7", "៨": "8", "៩": "9",
};

function toAsciiClean(s: string): string {
  return s
    .replace(/[០-៩]/g, (d) => KH_DIGITS[d] ?? d)
    .replace(/[\u200B-\u200D\uFEFF\u00A0]/g, "");
}

export function normalizeUsername(raw: string): string {
  return toAsciiClean(raw).replace(/\s+/g, "").toLowerCase().slice(0, 40);
}

export function normalizePassword(raw: string): string {
  return toAsciiClean(raw).replace(/[ \t]{2,}/g, " ").trim().slice(0, 72);
}

export async function verifyCredentials(
  usernameRaw: string,
  passwordRaw: string
): Promise<SessionUser | null> {
  const username = normalizeUsername(usernameRaw);
  let hash: string;
  try {
    hash = await hashSecret(normalizePassword(passwordRaw));
  } catch {
    return null;
  }

  await delay(200);
  let found: SessionUser | null = null;
  for (const acc of ACCOUNTS) {
    const userOk = safeEqual(acc.username, username);
    const passOk = safeEqual(acc.passHash, userOk ? hash : DUMMY_HASH);
    if (userOk && passOk) {
      found = { username: acc.username, displayName: acc.displayName, role: acc.role };
    }
  }
  return found;
}

interface LockInfo {
  count: number;
  until: number;
}

function readLock(): LockInfo {
  try {
    const raw = sessionStorage.getItem(LOCK_KEY);
    if (raw) return JSON.parse(raw) as LockInfo;
  } catch {
    /* ignore */
  }
  return { count: 0, until: 0 };
}

export function getLockRemaining(): number {
  const l = readLock();
  if (l.until > Date.now()) return l.until - Date.now();
  if (l.until > 0) sessionStorage.removeItem(LOCK_KEY);
  return 0;
}

export function registerFailedAttempt(): { locked: boolean; remainingMs: number; attemptsLeft: number } {
  const now = Date.now();
  const l = readLock();
  if (l.until > now) return { locked: true, remainingMs: l.until - now, attemptsLeft: 0 };
  const count = l.count + 1;
  if (count >= MAX_ATTEMPTS) {
    sessionStorage.setItem(LOCK_KEY, JSON.stringify({ count: 0, until: now + LOCK_MS }));
    return { locked: true, remainingMs: LOCK_MS, attemptsLeft: 0 };
  }
  sessionStorage.setItem(LOCK_KEY, JSON.stringify({ count, until: 0 }));
  return { locked: false, remainingMs: 0, attemptsLeft: MAX_ATTEMPTS - count };
}

export function resetFailedAttempts() {
  sessionStorage.removeItem(LOCK_KEY);
}

function makeToken(): string {
  const arr = new Uint8Array(24);
  if (crypto && crypto.getRandomValues) {
    crypto.getRandomValues(arr);
  } else {
    for (let i = 0; i < 24; i++) arr[i] = Math.floor(Math.random() * 256);
  }
  const hex = Array.from(arr)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
  return "msh." + hex;
}

export function createSession(user: SessionUser, remember = true): Session {
  const now = Date.now();
  const session: Session = {
    token: makeToken(),
    user,
    issuedAt: now,
    expiresAt: now + (remember ? REMEMBER_TTL : SHORT_TTL),
  };
  const primary = remember ? localStorage : sessionStorage;
  primary.setItem(SESSION_KEY, JSON.stringify(session));
  return session;
}

const TOKEN_RE = /^[a-z0-9.-]{10,120}$/i;

export function getSession(): Session | null {
  for (const store of [localStorage, sessionStorage]) {
    const raw = store.getItem(SESSION_KEY);
    if (!raw) continue;
    try {
      const s = JSON.parse(raw) as Session;
      const valid =
        !!s &&
        typeof s.token === "string" &&
        TOKEN_RE.test(s.token) &&
        !!s.user &&
        typeof s.user.username === "string" &&
        Number.isFinite(s.issuedAt) &&
        Number.isFinite(s.expiresAt);
      if (!valid || s.expiresAt < Date.now()) {
        store.removeItem(SESSION_KEY);
        continue;
      }
      return s;
    } catch {
      store.removeItem(SESSION_KEY);
    }
  }
  return null;
}

export function destroySession() {
  sessionStorage.removeItem(SESSION_KEY);
  localStorage.removeItem(SESSION_KEY);
  sessionStorage.removeItem("msh_session_v2");
  localStorage.removeItem("msh_session_v2");
  sessionStorage.removeItem(LOCK_KEY);
}
