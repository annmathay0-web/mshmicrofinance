// @ts-nocheck - third-party library (momentkh, MIT)
/**
 * MomentKH - Standalone Khmer Calendar Library (TypeScript)
 * A simplified, standalone library for Khmer calendar conversion
 * No external dependencies required
 * @version 2.0.0
 * @license MIT
 */

export enum MoonPhase {
  Waxing = 0, // កើត
  Waning = 1, // រោច
}

export enum MonthIndex {
  Migasir = 0, // មិគសិរ
  Boss = 1, // បុស្ស
  Meak = 2, // មាឃ
  Phalkun = 3, // ផល្គុន
  Cheit = 4, // ចេត្រ
  Pisakh = 5, // ពិសាខ
  Jesth = 6, // ជេស្ឋ
  Asadh = 7, // អាសាឍ
  Srap = 8, // ស្រាពណ៍
  Phatrabot = 9, // ភទ្របទ
  Assoch = 10, // អស្សុជ
  Kadeuk = 11, // កត្តិក
  Pathamasadh = 12, // បឋមាសាឍ
  Tutiyasadh = 13, // ទុតិយាសាឍ
}

export enum AnimalYear {
  Chhut = 0, // ជូត
  Chlov = 1, // ឆ្លូវ
  Khal = 2, // ខាល
  Thos = 3, // ថោះ
  Rong = 4, // រោង
  Masagn = 5, // ម្សាញ់
  Momee = 6, // មមី
  Momae = 7, // មមែ
  Vok = 8, // វក
  Roka = 9, // រកា
  Cho = 10, // ច
  Kor = 11, // កុរ
}

export enum Sak {
  SamridhiSak = 0, // សំរឹទ្ធិស័ក
  AekSak = 1, // ឯកស័ក
  ToSak = 2, // ទោស័ក
  TreiSak = 3, // ត្រីស័ក
  ChattvaSak = 4, // ចត្វាស័ក
  PanchaSak = 5, // បញ្ចស័ក
  ChhaSak = 6, // ឆស័ក
  SappaSak = 7, // សប្តស័ក
  AtthaSak = 8, // អដ្ឋស័ក
  NappaSak = 9, // នព្វស័ក
}

export enum DayOfWeek {
  Sunday = 0, // អាទិត្យ
  Monday = 1, // ច័ន្ទ
  Tuesday = 2, // អង្គារ
  Wednesday = 3, // ពុធ
  Thursday = 4, // ព្រហស្បតិ៍
  Friday = 5, // សុក្រ
  Saturday = 6, // សៅរ៍
}

export interface GregorianDate {
  year: number;
  month: number;
  day: number;
  hour?: number;
  minute?: number;
  second?: number;
  dayOfWeek?: number;
}

export interface KhmerDateInfo {
  day: number; // 1-15
  moonPhase: MoonPhase;
  moonPhaseName: string; // "កើត" or "រោច"
  monthIndex: MonthIndex;
  monthName: string;
  beYear: number; // Buddhist Era
  jsYear: number; // Jolak Sakaraj
  animalYear: AnimalYear;
  animalYearName: string;
  sak: Sak;
  sakName: string;
  dayOfWeek: DayOfWeek;
  dayOfWeekName: string;
}

export interface KhmerConversionResult {
  gregorian: {
    year: number;
    month: number;
    day: number;
    hour: number;
    minute: number;
    second: number;
    dayOfWeek: number;
  };
  khmer: KhmerDateInfo;
  _khmerDateObj: KhmerDate;
}

export interface NewYearInfo {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
}

export interface TimeInfo {
  hour: number;
  minute: number;
}

export interface SunInfo {
  sunInaugurationAsLibda: number;
  reasey: number;
  angsar: number;
  libda: number;
}

export interface NewYearInfoInternal {
  timeOfNewYear: TimeInfo;
  numberOfVanabatDays: number;
  newYearsDaySotins: SunInfo[];
}

export interface NewYearFullInfo {
  newYearMoment: Date;
  lerngSakMoment: Date;
  newYearInfo: NewYearInfo;
}

export interface MoonDayInfo {
  day: number;
  moonPhase: MoonPhase;
}

const LunarMonths: Record<string, number> = {
  'មិគសិរ': 0, 'បុស្ស': 1, 'មាឃ': 2, 'ផល្គុន': 3,
  'ចេត្រ': 4, 'ពិសាខ': 5, 'ជេស្ឋ': 6, 'អាសាឍ': 7,
  'ស្រាពណ៍': 8, 'ភទ្របទ': 9, 'អស្សុជ': 10, 'កត្តិក': 11,
  'បឋមាសាឍ': 12, 'ទុតិយាសាឍ': 13,
};

const LunarMonthNames: string[] = [
  'មិគសិរ', 'បុស្ស', 'មាឃ', 'ផល្គុន', 'ចេត្រ', 'ពិសាខ',
  'ជេស្ឋ', 'អាសាឍ', 'ស្រាពណ៍', 'ភទ្របទ', 'អស្សុជ', 'កត្តិក',
  'បឋមាសាឍ', 'ទុតិយាសាឍ',
];

const SolarMonthNames: string[] = [
  'មករា', 'កុម្ភៈ', 'មីនា', 'មេសា', 'ឧសភា', 'មិថុនា',
  'កក្កដា', 'សីហា', 'កញ្ញា', 'តុលា', 'វិច្ឆិកា', 'ធ្នូ',
];

const SolarMonthAbbreviationNames: string[] = [
  'មក', 'កុ', 'មី', 'មេ', 'ឧស', 'មិ',
  'កក', 'សី', 'កញ', 'តុ', 'វិ', 'ធ្ន',
];

const LunarMonthAbbreviationNames: string[] = [
  'មិ', 'បុ', 'មា', 'ផល', 'ចេ', 'ពិ',
  'ជេ', 'អា', 'ស្រា', 'ភទ', 'អស្ស', 'កត',
  'ប.អា', 'ទ.អា',
];

const AnimalYearNames: string[] = [
  'ជូត', 'ឆ្លូវ', 'ខាល', 'ថោះ', 'រោង', 'ម្សាញ់',
  'មមី', 'មមែ', 'វក', 'រកា', 'ច', 'កុរ',
];

const AnimalYearEmojis: string[] = [
  '🐀', '🐂', '🐅', '🐇', '🐉', '🐍',
  '🐎', '🐐', '🐒', '🐓', '🐕', '🐖',
];

const SakNames: string[] = [
  'សំរឹទ្ធិស័ក', 'ឯកស័ក', 'ទោស័ក', 'ត្រីស័ក', 'ចត្វាស័ក',
  'បញ្ចស័ក', 'ឆស័ក', 'សប្តស័ក', 'អដ្ឋស័ក', 'នព្វស័ក',
];

const WeekdayNames: string[] = [
  'អាទិត្យ', 'ច័ន្ទ', 'អង្គារ', 'ពុធ', 'ព្រហស្បតិ៍', 'សុក្រ', 'សៅរ៍',
];

const WeekdayNamesShort: string[] = ['អា', 'ច', 'អ', 'ពុ', 'ព្រ', 'សុ', 'ស'];
const MoonPhaseNames: string[] = ['កើត', 'រោច'];
const MoonPhaseShort: string[] = ['ក', 'រ'];

const MoonDaySymbols: string[] = [
  '១កើត', '២កើត', '៣កើត', '៤កើត', '៥កើត', '៦កើត', '៧កើត', '៨កើត',
  '៩កើត', '១០កើត', '១១កើត', '១២កើត', '១៣កើត', '១៤កើត', '១៥កើត',
  '១រោច', '២រោច', '៣រោច', '៤រោច', '៥រោច', '៦រោច', '៧រោច', '៨រោច',
  '៩រោច', '១០រោច', '១១រោច', '១២រោច', '១៣រោច', '១៤រោច', '១៥រោច',
];

const KhmerNumerals: Record<string, string> = {
  '0': '០', '1': '១', '2': '២', '3': '៣', '4': '៤',
  '5': '៥', '6': '៦', '7': '៧', '8': '៨', '9': '៩',
};

const khNewYearMoments: Record<string, string> = {
  '1879': '12-04-1879 11:36',
  '1897': '13-04-1897 02:00',
  '2011': '14-04-2011 13:12',
  '2012': '14-04-2012 19:11',
  '2013': '14-04-2013 02:12',
  '2014': '14-04-2014 08:07',
  '2015': '14-04-2015 14:02',
  '2020': '13-04-2020 20:48',
  '2021': '14-04-2021 04:00',
  '2022': '14-04-2022 10:00',
  '2023': '14-04-2023 16:00',
  '2024': '13-04-2024 22:17',
  '2025': '14-04-2025 04:48',
  '2026': '14-04-2026 09:48',
  '2027': '14-04-2027 16:12',
  '2028': '13-04-2028 22:24',
  '2029': '14-04-2029 04:36',
  '2030': '14-04-2030 10:48',
  '2031': '14-04-2031 17:00',
  '2032': '13-04-2032 23:12',
  '2033': '14-04-2033 05:24',
  '2034': '14-04-2034 11:36',
  '2035': '14-04-2035 17:48',
  '2036': '14-04-2036 00:00',
  '2037': '14-04-2037 06:12',
  '2038': '14-04-2038 12:24',
  '2039': '14-04-2039 18:36',
  '2040': '14-04-2040 00:48',
  '2041': '14-04-2041 07:00',
  '2042': '14-04-2042 13:12',
  '2043': '14-04-2043 19:24',
  '2044': '14-04-2044 01:36',
  '2045': '14-04-2045 07:48',
};

function toKhmerNumeral(num: number | string): string {
  return String(num).replace(/\d/g, (d) => KhmerNumerals[d] ?? d);
}

function isGregorianLeapYear(year: number): boolean {
  return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
}

function getDaysInGregorianMonth(year: number, month: number): number {
  const daysInMonth: number[] = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  if (month === 2 && isGregorianLeapYear(year)) {
    return 29;
  }
  return daysInMonth[month - 1];
}

function gregorianToJulianDay(year: number, month: number, day: number): number {
  const a = Math.floor((14 - month) / 12);
  const y = year + 4800 - a;
  const m = month + 12 * a - 3;
  return (
    day +
    Math.floor((153 * m + 2) / 5) +
    365 * y +
    Math.floor(y / 4) -
    Math.floor(y / 100) +
    Math.floor(y / 400) -
    32045
  );
}

function julianDayToGregorian(jdn: number): { year: number; month: number; day: number } {
  const a = jdn + 32044;
  const b = Math.floor((4 * a + 3) / 146097);
  const c = a - Math.floor((146097 * b) / 4);
  const d = Math.floor((4 * c + 3) / 1461);
  const e = c - Math.floor((1461 * d) / 4);
  const m = Math.floor((5 * e + 2) / 153);
  const day = e - Math.floor((153 * m + 2) / 5) + 1;
  const month = m + 3 - 12 * Math.floor(m / 10);
  const year = 100 * b + d - 4800 + Math.floor(m / 10);
  return { year, month, day };
}

function getDayOfWeek(year: number, month: number, day: number): number {
  const jdn = gregorianToJulianDay(year, month, day);
  return (jdn + 1) % 7;
}

function validateGregorianDate(
  year: number,
  month: number,
  day: number,
  hour: number = 0,
  minute: number = 0,
  second: number = 0
): void {
  if (typeof year !== 'number' || isNaN(year)) throw new Error('Invalid year');
  if (typeof month !== 'number' || isNaN(month) || month < 1 || month > 12) throw new Error('Invalid month');
  const dim = getDaysInGregorianMonth(year, month);
  if (typeof day !== 'number' || isNaN(day) || day < 1 || day > dim) throw new Error('Invalid day');
}

function validateKhmerDate(
  day: number,
  moonPhase: MoonPhase | number,
  monthIndex: MonthIndex | number,
  beYear: number
): void {
  if (day < 1 || day > 15) throw new Error('Lunar day must be between 1 and 15');
}

function validateDateObject(date: Date): void {
  if (!(date instanceof Date) || isNaN(date.getTime())) throw new Error('Invalid Date');
}

function adToJs(adYear: number): number {
  return adYear - 638;
}

function adToBe(adYear: number): number {
  return adYear + 544;
}

function beToAd(beYear: number): number {
  return beYear - 544;
}

function beToJs(beYear: number): number {
  return beYear - 1182;
}

function getAharkun(beYear: number): number {
  return Math.floor((beYear * 292207 + 499) / 800) + 4;
}

function getAharkunMod(beYear: number): number {
  return (beYear * 292207 + 499) % 800;
}

function getKromthupul(beYear: number): number {
  return 800 - getAharkunMod(beYear);
}

function getAvoman(beYear: number): number {
  return (getAharkun(beYear) * 11 + 25) % 692;
}

function getBodithey(beYear: number): number {
  const aharkun = getAharkun(beYear);
  return (Math.floor((aharkun * 11 + 25) / 692) + aharkun + 29) % 30;
}

function isKhmerSolarLeap(beYear: number): boolean {
  return getKromthupul(beYear) <= 207;
}

function isKhmerLeapDayByCalculation(beYear: number): boolean {
  const avoman = getAvoman(beYear);
  const isSolarLeap = isKhmerSolarLeap(beYear);
  if (avoman === 0 && getAvoman(beYear - 1) === 137) {
    return true;
  } else if (isSolarLeap) {
    return avoman < 127;
  } else if (avoman === 137 && getAvoman(beYear + 1) === 0) {
    return false;
  } else if (avoman < 138) {
    return true;
  }
  return false;
}

function isKhmerLeapMonth(beYear: number): boolean {
  const bodithey = getBodithey(beYear);
  const boditheyNextYear = getBodithey(beYear + 1);
  if (bodithey === 25 && boditheyNextYear === 5) {
    return false;
  }
  return (bodithey === 24 && boditheyNextYear === 6) || bodithey >= 25 || bodithey < 6;
}

function getLeapType(beYear: number): number {
  if (isKhmerLeapMonth(beYear)) {
    return 1; // Leap month (អធិកមាស)
  } else if (isKhmerLeapDayByCalculation(beYear)) {
    return 2; // Leap day (ឆស័ក)
  } else if (isKhmerLeapMonth(beYear - 1)) {
    let previousYear = beYear - 1;
    while (true) {
      if (isKhmerLeapDayByCalculation(previousYear)) {
        return 2;
      }
      previousYear -= 1;
      if (!isKhmerLeapMonth(previousYear)) {
        return 0;
      }
    }
  }
  return 0;
}

function getNumberOfDaysInKhmerMonth(monthIndex: MonthIndex | number, beYear: number): number {
  const leapType = getLeapType(beYear);
  const idx = typeof monthIndex === 'number' ? monthIndex : (monthIndex as number);
  if (idx === MonthIndex.Jesth && leapType === 2) {
    return 30;
  }
  if (idx === MonthIndex.Pathamasadh || idx === MonthIndex.Tutiyasadh) {
    return leapType === 1 ? 30 : 0;
  }
  return idx % 2 === 0 ? 29 : 30;
}

function getNumberOfDaysInKhmerYear(beYear: number): number {
  const leapType = getLeapType(beYear);
  if (leapType === 1) return 384;
  if (leapType === 2) return 355;
  return 354;
}

function nextMonthOf(monthIndex: MonthIndex | number, beYear: number): MonthIndex {
  const leapType = getLeapType(beYear);
  const idx = typeof monthIndex === 'number' ? monthIndex : (monthIndex as number);
  if (idx === MonthIndex.Jesth && leapType === 1) {
    return MonthIndex.Pathamasadh;
  }
  if (idx === MonthIndex.Kadeuk) return MonthIndex.Migasir;
  if (idx === MonthIndex.Pathamasadh) return MonthIndex.Tutiyasadh;
  if (idx === MonthIndex.Tutiyasadh) return MonthIndex.Srap;
  return (idx + 1) as MonthIndex;
}

function previousMonthOf(monthIndex: MonthIndex | number, beYear: number): MonthIndex {
  const leapType = getLeapType(beYear);
  const idx = typeof monthIndex === 'number' ? monthIndex : (monthIndex as number);
  if (idx === MonthIndex.Migasir) return MonthIndex.Kadeuk;
  if (idx === MonthIndex.Srap && leapType === 1) return MonthIndex.Tutiyasadh;
  if (idx === MonthIndex.Tutiyasadh) return MonthIndex.Pathamasadh;
  if (idx === MonthIndex.Pathamasadh) return MonthIndex.Jesth;
  return (idx - 1) as MonthIndex;
}

function getAharkunJs(jsYear: number): number {
  const h = jsYear * 292207 + 373;
  return Math.floor(h / 800) + 1;
}

function getAvomanJs(jsYear: number): number {
  return (getAharkunJs(jsYear) * 11 + 650) % 692;
}

function getKromthupulJs(jsYear: number): number {
  return 800 - ((292207 * jsYear + 373) % 800);
}

function getBoditheyJs(jsYear: number): number {
  const aharkun = getAharkunJs(jsYear);
  const a = 11 * aharkun + 650;
  return (aharkun + Math.floor(a / 692)) % 30;
}

function isAdhikameas(jsYear: number): boolean {
  const bodithey = getBoditheyJs(jsYear);
  const boditheyNext = getBoditheyJs(jsYear + 1);
  if (bodithey === 24 && boditheyNext === 6) return true;
  if (bodithey === 25 && boditheyNext === 5) return false;
  return bodithey > 24 || bodithey < 6;
}

function isChantrathimeas(jsYear: number): boolean {
  const avoman = getAvomanJs(jsYear);
  const avomanNext = getAvomanJs(jsYear + 1);
  const avomanPrev = getAvomanJs(jsYear - 1);
  const isSolarLeap = getKromthupulJs(jsYear) <= 207;
  if (avoman === 0 && avomanPrev === 137) return true;
  if (isSolarLeap) return avoman < 127;
  if (avoman === 137 && avomanNext === 0) return false;
  if (!isSolarLeap && avoman < 138) return true;
  if (avomanPrev === 137 && avoman === 0) return true;
  return false;
}

function has366Days(jsYear: number): boolean {
  return getKromthupulJs(jsYear) <= 207;
}

function getSunInfo(jsYear: number, sotin: number): SunInfo {
  const infoOfPrevYear = { kromathopol: getKromthupulJs(jsYear - 1) };
  const r2 = 800 * sotin + infoOfPrevYear.kromathopol;
  const reasey = Math.floor(r2 / 24350);
  const r3 = r2 % 24350;
  const angsar = Math.floor(r3 / 811);
  const r4 = r3 % 811;
  const l1 = Math.floor(r4 / 14);
  const libda = l1 - 3;
  const sunAverageAsLibda = 30 * 60 * reasey + 60 * angsar + libda;
  const s1 = 30 * 60 * 2 + 60 * 20;
  let leftOver = sunAverageAsLibda - s1;
  if (sunAverageAsLibda < s1) {
    leftOver += 30 * 60 * 12;
  }
  const kaen = Math.floor(leftOver / (30 * 60));
  let rs = -1;
  if ([0, 1, 2].includes(kaen)) {
    rs = kaen;
  } else if ([3, 4, 5].includes(kaen)) {
    rs = 30 * 60 * 6 - leftOver;
  } else if ([6, 7, 8].includes(kaen)) {
    rs = leftOver - 30 * 60 * 6;
  } else if ([9, 10, 11].includes(kaen)) {
    rs = 30 * 60 * 11 + 60 * 29 + 60 - leftOver;
  }
  const lastLeftOver = {
    reasey: Math.floor(rs / (30 * 60)),
    angsar: Math.floor((rs % (30 * 60)) / 60),
    libda: rs % 60,
  };
  let khan: number, pouichalip: number;
  if (lastLeftOver.angsar >= 15) {
    khan = 2 * lastLeftOver.reasey + 1;
    pouichalip = 60 * (lastLeftOver.angsar - 15) + lastLeftOver.libda;
  } else {
    khan = 2 * lastLeftOver.reasey;
    pouichalip = 60 * lastLeftOver.angsar + lastLeftOver.libda;
  }
  const chhayaSunMap = [
    { multiplicity: 35, chhaya: 0 },
    { multiplicity: 32, chhaya: 35 },
    { multiplicity: 27, chhaya: 67 },
    { multiplicity: 22, chhaya: 94 },
    { multiplicity: 13, chhaya: 116 },
    { multiplicity: 5, chhaya: 129 },
  ];
  const chhayaSun = khan <= 5 ? chhayaSunMap[khan] : { multiplicity: 0, chhaya: 134 };
  const q = Math.floor((pouichalip * chhayaSun.multiplicity) / 900);
  const pholAsLibda = q + chhayaSun.chhaya;
  const sunInaugurationAsLibda =
    kaen <= 5 ? sunAverageAsLibda - pholAsLibda : sunAverageAsLibda + pholAsLibda;
  return {
    sunInaugurationAsLibda,
    reasey: Math.floor(sunInaugurationAsLibda / (30 * 60)),
    angsar: Math.floor((sunInaugurationAsLibda % (30 * 60)) / 60),
    libda: sunInaugurationAsLibda % 60,
  };
}

function getNewYearInfo(jsYear: number): NewYearInfoInternal {
  const sotins = has366Days(jsYear - 1) ? [363, 364, 365, 366] : [362, 363, 364, 365];
  const newYearsDaySotins = sotins.map((sotin) => getSunInfo(jsYear, sotin));
  let timeOfNewYear: TimeInfo = { hour: 0, minute: 0 };
  for (const sotin of newYearsDaySotins) {
    if (sotin.angsar === 0) {
      const minutes = 24 * 60 - sotin.libda * 24;
      timeOfNewYear = {
        hour: Math.floor(minutes / 60) % 24,
        minute: minutes % 60,
      };
      break;
    }
  }
  const numberOfVanabatDays = newYearsDaySotins[0].angsar === 0 ? 2 : 1;
  return { timeOfNewYear, numberOfVanabatDays, newYearsDaySotins };
}

class KhmerDate {
  day: number;
  moonPhase: MoonPhase;
  monthIndex: MonthIndex;
  beYear: number;

  constructor(day: number, moonPhase: MoonPhase, monthIndex: MonthIndex, beYear: number) {
    this.day = day;
    this.moonPhase = moonPhase;
    this.monthIndex = monthIndex;
    this.beYear = beYear;
  }

  getDayNumber(): number {
    return this.moonPhase === MoonPhase.Waxing ? this.day - 1 : 15 + (this.day - 1);
  }

  static fromDayNumber(dayNum: number): MoonDayInfo {
    if (dayNum < 15) {
      return { day: dayNum + 1, moonPhase: MoonPhase.Waxing };
    } else {
      return { day: dayNum - 15 + 1, moonPhase: MoonPhase.Waning };
    }
  }

  addDays(count: number): KhmerDate {
    if (count === 0) return this;
    if (count < 0) return this.subtractDays(-count);
    let result = new KhmerDate(this.day, this.moonPhase, this.monthIndex, this.beYear);
    let remaining = count;
    while (remaining > 0) {
      const daysInMonth = getNumberOfDaysInKhmerMonth(result.monthIndex, result.beYear);
      const currentDayNum = result.getDayNumber();
      const daysLeftInMonth = daysInMonth - 1 - currentDayNum;
      if (remaining <= daysLeftInMonth) {
        const newDayNum = currentDayNum + remaining;
        const newDay = KhmerDate.fromDayNumber(newDayNum);
        let newBeYear = result.beYear;
        if (result.monthIndex === MonthIndex.Pisakh) {
          if (result.moonPhase === MoonPhase.Waxing && newDay.moonPhase === MoonPhase.Waning) {
            newBeYear++;
          }
        }
        result = new KhmerDate(newDay.day, newDay.moonPhase, result.monthIndex, newBeYear);
        remaining = 0;
      } else {
        remaining -= daysLeftInMonth + 1;
        const nextMonth = nextMonthOf(result.monthIndex, result.beYear);
        const newBeYear = result.monthIndex === MonthIndex.Cheit ? result.beYear + 1 : result.beYear;
        result = new KhmerDate(1, MoonPhase.Waxing, nextMonth, newBeYear);
      }
    }
    return result;
  }

  subtractDays(count: number): KhmerDate {
    if (count === 0) return this;
    let result = new KhmerDate(this.day, this.moonPhase, this.monthIndex, this.beYear);
    let remaining = count;
    while (remaining > 0) {
      const currentDayNum = result.getDayNumber();
      if (remaining <= currentDayNum) {
        const newDayNum = currentDayNum - remaining;
        const newDay = KhmerDate.fromDayNumber(newDayNum);
        let newBeYear = result.beYear;
        if (result.monthIndex === MonthIndex.Pisakh) {
          if (result.moonPhase === MoonPhase.Waning && newDay.moonPhase === MoonPhase.Waxing) {
            newBeYear--;
          }
        }
        result = new KhmerDate(newDay.day, newDay.moonPhase, result.monthIndex, newBeYear);
        remaining = 0;
      } else {
        remaining -= currentDayNum + 1;
        const prevMonth = previousMonthOf(result.monthIndex, result.beYear);
        const newBeYear = result.monthIndex === MonthIndex.Pisakh ? result.beYear - 1 : result.beYear;
        const daysInPrevMonth = getNumberOfDaysInKhmerMonth(prevMonth, newBeYear);
        const newDay = KhmerDate.fromDayNumber(daysInPrevMonth - 1);
        result = new KhmerDate(newDay.day, newDay.moonPhase, prevMonth, newBeYear);
      }
    }
    return result;
  }

  toString(): string {
    return `${this.day}${MoonPhaseNames[this.moonPhase]} ${LunarMonthNames[this.monthIndex]} ព.ស.${this.beYear}`;
  }
}

function getMaybeBEYear(year: number, month: number): number {
  return month <= 4 ? year + 543 : year + 544;
}

const visakhaBocheaCache: Record<number, number> = {};
const newYearInfoCache: Record<number, NewYearFullInfo> = {};

function getPisakhaBochea(year: number, isSearching: boolean = false): number {
  if (visakhaBocheaCache[year]) return visakhaBocheaCache[year];
  for (let searchMonth = 4; searchMonth <= 6; searchMonth++) {
    const daysInMonth = new Date(year, searchMonth, 0).getDate();
    for (let searchDay = 1; searchDay <= daysInMonth; searchDay++) {
      const result = gregorianToKhmerInternal(year, searchMonth, searchDay, 12, 0, 0, true);
      if (result.khmer.monthIndex === MonthIndex.Pisakh && result._khmerDateObj.getDayNumber() === 15) {
        const timestamp = new Date(year, searchMonth - 1, searchDay, 0, 0, 0, 0).getTime();
        visakhaBocheaCache[year] = timestamp;
        return timestamp;
      }
    }
  }
  const fallback = new Date(year, 3, 15, 0, 0, 0, 0).getTime();
  visakhaBocheaCache[year] = fallback;
  return fallback;
}

function gregorianToKhmerInternal(
  year: number,
  month: number,
  day: number,
  hour: number = 0,
  minute: number = 0,
  second: number = 0,
  isSearching: boolean = false
): KhmerConversionResult {
  let epochJdn = gregorianToJulianDay(1900, 1, 1);
  const targetJdn = gregorianToJulianDay(year, month, day);
  let khmerMonth = 1;
  let khmerDayNumber = 0;
  let diffDays = targetJdn - epochJdn;

  if (diffDays > 0) {
    while (true) {
      const epochGreg = julianDayToGregorian(epochJdn);
      const nextYearBE = getMaybeBEYear(epochGreg.year + 1, epochGreg.month);
      const daysInNextYear = getNumberOfDaysInKhmerYear(nextYearBE);
      if (diffDays > daysInNextYear) {
        diffDays -= daysInNextYear;
        epochJdn += daysInNextYear;
      } else {
        break;
      }
    }
  } else if (diffDays < 0) {
    while (diffDays < 0) {
      const epochGreg = julianDayToGregorian(epochJdn);
      const currentYearBE = getMaybeBEYear(epochGreg.year, epochGreg.month);
      const daysInCurrentYear = getNumberOfDaysInKhmerYear(currentYearBE);
      diffDays += daysInCurrentYear;
      epochJdn -= daysInCurrentYear;
    }
  }

  while (diffDays > 0) {
    const epochGreg = julianDayToGregorian(epochJdn);
    const currentBE = getMaybeBEYear(epochGreg.year, epochGreg.month);
    const daysInMonth = getNumberOfDaysInKhmerMonth(khmerMonth, currentBE);
    if (diffDays > daysInMonth) {
      diffDays -= daysInMonth;
      epochJdn += daysInMonth;
      khmerMonth = nextMonthOf(khmerMonth, currentBE);
    } else {
      break;
    }
  }

  khmerDayNumber = diffDays;
  const finalBE = getMaybeBEYear(year, month);
  const totalDaysInMonth = getNumberOfDaysInKhmerMonth(khmerMonth, finalBE);
  if (khmerDayNumber >= totalDaysInMonth) {
    khmerDayNumber = khmerDayNumber % totalDaysInMonth;
    khmerMonth = nextMonthOf(khmerMonth, finalBE);
  }

  const khmerDayInfo = KhmerDate.fromDayNumber(khmerDayNumber);
  let beYear: number;
  if (isSearching) {
    beYear = month <= 4 ? year + 543 : year + 544;
  } else {
    const inputTimestamp = new Date(year, month - 1, day, hour, minute, second).getTime();
    const beYearTransitionTimestamp = getPisakhaBochea(year);
    if (inputTimestamp >= beYearTransitionTimestamp) {
      beYear = year + 544;
    } else {
      beYear = year + 543;
    }
  }

  let jsYear = beToJs(beYear);
  let animalYearIndex = ((beYear + 4) % 12 + 12) % 12;
  if (!isSearching) {
    const newYearInfo = getNewYearFullInfo(year);
    const inputTimestamp = new Date(year, month - 1, day, hour, minute, second).getTime();
    const visakhaBocheaTimestamp = getPisakhaBochea(year);
    if (inputTimestamp >= newYearInfo.newYearMoment.getTime() && inputTimestamp <= visakhaBocheaTimestamp) {
      animalYearIndex = (animalYearIndex + 1) % 12;
    }
    if (inputTimestamp >= newYearInfo.lerngSakMoment.getTime() && inputTimestamp <= visakhaBocheaTimestamp) {
      jsYear++;
    }
  }

  const sakIndex = ((jsYear % 10) + 10) % 10;
  const dayOfWeek = getDayOfWeek(year, month, day);
  const khmerDate = new KhmerDate(khmerDayInfo.day, khmerDayInfo.moonPhase, khmerMonth as MonthIndex, beYear);

  return {
    gregorian: { year, month, day, hour, minute, second, dayOfWeek },
    khmer: {
      day: khmerDayInfo.day,
      moonPhase: khmerDayInfo.moonPhase,
      moonPhaseName: MoonPhaseNames[khmerDayInfo.moonPhase],
      monthIndex: khmerMonth as MonthIndex,
      monthName: LunarMonthNames[khmerMonth],
      beYear: beYear,
      jsYear: jsYear,
      animalYear: animalYearIndex as AnimalYear,
      animalYearName: AnimalYearNames[animalYearIndex],
      sak: sakIndex as Sak,
      sakName: SakNames[sakIndex],
      dayOfWeek: dayOfWeek as DayOfWeek,
      dayOfWeekName: WeekdayNames[dayOfWeek],
    },
    _khmerDateObj: khmerDate,
  };
}

export function fromGregorian(
  year: number,
  month: number,
  day: number,
  hour: number = 0,
  minute: number = 0,
  second: number = 0
): KhmerConversionResult {
  validateGregorianDate(year, month, day, hour, minute, second);
  return gregorianToKhmerInternal(year, month, day, hour, minute, second, false);
}

export function fromDate(date: Date): KhmerConversionResult {
  validateDateObject(date);
  return fromGregorian(
    date.getFullYear(),
    date.getMonth() + 1,
    date.getDate(),
    date.getHours(),
    date.getMinutes(),
    date.getSeconds()
  );
}

export function getNewYearFullInfo(ceYear: number): NewYearFullInfo {
  if (newYearInfoCache[ceYear]) {
    return newYearInfoCache[ceYear];
  }
  const jsYear = adToJs(ceYear);
  const newYearInfo = getNewYearInfo(jsYear);
  let bodithey = getBoditheyJs(jsYear);
  const isAthikameasPrev = isAdhikameas(jsYear - 1);
  const isChantrathimeasPrev = isChantrathimeas(jsYear - 1);
  if (isAthikameasPrev && isChantrathimeasPrev) {
    bodithey = (bodithey + 1) % 30;
  }
  const lunarDateLerngSak = {
    day: bodithey >= 6 ? bodithey - 1 : bodithey,
    month: bodithey >= 6 ? 4 : 5,
  };
  const numberNewYearDay = newYearInfo.newYearsDaySotins[0].angsar === 0 ? 4 : 3;
  const epochLerngSakGreg = { year: ceYear, month: 4, day: 17 };
  const khEpoch = gregorianToKhmerInternal(ceYear, 4, 17, 12, 0, 0, true)._khmerDateObj;
  const diffFromEpoch =
    (khEpoch.monthIndex - 4) * 29 +
    khEpoch.getDayNumber() -
    ((lunarDateLerngSak.month - 4) * 29 + lunarDateLerngSak.day);
  const daysToSubtract = diffFromEpoch + numberNewYearDay - 1;
  const epochJdn = gregorianToJulianDay(
    epochLerngSakGreg.year,
    epochLerngSakGreg.month,
    epochLerngSakGreg.day
  );
  let newYearJdn = epochJdn - daysToSubtract;

  if (khNewYearMoments[ceYear]) {
    const [datePart, timePart] = khNewYearMoments[ceYear].split(' ');
    const [d, m, y] = datePart.split('-').map(Number);
    const [hr, min] = timePart.split(':').map(Number);
    newYearInfo.timeOfNewYear = { hour: hr, minute: min };
    newYearJdn = gregorianToJulianDay(y, m, d);
  }

  const newYearDate = julianDayToGregorian(newYearJdn);
  const newYearMoment = new Date(
    newYearDate.year,
    newYearDate.month - 1,
    newYearDate.day,
    newYearInfo.timeOfNewYear.hour,
    newYearInfo.timeOfNewYear.minute
  );
  const lerngSakJdn = newYearJdn + numberNewYearDay - 1;
  const lerngSakDate = julianDayToGregorian(lerngSakJdn);
  const lerngSakMoment = new Date(
    lerngSakDate.year,
    lerngSakDate.month - 1,
    lerngSakDate.day,
    0,
    0,
    0
  );

  const result: NewYearFullInfo = {
    newYearMoment,
    lerngSakMoment,
    newYearInfo: {
      year: newYearDate.year,
      month: newYearDate.month,
      day: newYearDate.day,
      hour: newYearInfo.timeOfNewYear.hour,
      minute: newYearInfo.timeOfNewYear.minute,
    },
  };
  newYearInfoCache[ceYear] = result;
  return result;
}

export function getNewYear(ceYear: number): NewYearInfo {
  return getNewYearFullInfo(ceYear).newYearInfo;
}

export const constants = {
  LunarMonths,
  LunarMonthNames,
  SolarMonthNames,
  SolarMonthAbbreviationNames,
  LunarMonthAbbreviationNames,
  AnimalYearNames,
  AnimalYearEmojis,
  SakNames,
  WeekdayNames,
  MoonPhaseNames,
};

export default {
  fromGregorian,
  fromDate,
  getNewYear,
  constants,
  MoonPhase,
  MonthIndex,
  AnimalYear,
  Sak,
  DayOfWeek,
};
