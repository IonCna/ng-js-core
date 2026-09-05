import angular from "angular";
import { configureCore } from "@/runtime/core-module";
import type { Provider, TypeProvider } from "@/core/di/provider.ts";
import { ensureInject, ReflectInjection } from "@/core/di/reflect.ts";
import { ApplicationRef } from "@/core/platform/application-ref";
import { runAppInitializers } from "@/core/platform/app-initializer";
import { NgZoneFactory } from "@/core/platform/digest-bridge";
import { ErrorHandler } from "@/core/platform/error-handler";

export interface BootstrapOptions {
    /** Módulos AngularJS extra a cargar junto con `ng.js.core`. */
    modules?: string[];
    /** Host donde montar la app. Selector o `Element`. Default: `<body>`. */
    hostElement?: string | Element;
}

/**
 * Entrypoint del bootstrap — fiel a `platformBrowserDynamic()`. No es token de DI
 * ni se subclasea, pero se parte en `abstract` + `Impl` por consistencia con el
 * resto del framework.
 */
export abstract class PlatformRef {
    abstract bootstrapModule(moduleName: string, options?: BootstrapOptions): Promise<ApplicationRef>;
    abstract onDestroy(callback: () => void): void;
    abstract destroy(): void;
    abstract readonly destroyed: boolean;
}

export class PlatformRefImpl extends PlatformRef {
    private _destroyed = false;
    private readonly _destroyListeners = new Set<() => void>();
    private readonly _apps: ApplicationRef[] = [];

    async bootstrapModule(moduleName: string, options: BootstrapOptions = {}): Promise<ApplicationRef> {
        this.assertNotDestroyed();
        await documentReady();

        const ngZone = NgZoneFactory.create();
        const coreName = configureCore(ngZone); // "ng.js.core" + .constant("NgZone", ngZone) per-bootstrap

        const host = resolveHost(options.hostElement);
        const modules = [coreName, ...(options.modules ?? []), moduleName];

        let injector!: angular.auto.IInjectorService;
        ngZone.run(() => {
            injector = angular.bootstrap(host, modules, { strictDi: false });
        });

        // Cablear el cable Zone→$digest (ApplicationRef) y el listener de errores
        // de zona ANTES de los APP_INITIALIZER, que pueden agendar microtasks.
        // `CoreModule` ya no fuerza esto (necesita una NgZone real; ver core-module.ts).
        const appRef = injector.get<ApplicationRef>(ApplicationRef.$name);
        const errorHandler = injector.get<ErrorHandler>(ErrorHandler.$name);
        ngZone.onError.subscribe((error) => errorHandler.handleError(error));

        await runAppInitializers(injector); // corre + espera antes de resolver

        this._apps.push(appRef);
        return appRef;
    }

    onDestroy(callback: () => void): void {
        this.assertNotDestroyed();
        this._destroyListeners.add(callback);
    }

    get destroyed(): boolean {
        return this._destroyed;
    }

    destroy(): void {
        if (this._destroyed) return;
        this._destroyed = true;

        for (const app of this._apps) app.destroy();
        this._apps.length = 0;

        for (const callback of this._destroyListeners) callback();
        this._destroyListeners.clear();
    }

    private assertNotDestroyed(): void {
        if (this._destroyed) throw new Error("PlatformRef ya fue destruido");
    }
}

let platform: PlatformRef | undefined;

/** Singleton de la plataforma. */
export function platformBrowser(): PlatformRef {
    platform ??= new PlatformRefImpl();
    return platform;
}

export interface ApplicationConfig {
    /** Módulos AngularJS que declaran el componente raíz y sus dependencias. */
    modules?: string[];
    /** Host de la app. Default: se busca/crea `<root-component>`. */
    hostElement?: string | Element;
    /** Providers a nivel app — ver etapa 3, `Provider`. */
    providers?: Provider[];
}

/**
 * Arranca una app desde un componente raíz ya registrado (en alguno de
 * `config.modules`). Crea `<root-component>` como host si no existe, carga
 * `ng.js.core` + esos módulos, y resuelve con el `ApplicationRef` cuando
 * terminan los `APP_INITIALIZER`.
 */
export function bootstrapApplication(
    rootComponent: string,
    config: ApplicationConfig = {},
): Promise<ApplicationRef> {
    const module = angular.module("ng.js.application", [...(config.modules ?? [])]);
    registerProviders(module, config.providers ?? []);

    return platformBrowser().bootstrapModule(module.name, {
        hostElement: config.hostElement ?? ensureHost(rootComponent),
    });
}

type SingleProvider = Exclude<Provider, Provider[]>;

function isTypeProvider(provider: SingleProvider): provider is TypeProvider {
    return typeof provider === "function";
}

function registerProviders(module: angular.IModule, providers: Provider[]): void {
    const flat = (providers as unknown[]).flat(Infinity) as SingleProvider[];
    const single = new Map<string, SingleProvider>();
    const multi = new Map<string, SingleProvider[]>();

    for (const provider of flat) {
        const token = isTypeProvider(provider) ? provider : provider.provide;
        const name = ReflectInjection.translate(token);

        if (!isTypeProvider(provider) && provider.multi) {
            multi.set(name, [...(multi.get(name) ?? []), provider]);
        } else {
            single.set(name, provider); // el último gana, como en Angular
        }
    }

    for (const [name, provider] of single) {
        registerSingle(module, name, provider);
    }

    for (const [name, group] of multi) {
        const memberNames = group.map((provider, i) => {
            const memberName = `${name}#multi#${i}`;
            registerSingle(module, memberName, provider);
            return memberName;
        });

        module.factory(name, [
            "$injector",
            ($injector: angular.auto.IInjectorService) => memberNames.map((memberName) => $injector.get(memberName)),
        ]);
    }
}

function registerSingle(module: angular.IModule, name: string, provider: SingleProvider): void {
    if (isTypeProvider(provider)) {
        ensureInject(provider);
        module.service(name, provider as unknown as Function);
        return;
    }

    if ("useValue" in provider) {
        module.constant(name, provider.useValue);
        return;
    }

    if ("useClass" in provider) {
        ensureInject(provider.useClass);
        module.service(name, provider.useClass as unknown as Function);
        return;
    }

    if ("useFactory" in provider) {
        const deps = (provider.deps ?? []).map(ReflectInjection.translate);
        module.factory(name, [...deps, provider.useFactory] as unknown as angular.Injectable<Function>);
        return;
    }

    if ("useExisting" in provider) {
        const existingName = ReflectInjection.translate(provider.useExisting);
        module.factory(name, ["$injector", ($injector: angular.auto.IInjectorService) => $injector.get(existingName)]);
        return;
    }

    // ConstructorProvider: `provide` es la propia clase, `deps` son sus argumentos de ctor.
    const ctor = provider.provide as unknown as { $inject: string[] };
    ctor.$inject = (provider.deps ?? []).map(ReflectInjection.translate);
    module.service(name, provider.provide as unknown as Function);
}

function documentReady(): Promise<void> {
    if (typeof document === "undefined" || document.readyState !== "loading") {
        return Promise.resolve();
    }
    return new Promise((resolve) => {
        document.addEventListener("DOMContentLoaded", () => resolve(), { once: true });
    });
}

function resolveHost(hostElement?: string | Element): Element {
    if (hostElement instanceof Element) return hostElement;
    if (typeof hostElement === "string") {
        const found = document.querySelector(hostElement);
        if (!found) throw new Error(`bootstrap: no se encontró el host "${hostElement}"`);
        return found;
    }
    return document.body;
}

function ensureHost(rootComponent: string): Element {
    const tag = toKebabCase(rootComponent);
    const existing = document.querySelector(tag);
    if (existing) return existing;

    const created = document.createElement(tag);
    document.body.appendChild(created);
    return created;
}

function toKebabCase(value: string): string {
    return value.replace(/([a-z0-9])([A-Z])/g, "$1-$2").toLowerCase();
}
