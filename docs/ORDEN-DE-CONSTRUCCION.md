# Orden de construcción

Secuencial por dependencia. Cada etapa cierra cuando su criterio pasa en verde.
Cada sección de `CONCEPTOS.md` cae en alguna etapa (columna «cubre»). Regla: una
etapa **no** está lista solo porque los archivos existen — lo está cuando pasan
sus contratos, comportamiento, registro y test.

Leyenda: ✅ cerrada · 🚧 en progreso · ⬜ no empezada.

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

## Etapa 10 — Transform MVP ⬜

**Cubre:** CLI §2 + §5, Componente/Directivas (codegen), `@Pipe` (codegen), Build y entornos.
**Criterio de cierre:** un `@Component` + `@Directive` + `@Pipe` + `@Injectable` nuevos se registran y renderizan en jsdom; `environment` cambia entre dev/prod.

- [ ] leer etapa 4 + ctor metadata → `angular.module()` + `.component()`/`.directive()`/`.service()`/`.filter()`
- [ ] `bindings` de `@Input`/`@Output`
- [ ] `$inject`
- [ ] `require` de queries con `read`
- [ ] `transclude` según `<ng-content>`
- [ ] `link` de `@HostBinding`/`@HostListener`
- [ ] `$attrs` de `@Attribute`
- [ ] `environment` por modo de build

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

## Etapa 14 — platform-browser ⬜

**Cubre:** Servicios de plataforma.
**Criterio de cierre:** `[innerHTML]` sanitizado; `Location.go()` cambia la URL; `BreakpointObserver` emite al cruzar un breakpoint.

- [ ] `DomSanitizer` (`$sce` + `$sanitize`)
- [ ] `bypassSecurityTrust*`
- [ ] `SafeHtml` / `SafeUrl` / `SafeResourceUrl`
- [ ] `Title`
- [ ] `Meta`
- [ ] `DOCUMENT`
- [ ] `Location` / `LocationStrategy` / `PlatformLocation` (`$location`)
- [ ] `ViewportScroller` (`$anchorScroll`)
- [ ] `BreakpointObserver` / `Breakpoints` / `MediaMatcher` (sobre `matchMedia`)

## Etapa 15 — Forms ⬜

**Cubre:** Forms.
**Criterio de cierre:** `formGroup` reactivo con validación sync+async, `valueChanges`, y un control custom vía CVA.

- [ ] `FormControl` / `FormGroup` / `FormArray`
- [ ] `FormBuilder`
- [ ] `Validators.*`
- [ ] `ControlValueAccessor` / `NG_VALUE_ACCESSOR` ↔ `NgModelController`
- [ ] `NG_VALIDATORS` / `NG_ASYNC_VALIDATORS` → `$validators`/`$asyncValidators`
- [ ] directivas `[formGroup]` / `formControlName` / `formArrayName`
- [ ] `updateOn` → `ngModelOptions`
- [ ] errores (`ngMessages`)
- [ ] template-driven (`[(ngModel)]` / `#f="ngForm"` / `ngModelGroup`)

## Etapa 16 — Router ⬜

**Cubre:** Router.
**Criterio de cierre:** navegación entre 2 rutas + guard + resolve + `ActivatedRoute.paramMap` emite; una ruta con `loadComponent: () => import(...)` nativo carga y monta el chunk.

- [x] tipos `Route`/`Routes` (`src/router/route.ts` — adaptados a ui-router: sin `matcher`/`outlet`/`runGuardsAndResolvers`/`canLoad`; el `name` de cada estado se deriva del árbol, nunca lo escribe el consumidor)
- [ ] traductor `Routes → $stateProvider.state()` (deriva `name` del árbol, resuelve `data`/`resolve` directo)
- [ ] `RouterModule.forRoot`/`forChild` (sobre `$stateProvider`)
- [ ] `<router-outlet>` (+ `name`) → `<ui-view>` (CLI/tpl, no runtime)
- [ ] `routerLink` / `routerLinkActive` → `ui-sref` / `ui-sref-active` (CLI/tpl, no runtime)
- [ ] `Router.navigate` / `navigateByUrl` (sobre `$state.go`/`$state.href`)
- [ ] `ActivatedRoute` shim (RxJS sobre `$transitions`)
- [ ] `CanActivate` / `CanDeactivate` / `CanMatch` (hooks `$transitions`)
- [ ] `Resolve` / `resolve`
- [ ] `Route.data` / `title` / `TitleStrategy`
- [ ] `loadChildren` / `loadComponent` → `lazyLoad` + wrapper que adapta el `import()` nativo al contrato `{ states }` de UI-Router + registro diferido

## Etapa 17 — Animations ⬜

**Cubre:** Animaciones.
**Criterio de cierre:** `[@trigger]` anima entre 2 estados; `:enter` en un `*ngIf`.

- [ ] re-export DSL (`trigger`/`state`/`style`/`animate`/`transition`/`keyframes`)
- [ ] directiva `[@trigger]`
- [ ] runner de `$animateCss`
- [ ] `(@t.start)` / `(@t.done)`
- [ ] `:enter` / `:leave` / `:increment` / `:decrement`
- [ ] `[@.disabled]`
- [ ] `AnimationBuilder` / `AnimationPlayer`
- [ ] `BrowserAnimationsModule` / `provideAnimations` / `NoopAnimationsModule`

## Etapa 18 — i18n + a11y ⬜

**Cubre:** i18n, Accesibilidad.
**Criterio de cierre:** `{{ 'KEY' | translate }}` + cambio de locale en runtime.

- [ ] wrappers de `angular-translate` (`translate`, `$translate`)
- [ ] `angular-dynamic-locale` (`LOCALE_ID`/`$locale`)
- [ ] incluir `ngAria`

## Etapa 19 — Transform completo + codemod inverso + diagnóstico ⬜

**Cubre:** CLI §3, §6, §7.
**Criterio de cierre:** un componente ngjs se reescribe a Angular; se listan las brechas del fuente.

- [ ] transform cubre `animations`
- [ ] i18n (`i18n`/`$localize` → catálogo)
- [ ] si se cierra la opción B: sintaxis de template
- [ ] codemod ngjs → Angular
- [ ] reporte de brechas

---

## Brechas — no se implementan, se documentan/reportan

`hostDirectives` (parcial), `Renderer2`, `AfterViewChecked`/`AfterContentChecked`
(watcher ad-hoc), `FocusMonitor`, ICU plurals (parcial), modelo estado-vs-path del
router, re-uso de componente por param.

`@Component({ providers })` **sí** se intenta (inyector jerárquico, etapa 5);
único límite conocido: el árbol lógico de proyección vs el DOM.

`ChangeDetectionStrategy.OnPush` se **ignora** (no es brecha): con Zone el `$digest`
es global.
