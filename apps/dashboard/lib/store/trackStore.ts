import { create } from "zustand";
import type { TrackEventV1 } from "@apex/contrato-datos";

interface TrackState {
  /**
   * El último Evento_Track válido recibido, o `null` si todavía no se ha
   * recibido ninguno.
   */
  latestEvent: TrackEventV1 | null;
  /**
   * Reemplaza `latestEvent` con el evento recibido. Esta es la ÚNICA forma
   * de mutar `latestEvent`.
   *
   * Invariante (Property 14 — "El estado derivado del store siempre
   * refleja el último evento recibido por tipo", testeada formalmente en
   * la tarea 10.4): tras cualquier secuencia de llamadas, `latestEvent`
   * SHALL ser siempre igual al último Evento_Track válido recibido,
   * independientemente del orden de llegada de eventos de otros tipos.
   */
  setTrackEvent: (event: TrackEventV1) => void;
}

/**
 * Store de Zustand para el último Evento_Track recibido por el Dashboard
 * (Requisito 17.6).
 *
 * Este store es DELIBERADAMENTE independiente de `useTelemetryStore`,
 * `useStandingsStore` y `useSessionStore`: no comparte estado ni
 * reducers con ellos, por lo que un evento de un tipo nunca puede tocar
 * el store de otro tipo. Esta separación es la que permite el narrowing
 * exhaustivo de `dispatchEvent` (tarea 10.2) delegar sin ambigüedad al
 * store correcto.
 */
export const useTrackStore = create<TrackState>((set) => ({
  latestEvent: null,
  setTrackEvent: (event) => set({ latestEvent: event }),
}));
