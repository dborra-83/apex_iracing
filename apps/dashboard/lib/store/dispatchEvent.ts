import type { EventoV1 } from "@apex/contrato-datos";
import { useTelemetryStore } from "./telemetryStore";
import { useStandingsStore } from "./standingsStore";
import { useSessionStore } from "./sessionStore";
import { useTrackStore } from "./trackStore";

/**
 * Función auxiliar estándar de TypeScript para forzar narrowing
 * exhaustivo: si el compilador puede alcanzar esta rama, significa que
 * `x` no ha sido reducido a `never`, es decir, que existe algún valor de
 * `EventoV1["type"]` no manejado por el `switch` de {@link dispatchEvent}.
 *
 * Si en el futuro se añade un 5to tipo de evento a la unión discriminada
 * `EventoV1` sin actualizar `dispatchEvent`, TypeScript fallará en tiempo
 * de compilación en la llamada a `assertNever` dentro del caso `default`.
 */
function assertNever(x: never): never {
  throw new Error(`dispatchEvent: tipo de evento no manejado: ${JSON.stringify(x)}`);
}

/**
 * Enruta un `EventoV1` recibido del Generador_Demo hacia el store de
 * Zustand correspondiente a su campo discriminante `type`.
 *
 * SHALL invocar exactamente el store correspondiente al `type` del
 * evento (`useTelemetryStore` para "telemetry", `useStandingsStore` para
 * "standings", `useSessionStore` para "session", `useTrackStore` para
 * "track"), y SHALL no invocar ningún otro store (Property 15 del
 * diseño — "El enrutamiento de mensajes dirige cada evento exactamente a
 * su handler por tipo", testeada formalmente en la tarea 10.3).
 *
 * Esta función no es un componente React, por lo que accede a los stores
 * de forma imperativa vía `.getState()` en lugar de los hooks `use*Store`.
 */
export function dispatchEvent(event: EventoV1): void {
  switch (event.type) {
    case "telemetry":
      useTelemetryStore.getState().setTelemetryEvent(event);
      break;
    case "standings":
      useStandingsStore.getState().setStandingsEvent(event);
      break;
    case "session":
      useSessionStore.getState().setSessionEvent(event);
      break;
    case "track":
      useTrackStore.getState().setTrackEvent(event);
      break;
    default:
      assertNever(event);
  }
}
