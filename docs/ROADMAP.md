# Roadmap de `ngjs-core`

El compilador es responsable de leer decoradores, resolver metadata y generar
el código AngularJS. `ngjs-core` conserva la API que usa el código fuente y el
comportamiento que ocurre durante la ejecución de la aplicación.

## Nivel 1: APIs declarativas sin runtime

Estas piezas solo necesitan tipos y funciones inertes. El compilador las lee,
las elimina y genera el comportamiento correspondiente.

- [x] `Component`
- [x] `Directive`
- [x] `Pipe`
- [x] `NgModule`
- [x] `Injectable`
- [x] `Input`
- [x] `Output`
- [x] `HostBinding`
- [x] `HostListener`
- [x] `Attribute`
- [x] `Inject`
- [x] `Optional`, `Self`, `SkipSelf`, `Host`
- [x] `forwardRef`
- [x] `InjectionToken`
- [x] providers y `ProviderToken`

`Service` queda fuera del target. El target es Angular 14/16 y la API de
servicios es `Injectable`.

`afterRender`, `afterNextRender` y `afterEveryRender` también quedan fuera:
son APIs posteriores a Angular 16 y no forman parte del target.

## Nivel 2: contratos de tipos

Estas piezas no necesitan implementación de AngularJS, pero completan la API
que usan las clases compiladas.

- [x] `PipeTransform`
- [x] hooks: `OnChanges`, `OnInit`, `DoCheck`, `OnDestroy`
- [x] hooks de contenido y vista
- [x] `SimpleChange` y `SimpleChanges`
- [ ] tipos de configuración de bootstrap
- [x] tipos básicos de `ApplicationRef`, `NgZone` y `ErrorHandler`
- [ ] tipos de `Renderer2` y `RendererFactory2`

## Nivel 3: primitivas runtime aisladas

Estas piezas tienen comportamiento propio, pero pueden implementarse sin
construir todavía toda la plataforma.

- [x] `EventEmitter` sobre `rxjs.Subject`
- [ ] `DestroyRef` conectado al `$scope.$on("$destroy")`
- [x] `Injector` como fachada del `$injector` AngularJS
- [ ] `ElementRef` como envoltura del elemento jqLite/DOM
- [x] `ChangeDetectorRef` como fachada de digest; `markForCheck()` agenda un
  digest con `$evalAsync()` y `detectChanges()` ejecuta un digest local
- [ ] `DOCUMENT`
- [ ] `Renderer2` sobre DOM/jqLite

`zone.js` queda fuera del runtime nuevo. El polyfill generado por
`ng-js-compiler` cubre las entradas async que necesitan iniciar un digest.

## Nivel 4: wiring de componentes

Estas piezas conectan objetos del runtime con componentes ya generados por el
compilador.

- [ ] conectar `EventEmitter` con `ɵcmp.outputs` y bindings `&`
- [ ] aplicar `DestroyRef` y limpiar subscripciones
- [ ] `hostDirectives` usando `ɵcmp.hostDirectives`
- [ ] proyección de contenido usando `ɵcmp` y `ng-content`
- [ ] resolución de `exportAs` y referencias `ng-ref`
- [x] `inject()` fuera de la construcción, usando el injector compilado activo

## Nivel 5: queries y vistas

El compilador ya deja las definiciones en `ɵcmp.queries` y
`ɵcmp.viewQueries`; el runtime debe resolverlas contra el DOM y mantener su
estado.

- [ ] `QueryList`
- [ ] `ViewChild` y `ViewChildren`
- [ ] `ContentChild` y `ContentChildren`
- [ ] `TemplateRef`
- [ ] `ViewContainerRef`
- [ ] `EmbeddedViewRef`
- [ ] `ComponentRef`
- [ ] creación dinámica de componentes

## Nivel 6: plataforma

- [x] `platformBrowserDynamic()` como fachada de `ɵngjsPlatform`
- [x] bootstrap de un `ɵmod` compilado
- [ ] providers de plataforma (`Injector`, `NgZone`, `ErrorHandler`, etc.)
- [x] manejo del digest global mediante el polyfill del compiler
- [ ] wiring de `ApplicationRef` con la aplicación compilada
- [ ] `APP_INITIALIZER` completo; actualmente `provideAppInitializer()` solo
  registra callbacks globales que `PlatformCode` ejecuta antes de resolver el
  bootstrap, pero todavía no se resuelven providers `multi` de Angular
- [ ] inicializadores de aplicación

## Nivel 7: features completas

Estas áreas tienen varios bridges y deben hacerse después de las primitivas
anteriores.

- [ ] forms y `ControlValueAccessor`
- [ ] validadores y `ngModel`/`disabled`
- [ ] async pipe
- [ ] router y módulos lazy
- [ ] animaciones
- [ ] i18n
- [ ] CDK y accesibilidad
- [ ] sanitización y `platform-browser`

## Regla de implementación

Si una API solo sirve para que el compilador reconozca sintaxis, debe ser un
tipo o decorador inerte. Si necesita observar scopes, DOM, digest, injector,
subscripciones o creación de vistas, pertenece al runtime y debe entrar en el
nivel correspondiente antes de publicarse como funcional.
