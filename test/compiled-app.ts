import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import type { auto, IAngularStatic, IAugmentedJQuery } from "angular";
import { build, type Plugin } from "esbuild";
import { JSDOM, VirtualConsole } from "jsdom";
import { HashId, MetadataStore } from "ng-js-compiler";
import { pluginLoader } from "ng-js-compiler/esbuild";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const SRC = join(ROOT, "src");

/** Subpath de `ngjs-core` → su entrada en `src/` (lo mismo que `exports` del package.json, pero sin `dist`). */
const ENTRIES: Record<string, string> = {
  "": "index.ts",
  "/core": "core/index.ts",
  "/common": "common/index.ts",
  "/common/http": "http/index.ts",
  "/forms": "forms/index.ts",
  "/animations": "animations/index.ts",
  "/platform-browser": "platform-browser/index.ts",
  "/rxjs-interop": "rxjs-interop/index.ts",
  "/cdk/a11y": "cdk/a11y/index.ts",
  "/cdk/layout": "cdk/layout/index.ts",
  "/i18n": "i18n/index.ts",
  "/router": "router/index.ts",
  "/testing": "testing/index.ts",
};

/** `import ... from "ngjs-core/<sub>"` en el fixture → el código fuente del core, que compila junto con la app. */
class CoreSourceResolver {
  static plugin(): Plugin {
    return {
      name: "ngjs-core-source",
      setup(build) {
        build.onResolve({ filter: /^ngjs-core(\/.*)?$/ }, (args) => {
          const sub = args.path.slice("ngjs-core".length);
          const locale = /^\/i18n\/locales\/([\w-]+)$/.exec(sub)?.[1];
          const entry = locale ? `i18n/locales/${locale}.ts` : ENTRIES[sub];
          if (!entry) return { errors: [{ text: `ngjs-core: subpath "${args.path}" sin entrada en el harness.` }] };
          return { path: join(SRC, entry) };
        });
      },
    };
  }
}

/**
 * Una app compilada con la cadena real (`ng-js-compiler`, igual que `ngjs build`) — los archivos del fixture y el
 * `src/` de `ngjs-core` como un solo proyecto — corriendo sobre AngularJS 1.8 en jsdom. Si `main.ts` no viene en
 * `files`, se arranca `AppModule` de `./app.module` con `platformBrowserDynamic().bootstrapModule()`.
 */
export class CompiledApp {
  private constructor(
    readonly dom: JSDOM,
    /** Lo que la app mandó a `console.error` (el `ErrorHandler` por defecto y `$log.error` terminan acá). */
    readonly errors: unknown[],
    readonly angular: IAngularStatic,
    readonly injector: auto.IInjectorService,
    private readonly dir: string,
  ) {}

  /** `url`: la URL inicial de la ventana (el router la lee); sin ella, `http://localhost/`. */
  static async bootstrap(files: Record<string, string>, html = "", options: { url?: string } = {}): Promise<CompiledApp> {
    const dir = await mkdtemp(join(tmpdir(), "ngjs-core-app-"));
    try {
      await writeFile(join(dir, "package.json"), JSON.stringify({ name: "test-app" }), "utf8");
      const all = { "main.ts": CompiledApp.DEFAULT_MAIN, ...files };
      for (const [name, code] of Object.entries(all)) {
        await mkdir(dirname(join(dir, name)), { recursive: true });
        await writeFile(join(dir, name), code, "utf8");
      }

      const code = await CompiledApp.compile(dir);
      const errors: unknown[] = [];
      const virtualConsole = new VirtualConsole();
      virtualConsole.on("error", (...args: unknown[]) => errors.push(args.length === 1 ? args[0] : args));
      virtualConsole.on("jsdomError", (error: unknown) => errors.push(error));
      const dom = new JSDOM(`<!doctype html><html><head></head><body>${html}</body></html>`, {
        runScripts: "outside-only",
        pretendToBeVisual: true,
        url: options.url ?? "http://localhost/",
        virtualConsole,
      });
      dom.window.eval(code);
      const window = dom.window as unknown as { angular: IAngularStatic; ɵready: Promise<auto.IInjectorService> };
      const injector = await window.ɵready;
      return new CompiledApp(dom, errors, window.angular, injector, dir);
    } catch (error) {
      await rm(dir, { recursive: true, force: true });
      throw error;
    }
  }

  /** Solo compila (sin correr): para mirar el código emitido o esperar un error de build. */
  static async compileOnly(files: Record<string, string>): Promise<string> {
    const dir = await mkdtemp(join(tmpdir(), "ngjs-core-app-"));
    try {
      await writeFile(join(dir, "package.json"), JSON.stringify({ name: "test-app" }), "utf8");
      for (const [name, code] of Object.entries({ "main.ts": CompiledApp.DEFAULT_MAIN, ...files })) {
        await mkdir(dirname(join(dir, name)), { recursive: true });
        await writeFile(join(dir, name), code, "utf8");
      }
      return await CompiledApp.compile(dir);
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  }

  private static readonly DEFAULT_MAIN = `import { platformBrowserDynamic } from "ngjs-core";
import { AppModule } from "./app.module";
(globalThis as any).ɵready = platformBrowserDynamic().bootstrapModule(AppModule);
`;

  private static async compile(dir: string): Promise<string> {
    MetadataStore.clear();
    const result = await build({
      entryPoints: [join(dir, "main.ts")],
      bundle: true,
      write: false,
      format: "iife",
      charset: "utf8",
      logLevel: "silent",
      nodePaths: [join(ROOT, "node_modules")],
      plugins: [CoreSourceResolver.plugin(), pluginLoader([dir, SRC])],
    });
    return result.outputFiles[0]!.text;
  }

  get window(): JSDOM["window"] {
    return this.dom.window;
  }

  get document(): Document {
    return this.dom.window.document;
  }

  get<T>(name: string): T {
    return this.injector.get<T>(name);
  }

  /**
   * Lo que da el injector de la app para un símbolo compilado, por su nombre de DI (`símbolo_hash(símbolo:paquete)`,
   * igual que `TokenName` del compilador): `app.inject("HttpClient")` (de `ngjs-core`), `app.inject("Foo", "test-app")`
   * (del fixture).
   */
  inject<T>(symbol: string, packageName = "ngjs-core"): T {
    return this.injector.get<T>(CompiledApp.tokenName(symbol, packageName));
  }

  static tokenName(symbol: string, packageName = "ngjs-core"): string {
    return HashId.readable(symbol, packageName);
  }

  /** Un valor que el fixture dejó en `globalThis` (`(globalThis as any).x = ...`). */
  global<T>(name: string): T {
    return (this.dom.window as unknown as Record<string, T>)[name] as T;
  }

  element(selector: string): IAugmentedJQuery {
    const found = this.document.querySelector(selector);
    if (!found) throw new Error(`CompiledApp: no hay "${selector}" en el DOM.`);
    return this.angular.element(found);
  }

  controller<T>(selector: string, name?: string): T {
    return this.element(selector).controller(name) as T;
  }

  /**
   * `$compile(html)` contra un scope hijo del `$rootScope` con `values` (lo que hacían los tests con `angular.mock`):
   * para probar directivas/componentes de los módulos que importa la app sobre markup suelto.
   */
  compile<S extends object = Record<string, unknown>>(
    html: string,
    values: S = {} as S,
  ): { element: IAugmentedJQuery; scope: S & { $digest(): void; $destroy(): void } } {
    const $rootScope = this.get<{ $new(): object }>("$rootScope");
    const scope = Object.assign($rootScope.$new(), values) as S & { $digest(): void; $destroy(): void };
    const element = this.get<(markup: string) => (scope: object) => IAugmentedJQuery>("$compile")(html)(scope);
    this.document.body.appendChild(element[0] as Node);
    scope.$digest();
    return { element, scope };
  }

  digest(): void {
    this.get<{ $digest(): void }>("$rootScope").$digest();
  }

  async destroy(): Promise<void> {
    this.dom.window.close();
    await rm(this.dir, { recursive: true, force: true });
  }
}
