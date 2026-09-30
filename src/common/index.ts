export { TemplateRef } from "@/core/refs/template-ref.ts";
export { AsyncPipe } from "@/pipes/async-pipe.ts";
export { type KeyValue, KeyValuePipe } from "@/pipes/key-value.ts";
export {
  CurrencyPipe,
  DATE_PIPE_DEFAULT_OPTIONS,
  DatePipe,
  type DatePipeConfig,
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
export { CommonModule } from "./common.module.ts";
export { formatDate } from "./i18n/format-date.ts";
export {
  formatCurrency,
  formatNumber,
  formatPercent,
  getCurrencySymbol,
  getNumberOfCurrencyDigits,
} from "./i18n/format-number.ts";
export * from "./location/index.ts";
export { NgContainer } from "./ng-container.ts";
export { NgContent } from "./ng-content.ts";
export { NgTemplateOutlet } from "./ng-template-outlet.ts";
export { isPlatformBrowser, isPlatformServer } from "./platform.ts";
export { BrowserViewportScroller, ViewportScroller } from "./viewport-scroller.ts";
