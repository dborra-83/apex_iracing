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
   */
  setTrackEvent: (event: TrackEventV1) => void;
}

/**
 * Store de Zustand para el último Evento_Track recibido por Apex Mobile
 * (tarea 17.2, Requisito 12.3), mismo patrón que
 * `apps/dashboard/lib/store/trackStore.ts`.
 */
export const useTrackStore = create<TrackState>((set) => ({
  latestEvent: null,
  setTrackEvent: (event) => set({ latestEvent: event }),
}));
