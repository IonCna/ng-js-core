/**
 * Lo que comparten `DecimalPipe`, `PercentPipe` y `CurrencyPipe`, con las reglas de `@angular/common`: el
 * `digitsInfo` (`"{minIntegerDigits}.{minFractionDigits}-{maxFractionDigits}"`), qué cuenta como vacío y cuándo un
 * valor no es número (error, como en Angular). El formato sale de `Intl.NumberFormat` con el `LOCALE_ID`.
 */
const DIGITS_INFO = /^(\d+)?\.((\d+)(-(\d+))?)?$/;

export interface DigitsOptions {
  minimumIntegerDigits: number;
  minimumFractionDigits: number;
  maximumFractionDigits: number;
}

/** `null`, `undefined`, `""` y `NaN` no se formatean: el pipe devuelve `null`, como en Angular. */
export function isEmptyNumber(value: unknown): value is null | undefined | "" {
  return value == null || value === "" || Number.isNaN(value);
}

/** Un string numérico se convierte; cualquier otra cosa que no sea número es error, como `strToNumber` de Angular. */
export function strToNumber(value: number | string, pipe: string): number {
  if (typeof value === "number") return value;
  if (typeof value === "string" && value.trim() !== "" && !Number.isNaN(Number(value))) return Number(value);
  throw new Error(`InvalidPipeArgument: '${String(value)} is not a number' for pipe '${pipe}'`);
}

/** Aplica `digitsInfo` sobre los dígitos por defecto del formato, como `formatNumberToLocaleString` de Angular. */
export function parseDigitsInfo(digitsInfo: string | undefined, defaults: DigitsOptions): DigitsOptions {
  const options = { ...defaults };
  if (digitsInfo === undefined) return options;

  const parts = DIGITS_INFO.exec(digitsInfo);
  if (parts === null) throw new Error(`${digitsInfo} is not a valid digit info`);
  const [, minInt, , minFraction, , maxFraction] = parts;

  if (minInt != null) options.minimumIntegerDigits = Number(minInt);
  if (minFraction != null) options.minimumFractionDigits = Number(minFraction);
  if (maxFraction != null) options.maximumFractionDigits = Number(maxFraction);
  else if (minFraction != null && options.minimumFractionDigits > options.maximumFractionDigits) {
    options.maximumFractionDigits = options.minimumFractionDigits;
  }

  return options;
}
