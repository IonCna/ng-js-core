import { applyConstructorInject } from "@/core/di/ctor-inject.ts";
import { flatInject } from "@/core/di/inject.ts";
import { getInjectFlags } from "@/core/di/inject-flags.ts";
import { type InjectableOptions, stampInjectableName } from "@/core/di/injectable.ts";
import { RootSingletonRegistry } from "@/core/di/root-singleton-registry.ts";

export type ServiceOptions = Pick<InjectableOptions, "id">;

const serviceClasses = new WeakSet<Function>();

/**
 * Singleton implícito de toda la app: a diferencia de `@Injectable`, no hace
 * falta listarlo en ningún `providers` ni poner `providedIn: 'root'` — con
 * `@Service()` alcanza. Sin recetas de provider (`useClass`/`useFactory`/
 * `useExisting`) — para eso está `@Injectable` + `providers`. Sus dependencias
 * de constructor (`@Inject(Token)` + `design:paramtypes`) se resuelven en
 * modo "plano" (como `inject()` fuera de una construcción manejada por
 * AngularJS: `$injector`/`RootSingletonRegistry` de la app, sin nodo
 * jerárquico) — no hay elemento/`$scope` al que colgarse, así que `self`/
 * `skipSelf`/`host` no aplican, solo `optional`.
 *
 * Se construye lazy, la primera vez que algo lo pide (`RootSingletonRegistry`)
 * — AngularJS no deja agregar un `.service()` nuevo después del bootstrap, así
 * que no hay forma de registrarlo de antemano contra el `$injector` real.
 */
export function Service(options?: ServiceOptions): ClassDecorator {
  return (target) => {
    const Clase = target as unknown as Function;
    applyConstructorInject(Clase);
    stampInjectableName(Clase, options);
    serviceClasses.add(Clase);

    const name = (Clase as unknown as { $name: string }).$name;
    RootSingletonRegistry.register(name, () => {
      const deps = (Clase as unknown as { $inject?: readonly string[] }).$inject ?? [];
      const args = deps.map((dep, index) => flatInject(dep, getInjectFlags(Clase, index)));
      return Reflect.construct(Clase as new (...args: unknown[]) => object, args);
    });
  };
}

export function isServiceClass(value: unknown): value is Function {
  return typeof value === "function" && serviceClasses.has(value);
}

/**
 * Un `@Service` ya se auto-registra solo (`RootSingletonRegistry`) — listarlo
 * en un `providers: [...]` (de `@NgModule` o de `@Component`/`@Directive`) es
 * casi seguro un malentendido: alguien esperando que ahí se vuelva
 * per-instancia/per-componente, cuando `@Service` es siempre único para toda
 * la app. Se usa en los lugares que procesan `providers` (NgModule,
 * `ElementInjectorNode`).
 */
export function assertNotServiceProvider(ctor: Function): void {
  if (isServiceClass(ctor)) {
    throw new Error(
      `"${ctor.name}" es @Service — ya es un singleton implícito de toda la app, no hace falta (ni se puede) ` +
        `listarlo en "providers". Sacalo de ahí; para inyectarlo alcanza con inject(${ctor.name}) o el constructor.`,
    );
  }
}
