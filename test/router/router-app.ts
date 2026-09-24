import { CompiledApp } from "../compiled-app.ts";

/** Lo que usan los tests del router de su `Router` compilado. */
export interface RouterLike {
  url: string;
  navigateByUrl(url: string): Promise<boolean>;
  navigate(commands: unknown[], extras?: object): Promise<boolean>;
  events: { subscribe(fn: (event: { constructor: { name: string }; url?: string }) => void): void };
}

/**
 * Una app compilada con el router: arranca en `url`, espera a que se asienten las transiciones (UI-Router resuelve en
 * varios `$apply` + microtasks) y da atajos para navegar y leer el DOM. Porta de `old/test/router/root-layout/harness.ts`.
 */
export class RouterApp {
  private constructor(readonly app: CompiledApp) {}

  static async boot(files: Record<string, string>, url = "/"): Promise<RouterApp> {
    const app = await CompiledApp.bootstrap({ "main.ts": ROUTER_MAIN, ...files }, "", {
      url: `http://localhost${url}`,
    });
    const routerApp = new RouterApp(app);
    await routerApp.settle();
    return routerApp;
  }

  /** Varias vueltas de `$apply` + macrotask: lo que tarda UI-Router en asentar una transición (y sus lazy). */
  async settle(pending?: PromiseLike<unknown>): Promise<void> {
    const $rootScope = this.app.get<{ $$phase: string | null; $apply(): void }>("$rootScope");
    for (let i = 0; i < 25; i++) {
      if (!$rootScope.$$phase) $rootScope.$apply();
      await new Promise((resolve) => setTimeout(resolve, 0));
    }
    await pending;
  }

  get router(): RouterLike {
    return this.app.inject<RouterLike>("Router");
  }

  async navigate(url: string): Promise<boolean> {
    const result = this.router.navigateByUrl(url);
    await this.settle(result);
    return result;
  }

  get text(): string {
    return this.app.document.body.textContent?.replace(/\s+/g, " ").trim() ?? "";
  }

  get path(): string {
    const { pathname, search, hash } = this.app.window.location;
    return pathname + search + hash;
  }

  query(selector: string): Element | null {
    return this.app.document.querySelector(selector);
  }

  destroy(): Promise<void> {
    return this.app.destroy();
  }
}

/** `main.ts` de los fixtures del router: arranca `AppModule`. */
export const ROUTER_MAIN = `import { platformBrowserDynamic } from "ngjs-core";
import { AppModule } from "./app.module";
(globalThis as any).ɵready = platformBrowserDynamic().bootstrapModule(AppModule);
`;
