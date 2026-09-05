# Capas de `ngjs-core`

`ngjs-core` se consume por una de **tres** superficies mutuamente excluyentes. La
diferencia entre ellas es **quién traduce los decoradores a registro de AngularJS**:
el CLI en build-time, el motor de runtime, o el motor de runtime siempre-encendido.

> El núcleo "lite" original (lo que vivía en `ngjs-core/reference/` — decoradores
> AngularJS-flavored, menos superficie Angular, menos breaking changes) se movió a
> su propio proyecto en `../ngjs-core-lite`. No comparte código con este `ngjs-core`.

| Superficie | Para quién | Decoradores | Quién registra |
|---|---|---|---|
| `ngjs-core/core` + `ngjs-core/common` | TS **con CLI** (`ng-js-vite`) | estampan `ɵcmp`/`ɵmod`/… y nada más | el transform, en build |
| `ngjs-core/runtime` (+ `runtime/core`, `runtime/common`, `runtime/testing`) | TS **sin CLI** | los mismos, estampan nomás | `bootstrapModuleRuntime(AppModule)` camina `ɵmod` al arrancar |
| `ngjs-core/compat` | **JS puro**, sin build | forma funcional + decoradores legacy (Babel `{ legacy: true }`) | auto-registra al llamar `.define()` — **no se puede apagar** |

**No se mezclan.** Usás `ngjs-core` + CLI **o** `ngjs-core/runtime` **o**
`ngjs-core/compat`. Importar de dos superficies a la vez duplica el registro
(dos `ng-content`, dos `CoreModule`, …).

---

## La línea `core` ↔ `runtime`

> **Si el CLI lo generaría, la versión de runtime va en `/runtime`.**

El CLI genera, a partir de los decoradores + la metadata emitida:

- registro `.component()` / `.directive()` / `.service()` / `.filter()`
- `bindings` de `@Input`/`@Output`
- `$inject` de `design:paramtypes` + `@Inject`
- el forwarding `$onInit → ngOnInit`, `$onChanges → ngOnChanges`, …
- `link` de `@HostBinding` / `@HostListener`
- `require` de `@ViewChild`/`@ContentChild` con `read`
- `transclude` según `<ng-content>` del template

→ Todo eso, en modo sin-CLI, lo hace el motor de `/runtime`: los decoradores de
`$controller`, `registerNgModule`, `applyConstructorInject`, `createComponent`,
`SelectorRegistry`, el `CoreModule` que instala los bridges.

El CLI **no** genera:

- `NgZone`, el puente Zone→`$digest`
- `ApplicationRef`, `PlatformRef`, `bootstrapApplication`
- `ErrorHandler`, `APP_INITIALIZER`
- las clases-token (`ElementRef`, `EventEmitter`, `InjectionToken`, `ChangeDetectorRef`,
  `TemplateRef`, `ViewContainerRef`, `ComponentRef`, `QueryList`, `Injector`, `DestroyRef`)
- las interfaces de lifecycle

→ Eso es **sustrato compartido**: vive en `ngjs-core/core`, lo usan las tres superficies.

**Restricción de `/core`:** no introspecta `ɵcmp`/`ɵmod`/`design:paramtypes` para
decidir qué registrar. Sí depende de `angular` + `zone.js` + `rxjs` (ahí vive
`platform`). Los decoradores de `/core` **solo estampan**, sin side-effects.

---

## Contrato de metadata: un modelo, varios productores

`ɵcmp` / `ɵdir` / `ɵpipe` / `ɵmod` tienen una **forma base idéntica** la estampe quien
la estampe — `@Component` de `core`, `@Component` de `runtime/core`,
`component().define()` de `compat`, o el CLI leyendo el AST. El motor y el CLI
consumen esa forma base igual.

- Metadata de **miembro** (`@Input`/`@Output`/`@HostBinding`/…) → bucket por
  `prototype` (WeakMap), para que el merge de subclases funcione caminando la
  cadena de prototipos.
- Def de **clase** (`ɵcmp`/`ɵmod`/…) → estático en el constructor, con el bucket de
  prototype ya fusionado adentro al momento de `.define()`.
- Lo runtime-only (hints de auto-inject, override de `$name`, aceptar `$element`
  por ctor, …) va en un **anexo** aparte, nunca pisando un campo portable. Así el
  código escrito contra `runtime/core` **compila** contra `core` (perdés el anexo,
  que es justo lo que el CLI resolvía distinto).

---

## `common` vs `runtime/common`

Las cuatro directivas estructurales (`ng-content`, `ng-template`, `ng-container`,
`ng-template-outlet`) tienen **dos implementaciones paralelas**:

- `ngjs-core/common` — clases `@Directive` que **solo estampan** metadata. El CLL
  las vuelve `.directive()`.
- `ngjs-core/runtime/common` — las mismas **peladas**: objetos `angular.IDirective`
  a mano, sin decorador, registradas imperativamente por el motor.

Solo una se registra. `CommonModule` (`@NgModule` que estampa) vive en `common`;
su wiring imperativo equivalente vive en `runtime/common`.

---

## Árbol

```
ngjs-core/
  core/         decoradores (solo estampan) · def contract · markers · store
                tokens + Impl · interfaces de lifecycle · afterNextRender
    platform/   PlatformRef · platformBrowser · bootstrapApplication · NgZone ·
                ApplicationRef · ErrorHandler · APP_INITIALIZER · ConfigProviderFactory
  common/       NgContent/NgTemplate/NgContainer/NgTemplateOutlet como @Directive
                CommonModule (@NgModule)
  runtime/
    index.ts    bootstrapModuleRuntime(AppModule) · registerNgModule · createComponent
    core/       re-export de ngjs-core/core (identidad preservada)
    common/     las 4 directivas peladas + wiring imperativo
    bridges/    decorateController* · ng-ref-bridge · ng-disabled
    core-module.ts   instala los bridges en el grafo de angular.module
    testing/    configureTestingModule({ imports:[...] }) sobre angular.mock
  compat/       forma funcional + decoradores legacy, auto-registran al definir
```

`exports`:

```jsonc
{
  "./core":            "./dist/core/index.js",
  "./common":          "./dist/common/index.js",
  "./runtime":         "./dist/runtime/index.js",
  "./runtime/core":    "./dist/runtime/core/index.js",
  "./runtime/common":  "./dist/runtime/common/index.js",
  "./runtime/testing": "./dist/runtime/testing/index.js",
  "./compat":          "./dist/compat/index.js"
  // http / router / rxjs-interop / pipes / animations: cada uno parte core/runtime
  // con la misma regla, más adelante
}
```

---

## Orden de trabajo

1. **`docs/CAPAS.md`** ← este archivo.
2. **Mover a la estructura** (sin cambiar lógica): reconfigurar `exports`,
   tsconfig paths, entries de esbuild. Suite de `ngjs-core` sigue verde.
3. **`bootstrapModuleRuntime(AppModule)`** + `runtime/testing`. Se borran los
   `registerNgModule(X)` sueltos al final de `core-module`/`common-module`/`ngb.module`
   — los reemplaza el walk.
4. **`runtime/common` pelado**; `common` queda solo estampando.
5. **Revertir los hacks en `ngb-js`**, re-apuntar a `ngjs-core/runtime`, migrar por lotes.
6. **`compat`**.
7. (después) el CLI de verdad, que es lo que hace útil a `/core` a secas.
```
