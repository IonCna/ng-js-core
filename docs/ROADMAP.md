# Roadmap de `ngjs-core`

El compilador (`ng-js-compiler`, vía `ngjs build`) lee decoradores, resuelve metadata y genera el código AngularJS
(`ɵfac`, `ɵprov`, `ɵcmp`/`ɵdir`/`ɵpipe`, `ɵmod`, la registración de módulos, el injector por elemento). `ngjs-core`
conserva la API que usa el código fuente y el comportamiento que ocurre durante la ejecución: toda la metadata que
el runtime necesita la lee de lo que estampó el compilador (`CompiledType`), nunca de registros propios.

El modo runtime anterior (`old/`) ya no existe: su código quedó migrado y sus tests portados a `test/` — lógica pura
en el proyecto `unit` (jsdom + `angular-mocks`) e integración en `compiled` (`*.compiled.test.ts`: cada fixture se
compila con `ng-js-compiler` junto con `src/`, ver `test/compiled-app.ts` y `test/router/router-app.ts`). Los tests
que probaban el motor de runtime (registro de módulos, store de metadata, nombres de selector, `reflect`) no se
portaron: eso ahora es el compilador y tiene sus propios tests.

## Nivel 1: APIs declarativas sin runtime

- [x] `Component`, `Directive`, `Pipe`, `NgModule`, `Injectable`
- [x] `Input` (alias, `binding: "@"`), `Output` (alias), `HostBinding`, `HostListener` (también `window:`/`document:`
  y filtros de tecla)
- [x] `Attribute`, `Inject`, `Optional`, `Self`, `SkipSelf`, `Host`, `forwardRef`
- [x] `InjectionToken` (con `factory`), providers y `ProviderToken`
- [x] `ViewChild`, `ViewChildren`, `ContentChild`, `ContentChildren` (definición en `ɵcmp.queries`/`viewQueries`)

`Service` queda fuera del target (Angular 14/16 usa `Injectable`). `afterRender`/`afterNextRender` también.

## Nivel 2: contratos de tipos

- [x] `PipeTransform`, hooks de ciclo de vida, `SimpleChange`/`SimpleChanges`
- [x] `ApplicationRef`, `NgZone`, `ErrorHandler`, `Renderer2`/`RendererFactory2`

## Nivel 3: primitivas runtime

- [x] `EventEmitter` sobre `rxjs.Subject`
- [x] `Injector` (se provee solo en la raíz) e `inject()` de runtime (contexto de construcción o app)
- [x] `ElementRef`, `ChangeDetectorRef`, `DestroyRef`, `ViewContainerRef`, `TemplateRef`, `AsyncPipe`: tokens por
  elemento, agregados a los `locals` de `$controller` bajo su nombre compilado (`ElementTokens`)
- [x] `DOCUMENT`, `PLATFORM_ID`, `LOCALE_ID` (tokens con `factory`)
- [x] `NgZone`, `ApplicationRef`, `ErrorHandler` (`providedIn: "root"`; `ErrorHandler` recibe `$exceptionHandler`)

`zone.js` queda fuera del runtime: los parches de `ng-js-compiler` cubren las entradas async que inician un digest.

## Nivel 4: wiring de componentes

- [x] `@Output` con `EventEmitter` y bindings `&`
- [x] `hostDirectives` (instancia la directiva compuesta antes del host; sin reenvío de `inputs`/`outputs`)
- [x] proyección de contenido (`<ng-content>`, `transclude` lo emite el compilador) y proyección eager
- [x] `exportAs` y referencias `ng-ref` / `ng-ref-read`
- [x] `ControlValueAccessor` y validadores (`NG_VALUE_ACCESSOR`/`NG_VALIDATORS` en `ɵfac.ɵproviders`)

## Nivel 5: queries y vistas

- [x] `QueryList`, `@ViewChild(ren)`, `@ContentChild(ren)` (resueltas antes de `ngAfterViewInit`/`ngAfterContentInit`)
- [x] `TemplateRef` (directiva nativa `ngTemplate`), `ViewContainerRef`, `EmbeddedViewRef`, `ComponentRef`
- [x] `createComponent()` / `ViewContainerRef.createComponent()` (componente declarado en un módulo cargado)
- [ ] `ngTemplateOutlet`: el test de contexto `let-x` falla — pendiente de revisar en la etapa de tests
- Limitación: lo que un `ng-if` agrega aparece por `QueryList.changes`, no en `ngAfterViewInit`

## Nivel 6: plataforma

- [x] `platformBrowserDynamic()` sobre `ɵngjsPlatform`; agrega `NativeModule` (los bridges) al módulo raíz
- [x] `bootstrapApplication(AppModule)` como atajo (resuelve con el `ApplicationRef`)
- [x] `APP_INITIALIZER` (multi) y `provideAppInitializer()`: `bootstrapModule()` espera sus promesas
- [x] `BrowserModule` (= `CoreModule` + `CommonModule` + servicios del navegador)

## Nivel 7: features

- [x] forms (reactive directives, `ControlValueAccessor`, validadores, `ngDisabled`)
- [x] async pipe (por instancia)
- [x] router sobre UI-Router (`RouterModule.forRoot/forChild`, guards, resolvers, títulos, `loadComponent`,
  `loadChildren` con `@NgModule` compilado, preloading, scroll)
- [x] animaciones (`AnimationBuilder` sobre `$animateCss`)
- [x] i18n (`TranslateModule` sobre `angular-translate`, `TranslateService`, `registerLocaleData`)
- [x] CDK: `a11y` (`A11yModule`, `LiveAnnouncer`, `FocusTrap`, `FocusMonitor`) y `layout` (`BreakpointObserver`)
- [x] `platform-browser` (`Title`, `Meta`, `DomSanitizer`, renderer)
- [x] `testing`: `configureTestingModule()` arma un módulo de `angular.mock` con clases compiladas

Limitaciones de AngularJS (un solo injector): los `providers` de una ruta o de un `@NgModule` cargado lazy quedan
para toda la app, no para su rama (sin override por rama, sin `inject(Injector)` de la rama, sin `ngOnDestroy` por
rama). Las `declarations` también son globales: un componente lazy con un selector ya registrado es error.

Un componente de `loadComponent` (fuera de todo `@NgModule`) hereda el `controllerAs` del `@NgModule` raíz
(`ɵmod.controllerAs`, constante `ɵngjsRootControllerAs` de la app).

## Pendiente

- [ ] `InjectionToken` con `factory` de raíz + `multi` desde un módulo: `MultiProvidersRuntime` lo rechaza como
  "mezcla multi y no-multi" (hoy resuelto solo para `HTTP_INTERCEPTORS`, que no lleva `factory`).
- [ ] `ngjs build` real del core (con el `dist/` del compilador y el CLI reconstruidos).

## Regla de implementación

Si una API solo sirve para que el compilador reconozca sintaxis, debe ser un tipo o decorador inerte. Si necesita
observar scopes, DOM, digest, injector, subscripciones o creación de vistas, pertenece al runtime (`src/native` para
lo imperativo de AngularJS) y lee la metadata compilada con `CompiledType`.
