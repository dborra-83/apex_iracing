import { describe, it, expect } from "vitest";
import fc from "fast-check";
import { estimateStintForAllDrivers } from "./fuel-multi";
import { estimateRemainingLaps, deriveFuelConsumptionRate } from "./fuel";

/**
 * Feature: apex-mobile-and-dashboard-expansion, Property 6: estimateStintForAllDrivers
 * generaliza estimateRemainingLaps sin alterar su contrato.
 *
 * Para cualquier conjunto de pilotos con historiales de combustible y
 * niveles actuales válidos (`>= 0`), `estimateStintForAllDrivers` SHALL
 * devolver, para cada piloto, un `estimatedRemainingLaps` idéntico al que
 * produciría invocar
 * `estimateRemainingLaps(fuelLevel, deriveFuelConsumptionRate(history))`
 * de forma aislada para ese piloto (ninguna interacción entre pilotos
 * afecta el cálculo individual).
 *
 * Validates: Requirements 5.1, 5.2
 */

/**
 * Feature: apex-mobile-and-dashboard-expansion, Property 7: estimatedPitInLapsFromNow
 * es consistente con estimatedRemainingLaps.
 *
 * Para cualquier `DriverStintEstimate` producido, `estimatedPitInLapsFromNow`
 * SHALL ser `null` si y solo si `estimatedRemainingLaps === Infinity`; y
 * cuando no es `null`, SHALL ser exactamente
 * `Math.floor(estimatedRemainingLaps)`, nunca negativo.
 *
 * Validates: Requirements 5.3, 5.4
 */

// Arbitrary de un historial de combustible: array de números >= 0, en el
// orden en que fueron muestreados (uno por vuelta completada).
const fuelHistoryArb = fc.array(fc.float({ min: 0, max: 200, noNaN: true }), {
  minLength: 0,
  maxLength: 10,
});

// Arbitrary de un nivel de combustible actual válido (>= 0).
const fuelLevelArb = fc.float({ min: 0, max: 200, noNaN: true });

/**
 * Genera un conjunto de N pilotos (N entre 0 y 15) con driverIds únicos
 * (`driver-0`, `driver-1`, ...), cada uno con su propio historial de
 * combustible y nivel actual, y construye los dos Map de entrada con
 * dominio idéntico (precondición del diseño).
 */
const driversFuelDataArb = fc
  .integer({ min: 0, max: 15 })
  .chain((n) =>
    fc.tuple(
      fc.array(fuelHistoryArb, { minLength: n, maxLength: n }),
      fc.array(fuelLevelArb, { minLength: n, maxLength: n }),
    ),
  )
  .map(([histories, levels]) => {
    const driverIds = histories.map((_, i) => `driver-${i}`);
    const driversFuelHistory = new Map<string, number[]>(
      driverIds.map((id, i) => [id, histories[i]!]),
    );
    const currentFuelLevels = new Map<string, number>(
      driverIds.map((id, i) => [id, levels[i]!]),
    );
    return { driverIds, driversFuelHistory, currentFuelLevels };
  });

describe("Feature: apex-mobile-and-dashboard-expansion, Property 6: estimateStintForAllDrivers generaliza estimateRemainingLaps sin alterar su contrato", () => {
  it("produce, para cada piloto, un estimatedRemainingLaps idéntico al cálculo aislado con estimateRemainingLaps(fuelLevel, deriveFuelConsumptionRate(history))", () => {
    fc.assert(
      fc.property(driversFuelDataArb, ({ driverIds, driversFuelHistory, currentFuelLevels }) => {
        const result = estimateStintForAllDrivers(driversFuelHistory, currentFuelLevels);
        const byDriverId = new Map(result.map((r) => [r.driverId, r]));

        for (const driverId of driverIds) {
          const history = driversFuelHistory.get(driverId)!;
          const fuelLevel = currentFuelLevels.get(driverId)!;
          const expected = estimateRemainingLaps(fuelLevel, deriveFuelConsumptionRate(history));

          expect(byDriverId.get(driverId)!.estimatedRemainingLaps).toBe(expected);
        }
      }),
      { numRuns: 100 },
    );
  });

  it("el resultado tiene exactamente una entrada por driverId del dominio de currentFuelLevels", () => {
    fc.assert(
      fc.property(driversFuelDataArb, ({ driverIds, driversFuelHistory, currentFuelLevels }) => {
        const result = estimateStintForAllDrivers(driversFuelHistory, currentFuelLevels);

        expect(result.length).toBe(driverIds.length);
        const outputIds = new Set(result.map((r) => r.driverId));
        expect(outputIds).toEqual(new Set(driverIds));
      }),
      { numRuns: 100 },
    );
  });

  it("no muta driversFuelHistory ni currentFuelLevels", () => {
    fc.assert(
      fc.property(driversFuelDataArb, ({ driversFuelHistory, currentFuelLevels }) => {
        const historySnapshot = new Map(
          [...driversFuelHistory].map(([id, arr]) => [id, [...arr]]),
        );
        const levelsSnapshot = new Map(currentFuelLevels);

        estimateStintForAllDrivers(driversFuelHistory, currentFuelLevels);

        expect(driversFuelHistory).toEqual(historySnapshot);
        expect(currentFuelLevels).toEqual(levelsSnapshot);
      }),
      { numRuns: 100 },
    );
  });
});

describe("Feature: apex-mobile-and-dashboard-expansion, Property 7: estimatedPitInLapsFromNow es consistente con estimatedRemainingLaps", () => {
  it("estimatedPitInLapsFromNow es null si y solo si estimatedRemainingLaps === Infinity, y en otro caso es exactamente Math.floor(estimatedRemainingLaps) y nunca negativo", () => {
    fc.assert(
      fc.property(driversFuelDataArb, ({ driversFuelHistory, currentFuelLevels }) => {
        const result = estimateStintForAllDrivers(driversFuelHistory, currentFuelLevels);

        for (const estimate of result) {
          if (estimate.estimatedRemainingLaps === Infinity) {
            expect(estimate.estimatedPitInLapsFromNow).toBeNull();
          } else {
            expect(estimate.estimatedPitInLapsFromNow).not.toBeNull();
            expect(estimate.estimatedPitInLapsFromNow).toBe(
              Math.floor(estimate.estimatedRemainingLaps),
            );
            expect(estimate.estimatedPitInLapsFromNow!).toBeGreaterThanOrEqual(0);
          }
        }
      }),
      { numRuns: 100 },
    );
  });
});
