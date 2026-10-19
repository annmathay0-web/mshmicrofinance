/* ============================================================
   Khmer Lunar Calendar & Long-Term Cambodian Holiday Engine (Up to 2045+)
   - Powered by momentkh Chhankitek astronomy
   - Converts any Gregorian date to Khmer lunar date (
     lunar month, animal year, sak, Buddhist Era).
   - Computes movable & fixed Cambodian public holidays across all years
     (2020 to 2045+), including overlapping holidays (
     * មាឃបូជា (Meak Bochea - 15th Waxing of Meak)
     * ពិធីបុណ្យចូលឆ្នាំថ្មីប្រពៃណីជាតិ (Khmer New Year - Maha Songkran, Vanabat, Lerng Sak)
     * វិសាខបូជា (Visak Bochea - 15th Waxing of Pisakh)
     * ព្រះរាជពិធីច្រត់ព្រះនង្គ័ល (Royal Ploughing Ceremony - 4th Waning of Pisakh)
     * ពិធីបុណ្យភ្ជុំបិណ្ឌ (Pchum Ben - 14th & 15th Waning of Phatrabot + 1st Waxing of Assoch)
     * ព្រះរាជពិធីបុណ្យអុំទូក (Water Festival - 14th & 15th Waxing + 1st Waning of Kadeuk)
     * All Fixed Royal & National Public Holidays
   ============================================================ */

import { fromDate, getNewYearFullInfo, MoonPhase, MonthIndex } from "./momentkh";
import type { KhmerDateInfo } from "./momentkh";

function isoOf(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function addDaysLocal(d: Date, n: number): Date {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x;
}

function parseISO(s: string): Date {
  const [y, m, d] = s.split("-").map(Number);
  return new Date(y, m - 1, d);
}

const KH_DIGITS = "០១២៣៤៥៦៧៨៩";
export const toKhmerDigits = (n: number | string) =>
  String(n).replace(/\d/g, (c) => KH_DIGITS[+c] ?? c);

const lunarCache = new Map<string, KhmerDateInfo>();

export function khmerOf(iso: string): KhmerDateInfo {
  const hit = lunarCache.get(iso);
  if (hit) return hit;
  const k = fromDate(parseISO(iso)).khmer;
  lunarCache.set(iso, k);
  return k;
}

/** Full official Khmer lunar date string */
export function fmtLunar(iso: string): string {
  const k = khmerOf(iso);
  return `ថ្ងៃ${k.dayOfWeekName} ${toKhmerDigits(k.day)}${k.moonPhaseName} ខែ${k.monthName} ឆ្នាំ${k.animalYearName} ${k.sakName} ព.ស.${toKhmerDigits(k.beYear)}`;
}

/** Compact label for table rows & chips */
export function fmtLunarShort(iso: string): string {
  const k = khmerOf(iso);
  return `${toKhmerDigits(k.day)}${k.moonPhaseName} ខែ${k.monthName}`;
}

/** Fixed Gregorian National Public Holidays in Cambodia: [monthIndex0, day, name] */
const FIXED_HOLIDAYS: [number, number, string][] = [
  [0, 1, "ទិវាចូលឆ្នាំសកល (International New Year)"],
  [0, 7, "ទិវាជ័យជម្នះលើរបបប្រល័យពូជសាសន៍ (Victory over Genocide Day)"],
  [2, 8, "ទិវាអន្តរជាតិនារី (International Women's Day)"],
  [4, 1, "ទិវាពលកម្មអន្តរជាតិ (International Labour Day)"],
  [4, 14, "ព្រះរាជពិធីបុណ្យចម្រើនព្រះជន្ម ព្រះមហាក្សត្រ (King's Birthday)"],
  [5, 18, "ព្រះរាជពិធីបុណ្យចម្រើនព្រះជន្ម សម្តេចព្រះមហាក្សត្រី ព្រះវររាជមាតាជាតិ"],
  [8, 24, "ទិវាប្រកាសរដ្ឋធម្មនុញ្ញ (Constitution Day)"],
  [9, 15, "ទិវារំលឹកវិញ្ញាណក្ខន្ធ ព្រះបរមរតនកោដ្ឋ (King Father's Commemoration)"],
  [9, 23, "ទិវាសន្ធិសញ្ញាសន្តិភាពទីក្រុងប៉ារីស"],
  [9, 29, "ព្រះរាជពិធីគ្រងព្រះបរមរាជសម្បត្តិ ព្រះមហាក្សត្រ (King's Coronation Day)"],
  [10, 9, "ពិធីបុណ្យឯករាជ្យជាតិ (National Independence Day)"],
  [11, 29, "ទិវាសន្តិភាពនៅកម្ពុជា (Peace Day in Cambodia)"],
];

/** Merges holiday names when two holidays coincide on the same Gregorian date */
function putHoliday(m: Map<string, string>, iso: string, name: string) {
  const existing = m.get(iso);
  if (!existing) {
    m.set(iso, name);
    return;
  }
  if (existing.includes(name)) return;
  m.set(iso, `${existing} & ${name} (បុណ្យត្រួត)`);
}

const holidayCache = new Map<number, Map<string, string>>();

export function builtinHolidayMap(year: number): Map<string, string> {
  const hit = holidayCache.get(year);
  if (hit) return hit;
  const m = new Map<string, string>();

  // 1. Fixed Solar National Holidays
  for (const [mo, da, name] of FIXED_HOLIDAYS) {
    putHoliday(m, isoOf(new Date(year, mo, da)), name);
  }

  // 2. Scan all days of the Gregorian year for Chhankitek Lunar Holidays
  const facts: { iso: string; k: KhmerDateInfo }[] = [];
  const d = new Date(year, 0, 1);
  while (d.getFullYear() === year) {
    const iso = isoOf(d);
    const k = fromDate(d).khmer;
    facts.push({ iso, k });

    // មាឃបូជា (Meak Bochea): 15th Waxing of Meak
    if (k.monthIndex === MonthIndex.Meak && k.moonPhase === MoonPhase.Waxing && k.day === 15) {
      putHoliday(m, iso, "ពិធីបុណ្យមាឃបូជា (Meak Bochea)");
    }
    // វិសាខបូជា (Visak Bochea): 15th Waxing of Pisakh
    if (k.monthIndex === MonthIndex.Pisakh && k.moonPhase === MoonPhase.Waxing && k.day === 15) {
      putHoliday(m, iso, "ពិធីបុណ្យវិសាខបូជា (Visak Bochea)");
    }
    // ច្រត់ព្រះនង្គ័ល (Royal Ploughing Ceremony): 4th Waning of Pisakh
    if (k.monthIndex === MonthIndex.Pisakh && k.moonPhase === MoonPhase.Waning && k.day === 4) {
      putHoliday(m, iso, "ព្រះរាជពិធីច្រត់ព្រះនង្គ័ល (Royal Ploughing Ceremony)");
    }
    // ពិធីបុណ្យអុំទូក (Water Festival - 3 Days): 14th, 15th Waxing & 1st Waning of Kadeuk
    if (k.monthIndex === MonthIndex.Kadeuk) {
      if (k.moonPhase === MoonPhase.Waxing && k.day === 14) {
        putHoliday(m, iso, "ព្រះរាជពិធីបុណ្យអុំទូក បណ្តែតប្រទីប (ថ្ងៃទី១)");
      } else if (k.moonPhase === MoonPhase.Waxing && k.day === 15) {
        putHoliday(m, iso, "ព្រះរាជពិធីបុណ្យអុំទូក សំពះព្រះខែ (ថ្ងៃទី២)");
      } else if (k.moonPhase === MoonPhase.Waning && k.day === 1) {
        putHoliday(m, iso, "ព្រះរាជពិធីបុណ្យអុំទូក អកអំបុក (ថ្ងៃទី៣)");
      }
    }
    d.setDate(d.getDate() + 1);
  }

  // 3. ភ្ជុំបិណ្ឌ (Pchum Ben - 3 Days):
  // Last 2 Waning days of Phatrabot (ភទ្របទ) + 1st Waxing day of Assoch (អស្សុជ)
  const longWaningPhatrabot = new Set<number>();
  for (const f of facts) {
    if (
      f.k.monthIndex === MonthIndex.Phatrabot &&
      f.k.moonPhase === MoonPhase.Waning &&
      f.k.day === 15
    ) {
      longWaningPhatrabot.add(f.k.beYear);
    }
  }

  for (const f of facts) {
    const k = f.k;
    if (k.monthIndex === MonthIndex.Phatrabot && k.moonPhase === MoonPhase.Waning) {
      const has15 = longWaningPhatrabot.has(k.beYear);
      const day1 = has15 ? 14 : 13;
      const day2 = has15 ? 15 : 14;
      if (k.day === day1) {
        putHoliday(m, f.iso, "ពិធីបុណ្យភ្ជុំបិណ្ឌ (ថ្ងៃទី១)");
      } else if (k.day === day2) {
        putHoliday(m, f.iso, "ពិធីបុណ្យភ្ជុំបិណ្ឌ (ថ្ងៃទី២)");
      }
    } else if (
      k.monthIndex === MonthIndex.Assoch &&
      k.moonPhase === MoonPhase.Waxing &&
      k.day === 1
    ) {
      putHoliday(m, f.iso, "ពិធីបុណ្យភ្ជុំបិណ្ឌ (ថ្ងៃភ្ជុំធំ)");
    }
  }

  // 4. ពិធីបុណ្យចូលឆ្នាំថ្មីប្រពៃណីជាតិ (Khmer New Year - Maha Songkran, Vanabat, Lerng Sak)
  try {
    const fullNy = getNewYearFullInfo(year);
    const ny = fullNy.newYearInfo;
    if (ny && ny.year === year && ny.month >= 1 && ny.month <= 12 && ny.day >= 1) {
      const start = new Date(ny.year, ny.month - 1, ny.day);
      const end = fullNy.lerngSakMoment;
      const spanDays = Math.max(
        3,
        Math.min(4, Math.round((end.getTime() - new Date(ny.year, ny.month - 1, ny.day).getTime()) / 86_400_000) + 1)
      );
      for (let i = 0; i < spanDays; i++) {
        const label =
          i === 0
            ? "ពិធីបុណ្យចូលឆ្នាំថ្មី (មហាសង្ក្រាន្ត)"
            : i === spanDays - 1
              ? `ពិធីបុណ្យចូលឆ្នាំថ្មី (ថ្ងៃទី${toKhmerDigits(i + 1)} - ឡើងស័ក)`
              : `ពិធីបុណ្យចូលឆ្នាំថ្មី (ថ្ងៃទី${toKhmerDigits(i + 1)} - វារៈវនបត)`;
        putHoliday(m, isoOf(addDaysLocal(start, i)), label);
      }
    } else {
      for (let i = 14; i <= 16; i++) {
        putHoliday(
          m,
          isoOf(new Date(year, 3, i)),
          `ពិធីបុណ្យចូលឆ្នាំថ្មី (ថ្ងៃទី${toKhmerDigits(i - 13)})`
        );
      }
    }
  } catch {
    for (let i = 14; i <= 16; i++) {
      putHoliday(
        m,
        isoOf(new Date(year, 3, i)),
        `ពិធីបុណ្យចូលឆ្នាំថ្មី (ថ្ងៃទី${toKhmerDigits(i - 13)})`
      );
    }
  }

  holidayCache.set(year, m);
  return m;
}

export function builtinHolidayName(iso: string): string | null {
  return builtinHolidayMap(Number(iso.slice(0, 4))).get(iso) ?? null;
}

export function isBuiltinHoliday(iso: string): boolean {
  return builtinHolidayMap(Number(iso.slice(0, 4))).has(iso);
}

type HolidaySettings = {
  holidays: { date: string; name: string }[];
  ignoredHolidays?: string[];
};

export function mergedHolidayMap(settings: HolidaySettings, years: number[]): Map<string, string> {
  const m = new Map<string, string>();
  const ignored = new Set(settings.ignoredHolidays ?? []);
  for (const y of years) {
    builtinHolidayMap(y).forEach((name, iso) => {
      if (!ignored.has(iso)) m.set(iso, name);
    });
  }
  for (const h of settings.holidays) {
    putHoliday(m, h.date, h.name);
  }
  return m;
}

export function holidayName(iso: string, settings?: HolidaySettings): string | null {
  const user = settings?.holidays.find((h) => h.date === iso);
  const ignored = (settings?.ignoredHolidays ?? []).includes(iso);
  const builtin = ignored ? null : builtinHolidayName(iso);
  if (user && builtin && !builtin.includes(user.name)) {
    return `${builtin} & ${user.name}`;
  }
  return user?.name ?? builtin;
}

export function builtinHolidaysOfYear(year: number): { date: string; name: string }[] {
  return Array.from(builtinHolidayMap(year).entries())
    .map(([date, name]) => ({ date, name }))
    .sort((a, b) => a.date.localeCompare(b.date));
}

export function nextHoliday(
  fromIso: string,
  settings?: { holidays: { date: string; name: string }[]; ignoredHolidays?: string[] }
): { date: string; name: string } | null {
  const baseYear = Number(fromIso.slice(0, 4));
  const years = [baseYear, baseYear + 1, baseYear + 2];
  const merged = mergedHolidayMap(
    { holidays: settings?.holidays ?? [], ignoredHolidays: settings?.ignoredHolidays ?? [] },
    years
  );
  let best: { date: string; name: string } | null = null;
  merged.forEach((name, date) => {
    if (date >= fromIso && (!best || date < best.date)) best = { date, name };
  });
  return best;
}
