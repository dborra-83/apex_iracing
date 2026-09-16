import { create } from "zustand";
import type { SessionEventV1 } from "@apex/contrato-datos";

interface SessionState {
  /**
   * El último Evento_Session válido recibido, o `null` si todavía no se
   * ha recibido ninguno.
   */
  latestEvent: SessionEventV1 | null;
  /**
   * Reemplaza `latestEvent` con el evento recibido. Esta es la ÚNICA forma
   * de mutar `latestEvent`.
   */
  setSessionEvent: (event: SessionEventV1) => void;
}

/**
 * Store de Zustand para el último Evento_Session recibido por Apex Mobile
 * (tarea 17.2, Requisito 12.3), mismo patrón que
 * `apps/dashboard/lib/store/sessionStore.ts`.
 */
export const useSessionStore = create<SessionState>((set) => ({
  latestEvent: null,
  setSessionEvent: (event) => set({ latestEvent: event }),
}));
