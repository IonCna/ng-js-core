import "zone.js";
import type { IRootScopeService } from "angular";
import { describe, expect, it } from "vitest";
import { AfterRenderEventManager } from "@/core/lifecycle/after-render-event-manager";
import { ApplicationRefImpl } from "@/platform/application-ref";
import { NgZoneFactory } from "@/platform/digest-bridge";

function createRootScope() {
	const state = { digests: 0, phase: null as string | null };
	const rootScope = {
		get $$phase() {
			return state.phase;
		},
		$digest() {
			state.digests++;
		},
	} as unknown as IRootScopeService;

	return { rootScope, state };
}

/** Espera a que se vacíe la cola de microtasks (y el bookkeeping del zone). */
const flushMicrotasks = () => new Promise((resolve) => setTimeout(resolve, 0));

function wire() {
	const { rootScope, state } = createRootScope();
	const ngZone = NgZoneFactory.create();
	// ApplicationRefImpl se suscribe a onMicrotaskEmpty en su constructor.
	new ApplicationRefImpl(rootScope, ngZone, new AfterRenderEventManager());
	return { ngZone, state };
}

describe("etapa 1 — zona → digest", () => {
	it("una promesa nativa dentro de la zona dispara un $digest", async () => {
		const { ngZone, state } = wire();

		ngZone.run(() => {
			void Promise.resolve().then(() => undefined);
		});

		expect(ngZone.isStable).toBe(false);

		await flushMicrotasks();

		expect(state.digests).toBe(1);
		expect(ngZone.isStable).toBe(true);
	});

	it("runOutsideAngular no dispara $digest", async () => {
		const { ngZone, state } = wire();

		ngZone.runOutsideAngular(() => {
			void Promise.resolve().then(() => undefined);
		});

		await flushMicrotasks();

		expect(state.digests).toBe(0);
	});

	it("no corre el digest si AngularJS ya está en uno ($$phase)", async () => {
		const { ngZone, state } = wire();
		state.phase = "$digest";

		ngZone.run(() => {
			void Promise.resolve().then(() => undefined);
		});

		await flushMicrotasks();

		expect(state.digests).toBe(0);
	});

	it("una cadena de continuaciones colapsa en un solo digest", async () => {
		const { ngZone, state } = wire();

		ngZone.run(() => {
			void Promise.resolve()
				.then(() => undefined)
				.then(() => undefined)
				.then(() => undefined);
		});

		await flushMicrotasks();

		expect(state.digests).toBe(1);
	});
});
