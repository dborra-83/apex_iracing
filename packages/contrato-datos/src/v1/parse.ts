import type { ZodError } from "zod";
import { isSupportedVersion } from "./envelope";
import { EventoV1Schema } from "./eventoV1";
import type { EventoV1 } from "./eventoV1";
import { StandingsEventV1Schema } from "./standings";
import { StandingsEventV1_1Schema } from "../v1_1/standings";

/**
 * Resultado genérico de una operación que puede fallar, sin lanzar
 * excepciones. Usado por `parseEvent` para separar el caso de éxito del
 * caso de error de forma explícita en el sistema de tipos.
 */
export type Result<T, E> = { success: true; data: T } | { success: false; error: E };

/**
 * Error producido al intentar interpretar un mensaje crudo como un
 * EventoV1. El campo `kind` discrimina entre las tres formas en que un
 * mensaje puede resultar inválido:
 *
 * - "malformed": `raw` no tiene la forma mínima esperada (no es un objeto,
 *   o no tiene un campo `version_contrato` de tipo string).
 * - "unsupported_version": `raw` tiene un `version_contrato` reconocible,
 *   pero no está entre las versiones soportadas. Esta clasificación SHALL
 *   ocurrir antes de intentar interpretar el resto del payload contra el
 *   esquema del tipo declarado (Requisito 5.4).
 * - "invalid_schema": la versión es soportada, pero el payload no cumple
 *   el esquema Zod del tipo de evento declarado.
 */
export type ContractError =
  | { kind: "malformed"; message: string }
  | { kind: "unsupported_version"; message: string; version: string }
  | { kind: "invalid_schema"; message: string; zodError: ZodError };

/**
 * Interpreta un mensaje crudo (por ejemplo, el resultado de `JSON.parse`
 * sobre un mensaje de WebSocket) como un EventoV1 del Contrato_Datos.
 *
 * Comprueba primero, de forma segura, si `raw` tiene un `version_contrato`
 * de tipo string. Si la versión no está soportada, devuelve
 * inmediatamente un error "unsupported_version" SIN haber intentado
 * `EventoV1Schema.safeParse(raw)` (Requisito 5.4; Property 2 del diseño:
 * la detección de incompatibilidad de versión ocurre antes de interpretar
 * el resto del payload).
 */
export function parseEvent(raw: unknown): Result<EventoV1, ContractError> {
  if (typeof raw !== "object" || raw === null) {
    return {
      success: false,
      error: { kind: "malformed", message: "El mensaje recibido no es un objeto." },
    };
  }

  const version = (raw as Record<string, unknown>)["version_contrato"];
  if (typeof version !== "string") {
    return {
      success: false,
      error: {
        kind: "malformed",
        message: "El mensaje recibido no tiene un campo version_contrato de tipo string.",
      },
    };
  }

  if (!isSupportedVersion(version)) {
    return {
      success: false,
      error: {
        kind: "unsupported_version",
        message: `version_contrato "${version}" no está soportada.`,
        version,
      },
    };
  }

  // `standings` requiere un despacho explícito por `version_contrato`
  // exacto en vez del `safeParse` genérico contra `EventoV1Schema`: como
  // ninguno de los esquemas de standings es `.strict()`, un payload
  // `StandingsEventV1_1` (1.1.0) también satisface estructuralmente
  // `StandingsEventV1Schema` (1.0.0) porque Zod descarta en silencio los
  // campos adicionales no declarados. Confiar en la unión genérica
  // podría, dependiendo del orden de las ramas, validar un evento 1.1.0
  // contra el esquema 1.0.0 y perder sus 4 campos nuevos. Por eso se
  // selecciona aquí el esquema exacto correspondiente a `version` (ya
  // confirmada soportada arriba, por lo tanto es exactamente "1.0.0" o
  // "1.1.0") antes de intentar cualquier `safeParse` (Requisitos 1.4, 1.5,
  // 1.6; Property 11 del diseño).
  const type = (raw as Record<string, unknown>)["type"];
  if (type === "standings") {
    const standingsSchema = version === "1.1.0" ? StandingsEventV1_1Schema : StandingsEventV1Schema;
    const standingsResult = standingsSchema.safeParse(raw);
    if (!standingsResult.success) {
      return {
        success: false,
        error: {
          kind: "invalid_schema",
          message: "El mensaje no cumple el esquema del tipo de evento declarado.",
          zodError: standingsResult.error,
        },
      };
    }

    return { success: true, data: standingsResult.data as EventoV1 };
  }

  const result = EventoV1Schema.safeParse(raw);
  if (!result.success) {
    return {
      success: false,
      error: {
        kind: "invalid_schema",
        message: "El mensaje no cumple el esquema del tipo de evento declarado.",
        zodError: result.error,
      },
    };
  }

  return { success: true, data: result.data };
}
