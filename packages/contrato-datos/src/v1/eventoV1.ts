import { z } from "zod";
import { TelemetryEventV1Schema } from "./telemetry";
import { StandingsEventV1Schema } from "./standings";
import { SessionEventV1Schema } from "./session";
import { TrackEventV1Schema } from "./track";
import { StandingsEventV1_1Schema } from "../v1_1/standings";
import type { TelemetryEventV1 } from "./telemetry";
import type { StandingsEventV1 } from "./standings";
import type { SessionEventV1 } from "./session";
import type { TrackEventV1 } from "./track";
import type { StandingsEventV1_1 } from "../v1_1/standings";

/**
 * Union de los tipos de evento del Contrato_Datos: v1 (telemetry,
 * standings 1.0.0, session, track) y la extensión aditiva de standings a
 * la Version_Contrato_1_1 (`StandingsEventV1_1Schema`), aceptada bajo el
 * mismo campo `type: "standings"`, distinguida por `version_contrato`
 * (Requisito 1.2).
 *
 * Se usa `z.union` en vez de `z.discriminatedUnion("type", ...)` porque
 * `StandingsEventV1Schema` y `StandingsEventV1_1Schema` comparten el
 * mismo literal de discriminante (`type: "standings"`): Zod exige que
 * los literales de discriminante de un `discriminatedUnion` sean únicos
 * entre ramas, lo cual no se cumple aquí. `parseEvent` (`./parse`) NO
 * depende de esta unión para despachar `standings` entre 1.0.0 y 1.1.0:
 * selecciona explícitamente el esquema exacto según `version_contrato`
 * antes de llamar a `safeParse` (ver `./parse`). Esta unión se conserva
 * para los demás tipos de evento y para exponer un único esquema
 * combinado a quien necesite validar un `EventoV1` sin conocer de
 * antemano su `type`.
 */
export const EventoV1Schema = z.union([
  TelemetryEventV1Schema,
  StandingsEventV1Schema,
  StandingsEventV1_1Schema,
  SessionEventV1Schema,
  TrackEventV1Schema,
]);

/**
 * A nivel de tipos, `EventoV1` sigue siendo una unión discriminada natural
 * por `type` (todos los miembros comparten un campo `type` literal), lo
 * que permite narrowing exhaustivo en el Dashboard (Requisito 5.2) aunque
 * el esquema Zod subyacente ya no sea un `discriminatedUnion`.
 */
export type EventoV1 =
  | TelemetryEventV1
  | StandingsEventV1
  | StandingsEventV1_1
  | SessionEventV1
  | TrackEventV1;
