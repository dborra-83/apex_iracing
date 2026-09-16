import { create } from "zustand";

interface SelectedDriverState {
  /**
   * El `driver_id` del piloto actualmente seleccionado como foco
   * transversal del Dashboard, o `null` si no hay ninguno seleccionado.
   */
  selectedDriverId: string | null;
  /** Selecciona explícitamente un piloto (o lo limpia con `null`). */
  selectDriver: (id: string | null) => void;
  /**
   * Alterna la selección de `id`: si ya era el piloto seleccionado, lo
   * deselecciona (vuelve a `null`); si no, lo selecciona. Pensado para
   * manejar un click sobre una fila/marcador que ya está seleccionado sin
   * que el usuario tenga que buscar un botón de "limpiar" aparte.
   */
  toggleDriver: (id: string) => void;
}

/**
 * Store de Zustand compartido entre `Panel_Clasificacion` y `Panel_Mapa`
 * (y consumido por `Panel_Telemetria` para su selector de rival): permite
 * que un click sobre una fila de la clasificación o sobre el marcador de
 * un piloto en la barra lineal del trazado seleccione ese mismo piloto en
 * ambos paneles simultáneamente, y que `Panel_Telemetria` lo adopte
 * automáticamente como rival de la Comparativa_Sectores sin que el
 * usuario tenga que volver a elegirlo en su propio `<select>`.
 *
 * Es DELIBERADAMENTE independiente de `useStandingsStore`/
 * `useTelemetryStore`: solo guarda el `driver_id` elegido, nunca los
 * datos del piloto en sí, para que un nuevo Evento_Standings/Evento_Telemetry
 * nunca pueda alterar la selección vigente por sí solo (mismo patrón ya
 * usado por `useReferenceLapStore` para la Vuelta_Referencia).
 */
export const useSelectedDriverStore = create<SelectedDriverState>((set, get) => ({
  selectedDriverId: null,
  selectDriver: (id) => set({ selectedDriverId: id }),
  toggleDriver: (id) =>
    set({ selectedDriverId: get().selectedDriverId === id ? null : id }),
}));
