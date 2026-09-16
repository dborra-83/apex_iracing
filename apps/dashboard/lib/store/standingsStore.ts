import { create } from "zustand";
import type { StandingsEventV1, StandingsEventV1_1 } from "@apex/contrato-datos";

/**
 * Desde la ampliación a Version_Contrato_1_1
 * (apex-mobile-and-dashboard-expansion), el Dashboard puede recibir tanto
 * `StandingsEventV1` (1.0.0) como `StandingsEventV1_1` (1.1.0) — el mismo
 * tipo de unión que ya maneja `dispatchEvent`. El store conserva ambos
 * casos en su tipo (en vez de asumir siempre 1.1.0) para que la
 * degradación explícita ante un Evento_Standings sin los campos nuevos
 * (Requisito 13, tarea 14) pueda implementarse con narrowing normal de
 * TypeScript en cada panel, en vez de asumir un shape que podría no
 * cumplirse.
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
   *
   * Invariante (Property 14 — "El estado derivado del store siempre
   * refleja el último evento recibido por tipo", testeada formalmente en
   * la tarea 10.4): tras cualquier secuencia de llamadas, `latestEvent`
   * SHALL ser siempre igual al último Evento_Standings válido recibido,
   * independientemente del orden de llegada de eventos de otros tipos.
   */
  setStandingsEvent: (event: StandingsEventV1 | StandingsEventV1_1) => void;
}

/**
 * Store de Zustand para el último Evento_Standings recibido por el
 * Dashboard (Requisito 17.6).
 *
 * Este store es DELIBERADAMENTE independiente de `useTelemetryStore`,
 * `useSessionStore` y `useTrackStore`: no comparte estado ni reducers con
 * ellos, por lo que un evento de un tipo nunca puede tocar el store de
 * otro tipo. Esta separación es la que permite el narrowing exhaustivo de
 * `dispatchEvent` (tarea 10.2) delegar sin ambigüedad al store correcto.
 */
export const useStandingsStore = create<StandingsState>((set) => ({
  latestEvent: null,
  setStandingsEvent: (event) => set({ latestEvent: event }),
}));
