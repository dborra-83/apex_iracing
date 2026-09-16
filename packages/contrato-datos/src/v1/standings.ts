import { z } from "zod";
import { BaseEnvelopeSchema } from "./envelope";

/**
 * Entrada individual de piloto dentro del Evento_Standings: posición,
 * clase, gap, últimas/mejor vuelta y estado en pits o fuera de pista
 * (Requisito 2.1).
 */
export const StandingsEntryV1Schema = z.object({
  driver_id: z.string(),
  position: z.number().int().positive(),
  class_id: z.string(),
  gap: z.number(),
  last_lap_time: z.number().nonnegative().nullable(),
  best_lap_time: z.number().nonnegative().nullable(),
  in_pits: z.boolean(),
  off_track: z.boolean(),
});

export type StandingsEntryV1 = z.infer<typeof StandingsEntryV1Schema>;

/**
 * Evento_Standings: mensaje emitido a baja frecuencia (1-5 Hz) con la
 * clasificación de todos los pilotos de la sesión (Requisito 2).
 */
export const StandingsEventV1Schema = BaseEnvelopeSchema.extend({
  type: z.literal("standings"),
  drivers: z.array(StandingsEntryV1Schema),
});

export type StandingsEventV1 = z.infer<typeof StandingsEventV1Schema>;
