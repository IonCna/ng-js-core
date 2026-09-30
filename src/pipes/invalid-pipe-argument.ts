/**
 * Como Angular (`NG02100`): el error de un pipe que recibió un valor que no sabe transformar. El nombre va como texto:
 * el bundle puede renombrar la clase (`_DatePipe`).
 */
export function invalidPipeArgument(pipeName: string, value: unknown): Error {
  return new Error(`NG02100: InvalidPipeArgument: '${String(value)}' for pipe '${pipeName}'`);
}

/** Como Angular: `null`/`undefined`/`""`/`NaN` no son un valor (los pipes de formato devuelven `null`). */
export function isValue(value: unknown): boolean {
  return !(value == null || value === "" || value !== value);
}

/** Como Angular: un string numérico pasa a número; otra cosa que no sea número es error. */
export function strToNumber(value: number | string): number {
  if (typeof value === "string" && !Number.isNaN(Number(value) - Number.parseFloat(value))) return Number(value);
  if (typeof value !== "number") throw new Error(`${value} is not a number`);
  return value;
}
