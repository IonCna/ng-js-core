import { inject } from "@/core/di/inject.ts";
import { Injector } from "@/core/di/injector.ts";
import { Component } from "@/core/metadata/component.ts";
import { NgModule } from "@/core/metadata/ng-module.ts";
import { Pipe } from "@/core/metadata/pipe.ts";
import { ApplicationRef } from "@/core/platform/application-ref.ts";
import type { ViewContainerRef } from "@/core/refs/view-container-ref.ts";
import { RouterModule } from "@/router/index.ts";
import { createComponent } from "@/runtime/create-component.ts";
import { destroyLog, Greeting, GreetingLabel, routeLog } from "./env-shared.ts";

/** Fixture de #1: providers del módulo lazy aislados en su rama. */

let envModuleInstances = 0;

export function envModuleInstanceCount(): number {
  return envModuleInstances;
}

export class LazyCounter {
  count = 41;
  next(): number {
    this.count += 1;
    return this.count;
  }
  ngOnDestroy(): void {
    destroyLog.push("LazyCounter");
  }
}

/** Servicio lazy que depende de otro servicio lazy vía `inject()` en un field initializer. */
export class LazyReport {
  private readonly counter = inject<LazyCounter>("LazyCounter");
  private readonly greeting = inject<Greeting>("Greeting");
  describe(): string {
    return `${this.greeting.text}#${this.counter.next()}`;
  }
}

@Pipe({ name: "lazyShout" })
export class LazyShoutPipe {
  static readonly $inject = ["Greeting"];
  constructor(private readonly greeting: Greeting) {}
  transform(value: string): string {
    return `${value}!${this.greeting.text}`;
  }
}

@Component({
  selector: "env-page",
  controllerAs: "$ctrl",
  template:
    "<p class='report'>{{ $ctrl.report }}</p><greeting-label></greeting-label><p class='pipe'>{{ 'hey' | lazyShout }}</p>" +
    "<p class='module'>{{ $ctrl.moduleTag }}</p><p class='injector'>{{ $ctrl.viaInjector }}</p>",
})
export class EnvPage {
  private readonly reporter = inject<LazyReport>("LazyReport");
  report = this.reporter.describe();
  /** La instancia de la clase `@NgModule` de la rama es inyectable (token = la clase). */
  moduleTag = inject(EnvModule).tag;
  /** `Injector` de la rama: ve los providers lazy y respeta `notFoundValue`. */
  private readonly injector = inject(Injector);
  viaInjector = [
    this.injector.get<Greeting>("Greeting").text,
    this.injector.get<LazyCounter>("LazyCounter") instanceof LazyCounter,
    this.injector.get("NoExiste", "fallback"),
  ].join("|");
}

/** Crea `GreetingLabel` (eager) dinámicamente: por su `ViewContainerRef` y montado en `<body>` con el `Injector` de la rama. */
@Component({ selector: "env-dynamic", template: "<span class='dynamic-anchor'></span>" })
export class EnvDynamic {
  static readonly $inject = ["ViewContainerRef"];
  private readonly injector = inject(Injector);
  private readonly appRef = inject(ApplicationRef);
  constructor(private readonly vcr: ViewContainerRef) {}

  ngOnInit(): void {
    void this.vcr.createComponent(GreetingLabel);

    const outside = document.createElement("div");
    outside.className = "outside-host";
    document.body.appendChild(outside);
    // Vista desacoplada (como `createComponent` de Angular): se adjunta a la app, como hace NgbModal.
    void createComponent(GreetingLabel, { injector: this.injector, hostElement: outside }).then((ref) =>
      this.appRef.attachView(ref.hostView),
    );
  }
}

@Component({ selector: "env-guarded", template: "<p class='guarded'>guarded page</p>" })
export class EnvGuardedPage {}

const seen = (label: string) => () => {
  routeLog.push(`${label}:${inject<Greeting>("Greeting").text}`);
  return true;
};

@NgModule({
  imports: [
    RouterModule.forChild([
      { path: "", component: EnvPage },
      { path: "dynamic", component: EnvDynamic },
      {
        path: "guarded",
        component: EnvGuardedPage,
        canMatch: [seen("canMatch")],
        canActivate: [seen("canActivate")],
        canDeactivate: [seen("canDeactivate")],
        resolve: { greeting: () => routeLog.push(`resolve:${inject<Greeting>("Greeting").text}`) },
        title: () => `title-${inject<Greeting>("Greeting").text}`,
      },
    ]),
  ],
  declarations: [EnvPage, EnvGuardedPage, EnvDynamic, LazyShoutPipe],
  providers: [
    { provide: "Greeting", useValue: new Greeting("lazy") },
    { provide: "LazyCounter", useClass: LazyCounter },
    { provide: "LazyReport", useClass: LazyReport },
  ],
})
export class EnvModule {
  readonly tag = `env-module-${++envModuleInstances}`;
  ngOnDestroy(): void {
    destroyLog.push("EnvModule");
  }
}
