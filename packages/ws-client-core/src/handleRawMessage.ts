/**
 * Interpretación de mensajes crudos del Generador_Demo contra el
 * Contrato_Datos.
 *
 * Responsabilidad de esta tarea (9.2): parsear el string crudo recibido
 * por `createWsClient` (tarea 9.1) como JSON y, si tiene éxito, validarlo
 * contra el Contrato_Datos mediante `parseEvent` (que internamente
 * comprueba `isSupportedVersion` antes de interpretar el resto del
 * payload). Cualquier mensaje no parseable, con versión incompatible o
 * que no cumpla el esquema del tipo declarado se descarta silenciosamente
 * (con un log de advertencia), sin lanzar excepciones ni interrumpir el
 * flujo del programa.
 *
 * La conexión de esta función con `createWsClient` y con `dispatchEvent`
 * se implementa en la tarea 10.6, posterior a esta.
 *
 * _Requirements: 5.4, 14.2, 14.4_
 */

import { parseEvent, type EventoV1 } from "@apex/contrato-datos";

/**
 * Parsea y valida un mensaje crudo (string) recibido por WebSocket contra
 * el Contrato_Datos. Si el mensaje es válido, invoca `onValidEvent` con el
 * evento ya tipado. En cualquier otro caso (JSON malformado, versión de
 * contrato no soportada, o payload que no cumple el esquema del tipo
 * declarado) descarta el mensaje registrando una advertencia mediante
 * `console.warn`, sin lanzar excepciones.
 *
 * @param raw string crudo recibido del `WebSocket` (ej. `msg.data`).
 * @param onValidEvent callback invocado únicamente con eventos válidos.
 */
export function handleRawMessage(
  raw: string,
  onValidEvent: (event: EventoV1) => void
): void {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    console.warn("Evento descartado: JSON inválido", raw);
    return;
  }

  const result = parseEvent(parsed);

  if (!result.success) {
    const { error } = result;
    switch (error.kind) {
      case "unsupported_version":
        console.warn(
          `Evento descartado: version_contrato "${error.version}" no soportada`,
          error.message
        );
        return;
      case "invalid_schema":
        console.warn(
          "Evento descartado: no cumple el esquema del Contrato_Datos",
          error.message,
          error.zodError
        );
        return;
      case "malformed":
        console.warn("Evento descartado: mensaje malformado", error.message);
        return;
    }
    return;
  }

  onValidEvent(result.data);
}
