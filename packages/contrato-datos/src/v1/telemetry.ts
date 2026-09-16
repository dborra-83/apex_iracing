import { z } from "zod";
import { BaseEnvelopeSchema } from "./envelope";

/**
 * Estado instantáneo de un neumático individual: temperatura de la goma
 * (°C), presión de inflado (psi) y desgaste acumulado en `[0, 1]` (0 =
 * neumático nuevo, 1 = completamente desgastado).
 *
 * Campo añadido de forma ADITIVA y OPCIONAL a `TelemetryEventV1Schema`
 * (ver más abajo): no es parte de los 4 tipos de evento originales de
 * `iracing-telemetry-platform` ni de la ampliación
 * `apex-mobile-and-dashboard-expansion`, pero se modela con el mismo
 * criterio de versionado ya usado por esa ampliación (aditivo,
 * retrocompatible, sin alterar ningún campo existente). Al ser
 * `z.optional()`, cualquier `Evento_Telemetry` que no incluya `tires`
 * (p. ej. fixtures/tests preexistentes, o un futuro emisor que no simule
 * neumáticos) sigue validando con normalidad contra este mismo esquema —
 * no se introduce una `Version_Contrato_1_2` separada porque no hace
 * falta invalidar payloads existentes para agregar este dato opcional.
 */
export const TireCornerV1Schema = z.object({
  temp: z.number(),
  pressure: z.number().nonnegative(),
  wear: z.number().min(0).max(1),
});

export type TireCornerV1 = z.infer<typeof TireCornerV1Schema>;

/**
 * Estado de los 4 neumáticos del vehículo, uno por rueda: `fl`/`fr`
 * (delantero izquierdo/derecho), `rl`/`rr` (trasero izquierdo/derecho).
 */
export const TireStateV1Schema = z.object({
  fl: TireCornerV1Schema,
  fr: TireCornerV1Schema,
  rl: TireCornerV1Schema,
  rr: TireCornerV1Schema,
});

export type TireStateV1 = z.infer<typeof TireStateV1Schema>;

/**
 * Evento_Telemetry: mensaje emitido a alta frecuencia (~60 Hz) con los
 * datos instantáneos del vehículo del piloto observado (Requisito 1).
 */
export const TelemetryEventV1Schema = BaseEnvelopeSchema.extend({
  type: z.literal("telemetry"),
  driver_id: z.string(),
  speed: z.number().nonnegative(),
  rpm: z.number().nonnegative(),
  gear: z.number().int(),
  throttle: z.number().min(0).max(1),
  brake: z.number().min(0).max(1),
  steering: z.number().min(-1).max(1),
  fuel_level: z.number().nonnegative(),
  lap_dist_pct: z.number().min(0).max(1),
  current_lap_time: z.number().nonnegative(),
  last_lap_time: z.number().nonnegative().nullable(),
  best_lap_time: z.number().nonnegative().nullable(),
  delta_to_best: z.number().nullable(),
  delta_to_prev: z.number().nullable(),
  position: z.number().int().positive(),
  track_temp: z.number(),
  air_temp: z.number(),
  tires: TireStateV1Schema.optional(),
});

export type TelemetryEventV1 = z.infer<typeof TelemetryEventV1Schema>;
