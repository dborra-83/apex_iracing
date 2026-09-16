import { create } from "zustand";
import { persist } from "zustand/middleware";

/**
 * Identificador de cada widget configurable de la Pantalla_Principal.
 * `speedometerGear` agrupa Speedometer+GearIndicator como una sola
 * unidad arrastrable (siempre se mueven/redimensionan juntos, ya que
 * visualmente forman el "puesto de conducción"); el resto son widgets
 * individuales, incluyendo `steeringWheel` (volante, nuevo).
 * `SessionStatusBar` (la franja de bandera/clima) NO es configurable: es
 * información de seguridad que SHALL permanecer siempre visible en la
 * misma posición, fuera del `FreeGrid`.
 */
export type WidgetId =
  | "speedometerGear"
  | "throttleBrake"
  | "steeringWheel"
  | "lapTimes"
  | "sectorTimes"
  | "positionGap"
  | "fuel"
  | "tires"
  | "miniMap";

/**
 * Posición y tamaño de un widget en unidades de grilla (no píxeles):
 * `x`/`w` en columnas (`GRID_COLUMNS`), `y`/`h` en filas de
 * `GRID_ROW_HEIGHT_PX` cada una. Reemplaza el modelo anterior de
 * `size`/`order`/`region` (3 tamaños fijos, reordenamiento solo dentro de
 * una región fija) por posicionamiento y tamaño LIBRES: el usuario
 * arrastra cada widget a cualquier posición y lo redimensiona a
 * cualquier tamaño (dentro de límites mínimos/de grilla), sin las
 * restricciones de "región" que tenía el diseño anterior.
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

/** Número de columnas de la grilla libre de Apex Mobile. */
export const GRID_COLUMNS = 4;
/** Alto de una unidad de fila, en píxeles. */
export const GRID_ROW_HEIGHT_PX = 20;
/** Tamaño mínimo (columnas/filas) al que se puede redimensionar un widget. */
export const MIN_WIDGET_W = 1;
export const MIN_WIDGET_H = 3;

/**
 * Layout por defecto: aproxima la disposición visual que tenía el diseño
 * anterior (columna izquierda = velocímetro/marcha + acelerador-freno;
 * columna derecha = el resto, apilado), para que activar el `FreeGrid`
 * por primera vez no desordene todo lo que el usuario ya conocía.
 * `steeringWheel` (nuevo) se ubica debajo del acelerador/freno, en la
 * misma columna izquierda ("puesto de conducción").
 */
const DEFAULT_WIDGETS: Record<WidgetId, WidgetConfig> = {
  speedometerGear: { visible: true, x: 0, y: 0, w: 2, h: 14 },
  throttleBrake: { visible: true, x: 0, y: 14, w: 2, h: 6 },
  steeringWheel: { visible: true, x: 0, y: 20, w: 2, h: 7 },
  lapTimes: { visible: true, x: 2, y: 0, w: 2, h: 5 },
  sectorTimes: { visible: true, x: 2, y: 5, w: 2, h: 5 },
  positionGap: { visible: true, x: 2, y: 10, w: 2, h: 5 },
  fuel: { visible: true, x: 2, y: 15, w: 2, h: 5 },
  tires: { visible: true, x: 2, y: 20, w: 2, h: 7 },
  miniMap: { visible: true, x: 2, y: 27, w: 2, h: 10 },
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
 * Store de Zustand para la configuración de layout LIBRE de la
 * Pantalla_Principal de Apex Mobile (drag + resize vía `FreeGrid.tsx`,
 * más el panel de Ajustes para visibilidad).
 *
 * Persistido en `localStorage` (clave `"apex-mobile-layout-v2"`; se
 * incrementa la versión del nombre de clave respecto al diseño anterior
 * — `"apex-mobile-layout"`, con forma `size`/`order`/`region` — para que
 * un layout persistido con la forma vieja no se cargue con una forma
 * incompatible y rompa el render; el usuario simplemente vuelve a ver el
 * layout por defecto una vez, en vez de un error de hidratación).
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
    { name: "apex-mobile-layout-v2" },
  ),
);
