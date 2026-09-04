import angular, {type IExceptionHandlerService} from "angular";
import {Injector, InjectorImpl} from "@/core/di/injector";
import {NgZone} from "@/platform/ng-zone";
import {ApplicationRef, ApplicationRefImpl} from "@/platform/application-ref";
import {ErrorHandler, ErrorHandlerImpl} from "@/platform/error-handler";
import {ConfigProviderFactory, type IAnimateProvider} from "@/platform/config-providers";

export class NgCoreModule {
    static provideApplicationRef() {
        const _ = (_: ApplicationRef) => angular.noop()
        _.$inject = [ApplicationRef.$name]

        return _
    }

    static provideInjector() {
        // Injector es lazy por default (.service()) y InjectorImpl.current es un
        // singleton global por proceso: sin esto, con más de una app bootstrappeada
        // .current queda apuntando al $injector de la última que lo haya pedido, no
        // necesariamente el de esta app. Forzar la instanciación acá, en el .run(),
        // garantiza que .current siempre sea el de la app que se acaba de bootstrappear.
        const _ = (_: Injector) => angular.noop()
        _.$inject = [Injector.$name]

        return _
    }

    static decorateErroHandler() {
        const _ = ($delegate: IExceptionHandlerService, errorHandler: ErrorHandler): IExceptionHandlerService => {
            return (exception: Error, cause?: string) => {
                errorHandler.handleError(exception)
                $delegate(exception, cause)
            }
        }

        _.$inject = ["$delegate", ErrorHandler.$name]

        return _
    }

    static provideErrorHandlerListener() {
        const _ = (ngZone: NgZone, errorHandler: ErrorHandler) => {
            ngZone.onError.subscribe((error) => {
                errorHandler.handleError(error)
            })
        }

        _.$inject = [NgZone.$name, ErrorHandler.$name]

        return _
    }

    static catchProviders() {
        const _ = (
            $compileProvider: angular.ICompileProvider,
            $controllerProvider: angular.IControllerProvider,
            $provide: angular.auto.IProvideService,
            $filterProvider: angular.IFilterProvider,
            $animateProvider: IAnimateProvider,
        ) => {
            ConfigProviderFactory.from({
                $compile: $compileProvider,
                $controller: $controllerProvider,
                $provide: $provide,
                $filter: $filterProvider,
                $animate: $animateProvider,
            })
        }

        _.$inject = ["$compileProvider", "$controllerProvider", "$provide", "$filterProvider", "$animateProvider"]

        return _
    }

    static create(ngZone: NgZone) {
        const module = angular.module("ng.js.core", [])

        module.constant(NgZone.$name, ngZone)
        module.service(ApplicationRef.$name, ApplicationRefImpl)
        module.service(ErrorHandler.$name, ErrorHandlerImpl)
        module.service(Injector.$name, InjectorImpl)

        module.decorator("$exceptionHandler", NgCoreModule.decorateErroHandler())

        module.config(NgCoreModule.catchProviders())
        
        module.run(NgCoreModule.provideApplicationRef())
        module.run(NgCoreModule.provideInjector())
        module.run(NgCoreModule.provideErrorHandlerListener())

        return module
    }
}
