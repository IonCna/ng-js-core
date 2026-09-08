# Capas de `ngjs-core`

`ngjs-core` se consume por una de **dos** superficies mutuamente excluyentes. La
diferencia es **cómo se escribe** el código; en ambas el registro de AngularJS lo
hace el **motor de runtime** al arrancar (no hay build step que traduzca).

> El núcleo "lite" original (lo que vivía en `ngjs-core/reference/` — decoradores
> AngularJS-flavored, menos superficie Angular, menos breaking changes) se movió a
> su propio proyecto en `../ngjs-core-lite`. No comparte código con este `ngjs-core`.

| Superficie | Para quién | Cómo se escribe | Quién registra |
|---|---|---|---|
| `ngjs-core` (raíz, **por defecto**) | TypeScript | clases + decoradores Angular (`@Component`, `@NgModule`, `@Injectable`, …) que estampan `ɵcmp`/`ɵmod`/… | `bootstrapApplication(AppModule)` camina `ɵmod` al arrancar |
| `ngjs-core/compat` | **JS puro**, sin build | forma funcional (`component(Foo).define({…})`) + decoradores legacy (Babel `{ legacy: true }`) | auto-registra al llamar `.define()` — **no se puede apagar** |

**No se mezclan.** Usás `ngjs-core` **o** `ngjs-core/compat`. Importar de las dos a
la vez duplica el registro (dos `ng-content`, dos `CoreModule`, …).

### `ngjs-core/core` — sustrato, no superficie de consumo

`ngjs-core/core` exporta los decoradores que **solo estampan** (sin motor) y el
sustrato compartido (clases-token, interfaces de lifecycle). No arranca nada por
sí solo. Sirve para dos cosas:

- que el motor de runtime y `compat` compartan un único contrato de metadata;
- ser el **punto de partida para migrar a Angular**: el código escrito contra
  `ngjs-core` (raíz) compila contra `ngjs-core/core` quitando el import del motor
  — las clases y decoradores quedan idénticos a Angular.

> El traductor build-time (un CLI que lea los decoradores + `design:paramtypes` y
> genere el registro AngularJS en build, en vez del motor en runtime) está
> **diferido**. `ng-js-vite` hoy solo procesa `templateUrl`/`styleUrl`; `ng-js-cli`
> se enfoca en scaffolding, reportes de migración y environments.

---

## La línea `core` ↔ `runtime` (frontera interna)

> **Si un traductor build-time lo generaría, la versión de runtime va en `src/runtime/`.**

Un traductor generaría, a partir de los decoradores + la metadata emitida:

- registro `.component()` / `.directive()` / `.service()` / `.filter()`
- `bindings` de `@Input`/`@Output`
- `$inject` de `design:paramtypes` + `@Inject`
- el forwarding `$onInit → ngOnInit`, `$onChanges → ngOnChanges`, …
- `link` de `@HostBinding` / `@HostListener`
- `require` de `@ViewChild`/`@ContentChild` con `read`
- `transclude` según `<ng-content>` del template

→ Todo eso lo hace el motor de `src/runtime/`: los decoradores de `$controller`,
`registerNgModule`, `applyConstructorInject`, `createComponent`,
`SelectorRegistry`, el `CoreModule` que instala los bridges.

`src/core/` **no** contiene:

- `NgZone`, el puente Zone→`$digest`
- `ApplicationRef`, `PlatformRef`, `bootstrapApplication`
- `ErrorHandler`, `APP_INITIALIZER`
- las clases-token (`ElementRef`, `EventEmitter`, `InjectionToken`, `ChangeDetectorRef`,
  `TemplateRef`, `ViewContainerRef`, `ComponentRef`, `QueryList`, `Injector`, `DestroyRef`)
- las interfaces de lifecycle

→ Eso es **sustrato compartido**: vive en `src/core/`, lo usan las dos superficies.

**Restricción de `src/core/`:** no introspecta `ɵcmp`/`ɵmod`/`design:paramtypes`
para decidir qué registrar. Sí depende de `angular` + `zone.js` + `rxjs` (ahí vive
`platform`). Los decoradores de `src/core/` **solo estampan**, sin side-effects.

---

## Contrato de metadata: un modelo, varios productores

`ɵcmp` / `ɵdir` / `ɵpipe` / `ɵmod` tienen una **forma base idéntica** la estampe quien
la estampe — `@Component` de `core`, `component().define()` de `compat`, o (en el
futuro) un CLI leyendo el AST. El motor consume esa forma base igual.

- Metadata de **miembro** (`@Input`/`@Output`/`@HostBinding`/…) → bucket por
  `prototype` (WeakMap), para que el merge de subclases funcione caminando la
  cadena de prototipos.
- Def de **clase** (`ɵcmp`/`ɵmod`/…) → estático en el constructor, con el bucket de
  prototype ya fusionado adentro al momento de `.define()`.
- Lo runtime-only (hints de auto-inject, override de `$name`, aceptar `$element`
  por ctor, …) va en un **anexo** aparte, nunca pisando un campo portable. Así el
  código escrito contra `ngjs-core` **compila** contra `ngjs-core/core` (perdés el
  anexo — que es justo lo que un traductor build-time resolvería distinto).

---

## `ngjs-core/common`

Las cuatro directivas estructurales (`ng-content`, `ng-template`, `ng-container`,
`ng-template-outlet`) tienen **dos formas** en el árbol:

- `src/runtime/common/` — objetos `angular.IDirective` a mano + el `angular.module`
  (`ng.js.common`) que los registra imperativamente. **Es lo que exporta
  `ngjs-core/common`.**
- `src/common/` — las mismas como clases `@Directive` que **solo estampan**, más
  `CommonModule` (`@NgModule` que estampa). Forma `core` / Angular; hoy no está en
  `exports` (queda para el traductor build-time / la migración).

---

## Árbol

```
ngjs-core/
  core/         decoradores (solo estampan) · def contract · markers · store
                tokens + Impl · interfaces de lifecycle · afterNextRender
    platform/   PlatformRef · platformBrowser · ɵbootstrapModules · NgZone ·
                ApplicationRef · ErrorHandler · APP_INITIALIZER · ConfigProviderFactory
  common/       NgContent/NgTemplate/NgContainer/NgTemplateOutlet como @Directive
                CommonModule (@NgModule) — forma core, sin exponer
  runtime/      (implementación del modo por defecto — sin path público propio)
    index.ts    bootstrapApplication(AppModule) · registerNgModule · createComponent
    common/     las 4 directivas peladas + wiring imperativo  → ngjs-core/common
    animations/ i18n/ platform-browser/ cdk/  → ngjs-core/animations, /i18n, …
    bridges/    decorateController* · ng-ref-bridge · ng-disabled
    core-module.ts   instala los bridges en el grafo de angular.module
    testing/    configureTestingModule({ imports:[...] })  → ngjs-core/testing
  compat/       forma funcional + decoradores legacy, auto-registran al definir
```

`exports` (superficie pública):

```jsonc
{
  ".":                "./dist/index.js",              // runtime — por defecto
  "./core":           "./dist/core/index.js",         // sustrato / migración a Angular
  "./compat":         "./dist/compat/index.js",       // JS puro
  "./common":         "./dist/runtime/common/index.js",
  "./animations":     "./dist/runtime/animations/index.js",
  "./i18n":           "./dist/runtime/i18n/index.js",
  "./cdk/a11y":       "./dist/runtime/cdk/a11y/index.js",
  "./cdk/layout":     "./dist/runtime/cdk/layout/index.js",
  "./platform-browser":"./dist/runtime/platform-browser/index.js",
  "./testing":        "./dist/runtime/testing/index.js",
  "./router":         "./dist/router/index.js",
  "./rxjs-interop":   "./dist/rxjs-interop/index.js",
  "./platform":       "./dist/core/platform/index.js",
  "./i18n/locales/*": "./dist/i18n/locales/*.js"
  // http / pipes: solo desde la raíz (".")
}
```

Ya no hay namespace `ngjs-core/runtime/*`: `src/runtime/` es la implementación
interna del modo por defecto y de los subpaths de features.
