import { create } from "zustand";
import { persist } from "zustand/middleware";

/** Identificador de cada panel configurable del mosaico del Dashboard. */
export type WidgetId =
  | "mapa"
  | "clasificacion"
  | "telemetria"
  | "neumaticos"
  | "volante"
  | "fuel";

/**
 * Posición y tamaño de un panel en unidades de grilla (no píxeles):
 * `x`/`w` en columnas (`GRID_COLUMNS`), `y`/`h` en filas de
 * `GRID_ROW_HEIGHT_PX` cada una. Reemplaza el modelo anterior de
 * `size`/`order` (3 tamaños fijos, orden lineal único) por
 * posicionamiento y tamaño LIBRES vía drag-and-drop + resize
 * (`FreeGrid.tsx`).
 */
export interface WidgetRect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface WidgetConfig extends WidgetRect {
  visible: boolean;
}

/** Número de columnas de la grilla libre del Dashboard. */
export const GRID_COLUMNS = 12;
/** Alto de una unidad de fila, en píxeles. */
export const GRID_ROW_HEIGHT_PX = 16;
/** Tamaño mínimo (columnas/filas) al que se puede redimensionar un panel. */
export const MIN_WIDGET_W = 2;
export const MIN_WIDGET_H = 6;

/**
 * Layout por defecto: reproduce el mosaico original hardcodeado (Mapa
 * ancho completo arriba, Clasificación/Telemetría en la fila siguiente,
 * Neumáticos/Volante/Fuel en la última), para que activar el `FreeGrid`
 * por primera vez no reordene nada que el usuario no haya pedido
 * explícitamente. `volante` (nuevo) se ubica junto a Neumáticos.
 */
const DEFAULT_WIDGETS: Record<WidgetId, WidgetConfig> = {
  mapa: { visible: true, x: 0, y: 0, w: 12, h: 9 },
  clasificacion: { visible: true, x: 0, y: 9, w: 4, h: 21 },
  telemetria: { visible: true, x: 4, y: 9, w: 8, h: 21 },
  neumaticos: { visible: true, x: 0, y: 30, w: 4, h: 16 },
  volante: { visible: true, x: 4, y: 30, w: 3, h: 16 },
  fuel: { visible: true, x: 7, y: 30, w: 5, h: 16 },
};

interface LayoutState {
  /** Si `true`, `FreeGrid` muestra asas de arrastre/resize y permite modificar el layout; si `false`, es solo lectura. */
  isEditing: boolean;
  widgets: Record<WidgetId, WidgetConfig>;
  setEditing: (isEditing: boolean) => void;
  setVisible: (id: WidgetId, visible: boolean) => void;
  setRect: (id: WidgetId, rect: WidgetRect) => void;
  reset: () => void;
}

/**
 * Store de Zustand para la configuración de layout LIBRE del mosaico del
 * Dashboard, mismo patrón que `apps/apex-mobile/lib/store/layoutStore.ts`.
 *
 * Persistido en `localStorage` (clave `"apex-dashboard-layout-v2"`,
 * versión de clave incrementada respecto al diseño anterior por el mismo
 * motivo: forma de datos incompatible entre `size`/`order` y `x/y/w/h`).
 */
export const useLayoutStore = create<LayoutState>()(
  persist(
    (set, get) => ({
      isEditing: false,
      widgets: DEFAULT_WIDGETS,
      setEditing: (isEditing) => set({ isEditing }),
      setVisible: (id, visible) =>
        set({ widgets: { ...get().widgets, [id]: { ...get().widgets[id], visible } } }),
      setRect: (id, rect) =>
        set({ widgets: { ...get().widgets, [id]: { ...get().widgets[id], ...rect } } }),
      reset: () => set({ widgets: DEFAULT_WIDGETS }),
    }),
    { name: "apex-dashboard-layout-v2" },
  ),
);
