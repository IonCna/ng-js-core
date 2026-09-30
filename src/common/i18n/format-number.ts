import { type NumberPattern, ɵnumberFormats } from "@/common/i18n/locale-data.ts";

const NUMBER_FORMAT_REGEXP = /^(\d+)?\.((\d+)(-(\d+))?)?$/;
const MAX_DIGITS = 22;
const CURRENCY_CHAR = "¤";
const PERCENT_CHAR = "%";

interface ParsedNumber {
  digits: number[];
  exponent: number;
  integerLen: number;
}

/**
 * Como `formatNumber` de `@angular/common`: `digitsInfo` es `"{minIntegerDigits}.{minFractionDigits}-{maxFractionDigits}"`
 * (default `"1.0-3"`), con redondeo "half up" sobre los dígitos (sin errores de punto flotante). Separadores y
 * agrupación, del `$locale` (`NUMBER_FORMATS`).
 */
export function formatNumber(value: number, locale: string, digitsInfo?: string): string {
  const formats = ɵnumberFormats(locale);
  return format(value, { ...formats.PATTERNS[0]! }, formats.GROUP_SEP, formats.DECIMAL_SEP, digitsInfo);
}

/** Como `formatPercent` de `@angular/common`: `value * 100` con `"%"`; `digitsInfo` por defecto `"1.0-0"`. */
export function formatPercent(value: number, locale: string, digitsInfo?: string): string {
  const formats = ɵnumberFormats(locale);
  const decimal = formats.PATTERNS[0]!;
  const pattern = { ...decimal, minFrac: 0, maxFrac: 0, posSuf: `${decimal.posSuf}${PERCENT_CHAR}`, negSuf: `${decimal.negSuf}${PERCENT_CHAR}` };
  return format(value, pattern, formats.GROUP_SEP, formats.DECIMAL_SEP, digitsInfo, true);
}

/**
 * Como `formatCurrency` de `@angular/common`: `currency` es el texto a mostrar (símbolo o código) y `currencyCode` el
 * código ISO 4217 que decide los decimales por defecto (`JPY` → 0). El lugar del símbolo, del patrón de moneda del
 * `$locale`.
 */
export function formatCurrency(value: number, locale: string, currency: string, currencyCode?: string, digitsInfo?: string): string {
  const formats = ɵnumberFormats(locale);
  const digits = getNumberOfCurrencyDigits(currencyCode);
  const pattern = { ...formats.PATTERNS[1]!, minFrac: digits, maxFrac: digits };
  return format(value, pattern, formats.GROUP_SEP, formats.DECIMAL_SEP, digitsInfo).replace(CURRENCY_CHAR, currency).replace(CURRENCY_CHAR, "").trim();
}

/** Como Angular: el símbolo de una moneda en un locale (`"USD"` → `"$"`, `"CAD"` → `"CA$"`); si no hay, el código. */
export function getCurrencySymbol(code: string, format: "wide" | "narrow", locale = "en"): string {
  try {
    const display = format === "narrow" ? "narrowSymbol" : "symbol";
    const parts = new Intl.NumberFormat(locale, { style: "currency", currency: code, currencyDisplay: display }).formatToParts(0);
    return parts.find((part) => part.type === "currency")?.value ?? code;
  } catch {
    return code;
  }
}

/** Como Angular: los decimales de una moneda (ISO 4217): 2 por defecto, `JPY` 0, `BHD` 3. */
export function getNumberOfCurrencyDigits(code: string | undefined): number {
  if (!code) return 2;
  try {
    return new Intl.NumberFormat("en", { style: "currency", currency: code }).resolvedOptions().maximumFractionDigits ?? 2;
  } catch {
    return 2;
  }
}

function format(
  value: number,
  pattern: NumberPattern,
  groupSymbol: string,
  decimalSymbol: string,
  digitsInfo: string | undefined,
  isPercent = false,
): string {
  let text = "";
  let isZero = false;

  if (!Number.isFinite(value)) {
    text = "∞";
  } else {
    let parsed = parseNumber(value);
    if (isPercent) parsed = toPercent(parsed);

    let minInt = pattern.minInt;
    let minFraction = pattern.minFrac;
    let maxFraction = pattern.maxFrac;
    if (digitsInfo) {
      const parts = NUMBER_FORMAT_REGEXP.exec(digitsInfo);
      if (parts === null) throw new Error(`${digitsInfo} is not a valid digit info`);
      const [, minIntPart, , minFractionPart, , maxFractionPart] = parts;
      if (minIntPart != null) minInt = parseIntAutoRadix(minIntPart);
      if (minFractionPart != null) minFraction = parseIntAutoRadix(minFractionPart);
      if (maxFractionPart != null) maxFraction = parseIntAutoRadix(maxFractionPart);
      else if (minFractionPart != null && minFraction > maxFraction) maxFraction = minFraction;
    }

    roundNumber(parsed, minFraction, maxFraction);

    let digits = parsed.digits;
    let integerLen = parsed.integerLen;
    let decimals: number[] = [];
    isZero = digits.every((digit) => !digit);

    for (; integerLen < minInt; integerLen++) digits.unshift(0);
    for (; integerLen < 0; integerLen++) digits.unshift(0);

    if (integerLen > 0) {
      decimals = digits.splice(integerLen, digits.length);
    } else {
      decimals = digits;
      digits = [0];
    }

    const groups: string[] = [];
    if (digits.length >= pattern.lgSize) groups.unshift(digits.splice(-pattern.lgSize, digits.length).join(""));
    while (digits.length > pattern.gSize) groups.unshift(digits.splice(-pattern.gSize, digits.length).join(""));
    if (digits.length) groups.unshift(digits.join(""));

    text = groups.join(groupSymbol);
    if (decimals.length) text += decimalSymbol + decimals.join("");
    if (parsed.exponent) text += `E+${parsed.exponent}`;
  }

  return value < 0 && !isZero ? pattern.negPre + text + pattern.negSuf : pattern.posPre + text + pattern.posSuf;
}

function parseIntAutoRadix(text: string): number {
  const result = Number.parseInt(text, 10);
  if (Number.isNaN(result)) throw new Error(`Invalid integer literal when parsing ${text}`);
  return result;
}

function parseNumber(num: number): ParsedNumber {
  let numStr = `${Math.abs(num)}`;
  let exponent = 0;
  let digits: number[];
  let integerLen: number;
  let i: number;
  let zeros: number;

  if ((integerLen = numStr.indexOf(".")) > -1) numStr = numStr.replace(".", "");
  if ((i = numStr.search(/e/i)) > 0) {
    if (integerLen < 0) integerLen = i;
    integerLen += +numStr.slice(i + 1);
    numStr = numStr.substring(0, i);
  } else if (integerLen < 0) {
    integerLen = numStr.length;
  }

  for (i = 0; numStr.charAt(i) === "0"; i++) {}

  if (i === (zeros = numStr.length)) {
    digits = [0];
    integerLen = 1;
  } else {
    zeros--;
    while (numStr.charAt(zeros) === "0") zeros--;
    integerLen -= i;
    digits = [];
    for (let j = 0; i <= zeros; i++, j++) digits[j] = Number(numStr.charAt(i));
  }

  if (integerLen > MAX_DIGITS) {
    digits = digits.splice(0, MAX_DIGITS - 1);
    exponent = integerLen - 1;
    integerLen = 1;
  }
  return { digits, exponent, integerLen };
}

function toPercent(parsed: ParsedNumber): ParsedNumber {
  if (parsed.digits[0] === 0) return parsed;
  const fractionLen = parsed.digits.length - parsed.integerLen;
  if (parsed.exponent) {
    parsed.exponent += 2;
  } else {
    if (fractionLen === 0) parsed.digits.push(0, 0);
    else if (fractionLen === 1) parsed.digits.push(0);
    parsed.integerLen += 2;
  }
  return parsed;
}

function roundNumber(parsed: ParsedNumber, minFrac: number, maxFrac: number): void {
  if (minFrac > maxFrac) {
    throw new Error(`The minimum number of digits after fraction (${minFrac}) is higher than the maximum (${maxFrac}).`);
  }
  const digits = parsed.digits;
  let fractionLen = digits.length - parsed.integerLen;
  const fractionSize = Math.min(Math.max(minFrac, fractionLen), maxFrac);

  let roundAt = fractionSize + parsed.integerLen;
  const digit = digits[roundAt] ?? 0;

  if (roundAt > 0) {
    digits.splice(Math.max(parsed.integerLen, roundAt));
    for (let j = roundAt; j < digits.length; j++) digits[j] = 0;
  } else {
    fractionLen = Math.max(0, fractionLen);
    parsed.integerLen = 1;
    digits.length = Math.max(1, (roundAt = fractionSize + 1));
    digits[0] = 0;
    for (let i = 1; i < roundAt; i++) digits[i] = 0;
  }

  if (digit >= 5) {
    if (roundAt - 1 < 0) {
      for (let k = 0; k > roundAt; k--) {
        digits.unshift(0);
        parsed.integerLen++;
      }
      digits.unshift(1);
      parsed.integerLen++;
    } else {
      digits[roundAt - 1]!++;
    }
  }

  for (; fractionLen < Math.max(0, fractionSize); fractionLen++) digits.push(0);

  let dropTrailingZeros = fractionSize !== 0;
  const minLen = minFrac + parsed.integerLen;
  const carry = digits.reduceRight((carry, d, i, list) => {
    d = d + carry;
    list[i] = d < 10 ? d : d - 10;
    if (dropTrailingZeros) {
      if (list[i] === 0 && i >= minLen) list.pop();
      else dropTrailingZeros = false;
    }
    return d >= 10 ? 1 : 0;
  }, 0);
  if (carry) {
    digits.unshift(carry);
    parsed.integerLen++;
  }
}
