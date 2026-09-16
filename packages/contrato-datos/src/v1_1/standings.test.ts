import { describe, it, expect } from "vitest";
import fc from "fast-check";
import { StandingsEntryV1Schema } from "../v1/standings";
import { StandingsEntryV1_1Schema } from "./standings";

/**
 * Feature: apex-mobile-and-dashboard-expansion, Property 1: El
 * Evento_Standings v1.1.0 es una extensión conforme del v1.0.0.
 *
 * Para cualquier StandingsEntryV1_1 válido, dicho valor SHALL validar sin
 * errores contra StandingsEntryV1_1Schema, y el subconjunto de sus campos
 * heredados de v1.0.0 (driver_id, position, class_id, gap, last_lap_time,
 * best_lap_time, in_pits, off_track) SHALL validar también, de forma
 * independiente, contra StandingsEntryV1Schema (el esquema original), sin
 * necesitar transformación alguna.
 *
 * Validates: Requirements 1.1, 1.2
 */

// Arbitrary de un array de tiempos de sector (número no negativo o null),
// de longitud arbitraria pero fija dentro de cada instancia generada.
const sectorTimesArb = fc.array(
  fc.option(fc.float({ min: 0, max: 600, noNaN: true }), { nil: null }),
  { minLength: 0, maxLength: 8 },
);

// Arbitrary de un StandingsEntryV1_1 válido: hereda los mismos campos que
// StandingsEntryV1 y añade los 4 campos nuevos de la Version_Contrato_1_1.
const standingsEntryV1_1Arb = fc.record({
  driver_id: fc.string({ minLength: 1, maxLength: 20 }),
  position: fc.integer({ min: 1, max: 50 }),
  class_id: fc.string({ minLength: 1, maxLength: 10 }),
  gap: fc.float({ min: 0, max: 200, noNaN: true }),
  last_lap_time: fc.option(fc.float({ min: 0, max: 600, noNaN: true }), { nil: null }),
  best_lap_time: fc.option(fc.float({ min: 0, max: 600, noNaN: true }), { nil: null }),
  in_pits: fc.boolean(),
  off_track: fc.boolean(),
  lap_dist_pct: fc.float({ min: 0, max: 1, noNaN: true }),
  fuel_level: fc.float({ min: 0, max: 120, noNaN: true }),
  last_sector_times: sectorTimesArb,
  best_sector_times: sectorTimesArb,
});

describe("Feature: apex-mobile-and-dashboard-expansion, Property 1: El Evento_Standings v1.1.0 es una extensión conforme del v1.0.0", () => {
  it("un StandingsEntryV1_1 válido valida contra StandingsEntryV1_1Schema", () => {
    fc.assert(
      fc.property(standingsEntryV1_1Arb, (entry) => {
        const result = StandingsEntryV1_1Schema.safeParse(entry);
        expect(result.success).toBe(true);
      }),
      { numRuns: 100 },
    );
  });

  it("el subconjunto de campos heredados de v1.0.0 valida también, de forma independiente, contra StandingsEntryV1Schema", () => {
    fc.assert(
      fc.property(standingsEntryV1_1Arb, (entry) => {
        const {
          driver_id,
          position,
          class_id,
          gap,
          last_lap_time,
          best_lap_time,
          in_pits,
          off_track,
        } = entry;
        const inheritedSubset = {
          driver_id,
          position,
          class_id,
          gap,
          last_lap_time,
          best_lap_time,
          in_pits,
          off_track,
        };

        const result = StandingsEntryV1Schema.safeParse(inheritedSubset);
        expect(result.success).toBe(true);
      }),
      { numRuns: 100 },
    );
  });

  it("el propio StandingsEntryV1_1 (con los campos nuevos incluidos) también valida contra StandingsEntryV1Schema, ya que este último no es estricto y descarta campos extra", () => {
    fc.assert(
      fc.property(standingsEntryV1_1Arb, (entry) => {
        const result = StandingsEntryV1Schema.safeParse(entry);
        expect(result.success).toBe(true);
      }),
      { numRuns: 100 },
    );
  });
});
