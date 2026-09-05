/**
 * Zone.js configuration flags. This module MUST be evaluated before `zone.js`.
 *
 * `__Zone_disable_toString` stops Zone from patching `Function.prototype.toString`.
 * AngularJS infers implicit dependency-injection annotations by reading a
 * function's parameter list from `fn.toString()`, and also decides whether a
 * controller is an ES class the same way. Zone's wrapper changes that source
 * string, which surfaces as spurious `Unknown provider` errors and
 * `Class constructor cannot be invoked without 'new'`. The `Promise`/timer
 * patches that drive the digest bridge stay enabled.
 */
(globalThis as typeof globalThis & { __Zone_disable_toString?: boolean }).__Zone_disable_toString = true;
