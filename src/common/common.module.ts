import {
  APP_BASE_HREF,
  BrowserPlatformLocation,
  Location,
  LocationImpl,
  PlatformLocation,
} from "@/common/location/index.ts";
import { NgTemplateOutlet } from "@/common/ng-template-outlet.ts";
import { BrowserViewportScroller, ViewportScroller } from "@/common/viewport-scroller.ts";
import { NgModule } from "@/core/metadata/ng-module.ts";
import { KeyValuePipe } from "@/pipes/key-value.ts";
import {
  CurrencyPipe,
  DatePipe,
  DecimalPipe,
  I18nPluralPipe,
  I18nSelectPipe,
  JsonPipe,
  LowerCasePipe,
  PercentPipe,
  SlicePipe,
  TitleCasePipe,
  UpperCasePipe,
} from "@/pipes/index.ts";

@NgModule({
  // `ng-content`/`ng-container`/`ng-template` son directivas nativas de `NativeModule` (las trae la plataforma).
  // Los pipes de `@angular/common` con su nombre: `date`/`number`/`currency`/`uppercase`/`lowercase`/`json` reemplazan
  // al filtro de AngularJS del mismo nombre (se registran después de `ng`).
  declarations: [
    NgTemplateOutlet,
    KeyValuePipe,
    DatePipe,
    DecimalPipe,
    PercentPipe,
    CurrencyPipe,
    UpperCasePipe,
    LowerCasePipe,
    TitleCasePipe,
    JsonPipe,
    SlicePipe,
    I18nPluralPipe,
    I18nSelectPipe,
  ],
  providers: [
    { provide: APP_BASE_HREF, useValue: "/" },
    { provide: PlatformLocation, useClass: BrowserPlatformLocation },
    { provide: Location, useClass: LocationImpl },
    { provide: ViewportScroller, useClass: BrowserViewportScroller },
  ],
})
export class CommonModule {}
