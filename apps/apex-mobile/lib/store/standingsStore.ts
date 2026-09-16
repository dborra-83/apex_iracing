import { create } from "zustand";
import type { StandingsEventV1, StandingsEventV1_1 } from "@apex/contrato-datos";

/**
 * Igual que en `apps/dashboard/lib/store/standingsStore.ts`: Apex Mobile
 * puede recibir tanto `StandingsEventV1` (1.0.0) como `StandingsEventV1_1`
 * (1.1.0). El store conserva ambos casos en su tipo para que la
 * degradación explícita ante un Evento_Standings sin los campos nuevos
 * (Requisito 13) pueda implementarse con narrowing normal de TypeScript
 * en cada componente de la Pantalla_Principal, en vez de asumir un shape
 * que podría no cumplirse.
 */
interface StandingsState {
  /**
   * El último Evento_Standings válido recibido, o `null` si todavía no se
   * ha recibido ninguno.
   */
  latestEvent: StandingsEventV1 | StandingsEventV1_1 | null;
  /**
   * Reemplaza `latestEvent` con el evento recibido. Esta es la ÚNICA forma
   * de mutar `latestEvent`.
   */
  setStandingsEvent: (event: StandingsEventV1 | StandingsEventV1_1) => void;
}

/**
 * Store de Zustand para el último Evento_Standings recibido por Apex
 * Mobile (tarea 17.2, Requisito 12.3), mismo patrón que
 * `apps/dashboard/lib/store/standingsStore.ts`.
 */
export const useStandingsStore = create<StandingsState>((set) => ({
  latestEvent: null,
  setStandingsEvent: (event) => set({ latestEvent: event }),
}));
