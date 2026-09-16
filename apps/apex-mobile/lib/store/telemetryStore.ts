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
   */
  setTelemetryEvent: (event: TelemetryEventV1) => void;
}

/**
 * Store de Zustand para el último Evento_Telemetry recibido por Apex
 * Mobile (tarea 17.2, Requisito 12.3).
 *
 * Mismo patrón que `apps/dashboard/lib/store/telemetryStore.ts`: store
 * independiente por tipo de evento, mutado únicamente vía su acción
 * dedicada, para que `dispatchEvent` (de `@apex/ws-client-core` /
 * `lib/store/dispatchEvent.ts`) pueda enrutar sin ambigüedad.
 */
export const useTelemetryStore = create<TelemetryState>((set) => ({
  latestEvent: null,
  setTelemetryEvent: (event) => set({ latestEvent: event }),
}));
