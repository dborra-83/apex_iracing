import { describe, it, expect } from "vitest";
import fc from "fast-check";
import { computeGaps } from "./gaps";
import type { StandingsEntryV1_1 } from "@apex/contrato-datos";

/**
 * Feature: apex-mobile-and-dashboard-expansion, Property 4: computeGaps
 * produce una biyección simétrica y no negativa.
 *
 * Para cualquier array de StandingsEntryV1_1 con `position` únicas dentro
 * de {1..N}, computeGaps SHALL producir exactamente N resultados (uno por
 * driverId de entrada), el líder (position mínima) SHALL tener
 * gapAhead === null, el último (position máxima) SHALL tener
 * gapBehind === null, todo gapAhead/gapBehind no-null SHALL ser >= 0, y
 * para cualquier par de pilotos adyacentes por position, el gapBehind del
 * piloto delante SHALL ser exactamente igual al gapAhead del piloto detrás
 * (simetría exacta, nunca pueden divergir).
 *
 * Validates: Requirements 3.1, 3.2, 3.3, 3.4, 3.5
 */

// Arbitrary de un StandingsEntryV1_1 mínimo (solo los campos que computeGaps
// usa: driver_id, position, gap; el resto se completa con valores fijos
// válidos ya que no son relevantes para esta propiedad).
function arbitraryDriverAt(index: number, gap: number): fc.Arbitrary<StandingsEntryV1_1> {
  return fc.record({
    driver_id: fc.constant(`driver-${index}`),
    position: fc.constant(index + 1),
    class_id: fc.constant("class-0"),
    gap: fc.constant(gap),
    last_lap_time: fc.constant(null),
    best_lap_time: fc.constant(null),
    in_pits: fc.constant(false),
    off_track: fc.constant(false),
    lap_dist_pct: fc.constant(0),
    fuel_level: fc.constant(100),
    last_sector_times: fc.constant([]),
    best_sector_times: fc.constant([]),
  });
}

/**
 * Genera un array de N pilotos (N entre 1 y 30) con `position` únicas y
 * consecutivas {1..N} (asignadas por índice tras un shuffle implícito vía
 * fc.shuffledSubarray no es necesario: se generan gaps crecientes por
 * índice de position, ya que `gap` SHALL ser monótono no decreciente con
 * `position` en cualquier Evento_Standings válido).
 */
const arbitraryDriverArray: fc.Arbitrary<StandingsEntryV1_1[]> = fc
  .integer({ min: 1, max: 30 })
  .chain((n) => {
    // Incrementos no negativos de gap entre pilotos consecutivos por
    // position, para garantizar la precondición gap monótono no decreciente.
    const incrementsArb = fc.array(fc.float({ min: 0, max: 50, noNaN: true }), {
      minLength: n - 1,
      maxLength: n - 1,
    });
    return incrementsArb.chain((increments) => {
      const gaps: number[] = [0];
      for (const inc of increments) {
        gaps.push(gaps[gaps.length - 1]! + inc);
      }
      return fc.tuple(...gaps.map((gap, i) => arbitraryDriverAt(i, gap)));
    });
  });

describe("Feature: apex-mobile-and-dashboard-expansion, Property 4: computeGaps produce una biyección simétrica y no negativa", () => {
  it("produce exactamente N resultados, uno por driverId de entrada", () => {
    fc.assert(
      fc.property(arbitraryDriverArray, (drivers) => {
        const result = computeGaps(drivers);
        expect(result.length).toBe(drivers.length);

        const inputIds = new Set(drivers.map((d) => d.driver_id));
        const outputIds = new Set(result.map((r) => r.driverId));
        expect(outputIds).toEqual(inputIds);
      }),
      { numRuns: 100 },
    );
  });

  it("el líder (position mínima) tiene gapAhead null y el último (position máxima) tiene gapBehind null", () => {
    fc.assert(
      fc.property(arbitraryDriverArray, (drivers) => {
        const result = computeGaps(drivers);
        const byDriverId = new Map(result.map((r) => [r.driverId, r]));

        const leader = drivers.reduce((min, d) => (d.position < min.position ? d : min));
        const last = drivers.reduce((max, d) => (d.position > max.position ? d : max));

        expect(byDriverId.get(leader.driver_id)!.gapAhead).toBeNull();
        expect(byDriverId.get(last.driver_id)!.gapBehind).toBeNull();
      }),
      { numRuns: 100 },
    );
  });

  it("todo gapAhead/gapBehind no-null es >= 0", () => {
    fc.assert(
      fc.property(arbitraryDriverArray, (drivers) => {
        const result = computeGaps(drivers);

        for (const r of result) {
          if (r.gapAhead !== null) {
            expect(r.gapAhead).toBeGreaterThanOrEqual(0);
          }
          if (r.gapBehind !== null) {
            expect(r.gapBehind).toBeGreaterThanOrEqual(0);
          }
        }
      }),
      { numRuns: 100 },
    );
  });

  it("para cualquier par de pilotos adyacentes por position, gapBehind del de delante === gapAhead del de detrás", () => {
    fc.assert(
      fc.property(arbitraryDriverArray, (drivers) => {
        const result = computeGaps(drivers);
        const sortedDrivers = [...drivers].sort((a, b) => a.position - b.position);
        const byDriverId = new Map(result.map((r) => [r.driverId, r]));

        for (let i = 0; i < sortedDrivers.length - 1; i++) {
          const ahead = byDriverId.get(sortedDrivers[i]!.driver_id)!;
          const behind = byDriverId.get(sortedDrivers[i + 1]!.driver_id)!;
          expect(ahead.gapBehind).toBe(behind.gapAhead);
        }
      }),
      { numRuns: 100 },
    );
  });
});
