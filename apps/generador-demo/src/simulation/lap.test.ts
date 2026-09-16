import { describe, it, expect } from "vitest";
import fc from "fast-check";
import { advanceLap } from "./lap";
import type { DriverState } from "./state";
import { createFreshTireState } from "./tires";
import type { TireWearRateFactors } from "./tires";

/**
 * Property-based tests para `advanceLap`.
 *
 * Ver design.md, "Property 6: Avance continuo y acotado de lap_dist_pct".
 */

/**
 * Fixtures fijos de neumáticos, irrelevantes para `advanceLap` (que nunca
 * lee `tires`/`tireWearRateFactors`), usados solo para completar la forma
 * de `DriverState`.
 */
const TIRE_STATE_FIXTURE = createFreshTireState(20);
const TIRE_WEAR_RATE_FACTORS_FIXTURE: TireWearRateFactors = { fl: 1, fr: 1, rl: 1, rr: 1 };

/** Arbitrary de un `DriverState` válido para las propiedades de esta suite. */
const driverStateArb: fc.Arbitrary<DriverState> = fc.record({
  driverId: fc.string({ minLength: 1, maxLength: 10 }),
  classId: fc.string({ minLength: 1, maxLength: 10 }),
  lapDistPct: fc.float({ min: 0, max: Math.fround(0.999999), noNaN: true }),
  fuelLevel: fc.float({ min: 0, max: 100, noNaN: true }),
  position: fc.integer({ min: 1, max: 60 }),
  inPits: fc.boolean(),
  currentLapTime: fc.float({ min: 0, max: 300, noNaN: true }),
  lastLapTime: fc.option(fc.float({ min: 0, max: 300, noNaN: true }), { nil: null }),
  bestLapTime: fc.option(fc.float({ min: 0, max: 300, noNaN: true }), { nil: null }),
  delta_to_best: fc.option(fc.float({ min: -60, max: 60, noNaN: true }), { nil: null }),
  delta_to_prev: fc.option(fc.float({ min: -60, max: 60, noNaN: true }), { nil: null }),
  currentSectorIndex: fc.constant(0),
  currentSectorStartLapTime: fc.constant(0),
  lastSectorTimes: fc.constant([null, null, null]),
  bestSectorTimes: fc.constant([null, null, null]),
  baseSpeedFactor: fc.float({ min: Math.fround(0.5), max: 2, noNaN: true }),
  fuelConsumptionPerLap: fc.float({ min: Math.fround(0.1), max: 10, noNaN: true }),
  tires: fc.constant(TIRE_STATE_FIXTURE),
  tireWearRateFactors: fc.constant(TIRE_WEAR_RATE_FACTORS_FIXTURE),
});

/** dtMs: desde ticks normales (~16ms) hasta valores grandes que completen varias vueltas. */
const dtMsArb = fc.float({ min: 0, max: 600_000, noNaN: true });

/**
 * dtMs estrictamente positivo, para las propiedades que comparan el
 * progreso entre dos eventos de telemetría "consecutivos": con dtMs = 0
 * no transcurre tiempo entre ambos, por lo que no cabe esperar un avance
 * estricto de `lapDistPct` (caso degenerado, no un evento consecutivo real).
 */
const positiveDtMsArb = fc.float({ min: Math.fround(0.001), max: 600_000, noNaN: true });

describe("Feature: iracing-telemetry-platform, Property 6: Avance continuo y acotado de lap_dist_pct", () => {
  it("lapDistPct del resultado SHALL estar siempre en el rango [0, 1)", () => {
    fc.assert(
      fc.property(driverStateArb, dtMsArb, (driver, dtMs) => {
        const result = advanceLap(driver, dtMs);
        expect(result.lapDistPct).toBeGreaterThanOrEqual(0);
        expect(result.lapDistPct).toBeLessThan(1);
      }),
      { numRuns: 100 },
    );
  });

  it("si NO completó una vuelta, lapDistPct SHALL ser estrictamente mayor que el previo", () => {
    fc.assert(
      fc.property(driverStateArb, positiveDtMsArb, (driver, dtMs) => {
        const result = advanceLap(driver, dtMs);
        const completedLap = result.currentLapTime === 0 && dtMs > 0;

        if (!completedLap) {
          expect(result.lapDistPct).toBeGreaterThan(driver.lapDistPct);
        }
      }),
      { numRuns: 100 },
    );
  });

  it("si completó una vuelta, lastLapTime SHALL ser un número >= 0 y currentLapTime SHALL resetearse a 0", () => {
    fc.assert(
      fc.property(driverStateArb, dtMsArb, (driver, dtMs) => {
        const result = advanceLap(driver, dtMs);
        const completedLap = result.currentLapTime === 0 && dtMs > 0;

        if (completedLap) {
          expect(result.lastLapTime).not.toBeNull();
          expect(typeof result.lastLapTime).toBe("number");
          expect(result.lastLapTime as number).toBeGreaterThanOrEqual(0);
          expect(result.currentLapTime).toBe(0);
        }
      }),
      { numRuns: 100 },
    );
  });

  it("no SHALL mutar el objeto `driver` de entrada", () => {
    fc.assert(
      fc.property(driverStateArb, dtMsArb, (driver, dtMs) => {
        const driverCopy = { ...driver };
        advanceLap(driver, dtMs);
        expect(driver).toEqual(driverCopy);
      }),
      { numRuns: 100 },
    );
  });
});
