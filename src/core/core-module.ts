import angular, {type IExceptionHandlerService} from "angular";
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

        module.decorator("$exceptionHandler", NgCoreModule.decorateErroHandler())

        module.config(NgCoreModule.catchProviders())
        
        module.run(NgCoreModule.provideApplicationRef())
        module.run(NgCoreModule.provideErrorHandlerListener())

        return module
    }
}
