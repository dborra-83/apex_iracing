import { create } from "zustand";

/**
 * Identificador de una vuelta completada, tal como lo asigna el consumidor
 * (Panel_Telemetria) a partir de su propio buffer de vueltas. El motor de
 * simulación actual no expone explícitamente un "número de vuelta
 * completada" en el Evento_Telemetry, por lo que este store no asume nada
 * sobre su origen: solo lo trata como un identificador opaco.
 */
export type ReferenceLapId = string | number;

interface ReferenceLapState {
  /**
   * La Vuelta_Referencia seleccionada actualmente, o `null` si el usuario
   * no ha seleccionado ninguna todavía.
   */
  referenceLapId: ReferenceLapId | null;
  /**
   * Selecciona explícitamente una Vuelta_Referencia (o la limpia con `null`).
   * Esta es la ÚNICA forma de mutar `referenceLapId`.
   */
  selectReferenceLap: (id: ReferenceLapId | null) => void;
}

/**
 * Store de Zustand para la Vuelta_Referencia del Panel_Telemetria
 * (Requisitos 11.3, 11.4).
 *
 * Decisión de diseño (Property 12 — "La Vuelta_Referencia seleccionada es
 * invariante ante nuevas telemetrías", Requisito 11.4): este store es
 * DELIBERADAMENTE independiente del store de telemetría (`useTelemetryStore`,
 * implementado en la tarea 10.1) y de cualquier otro store que reciba
 * Evento_Telemetry. No existe ningún listener, reducer, `subscribe` ni
 * efecto que escuche eventos de telemetría entrantes y toque
 * `referenceLapId` desde aquí.
 *
 * En la práctica esto garantiza la invariancia por construcción: el único
 * lugar del código que puede cambiar `referenceLapId` es una llamada
 * explícita a `selectReferenceLap` disparada por una interacción del
 * usuario (p. ej. elegir una vuelta de una lista en el Panel_Telemetria).
 * Un nuevo Evento_Telemetry actualiza `useTelemetryStore` y el buffer de
 * trace del panel, pero nunca este store: al no compartir estado ni
 * reducers con el pipeline de telemetría, no hay ningún camino de código
 * por el cual la llegada de telemetría pueda alterar la selección vigente.
 *
 * Se modela como un store de Zustand (en vez de una función de view-model
 * con closure) porque es estado de UI que debe persistir entre renders y
 * compartirse entre componentes (el selector de vuelta y el overlay del
 * gráfico de throttle/brake), consistente con el resto de `lib/store/`
 * descrito en el diseño.
 */
export const useReferenceLapStore = create<ReferenceLapState>((set) => ({
  referenceLapId: null,
  selectReferenceLap: (id) => set({ referenceLapId: id }),
}));
