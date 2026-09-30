/**
 * `isDevMode`/`enableProdMode`/`VERSION` de `@angular/core`. `VERSION` es la versión de Angular que emula ngjs (el
 * techo, 16.2): el código que pregunta por la versión se comporta como sobre Angular 16.2.
 */
let devMode = true;
let modeLocked = false;

/** `true` hasta que se llame `enableProdMode()`. */
export function isDevMode(): boolean {
  modeLocked = true;
  return devMode;
}

/** Como Angular: llamarla después de haber consultado el modo es error. */
export function enableProdMode(): void {
  if (modeLocked) throw new Error("Cannot enable prod mode after platform setup.");
  devMode = false;
}

export class Version {
  readonly major: string;
  readonly minor: string;
  readonly patch: string;

  constructor(readonly full: string) {
    const [major = "", minor = "", ...rest] = full.split(".");
    this.major = major;
    this.minor = minor;
    this.patch = rest.join(".");
  }
}

export const VERSION = new Version("16.2.12");
