import { type DateTimeFormats, ɵdateTimeFormats } from "@/common/i18n/locale-data.ts";

type DateFormatter = (date: Date, formats: DateTimeFormats, offset: number) => string;

/** Los tokens de patrón de Angular (más `sss`, los milisegundos de AngularJS); lo demás es texto literal. */
const DATE_FORMATS_SPLIT =
  /((?:[^BEGHLMOSWYZabcdhmswyz']+)|(?:'(?:[^']|'')*')|(?:G{1,5}|y{1,4}|Y{1,4}|M{1,5}|L{1,5}|w{1,2}|W{1}|d{1,2}|E{1,6}|c{1,6}|a{1,5}|b{1,5}|B{1,5}|h{1,2}|H{1,2}|m{1,2}|s{1,3}|S{1,3}|z{1,4}|Z{1,5}|O{1,4}))([\s\S]*)/;
const ISO8601_DATE = /^\d{4}-\d\d?-\d\d?$/;
const YEAR_OR_MONTH = /^\d{4}(-\d\d?)?$/;

/**
 * Como `formatDate` de `@angular/common`: `format` es un nombre (`short`, `mediumDate`, `fullTime`, …) o un patrón
 * (`"yyyy-MM-dd HH:mm"`, `"EEEE d 'de' MMMM"`); `timezone` un offset (`"+0430"`) o `"UTC"`. Los nombres salen de los
 * formatos del `$locale` de AngularJS (`long`/`full`/`longTime`/`fullTime`, que `$locale` no trae, se arman con ellos).
 */
export function formatDate(value: string | number | Date, format: string, locale: string, timezone?: string): string {
  let date = toDate(value);
  const formats = ɵdateTimeFormats(locale);
  const pattern = namedFormat(formats, format) ?? format;

  const parts: string[] = [];
  let rest: string | undefined = pattern;
  while (rest) {
    const match = DATE_FORMATS_SPLIT.exec(rest);
    if (!match) {
      parts.push(rest);
      break;
    }
    parts.push(match[1]!);
    rest = match[2];
  }

  let offset = date.getTimezoneOffset();
  if (timezone) {
    offset = timezoneToOffset(timezone, offset);
    date = convertTimezoneToLocal(date, timezone, true);
  }

  let text = "";
  for (const part of parts) {
    const formatter = FORMATTERS[part];
    if (formatter) text += formatter(date, formats, offset);
    else if (part === "''") text += "'";
    else text += part.replace(/(^'|'$)/g, "").replace(/''/g, "'");
  }
  return text;
}

function namedFormat(formats: DateTimeFormats, format: string): string | undefined {
  const get = (name: string) => formats[name] as string | undefined;
  switch (format) {
    case "short":
    case "medium":
    case "shortDate":
    case "mediumDate":
    case "longDate":
    case "fullDate":
    case "shortTime":
    case "mediumTime":
      return get(format);
    case "longTime":
      return `${get("mediumTime")} z`;
    case "fullTime":
      return `${get("mediumTime")} zzzz`;
    case "long":
      return `${get("longDate")} ${get("mediumTime")} z`;
    case "full":
      return `${get("fullDate")} ${get("mediumTime")} zzzz`;
    default:
      return undefined;
  }
}

/** Como Angular: `Date`, número (ms), string numérico, `"2015-06-15"` (fecha local), ISO 8601 u otro que entienda `Date`. */
export function toDate(value: string | number | Date): Date {
  // Por tag, no `instanceof`: un `Date` de otro realm (otra ventana/iframe) también es una fecha.
  if (Object.prototype.toString.call(value) === "[object Date]" && !Number.isNaN(value.valueOf())) return value as Date;
  if (typeof value === "number" && !Number.isNaN(value)) return new Date(value);
  if (typeof value === "string") {
    const trimmed = value.trim();
    if (/^(\d{0,20}\.?\d*)$/.test(trimmed)) return new Date(Number.parseFloat(trimmed));
    if (ISO8601_DATE.test(trimmed) || YEAR_OR_MONTH.test(trimmed)) {
      const [y = 0, m = 1, d = 1] = trimmed.split("-").map((part) => +part);
      return createDate(y, m - 1, d);
    }
    const parsed = new Date(trimmed);
    if (!Number.isNaN(parsed.valueOf())) return parsed;
  }
  throw new Error(`Unable to convert "${String(value)}" into a date`);
}

function createDate(year: number, month: number, day: number): Date {
  const date = new Date(0);
  date.setFullYear(year, month, day);
  date.setHours(0, 0, 0);
  return date;
}

function timezoneToOffset(timezone: string, fallback: number): number {
  const requested = Date.parse(`Jan 01, 1970 00:00:00 ${timezone.replace(/:/g, "")}`) / 60000;
  return Number.isNaN(requested) ? fallback : requested;
}

function convertTimezoneToLocal(date: Date, timezone: string, reverse: boolean): Date {
  const local = date.getTimezoneOffset();
  const minutes = (reverse ? -1 : 1) * (timezoneToOffset(timezone, local) - local);
  const result = new Date(date.getTime());
  result.setMinutes(result.getMinutes() + minutes);
  return result;
}

function padNumber(num: number, digits: number, trim = false, negWrap = false): string {
  let sign = "";
  if (num < 0 || (negWrap && num <= 0)) {
    if (negWrap) num = -num + 1;
    else {
      num = -num;
      sign = "-";
    }
  }
  let str = String(num);
  while (str.length < digits) str = `0${str}`;
  if (trim) str = str.slice(str.length - digits);
  return sign + str;
}

type Part = "FullYear" | "Month" | "Date" | "Hours" | "Minutes" | "Seconds" | "FractionalSeconds" | "Day";

function dateGetter(name: Part, size: number, offset = 0, trim = false, negWrap = false): DateFormatter {
  return (date) => {
    let part = getDatePart(name, date);
    if (offset > 0 || part > -offset) part += offset;
    if (name === "Hours" && part === 0 && offset === -12) part = 12;
    if (name === "FractionalSeconds") return String(part).padStart(3, "0").slice(0, size);
    return padNumber(part, size, trim, negWrap);
  };
}

function getDatePart(part: Part, date: Date): number {
  switch (part) {
    case "FullYear":
      return date.getFullYear();
    case "Month":
      return date.getMonth();
    case "Date":
      return date.getDate();
    case "Hours":
      return date.getHours();
    case "Minutes":
      return date.getMinutes();
    case "Seconds":
      return date.getSeconds();
    case "FractionalSeconds":
      return date.getMilliseconds();
    case "Day":
      return date.getDay();
  }
}

type Width = "narrow" | "abbreviated" | "wide" | "short";

const narrow = (list: string[]) => list.map((name) => name.charAt(0));

function nameGetter(kind: "months" | "standaloneMonths" | "days" | "dayPeriods" | "eras", width: Width): DateFormatter {
  return (date, formats) => {
    switch (kind) {
      case "months":
      case "standaloneMonths": {
        const wide = kind === "standaloneMonths" ? (formats.STANDALONEMONTH ?? formats.MONTH) : formats.MONTH;
        const list = width === "wide" ? wide : width === "narrow" ? narrow(wide) : formats.SHORTMONTH;
        return list[date.getMonth()]!;
      }
      case "days": {
        const list =
          width === "wide"
            ? formats.DAY
            : width === "narrow"
              ? narrow(formats.DAY)
              : width === "short"
                ? formats.DAY.map((day) => day.slice(0, 2))
                : formats.SHORTDAY;
        return list[date.getDay()]!;
      }
      case "dayPeriods": {
        const period = formats.AMPMS[date.getHours() < 12 ? 0 : 1]!;
        return width === "narrow" ? period.charAt(0).toLowerCase() : period;
      }
      case "eras": {
        const index = date.getFullYear() <= 0 ? 0 : 1;
        return width === "wide" ? formats.ERANAMES[index]! : width === "narrow" ? formats.ERAS[index]!.charAt(0) : formats.ERAS[index]!;
      }
    }
  };
}

type ZoneWidth = "short" | "shortGMT" | "long" | "extended";

function timeZoneGetter(width: ZoneWidth): DateFormatter {
  return (_date, _formats, offset) => {
    const zone = -1 * offset;
    const hours = zone > 0 ? Math.floor(zone / 60) : Math.ceil(zone / 60);
    const minutes = padNumber(Math.abs(zone % 60), 2);
    const sign = zone >= 0 ? "+" : "";
    switch (width) {
      case "short":
        return sign + padNumber(hours, 2) + minutes;
      case "shortGMT":
        return `GMT${sign}${padNumber(hours, 1)}`;
      case "long":
        return `GMT${sign}${padNumber(hours, 2)}:${minutes}`;
      case "extended":
        return offset === 0 ? "Z" : `${sign}${padNumber(hours, 2)}:${minutes}`;
    }
  };
}

function thursdayThisWeek(date: Date): Date {
  const day = date.getDay();
  return createDate(date.getFullYear(), date.getMonth(), date.getDate() + (day === 0 ? -3 : 4 - day));
}

function firstThursdayOfYear(year: number): Date {
  const firstDay = createDate(year, 0, 1).getDay();
  return createDate(year, 0, 1 + (firstDay <= 4 ? 4 : 11) - firstDay);
}

function weekGetter(size: number, monthBased = false): DateFormatter {
  return (date) => {
    if (monthBased) {
      const before = new Date(date.getFullYear(), date.getMonth(), 1).getDay() - 1;
      return padNumber(1 + Math.floor((date.getDate() + before) / 7), size);
    }
    const thursday = thursdayThisWeek(date);
    const diff = thursday.getTime() - firstThursdayOfYear(thursday.getFullYear()).getTime();
    return padNumber(1 + Math.round(diff / 6.048e8), size);
  };
}

function weekNumberingYearGetter(size: number, trim = false): DateFormatter {
  return (date) => padNumber(thursdayThisWeek(date).getFullYear(), size, trim);
}

const FORMATTERS: Record<string, DateFormatter> = {
  G: nameGetter("eras", "abbreviated"),
  GG: nameGetter("eras", "abbreviated"),
  GGG: nameGetter("eras", "abbreviated"),
  GGGG: nameGetter("eras", "wide"),
  GGGGG: nameGetter("eras", "narrow"),
  y: dateGetter("FullYear", 1, 0, false, true),
  yy: dateGetter("FullYear", 2, 0, true, true),
  yyy: dateGetter("FullYear", 3, 0, false, true),
  yyyy: dateGetter("FullYear", 4, 0, false, true),
  Y: weekNumberingYearGetter(1),
  YY: weekNumberingYearGetter(2, true),
  YYY: weekNumberingYearGetter(3),
  YYYY: weekNumberingYearGetter(4),
  M: dateGetter("Month", 1, 1),
  L: dateGetter("Month", 1, 1),
  MM: dateGetter("Month", 2, 1),
  LL: dateGetter("Month", 2, 1),
  MMM: nameGetter("months", "abbreviated"),
  MMMM: nameGetter("months", "wide"),
  MMMMM: nameGetter("months", "narrow"),
  LLL: nameGetter("standaloneMonths", "abbreviated"),
  LLLL: nameGetter("standaloneMonths", "wide"),
  LLLLL: nameGetter("standaloneMonths", "narrow"),
  w: weekGetter(1),
  ww: weekGetter(2),
  W: weekGetter(1, true),
  d: dateGetter("Date", 1),
  dd: dateGetter("Date", 2),
  c: dateGetter("Day", 1),
  cc: dateGetter("Day", 1),
  ccc: nameGetter("days", "abbreviated"),
  cccc: nameGetter("days", "wide"),
  ccccc: nameGetter("days", "narrow"),
  cccccc: nameGetter("days", "short"),
  E: nameGetter("days", "abbreviated"),
  EE: nameGetter("days", "abbreviated"),
  EEE: nameGetter("days", "abbreviated"),
  EEEE: nameGetter("days", "wide"),
  EEEEE: nameGetter("days", "narrow"),
  EEEEEE: nameGetter("days", "short"),
  a: nameGetter("dayPeriods", "abbreviated"),
  aa: nameGetter("dayPeriods", "abbreviated"),
  aaa: nameGetter("dayPeriods", "abbreviated"),
  aaaa: nameGetter("dayPeriods", "wide"),
  aaaaa: nameGetter("dayPeriods", "narrow"),
  // `b`/`B` (períodos del día extendidos) no están en `$locale`: AM/PM.
  b: nameGetter("dayPeriods", "abbreviated"),
  bb: nameGetter("dayPeriods", "abbreviated"),
  bbb: nameGetter("dayPeriods", "abbreviated"),
  bbbb: nameGetter("dayPeriods", "wide"),
  bbbbb: nameGetter("dayPeriods", "narrow"),
  B: nameGetter("dayPeriods", "abbreviated"),
  BB: nameGetter("dayPeriods", "abbreviated"),
  BBB: nameGetter("dayPeriods", "abbreviated"),
  BBBB: nameGetter("dayPeriods", "wide"),
  BBBBB: nameGetter("dayPeriods", "narrow"),
  h: dateGetter("Hours", 1, -12),
  hh: dateGetter("Hours", 2, -12),
  H: dateGetter("Hours", 1),
  HH: dateGetter("Hours", 2),
  m: dateGetter("Minutes", 1),
  mm: dateGetter("Minutes", 2),
  s: dateGetter("Seconds", 1),
  ss: dateGetter("Seconds", 2),
  // `sss`: los milisegundos de los formatos de AngularJS (`input[type=datetime-local]` usa `ss.sss`).
  sss: dateGetter("FractionalSeconds", 3),
  S: dateGetter("FractionalSeconds", 1),
  SS: dateGetter("FractionalSeconds", 2),
  SSS: dateGetter("FractionalSeconds", 3),
  Z: timeZoneGetter("short"),
  ZZ: timeZoneGetter("short"),
  ZZZ: timeZoneGetter("short"),
  O: timeZoneGetter("shortGMT"),
  OO: timeZoneGetter("shortGMT"),
  OOO: timeZoneGetter("shortGMT"),
  z: timeZoneGetter("shortGMT"),
  zz: timeZoneGetter("shortGMT"),
  zzz: timeZoneGetter("shortGMT"),
  OOOO: timeZoneGetter("long"),
  ZZZZ: timeZoneGetter("long"),
  zzzz: timeZoneGetter("long"),
  ZZZZZ: timeZoneGetter("extended"),
};
