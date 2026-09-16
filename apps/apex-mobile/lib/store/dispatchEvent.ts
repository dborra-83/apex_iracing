import type { EventoV1 } from "@apex/contrato-datos";
import { useTelemetryStore } from "./telemetryStore";
import { useStandingsStore } from "./standingsStore";
import { useSessionStore } from "./sessionStore";
import { useTrackStore } from "./trackStore";

/**
 * Igual que en `apps/dashboard/lib/store/dispatchEvent.ts`: fuerza
 * narrowing exhaustivo en tiempo de compilación si en el futuro se añade
 * un 5to tipo de evento a `EventoV1` sin actualizar `dispatchEvent`.
 */
function assertNever(x: never): never {
  throw new Error(`dispatchEvent: tipo de evento no manejado: ${JSON.stringify(x)}`);
}

/**
 * Enruta un `EventoV1` recibido del Generador_Demo hacia el store de
 * Zustand correspondiente a su campo discriminante `type`, para Apex
 * Mobile (tarea 17.2).
 *
 * Portabilidad de código (Requisito 12.1, 12.2, 12.3): esta función es
 * una reimplementación DELIBERADA (no un import compartido) de
 * `apps/dashboard/lib/store/dispatchEvent.ts` porque cada app posee sus
 * propios 4 stores de Zustand (Requisito 12.3 exige stores por app, no un
 * store compartido entre ambas). Sin embargo, ambas implementaciones
 * enrutan el MISMO `EventoV1` (parseado por el MISMO `parseEvent` de
 * `@apex/contrato-datos`, vía el MISMO `handleRawMessage` de
 * `@apex/ws-client-core`) con la MISMA lógica de narrowing exhaustivo por
 * `type`, por lo que producen un resultado estructuralmente idéntico
 * (Property 12 de design.md) para el mismo mensaje de entrada, sin
 * reimplementar ningún cálculo de dominio (que sí vive exclusivamente en
 * `@apex/telemetry-core`, reutilizado sin cambios por ambas apps).
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
