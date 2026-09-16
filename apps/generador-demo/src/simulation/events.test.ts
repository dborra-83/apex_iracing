import { describe, it, expect } from "vitest";
import fc from "fast-check";
import {
  TelemetryEventV1Schema,
  StandingsEventV1_1Schema,
  StandingsEntryV1Schema,
  SessionEventV1Schema,
  TrackEventV1Schema,
} from "@apex/contrato-datos";
import { buildTelemetryEvent, buildStandingsEvent, buildSessionEvent, buildTrackEvent } from "./events";
import { createInitialState, type SessionState, type SimulationConfig } from "./state";
import { createRng } from "./rng";

/**
 * Generador de una `SimulationConfig` arbitraria válida: `driverCount` en
 * [1, 10], `classCount` en [1, 3], `seed` arbitraria (entero de 32 bits sin
 * signo, el rango que acepta `createRng`) y `trackId` como string
 * arbitraria (solo se usa como etiqueta, no afecta la validez del estado).
 */
function simulationConfigArbitrary(): fc.Arbitrary<SimulationConfig> {
  return fc.record({
    seed: fc.integer({ min: 0, max: 0xffffffff }),
    driverCount: fc.integer({ min: 1, max: 10 }),
    classCount: fc.integer({ min: 1, max: 3 }),
    trackId: fc.string({ minLength: 1, maxLength: 10 }),
  });
}

/**
 * Generador de un `SessionState` arbitrario válido, construido a partir de
 * una `SimulationConfig` arbitraria y su `Rng` correspondiente vía
 * `createInitialState`. Esto explora la variedad de estados alcanzables
 * por `createInitialState` (número de pilotos, distribución de clases,
 * trazado procedural, etc.) sin necesidad de aplicar ticks adicionales.
 */
function sessionStateArbitrary(): fc.Arbitrary<SessionState> {
  return simulationConfigArbitrary().map((config) => {
    const rng = createRng(config.seed);
    return createInitialState(config, rng);
  });
}

/** Generador de un `timestamp` arbitrario (epoch ms), no negativo. */
function timestampArbitrary(): fc.Arbitrary<number> {
  return fc.integer({ min: 0, max: 10_000_000_000 });
}

describe("Feature: iracing-telemetry-platform, Property 1: Conformidad de todo evento con el Contrato_Datos", () => {
  /**
   * Validates: Requirements 1.1, 1.2, 1.4, 2.1, 2.2, 3.1, 3.2, 4.1, 4.2, 5.2, 6.8
   */
  it("buildTelemetryEvent produce siempre un evento que valida contra TelemetryEventV1Schema", () => {
    fc.assert(
      fc.property(sessionStateArbitrary(), timestampArbitrary(), (state, timestamp) => {
        const event = buildTelemetryEvent(state, state.observedDriverId, timestamp);
        const result = TelemetryEventV1Schema.safeParse(event);
        expect(result.success).toBe(true);
      }),
      { numRuns: 100 },
    );
  });

  /**
   * Validates: Requirements 1.1, 1.2, 1.4, 2.1, 2.2, 3.1, 3.2, 4.1, 4.2, 5.2, 6.8
   */
  it("buildStandingsEvent produce siempre un evento que valida contra StandingsEventV1_1Schema", () => {
    fc.assert(
      fc.property(sessionStateArbitrary(), timestampArbitrary(), (state, timestamp) => {
        const event = buildStandingsEvent(state, timestamp);
        const result = StandingsEventV1_1Schema.safeParse(event);
        expect(result.success).toBe(true);
      }),
      { numRuns: 100 },
    );
  });

  /**
   * Validates: Requirements 1.1, 1.2, 1.4, 2.1, 2.2, 3.1, 3.2, 4.1, 4.2, 5.2, 6.8
   */
  it("buildSessionEvent produce siempre un evento que valida contra SessionEventV1Schema", () => {
    fc.assert(
      fc.property(sessionStateArbitrary(), timestampArbitrary(), (state, timestamp) => {
        const event = buildSessionEvent(state, timestamp);
        const result = SessionEventV1Schema.safeParse(event);
        expect(result.success).toBe(true);
      }),
      { numRuns: 100 },
    );
  });

  /**
   * Validates: Requirements 1.1, 1.2, 1.4, 2.1, 2.2, 3.1, 3.2, 4.1, 4.2, 5.2, 6.8
   */
  it("buildTrackEvent produce siempre un evento que valida contra TrackEventV1Schema", () => {
    fc.assert(
      fc.property(sessionStateArbitrary(), timestampArbitrary(), (state, timestamp) => {
        const event = buildTrackEvent(state, timestamp);
        const result = TrackEventV1Schema.safeParse(event);
        expect(result.success).toBe(true);
      }),
      { numRuns: 100 },
    );
  });
});

/**
 * Feature: apex-mobile-and-dashboard-expansion, Property 1: El
 * Evento_Standings v1.1.0 es una extensión conforme del v1.0.0, aplicada
 * ahora contra `buildStandingsEvent` (el productor real del motor de
 * simulación, no solo un arbitrary sintético de la entrada de standings).
 *
 * Para cualquier StandingsEventV1_1 producido por `buildStandingsEvent`:
 * el evento completo SHALL validar sin errores contra
 * StandingsEventV1_1Schema, y el subconjunto de campos heredados de
 * v1.0.0 de cada piloto (driver_id, position, class_id, gap,
 * last_lap_time, best_lap_time, in_pits, off_track) SHALL validar
 * también, de forma independiente, contra StandingsEntryV1Schema.
 *
 * Validates: Requirements 1.1, 1.2, 2.1, 2.2
 */
describe("Feature: apex-mobile-and-dashboard-expansion, Property 1: El Evento_Standings v1.1.0 es una extensión conforme del v1.0.0 (buildStandingsEvent)", () => {
  it("buildStandingsEvent produce siempre un StandingsEventV1_1 con version_contrato \"1.1.0\" que valida contra StandingsEventV1_1Schema", () => {
    fc.assert(
      fc.property(sessionStateArbitrary(), timestampArbitrary(), (state, timestamp) => {
        const event = buildStandingsEvent(state, timestamp);
        expect(event.version_contrato).toBe("1.1.0");
        const result = StandingsEventV1_1Schema.safeParse(event);
        expect(result.success).toBe(true);
      }),
      { numRuns: 100 },
    );
  });

  it("el subconjunto de campos heredados de v1.0.0 de cada piloto valida también, de forma independiente, contra StandingsEntryV1Schema", () => {
    fc.assert(
      fc.property(sessionStateArbitrary(), timestampArbitrary(), (state, timestamp) => {
        const event = buildStandingsEvent(state, timestamp);

        for (const driver of event.drivers) {
          const {
            driver_id,
            position,
            class_id,
            gap,
            last_lap_time,
            best_lap_time,
            in_pits,
            off_track,
          } = driver;
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
        }
      }),
      { numRuns: 100 },
    );
  });
});

/**
 * Feature: apex-mobile-and-dashboard-expansion, Requisito 2.1: emisión de
 * version_contrato "1.1.0" en todos los tipos de evento del
 * Generador_Demo (telemetry, session, track), sin cambios estructurales
 * respecto a v1.0.0 más allá del literal de versión.
 *
 * Validates: Requirements 2.1
 */
describe("Feature: apex-mobile-and-dashboard-expansion, Requisito 2.1: version_contrato \"1.1.0\" en telemetry/session/track", () => {
  it("buildTelemetryEvent emite version_contrato \"1.1.0\"", () => {
    fc.assert(
      fc.property(sessionStateArbitrary(), timestampArbitrary(), (state, timestamp) => {
        const event = buildTelemetryEvent(state, state.observedDriverId, timestamp);
        expect(event.version_contrato).toBe("1.1.0");
      }),
      { numRuns: 100 },
    );
  });

  it("buildSessionEvent emite version_contrato \"1.1.0\"", () => {
    fc.assert(
      fc.property(sessionStateArbitrary(), timestampArbitrary(), (state, timestamp) => {
        const event = buildSessionEvent(state, timestamp);
        expect(event.version_contrato).toBe("1.1.0");
      }),
      { numRuns: 100 },
    );
  });

  it("buildTrackEvent emite version_contrato \"1.1.0\"", () => {
    fc.assert(
      fc.property(sessionStateArbitrary(), timestampArbitrary(), (state, timestamp) => {
        const event = buildTrackEvent(state, timestamp);
        expect(event.version_contrato).toBe("1.1.0");
      }),
      { numRuns: 100 },
    );
  });
});
