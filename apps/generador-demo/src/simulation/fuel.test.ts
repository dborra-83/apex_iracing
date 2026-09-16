import { describe, it, expect } from "vitest";
import fc from "fast-check";
import { applyFuelConsumption } from "./fuel";
import type { DriverState } from "./state";
import { createFreshTireState } from "./tires";
import type { TireWearRateFactors } from "./tires";

/**
 * Fixtures fijos de neumáticos, irrelevantes para `applyFuelConsumption`
 * (que nunca lee `tires`/`tireWearRateFactors`), usados solo para
 * completar la forma de `DriverState`.
 */
const TIRE_STATE_FIXTURE = createFreshTireState(20);
const TIRE_WEAR_RATE_FACTORS_FIXTURE: TireWearRateFactors = { fl: 1, fr: 1, rl: 1, rr: 1 };

/**
 * Generador de un `DriverState` arbitrario válido para las propiedades de
 * combustible. Solo los campos relevantes para `applyFuelConsumption`
 * (`fuelLevel`, `fuelConsumptionPerLap`, `inPits`) necesitan variar de
 * forma significativa; el resto se rellena con valores válidos fijos o
 * simples para mantener el generador enfocado.
 */
function driverStateArbitrary(): fc.Arbitrary<DriverState> {
  return fc.record({
    driverId: fc.constant("driver-0"),
    classId: fc.constant("class-0"),
    lapDistPct: fc.float({ min: 0, max: Math.fround(0.999), noNaN: true }),
    fuelLevel: fc.float({ min: 0, max: 100, noNaN: true }),
    position: fc.integer({ min: 1, max: 30 }),
    inPits: fc.boolean(),
    currentLapTime: fc.float({ min: 0, max: 200, noNaN: true }),
    lastLapTime: fc.constant(null),
    bestLapTime: fc.constant(null),
    delta_to_best: fc.constant(null),
    delta_to_prev: fc.constant(null),
    currentSectorIndex: fc.constant(0),
    currentSectorStartLapTime: fc.constant(0),
    lastSectorTimes: fc.constant([null, null, null]),
    bestSectorTimes: fc.constant([null, null, null]),
    baseSpeedFactor: fc.float({ min: Math.fround(0.9), max: Math.fround(1.1), noNaN: true }),
    fuelConsumptionPerLap: fc.float({ min: Math.fround(0.1), max: 10, noNaN: true }),
    tires: fc.constant(TIRE_STATE_FIXTURE),
    tireWearRateFactors: fc.constant(TIRE_WEAR_RATE_FACTORS_FIXTURE),
  });
}

/** Generador de `dtMs` arbitrario, no negativo, hasta 10 minutos. */
function dtMsArbitrary(): fc.Arbitrary<number> {
  return fc.float({ min: 0, max: 600000, noNaN: true });
}

describe("Feature: iracing-telemetry-platform, Property 7: Combustible no negativo y monótonamente no creciente sin pit stop", () => {
  /**
   * Validates: Requirements 6.5
   */
  it("fuelLevel resultante nunca es negativo, independientemente de inPits", () => {
    fc.assert(
      fc.property(driverStateArbitrary(), dtMsArbitrary(), (driver, dtMs) => {
        const result = applyFuelConsumption(driver, dtMs);
        expect(result.fuelLevel).toBeGreaterThanOrEqual(0);
      }),
      { numRuns: 100 },
    );
  });

  /**
   * Validates: Requirements 6.5
   */
  it("fuera de pits, fuelLevel es monótonamente no creciente", () => {
    fc.assert(
      fc.property(
        driverStateArbitrary().filter((d) => !d.inPits),
        dtMsArbitrary(),
        (driver, dtMs) => {
          const result = applyFuelConsumption(driver, dtMs);
          expect(result.fuelLevel).toBeLessThanOrEqual(driver.fuelLevel);
        },
      ),
      { numRuns: 100 },
    );
  });

  /**
   * Validates: Requirements 6.5
   */
  it("en pits, fuelLevel permanece exactamente igual (no se consume combustible)", () => {
    fc.assert(
      fc.property(
        driverStateArbitrary().filter((d) => d.inPits),
        dtMsArbitrary(),
        (driver, dtMs) => {
          const result = applyFuelConsumption(driver, dtMs);
          expect(result.fuelLevel).toBe(driver.fuelLevel);
        },
      ),
      { numRuns: 100 },
    );
  });

  /**
   * Validates: Requirements 6.5
   */
  it("no muta el objeto driver de entrada", () => {
    fc.assert(
      fc.property(driverStateArbitrary(), dtMsArbitrary(), (driver, dtMs) => {
        const driverCopy = { ...driver };
        applyFuelConsumption(driver, dtMs);
        expect(driver).toEqual(driverCopy);
      }),
      { numRuns: 100 },
    );
  });
});
