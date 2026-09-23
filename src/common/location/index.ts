export { Location, type LocationEvent, LocationImpl } from "@/common/location/location.ts";
export {
  APP_BASE_HREF,
  HashLocationStrategy,
  LocationStrategy,
  PathLocationStrategy,
} from "@/common/location/location-strategy.ts";
export {
  BrowserPlatformLocation,
  type LocationChangeEvent,
  type LocationChangeListener,
  PlatformLocation,
} from "@/common/location/platform-location.ts";
// `joinWithSlash` / `normalizeQueryParams` / `stripTrailingSlash` NO son API pública
// de Angular — se exponen como estáticos de `Location` (igual que en `@angular/common`).
// El uso interno los importa por path directo desde `location/util.ts`.
