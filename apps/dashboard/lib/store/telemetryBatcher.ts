import type { TelemetryEventV1 } from "@apex/contrato-datos";

/**
 * Función de programación de callback tipo `requestAnimationFrame`:
 * recibe un callback y lo ejecuta antes del próximo repintado del
 * navegador, devolviendo un identificador que permite cancelarlo.
 */
export type ScheduleFrame = (callback: () => void) => number;

/** Función de cancelación tipo `cancelAnimationFrame`. */
export type CancelFrame = (handle: number) => void;

export interface TelemetryBatcher {
  /**
   * Encola `event` como el evento telemetry más reciente pendiente de
   * aplicar al store. Si todavía no hay un frame programado, programa
   * uno; si ya hay uno programado, simplemente reemplaza el evento en el
   * buffer sin programar un segundo frame.
   */
  push: (event: TelemetryEventV1) => void;
  /**
   * Cancela cualquier frame pendiente y descarta el evento bufferizado
   * sin aplicarlo al store. Pensado para invocarse en la limpieza
   * (unmount) del consumidor del batcher.
   */
  dispose: () => void;
}

/**
 * Resuelve el par `schedule`/`cancel` por defecto a partir de las APIs
 * nativas del navegador (`requestAnimationFrame`/`cancelAnimationFrame`).
 * Se resuelven de forma perezosa (en el momento de la llamada, no en el
 * momento de importar el módulo) para que el módulo pueda cargarse sin
 * error en entornos sin DOM (ej. Node/vitest) siempre que el consumidor
 * inyecte su propio scheduler.
 */
function defaultSchedule(callback: () => void): number {
  if (typeof requestAnimationFrame === "function") {
    return requestAnimationFrame(callback);
  }
  throw new Error(
    "telemetryBatcher: requestAnimationFrame no está disponible en este entorno; inyecte un `schedule` explícito.",
  );
}

function defaultCancel(handle: number): void {
  if (typeof cancelAnimationFrame === "function") {
    cancelAnimationFrame(handle);
    return;
  }
  throw new Error(
    "telemetryBatcher: cancelAnimationFrame no está disponible en este entorno; inyecte un `cancel` explícito.",
  );
}

/**
 * Crea un batcher de Evento_Telemetry que agrupa las llamadas a `push`
 * recibidas dentro de la misma vuelta de animación (`requestAnimationFrame`)
 * en una única actualización de `useTelemetryStore` por frame, en lugar de
 * una actualización por cada mensaje de red recibido.
 *
 * Invariante (Requisito 15 — rendimiento en tiempo real de las
 * actualizaciones de alta frecuencia): múltiples llamadas a `push` dentro
 * de la misma vuelta de animación SHALL producir exactamente UNA
 * invocación de `setTelemetryEvent`, y dicha invocación SHALL recibir
 * siempre el último evento pasado a `push` antes del flush (los eventos
 * intermedios se descartan, no se acumulan en una cola).
 *
 * @param setTelemetryEvent acción del store (`useTelemetryStore.getState().setTelemetryEvent`)
 *   que aplica el evento más reciente al estado global.
 * @param schedule función de programación de frame; por defecto
 *   `requestAnimationFrame`. Inyectable para poder testear el batcher sin
 *   depender de un entorno con DOM.
 * @param cancel función de cancelación de frame; por defecto
 *   `cancelAnimationFrame`. Inyectable junto con `schedule`.
 */
export function createTelemetryBatcher(
  setTelemetryEvent: (event: TelemetryEventV1) => void,
  schedule: ScheduleFrame = defaultSchedule,
  cancel: CancelFrame = defaultCancel,
): TelemetryBatcher {
  let pendingEvent: TelemetryEventV1 | null = null;
  let scheduledHandle: number | null = null;

  function flush(): void {
    scheduledHandle = null;
    if (pendingEvent !== null) {
      const event = pendingEvent;
      pendingEvent = null;
      setTelemetryEvent(event);
    }
  }

  return {
    push(event: TelemetryEventV1): void {
      pendingEvent = event;
      if (scheduledHandle === null) {
        scheduledHandle = schedule(flush);
      }
    },
    dispose(): void {
      if (scheduledHandle !== null) {
        cancel(scheduledHandle);
        scheduledHandle = null;
      }
      pendingEvent = null;
    },
  };
}
