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
 * Reimplementación idéntica de
 * `apps/dashboard/lib/store/telemetryBatcher.ts` para Apex Mobile (tarea
 * 17.2): la Pantalla_Principal también recibe `Evento_Telemetry` a 60Hz
 * (velocímetro, RPM, marcha), por lo que necesita la misma estrategia de
 * batching por frame para no re-renderizar por encima del presupuesto de
 * un frame a 60fps.
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
