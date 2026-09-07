import { type InjectableOptions, stampInjectableName } from "@/core/di/injectable.ts";
import { RootSingletonRegistry } from "@/core/di/root-singleton-registry.ts";

export type ServiceOptions = Pick<InjectableOptions, "id">;

const serviceClasses = new WeakSet<Function>();

function assertNoConstructorParams(Clase: Function): void {
  if (Clase.length > 0) {
    throw new Error(
      `@Service: "${Clase.name}" declara parámetro(s) de constructor — @Service no admite DI por constructor ` +
        `(se instancia con "new" a secas, sin resolver argumentos). Pedí las dependencias con inject() en un field initializer.`,
    );
  }
}

/**
 * Singleton implícito de toda la app: a diferencia de `@Injectable`, no hace
 * falta listarlo en ningún `providers` ni poner `providedIn: 'root'` — con
 * `@Service()` alcanza. La otra cara de esa comodidad: sin DI por constructor
 * (se instancia con `new Clase()` a secas — sin nodo de inyector, ni `$scope`,
 * ni elemento al que colgarse, no hay de dónde resolver argumentos) y sin
 * recetas de provider (`useClass`/`useFactory`/`useExisting`) — para eso está
 * `@Injectable` + `providers`. Dependencias: `inject()` en un field
 * initializer, igual que en Angular real.
 *
 * Se construye lazy, la primera vez que algo lo pide (`RootSingletonRegistry`)
 * — AngularJS no deja agregar un `.service()` nuevo después del bootstrap, así
 * que no hay forma de registrarlo de antemano contra el `$injector` real.
 */
export function Service(options?: ServiceOptions): ClassDecorator {
  return (target) => {
    const Clase = target as unknown as Function;
    assertNoConstructorParams(Clase);
    stampInjectableName(Clase, options);
    serviceClasses.add(Clase);

    const name = (Clase as unknown as { $name: string }).$name;
    RootSingletonRegistry.register(name, () => Reflect.construct(Clase as new () => object, []));
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
 * la app. Se usa en los tres lugares que procesan `providers` (NgModule,
 * `ElementInjectorNode`, `ngjs-core/compat`).
 */
export function assertNotServiceProvider(ctor: Function): void {
  if (isServiceClass(ctor)) {
    throw new Error(
      `"${ctor.name}" es @Service — ya es un singleton implícito de toda la app, no hace falta (ni se puede) ` +
        `listarlo en "providers". Sacalo de ahí; para inyectarlo alcanza con inject(${ctor.name}) o el constructor.`,
    );
  }
}
