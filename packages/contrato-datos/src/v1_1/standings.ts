import { z } from "zod";
import { BaseEnvelopeSchema } from "../v1/envelope";
import { StandingsEntryV1Schema } from "../v1/standings";

/**
 * Array de tiempos de sector: longitud igual al número de sectores del
 * Evento_Track de la sesión, donde cada posición puede ser un número
 * (tiempo del sector, no negativo) o `null` (el piloto todavía no ha
 * completado dicho sector en la vuelta correspondiente) (Requisito 1.7).
 */
export const SectorTimesV1_1Schema = z.array(z.number().nonnegative().nullable());

export type SectorTimesV1_1 = z.infer<typeof SectorTimesV1_1Schema>;

/**
 * Entrada individual de piloto dentro del Evento_Standings ampliado a la
 * Version_Contrato_1_1: extiende `StandingsEntryV1Schema` (sin alterar
 * ninguno de sus campos existentes) con los datos por-piloto adicionales
 * necesarios para gap_ahead/gap_behind derivable, comparativa de
 * sectores, stint planning multi-piloto y rivales cercanos (Requisito 1.1).
 */
export const StandingsEntryV1_1Schema = StandingsEntryV1Schema.extend({
  lap_dist_pct: z.number().min(0).max(1),
  fuel_level: z.number().nonnegative(),
  last_sector_times: SectorTimesV1_1Schema,
  best_sector_times: SectorTimesV1_1Schema,
});

export type StandingsEntryV1_1 = z.infer<typeof StandingsEntryV1_1Schema>;

/**
 * Evento_Standings bajo la Version_Contrato_1_1: mismo discriminante
 * `type: "standings"` que `StandingsEventV1Schema`, distinguido por su
 * `version_contrato` literal `"1.1.0"` y por transportar
 * `StandingsEntryV1_1` (con los 4 campos nuevos) en `drivers` (Requisito 1.1).
 */
export const StandingsEventV1_1Schema = BaseEnvelopeSchema.extend({
  type: z.literal("standings"),
  version_contrato: z.literal("1.1.0"),
  drivers: z.array(StandingsEntryV1_1Schema),
});

export type StandingsEventV1_1 = z.infer<typeof StandingsEventV1_1Schema>;
