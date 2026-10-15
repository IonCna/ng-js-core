/**
 * `formatDate` de `@angular/common`, sobre `Intl.DateTimeFormat` en vez de los datos de locale de Angular: mismos
 * formatos con nombre (`short`, `mediumDate`, …), mismos símbolos de patrón (`dd/MM/yyyy`, `EEEE`, `a`, `Z`, …), misma
 * zona horaria (`UTC`, `+0430`) y la misma conversión de valores (`toDate`). Los textos (meses, días, `a.m.`) salen
 * del locale vía `Intl`, así que pueden diferir en detalles de puntuación de los de CLDR que trae Angular.
 */

type NamedStyle = "short" | "medium" | "long" | "full";

const NAMED_FORMATS: Record<string, { dateStyle?: NamedStyle; timeStyle?: NamedStyle }> = {
  short: { dateStyle: "short", timeStyle: "short" },
  medium: { dateStyle: "medium", timeStyle: "medium" },
  long: { dateStyle: "long", timeStyle: "long" },
  full: { dateStyle: "full", timeStyle: "full" },
  shortDate: { dateStyle: "short" },
  mediumDate: { dateStyle: "medium" },
  longDate: { dateStyle: "long" },
  fullDate: { dateStyle: "full" },
  shortTime: { timeStyle: "short" },
  mediumTime: { timeStyle: "medium" },
  longTime: { timeStyle: "long" },
  fullTime: { timeStyle: "full" },
};

/** El `DATE_FORMATS_SPLIT` de Angular: texto suelto, texto entre comillas o un símbolo de patrón. */
const DATE_FORMATS_SPLIT =
  /((?:[^BEGHLMOSWYZabcdhmswyz']+)|(?:'(?:[^']|'')*')|(?:G{1,5}|y{1,4}|Y{1,4}|M{1,5}|L{1,5}|w{1,2}|W{1}|d{1,2}|E{1,6}|c{1,6}|a{1,5}|b{1,5}|B{1,5}|h{1,2}|H{1,2}|m{1,2}|s{1,2}|S{1,3}|z{1,4}|Z{1,5}|O{1,4}))([\s\S]*)/;

const DATE_ONLY = /^(\d{4}(-\d{1,2}(-\d{1,2})?)?)$/;

/** Como `toDate` de Angular: `Date`, número, `"2026-10-14"` (fecha local, no UTC) o cualquier string que `Date` entienda. */
export function toDate(value: string | number | Date): Date {
  if (value instanceof Date && !Number.isNaN(value.getTime())) return value;
  if (typeof value === "number" && !Number.isNaN(value)) return new Date(value);
  if (typeof value === "string") {
    const trimmed = value.trim();
    if (DATE_ONLY.test(trimmed)) {
      const [year = 0, month = 1, day = 1] = trimmed.split("-").map(Number);
      return new Date(year, month - 1, day);
    }
    const asNumber = Number.parseFloat(trimmed);
    if (!Number.isNaN(Number(trimmed) - asNumber)) return new Date(asNumber);
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) throw new Error(`Unable to convert "${String(value)}" into a date`);
  return date;
}

/** Como `timezoneToOffset` de Angular: minutos con el signo de `getTimezoneOffset()` (`+0430` → `-270`). */
function timezoneToOffset(timezone: string, fallback: number): number {
  const offset = Date.parse(`Jan 01, 1970 00:00:00 ${timezone.replace(/:/g, "")}`) / 60000;
  return Number.isNaN(offset) ? fallback : offset;
}

function pad(value: number, digits: number): string {
  const sign = value < 0 ? "-" : "";
  return sign + String(Math.abs(value)).padStart(digits, "0");
}

/** Un `Intl.DateTimeFormat` que lee la "hora de pared" (`wall`, en UTC) y devuelve una de sus partes. */
function part(
  wall: Date,
  locale: string,
  type: Intl.DateTimeFormatPartTypes,
  options: Intl.DateTimeFormatOptions,
): string {
  return (
    new Intl.DateTimeFormat(locale, { ...options, timeZone: "UTC" }).formatToParts(wall).find((p) => p.type === type)
      ?.value ?? ""
  );
}

function zone(offset: number, width: "short" | "shortGMT" | "long" | "extended"): string {
  const minutes = -offset;
  const hours = minutes > 0 ? Math.floor(minutes / 60) : Math.ceil(minutes / 60);
  const sign = minutes >= 0 ? "+" : "";
  const rest = pad(Math.abs(minutes % 60), 2);
  if (width === "short") return `${sign}${pad(hours, 2)}${rest}`;
  if (width === "shortGMT") return `GMT${sign}${pad(hours, 1)}`;
  if (width === "extended" && offset === 0) return "Z";
  return `${width === "long" ? "GMT" : ""}${sign}${pad(hours, 2)}:${rest}`;
}

/** Semana del año como Angular: la del jueves de esa semana, contada desde el primer jueves del año. */
function weekOfYear(wall: Date): number {
  const thursday = Date.UTC(wall.getUTCFullYear(), wall.getUTCMonth(), wall.getUTCDate() + (4 - wall.getUTCDay()));
  const year = new Date(thursday).getUTCFullYear();
  const firstDay = new Date(Date.UTC(year, 0, 1)).getUTCDay();
  const firstThursday = Date.UTC(year, 0, 1 + (firstDay <= 4 ? 4 : 11) - firstDay);
  return 1 + Math.round((thursday - firstThursday) / 6.048e8);
}

function weekOfMonth(wall: Date): number {
  const firstDay = new Date(Date.UTC(wall.getUTCFullYear(), wall.getUTCMonth(), 1)).getUTCDay();
  return 1 + Math.floor((wall.getUTCDate() + firstDay - 1) / 7);
}

const MONTH_WIDTH = ["numeric", "2-digit", "short", "long", "narrow"] as const;
const TEXT_WIDTH = { 3: "short", 4: "long", 5: "narrow" } as const;

function formatSymbol(symbol: string, wall: Date, offset: number, locale: string): string {
  const letter = symbol.charAt(0);
  const size = symbol.length;
  const textWidth = TEXT_WIDTH[Math.min(Math.max(size, 3), 5) as 3 | 4 | 5];

  switch (letter) {
    case "G":
      return part(wall, locale, "era", { era: textWidth, year: "numeric" });
    case "y":
    case "Y": {
      const year = wall.getUTCFullYear();
      return size === 2 ? pad(year % 100, 2) : pad(year, size === 1 ? 1 : size);
    }
    case "M":
    case "L": {
      if (size <= 2) return pad(wall.getUTCMonth() + 1, size);
      // `M` es el mes dentro de una fecha ("14 de octubre"); `L`, el mes solo ("octubre").
      const options: Intl.DateTimeFormatOptions = { month: MONTH_WIDTH[size - 1] };
      return part(wall, locale, "month", letter === "M" ? { ...options, day: "numeric" } : options);
    }
    case "w":
      return pad(weekOfYear(wall), size);
    case "W":
      return String(weekOfMonth(wall));
    case "d":
      return pad(wall.getUTCDate(), size);
    case "E":
    case "c": {
      if (letter === "c" && size <= 2) return String(wall.getUTCDay());
      if (size === 6) return part(wall, locale, "weekday", { weekday: "short" }).slice(0, 2);
      return part(wall, locale, "weekday", { weekday: size <= 3 ? "short" : textWidth });
    }
    case "a":
    case "b":
    case "B": {
      const period = part(wall, locale, "dayPeriod", { hour: "numeric", hour12: true });
      return size === 5 ? period.charAt(0).toLocaleLowerCase(locale) : period;
    }
    case "h":
      return pad(wall.getUTCHours() % 12 || 12, size);
    case "H":
      return pad(wall.getUTCHours(), size);
    case "m":
      return pad(wall.getUTCMinutes(), size);
    case "s":
      return pad(wall.getUTCSeconds(), size);
    case "S":
      return pad(wall.getUTCMilliseconds(), 3).slice(0, size);
    case "z":
      return zone(offset, size === 4 ? "long" : "shortGMT");
    case "O":
      return zone(offset, size === 4 ? "long" : "shortGMT");
    case "Z":
      return zone(offset, size === 4 ? "long" : size === 5 ? "extended" : "short");
    default:
      return symbol;
  }
}

/** Un formato con nombre: con la zona pedida si `Intl` la entiende; si no, la hora de pared en UTC. */
function formatNamed(
  date: Date,
  style: Intl.DateTimeFormatOptions,
  locale: string,
  timezone: string | undefined,
  offset: number,
): string {
  if (timezone === undefined) return new Intl.DateTimeFormat(locale, style).format(date);
  const normalized = /^(UTC|GMT|Z)$/i.test(timezone.trim())
    ? "UTC"
    : timezone.trim().replace(/^([+-]\d{2}):?(\d{2})$/, "$1:$2");
  try {
    return new Intl.DateTimeFormat(locale, { ...style, timeZone: normalized }).format(date);
  } catch {
    return new Intl.DateTimeFormat(locale, { ...style, timeZone: "UTC" }).format(
      new Date(date.getTime() - offset * 60000),
    );
  }
}

export function formatDate(value: string | number | Date, format: string, locale: string, timezone?: string): string {
  const date = toDate(value);
  const offset = timezone ? timezoneToOffset(timezone, date.getTimezoneOffset()) : date.getTimezoneOffset();

  const named = NAMED_FORMATS[format];
  if (named) return formatNamed(date, named, locale, timezone, offset);

  // La "hora de pared": un Date cuyos campos UTC son la fecha y hora en la zona pedida (o la local).
  const wall = new Date(date.getTime() - offset * 60000);
  let rest = format;
  let text = "";
  while (rest) {
    const match = DATE_FORMATS_SPLIT.exec(rest);
    if (!match) {
      text += rest;
      break;
    }
    const [, piece = "", remaining = ""] = match;
    if (piece === "''") text += "'";
    else if (piece.startsWith("'")) text += piece.slice(1, -1).replace(/''/g, "'");
    else if (/^[BEGHLMOSWYZabcdhmswyz]/.test(piece)) text += formatSymbol(piece, wall, offset, locale);
    else text += piece;
    rest = remaining;
  }
  return text;
}
