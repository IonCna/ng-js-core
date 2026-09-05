const DIGITS_INFO = /^(\d+)\.(\d+)-(\d+)$/;

/** `"{minIntegerDigits}.{minFractionDigits}-{maxFractionDigits}"`, igual formato que `DecimalPipe`/`PercentPipe` reales — default `"1.0-0"`. */
function parseDigitsInfo(digitsInfo: string | undefined): { minimumFractionDigits: number; maximumFractionDigits: number } {
  const match = DIGITS_INFO.exec(digitsInfo ?? "1.0-0");
  if (!match) return { minimumFractionDigits: 0, maximumFractionDigits: 0 };

  const [, , minFraction, maxFraction] = match;
  return { minimumFractionDigits: Number(minFraction), maximumFractionDigits: Number(maxFraction) };
}

/** Sin filtro nativo en AngularJS (ver CONCEPTOS "Pipes") — `value * 100` + `"%"`, formateado con `Intl.NumberFormat`. */
export function percentFilter(): (value: number | string | null | undefined, digitsInfo?: string) => string {
  return (value, digitsInfo) => {
    if (value == null || value === "") return "";

    const num = typeof value === "number" ? value : Number(value);
    if (Number.isNaN(num)) return "";

    return new Intl.NumberFormat(undefined, { style: "percent", ...parseDigitsInfo(digitsInfo) }).format(num);
  };
}
