import { describe, it, expect } from "vitest";
import fc from "fast-check";
import { recomputePositions } from "./positions";
import type { DriverState } from "./state";
import { createFreshTireState } from "./tires";
import type { TireWearRateFactors } from "./tires";

/**
 * Fixtures fijos de neumáticos, irrelevantes para `recomputePositions`
 * (que nunca lee `tires`/`tireWearRateFactors`), usados solo para
 * completar la forma de `DriverState`.
 */
const TIRE_STATE_FIXTURE = createFreshTireState(20);
const TIRE_WEAR_RATE_FACTORS_FIXTURE: TireWearRateFactors = { fl: 1, fr: 1, rl: 1, rr: 1 };

/**
 * Genera un DriverState arbitrario para el índice dado, con un `driverId`
 * único derivado del índice (garantiza unicidad dentro del array) y un
 * `lapDistPct` arbitrario en [0, 1) (los valores pueden repetirse entre
 * pilotos de forma intencional, para testear el manejo de empates).
 */
function arbitraryDriverAt(index: number): fc.Arbitrary<DriverState> {
  return fc.record({
    driverId: fc.constant(`driver-${index}`),
    classId: fc.constant("class-0"),
    lapDistPct: fc.float({ min: 0, max: Math.fround(0.999999), noNaN: true }),
    fuelLevel: fc.constant(100),
    position: fc.constant(index + 1),
    inPits: fc.constant(false),
    currentLapTime: fc.constant(0),
    lastLapTime: fc.constant(null),
    bestLapTime: fc.constant(null),
    delta_to_best: fc.constant(null),
    delta_to_prev: fc.constant(null),
    currentSectorIndex: fc.constant(0),
    currentSectorStartLapTime: fc.constant(0),
    lastSectorTimes: fc.constant([null, null, null]),
    bestSectorTimes: fc.constant([null, null, null]),
    baseSpeedFactor: fc.constant(1),
    fuelConsumptionPerLap: fc.constant(3),
    tires: fc.constant(TIRE_STATE_FIXTURE),
    tireWearRateFactors: fc.constant(TIRE_WEAR_RATE_FACTORS_FIXTURE),
  });
}

/** Genera un array de N DriverState (N entre 1 y 30), driverId único por índice. */
const arbitraryDriverArray: fc.Arbitrary<DriverState[]> = fc
  .integer({ min: 1, max: 30 })
  .chain((n) => fc.tuple(...Array.from({ length: n }, (_, i) => arbitraryDriverAt(i))));

describe("Feature: iracing-telemetry-platform, Property 8: Unicidad y rango de posiciones en Evento_Standings", () => {
  it("el conjunto de posiciones resultante es exactamente {1, ..., N} sin duplicados ni huecos", () => {
    fc.assert(
      fc.property(arbitraryDriverArray, (drivers) => {
        const result = recomputePositions(drivers);
        const n = drivers.length;

        const positions = result.map((d) => d.position);
        const uniquePositions = new Set(positions);
        expect(uniquePositions.size).toBe(n);

        const sorted = [...positions].sort((a, b) => a - b);
        const expected = Array.from({ length: n }, (_, i) => i + 1);
        expect(sorted).toEqual(expected);
      }),
      { numRuns: 100 },
    );
  });

  it("devuelve el mismo número de pilotos, en el mismo orden de entrada (mismo driverId por índice)", () => {
    fc.assert(
      fc.property(arbitraryDriverArray, (drivers) => {
        const result = recomputePositions(drivers);

        expect(result.length).toBe(drivers.length);
        for (let i = 0; i < drivers.length; i++) {
          expect(result[i]?.driverId).toBe(drivers[i]?.driverId);
        }
      }),
      { numRuns: 100 },
    );
  });

  it("no muta el array de entrada ni los objetos DriverState originales", () => {
    fc.assert(
      fc.property(arbitraryDriverArray, (drivers) => {
        const originalPositions = drivers.map((d) => d.position);
        const originalArrayRef = drivers;

        recomputePositions(drivers);

        // El array de entrada sigue siendo el mismo objeto y con el mismo contenido.
        expect(drivers).toBe(originalArrayRef);
        drivers.forEach((driver, i) => {
          expect(driver.position).toBe(originalPositions[i]);
        });
      }),
      { numRuns: 100 },
    );
  });
});
