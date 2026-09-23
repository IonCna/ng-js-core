import { NgContainer } from "@/common/ng-container.ts";
import { NgContent } from "@/common/ng-content.ts";
import { NgTemplateOutlet } from "@/common/ng-template-outlet.ts";
import { NgModule } from "@/core/metadata/ng-module.ts";
import { TemplateRef } from "@/core/refs/template-ref.ts";
import { BrowserViewportScroller, ViewportScroller } from "@/common/viewport-scroller.ts";
import { APP_BASE_HREF, BrowserPlatformLocation, Location, LocationImpl, PlatformLocation } from "@/common/location/index.ts";
import { KeyValuePipe } from "@/pipes/key-value.ts";
import { PercentPipe } from "@/pipes/percent.ts";
import { TitleCasePipe } from "@/pipes/title-case.ts";

@NgModule({
  declarations: [NgContent, NgContainer, NgTemplateOutlet, TemplateRef, KeyValuePipe, PercentPipe, TitleCasePipe],
  providers: [
    { provide: APP_BASE_HREF, useValue: "/" },
    { provide: PlatformLocation, useClass: BrowserPlatformLocation },
    { provide: Location, useClass: LocationImpl },
    { provide: ViewportScroller, useClass: BrowserViewportScroller },
  ],
})
export class CommonModule {}
