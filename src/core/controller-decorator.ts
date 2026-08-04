import type {IAugmentedJQuery, IControllerLocals, IScope} from "angular";

/*
* lazy
* */

interface ViewQueryCreationContext {
    scope: IScope;
    element: IAugmentedJQuery,
}