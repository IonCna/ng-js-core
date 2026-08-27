import type { ComponentRef } from "@/core";
import type { CreateComponentOptions } from "@/core/decorators/ng-create-component";

declare global {
  function createComponent<C>(component: string, options: CreateComponentOptions): ComponentRef<C>;
}
