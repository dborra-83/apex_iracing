import { describe, it, expect, vi } from "vitest";
import fc from "fast-check";
import { circularDistance, nearestRivals } from "./track";

/**
 * Property-based tests para `circularDistance` y `nearestRivals`.
 *
 * Ver design.md, "Function 4: nearestRivals (para MiniMap de Apex
 * Mobile)" y "Algoritmo: nearestRivals (distancia circular)".
 */

/** Piloto mínimo que satisface la restricción genérica de `nearestRivals`. */
interface RivalCandidate {
  driver_id: string;
  lap_dist_pct: number;
}

const lapDistPctArb = fc.float({ min: 0, max: Math.fround(0.999999), noNaN: true });

describe("Feature: apex-mobile-and-dashboard-expansion, Property 9: La distancia circular es simétrica y máxima en 0.5", () => {
  /**
   * Validates: Requirements 10.3
   */
  it("circularDistance(a, b) === circularDistance(b, a) para cualquier a, b en [0, 1)", () => {
    fc.assert(
      fc.property(lapDistPctArb, lapDistPctArb, (a, b) => {
        expect(circularDistance(a, b)).toBeCloseTo(circularDistance(b, a), 10);
      }),
      { numRuns: 100 },
    );
  });

  it("circularDistance(a, b) está siempre en [0, 0.5] para cualquier a, b en [0, 1)", () => {
    fc.assert(
      fc.property(lapDistPctArb, lapDistPctArb, (a, b) => {
        const distance = circularDistance(a, b);
        expect(distance).toBeGreaterThanOrEqual(0);
        expect(distance).toBeLessThanOrEqual(0.5);
      }),
      { numRuns: 100 },
    );
  });

  it("circularDistance(a, b) === 0 si y solo si a === b", () => {
    fc.assert(
      fc.property(lapDistPctArb, lapDistPctArb, (a, b) => {
        const distance = circularDistance(a, b);
        if (a === b) {
          expect(distance).toBe(0);
        } else {
          expect(distance).not.toBe(0);
        }
      }),
      { numRuns: 100 },
    );
  });
});

/**
 * Arbitrary de un array de `RivalCandidate` con `driver_id` únicos
 * (`driver-0`, `driver-1`, ...) y `lap_dist_pct` arbitrario en [0, 1),
 * más un `observedIndex` que señala cuál de ellos es el piloto observado
 * y un `maxCount` arbitrario (incluyendo 0 y valores mayores que la
 * longitud del array).
 */
const driversScenarioArb = fc
  .integer({ min: 1, max: 20 })
  .chain((driverCount) =>
    fc.record({
      lapDistPcts: fc.array(lapDistPctArb, {
        minLength: driverCount,
        maxLength: driverCount,
      }),
      observedIndex: fc.integer({ min: 0, max: driverCount - 1 }),
      maxCount: fc.integer({ min: 0, max: driverCount + 5 }),
    }),
  )
  .map(({ lapDistPcts, observedIndex, maxCount }) => {
    const drivers: RivalCandidate[] = lapDistPcts.map((lap_dist_pct, i) => ({
      driver_id: `driver-${i}`,
      lap_dist_pct,
    }));
    return {
      drivers,
      observedDriverId: drivers[observedIndex]!.driver_id,
      maxCount,
    };
  });

describe("Feature: apex-mobile-and-dashboard-expansion, Property 8: nearestRivals nunca incluye al piloto observado y respeta el top-k por distancia circular", () => {
  /**
   * Validates: Requirements 10.1, 10.2, 10.4
   */
  it("el resultado nunca incluye al piloto observado", () => {
    fc.assert(
      fc.property(driversScenarioArb, ({ drivers, observedDriverId, maxCount }) => {
        const result = nearestRivals(observedDriverId, drivers, maxCount);
        expect(result.some((rival) => rival.driver_id === observedDriverId)).toBe(false);
      }),
      { numRuns: 100 },
    );
  });

  it("el resultado tiene como máximo min(maxCount, drivers.length - 1) elementos cuando el observado está presente", () => {
    fc.assert(
      fc.property(driversScenarioArb, ({ drivers, observedDriverId, maxCount }) => {
        const result = nearestRivals(observedDriverId, drivers, maxCount);
        expect(result.length).toBeLessThanOrEqual(
          Math.min(maxCount, drivers.length - 1),
        );
      }),
      { numRuns: 100 },
    );
  });

  it("ningún candidato excluido tiene una distancia circular estrictamente menor que cualquier candidato incluido (top-k correcto)", () => {
    fc.assert(
      fc.property(driversScenarioArb, ({ drivers, observedDriverId, maxCount }) => {
        const observed = drivers.find((d) => d.driver_id === observedDriverId)!;
        const result = nearestRivals(observedDriverId, drivers, maxCount);

        const includedIds = new Set(result.map((r) => r.driver_id));
        const excluded = drivers.filter(
          (d) => d.driver_id !== observedDriverId && !includedIds.has(d.driver_id),
        );

        const maxIncludedDistance = result.length > 0
          ? Math.max(
              ...result.map((r) => circularDistance(r.lap_dist_pct, observed.lap_dist_pct)),
            )
          : -Infinity;

        for (const candidate of excluded) {
          const distance = circularDistance(candidate.lap_dist_pct, observed.lap_dist_pct);
          expect(distance).toBeGreaterThanOrEqual(maxIncludedDistance);
        }
      }),
      { numRuns: 100 },
    );
  });

  it("no muta el array drivers de entrada", () => {
    fc.assert(
      fc.property(driversScenarioArb, ({ drivers, observedDriverId, maxCount }) => {
        const driversCopy = drivers.map((d) => ({ ...d }));
        nearestRivals(observedDriverId, drivers, maxCount);
        expect(drivers).toEqual(driversCopy);
      }),
      { numRuns: 100 },
    );
  });

  it("cuando observedDriverId no existe en drivers, devuelve los primeros maxCount elementos sin lanzar excepción (fallback documentado)", () => {
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

    const drivers: RivalCandidate[] = [
      { driver_id: "driver-0", lap_dist_pct: 0.1 },
      { driver_id: "driver-1", lap_dist_pct: 0.2 },
      { driver_id: "driver-2", lap_dist_pct: 0.3 },
    ];

    const result = nearestRivals("driver-nonexistent", drivers, 2);

    expect(result).toEqual(drivers.slice(0, 2));
    expect(warnSpy).toHaveBeenCalled();

    warnSpy.mockRestore();
  });
});
