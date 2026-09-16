import { create } from "zustand";
import type { ReferenceLapId } from "./referenceLapStore";
import type { TelemetryTracePoint } from "@/lib/view-models/telemetry-series";

/**
 * Cantidad máxima de vueltas completadas que conserva el historial. El
 * Panel_Telemetria solo necesita ofrecer al usuario una selección de
 * vueltas RECIENTES como Vuelta_Referencia (Requisito 11.3); no hace falta
 * retener la sesión completa en memoria, así que el historial se acota a
 * las últimas `MAX_COMPLETED_LAPS` vueltas.
 */
export const MAX_COMPLETED_LAPS = 8;

/**
 * Una vuelta completada, capturada como serie completa de puntos
 * (`buildTelemetrySeries`, tarea 12.5) para poder superponer su trace de
 * throttle/brake sobre el de la vuelta en curso (Requisito 11.3).
 */
export interface CompletedLap {
  /**
   * Identificador opaco de la vuelta, compatible con `ReferenceLapId` de
   * `useReferenceLapStore`. Lo asigna quien captura la vuelta (un contador
   * local incremental en Panel_Telemetria); este store no le da ningún
   * significado adicional.
   */
  id: ReferenceLapId;
  /**
   * El `last_lap_time` observado en el evento que marcó el cierre de esta
   * vuelta, o `null` si no estaba disponible. Solo se usa para etiquetar
   * la vuelta en el selector de la UI (p. ej. "Vuelta 3 · 1:23.456").
   */
  lapTime: number | null;
  /** La serie completa de puntos de la vuelta (Requisito 11.1, 11.2). */
  points: TelemetryTracePoint[];
}

interface CompletedLapsState {
  /**
   * Historial acotado de vueltas completadas recientes, en orden
   * cronológico (la más antigua primero, la más reciente al final).
   */
  laps: CompletedLap[];
  /**
   * Añade una vuelta recién completada al historial, recortando las más
   * antiguas si se supera `MAX_COMPLETED_LAPS`. Esta es la ÚNICA forma de
   * mutar `laps`.
   */
  addCompletedLap: (lap: CompletedLap) => void;
}

/**
 * Store de Zustand con el historial acotado de vueltas completadas del
 * piloto observado (Requisito 11.3: fuente de datos para que el usuario
 * pueda elegir una Vuelta_Referencia entre las vueltas ya completadas).
 *
 * Panel_Telemetria (tarea 17.2) es quien detecta el cierre de cada vuelta
 * (cruce de línea de meta sobre `lap_dist_pct`) y llama a
 * `addCompletedLap` con la serie de puntos ya construida vía
 * `buildTelemetrySeries`. Este store en sí no escucha telemetría
 * directamente: solo almacena lo que se le entrega explícitamente, igual
 * que `useReferenceLapStore` solo cambia por acción explícita del
 * llamador.
 */
export const useCompletedLapsStore = create<CompletedLapsState>((set) => ({
  laps: [],
  addCompletedLap: (lap) =>
    set((state) => {
      const next = [...state.laps, lap];
      return {
        laps:
          next.length > MAX_COMPLETED_LAPS
            ? next.slice(next.length - MAX_COMPLETED_LAPS)
            : next,
      };
    }),
}));
