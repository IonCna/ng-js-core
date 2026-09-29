import type angular from "angular";

type ControllerInvoke = (
  expression: unknown,
  locals?: Record<string, unknown>,
  later?: boolean,
  identifier?: string,
) => unknown;

/** La cadena de una app, colgada de su `$injector` (uno por app). */
interface InjectorWithLateDecorators extends angular.auto.IInjectorService {
  ɵngjsLateControllerDecorators?: LateControllerDecorators;
}

/**
 * Un `.decorator("$controller", fn)` de AngularJS solo aplica si se registra antes de que exista `$controller`: el de
 * un `@NgModule` que llega después del bootstrap (`loadChildren`, propio o de una librería — ej. el `ɵscopedController`
 * de los `providers` de componente) no tendría efecto, porque `$compile` ya guardó el `$controller` de siempre.
 *
 * Este decorador se instala en el bootstrap como el más externo de los de core (como quedaría uno de un módulo eager,
 * que se registra después) y arranca vacío: `LazyNgModuleLoader` le agrega los que traen los módulos lazy con `add()`,
 * y desde ahí cada controller pasa por ellos.
 */
export function decorateControllerLateDecorators(
  $delegate: angular.IControllerService,
  $injector: InjectorWithLateDecorators,
): angular.IControllerService {
  const late = new LateControllerDecorators($delegate as unknown as ControllerInvoke, $injector);
  $injector.ɵngjsLateControllerDecorators = late;
  const wrapped: ControllerInvoke = (expression, locals, later, identifier) => late.invoke(expression, locals, later, identifier);
  return wrapped as unknown as angular.IControllerService;
}
decorateControllerLateDecorators.$inject = ["$delegate", "$injector"];

export class LateControllerDecorators {
  private current: ControllerInvoke;

  constructor(
    delegate: ControllerInvoke,
    private readonly $injector: angular.auto.IInjectorService,
  ) {
    this.current = delegate;
  }

  /**
   * Agrega un decorador de `$controller` que llegó tarde (lo que recibiría `$provide.decorator`): envuelve la cadena
   * actual, como hace AngularJS con los que llegan a tiempo. `false` si la app no tiene el punto de extensión.
   */
  static add($injector: angular.auto.IInjectorService, decorator: angular.Injectable<Function>): boolean {
    const late = ($injector as InjectorWithLateDecorators).ɵngjsLateControllerDecorators;
    if (!late) return false;
    late.current = late.$injector.invoke(decorator, undefined, { $delegate: late.current }) as ControllerInvoke;
    return true;
  }

  invoke(expression: unknown, locals?: Record<string, unknown>, later?: boolean, identifier?: string): unknown {
    return this.current(expression, locals, later, identifier);
  }
}
