# Orden de construcción

Secuencial por dependencia. Cada etapa cierra cuando su criterio pasa en verde.
Cada sección de `CONCEPTOS.md` cae en alguna etapa (columna «cubre»), salvo las de
codegen / transform / codemod, que son del CLI `ng-js-cli` (que parsea con
`ng-js-vite`) y no de este repo. Regla: una etapa **no** está lista solo porque
los archivos existen — lo está cuando pasan sus contratos, comportamiento,
registro y test.

Leyenda: ✅ cerrada · 🚧 en progreso · ⬜ no empezada. La numeración salta 10 y 19
(codegen y codemod inverso — ver arriba); el resto de las referencias cruzadas a
números de etapa siguen valiendo.

## Regla de coherencia — dónde vive cada superficie

- **Core:** runtime + DI + metadata con **forma Angular en la clase** (`@Component`,
  `@ViewChild`, `Routes`, `inject`, `Router`, `AnimationBuilder`). En el **template**,
  core usa **solo AngularJS nativo** (`<ui-view>`, `ui-sref`, `ui-sref-active`,
  `ng-ref`, `ng-if`, clases `.ng-enter`/`.ng-leave` de `ngAnimate`).
- **Excepción:** construcciones con nombre Angular **sin equivalente nativo** son
  primitivas y viven en core igual (`<ng-template>`, `<ng-content>`, `<ng-container>`).
- **Fuera de alcance de este repo:** la sintaxis de template estilo Angular moderno
  (`<router-outlet>`, `routerLink`, `#ref`, `*ngIf`, `[@trigger]`) y todo el
  codegen / transform / codemod son del CLI `ng-js-cli` (que parsea con
  `ng-js-vite`). Van de la mano con core pero son proyectos aparte — acá se
  referencian, no se listan como pendientes.

---

## Etapa 0 — Terreno ✅

**Cubre:** —
**Criterio de cierre:** un test trivial con `angular.mock` corre.

- [x] `src/` nuevo
- [x] tsconfig con `experimentalDecorators` + `emitDecoratorMetadata`
- [x] `reflect-metadata`
- [x] harness vitest + jsdom + `angular-mocks`

## Etapa 1 — Zona ✅

**Cubre:** Detección de cambios (`NgZone`/`run`/`runOutsideAngular`), «RxJS bajo el digest», `Promise` que muta el modelo.
**Criterio de cierre:** promesa nativa dentro de la zona dispara `$digest`; `runOutsideAngular` no.

- [x] `zone-flags` + `import "zone.js"`
- [x] `NgZone` real (`abstract` + `NgZoneImpl` facade sobre el fork de `Zone`)
- [x] `digest-bridge` (fork + tracking + `$digest` guardado)
- [x] `EventEmitter` (clase mínima: `Subject` + `emit`, para los eventos de `NgZone`)

## Etapa 2 — Bootstrap y aplicación ✅

**Cubre:** Bootstrap y módulo, base de componentes lazy.
**Criterio de cierre:** bootstrappear un `angular.module` a mano; `whenStable` resuelve; `APP_INITIALIZER` corre antes; registrar un componente **después** del bootstrap con los providers capturados.

- [x] `bootstrap.ts`
- [x] `ApplicationRef`
- [x] `APP_INITIALIZER` (bloque `.run`)
- [x] `ErrorHandler` (`.decorator('$exceptionHandler')`)
- [x] captura de providers de config (`$compileProvider`/`$controllerProvider`/`$provide`/`$filterProvider`/`$animateProvider`) para registro diferido

## Etapa 3 — DI app-level ✅

**Cubre:** Inyección de dependencias (app-level).
**Criterio de cierre:** `@Injectable` con ctor tipado y `@Inject(TOKEN)` se resuelve; `useValue`/`useFactory` funcionan.

- [x] `InjectionToken` (+ `factory` para tree-shakable — el "momento de hacer registry" queda como decisión abierta, ver `CONCEPTOS.md`)
- [x] `@Injectable()` / `injectable()` (piel JS)
- [x] `@Inject(token)`
- [x] `Injector` (abstracta) + `InjectorImpl`, `inject()` (función libre)
- [x] `forwardRef` / `resolveForwardRef` / `isForwardRef`
- [x] recetas de provider: `useClass` / `useExisting` / `useValue` / `useFactory` / `multi`
- [x] `reflect.ts`: `ReflectInjection`/`ensureInject` (`$inject` nativo con tokens) + `design:paramtypes` vía `@Injectable`
- [ ] `ModuleWithProviders` — diferido, necesita `@NgModule` real (etapa 4/futuro)

## Etapa 4 — Metadata (sin codegen) ✅

**Cubre:** Componente (decoradores), Directivas (decoradores), «Superficie de autoría — JS y TS a la par».
**Criterio de cierre:** la misma clase vía `component(Clase).define(def)` y vía `@Component(def)` da el mismo `ComponentDef`.

- [x] núcleo: `stampComponentDef`/`stampDirectiveDef`/`stampPipeDef`/`stampNgModuleDef` (estampan, no parsean)
- [x] `ComponentDef` / `DirectiveDef` / `PipeDef` / `NgModuleDef` (`def.ts`)
- [x] piel JS: `component(Clase).define(def)` / `directive()` / `pipe()` / `ngModule()`
- [x] marcadores JS: `input()` / `output()` / `model()` / `bindings()` (tipos de instancia sin declarar aparte)
- [x] piel TS: `@Component` / `@Directive` (+ `exportAs`) / `@Pipe` / `@NgModule`
- [x] `@Input` (+ `required`/`transform`/`alias`) / `@Output` / `@Model` (`twoWay`, binding `'='` nativo de AngularJS)
- [x] bucket por `prototype` (`store.ts`) + `collectBindings`/`collectHost`, fusión en subclases
- [x] `@HostBinding`/`@HostListener`/`@Attribute` — **movidos a etapa 5** (ya hechos ahí; acá solo quedaba la metadata, y terminó yendo junto con su wiring)

## Etapa 5 — Lifecycle + wiring del inyector ✅

**Cubre:** Componente (ciclo de vida, bridge), `@Component({ providers })`, `@Self`/`@Host`/`@SkipSelf`/`@Optional`, `@HostBinding`/`@HostListener`/`@Attribute`.
**Criterio de cierre:** controller con `ngOnInit`/`ngOnChanges`/`ngOnDestroy` recibe las llamadas; `@Component({ providers: [X] })` da instancia nueva de `X` por componente y un hijo la resuelve; `node.get` resuelve padre→hijo, cae a `$injector`, respeta los modificadores; `afterNextRender` corre tras el digest; `@HostListener('click')` dispara al clickear el host.

- [x] `core/lifecycle/shared.ts`: `decorateControllerWith($delegate, {augmentLocals?, onInstance?})` — resuelve el caso `later: true` de `.component()`/`bindToController` (confirmado con un probe real), reusado por todos los decoradores de esta etapa en vez de un `$controller` decorator gigante
- [x] `lifecycle-bridge.ts`: `ngOnInit` → `$onInit`
- [x] `ngOnChanges` → `$onChanges` (probado: el objeto real trae `currentValue`/`previousValue`/`isFirstChange()`, compatible tal cual con `SimpleChanges`)
- [x] `ngOnDestroy` → `$onDestroy`
- [x] `ngDoCheck` → `$doCheck`
- [x] `ngAfterViewInit`/`ngAfterContentInit` → `$postLink` (brecha documentada: AngularJS no separa view/content, orden preservado igual)
- [x] `ElementRef` (`core/refs/element-ref.ts`, abstracta + `ElementRefImpl`) + `element-ref-bridge.ts` (`augmentLocals`, primer caso validando el mecanismo, por-instancia)
- [x] `SelectorRegistry` (`core/metadata/selector-registry.ts`) — `Map<tagName, Clase>`; hace falta porque `.component()` no le da la clase real a `$controller` (solo el string genérico `"controller"`, confirmado con un probe), se resuelve mirando `$element[0].tagName`
- [x] `@HostListener(event, args?)` / `hostListener()` (JS) + `host-listener-bridge.ts` (`nativeElement.addEventListener`, no `$element.on()` de jqLite)
- [x] `@HostBinding(hostProperty)` / `hostBinding()` (JS) + `host-binding-bridge.ts` (`$scope.$watch` por binding — reacciona a cambios, no solo una vez —, parseo `class.x`/`style.x`/`attr.x`/propiedad DOM plana, **desregistrado en `$destroy`**)
- [x] `@Attribute(name)` (`core/metadata/attribute.ts`) + `attribute-bridge.ts` — token sintético `$attr:nombre` en el `$inject` (mismo bucket que `@Inject`, vía `setInjectOverride` exportado de `injectable.ts`), resuelto con `SelectorRegistry` + `augmentLocals`; JS puro: `static $inject = ['$attr:nombre']` directo, sin decorador ni helper
- [x] **Inyector jerárquico** (`ElementInjectorNode`, `core/di/element-injector-node.ts`): `providers`/`cache`/`parent`, `node.get(token, flags)` con recetas `useClass`/`useValue`/`useFactory`/`useExisting`/`multi` y fallback a `$injector`, modificadores `@Self`/`@Host`/`@SkipSelf`/`@Optional` (`core/di/inject-flags.ts`), anclado por `$element.data`/`inheritedData` en `scoped-injector-bridge.ts` — mismo mecanismo de `augmentLocals` + `SelectorRegistry` que `@Attribute`; se registra antes que `element-ref-bridge`/`attribute-bridge` (corre su `augmentLocals` al final, así saltea con `Object.hasOwn` las claves que ya pusieron los otros bridges en vez de intentar resolverlas también)
- [x] `afterNextRender()` / `afterRender()` (`core/lifecycle/after-render.ts`): NO es `$scope.$postDigest()` — confirmado con un probe real que tanto `$postDigest` como `$applyAsync` auto-reencolado desde adentro de sí mismos drenan síncrono en el mismo flush (mismo timer, no uno nuevo por vuelta), no esperan a un digest futuro real. En cambio: `AfterRenderEventManager` (servicio interno, sin abstract/Impl — no es token público) que `ApplicationRefImpl.tick()` notifica justo después de cada `$digest()` real; global a la app, no por-componente (como en Angular real)

## Etapa 6 — Refs y vistas ✅

**Cubre:** Proyección y vistas dinámicas (refs + componentes lazy), Primitivas de `ngjs-core`.
**Criterio de cierre:** tests portados (`view-container-ref`, `create-component`) verdes; `createComponent` de un `@Component` cargado con `import()`.

- [x] `ElementRef` (adelantado en etapa 5, para `augmentLocals`)
- [x] `ChangeDetectorRef` (`core/change-detection/change-detector-ref.ts`) — adelantado de etapa 9 (dependencia dura de `ViewRef`): `markForCheck()` no-op (Zone ya dispara solo), `detectChanges()` → `$scope.$digest()` síncrono, `detach()`/`reattach()` → `$scope.$suspend()`/`$resume()` — **no** el `$applyAsync()` que usa el `reference/`, descartado a favor de lo que ya dice CONCEPTOS
- [x] `ComponentRef` (`core/refs/component-ref.ts`): `setInput`/`instance`/`destroy`/`onDestroy` — `setInput` llama `$onChanges` (no `ngOnChanges` directo, respeta lo que haya puesto `lifecycle-bridge.ts`)
- [x] `ViewRef` (`core/refs/view-ref.ts`): extiende `ChangeDetectorRef` + `destroy`/`destroyed`/`onDestroy`
- [x] `EmbeddedViewRef` (`core/refs/embedded-view-ref.ts`): clona vía `$transclude(scope, () => undefined)`, `rootNodes` sueltos sin parentNode
- [x] `ViewContainerRef` (`core/refs/view-container-ref.ts` + `lifecycle/view-container-ref-bridge.ts` para inyección por-instancia) — `insert`/`remove`/`detach`/`move`/`clear`/`get`/`indexOf`; **sin** `createEmbeddedView` todavía (depende de `TemplateRef`, movido a etapa 8)
- [x] `createComponent` (`core/create-component.ts`): acepta una clase recién importada — no un string como en `reference/` —, deriva selector + `bindings` (`<`/`=`/`&`) de `getComponentDef`, la registra vía `ConfigProviderFactory.current` si `$injector` no la conoce todavía (mismo mecanismo que el chunk lazy de etapa 2). **Bug real encontrado y corregido con un probe**: `$compileProvider.component(name, ...)` necesita `name` en camelCase — registrar con el selector kebab-case literal (`"my-widget"`) no matchea `<my-widget>`, porque `$compile` normaliza el tag observado a camelCase antes de buscarlo en el injector

## Etapa 7 — Queries (solo View, por clase) ✅

**Cubre:** `@ViewChild(ren)` por clase, `QueryList`. Movidos a etapa 8: `@ContentChild(ren)` (necesita el binding explícito scope-transcluido→registry que solo se puede armar bien desde adentro de `<ng-content>` — sin eso, caminar `$scope.$parent` no llega al registry del componente que recibe la proyección, a diferencia de `viewChild`); y `ng-ref` (locator por string + `read`) — lo dejamos completo o no lo hacemos: `read` necesita que `TemplateRef`/`ViewContainerRef` sean descubribles por `$element` (`ngTemplate`/`viewContainerRef` como casos especiales, igual que en `reference/`), y hoy `ViewContainerRef` solo se inyecta por locals, no es descubrible desde afuera — a medias no sirve.
**Criterio de cierre:** test `dynamic-children-queries` (parte de View, por clase) portado verde.

- [x] `viewChild` (`core/queries/view-child.ts`) + `viewChildren` (`core/queries/view-children.ts`) — JS (marcador de instancia) y TS (`@ViewChild`/`@ViewChildren`, bucket por-prototipo)
- [x] `QueryList` (`core/queries/query-list.ts`) — porteado casi literal de `reference/`, sin dependencia de AngularJS (solo RxJS)
- [x] `ViewQueryRegistry` (`core/queries/view-query-registry.ts`) + `query-context.ts` (lookup de registry por `$scope`) + `controller-tokens.ts` (clase + ancestras) — resolución automática por clase, sin `ng-ref` todavía; sin orden de documento (candidatos en orden de construcción)
- [x] `ng-ref-bridge.ts` (`core/queries/ng-ref-bridge.ts`) — arma el registry por instancia, resuelve en `$postLink`. De paso: arreglé un bug real de composición en `lifecycle-bridge.ts` (pisaba `$postLink` con "si no existe" — con dos bridges queriendo el mismo hook, uno se quedaba afuera; ahora `chainInstanceMethod` en `shared.ts` encadena en vez de pisar)

## Etapa 8 — Common ✅

**Cubre:** Proyección (`<ng-content>`, `<ng-template>`, `*ngTemplateOutlet`, `<ng-container>`), `@ContentChild`/`@ContentChildren` y `ng-ref` (locator por string + `read`) — los tres movidos de etapa 7, los tres necesitan lo que se construye acá. `NgComponentOutlet` quedó afuera: no hay nada portable en `reference/` (nunca se itemizó como entregable concreto) — si hace falta más adelante, es una pieza nueva a diseñar, no un port.
**Criterio de cierre:** proyección multi-nivel + outlet con contexto; `@ContentChild`/`@ContentChildren` resuelven contenido proyectado real; `ng-ref`/`ng-ref-read` completo (`$element`, otra directiva por nombre, `ngTemplate`, `viewContainerRef`).

- [x] `TemplateRef` (`core/refs/template-ref.ts`, movido de etapa 6) — decorado con `@Directive({selector: "ng-template"})` (solo metadata, como el resto del framework); registro real vía `TemplateRef.$factory` a mano. Hallazgo empírico: para `restrict:'E'` + `transclude:'element'`, el controller NO queda recuperable con `.controller(nombre)`/`.data()` sobre el comentario placeholder — hace falta `require` desde otra directiva co-ubicada (confirmado con test real)
- [x] `ng-template` (+ `let-*`/`$implicit`) — `let-nombre="clave"` resuelve contra `context.clave` (`$implicit` por default)
- [x] `ViewContainerRef.createEmbeddedView` (`core/refs/view-container-ref.ts`, retomado de etapa 6, ahora que existe `TemplateRef`)
- [x] `ViewContainerRef` descubrible por `$element` (`view-container-ref-bridge.ts` ahora también hace `$element.data('$viewContainerRefController', vcr)`) — a diferencia de `reference/` (que solo lo exponía vía el directive `<ng-container>`), acá cualquier elemento con controller lo tiene, sin necesitar ese directive aparte
- [x] `ng-content` (`common/ng-content.ts`; falta `select`/reproyección) — llama `$transclude` a mano y bindea el scope transcluido como dueño de contenido de los registries de su propio scope + los heredados (proyección multi-nivel)
- [x] `@ContentChild` / `@ContentChildren` (`core/queries/content-child(ren).ts`, movidos de etapa 7): mismo mecanismo que `viewChild`/`viewChildren`, con `contentQueries`/`contentCandidates` separados en `ViewQueryRegistry`. **Bug real encontrado e integrando**: `registerScopeQueryRegistry` guardaba UN registry por `$scope` (`.set()`, pisa) — pero un directive sin scope propio (`<ng-content>`, vive en el mismo scope que el componente que lo declara) también pasa por ahí, y pisaba el registry de ese componente (con su `@ContentChild` ya registrada) con uno vacío. Pasado a `WeakMap<scope, registry[]>` (agrega, no pisa), confirmado con debug de `$scope.$id` real antes de arreglarlo
- [x] `ng-ref` (`core/queries/ng-ref-bridge.ts`, movido de etapa 7): locator por string + `read` (`$element` / otra directiva por nombre / `ngTemplate` vía `require` / `viewContainerRef` vía `$element.data()`). **Reemplaza la directiva nativa por completo, no la deja correr al lado** — la nativa tiene `priority: -1` (la más baja posible) así que su `pre`-link corre DESPUÉS de cualquiera con prioridad más alta y pisaría el valor resuelto acá; peor, para `ng-ref-read="ngTemplate"` la nativa intenta su propio `.data()` que ya confirmamos roto para `transclude:'element'` y tira error. Confirmado leyendo el código fuente real de `ngRefDirective` en `angular.js` (no asumido) antes de decidir el reemplazo en vez de agregar al lado como hace `reference/`
- [x] `ng-container` (`common/ng-container.ts`) — sin huella en el DOM (`transclude:'element'`, no renderiza su propio contenido solo); expone el `ViewContainerRef` ya inyectado por ctor (no uno propio, evita duplicar instancia)
- [x] `ng-template-outlet` (`common/ng-template-outlet.ts`) — binding nativo (`bindToController` con `<`, `$onChanges` nativo de AngularJS, no el forwarding `ngX→$X`), destruye+recrea la vista embebida en cada cambio de template

## Etapa 9 — `NgDisabled` ✅

**Cubre:** `[disabled]`/`NgDisabled`. `ChangeDetectorRef` se adelantó a etapa 6 (dependencia dura de `ViewRef`) — ver esa sección.
**Criterio de cierre:** test de `NgDisabled` portado verde.

- [x] `ChangeDetectorRef` (passthrough): `detectChanges` → `$digest` (etapa 6)
- [x] `markForCheck` → no-op (etapa 6)
- [x] `detach` / `reattach` (etapa 6)
- [x] `NgDisabled` (`core/ng-disabled.ts`) — **no reemplaza** la directiva nativa `ngDisabled` (a diferencia de `ng-ref`, acá no hay conflicto: nativa no tenía controller propio), solo le agrega `NgDisabledController` para que otra directiva co-ubicada se entere de los cambios (`require: '?ngDisabled'`) sin reimplementar el watch booleano. **Bug real encontrado con un probe**: `$attrs.$observe('disabled', ...)` entrega el valor ya como **booleano** (`disabled` es un `BOOLEAN_ATTR` nativo), no como string `"disabled"`/`"true"` — el reference original chequeaba contra strings, no funcionaba; confirmado logueando el valor observado antes de corregirlo

_(No hay etapa 10. El codegen de decoradores → `angular.module().component()/…` es
del CLI `ng-js-cli` / `ng-js-vite`. En el modo sin build step el equivalente ya lo
hace el motor de `src/runtime/` — ver `docs/CAPAS.md`.)_

## Etapa 11 — Pipes ✅

**Cubre:** Pipes. Sin nada portable en `reference/` (no existe ahí) — diseño nuevo, no adaptación.
**Criterio de cierre:** `| async` refleja emisiones; `keyvalue` sobre un objeto.

- [x] `PipeTransform` (`src/pipes/pipe-transform.ts`) — `createPipeFilter(Clase)` envuelve una clase `@Pipe` en un factory de `.filter()`; como el resto del framework, sigue siendo registro manual (`module.filter(name, createPipeFilter(Clase))`), `@Pipe` solo estampa metadata. `pure:false` marca `$stateful` (mecanismo nativo de AngularJS — hay que ponerlo en la función que `$filter(name)` REALMENTE devuelve, no en el factory de registro; confirmado leyendo `isStateless()` en `angular.js`)
- [x] filtros built-in que faltan (`src/pipes/{title-case,percent,key-value}.ts`) — `keyvalue` es `$stateful` a propósito (como el real) pero **memoiza el resultado** (mismas claves/valores → misma referencia de array): sin eso, al ser `$stateful` se llama siempre y devolvía objetos nuevos cada vez, lo que metía a `ng-repeat` en loop infinito de digest (`$rootScope:infdig`) — encontrado con un test real, no asumido
- [x] `AsyncPipe` (`src/pipes/async-pipe.ts` + `core/lifecycle/async-pipe-bridge.ts`) — **no** es un `.filter()` global (esos son singleton de toda la app, sin acceso al `$scope` de quien lo usa). Se inyecta POR-INSTANCIA, igual que `ElementRef`/`ViewContainerRef` (`augmentLocals`, un `AsyncPipeImpl` nuevo por controller, ya resuelto contra su propio `$scope`) — se limpia solo en `$destroy`, sin pasarle nada a mano. Sintaxis en template: `{{ $ctrl.async.transform(value$) }}` en vez de `{{ value$ | async }}` (cambio de sintaxis a propósito, discutido con el usuario — es el costo de que la limpieza funcione de verdad)

## Etapa 12 — rxjs-interop ✅

**Cubre:** Reactividad §interop.
**Criterio de cierre:** `takeUntilDestroyed` completa en `$destroy`.

- [x] `DestroyRef` (`src/rxjs-interop/destroy-ref.ts`) + `core/lifecycle/destroy-ref-bridge.ts` — por-instancia como `ElementRef`/`AsyncPipe`. Implementado sobre un `Subject` de RxJS directo (no un `Set`/bandera a mano): al completarse, cualquier `.subscribe()` posterior recibe `complete()` sincrónico solo (confirmado leyendo `Subject._innerSubscribe`/`_checkFinalizedStatuses` en la fuente de rxjs) — es justo el comportamiento de "avisar ya mismo si ya se destruyó" que necesitábamos, gratis
- [x] `takeUntilDestroyed(destroyRef)` (`src/rxjs-interop/take-until-destroyed.ts`) — `destroyRef` es SIEMPRE explícito, no opcional (real Angular lo resuelve con `inject(DestroyRef)` ambiental; acá no hay eso). **Bug real encontrado leyendo la fuente de `takeUntil` en rxjs**: ese operador reacciona solo al `next()` del notifier, ignora su `complete()` (`noop` a propósito) — así que si el `DestroyRef` ya estaba destruido, un notifier ya completo nunca dispara nada vía `takeUntil` solo; hace falta el caso aparte (`EMPTY`) para cuando ya pasó
- [x] `outputToObservable` / `outputFromObservable` (`src/rxjs-interop/output-interop.ts`) — casi triviales, `EventEmitter` ya es un `Subject` (etapa 1)

## Etapa 13 — HTTP ✅

**Cubre:** Reactividad (filas HTTP).
**Criterio de cierre:** `HttpClient.get()` emite y su continuación corre bajo el digest; un interceptor modifica el request.

**Decisión de diseño (distinta de lo que decía este doc originalmente)**: `HttpClient` NO envuelve `$http` — pega directo contra `$httpBackend` (transporte crudo, sin el pipeline propio de `$http`) para tener control total del armado del request/response al estilo Angular real, con `HttpHeaders`/`HttpParams` como azúcar inmutable de verdad.

- [x] `HttpClient` (`src/http/http-client.ts`) — `$httpBackend` directo, no `$http`/`from(...)`
- [x] `HttpHeaders` / `HttpParams` (`src/http/http-{headers,params}.ts`) — inmutables, `set`/`append`/`delete` devuelven copia
- [x] `HttpInterceptor` → cadena tipo "onion" armada a mano (`src/http/http-interceptor.ts`, `buildInterceptorChain`), registrados vía `multi: true` (`HTTP_INTERCEPTORS`, mismo mecanismo de etapa 3) — no `$httpProvider.interceptors` (eso es de `$http`, que no usamos)
- [x] `HttpErrorResponse` (`src/http/http-response.ts`) — se emite como error del Observable, no como valor
- [x] Cancelación real: unsubscribe() aborta el XHR de verdad, vía el mecanismo de `timeout` como Promise que ya soporta `$httpBackend` nativo (confirmado leyendo su fuente real, no asumido) — un timeout numérico se implementa arriba con el mismo mecanismo

## Etapa 14 — platform-browser ✅

**Cubre:** Servicios de plataforma.
**Criterio de cierre:** `[innerHTML]` sanitizado; `Location.go()` cambia la URL; `BreakpointObserver` emite al cruzar un breakpoint. **✅ pasa** (`test/platform-browser/*.test.ts`, `test/cdk/layout/breakpoint-observer.test.ts`).

Subpaths: `ngjs-core/platform-browser` y su `angular.module` opt-in (`PlatformBrowserModule` / `platformBrowserModule()` / `providePlatformBrowser()` — `angular.module` opt-in, dep `ng.js.core`). `@angular/cdk` va aparte en `ngjs-core/cdk/{a11y,layout}`.

- [x] `DomSanitizer` / `SecurityContext` / `bypassSecurityTrust*` / `SafeHtml`…`SafeResourceUrl` — `src/platform-browser/security/`. `bypass.ts`: wrappers propios (`SafeValueImpl` + 5 subclases), `unwrapSafeValue`, `allowSanitizationBypassAndThrow` — **no** usa `$sce`. `html-sanitizer.ts`: **port de `@angular/core`** (`sanitization/html_sanitizer.ts`) — DOM inerte vía `DOMParser` + re-parse mXSS + serializer con allowlist de tags/atributos + saneo de URIs + `encodeEntities` + check de clobbering. Output byte-idéntico a Angular, **sin `ngSanitize`**. `url-sanitizer.ts`: `sanitizeUrl` (bloquea `javascript:` → `unsafe:`) + `sanitizeSrcset`. `dom-sanitizer.ts`: `sanitize(NONE)` passthrough · `HTML` → sanitizador · `STYLE` passthrough (Angular sacó el saneo de CSS en v10) · `SCRIPT`/`RESOURCE_URL` tiran salvo bypasseado · `URL` → `sanitizeUrl`. `.service` en `runtime/platform-browser` (`$inject = [DOCUMENT]`). Sin brechas. Test: `test/platform-browser/dom-sanitizer.test.ts`. _(La invocación automática en bindings de template — `[innerHTML]`, `[src]` — es codegen del CLI; `[innerHTML]` puntual lo cubre `ng-bind-html` nativo + `ngSanitize`.)_
- [x] `Title` — `abstract Title` + `TitleImpl` (`src/platform-browser/title.ts`, getter/setter sobre `DOCUMENT`), `.service` en `runtime/platform-browser`. El router aplica el título de la ruta vía `TitleStrategy` básico (`src/router/title-strategy.ts`): `abstract TitleStrategy` con `updateTitle(title)` + `DefaultTitleStrategy` (usa `Title` si está en el injector, si no `document.title`); custom con `{ provide: TitleStrategy, useClass }` en un `@NgModule`. `wireTitles` delega en el strategy en vez de `document.title = …`, y la `ResolveFn` del título recibe la `data` real del estado (unificado con `ActivatedRoute.title` vía `src/router/route-title.ts`). Tests: `test/platform-browser/title.test.ts`, `test/router/router-title-strategy.test.ts`.
- [x] `Meta` — `abstract Meta` + `MetaImpl` (`src/platform-browser/meta.ts`), port fiel del `Meta` de `@angular/platform-browser`: `addTag(s)` / `getTag(s)` / `updateTag` / `removeTag(Element)`, selector `name`/`property`, `httpEquiv`→`http-equiv`, `forceCreation` para tags repetibles. Todo DOM sobre `DOCUMENT`, `.service` en `runtime/platform-browser`. Sin integración con el router (Angular tampoco). Test: `test/platform-browser/meta.test.ts`.
- [x] `DOCUMENT` — `InjectionToken<Document>` (`src/platform-browser/dom-tokens.ts`); `runtime/platform-browser` lo provee como `.factory(["$document", ($document) => $document[0]])`. Test: `test/platform-browser/document-token.test.ts`.
- [x] `PlatformLocation` — `abstract` + `BrowserPlatformLocation` (`src/platform-browser/location/platform-location.ts`), wrapper sobre `$window.location`/`$window.history` (+ `DOCUMENT` para `getBaseHrefFromDOM`). `.service` en `runtime/platform-browser`.
- [x] `LocationStrategy` / `PathLocationStrategy` / `HashLocationStrategy` / `APP_BASE_HREF` — port de `@angular/common` (`src/platform-browser/location/location-strategy.ts`), sobre `PlatformLocation`. **No** hay default en `runtime/platform-browser` (como Angular): lo provee `RouterModule.forRoot` — `Path` por default, `withHashLocation()` → `Hash` (`{ provide: LocationStrategy, useClass: HashLocationStrategy }` + `$locationProvider.html5Mode(false)` para que UI-Router coincida). `router` ahora `require`ea `ng.js.platform-browser`. `APP_BASE_HREF` default `"/"`. Test: `test/platform-browser/location-strategy.test.ts`.
- [x] `Location` — `abstract` + `LocationImpl` (`src/platform-browser/location/location.ts`), port de `@angular/common`: `path()` / `go()` / `replaceState()` / `back()` / `forward()` / `historyGo()` / `getState()` / `isCurrentPathEqualTo()` / `normalize()` / `prepareExternalUrl()` / `subscribe()` (back/forward del navegador) / `onUrlChange()` (además en `go`/`replaceState` de esta instancia), sobre `LocationStrategy`. `.service` en `runtime/platform-browser` (solo resuelve con el router presente, que provee `LocationStrategy`). **Cierra el criterio `Location.go()` cambia la URL.** Test: `test/platform-browser/location.test.ts`.
- [x] `ViewportScroller` — `abstract` + `BrowserViewportScroller` (`src/platform-browser/viewport-scroller.ts`), port de `@angular/common`: `setOffset` / `getScrollPosition` / `scrollToPosition` / `scrollToAnchor` (por `id`/`name`, + shadow DOM, + `focus()`) / `setHistoryScrollRestoration`. `$inject = ["$window", DOCUMENT]`, todo DOM (no `$anchorScroll`). `.service` en `runtime/platform-browser`, standalone (sin integración con el router). Test: `test/platform-browser/viewport-scroller.test.ts`.
- [x] `BreakpointObserver` / `Breakpoints` / `MediaMatcher` — `@angular/cdk/layout` (`src/cdk/layout/`, subpaths `ngjs-core/cdk/layout` + `ngjs-core/cdk/layout`, `LayoutModule` / `provideLayout()`). Port fiel: `MediaMatcher` sobre `window.matchMedia` (fallback MQL falso si no está — jsdom/SSR); `BreakpointObserver.observe()`/`isMatched()` con `combineLatest` + primer estado sincrónico + resto `debounceTime(0)`, el callback del MQL corre en `NgZone.run()`; solo `addEventListener('change')` (sin `addListener` de Safari viejo). `Breakpoints` = strings de Material. **Cierra el criterio del breakpoint.** Test: `test/cdk/layout/breakpoint-observer.test.ts`.

## Etapa 15 — Forms ⬜

**Cubre:** Forms.
**Criterio de cierre:** `formGroup` reactivo con validación sync+async, `valueChanges`, y un control custom vía CVA.

- [x] `FormControl` / `FormGroup` / `FormArray` (`src/forms/{abstract-control,form-control,form-group,form-array}.ts`) — árbol reactivo puro TS/RxJS, sin AngularJS todavía: `value`/`status`/`errors`, `valueChanges`/`statusChanges` como `BehaviorSubject` (decisión de diseño, no `Subject` como Angular real — un suscriptor tardío ve el estado actual), validación sync+async (`PENDING` mientras corre el async, cancela la suscripción previa si se dispara de nuevo), `disable`/`enable` en cascada padre↔hijos, `markAsTouched`/`markAsDirty` (propagan hacia arriba) y `markAsUntouched`/`markAsPristine` (recalculan desde los hijos), `get()` por path string con punto o array. **Bug real encontrado con los tests**: `disabled`/`enabled` comparaban contra `_status === "DISABLED"` en vez del flag `_disabled` — `enable()` seteaba `_disabled = false` pero `updateValueAndValidity` todavía veía `_status` viejo y no volvía a validar. Tests: `test/forms/{form-control,form-group,form-array}.test.ts`
- [x] `FormBuilder` (`src/forms/form-builder.ts`) — `.control()`/`.group()`/`.array()`, mismo "control config" corto que `@angular/forms` (valor pelado, tupla `[valor, validators, asyncValidators]`, o un `AbstractControl` ya armado). Test: `test/forms/form-builder.test.ts`
- [x] `Validators.*` (`src/forms/validators.ts`) — `required`/`requiredTrue`/`email`/`min`/`max`/`minLength`/`maxLength`/`pattern`/`nullValidator`/`compose`/`composeAsync`, firma idéntica a `@angular/forms` (clase con solo estáticos a propósito, para que `Validators.required` se llame igual). Test: `test/forms/validators.test.ts`
- [x] `ControlValueAccessor` / `NG_VALUE_ACCESSOR` ↔ `NgModelController` (`src/runtime/bridges/control-value-accessor-bridge.ts`, ya existía de una sesión anterior) — opt-in vía `providers: [{ provide: NG_VALUE_ACCESSOR, ... }]` leído de la metadata estática de la clase (no resuelve por `ElementInjectorNode`); sobre `<input>`/`<textarea>`/`<select>` neutraliza el sync nativo (`$formatters`/`$parsers`/listeners DOM) para que el accessor sea el único lector/escritor. Test: `test/runtime/control-value-accessor.test.ts` (6/6 verde)
- [x] `NG_VALIDATORS` / `NG_ASYNC_VALIDATORS` → `$validators`/`$asyncValidators` (`src/forms/{validator,ng-validators}.ts` + `src/runtime/bridges/ng-validators-bridge.ts`) — mismo opt-in que `NG_VALUE_ACCESSOR`. Todas las directivas `Validator`/`AsyncValidator` del mismo elemento comparten UNA lista (expando en el propio `ngModel`) corrida por un único `$validators`/`$asyncValidators` de AngularJS; cada clave del `ValidationErrors` combinado se refleja en `$error` de verdad vía `$setValidity` (no tocando `$error` a mano), dejando el terreno listo para `ngMessages`. `control.value` es lo único fiable del `AbstractControl` pasado a `validate()` acá (brecha documentada: sin `[formGroup]` no hay árbol real). Brecha chica confirmada con un probe: además de las claves reales queda una clave extra en `$error` con el nombre interno del bridge (es AngularJS mismo gestionando su propia entrada del mapa, no evitable sin perder el enganche automático). Test: `test/runtime/ng-validators.test.ts` (5/5 verde)
- [x] directivas `[formGroup]` / `formControlName` / `formArrayName` (`src/runtime/forms/{form-group-directive,form-control-name-directive,form-array-name-directive,control-container}.ts`, módulo opt-in `formsModule()` en `src/runtime/forms/index.ts`, mismo patrón que `commonModule()`) — en Angular real ninguna de las tres lleva `ng-model` al lado; ese `NgModelController` hace falta igual acá abajo (documentado en `CONCEPTOS.md`: "ata el FormControl shim al NgModelController del input"). Resuelto sin pedirle nada extra al autor: `[formGroup]` usa un `compile` propio de AngularJS (`DirectiveDef.compile`, corre antes de que el compilador baje a los hijos — confirmado leyendo `buildDirectiveDefinition`/`compileNodes` antes de decidir esto) para inyectar un `ng-model` descartable en cada `formControlName`/`formArrayName` descendiente que no tenga uno ya, así el `NgModelController` real queda armado por debajo de punta a punta. `formArrayName`/`formControlName` se resuelven contra el `[formGroup]`/`formArrayName` ancestro más cercano vía `$element.data()`/`inheritedData()` (key propia, mismo mecanismo que `ElementInjectorNode`/`ViewContainerRef`) — no `require: '^^nombre'` de AngularJS, que no sirve para "el ancestro más cercano de cualquiera de estas dos directivas distintas". `AbstractControl.get([segmento])` ya coerciona el segmento al tipo que corresponda (string en `FormGroup`, número en `FormArray`), así que no hace falta que `formControlName` sepa contra cuál de las dos está resolviendo. **Bug real encontrado con un test** (`test/runtime/reactive-forms.test.ts`): escribir `ngModel.$modelValue`/`$processModelValue()` a mano se perdía — el watcher NATIVO de `ngModel` (vivo, mirando la misma expresión sintética) corre su propio chequeo inicial una sola vez y no hay revancha (un `$watch` no reintenta si SU PROPIA expresión no cambió, así que "pisar y competir" nunca funciona, sea cual sea el orden de registro). Arreglado escribiendo la expresión de scope en sí (`$parse(ngModelAttr).assign`, igual que `ngModelSet` interno) en vez de los campos del controller — un solo dueño del render, cero carrera. Vista→modelo: `ngModel.$viewChangeListeners` (después de `$parsers`) → `control.setValue()` + `markAsDirty()`; `$setTouched` envuelto (no reemplazado); errores del `FormControl` reflejados con el mismo `$setValidity` por clave que `ng-validators-bridge.ts`; `disabled` con `.prop()`. Test: `test/runtime/reactive-forms.test.ts` (6/6 verde). **Brecha documentada, fuera del alcance pedido**: `formGroupName` (anidar un `FormGroup` con nombre dentro de otro) no está — solo se armó `formArrayName` para `FormArray`, como pide el checklist; un `FormArray` de `FormGroup`s no tiene forma de direccionar los campos internos de cada fila todavía.
- [ ] `updateOn` → `ngModelOptions`
- [ ] errores (`ngMessages`)
- [ ] template-driven (`[(ngModel)]` / `#f="ngForm"` / `ngModelGroup`)

## Etapa 16 — Router ✅

**Cubre:** Router.
**Criterio de cierre:** navegación entre 2 rutas + guard + resolve + `ActivatedRoute.paramMap` emite; `loadComponent` y `loadChildren` con `import()` nativo cargan y montan el chunk. **✅ pasa** (`test/router/{router,router-lazy,router-lazy-children}.test.ts`).

Subpath propio: `ngjs-core/router`. `RouterModule.forRoot(routes)`/`forChild(routes)` devuelven un `angular.IModule` (que `@NgModule({ imports: [...] })` acepta) — encaja con `bootstrapApplication`, sin build step.

**Estado "estable"** (T1–T4 sin lazy): rutas anidadas · params / `queryParamMap` / `fragment` · `canActivate` + `canActivateChild` con `inject()` · `resolve` (con `data` mergeada) · `redirectTo` · `path: '**'` · `Route.title` → `document.title` + `ActivatedRoute.title` · `Router.navigate`/`navigateByUrl`/`url`/`events` · `loadComponent` lazy · `withHashLocation()` (default html5). Tests: `test/router/*.test.ts`.

**Template = AngularJS nativo** (ver "Regla de coherencia" arriba): el outlet es `<ui-view>`, los links `ui-sref` / `ui-sref-active`, o `Router.navigate` imperativo. Los equivalentes de sintaxis Angular (`<router-outlet>` / `routerLink`) están fuera de alcance — se quitaron del runtime (antes vivían en `src/router/router-link.ts`, borrado).

**`ui-sref` acepta también la forma URL** (`ui-sref="/algo/5?q=1#top"`, la misma sintaxis que `routerLink`): `decorateUiSrefWithUrl` (`src/router/ui-sref-url.ts`, wireado en `forRoot`) decora `uiSrefDirective` y, si el valor empieza con `/`, lo reescribe a `estado(params)` **antes** del `link` original — resolviendo con `urlService.match()` (states con `url` propia, params tipados) y `routerRegistry.pathToName` de fallback (componentless / `path: ""`). Así `path` (de la `Route`) y `ui-sref` matchean por construcción: los dos salen de la config del translator. El state name pelado (`ui-sref="algo"`) sigue funcionando igual; `ui-sref-active` y el click quedan intactos porque se delega en el `link` real. La forma dinámica `[routerLink]="['/x', id]"` la sigue armando el codemod (el nombre del estado no se watchea). Test: `test/router/router-sref-url.test.ts`.

- [x] tipos `Route`/`Routes` (`src/router/route.ts`)
- [x] traductor `Routes → $stateProvider.state()` (`state-translator.ts`): deriva `name` del árbol, URL relativa al padre, `component` de `ɵcmp.selector` en camelCase, `resolve` a la forma `{ key: ["$stateParams", fn] }`, `data` directo
- [x] `RouterModule.forRoot`/`forChild` (`router-module.ts` — `angular.module` con dep `ui.router`, `.config($stateProvider)`, `$urlRouterProvider.otherwise`)
- [x] `Router.navigate` / `navigateByUrl` (`router.ts` — sobre `$location.url` + `$transitions`; la promesa resuelve al `onSuccess`/`onError` real)
- [x] `ActivatedRoute` shim (`activated-route.ts` — `params`/`paramMap`/`data` como `BehaviorSubject` sobre `$transitions.onSuccess`; `snapshot` sincrónico)
- [x] `CanActivate` (`.run($transitions.onBefore({ to })`, guard `=== false` → aborta). **Guards funcionales inyectan servicios**: `canActivate: [() => inject(AuthService).ok]` funciona porque `inject()` lee `InjectorImpl.current` global, sin necesitar contexto (`test/router/router-guard-inject.test.ts`)
- [x] fix de colisión de nombres derivados (`dedupe` por padre; `"a/b"` y `"a.b"` → `"a_b"` / `"a_b_2"`)
- [x] `CanDeactivate` / `CanMatch` — `state-translator.ts`: `canDeactivate` → hook `onExit({ exiting: stateName })` (dispara cuando el componente va a destruirse); Angular le pasa la **instancia del componente**, que se resuelve del DOM en ese momento (`resolveRouteComponentInstance` — `angular.element(<tag>).controller(name)`, `src/router/route-component-registry.ts`); `false` aborta. `canMatch` → hook `onBefore({ to })` (corre **antes** de resolver `lazyLoad`, así una ruta `loadChildren` no baja el chunk si no matchea); `false` **aborta** la transición (no hay fallthrough en UI-Router — ver brecha). Bindings nuevos en `TranslatedRoutes` (`deactivateGuards`/`matchGuards`); wireados en `.run` (`wireDeactivateHook`/`wireMatchHook`, reusados por el handler `loadChildren`). Tests: `test/router/router-guards-tier5.test.ts`.
- [x] `canDeactivate` — firma completa `(component, currentRoute, currentState, nextState)` (`state-translator.ts` `wireDeactivateHook`): `component` = instancia del DOM o `null`; `currentRoute` = `{ params: transition.params("from"), data }` (la `data` estática viaja en el `DeactivateBinding`); `currentState`/`nextState` = `RouterStateSnapshot` **plano** `{ url, root }` (`url` de `stateService.href`, sin prefijo `#`; `root` = snapshot de la ruta más profunda, sin `.children`). El árbol completo sigue como brecha. Tests: `test/router/router-guards-tier5.test.ts`.
- [x] `Resolve` / `resolve` (solo `ResolveFn`; tokens `Type<T>` fuera del MVP)
- [x] `Route.data`
- [x] **Tier 2**: `redirectTo` (resuelve a state name: path hermano + `/absoluto`, sin `../`; `pathMatch` se ignora — UI-Router matchea la URL entera ≈ `'full'`; gana sobre `component`) · `path: '**'` (state con url greedy `/{ngjsCatchAll:.+}` — `.+` para no pisar la raíz `/`; último `**` gana) · `Route.title` string y `ResolveFn<string>` → título aplicado vía `TitleStrategy` (`.run($transitions.onSuccess)`, side-map `Map<stateName, title>`; la `ResolveFn` recibe el mismo contexto que `ActivatedRoute.title` — `params` + `data` mergeada (estática + `resolve`) + `queryParams` + `fragment` —, unificado en `src/router/route-title.ts`: `pickRouteTitle` + `mergeResolvedData` compartidos) + `ActivatedRoute.title: Observable<string>` (por eso `ActivatedRoute` se registra como `factory` que cierra sobre el map). El default de `TitleStrategy` hace `Title.setTitle`/`document.title`; `{ provide: TitleStrategy, useClass }` lo reemplaza. Ver Etapa 14 (`Title`) · **`withHashLocation()`** — mismo nombre/semántica que `@angular/router`: **default = html5** (`$locationProvider.html5Mode({ enabled, requireBase: false })`), el feature → hashbang · **`withInMemoryScrolling(opts)`** — `.run` (`wireRouterScroller`) sobre `$transitions.onBefore`/`onSuccess` + `$timeout(0)` (el `ui-view` nuevo se linkea después del hook). Prioridad: posición restaurada → `#fragment` (`anchorScrolling: 'enabled'`) → `[0,0]` (`scrollPositionRestoration: 'top'`/`'enabled'` yendo adelante). **`'enabled'`**: guarda `getScrollPosition()` **por URL** en `onBefore` (la página que se deja) y la restaura en `onSuccess` si la nav fue un `popstate` — el back/forward se detecta escuchando `popstate` en `window` (`PlatformLocation.onPopState` → `pendingPop`, consumido en el próximo `onSuccess`; limpiado en `onError`), porque UI-Router no expone el trigger. Tests: `test/router/{router-guard-inject,router-name-collision,router-tier2,router-in-memory-scrolling}.test.ts`.
- [x] `loadComponent` → `lazyLoad` que hace `import()`, registra el `@Component` vía `ConfigProviderFactory.current` y reemplaza el estado (mismo nombre) por el registry en vivo.

- [x] **Tier 3**: `ActivatedRoute` con `queryParams`/`queryParamMap` (de `$location.search()`), `fragment` (`$location.hash()`), refrescados en `onSuccess` + `$locationChangeSuccess`; `data` mergea los valores de `resolve` desde `transition.injector()` (`resolveKeys` del translator); `snapshot` con `queryParams`/`fragment` (opcionales — ausentes en el snapshot de guards/resolvers) · `Router.events: Observable<RouterEvent>` (`NavigationStart`/`End`/`Cancel`/`Error` desde `$transitions`; `id` = `transition.$id`; cancel/error por `RejectType`). Tests: `test/router/router-tier3-activated.test.ts`. _(`routerLink`/`routerLinkActive` estuvieron acá integrados con UI-Router; se quitaron del runtime — se usa `ui-sref`.)_
- [x] **Tier 4** (parcial): `CanActivateChild` (glob `$transitions.onBefore({ to: "${name}.**" })` + skip-self; agarra descendientes lazy porque el glob se wirea en `forRoot`). Tests: `test/router/router-tier4.test.ts`. _(`routerLinkActive` + `router-link-active-exact` estuvieron acá; se quitaron del runtime — se usa `ui-sref-active`.)_
- [x] `loadChildren: () => import(...)` — `state-translator.ts`: el traductor registra un **future state** `${name}.**` (el sufijo `.**` hace que la URL del segmento matchee como prefijo y dispare `lazyLoad` aunque los hijos no existan). El handler (`lazyLoadChildrenFor`) baja el chunk, re-traduce el subárbol rooteado en `${name}` (`translate(routes, parentName, parentPath)`), registra estados + componentes (**idempotente** — `$injector.has(name + "Directive")`) + guards (`wireGuardHook` con el `$transitions` de la transición) + merge de `titles`/`resolveKeys` en los `Map`s vivos, y reemplaza el future state por `${name}` real (pass-through). Acepta `Routes` / `{ routes }` / `{ default }`. Recursivo: un `loadChildren` anidado en el chunk se vuelve otro future state. Tests: `test/router/{router-lazy-children,router-lazy-esm-spike}.test.ts`. **Fix**: `RouterModule.forRoot` clona las decls (`$stateProvider.state({ ...state })`) porque UI-Router muta la decl para quitar `lazyLoad` — no se puede compartir entre bootstraps.
- [x] `loadChildren` → clase `@NgModule` (`m => m.AdminModule` o `{ default }`) — `LazyNgModuleLoader` (`src/runtime/lazy-ng-module-loader.ts`) replica `loadModules` de `angular.js` sobre la app viva (colas contra el provider injector capturado en `ng.js.core`). Las `Routes` salen de los `RouterModule.forChild` de **todo** el grafo de imports (también módulos ya cargados; `forChild` post-bootstrap no mergea al registro global). **Providers aislados**: los `@NgModule` nuevos del chunk no registran `$provide` global — van a un nodo de entorno por rama lazy (`NgModuleScope.environment`, un `ElementInjectorNode`); las declarations lazy terminan su cadena de DI ahí (`scoped-injector-bridge`) y los pipes lazy también. Override de un servicio de la app → solo dentro de la rama. **Clases `@NgModule` instanciadas** (`.run` en `registerNgModule`, imports primero; en lazy, scope hijo — `@Optional() @SkipSelf()` ve la instancia de la app). Colisión de selector de componente / nombre de pipe lazy vs la app → error claro. Future state con límite de segmento (`/admin` no captura `/admin-default`). Padre con hijo índice → `redirectTo` al índice (navegable por nombre). **`withPreloading(PreloadAllModules | NoPreloading | custom)`** — `RouterPreloader` (`src/router/preloading.ts`) tras cada navegación exitosa; memo por app evita doble registro navegación↔preload; precarga los lazy anidados. **Entornos de DI por rama/ruta** (`NgModuleScopes.environmentForState`, `getClosestRouteInjector` de Angular): guards/resolvers/`title` corren en el injection context de su ruta (una ruta `loadChildren` usa el del padre); `inject(Injector)` en la rama da un `NodeInjector` con esa cadena; `createComponent`/`ViewContainerRef.createComponent` anclan el host a la rama (modales/overlays fuera de su DOM); `appRef.destroy()` corre `ngOnDestroy` de servicios de rama y clases `@NgModule`; la instancia del módulo es inyectable (`inject(XModule)` → nombre `ɵmod:<id>`, nunca el id pelado — choca con tokens como `"ngb.modal"`). **`Route.providers`**: entorno por ruta creado al primer uso, hijo del de la ruta padre; el componente lo toma del `<ui-view>` que lo renderiza (`data('$uiView').$cfg.viewDecl.$context`) — funciona aunque el mismo componente esté en varias rutas; un módulo lazy bajo esa ruta cuelga de él. **Destinos dentro de un módulo lazy sin cargar**: el param de límite de segmento del future state es una instancia de `ParamType` (no regex inline: valida vacío al navegar por nombre sin volverse opcional); `redirectTo` que no resuelve en config → `redirectTo` async que baja la cadena de ramas lazy (`loadLazyChainForUrl`) y redirige al estado real; `ui-sref` en forma URL → `LazyUrlLink` (href real vía `LocationStrategy`, click → `navigateByUrl`, se promueve al `ui-sref` nativo cuando el estado existe — `ui-sref-active` incluido); `ui-sref` por nombre → `LinkIntentPreload` (baja la rama en `mouseenter`/`focus`/`touchstart`; UI-Router recalcula el href solo). Antes de la intención, el href de un link por nombre apunta a la raíz del módulo lazy. **Layout raíz** (`{ path: "", component: Shell, children }`, módulo lazy en la raíz): la cadena de `path: ""` desde la raíz de `forRoot` lleva `url: ""` y solo su hoja `"/"` (antes el estado raíz recibía `"/"` y los hijos quedaban en `//hijo`); el redirect índice no se pliega en esa cadena; un `loadChildren` en la cadena usa `"/"` como prefijo del future state. Tests: `test/router/{router-lazy-module,router-lazy-module-parity,router-preloading,router-route-providers,router-lazy-targets,router-root-layout,router-root-layout-redirect,router-root-lazy}.test.ts`.

**Brecha documentada:** árbol de `ActivatedRoute` (`.parent`/`.children`/params-por-nivel), redirect con `UrlTree` desde guard, resolvers `Type<T>`, navegación relativa (`relativeTo`); `loadChildren` → `@NgModule`: `declarations` siguen siendo globales (solo se detecta la colisión); providers de módulos compartidos **ya cargados** no se duplican en la rama (Angular sí — a propósito, para no duplicar servicios del core/ngb-js); código que pide servicios directo a `$injector.get(...)` o directivas sin controller no ven el entorno de la rama. **`canActivate` de una ruta padre** solo corre con esa ruta como destino (`{ to: name }`), no al navegar a un hijo (Angular sí lo corre); redirect en un subárbol lazy hacia un hermano eager. **`canMatch`**: el "fallthrough" (si da `false`, probá la siguiente ruta / caé al `**`) no se replica — UI-Router matchea por URL de forma única; acá `false` aborta la transición. **`canDeactivate`**: la firma completa está (`(component, currentRoute, currentState, nextState)`), pero `currentState`/`nextState` son `{ url, root }` planos — sin árbol `.children`/params-por-nivel. **`TitleStrategy`**: versión básica — el router resuelve el título y el strategy solo lo aplica (`updateTitle(title)`). Sin snapshot, sin `buildTitle`/`getResolvedTitleForRoute`, sin override de la resolución. **`withInMemoryScrolling`**: `anchorScrolling` + `scrollPositionRestoration: 'top'`/`'enabled'` implementados. **Matices vs Angular:** el store de posiciones es **por URL** (no por `navigationId`), así que `'enabled'` también restaura al volver a una URL ya visitada por un **link**, no solo con el botón atrás. Un `popstate` que no dispara transición (p.ej. solo cambia el query) puede dejar `pendingPop` colgado hasta la próxima nav. **No** se emite el evento `Scroll` en `Router.events` (se usa `NavigationEnd`). Versión 100% fiel = store por `navigationId` estampado en `history.state` (frágil: `$location` en html5Mode puede pisarlo) + evento `Scroll` — no vale la complejidad.

## Etapa 17 — Animations ✅ (lo de core; la sintaxis de template `[@trigger]` es del CLI)

**Cubre:** Animaciones.
**Criterio de cierre:** `AnimationBuilder.build([...]).create(el).play()` corre `$animateCss` y resuelve `onDone`; `NoopAnimationsModule` apaga las animaciones y devuelve un player no-op. **✅ pasa** (`test/animations/*.test.ts`).

Core entrega la DSL de metadata (para `@Component({ animations: [...] })`) y la API
imperativa (`AnimationBuilder`) sobre `$animateCss` de `ngAnimate`. La sintaxis de
template (`[@trigger]`, `(@t.*)`, `:enter`/`:leave`, `[@.disabled]`) está fuera de
alcance; core usa las clases `.ng-enter`/`.ng-leave` nativas de `ngAnimate`.

- [x] DSL builders + re-export (`trigger`/`state`/`style`/`animate`/`transition`/`keyframes`/`group`/`sequence`/`query`/`stagger`/`animation`/`useAnimation`/`animateChild`) — `src/animations/dsl.ts`, funciones puras, forma de nodo idéntica a `@angular/animations` (`type` entero). Tests: `test/animations/dsl.test.ts`
- [x] `AnimationBuilder` / `AnimationFactory` / `AnimationPlayer` sobre `$animateCss` — `src/animations/animation-builder.ts` (`BrowserAnimationBuilder` + `NoopAnimationPlayer`/`NoopAnimationBuilder`). Aplanado metadata → segmentos de `$animateCss` en `ɵflattenAnimationToSegments` / `ɵparseAnimationTimings`. Tests: `test/animations/animation-builder.test.ts`
- [x] `BrowserAnimationsModule` / `provideAnimations()` / `NoopAnimationsModule` / `provideNoopAnimations()` — `src/runtime/animations/index.ts` (`angular.module` con dep `ngAnimate`, bindea `AnimationBuilder`; noop hace `$animate.enabled(false)`). Subpath `ngjs-core/animations`. Tests: `test/animations/runtime-animations.test.ts`

**Brecha documentada** (`CONCEPTOS.md` "Animaciones"): `keyframes()` sin `@keyframes` generado (usa el último frame); `query`/`stagger`/`group`/`sequence` — la orquestación fina de varios runners de `$animateCss` se pierde; `pause()`/`setPosition()` no-op (`$animateCss` no da control de posición).

## Etapa 18 — i18n + a11y ✅

**Cubre:** i18n, Accesibilidad.
**Criterio de cierre:** `{{ 'KEY' | translate }}` renderiza + `TranslateService.use('es')` cambia el idioma en runtime. **✅ pasa** (`test/i18n/*.test.ts`).

- [x] `TranslateService` (abstract + `$name`) + `TranslateServiceImpl` (`$inject = ["$translate", "$rootScope"]`) — `src/i18n/translate.ts`. Shim imperativo sobre `$translate`: `instant` sync, `get`/`stream` Observable, `use`, `currentLang`, `onLangChange` (`Subject` sobre `$translateChangeSuccess`, completado en `$destroy`). Equivalente de `$localize` imperativo. `LOCALE_ID` = `InjectionToken<string>`. Tests: `test/i18n/translate.test.ts`
- [x] `registerLocaleData(data, localeId?, extraData?)` — `src/i18n/locale-data.ts`. Misma firma que `@angular/core`; acá `data` es el objeto `$locale` de AngularJS (`ngjs-core/i18n/locales/<id>`), no el formato de `@angular/common/locales`. Registro global `Map<id, LocaleData>` (clase `LocaleRegistry`), con fallback al idioma base (`es-mx`→`es`). Locales incluidos: `en`, `es-MX` (resto: a demanda o a mano). Tests: `test/i18n/locale-data.test.ts`
- [x] `src/runtime/i18n/index.ts` — `angular.module("ngjs.i18n.N", ["ng.js.core", "pascalprecht.translate", "ngAria"])` + `.config($translateProvider)` (translations, preferredLanguage, fallback, `useSanitizeValueStrategy("escape")`) + `.service(TranslateService.$name, …)` + `LOCALE_ID` factory (`$translate.use()`) + **`.run` que swapea `$locale`** (`angular.extend($locale, ɵgetRegisteredLocale(lang))`) en cada `$translateChangeSuccess` — sin HTTP ni assets. `TranslateModule.forRoot(config)` / `provideI18n(config)` → `angular.IModule` para `imports:`. Subpath `ngjs-core/i18n`. Tests: `test/i18n/runtime-i18n.test.ts`
- [x] `ngAria` incluido (dep del módulo — `aria-*`/`role`/`tabindex`/teclado automáticos)
- [x] `src/types/i18n-shims.d.ts` — `declare module` de `angular-translate` / `angular-aria` (no publican tipos; `noUncheckedSideEffectImports`)

### a11y avanzada — superficie `@angular/cdk/a11y` ✅

Superficie y semántica de `@angular/cdk/a11y` tal cual.

- [x] `LiveAnnouncer` (`src/cdk/a11y/live-announcer.ts`) — `announce(msg, politeness?, duration?)` con los overloads de CDK, región `aria-live` oculta lazy, delay 100ms + limpieza previa. `clear()`, `ngOnDestroy()`. Token `LIVE_ANNOUNCER_DEFAULT_OPTIONS`.
- [x] `InteractivityChecker` (`src/cdk/a11y/interactivity-checker.ts`) — `isDisabled`/`isVisible`/`isFocusable`/`isTabbable` + `FOCUSABLE_SELECTOR`. Visibilidad tolerante (no mide geometría → anda en jsdom).
- [x] `FocusTrap` + `FocusTrapFactory` (`src/cdk/a11y/focus-trap.ts`) — mecanismo de anclas de CDK (`tabindex=0` antes/después del host). `create(el: HTMLElement | ElementRef)`, `focusInitialElement`/`focusFirst/LastTabbableElement`/`attachAnchors`/`destroy`. `[cdkFocusInitial]` / `[cdkFocusRegionStart|End]` respetados.
- [x] `FocusMonitor` (`src/cdk/a11y/focus-monitor.ts`) — `monitor(el): Observable<FocusOrigin>`, `stopMonitoring`, `focusVia`; listeners globales `keydown`/`mousedown`/`touchstart` + buffer 650ms; clases `.cdk-{keyboard,mouse,touch,program}-focused` + `.cdk-focused`.
- [x] directivas (`src/runtime/cdk/a11y/`): `[cdkAriaLive]` (`MutationObserver` sobre el texto → `announce`), `[cdkTrapFocus]` (+ `cdkTrapFocusAutoCapture`), `[cdkMonitorElementFocus]` / `[cdkMonitorSubtreeFocus]` (evalúan `cdkFocusChange` con `$event`).
- [x] `src/runtime/cdk/a11y/index.ts` — `angular.module("ng.js.a11y")` (memoizado sin config; `ngjs.a11y.N` con config) registra los 4 servicios + 4 directivas. `A11yModule` / `provideA11y(config?)`. Subpaths `ngjs-core/cdk/a11y`. Sin deps externas — todo DOM. Tests: `test/cdk/a11y/*.test.ts` (30 casos).

**Brechas documentadas** (`CONCEPTOS.md` "i18n" / "Accesibilidad"):
- Extracción de `i18n="…"` / `$localize` a un catálogo → CLI (`ng-js-cli`), no acá.
- `setTranslation` en runtime — `angular-translate` v2 solo carga tablas en config-time (`forRoot({ translations })`) o vía loader. Se puede levantar capturando `$translateProvider` (mismo truco que `ConfigProviderFactory`), pendiente.
- ICU / MessageFormat plurals — necesita `angular-translate-interpolation-messageformat` (no instalado). Brecha parcial.
- No se registra un pipe `translate` propio: choca con el filtro homónimo de `angular-translate`; se usa el de la lib. Si hace falta enganchar algo → `.decorator("translateFilter", …)`.
- `FocusKeyManager`/`ListKeyManager` de CDK (navegación por teclado en listas) — fuera de alcance.

_(No hay etapa 19. El transform completo, el codemod inverso ngjs → Angular y el
reporte de brechas del fuente son del CLI `ng-js-cli` / `ng-js-vite`.)_

---

## Etapa 20 — `Renderer2` ✅

**Cubre:** `Renderer2` / `RendererFactory2` — la abstracción de `@angular/core` sobre la manipulación del DOM. Desbloquea portar código Angular que **inyecta `Renderer2`** en vez de tocar el DOM directo (hoy figuraba como brecha "usar `angular.element` / DOM directo", que sirve para templates a mano pero rompe esos ports).
**Criterio de cierre:** un componente que inyecta `Renderer2` y hace `createElement`/`appendChild`/`setAttribute`/`addClass`/`setStyle`/`listen` sobre su host corre igual que en Angular; `listen` devuelve el unlisten y su callback dispara el `$digest`. **✅ pasa** (`test/platform-browser/renderer.test.ts`).

- [x] `Renderer2` (abstract, `src/core/render/renderer.ts`) + `RendererStyleFlags2` enum + `RendererType2` interface + `RendererFactory2` (abstract) — superficie completa de `@angular/core`, exportado desde `ngjs-core/core`.
- [x] `DefaultDomRenderer2` (`src/platform-browser/renderer.ts`) — **port de `@angular/platform-browser`** (`dom_renderer.ts`), wrapper fino sobre `Node`/`Document` (inyectado vía `DOCUMENT`, no el `document` global — mismo patrón que `Title`/`Meta`/`ViewportScroller`): `createElement`/`createElementNS`/`createText`/`createComment`, `appendChild`/`insertBefore`/`removeChild`/`parentNode`/`nextSibling`, `setAttribute`/`removeAttribute` (+ namespace), `addClass`/`removeClass` (`classList`), `setStyle`/`removeStyle` (`el.style.setProperty` + `DashCase`/`Important`, o asignación directa camelCase sin el flag), `setProperty`/`setValue`, `selectRootElement` (vacía salvo `preserveContent`), `destroy` no-op, `data = {}`.
- [x] `listen(target, ev, cb)` → `addEventListener` nativo tal cual, sin envolver en `NgZone.run`: confirmado con test real que zone.js ya lo parchea y el `$digest` sale solo (mismo mecanismo que `host-listener-bridge.ts`) — devuelve el `removeEventListener` como unlisten.
- [x] `RendererFactory2Impl.createRenderer(element, type)` → siempre la misma instancia de `DefaultDomRenderer2` (sin pipeline de render propio donde diferenciar por host/type; `RendererType2` se acepta y se ignora). `.service` en `runtime/platform-browser`.
- [x] Test: `createElement`/`appendChild`/`setAttribute`/`addClass`/`setStyle`/`setProperty` sobre un elemento; `createText`/`createComment`/`setValue`/`parentNode`/`nextSibling`; `insertBefore`/`removeChild`; `selectRootElement` (+ `preserveContent`); `listen` + unlisten.

**Brecha:** `ViewEncapsulation.Emulated` (el default de Angular) — Angular scopea los estilos del componente agregando atributos `_nghost-*`/`_ngcontent-*` y reescribiendo selectores. Eso es del CLI (procesa los `styles` del `@Component`), no de `Renderer2`. Acá el renderer se comporta siempre como `ViewEncapsulation.None` (sin scoping). `RendererType2` (`id`/`encapsulation`/`styles`) se acepta pero se ignora.

**Esfuerzo:** bajo (~1-2 archivos, medio día con tests). Puede ir antes o después de Forms.

### Impacto en lo que ya está

**No obliga a cambiar nada.** `Renderer2` es puramente aditivo — un servicio nuevo + un abstract nuevo. Todo lo que hoy toca el DOM directo sigue funcionando **idéntico**:

- `host-listener-bridge.ts` (`nativeElement.addEventListener`) y `host-binding-bridge.ts` (`$scope.$watch` + attr/class/style/prop directo) — Angular rutea los host bindings/listeners **a través** del renderer; acá pueden quedar como están. **Opcional**: migrarlos a `renderer.listen`/`renderer.setAttribute` para consistencia — cero diferencia de comportamiento, y sumaría la dependencia de `Renderer2` disponible en el bridge.
- Directivas que manipulan DOM (`NgDisabled`, `ng-content`/`ng-container`, `cdkTrapFocus` & cía, animaciones) — igual: podrían usarlo, no lo necesitan.
- `createComponent` / `ViewContainerRef` / `EmbeddedViewRef` — crean/insertan DOM vía `$compile`/`$transclude`; Angular lo hace vía renderer. Sin cambio forzado.
- `ElementRef` — complementario: `Renderer2` opera sobre `elementRef.nativeElement`. Sin cambio.

### Divergencias con el rol que tiene en Angular (a documentar)

- **`RendererFactory2` no tiene un pipeline de render donde engancharse.** En Angular, la instanciación de cada componente llama `rendererFactory.createRenderer(host, rendererType)`. Acá los componentes los compila `$compile`, no hay pipeline propio de ngjs → `RendererFactory2` es un servicio suelto "dame un renderer" que siempre devuelve el `DefaultDomRenderer2` compartido. `RendererType2` (`encapsulation`/`styles`/`id`) se acepta y se ignora.
- **Sin `AnimationRenderer`.** Angular envuelve el renderer con un decorator que intercepta `setProperty`/`listen` para `[@trigger]`/`(@trigger.done)`. Acá las animaciones van por `$animateCss` directo y `[@trigger]` es del CLI — `Renderer2` y animaciones no se integran.

---

## Brechas — no se implementan, se documentan/reportan

`hostDirectives` (parcial), `AfterViewChecked`/`AfterContentChecked`
(watcher ad-hoc), `FocusMonitor`, ICU plurals (parcial), modelo estado-vs-path del
router, re-uso de componente por param.

`@Component({ providers })` **sí** se intenta (inyector jerárquico, etapa 5);
único límite conocido: el árbol lógico de proyección vs el DOM.

`ChangeDetectionStrategy.OnPush` se **ignora** (no es brecha): con Zone el `$digest`
es global.
