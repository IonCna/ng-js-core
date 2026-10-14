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
import { AsyncFilterPipe } from "@/pipes/async-pipe.ts";
import { CurrencyPipe } from "@/pipes/currency.ts";
import { DecimalPipe } from "@/pipes/decimal.ts";
import { I18nPluralPipe } from "@/pipes/i18n-plural.ts";
import { I18nSelectPipe } from "@/pipes/i18n-select.ts";
import { KeyValuePipe } from "@/pipes/key-value.ts";
import { PercentPipe } from "@/pipes/percent.ts";
import { SlicePipe } from "@/pipes/slice.ts";
import { TitleCasePipe } from "@/pipes/title-case.ts";

@NgModule({
  // `ng-content`/`ng-container`/`ng-template` son directivas nativas de `NativeModule` (las trae la plataforma).
  // `number` y `currency` reemplazan a los filtros de AngularJS del mismo nombre: este módulo carga después de `ng`.
  declarations: [
    NgTemplateOutlet,
    AsyncFilterPipe,
    CurrencyPipe,
    DecimalPipe,
    I18nPluralPipe,
    I18nSelectPipe,
    KeyValuePipe,
    PercentPipe,
    SlicePipe,
    TitleCasePipe,
  ],
  providers: [
    { provide: APP_BASE_HREF, useValue: "/" },
    { provide: PlatformLocation, useClass: BrowserPlatformLocation },
    { provide: Location, useClass: LocationImpl },
    { provide: ViewportScroller, useClass: BrowserViewportScroller },
  ],
})
export class CommonModule {}
