import { component } from "@/compat/index.ts";

/**
 * "Chunk lazy" para el spike de compat: **JS plano**, sin TS, sin decoradores,
 * sin compilador. Solo la forma funcional que auto-registra.
 */

class CompatLazyUsers {}
component(CompatLazyUsers).define({
  selector: "compat-lazy-users",
  template: "<h2>compat lazy users</h2>",
});

export const CHILD_ROUTES = [{ path: "users", component: CompatLazyUsers }];
