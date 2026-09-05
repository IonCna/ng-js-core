# Conceptos Angular → ngjs

Objetivo: **escribir con decoradores de Angular 16** (`@Component`, `@Directive`,
`@Injectable`, `@NgModule`, `@Pipe`, `@Input`, `@Output`, `@ViewChild`, …) y correr
sobre AngularJS 1.8.

Es una **capa de traducción**, no una reimplementación de Angular. La detección de
cambios es: Zone.js dispara `$digest`. Punto. No hay `OnPush`, ni CD por componente,
ni scheduler propio — el dirty-checking de AngularJS ya recorre todo.

## Capas

1. **Autoría** — clases con decoradores. `experimentalDecorators` +
   `emitDecoratorMetadata` (la metadata de tipos alimenta la DI). Los decoradores
   son azúcar sobre un registro de metadata normalizado que también se escribe
   desde JS puro (forma funcional o `static`) — ver «Superficie de autoría — JS y
   TS a la par».
2. **CLI (`ng-js-cli`)** — capa dev-time que *absorbe el template de fondo*: lo toma
   como input y lo transforma antes de que build/runtime lo vean. Es donde vive (o
   vivirá) la traducción de sintaxis de template Angular → AngularJS y, en la otra
   dirección, el codemod de migración. Comparte la maquinaria de lectura/parcheo de
   `ng-js-vite` (`reading/`, `writing/`: parse5, css-tree, patch de AST). Hoy es un
   stub.
3. **Build (`ng-js-vite`)** — lee los decoradores y la metadata emitida y genera el
   registro AngularJS: `angular.module().component()/.directive()/.service()/.filter()`,
   deriva `bindings` de `@Input`/`@Output`, arma `$inject` de `design:paramtypes`,
   extrae `templateUrl` con content-hash y aplica encapsulación de estilos emulada
   (`styleUrl`/`styles`, atributo `_content-<hash>` en cada elemento y selector,
   como `_ngcontent`). Hoy solo procesa `templateUrl`/`styleUrl` por regex; adaptarlo
   a leer decoradores es el próximo paso.
4. **Runtime** — AngularJS 1.8.3 + RxJS 7 + Zone.js 0.16 + `@uirouter/angularjs` +
   `angular-animate` + `angular-sanitize` + `angular-messages` + `angular-aria` +
   `angular-translate` + `angular-dynamic-locale` + `$sce` (core) + primitivas de
   `ngjs-core` (sección «Primitivas de `ngjs-core`»). Ver «Librerías satélite».

**Migrar a Angular** = quitar los transforms de CLI + `ng-js-vite`, dejar clases y
decoradores como están, correr el codemod de template en el CLI.

## Columna «Migra»

- `directo` — clase + decorador quedan idénticos; solo cambia el import
- `shim` — CLI, `ng-js-vite` o `ngjs-core` generan el equivalente; migrar = quitar ese transform
- `tpl` — hoy el template se escribe en sintaxis AngularJS y hay codemod al migrar.
  Si el CLI absorbe también la sintaxis Angular del template (`[prop]`, `(event)`,
  `*ngIf`, `{{ x }}`), estos renglones se acercan a `directo`. Decisión abierta.
- `brecha` — semántica de runtime que AngularJS no tiene; aproximación + nota

## Librerías satélite

Módulos oficiales `angular-*` que se incluyen porque dan sustrato a un concepto
Angular (el dev escribe Angular, se traduce al módulo):

| Lib | Habilita | Estado |
|---|---|---|
| `@uirouter/angularjs` | `@angular/router` | incluida |
| `angular-animate` (`ngAnimate`) | `@angular/animations` | incluida |
| `angular-sanitize` (`ngSanitize`) | `DomSanitizer` / `[innerHTML]` sanitizado | incluida |
| `angular-messages` (`ngMessages`) | display de errores de `FormControl` | incluida |
| `angular-aria` (`ngAria`) | ARIA automática sobre directivas — parcial vs `@angular/cdk/a11y` | incluida |
| `angular-translate` | `$localize` / `i18n` attrs / `TranslocoModule`-style | incluida |
| `angular-dynamic-locale` | `LOCALE_ID` en runtime / `registerLocaleData` | incluida |
| `$sce` (core, no es lib aparte) | `bypassSecurityTrust*` / `SafeHtml`/`SafeUrl`/… | siempre |
| `angular-mocks` (`ngMock`) | `TestBed` (substrato de tests) | dev |

No aplican (sin traducción a un concepto Angular): `angular-route` (usamos
UI-Router), `angular-resource` (`HttpClient` directo), `angular-touch` (deprecado),
`angular-cookies` (sin equivalente core).

El "CDK" (`FocusTrap`, positioning/Popper, `LiveAnnouncer`, RTL, overlay) no tiene
lib de AngularJS ni entra en `ngjs-core`: es `brecha`, lo resuelve quien lo
necesite.

---

## Superficie de autoría — JS y TS a la par

Premisa: **AngularJS y su ecosistema son JS**. Todo lo que un consumidor escribe
—decoradores, tokens, `EventEmitter`, refs— tiene que poder usarse desde `.js` sin
`tsc`, y además traer su `.d.ts` para el que escribe `.ts`. La sintaxis `@` no es
nativa en ninguno de los dos: en TS la habilita `experimentalDecorators`, en JS un
transpilador (Babel / esbuild). Por eso el runtime **nunca** depende de que haya
decoradores: depende de un **registro de metadata normalizado**, y los decoradores
son solo uno de los frentes que lo producen.

### Un modelo de datos, varios frentes

```
frentes (producen)                          metadata normalizada            consumidores
─────────────────────────────────────       ────────────────────────        ─────────────────────────────────
@Component + @Input/@Output  (TS, @)        ┐                          ┌──   ng-js-vite (build):
component(clase).define(def)  (JS)          ├─▶  ComponentDef /  ──────┤     angular.module().component(...)
ng-js-vite (lee el AST TS en build)         ┘    DirectiveDef /        ├──   ngjs-core (runtime):
                                                  PipeDef / NgModuleDef │     $compileProvider/$controllerProvider
                                                  / InjectableDef      └──   createComponent (lazy / dinámico)
```

- **La metadata es data plana.** `ComponentDef` (y `DirectiveDef`, `PipeDef`,
  `NgModuleDef`, `InjectableDef`) es un objeto serializable: `selector`,
  `inputs[]` (`{ propName, bindingName, required?, transform? }`), `outputs[]`,
  `host` (`bindings` / `listeners`), `queries[]`, `lifecycle` (set de hooks
  presentes), `providers[]`, `ctorDeps[]`, `template`/`templateUrl`,
  `styles`/`styleUrl`, `exportAs`. Sin lógica.
- **Los frentes convergen** en el mismo objeto. Un decorador TS y `component()`
  en JS dejan el mismo registro; `ng-js-vite` arma ese shape desde el AST en
  build-time.
- **Dos modos de consumo**:
  - *Build-time (principal)* — `ng-js-vite` lee la metadata y emite
    `angular.module().component()/.directive()/.service()/.filter()`. El runtime
    no introspecta nada.
  - *Runtime (fallback / JS puro / dinámico)* — sin transform. `ngjs-core` lee el
    registro normalizado (de decoradores en runtime, o de `component()`/`injectable()`
    llamados directo) y llama a los providers de config capturados (etapa 2). Es la
    historia "agrego un `<script>`" y la de componentes lazy / `createComponent`.

### Un primitivo, dos pieles

Un solo helper de bajo nivel, `stampComponentDef(clase, def)`, pega el `def` a la
clase (`ɵcmp`) y no parsea nada. Todo lo demás junta el `def` (con `inputs`/`outputs`
ya calculados) y llama ahí:

```
stampComponentDef(clase, def)               núcleo — el def ya trae inputs/outputs resueltos
  └─ component(clase).define(def)           JS — junta @Input/@Output + static bindings (collectBindings), llama al núcleo
       └─ @Component({ selector, ... })     TS — azúcar: (clase) => component(clase).define(def)
```

`@Component` **llama a `component()` de fondo**; no hay dos caminos que mantener.

**JS** — la clase es el controller; `input()`/`output()`/`model()` viven en `static
bindings`, no como field initializer de instancia — eso necesitaría instanciar la
clase para detectar qué campo quedó marcado, y esa sonda se descartó por frágil
(un constructor con lógica no trivial podía explotar):

```js
class Counter extends bindings({
  count: input(0),           // binding '<'  ('<?' si no es required)
  step: input.required(),    // binding '<'  + assert
  countChange: output(),     // binding '&'  + EventEmitter
}) {
  inc() { this.count += this.step; this.countChange.emit(this.count); }
  ngOnInit() {}
}

component(Counter).define({
  selector: 'counter',
  template: `<button (click)="$.dec()">–</button>{{ $.count }}<button (click)="$.inc()">+</button>`,
});
```

`bindings({...})` no hace nada en runtime más que dejar `static bindings = {...}` en
la clase — su único propósito es que TS calcule el tipo de instancia (`this.count:
number`) sin que haga falta declararlo aparte. Al registrar, `component(Clase).define(def)`
junta `static bindings` con lo que haya en el bucket de `@Input`/`@Output` (por si la
clase mezcla los dos caminos) y arma `inputs`/`outputs` — el `def` que escribe el
consumidor **nunca** los declara a mano, ni en JS ni en TS. El nombre de registro en
AngularJS sale de `def.selector` convertido a camelCase. DI: `static $inject = ['api']`
+ constructor, como en AngularJS.

**TS** — mismo cuerpo, decoradores:

```ts
@Component({ selector: 'counter', template: `…` })
export class Counter {
  @Input() count = 0;
  @Input({ required: true }) step!: number;
  @Output() countChange = new EventEmitter<number>();

  inc() { this.count += this.step; this.countChange.emit(this.count); }
  ngOnInit() {}
}
```

**El par** — codemod mecánico, nada se traduce salvo el template (`tpl`):

| JS | TS |
|---|---|
| `class X extends bindings({...}) {` + `component(X).define({selector, ...})` | `@Component({ selector: 'x', … })` + `class X {` |
| `template:` en el `.define()` | `template:` en el decorador |
| `count: input(0)` (dentro de `bindings({...})`) | `@Input() count = 0` |
| `name: input.required()` | `@Input({ required: true }) name!: T` |
| `countChange: output()` | `@Output() countChange = new EventEmitter()` |
| `total: model(0)` (dentro de `bindings({...})`) | `@Model() total: number` — un solo binding `'='` nativo de AngularJS, sin `@Output`/`EventEmitter` aparte (`[(total)]`) |
| `static hostListeners = { onClick: hostListener('click') }` | `@HostListener('click') onClick() {…}` — wiring real: `nativeElement.addEventListener`, sin `$element.on()` de jqLite |
| `static hostBindings = { isActive: hostBinding('class.active') }` | `@HostBinding('class.active') isActive = false` — wiring real: `$scope.$watch` (reacciona a cambios, no solo una vez), desregistrado en `$destroy`; soporta `class.x`/`style.x`/`attr.x`/propiedad DOM plana |
| `static $inject = ['api']` + ctor | `constructor(private api: Api)` |
| `ngOnInit() {…}` | `ngOnInit() {…}` (idéntico) |

Mismo triángulo para `directive()` / `@Directive`, `pipe()` / `@Pipe`,
`injectable()` / `@Injectable`, `ngModule()` / `@NgModule`.

- **Dialecto de decorador: experimental (legacy).** TS (`experimentalDecorators`) y
  Babel (`@babel/plugin-proposal-decorators { legacy: true }`) comparten firma
  (`(target)` / `(proto, key)` / `(proto, key, index)`). Los TC39 stage-3
  (`(value, context)`) **no** se aceptan como entrada; ese consumidor usa la forma
  `component()` o `static`.
- **Orden.** Los decoradores de miembro corren antes que el de clase; acumulan en
  un bucket keyed por `class.prototype` (WeakMap) que `@Component` funde con lo
  heredado (`Object.getPrototypeOf`). Subclasear funde
  `inputs`/`outputs`/`queries`/`lifecycle`.
- **Class fields (TS).** Con `useDefineForClassFields: true`, `@Input() name;` emite
  un initializer que puede pisar lo que setea el bridge. Recomendación: `false` en
  el `tsconfig` del consumidor (igual que Angular pre-signals).

### DI: lo único que no infiere en JS

`emitDecoratorMetadata` (→ `design:paramtypes`) es **exclusivo de TS**. En JS —aun
con decoradores legacy de Babel— no hay tipos de constructor en runtime. Frentes
para declarar dependencias, por preferencia:

| Forma | Ejemplo | Notas |
|---|---|---|
| `ng-js-vite` genera `$inject` | (build-time, desde el AST TS) | camino principal; sin reflexión en runtime |
| `$inject` nativo de AngularJS, con tokens | `Foo.$inject = ['$http', API_URL]` | ya existe; JS puro, sin decoradores — `ensureInject` traduce los tokens a strings antes de registrar |
| `design:paramtypes` + `@Inject` | `constructor(@Inject(TOKEN) x)` | solo TS con `emitDecoratorMetadata` + `reflect-metadata`; `@Inject` pisa por índice lo que `design:paramtypes` no resuelve solo (primitivos, interfaces) |

`reflect-metadata` hace falta solo para el camino TS (`@Injectable`/`@Inject`
leyendo `design:paramtypes`). El camino JS (`$inject` nativo con tokens) no lo
necesita en absoluto — `ensureInject` resuelve directo lo que ya está en el array.

### Interfaces de ciclo de vida = solo tipos

`OnInit`, `OnChanges`, `ControlValueAccessor`, `Validator`, … son `interface` de
TS: se borran al compilar. El bridge (etapa 5) detecta los métodos **por nombre**
(`ngOnInit`, `ngOnChanges`, …), no por `instanceof`. En JS se escribe el método y
listo; en TS `implements OnInit` agrega chequeo del compilador y nada más.

### Distribución y typings

- **Build**: ESM (`import { Component } from 'ngjs-core'`) + UMD/global
  (`window.ngjs`, con `ngjs.core.Component`, `ngjs.common.NgTemplateOutlet`, …)
  para el consumidor de solo `<script>`. Los mismos objetos en ambos.
- **`.d.ts` por cada valor de runtime**, calcados a los nombres públicos de
  `@angular/core` para que el tooling del editor y el codemod inverso sean
  transparentes:
  - decoradores tipados a la vez como `ClassDecorator` / `PropertyDecorator` /
    `ParameterDecorator` (uso `@X`) y como factory callable `(config) => …` (uso JS).
  - `EventEmitter<T> extends Subject<T>` — tipo + runtime.
  - `InjectionToken<T>` — clase de runtime con parámetro de tipo fantasma.
  - `SimpleChanges`, `QueryList<T>`, `ElementRef<T>`, `ComponentRef<T>`,
    `TemplateRef<C>`, `ViewContainerRef` — tipos que reflejan los de Angular.
- **`static ɵcmp` / `ɵdir` / `ɵpipe`**: `ng-js-vite` puede emitir el registro
  normalizado como propiedad estática de la clase, así `createComponent` sobre una
  clase importada con `import()` no re-parsea nada.

### El espectro de autoría

De más "AngularJS crudo" a más "Angular idiomático", todo produce el mismo
registro; el consumidor elige dónde pararse y `ngjs-core` / `ng-js-vite` aceptan
cualquier punto:

```
.component('foo', {...})   ─▶   component(Foo).define({...})   ─▶   Component({...})(Foo)   ─▶   @Component({...}) class Foo {}
  raw AngularJS                   JS, sin build, sin sintaxis        JS/TS, funcional              TS, experimentalDecorators
```

Esto es la contracara de «Retrocompatible por construcción»: el transform solo
toca archivos con decoradores, pero el registro que produce es el mismo al que
llega un `.js` a mano por la vía `static` / funcional.

---

## Bootstrap y módulo

| Angular | ngjs | Migra | Nota |
|---|---|---|---|
| `@NgModule({ declarations, imports, providers, bootstrap })` | `ng-js-vite` → `angular.module(name, [deps])` + registro por cada `declaration`/`provider` | directo | |
| `platformBrowserDynamic().bootstrapModule(AppModule)` | bootstrap propio: `angular.bootstrap(el, [mod])` dentro de la zona | shim | esperar `DOMContentLoaded`; devuelve `ApplicationRef` |
| `ApplicationRef.tick()` | `$rootScope.$digest()` guardado por `$$phase` | shim | con Zone corre solo al vaciarse la microtask queue |
| `ApplicationRef.isStable` / `whenStable()` | estado de la zona + `firstValueFrom` | shim | |
| `APP_INITIALIZER` | bloque `.run()` generado | shim | |
| `ErrorHandler` | `.decorator('$exceptionHandler')` | shim | |

## Componente

| Angular | ngjs | Migra | Nota |
|---|---|---|---|
| `@Component({ selector, template })` | `ng-js-vite` → `.component('sel', { controller, controllerAs: '$', template })` | tpl | selector solo de elemento (`restrict: 'E'`) |
| `templateUrl` | `ng-js-vite`: content-hash + import del HTML | shim | resuelto en build |
| `styles` / `styleUrls` / `styleUrl` / `ViewEncapsulation.Emulated` | `ng-js-vite`: atributo `_content-<hash>` en cada elemento y selector | shim | encapsulación emulada |
| `@Input() x` | `ng-js-vite` deriva `bindings: { x: '<' }` | directo | `@Input({ required })` → `<` + assert; string → `@` |
| `@Input() set x()` | `<` + `$onChanges` puenteado | shim | `$onChanges` shallow/async |
| `@Output() x = new EventEmitter()` | `bindings: { x: '&' }` + `EventEmitter` (RxJS `Subject`) que invoca el `&` | directo | `emit(v)` → `x({ $event: v })` |
| `@HostBinding` / `@HostListener` | `ng-js-vite` → `link` de directiva / `$element.on()` | directo | |
| `implements OnInit` → `ngOnInit()` | el bridge lo conecta a `$onInit()` | directo | la clase nunca escribe `$onInit` |
| `implements OnChanges` → `ngOnChanges(changes)` | `$onChanges(changes)` | directo | el objeto de cambios de AngularJS ya tiene la forma `SimpleChanges` (`currentValue` / `previousValue` / `isFirstChange()`) |
| `implements OnDestroy` → `ngOnDestroy()` | `$onDestroy()` | directo | |
| `implements DoCheck` → `ngDoCheck()` | `$doCheck()` | directo | |
| `implements AfterViewInit` / `AfterContentInit` | ambos a `$postLink()` | brecha | AngularJS no separa view/content |
| `implements AfterViewChecked` / `AfterContentChecked` | watcher propio al final del digest | brecha | |
| `ChangeDetectionStrategy.OnPush` | ignorado | — | con Zone el digest es global |
| `@Attribute('name')` (param decorator) | `$attrs.name` inyectado por posición | shim | valor estático del atributo |
| `ComponentRef.setInput()` / `.destroy()` / `.instance` | `ComponentRef` de `ngjs-core` | shim | `setInput` dispara `$onChanges` |
| `afterNextRender()` / `afterRender()` | `$scope.$$postDigest()` | shim | corre al final del digest, sin fase browser-only |
| `hostDirectives: [...]` | aplicar varias directivas al host en el registro | brecha parcial | sin re-exponer `inputs`/`outputs` |
| `ElementRef` | `$element[0]` | shim | |
| `Renderer2` | DOM directo / `angular.element` | brecha | sin abstracción de render |

**Bridge de ciclo de vida.** La clase implementa las interfaces de Angular
(`OnInit`, `OnChanges`, `OnDestroy`, `DoCheck`, …) con métodos `ngX`. El decorador
de `$controller` de `ngjs-core`, al instanciar el controller, detecta esos métodos
y los reenvía al hook `$…` de AngularJS (`ngOnInit` → `$onInit`, `ngOnChanges` →
`$onChanges`, `ngOnDestroy` → `$onDestroy`, `ngDoCheck` → `$doCheck`,
`ngAfterViewInit`/`ngAfterContentInit` → `$postLink`). La clase **nunca escribe**
`$onInit` ni ningún hook con `$`.

**Ya implementado y probado contra AngularJS real** (`ngOnInit`/`ngOnChanges`/
`ngOnDestroy`/`ngDoCheck`, los 4 reenvíos 1-a-1; `ngAfterViewInit`/`ngAfterContentInit`
→ `$postLink` queda pendiente, no es 1-a-1). Dos comportamientos reales, no obvios,
que valen la pena tener presentes:
- **`$onChanges` puede dispararse más de una vez por `$digest()`** — el "initial"
  del propio `angular.bootstrap()`/linking (con `currentValue: undefined` si el
  valor todavía no existía) corre aparte del que dispara el watcher normal.
- **`$doCheck` corre por cada vuelta del loop interno de dirty-checking de
  AngularJS, no una vez por `$digest()`** — un solo `$digest()` puede iterar
  varias veces hasta estabilizar, y dispara `$doCheck` en cada vuelta.

## Directivas y binding de template

| Angular | ngjs | Migra | Nota |
|---|---|---|---|
| `@Directive({ selector: '[x]' })` | `ng-js-vite` → `.directive('x')` `restrict: 'A'` | directo | |
| `@Directive({ exportAs: 'x' })` + `#r="x"` | controller de directiva + `require: 'x'` / `ng-ref` read | shim | |
| `*ngIf` / `*ngFor` / `[ngSwitch]` | `ng-if` / `ng-repeat` / `ng-switch` | tpl | |
| `[ngClass]` / `[ngStyle]` | `ng-class` / `ng-style` | tpl | |
| `[prop]="x"` / `(event)="f()"` | interpolación / `ng-*` | tpl | |
| `#ref` | `ng-ref` + bridge de `ngjs-core` | tpl | ver `@ViewChild` |
| `[(ngModel)]` | `ng-model` | tpl | |
| `[disabled]="x"` | CLI → `ng-disabled="x"`; `ngjs-core` extiende `ngDisabled` → inyectable `NgDisabled` (`.disabled` + `.onChange`) | tpl | equivale a `@Input() disabled` / `setDisabledState` |
| `NgPlural` / `i18nPlural` | `ngPluralize` (`ng-pluralize`) | tpl | AngularJS lo trae de fábrica |
| `ngProjectAs="[x]"` | asignación de slot en `transclude` | tpl | |
| `<ng-container>` | directiva propia sin nodo en el DOM | shim | |

## Proyección y vistas dinámicas

| Angular | ngjs | Migra | Nota |
|---|---|---|---|
| `<ng-content>` / `<ng-content select="[x]">` | `transclude: true` / `transclude: { x: '?x' }` | tpl | slots nombrados, sin selector CSS libre |
| `<ng-template>` / `TemplateRef` | `transclude: 'element'` (`TemplateRef` de `ngjs-core`) | shim | plantilla diferida |
| `<ng-template let-a let-b="$implicit">` | scope transcluido con locals (`$implicit` + nombrados) | shim | `TemplateRef` ya expone contexto |
| `*ngTemplateOutlet` (+ context) | directiva de `ngjs-core` | tpl | |
| `NgComponentOutlet` (+ lazy `import()`) | `ViewContainerRef.createComponent` (directiva envoltorio) | tpl | |
| `ViewContainerRef` (`createEmbeddedView` / `createComponent`) | `ViewContainerRef` de `ngjs-core` (`$compile` + DOM) | shim | |
| lazy component: `await import('./x')` + `createComponent(X)` | `import()` (chunk del bundler) + registro diferido + `createComponent` | shim | ver abajo |
| `@ViewChild` / `@ViewChildren` | decorador de `ngjs-core` (`ng-ref` + registro de query) | shim | resuelto en `$postLink` |
| `@ContentChild` / `@ContentChildren` | ídem sobre el contenido transcluido | shim | |
| `QueryList` (`.changes`) | `QueryList` de `ngjs-core` (RxJS `Subject`) | directo | |

**Componentes lazy.** AngularJS **no registra componentes/directivas/servicios
después del `bootstrap`** (`$compileProvider.component()` solo existe en la fase
config). Solución: `CoreModule.config` captura `$compileProvider`,
`$controllerProvider`, `$provide`, `$filterProvider`, `$animateProvider` y los
guarda. El transform, para un chunk lazy, emite el registro usando esos providers
capturados. Entonces `await import('./x')` corre el side-effect que registra
`<x>`, y `createComponent(X)` (que registra la clase si falta y compila `<x>`) lo
instancia. `@defer` (sintaxis v17) queda fuera; el mecanismo de carga sí está.

**UI-Router `lazyLoad` y ESM.** UI-Router **sí** trae `lazyLoad` en el estado, pero
su contrato es de la era SystemJS/webpack: espera un `Promise<{ states: [...] }>` (o
un `NgModule`), no un `import()` nativo cuyo módulo resuelto solo tiene
side-effects. El wrapper de `router/` adapta: recibe el resultado de `import()`,
deja que el chunk se registre por los providers capturados, y le devuelve a
UI-Router el `{ states }` que espera. Así `loadChildren`/`loadComponent` con
`() => import(...)` nativo funcionan.

## Inyección de dependencias

| Angular | ngjs | Migra | Nota |
|---|---|---|---|
| `@Injectable({ providedIn: 'root' })` / `@NgModule({ providers })` | `ng-js-vite` → `.service(name, Class)` / `.factory` | directo | instancia única de app |
| `constructor(private x: Foo)` | `ng-js-vite` lee `design:paramtypes` (+ `@Inject`) → genera `$inject` | directo | requiere `emitDecoratorMetadata` |
| `@Inject(TOKEN)` / `InjectionToken<T>` | nombre string único en `$inject` | shim | sin tipo en runtime |
| `@Optional()` | nodo devuelve `null` en vez de lanzar | shim | ver «Inyector jerárquico» |
| `@Self()` / `@Host()` / `@SkipSelf()` | limitan el recorrido del nodo (solo este / hasta el host / desde el padre) | shim | ver «Inyector jerárquico» |
| **`@Component({ providers: [X] })`** / `providedIn` no-root | nodo de inyector por instancia de componente, anclado al DOM | shim | ver «Inyector jerárquico» |
| `{ provide, useClass }` / `useExisting` | el nodo instancia la clase / resuelve el alias | shim | app-level → `.service()` |
| `{ provide, useValue }` | el nodo devuelve el valor / `.constant()` si es app-level | shim | |
| `{ provide, useFactory, deps }` | el nodo llama la factory con `deps` resueltos | shim | app-level → `.factory([...deps, fn])` |
| `{ provide, multi: true }` | el nodo junta todos los providers del token en un array | shim | |
| `ModuleWithProviders` | `.provider()` configurable en `.config()` | shim | |
| `Injector` / `INJECTOR` token / `Injector.get()` | el nodo (con fallback a `$injector`) | shim | |
| `forwardRef` | thunk `() => Clase` desenvuelto por `ReflectInjection.translate` recién al leer `$inject` | directo | ver límite abajo |

**Límite de `forwardRef` con `design:paramtypes`.** El parámetro de ctor que usa
`@Inject(forwardRef(() => X))` **no puede tiparse con `X` literal** (`param: X`) si `X` se
define más abajo en el mismo archivo: `emitDecoratorMetadata` arma `design:paramtypes` como un
array que necesita `X` ya evaluado, y eso truena con un TDZ real sin importar que `@Inject` lo
vaya a pisar después — no es un bug de `ensureInject`, es cómo funciona `emitDecoratorMetadata`
en sí. En el caso real (las dos clases en archivos separados, que es como se da una dependencia
circular en la práctica) **sí hay tipado completo, sin perder nada**: tipar el parámetro con
`import("./archivo").X` (sintaxis inline) en vez de importar `X` directo — confirmado con una
prueba en este toolchain que TS emite `Object` para esa posición aunque `X` sea un valor real e
importable, igual que con una interfaz, y `@Inject` la resuelve sin problema. El `import { X }`
normal en el archivo (el que usa `forwardRef(() => X)`) no tiene drama aunque sea circular entre
módulos: en ESM un import circular no truena al importar, solo si LEÉS el binding antes de que se
haya asignado, y acá recién se lee dentro del closure de `forwardRef`, que corre mucho después
de que ambos módulos terminaron de cargar. El único caso que sí pierde tipado (`unknown`) es
mismo archivo + mismo scope — ahí TS siempre trata a la clase como "valor real disponible" sin
importar el orden textual, sin truco posible; es un caso raro (normalmente el ciclo cruza
archivos). `ensureInject` soporta el caso general: si `$inject` trae un `forwardRef` sin
desenvolver, deja `$inject` como getter lazy en vez de resolver en el momento — la traducción
real ocurre recién cuando algo lee `$inject` de verdad (que en AngularJS es al instanciar,
momento en el que la clase referida ya existe).

**Decisión abierta — `InjectionToken` con `factory` (tree-shakable).** `InjectionToken<T>`
acepta `{ factory: () => T }` (sin `providedIn`: acá siempre es a nivel app, no hay otro
nivel todavía). La `factory` no corre al crear el token, solo se guarda. Falta implementar
el "momento de hacer registry": cuando `Injector.get(token)` no lo encuentra en el
`$injector` real, correr `factory()` (puede usar `inject()` para sus propias deps) y
registrar el resultado vía `ConfigProviderFactory.current.$provide.constant(...)` (mismo
mecanismo que componentes lazy), para que quede cacheado y visible también por `$inject`
nativo, no solo por `Injector.get()`. Pendiente para cuando se retome `injector.ts`.

### Inyector jerárquico (`providers` a nivel de componente)

Un contenedor chico, paralelo al `$injector`, anclado al árbol de componentes.

```ts
interface ElementInjectorNode {
  providers: Map<Token, ProviderRecord>;   // de @Component/@Directive `providers`
  cache: Map<Token, unknown>;              // instancias ya creadas en este nodo
  parent?: ElementInjectorNode;            // nodo del componente ancestro
}
```

- **Construcción**: en el decorador de `$controller`, al instanciar el controller
  de un componente que declara `providers`. Se busca el nodo padre con
  `$element.inheritedData('$ngjsInjector')` (jqLite sube por el DOM), se crea el
  nodo propio y se guarda con `$element.data('$ngjsInjector', node)`.
  Un componente sin `providers` no crea nodo: pasa el del padre.
- **Resolución** `node.get(token, flags)`:
  1. `cache` del nodo → devolver.
  2. `providers` del nodo → instanciar según el record:
     - clase → `new`, resolviendo su `design:paramtypes` contra **este** `node`
     - `useValue` → tal cual · `useFactory` → llamar con `deps` resueltos ·
       `useExisting` → `node.get(alias)` · `multi` → array de todos.
     cachear y devolver.
  3. `parent.get(token)` (salvo `@Self`).
  4. `$injector.get(stringName(token))` — todo lo app-level cae acá.
  5. nada → `@Optional` devuelve `null`, si no lanza.
- **Modificadores**: `@Self` = solo paso 1–2 · `@SkipSelf` = arrancar en `parent`
  · `@Host` = no pasar el borde del componente host · `@Optional` = `null` en vez
  de throw.
- **Inyección por constructor**: el transform genera una factory de controller que
  resuelve cada parámetro con `node.get(token)` en vez del array `$inject` plano.
  Los servicios `.service()`/`.factory()` normales siguen igual (caen en el paso 4).
- **Teardown**: en `$scope.$on('$destroy')`, llamar `ngOnDestroy` de las instancias
  del `cache`.
- **Límite**: `inheritedData` sube por el **DOM**; para contenido proyectado el
  árbol lógico de Angular puede diferir. Primera versión: árbol DOM, documentado.

Esto hace que `@Self` / `@Host` / `@SkipSelf` / `@Optional` también pasen de
`brecha` a `shim`: ahora hay una jerarquía real sobre la que aplicarlos.

## Detección de cambios

No se reimplementa nada. Zone.js dispara el `$digest` y con eso el dirty-checking
de AngularJS recorre todo. `ChangeDetectorRef` existe solo por compatibilidad de
API: es un passthrough fino.

| Angular | ngjs | Migra | Nota |
|---|---|---|---|
| `NgZone` / `run` / `runOutsideAngular` | Zone.js + `onMicrotaskEmpty` → `$digest` guardado | shim | |
| `ChangeDetectorRef.detectChanges()` | `$scope.$digest()` | shim | fuerza un digest síncrono |
| `ChangeDetectorRef.markForCheck()` | no-op (con Zone ya va a haber digest) | shim | |
| `ChangeDetectorRef.detach()` / `reattach()` | `$scope.$suspend()` / `$resume()` si se quiere; opcional | shim | |
| `ChangeDetectionStrategy.OnPush` | ignorado | — | con Zone el digest es global; no hay CD por componente que saltear |

## Reactividad y async

### RxJS bajo el digest

**Con Zone.js no hace falta código extra**: si la subscripción se crea dentro de la
zona (toda la app arranca dentro de `digestZone.run()`), cada emisión que mute el
modelo dispara un `$digest` al vaciarse la microtask queue.

- Operadores **síncronos** (`map`, `filter`, `tap`, `scan`): corren en el contexto
  del `.next()` / `.subscribe()`. Si el `.next()` viene de un evento DOM o un
  `Promise` (parcheados), quedan dentro de la zona. ✅
- Operadores **async** (`debounceTime`, `delay`, `timer`, `interval`, `auditTime`,
  `throttleTime`): `asyncScheduler` usa `setTimeout`/`setInterval`; `asapScheduler`
  usa `Promise`; `animationFrameScheduler` usa `requestAnimationFrame`. Los tres
  parcheados por Zone. ✅
- `fromEvent` → `addEventListener`, parcheado. ✅
- **Excepciones** (necesitan `ngZone.run(...)` a mano): subscripción movida con
  `runOutsideAngular`, y fuentes sobre APIs que Zone core no parchea (WebSocket
  crudo, `EventSource`, mensajes de Web Worker).
- `$http` ya dispara digest por sí mismo (usa `$q` + `$browser.defer`); envolverlo
  en `from(...)` no lo rompe.

### interop

| Angular | ngjs | Migra | Nota |
|---|---|---|---|
| `EventEmitter` | RxJS `Subject` | directo | `EventEmitter` ya extiende `Subject` |
| `AsyncPipe` (`| async`) | **no** es `.filter()` (esos son singleton de toda la app, sin `$scope` de quien lo usa) — se inyecta por-instancia como `ElementRef` (`AsyncPipeImpl`, un `$scope` propio ya resuelto); en template: `$ctrl.async.transform(value$)`, no `value$ \| async` | shim | cambio de sintaxis a propósito — es el costo de que la limpieza en `$destroy` funcione de verdad |
| `HttpClient` (Observable) | **no** envuelve `$http` — pega directo contra `$httpBackend` (transporte crudo, sin el pipeline de `$http`), control total del armado request/response | shim | corre bajo el digest; unsubscribe() cancela de verdad (vía el `timeout`-como-Promise que ya soporta `$httpBackend` nativo) |
| `HttpHeaders` / `HttpParams` | clases inmutables propias (`set`/`append`/`delete` devuelven copia), se aplanan recién al armar la llamada a `$httpBackend` | directo | |
| `HttpInterceptor` | cadena tipo "onion" armada a mano (`buildInterceptorChain`), registrados con `multi: true` (`HTTP_INTERCEPTORS`, mismo mecanismo de etapa 3) | directo | no `$httpProvider.interceptors` — eso es de `$http` |
| `HttpErrorResponse` | se emite como error del Observable (no como valor) | directo | |
| `DestroyRef` (`core/lifecycle/destroy-ref-bridge.ts`) | se inyecta por-instancia como `ElementRef`/`AsyncPipe` (no hay `inject(DestroyRef)` ambiental) | shim | por dentro es un `Subject` de RxJS directo, no un `Set` a mano |
| `takeUntilDestroyed(destroyRef)` (`@angular/core/rxjs-interop`) | operador que completa en `$destroy`; `destroyRef` es SIEMPRE explícito acá (real Angular lo resuelve solo con `inject()` ambiental, nosotros no tenemos eso) | shim | |
| `outputToObservable(ref.x)` | el `@Output` **ya es** un `Subject` | directo | identidad |
| `outputFromObservable(obs$)` | `@Output` respaldado por `obs$` | shim | |
| `Promise` que muta el modelo | Zone la parchea → dispara `$digest` | directo | ya no hace falta `$q` |

## Pipes

| Angular | ngjs | Migra | Nota |
|---|---|---|---|
| `@Pipe({ name: 'x' })` `transform()` | `ng-js-vite` → `.filter('x', …)` | directo | |
| `date` / `currency` / `number` / `json` / `lowercase` / `uppercase` | filtros homónimos (`number` = `DecimalPipe`) | tpl | |
| `slice` | `limitTo` (+ `begin`) | tpl | semántica no idéntica |
| `titlecase` / `percent` / `keyvalue` | sin filtro nativo → `.filter()` propio | shim | |
| pipe puro vs impuro | filtro: se re-evalúa en cada digest | brecha | sin memoización |

## Forms

`ng-js-vite` no ayuda acá.

| Angular | ngjs | Migra | Nota |
|---|---|---|---|
| `FormsModule` / `[(ngModel)]` / `#f="ngForm"` | `ng-model`, `<form name>` → `FormController`, `ng-form` | tpl | template-driven mapea bien |
| `ngModelGroup` | `ng-form` anidado | tpl | |
| `ReactiveFormsModule` | — | brecha | no existe en AngularJS |
| `FormControl` / `FormGroup` / `FormArray` | clases propias con `value`, `valueChanges`/`statusChanges` (`BehaviorSubject`), `setValue`, `patchValue` | brecha | shim propio |
| `FormBuilder` | factory propia que arma el árbol de `FormControl` | brecha | |
| `[formGroup]` / `formControlName` / `formArrayName` | directiva propia que ata el `FormControl` shim al `NgModelController` del input | brecha | el grueso del trabajo |
| `Validators.*` / validador custom | `(control) => errors | null` | shim | firma idéntica → reutilizable en Angular |
| `ControlValueAccessor` / `NG_VALUE_ACCESSOR` | `NgModelController`: `$render`, `$formatters`, `$parsers`, `$setViewValue` | shim | mapeo casi 1:1 para controles custom |
| `ControlValueAccessor.setDisabledState()` | `NgDisabled` de `ngjs-core` (`.disabled` + `.onChange`) | shim | ver «Primitivas» |
| `Validator` / `NG_VALIDATORS` / `AsyncValidator` / `NG_ASYNC_VALIDATORS` | `NgModelController.$validators` / `$asyncValidators` | shim | |
| `updateOn: 'blur' \| 'submit'` | `ngModelOptions="{ updateOn: 'blur' }"` | directo | AngularJS trae `ngModelOptions` |
| display de errores (`@if (ctrl.hasError('x'))`) | `ngMessages` / `ngMessage` bajo el capó (o `ng-if` sobre `.$error`) | tpl | `angular-messages` da la mecánica |
| estados (`touched`, `dirty`, `pending`…) | replicados en el shim / leídos del `NgModelController` | brecha | |

## Router

Sustrato: `@uirouter/angularjs` (no `ngRoute`).

| Angular | ngjs (UI-Router) | Migra | Nota |
|---|---|---|---|
| `RouterModule.forRoot(routes)` / `forChild` | módulo `ui.router` + `.config($stateProvider => …)` | shim | árbol de estados con nombre |
| `Route { path, component, children, data }` | `$stateProvider.state({ name, url, component })` anidado | brecha | mapa estado↔path para el codemod |
| `<router-outlet>` (+ `name`) | `<ui-view>` (+ `name`) | tpl | |
| `routerLink` / `routerLinkActive` | `ui-sref` / `ui-sref-active` | tpl | la forma `['/x', id]` la arma el codemod |
| `Router.navigate` / `navigateByUrl` | `$state.go` / `$state.href` | shim | |
| `ActivatedRoute` (params/data/query como `Observable`) | shim RxJS sobre `$transitions.onSuccess` + `$state.params` | brecha | UI-Router entrega valores planos |
| re-uso de componente al cambiar un param | UI-Router re-crea la vista salvo `dynamic: true` | brecha | |
| `CanActivate` / `CanDeactivate` / `CanMatch` | hooks `$transitions.onBefore` / `.onExit` | shim | `UrlTree` → `TargetState` |
| `Resolve` / `resolve: {}` | `resolve: {}` en el estado | directo | |
| `Route.data` / `Route.title` | `state.data` / `state.data.title` | shim | |
| `TitleStrategy` / `Title` | `$transitions.onSuccess` → `document.title` | shim | |
| `loadChildren: () => import(...)` | `lazyLoad` del estado + wrapper que adapta el `import()` nativo al contrato `{ states }` de UI-Router | shim | ver «UI-Router `lazyLoad` y ESM» |
| `loadComponent: () => import(...)` | ídem + registro del componente vía providers capturados | shim | |
| eventos del router (`NavigationStart`…) | hooks de transición | brecha | |

## Animaciones

Autoría: la DSL de `@angular/animations` (`trigger`, `state`, `style`, `animate`,
`transition`, …) tal cual. Sustrato: `ngAnimate` + `$animateCss`. El CLI/`ng-js-vite`
compila el `animations: [...]` del `@Component` a llamadas de `$animateCss` y a una
directiva que interpreta `[@trigger]` en el template.

| Angular | ngjs (ngAnimate) | Migra | Nota |
|---|---|---|---|
| `@Component({ animations: [trigger(...)] })` | metadata compilada a `$animateCss` + directiva de trigger | shim | la DSL se escribe igual que en Angular |
| `trigger` / `state` / `style` / `animate` / `transition` | `$animateCss(el, { from, to, duration, easing, delay })` por transición | shim | |
| `keyframes([...])` | `@keyframes` generado + `$animateCss({ keyframeStyle })` | shim | |
| `[@trigger]="expr"` en template | directiva propia que observa `expr` y corre la transición state→state | tpl | `[@...]` ya es sintaxis Angular |
| `(@trigger.start)` / `(@trigger.done)` | callbacks del runner de `$animateCss` (`.start()` / `.done()`) | tpl | |
| `:enter` / `:leave` | hooks `.ng-enter` / `.ng-leave` de `ngAnimate` (o `$animate.enter/leave`) | shim | |
| `:increment` / `:decrement` | comparación de valor numérico en la directiva de trigger | shim | |
| `[@.disabled]` | `$animate.enabled(element, false)` | shim | |
| `AnimationBuilder` / `AnimationPlayer` | wrapper sobre `$animateCss` con `play/pause/finish/destroy` | shim | |
| `BrowserAnimationsModule` / `provideAnimations()` | incluir `ngAnimate` en el módulo | directo | |
| `NoopAnimationsModule` | `$animate.enabled(false)` / `$animateProvider.customFilter` | shim | |
| `query()` / `stagger()` / `group()` / `sequence()` / `animateChild()` | orquestar varios runners de `$animateCss` con delays | brecha | parcial; la orquestación fina se pierde |

## Primitivas de `ngjs-core` (portadas de `reference/`)

Lo que ya existe en `reference/` y hay que reincorporar a la base nueva.

| Primitiva | Respalda | Forma |
|---|---|---|
| `CoreModule` (`ng.core`) / `CommonModule` (`ng.common`) | `@NgModule` base | `angular.module` + `.decorator("$controller" / "ngRefDirective" / "ngDisabledDirective")` |
| decorador de `$controller` | ciclo de queries + locals por controller | monta el `ViewQueryRegistry`, inyecta `ViewContainerRef` / `ChangeDetectorRef` como locals |
| `ApplicationRef` (+ `Impl`) | `ApplicationRef` | servicio: `bootstrap`, `tick`, `isStable`, `whenStable`, `attachView` |
| `NgZone` (+ factory sobre `$rootScope`) | `NgZone` | `run` / `runOutsideAngular` / `onStable` — **hoy turn-tracker propio; va a Zone.js real** |
| `ChangeDetectorRef` / `NgChangeDetectorRef` | `ChangeDetectorRef` | `markForCheck` / `detectChanges` / `detach` / `reattach` sobre `$scope` |
| `ViewChild` / `viewChild` / `ViewChildren` / `viewChildren` | `@ViewChild(ren)` | decorador + funcional; se resuelven vía el bridge de `ng-ref` |
| `ContentChild` / `contentChild` / `ContentChildren` / `contentChildren` | `@ContentChild(ren)` | ídem sobre contenido transcluido |
| `QueryList` | `QueryList` | `.changes` (RxJS), `.first` / `.last` / `.length`, iterable |
| bridge de `ng-ref` (`decorNgRef`) | `#ref`, `read:` de las queries | `.decorator("ngRefDirective")`: `ng-ref` resuelve `TemplateRef` / `ViewContainerRef` / `ElementRef` / controller y alimenta el registro de queries |
| `TemplateRef` (`ng.common`) | `<ng-template>` | `transclude: 'element'` + `let-*` / `$implicit` |
| `NgTemplateOutlet` (`ng.common`) | `*ngTemplateOutlet` | directiva `[ng-template-outlet]` + context |
| `NgContent` (`ng.common`) | `<ng-content>` (incl. reproyección) | directiva + "content query owners" |
| `ContentRef` / `<ng-container>` (`ng.common`) | `<ng-container>` que expone `ViewContainerRef` | `transclude: 'element'` |
| `ViewContainerRef` (+ `Impl`) | `ViewContainerRef` | `createEmbeddedView` / `createComponent` / `insert` / `move` / `detach` / `clear` |
| `EmbeddedViewRef` / `ViewRef` | `EmbeddedViewRef` / `ViewRef` | `rootNodes`, `destroy`, `onDestroy`, `context` |
| `ComponentRef` (+ `Impl`) | `ComponentRef` | `setInput` (+ `$onChanges`), `instance`, `location`, `hostView`, `destroy`, `onDestroy` |
| `ElementRef` (+ `Impl`) | `ElementRef` | `nativeElement` |
| `createComponent` | `ViewContainerRef.createComponent`, bootstrap | `$compile` + link + espera del controller + proyección de nodos; expuesto en `globalThis` |
| `NgDisabled` (+ `Impl` + `decorNgDisabled`) | `[disabled]` / `setDisabledState` | ver abajo |

### `NgDisabled` — extensión sobre `ng-disabled`

El `ng-disabled` nativo solo hace `el.prop('disabled', v)`. `ngjs-core` lo decora
(`.decorator("ngDisabledDirective")`) con un controller que **observa el atributo y
expone el estado**:

```ts
abstract class NgDisabled {
  readonly disabled: boolean;
  onChange(cb: (disabled: boolean) => void): () => void;   // devuelve unsubscribe
}
```

Un componente hace `require: '^ngDisabled'` (o inyecta `NgDisabled`) y sabe si está
deshabilitado y reacciona a los cambios. Equivale a `@Input() disabled` con setter,
o a `ControlValueAccessor.setDisabledState(isDisabled)` en Angular. En template, el
CLI reescribe `[disabled]="expr"` → `ng-disabled="expr"`.

## Servicios de plataforma

| Angular | ngjs | Migra | Nota |
|---|---|---|---|
| `Location` / `LocationStrategy` (`PathLocationStrategy` / `HashLocationStrategy`) | `$location` / `$locationProvider.html5Mode()` | shim | |
| `PlatformLocation` | `$window.location` | shim | |
| `DOCUMENT` token | `$document` | shim | |
| `ViewportScroller` | `$anchorScroll` / scroll manual | shim | |
| `Title` | `$document[0].title` | directo | |
| `Meta` | `<meta>` en `$document` a mano | shim | |
| `DomSanitizer.sanitize()` / `[innerHTML]` | `$sanitize` (`ngSanitize`) + `ng-bind-html` | shim | |
| `bypassSecurityTrustHtml` / `…Url` / `…ResourceUrl` / `…Style` / `…Script` | `$sce.trustAsHtml` / `…Url` / `…ResourceUrl` / `…Css` / `…Js` | shim | nombres casi calcados |
| `SafeHtml` / `SafeUrl` / `SafeResourceUrl` (tipos) | valores marcados por `$sce` | shim | |
| `@angular/cdk/layout` `BreakpointObserver` / `Breakpoints` (`XSmall`…`XLarge`, `Handset`, `Tablet`, `Web`) | servicio sobre `window.matchMedia` → `Observable<BreakpointState>` (RxJS; Zone lo corre bajo el digest) | shim | |
| `MediaMatcher` | `window.matchMedia` directo | shim | |

## Build y entornos

Sustrato: la config del CLI + el bundler (Vite / esbuild).

| Angular | ngjs | Migra | Nota |
|---|---|---|---|
| `angular.json` (targets, `assets`, `styles`, `scripts`, `budgets`) | config del CLI (`ngjs.config.ts` / campos en `package.json`) + config del bundler | shim | el CLI mapea los campos relevantes |
| `src/environments/environment.ts` + `.prod.ts` | `environment.ts` + reemplazo por modo (`fileReplacements` del CLI o `define` del bundler) | shim | `import { environment }` queda igual |
| `fileReplacements` por `--configuration` | el CLI sustituye el archivo según el modo de build | shim | |
| `isDevMode()` | `import.meta.env.DEV` / flag del `environment` | shim | |

## i18n

Sustrato: `angular-translate` (+ `angular-dynamic-locale` para el `$locale`).

| Angular | ngjs | Migra | Nota |
|---|---|---|---|
| `i18n="meaning\|desc@@id"` en template | `translate` directiva / `{{ 'id' \| translate }}` | tpl | el CLI extrae `id` + texto default a un catálogo |
| `$localize\`…\`` | `$translate('id')` / filtro `translate` | shim | |
| `ng extract-i18n` (catálogo) | el CLI genera el catálogo de `angular-translate` desde los `i18n` / `$localize` | shim | reversible |
| `LOCALE_ID` / `registerLocaleData` | `tmhDynamicLocale` + `$translate.use()` | shim | cambia `$locale` en runtime |
| locale de `DatePipe` / `CurrencyPipe` | `$locale` cambiado por `angular-dynamic-locale` | shim | |
| ICU (`{count, plural, …}`) | `angular-translate` + interpolación MessageFormat | brecha parcial | |

## Accesibilidad

| Angular | ngjs | Migra | Nota |
|---|---|---|---|
| ARIA implícita (Material / directivas) | `ngAria`: `aria-*`, `role`, `tabindex`, teclado automáticos | shim | AngularJS no lo hace solo |
| `@angular/cdk/a11y` (`LiveAnnouncer`, `FocusTrap`, `FocusMonitor`) | — | brecha | sin lib de AngularJS; fuera de `ngjs-core` |
| `A11yModule` | `ngAria` | shim | solo la parte automática |

## Fuera de alcance

| Concepto | Alternativa |
|---|---|
| `@defer` (sintaxis v17) | `*ngIf` + `import()` manual (el mecanismo lazy sí existe, ver «Componentes lazy») |
| `NgOptimizedImage` (`ngSrc`) | `<img>` normal |
| SSR / hydration / `TransferState` | irrelevante sobre AngularJS |
| `CUSTOM_ELEMENTS_SCHEMA` / Web Components | registrar elementos a mano |
| `@angular/service-worker` | — |
| `TestBed` | `angular.mock.module` / `angular.mock.inject` |

---

# Construcción

Alcance: `ngjs-core` + el transform (`ng-js-vite` / CLI). Los consumidores son
libres y se adaptan cuando esto esté listo.

## Versiones y adopción

Adopción incremental, no migración brusca.

### Retrocompatible por construcción

El runtime **es** AngularJS. Una app AngularJS existente agrega `ngjs-core` + el
plugin y sigue andando: el transform solo toca archivos **con decoradores**; todo
lo demás (`.component()` / `.directive()` / `.service()` a mano, templates `ng-*`)
pasa sin cambios. Un `@Component` nuevo y un `.component()` viejo conviven en el
mismo módulo.

### v1 — núcleo

Lo mínimo para escribir `@Component` y que corra. Etapas **0–10 + 3b**:
`@NgModule`, `@Component`/`@Directive`/`@Pipe`, `@Input`/`@Output`, DI (app-level +
jerárquico), lifecycle, queries, refs, common, `ChangeDetectorRef` passthrough,
transform MVP, `environment` por modo.

### v2 — extras

Se adopta cuando el código base ya está en `@Component`. Etapas **11–19**:
pipes built-in, rxjs-interop, HTTP, `platform-browser` (sanitizer / location /
breakpoints), forms reactivos, router, animations, i18n + a11y, codemod inverso.

Una app arranca con v1, pasa su código a `@Component`, y sube a v2 cuando necesita
los extras.

## CLI / `ng-js-vite` — qué hace con los conceptos

Una vez que los decoradores y las primitivas existen, el transform (AST de TS, no
regex) tiene estas responsabilidades:

### 1. Leer

- Decoradores de clase: `@Component`, `@Directive`, `@Pipe`, `@NgModule`, `@Injectable`.
- Decoradores de miembro: `@Input`, `@Output`, `@HostBinding`, `@HostListener`,
  `@ViewChild(ren)`, `@ContentChild(ren)`, `@Attribute`.
- Metadata emitida: `design:paramtypes` (ctor), `propMetadata`.
- `template` / `templateUrl` / `styles` / `styleUrl(s)`, `animations: [...]`.
- Interfaces implementadas (`OnInit`, `ControlValueAccessor`, …) para saber qué
  hooks reenviar.

### 2. Generar (registro AngularJS)

| De | A |
|---|---|
| `@NgModule({ declarations, imports, providers, bootstrap })` | `angular.module(name, [deps])` + `.component()/.directive()/.service()/.filter()` por entrada |
| `@Component` | `IComponentOptions`: `bindings` de `@Input`/`@Output`, `controllerAs: '$'`, `require` de `@ViewChild/@ContentChild read`, `transclude` según `<ng-content>` del template, `template` importado |
| `@Directive` | `IDirective` `restrict:'A'`, `bindToController`, `require` |
| `@Injectable` / `providers` | `.service()` / `.factory()` con `$inject` de `design:paramtypes` + `@Inject` |
| ctor tipado | array `$inject` de nombres string / tokens |
| `@HostBinding` / `@HostListener` | `link` de la directiva host / `$element.on()` |
| `animations: [...]` | llamadas a `$animateCss` + registro de la directiva `[@trigger]` |
| `@Pipe` | `.filter(name, factory)` |

### 3. Templates

- Hoy (opción A): content-hash + import + encapsulación de estilos (`_content-<hash>`).
- Si se cierra la opción B: traducir `[prop]`→`ng-prop-*`/interpolación,
  `(event)`→`ng-*`, `*ngIf`→`ng-if`, `{{ x }}`→`{{ $.x }}`, `#ref`→`ng-ref`,
  `[@t]`→directiva, `[(ngModel)]`→`ng-model`, pipes→filtros, `i18n`→`translate`.

### 4. i18n

Extraer `i18n` / `$localize` a un catálogo de `angular-translate`; generar el
`$translate.use()` para `LOCALE_ID`.

### 5. Build y entornos

Resolver `src/environments/environment.ts` según el modo (`--configuration` /
`fileReplacements` o `define` del bundler); mapear los campos de `angular.json`
(`assets`, `styles`, `budgets`) a la config del bundler.

### 6. Codemod inverso (ngjs → Angular)

Quitar lo generado, reconstruir el `@NgModule` real, retraducir template
AngularJS → Angular, `ui-sref`→`[routerLink]` con el mapa estado↔path,
`$http`→`HttpClient`. Marcar lo no-mecánico con `// TODO(migrate): …`.

### 7. Diagnóstico

Reportar cada `brecha` que aparezca en el fuente: `query()`/`stagger()` de
animaciones, subscripción a WebSocket sin `ngZone.run`, etc.

## Arquitectura de `src/`

```
src/
  index.ts                    barrel público
  event-emitter.ts            Subject + emit(); hoja (solo rxjs). La usan platform
                              (eventos de NgZone, etapa 1) y core (@Output/output()).
                              Vive en la raíz para no invertir `platform ← core`.
  platform/
    zone-flags.ts             __Zone_disable_toString (antes de zone.js)
    ng-zone.ts                abstract NgZone + NgZoneImpl (facade sobre el fork de Zone)
    digest-bridge.ts          NgZoneFactory: fork + tracking de tasks + emisores + $digest guardado
    bootstrap.ts              bootstrapModule → angular.bootstrap dentro de la zona
    application-ref.ts        tick / isStable / whenStable / attachView / components
  core/
    di/                       @Injectable, @Inject, @Optional, @Self/@SkipSelf/@Host,
                              InjectionToken, Injector (wrapper de $injector), reflect.ts
    metadata/                 def.ts (ComponentDef/DirectiveDef/PipeDef/…),
                              define-component.ts + component()/directive()/pipe()/injectable() (primitivo + piel JS),
                              @Component/@Directive/@Pipe/@NgModule + @Input/@Output/@HostBinding/@HostListener/@Attribute (piel TS),
                              input()/output()/model() (marcadores de binding), store.ts (bucket), reflector.ts
    lifecycle/                interfaces OnInit/… + SimpleChanges,
                              shared.ts (decorateControllerWith: maneja `later` de $controller, reusable),
                              lifecycle-bridge.ts (decorador de $controller: ngX→$X — el resto de
                              etapa 5, inyector jerárquico y hosts, son otros decoradores acá mismo,
                              cada uno con su propio archivo, todos usando shared.ts)
    change-detection/         ChangeDetectorRef
    queries/                  viewChild/contentChild, QueryList, registry, ng-ref bridge
    refs/                     ElementRef, ComponentRef, ViewRef, EmbeddedViewRef,
                              ViewContainerRef, TemplateRef
    create-component.ts
    ng-disabled.ts
  common/                     ng-template, ng-content, ng-container, ng-template-outlet
  forms/                      FormControl/Group/Array, FormBuilder, Validators,
                              control-value-accessor (↔ NgModelController),
                              directivas formGroup / formControlName
  router/                     wrappers sobre @uirouter/angularjs: RouterModule,
                              router-outlet, router-link, ActivatedRoute, guards, resolve
  animations/                 re-export DSL, trigger.directive, animate-css-runner,
                              AnimationBuilder
  platform-browser/          DomSanitizer ($sce+$sanitize), Title, Meta, Location
  rxjs-interop/              takeUntilDestroyed, outputToObservable/outputFromObservable
  i18n/                       wrappers sobre angular-translate + angular-dynamic-locale
```

**Regla de dependencias:** `platform` ← `core` ← el resto. `core` no importa
`forms`/`router`/`animations`/`i18n`. Los módulos de nivel superior dependen de
`core` + `platform`, no entre sí. Excepción: `src/event-emitter.ts` es una hoja
(solo `rxjs`) por debajo de todo; la importan tanto `platform` como `core`.

## Orden de construcción

Ver [`ORDEN-DE-CONSTRUCCION.md`](./ORDEN-DE-CONSTRUCCION.md) — roadmap completo,
etapa por etapa, en formato checklist (qué está hecho y qué falta).
