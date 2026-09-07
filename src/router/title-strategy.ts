/**
 * `TitleStrategy` — decide **cómo se aplica** el título de la ruta. Versión
 * básica: el router resuelve el título (camina el chain de estados, corre la
 * `ResolveFn`) y llama a `updateTitle(title)` con el string ya listo. El strategy
 * solo elige qué hacer con él (setearlo, agregarle un sufijo, mandarlo a otro
 * lado). No recibe snapshot ni permite overridear la resolución — ver brecha en
 * `docs/ORDEN-DE-CONSTRUCCION.md`.
 *
 * Custom: `{ provide: TitleStrategy, useClass: MiStrategy }` en un `@NgModule`.
 */
export abstract class TitleStrategy {
  static readonly $name = "TitleStrategy";
  abstract updateTitle(title: string | undefined): void;
}

/** Lo mínimo que `DefaultTitleStrategy` necesita del servicio `Title`. */
interface TitleSink {
  setTitle(value: string): void;
}

/**
 * Aplica el título tal cual, vía el servicio `Title` si está en el injector
 * (`PlatformBrowserModule`), o `document.title` directo si no.
 */
export class DefaultTitleStrategy extends TitleStrategy {
  constructor(private readonly title?: TitleSink) {
    super();
  }

  updateTitle(title: string | undefined): void {
    if (title === undefined) return;
    if (this.title) this.title.setTitle(title);
    else document.title = title;
  }
}
