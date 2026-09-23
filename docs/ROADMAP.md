# Roadmap de `ngjs-core`

## Superficie declarativa migrada

Los decoradores que el compilador ya reconoce viven en `ngjs-core` como APIs
inertes. No registran AngularJS ni guardan metadata en runtime:

- `Component`, `Directive`, `Pipe`, `NgModule`, `Injectable`
- `Input`, `Output`, `HostBinding`, `HostListener`, `Attribute`
- `Inject`, `Optional`, `Self`, `SkipSelf`, `Host`

`ng-js-compiler` lee esas llamadas, las elimina del código y genera el contrato
compilado (`ɵfac`, `ɵprov`, `ɵcmp`, `ɵdir`, `ɵpipe`, `ɵmod`).

## Pendientes con costo runtime

Estas piezas no deben resolverse con decoradores inertes solamente:

- `inject()` en código que realmente se ejecuta en runtime.
- queries (`ViewChild`, `ViewChildren`, `ContentChild`, `ContentChildren`) y `QueryList`.
- `ElementRef`, `TemplateRef`, `ViewContainerRef`, `DestroyRef` y refs dinámicas.
- `hostDirectives` aplicado a elementos reales.
- conexión runtime de `EventEmitter` con outputs AngularJS.
- proyección de contenido (`ng-content`).
- plataforma y bootstrap consumiendo `ɵngjsPlatform`.
- forms, router, async pipe, animaciones e i18n.

`Service` no forma parte del target: el target es Angular 14/16 y la API de
servicios es `Injectable`.
