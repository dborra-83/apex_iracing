import { z } from "zod";
import { BaseEnvelopeSchema } from "./envelope";

/**
 * Banderas posibles del estado global de la sesión (Requisito 3.1).
 */
export const FlagV1Schema = z.enum(["green", "yellow", "red", "checkered", "white"]);

export type FlagV1 = z.infer<typeof FlagV1Schema>;

/**
 * Condiciones climáticas posibles del estado global de la sesión (Requisito 3.1).
 */
export const WeatherV1Schema = z.enum(["clear", "cloudy", "light_rain", "heavy_rain"]);

export type WeatherV1 = z.infer<typeof WeatherV1Schema>;

/**
 * Evento_Session: mensaje emitido cuando cambia el estado global de la
 * sesión (tipo de sesión, clima, bandera, tiempo/vueltas restantes,
 * incidentes) (Requisito 3).
 */
export const SessionEventV1Schema = BaseEnvelopeSchema.extend({
  type: z.literal("session"),
  session_type: z.enum(["practice", "qualy", "race"]),
  weather: WeatherV1Schema,
  flag: FlagV1Schema,
  time_remaining_s: z.number().nonnegative().nullable(),
  laps_remaining: z.number().int().nonnegative().nullable(),
  incidents: z.number().int().nonnegative(),
});

export type SessionEventV1 = z.infer<typeof SessionEventV1Schema>;
