import { describe, it, expect } from "vitest";
import fc from "fast-check";
import { parseEvent } from "./parse";
import { isSupportedVersion, SUPPORTED_CONTRACT_VERSIONS } from "./envelope";

/**
 * Feature: iracing-telemetry-platform, Property 2: Filtrado correcto por version_contrato
 *
 * Para cualquier mensaje recibido (con version_contrato soportado o no, y
 * con payload valido o invalido para su tipo declarado), parseEvent SHALL
 * clasificar el mensaje como incompatible si y solo si su version_contrato
 * no esta en el conjunto de versiones soportadas (Requisito 5.4), y SHALL
 * descartarlo sin producir ningun efecto observable sobre el estado de los
 * demas stores/paneles cuando asi ocurra (Requisito 14.4): la clasificacion
 * "unsupported_version" ocurre antes de intentar interpretar el resto del
 * payload contra el schema del tipo declarado.
 */

const SUPPORTED_VERSION = SUPPORTED_CONTRACT_VERSIONS[0];

// Arbitrary de un Evento_Telemetry v1 valido, respetando todos los
// constraints numericos/booleanos del TelemetryEventV1Schema.
const validTelemetryPayloadArb = fc.record({
  version_contrato: fc.constant(SUPPORTED_VERSION),
  timestamp: fc.integer({ min: 0, max: 10_000_000_000 }),
  type: fc.constant("telemetry" as const),
  driver_id: fc.string({ minLength: 1, maxLength: 20 }),
  speed: fc.float({ min: 0, max: 400, noNaN: true }),
  rpm: fc.float({ min: 0, max: 20000, noNaN: true }),
  gear: fc.integer({ min: -1, max: 8 }),
  throttle: fc.float({ min: 0, max: 1, noNaN: true }),
  brake: fc.float({ min: 0, max: 1, noNaN: true }),
  steering: fc.float({ min: -1, max: 1, noNaN: true }),
  fuel_level: fc.float({ min: 0, max: 120, noNaN: true }),
  lap_dist_pct: fc.float({ min: 0, max: 1, noNaN: true }),
  current_lap_time: fc.float({ min: 0, max: 600, noNaN: true }),
  last_lap_time: fc.option(fc.float({ min: 0, max: 600, noNaN: true }), { nil: null }),
  best_lap_time: fc.option(fc.float({ min: 0, max: 600, noNaN: true }), { nil: null }),
  delta_to_best: fc.option(fc.float({ min: -100, max: 100, noNaN: true }), { nil: null }),
  delta_to_prev: fc.option(fc.float({ min: -100, max: 100, noNaN: true }), { nil: null }),
  position: fc.integer({ min: 1, max: 50 }),
  track_temp: fc.float({ min: -50, max: 80, noNaN: true }),
  air_temp: fc.float({ min: -50, max: 80, noNaN: true }),
});

// Arbitrary de un payload que, con la version soportada, NO cumple ningun
// schema de evento del Contrato_Datos v1 (falta `type`, `type` no
// reconocido, o un campo con tipo incorrecto).
const invalidSchemaPayloadArb = fc.oneof(
  validTelemetryPayloadArb.map((payload) => {
    const { type, ...rest } = payload;
    return rest as Record<string, unknown>;
  }),
  validTelemetryPayloadArb.map((payload) => ({ ...payload, type: "tipo_no_reconocido" })),
  validTelemetryPayloadArb.map((payload) => ({ ...payload, driver_id: 12345 as unknown as string })),
);

// Arbitrary de version_contrato arbitraria que nunca coincide con una
// version soportada.
const unsupportedVersionArb = fc.string().filter((v) => !isSupportedVersion(v));

// Arbitrary de un payload generico "cualquiera" (objeto plano arbitrario),
// usado para la propiedad (a): incluso si el payload seria valido o
// invalido para el schema, con version no soportada el resultado SHALL
// ser siempre "unsupported_version".
const genericObjectPayloadArb = fc.oneof(
  fc.object(),
  validTelemetryPayloadArb as unknown as fc.Arbitrary<Record<string, unknown>>,
  invalidSchemaPayloadArb,
);

describe("Feature: iracing-telemetry-platform, Property 2: Filtrado correcto por version_contrato", () => {
  it("(a) version_contrato no soportado clasifica siempre como unsupported_version, nunca como invalid_schema, sin importar el payload", () => {
    fc.assert(
      fc.property(unsupportedVersionArb, genericObjectPayloadArb, (version, payload) => {
        const raw = { ...payload, version_contrato: version };
        const result = parseEvent(raw);

        expect(result.success).toBe(false);
        if (!result.success) {
          expect(result.error.kind).toBe("unsupported_version");
          expect(result.error.kind).not.toBe("invalid_schema");
          if (result.error.kind === "unsupported_version") {
            expect(result.error.version).toBe(version);
          }
        }
      }),
      { numRuns: 100 },
    );
  });

  it("(b) version_contrato soportado con payload conforme al schema declarado SHALL parsear con exito", () => {
    fc.assert(
      fc.property(validTelemetryPayloadArb, (payload) => {
        const result = parseEvent(payload);
        expect(result.success).toBe(true);
      }),
      { numRuns: 100 },
    );
  });

  it("(c) version_contrato soportado con payload que no cumple ningun schema SHALL fallar con invalid_schema", () => {
    fc.assert(
      fc.property(invalidSchemaPayloadArb, (payload) => {
        const raw = { ...payload, version_contrato: SUPPORTED_VERSION };
        const result = parseEvent(raw);

        expect(result.success).toBe(false);
        if (!result.success) {
          expect(result.error.kind).toBe("invalid_schema");
        }
      }),
      { numRuns: 100 },
    );
  });

  it("(d) valores de raw que no son objetos, o sin version_contrato de tipo string, SHALL fallar con malformed", () => {
    const nonObjectRawArb = fc.oneof(
      fc.constant(null),
      fc.constant(undefined),
      fc.array(fc.anything()),
      fc.string(),
      fc.integer(),
      fc.boolean(),
      fc.object().map((o) => {
        const clone: Record<string, unknown> = { ...o };
        delete clone["version_contrato"];
        return clone;
      }),
      fc.object().map((o) => ({ ...o, version_contrato: 12345 })),
    );

    fc.assert(
      fc.property(nonObjectRawArb, (raw) => {
        const result = parseEvent(raw);
        expect(result.success).toBe(false);
        if (!result.success) {
          expect(result.error.kind).toBe("malformed");
        }
      }),
      { numRuns: 100 },
    );
  });
});

/**
 * Feature: apex-mobile-and-dashboard-expansion, Property 11: parseEvent
 * despacha standings al esquema correcto según version_contrato.
 *
 * Para cualquier mensaje crudo con type: "standings", parseEvent SHALL
 * validarlo contra StandingsEventV1Schema si version_contrato === "1.0.0",
 * contra StandingsEventV1_1Schema si version_contrato === "1.1.0", y SHALL
 * clasificarlo como unsupported_version para cualquier otro valor de
 * version_contrato -- sin excepciones a la regla ya establecida (Property
 * 2 del spec anterior) de que la detección de versión no soportada ocurre
 * antes de intentar safeParse contra cualquier esquema.
 *
 * Validates: Requirements 1.3, 1.4, 1.5, 1.6
 */

const sectorTimesArb = fc.array(
  fc.option(fc.float({ min: 0, max: 600, noNaN: true }), { nil: null }),
  { minLength: 0, maxLength: 8 },
);

// Arbitrary de un StandingsEntryV1 valido (sin los campos nuevos de 1.1.0).
const standingsEntryV1Arb = fc.record({
  driver_id: fc.string({ minLength: 1, maxLength: 20 }),
  position: fc.integer({ min: 1, max: 50 }),
  class_id: fc.string({ minLength: 1, maxLength: 10 }),
  gap: fc.float({ min: 0, max: 200, noNaN: true }),
  last_lap_time: fc.option(fc.float({ min: 0, max: 600, noNaN: true }), { nil: null }),
  best_lap_time: fc.option(fc.float({ min: 0, max: 600, noNaN: true }), { nil: null }),
  in_pits: fc.boolean(),
  off_track: fc.boolean(),
});

// Arbitrary de un StandingsEntryV1_1 valido (con los 4 campos nuevos).
const standingsEntryV1_1Arb = standingsEntryV1Arb.chain((base) =>
  fc.record({
    lap_dist_pct: fc.float({ min: 0, max: 1, noNaN: true }),
    fuel_level: fc.float({ min: 0, max: 120, noNaN: true }),
    last_sector_times: sectorTimesArb,
    best_sector_times: sectorTimesArb,
  }).map((extra) => ({ ...base, ...extra })),
);

// Payload de Evento_Standings con version_contrato "1.0.0" (forma original).
const standingsPayloadV1_0Arb = fc.record({
  version_contrato: fc.constant("1.0.0" as const),
  timestamp: fc.integer({ min: 0, max: 10_000_000_000 }),
  type: fc.constant("standings" as const),
  drivers: fc.array(standingsEntryV1Arb, { minLength: 0, maxLength: 10 }),
});

// Payload de Evento_Standings con version_contrato "1.1.0" (forma ampliada).
const standingsPayloadV1_1Arb = fc.record({
  version_contrato: fc.constant("1.1.0" as const),
  timestamp: fc.integer({ min: 0, max: 10_000_000_000 }),
  type: fc.constant("standings" as const),
  drivers: fc.array(standingsEntryV1_1Arb, { minLength: 0, maxLength: 10 }),
});

describe("Feature: apex-mobile-and-dashboard-expansion, Property 11: parseEvent despacha standings al esquema correcto según version_contrato", () => {
  it("(a) version_contrato \"1.0.0\" con payload de standings v1.0.0 parsea con éxito y preserva exactamente los campos originales (sin los 4 nuevos)", () => {
    fc.assert(
      fc.property(standingsPayloadV1_0Arb, (payload) => {
        const result = parseEvent(payload);
        expect(result.success).toBe(true);
        if (result.success && result.data.type === "standings") {
          for (const driver of result.data.drivers) {
            expect(driver).not.toHaveProperty("lap_dist_pct");
            expect(driver).not.toHaveProperty("fuel_level");
            expect(driver).not.toHaveProperty("last_sector_times");
            expect(driver).not.toHaveProperty("best_sector_times");
          }
        }
      }),
      { numRuns: 100 },
    );
  });

  it("(b) version_contrato \"1.1.0\" con payload de standings v1.1.0 parsea con éxito y preserva los 4 campos nuevos", () => {
    fc.assert(
      fc.property(standingsPayloadV1_1Arb, (payload) => {
        const result = parseEvent(payload);
        expect(result.success).toBe(true);
        if (result.success && result.data.type === "standings") {
          for (let i = 0; i < result.data.drivers.length; i++) {
            const driver = result.data.drivers[i] as Record<string, unknown>;
            const original = payload.drivers[i]!;
            expect(driver.lap_dist_pct).toBe(original.lap_dist_pct);
            expect(driver.fuel_level).toBe(original.fuel_level);
            expect(driver.last_sector_times).toEqual(original.last_sector_times);
            expect(driver.best_sector_times).toEqual(original.best_sector_times);
          }
        }
      }),
      { numRuns: 100 },
    );
  });

  it("(c) version_contrato distinto de \"1.0.0\" y \"1.1.0\" en un payload de standings SHALL clasificarse como unsupported_version, sin intentar safeParse contra ningún esquema de standings", () => {
    fc.assert(
      fc.property(
        fc.oneof(standingsPayloadV1_0Arb, standingsPayloadV1_1Arb),
        unsupportedVersionArb,
        (basePayload, version) => {
          const raw = { ...basePayload, version_contrato: version };
          const result = parseEvent(raw);

          expect(result.success).toBe(false);
          if (!result.success) {
            expect(result.error.kind).toBe("unsupported_version");
            if (result.error.kind === "unsupported_version") {
              expect(result.error.version).toBe(version);
            }
          }
        },
      ),
      { numRuns: 100 },
    );
  });
});
