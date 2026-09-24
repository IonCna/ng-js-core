import type angular from "angular";

/**
 * `$animateProvider` — `@types/angular` no lo tipa. Mínimo para capturarlo;
 * se amplía en etapa 17 (animations) si hace falta.
 */
export interface IAnimateProvider extends angular.IServiceProvider {
  register(name: string, factory: unknown): void;
  classNameFilter(regex?: RegExp): RegExp;
  customFilter(fn?: unknown): unknown;
}

export interface ConfigProviderParams {
  $compile: angular.ICompileProvider;
  $controller: angular.IControllerProvider;
  $provide: angular.auto.IProvideService;
  $filter: angular.IFilterProvider;
  $animate: IAnimateProvider;
  /** `$injector` de fase config (el *provider injector*) — para cargar `@NgModule`s lazy. */
  $providerInjector: angular.auto.IInjectorService;
}

/**
 * Captura los providers que solo existen en la fase `.config()` de AngularJS,
 * para que el registro diferido (createComponent / componentes lazy, etapa 6)
 * pueda registrar `.component()` / `.service()` / `.filter()` después del bootstrap.
 */
export class ConfigProviderFactory {
  private static _instance?: ConfigProviderFactory;

  static get current() {
    return ConfigProviderFactory._instance;
  }

  private constructor(
    public readonly $compile: angular.ICompileProvider,
    public readonly $controller: angular.IControllerProvider,
    public readonly $provide: angular.auto.IProvideService,
    public readonly $filter: angular.IFilterProvider,
    public readonly $animate: IAnimateProvider,
    public readonly $providerInjector: angular.auto.IInjectorService,
  ) {}

  /** El `.config()` que los captura (lo registra `NativeModule`). */
  static readonly capture = Object.assign(
    (
      $compileProvider: angular.ICompileProvider,
      $controllerProvider: angular.IControllerProvider,
      $provide: angular.auto.IProvideService,
      $filterProvider: angular.IFilterProvider,
      $animateProvider: IAnimateProvider,
      $injector: angular.auto.IInjectorService,
    ): void =>
      ConfigProviderFactory.from({
        $compile: $compileProvider,
        $controller: $controllerProvider,
        $provide,
        $filter: $filterProvider,
        $animate: $animateProvider,
        $providerInjector: $injector,
      }),
    {
      $inject: [
        "$compileProvider",
        "$controllerProvider",
        "$provide",
        "$filterProvider",
        "$animateProvider",
        "$injector",
      ],
    },
  );

  static from(providers: ConfigProviderParams): void {
    ConfigProviderFactory._instance = new ConfigProviderFactory(
      providers.$compile,
      providers.$controller,
      providers.$provide,
      providers.$filter,
      providers.$animate,
      providers.$providerInjector,
    );
  }
}
