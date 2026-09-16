import { z } from "zod";
import { BaseEnvelopeSchema } from "./envelope";

/**
 * Punto de coordenadas del trazado del circuito, usado para dibujar el
 * mini-mapa en el Panel_Mapa (Requisito 4.1).
 */
export const TrackPointV1Schema = z.object({
  x: z.number(),
  y: z.number(),
});

export type TrackPointV1 = z.infer<typeof TrackPointV1Schema>;

/**
 * Definición de un sector del circuito, delimitado por un porcentaje de
 * inicio y de fin sobre el progreso de vuelta (`lap_dist_pct`).
 */
export const SectorV1Schema = z.object({
  index: z.number().int().nonnegative(),
  start_pct: z.number().min(0).max(1),
  end_pct: z.number().min(0).max(1),
});

export type SectorV1 = z.infer<typeof SectorV1Schema>;

/**
 * Evento_Track: información estática del circuito, emitida exactamente una
 * vez por sesión (Requisito 4.3), incluyendo nombre, longitud y las
 * coordenadas del trazado para el mini-mapa (Requisito 4.1).
 */
export const TrackEventV1Schema = BaseEnvelopeSchema.extend({
  type: z.literal("track"),
  track_name: z.string(),
  length_m: z.number().positive(),
  path: z.array(TrackPointV1Schema).min(2),
  sectors: z.array(SectorV1Schema).min(1),
});

export type TrackEventV1 = z.infer<typeof TrackEventV1Schema>;
