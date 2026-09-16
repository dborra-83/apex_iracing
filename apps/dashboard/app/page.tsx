"use client";

import dynamic from "next/dynamic";
import type { ComponentType } from "react";
import { AppHeader } from "@/components/AppHeader";
import FreeGrid, { type FreeGridItem } from "@/components/FreeGrid";
import { useIsNarrowViewport } from "@/lib/hooks/useIsNarrowViewport";
import {
  useLayoutStore,
  GRID_COLUMNS,
  GRID_ROW_HEIGHT_PX,
  MIN_WIDGET_W,
  MIN_WIDGET_H,
  type WidgetId,
} from "@/lib/store/layoutStore";

// Cada panel sigue cargándose de forma perezosa (`next/dynamic`, `ssr:
// false`): al mostrarse los paneles simultáneamente ya no hay un panel
// "inactivo" que evitar montar, pero mantener el lazy-loading evita que
// el bundle inicial del cliente incluya todos los paneles en un único
// chunk, y sigue siendo necesario para no intentar renderizar en el
// servidor componentes que dependen de estado en vivo (WebSocket/stores)
// que solo existe en el cliente.
const PanelMapa = dynamic(() => import("@/components/panels/PanelMapa"), {
  ssr: false,
});
const PanelClasificacion = dynamic(
  () => import("@/components/panels/PanelClasificacion"),
  { ssr: false }
);
const PanelTelemetria = dynamic(
  () => import("@/components/panels/PanelTelemetria"),
  { ssr: false }
);
const PanelFuel = dynamic(() => import("@/components/panels/PanelFuel"), {
  ssr: false,
});
const PanelNeumaticos = dynamic(
  () => import("@/components/panels/PanelNeumaticos"),
  { ssr: false }
);
const PanelVolante = dynamic(() => import("@/components/panels/PanelVolante"), {
  ssr: false,
});

const PANEL_COMPONENT: Record<WidgetId, ComponentType> = {
  mapa: PanelMapa,
  clasificacion: PanelClasificacion,
  telemetria: PanelTelemetria,
  neumaticos: PanelNeumaticos,
  volante: PanelVolante,
  fuel: PanelFuel,
};

/**
 * Layout de mosaico: los paneles visibles del Dashboard se muestran
 * SIMULTÁNEAMENTE en una única pantalla, sin tabs ni navegación entre
 * vistas, sobre una grilla de posicionamiento LIBRE (`FreeGrid.tsx`):
 * cada panel se arrastra y redimensiona directamente en pantalla cuando
 * el modo "Editar layout" está activo (`useLayoutStore.isEditing`,
 * activado desde `AppHeader` → ícono de engranaje → `SettingsPanel`).
 * Posición (`x`/`y`) y tamaño (`w`/`h`) se guardan en columnas/filas de
 * grilla, no en un enum fijo de tamaños (reemplaza el mosaico anterior de
 * `sm`/`md`/`lg` + orden lineal).
 *
 * Cada panel ya renderiza internamente `h-full`, asumiendo que su
 * contenedor padre (el `<div>` que `FreeGrid` posiciona en píxeles
 * absolutos) le da una altura acotada de la que heredar el 100%.
 */
export default function Home() {
  const widgets = useLayoutStore((state) => state.widgets);
  const isEditing = useLayoutStore((state) => state.isEditing);
  const setRect = useLayoutStore((state) => state.setRect);
  const isNarrow = useIsNarrowViewport();

  const visibleIds = (Object.keys(widgets) as WidgetId[]).filter((id) => widgets[id].visible);

  const gridItems: FreeGridItem[] = visibleIds.map((id) => {
    const PanelComponent = PANEL_COMPONENT[id];
    return {
      id,
      rect: widgets[id],
      content: <PanelComponent />,
    };
  });

  return (
    <div className="flex flex-1 flex-col overflow-hidden bg-background">
      <AppHeader />
      <div className="flex-1 overflow-y-auto p-2">
        {isNarrow ? (
          /*
           * Vista apilada de ancho completo (tablet/celular, ver
           * `useIsNarrowViewport`): el mosaico libre `FreeGrid` está
           * pensado para escritorio (varios paneles lado a lado sobre
           * una grilla de `GRID_COLUMNS` columnas); en un viewport
           * angosto esas mismas columnas se apretarían hasta ser
           * ilegibles en vez de apilarse. Aquí cada panel visible se
           * muestra en su propia fila de ancho completo, ordenado por
           * posición configurada (`y` y luego `x`, el mismo orden
           * visual que tendría en el mosaico de escritorio) y con la
           * altura configurada (`h * GRID_ROW_HEIGHT_PX`) preservada,
           * ya que cada panel asume `h-full` de un contenedor con
           * altura acotada. El drag-and-drop de `FreeGrid` no aplica
           * aquí (no hay columnas que arrastrar entre sí en una sola
           * columna); el modo edición solo afecta la vista de
           * escritorio.
           */
          <div className="flex flex-col gap-2">
            {[...visibleIds]
              .sort((a, b) => widgets[a].y - widgets[b].y || widgets[a].x - widgets[b].x)
              .map((id) => {
                const PanelComponent = PANEL_COMPONENT[id];
                return (
                  <section
                    key={id}
                    className="overflow-hidden rounded-md border border-border bg-card"
                    style={{ height: widgets[id].h * GRID_ROW_HEIGHT_PX }}
                  >
                    <PanelComponent />
                  </section>
                );
              })}
          </div>
        ) : (
          <FreeGrid
            items={gridItems}
            columns={GRID_COLUMNS}
            rowHeightPx={GRID_ROW_HEIGHT_PX}
            minW={MIN_WIDGET_W}
            minH={MIN_WIDGET_H}
            isEditing={isEditing}
            onRectChange={(id, rect) => setRect(id as WidgetId, rect)}
          />
        )}
      </div>
    </div>
  );
}
