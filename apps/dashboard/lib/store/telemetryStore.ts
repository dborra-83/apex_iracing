import { create } from "zustand";
import type { TelemetryEventV1 } from "@apex/contrato-datos";

interface TelemetryState {
  /**
   * El último Evento_Telemetry válido recibido, o `null` si todavía no se
   * ha recibido ninguno.
   */
  latestEvent: TelemetryEventV1 | null;
  /**
   * Reemplaza `latestEvent` con el evento recibido. Esta es la ÚNICA forma
   * de mutar `latestEvent`.
   *
   * Invariante (Property 14 — "El estado derivado del store siempre
   * refleja el último evento recibido por tipo", testeada formalmente en
   * la tarea 10.4): tras cualquier secuencia de llamadas, `latestEvent`
   * SHALL ser siempre igual al último Evento_Telemetry válido recibido,
   * independientemente del orden de llegada de eventos de otros tipos.
   */
  setTelemetryEvent: (event: TelemetryEventV1) => void;
}

/**
 * Store de Zustand para el último Evento_Telemetry recibido por el
 * Dashboard (Requisito 17.6).
 *
 * Este store es DELIBERADAMENTE independiente de `useStandingsStore`,
 * `useSessionStore` y `useTrackStore`: no comparte estado ni reducers con
 * ellos, por lo que un evento de un tipo nunca puede tocar el store de
 * otro tipo. Esta separación es la que permite el narrowing exhaustivo de
 * `dispatchEvent` (tarea 10.2) delegar sin ambigüedad al store correcto.
 */
export const useTelemetryStore = create<TelemetryState>((set) => ({
  latestEvent: null,
  setTelemetryEvent: (event) => set({ latestEvent: event }),
}));
