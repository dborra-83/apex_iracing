import { describe, it, expect } from "vitest";
import fc from "fast-check";
import { getSectorForLapPct } from "@apex/telemetry-core";
import { recordSectorCompletion } from "./sectors";
import type { DriverState, SectorDef } from "./state";
import { createFreshTireState } from "./tires";
import type { TireWearRateFactors } from "./tires";

/**
 * Fixtures fijos de neumáticos, irrelevantes para `recordSectorCompletion`
 * (que nunca lee `tires`/`tireWearRateFactors`), usados solo para
 * completar la forma de `DriverState`.
 */
const TIRE_STATE_FIXTURE = createFreshTireState(20);
const TIRE_WEAR_RATE_FACTORS_FIXTURE: TireWearRateFactors = { fl: 1, fr: 1, rl: 1, rr: 1 };

/**
 * Property-based tests para `recordSectorCompletion`.
 *
 * Ver design.md, "Property 2: Longitud fija y consistente de
 * sector_times" y "Property 3: best_sector_times es siempre el mínimo
 * histórico por sector".
 */

/** `SectorDef[]` de N sectores iguales que particionan [0, 1) en N tercios. */
function makeSectors(count: number): SectorDef[] {
  const sectors: SectorDef[] = [];
  for (let i = 0; i < count; i++) {
    sectors.push({ index: i, start_pct: i / count, end_pct: (i + 1) / count });
  }
  return sectors;
}

/**
 * Arbitrary de un `DriverState` con `lastSectorTimes`/`bestSectorTimes` de
 * longitud igual a `sectorCount`, consistente con el invariante que
 * `createDriverState` establece al inicio de la sesión (Requisito 2.5).
 */
function driverStateArb(sectorCount: number): fc.Arbitrary<DriverState> {
  const sectorTimeArb = fc.option(fc.float({ min: 0, max: 200, noNaN: true }), { nil: null });

  return fc
    .record({
      driverId: fc.constant("driver-0"),
      classId: fc.constant("class-0"),
      lapDistPct: fc.float({ min: 0, max: Math.fround(0.999999), noNaN: true }),
      fuelLevel: fc.float({ min: 0, max: 100, noNaN: true }),
      position: fc.integer({ min: 1, max: 30 }),
      inPits: fc.boolean(),
      currentLapTime: fc.float({ min: 0, max: 200, noNaN: true }),
      lastLapTime: fc.option(fc.float({ min: 0, max: 200, noNaN: true }), { nil: null }),
      bestLapTime: fc.option(fc.float({ min: 0, max: 200, noNaN: true }), { nil: null }),
      delta_to_best: fc.constant(null),
      delta_to_prev: fc.constant(null),
      currentSectorIndex: fc.integer({ min: 0, max: sectorCount - 1 }),
      // Fracción de `currentLapTime` en [0, 1], aplicada más abajo para
      // que `currentSectorStartLapTime <= currentLapTime` siempre se
      // cumpla (invariante real del pipeline: el sector actual empezó en
      // algún instante <= el reloj de vuelta actual), garantizando así
      // `sectorTime >= 0` como exige `SectorTimesV1_1Schema`.
      sectorStartFraction: fc.float({ min: 0, max: 1, noNaN: true }),
      lastSectorTimes: fc.array(sectorTimeArb, { minLength: sectorCount, maxLength: sectorCount }),
      bestSectorTimes: fc.array(sectorTimeArb, { minLength: sectorCount, maxLength: sectorCount }),
      baseSpeedFactor: fc.float({ min: Math.fround(0.5), max: 2, noNaN: true }),
      fuelConsumptionPerLap: fc.float({ min: Math.fround(0.1), max: 10, noNaN: true }),
      tires: fc.constant(TIRE_STATE_FIXTURE),
      tireWearRateFactors: fc.constant(TIRE_WEAR_RATE_FACTORS_FIXTURE),
    })
    .map(({ sectorStartFraction, ...rest }) => ({
      ...rest,
      currentSectorStartLapTime: rest.currentLapTime * sectorStartFraction,
    }));
}

/**
 * Arbitrary combinado: `sectorCount` en [1, 8], sus `sectors`, un
 * `DriverState` consistente con esa longitud, y un `previousLapDistPct`
 * arbitrario en [0, 1).
 */
const sectorScenarioArb = fc.integer({ min: 1, max: 8 }).chain((sectorCount) =>
  fc.record({
    sectors: fc.constant(makeSectors(sectorCount)),
    driver: driverStateArb(sectorCount),
    previousLapDistPct: fc.float({ min: 0, max: Math.fround(0.999999), noNaN: true }),
  }),
);

describe("Feature: apex-mobile-and-dashboard-expansion, Property 2: Longitud fija y consistente de sector_times", () => {
  /**
   * Validates: Requirements 1.7, 2.5
   */
  it("lastSectorTimes.length y bestSectorTimes.length permanecen iguales a sectors.length tras recordSectorCompletion", () => {
    fc.assert(
      fc.property(sectorScenarioArb, ({ sectors, driver, previousLapDistPct }) => {
        const result = recordSectorCompletion(driver, sectors, previousLapDistPct);
        expect(result.lastSectorTimes.length).toBe(sectors.length);
        expect(result.bestSectorTimes.length).toBe(sectors.length);
      }),
      { numRuns: 100 },
    );
  });

  it("no muta el objeto driver de entrada ni sus arrays de tiempos de sector", () => {
    fc.assert(
      fc.property(sectorScenarioArb, ({ sectors, driver, previousLapDistPct }) => {
        const lastSectorTimesCopy = [...driver.lastSectorTimes];
        const bestSectorTimesCopy = [...driver.bestSectorTimes];

        recordSectorCompletion(driver, sectors, previousLapDistPct);

        expect(driver.lastSectorTimes).toEqual(lastSectorTimesCopy);
        expect(driver.bestSectorTimes).toEqual(bestSectorTimesCopy);
      }),
      { numRuns: 100 },
    );
  });
});

describe("Feature: apex-mobile-and-dashboard-expansion, Property 3: best_sector_times es siempre el mínimo histórico por sector", () => {
  /**
   * Validates: Requirements 2.3, 2.4
   */
  it("cuando hay transición de sector, bestSectorTimes[previousSector] resultante es <= al lastSectorTimes[previousSector] recién registrado", () => {
    fc.assert(
      fc.property(sectorScenarioArb, ({ sectors, driver, previousLapDistPct }) => {
        const result = recordSectorCompletion(driver, sectors, previousLapDistPct);

        const previousSectorIndex = getSectorForLapPct(sectors, previousLapDistPct);
        const newSectorIndex = getSectorForLapPct(sectors, driver.lapDistPct);
        const transitioned = newSectorIndex !== previousSectorIndex;
        if (!transitioned) {
          return;
        }

        const registeredTime = result.lastSectorTimes[previousSectorIndex];
        const bestTime = result.bestSectorTimes[previousSectorIndex];

        expect(registeredTime).not.toBeNull();
        expect(bestTime).not.toBeNull();
        expect(bestTime as number).toBeLessThanOrEqual(registeredTime as number);
      }),
      { numRuns: 100 },
    );
  });

  it("bestSectorTimes nunca aumenta respecto al valor previo para ningún sector", () => {
    fc.assert(
      fc.property(sectorScenarioArb, ({ sectors, driver, previousLapDistPct }) => {
        const result = recordSectorCompletion(driver, sectors, previousLapDistPct);

        for (let i = 0; i < sectors.length; i++) {
          const previousBest = driver.bestSectorTimes[i];
          const newBest = result.bestSectorTimes[i];

          if (previousBest !== null && previousBest !== undefined) {
            expect(newBest).not.toBeNull();
            expect(newBest as number).toBeLessThanOrEqual(previousBest);
          }
        }
      }),
      { numRuns: 100 },
    );
  });

  it("si no hay transición de sector (mismo sector antes y después), lastSectorTimes y bestSectorTimes permanecen sin cambios", () => {
    fc.assert(
      fc.property(sectorScenarioArb, ({ sectors, driver, previousLapDistPct }) => {
        const previousSectorIndex = getSectorForLapPct(sectors, previousLapDistPct);
        const newSectorIndex = getSectorForLapPct(sectors, driver.lapDistPct);
        const transitioned = newSectorIndex !== previousSectorIndex;

        const result = recordSectorCompletion(driver, sectors, previousLapDistPct);

        if (!transitioned) {
          expect(result.lastSectorTimes).toEqual(driver.lastSectorTimes);
          expect(result.bestSectorTimes).toEqual(driver.bestSectorTimes);
        }
      }),
      { numRuns: 100 },
    );
  });
});
