import type { IComponentOptions } from "angular";

export const ProjectionCardComponent: IComponentOptions = {
  bindings: {
    title: "@",
  },
  transclude: true,
  template: `
    <article class="projection-card">
      <header class="projection-card__header">{{$ctrl.title}}</header>
      <div class="projection-card__body">
        <ng-content></ng-content>
      </div>
    </article>
  `,
};
