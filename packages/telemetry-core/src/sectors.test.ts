import { describe, it, expect } from "vitest";
import fc from "fast-check";
import { compareSectorTimes } from "./sectors";

/**
 * Feature: apex-mobile-and-dashboard-expansion, Property 5: compareSectorTimes
 * preserva null y calcula delta exacto.
 *
 * Para cualquier par de arrays referenceLastSectorTimes/rivalLastSectorTimes
 * de igual longitud, compareSectorTimes SHALL devolver exactamente esa
 * longitud de resultados; para cualquier índice donde AMBOS valores de
 * entrada sean no-null, deltaSeconds SHALL ser exactamente
 * rivalTime - referenceTime; para cualquier índice donde AL MENOS UNO sea
 * null, deltaSeconds SHALL ser null; y para arrays de longitud distinta,
 * compareSectorTimes SHALL lanzar un Error.
 *
 * Validates: Requirements 4.2, 4.3, 4.4
 */

// Arbitrary de un tiempo de sector individual: número no negativo o null.
const sectorTimeArb = fc.option(fc.float({ min: 0, max: 600, noNaN: true }), { nil: null });

// Arbitrary de un par de arrays de tiempos de sector de igual longitud,
// generados a partir de una longitud común compartida.
const equalLengthSectorPairArb = fc
  .integer({ min: 0, max: 12 })
  .chain((length) =>
    fc.tuple(
      fc.array(sectorTimeArb, { minLength: length, maxLength: length }),
      fc.array(sectorTimeArb, { minLength: length, maxLength: length }),
    ),
  );

describe("Feature: apex-mobile-and-dashboard-expansion, Property 5: compareSectorTimes preserva null y calcula delta exacto", () => {
  it("devuelve exactamente la misma longitud que los arrays de entrada", () => {
    fc.assert(
      fc.property(equalLengthSectorPairArb, ([reference, rival]) => {
        const result = compareSectorTimes(reference, rival);
        expect(result).toHaveLength(reference.length);
      }),
      { numRuns: 100 },
    );
  });

  it("deltaSeconds es exactamente rivalTime - referenceTime cuando ambos son no-null, y null cuando al menos uno es null (nunca NaN)", () => {
    fc.assert(
      fc.property(equalLengthSectorPairArb, ([reference, rival]) => {
        const result = compareSectorTimes(reference, rival);

        result.forEach((comparison, i) => {
          expect(comparison.sectorIndex).toBe(i);
          expect(comparison.referenceTime).toBe(reference[i]);
          expect(comparison.rivalTime).toBe(rival[i]);

          if (reference[i] !== null && rival[i] !== null) {
            expect(comparison.deltaSeconds).toBe(rival[i]! - reference[i]!);
          } else {
            expect(comparison.deltaSeconds).toBeNull();
          }

          expect(comparison.deltaSeconds).not.toBeNaN();
        });
      }),
      { numRuns: 100 },
    );
  });

  it("no muta ninguno de los arrays de entrada", () => {
    fc.assert(
      fc.property(equalLengthSectorPairArb, ([reference, rival]) => {
        const referenceCopy = [...reference];
        const rivalCopy = [...rival];

        compareSectorTimes(reference, rival);

        expect(reference).toEqual(referenceCopy);
        expect(rival).toEqual(rivalCopy);
      }),
      { numRuns: 100 },
    );
  });

  it("lanza un Error descriptivo cuando las longitudes de los arrays de entrada difieren", () => {
    fc.assert(
      fc.property(
        fc.array(sectorTimeArb, { minLength: 0, maxLength: 12 }),
        fc.array(sectorTimeArb, { minLength: 0, maxLength: 12 }),
        (reference, rival) => {
          fc.pre(reference.length !== rival.length);

          expect(() => compareSectorTimes(reference, rival)).toThrow(Error);
        },
      ),
      { numRuns: 100 },
    );
  });
});
