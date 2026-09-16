"use client";

import { useMemo } from "react";
import type { StandingsEntryV1_1 } from "@apex/contrato-datos";
import {
  compareSectorTimes,
  computeGaps,
  deriveFuelConsumptionRate,
  estimateRemainingLaps,
  nearestRivals,
  type SectorComparison,
} from "@apex/telemetry-core";
import Speedometer from "@/components/Speedometer";
import GearIndicator from "@/components/GearIndicator";
import LapTimesPanel from "@/components/LapTimesPanel";
import PositionGapPanel from "@/components/PositionGapPanel";
import FuelPanel from "@/components/FuelPanel";
import MiniMap from "@/components/MiniMap";
import SessionStatusBar from "@/components/SessionStatusBar";
import ThrottleBrakePanel from "@/components/ThrottleBrakePanel";
import SectorTimesPanel from "@/components/SectorTimesPanel";
import TirePanel from "@/components/TirePanel";
import SteeringWheel from "@/components/SteeringWheel";
import FreeGrid, { type FreeGridItem } from "@/components/FreeGrid";
import { useTelemetryStore } from "@/lib/store/telemetryStore";
import { useStandingsStore } from "@/lib/store/standingsStore";
import { useTrackStore } from "@/lib/store/trackStore";
import { useSessionStore } from "@/lib/store/sessionStore";
import { useFuelHistory } from "@/lib/hooks/useFuelHistory";
import {
  useLayoutStore,
  GRID_COLUMNS,
  GRID_ROW_HEIGHT_PX,
  MIN_WIDGET_W,
  MIN_WIDGET_H,
  type WidgetId,
} from "@/lib/store/layoutStore";

/** Número de Rivales_Cercanos mostrados en el `MiniMap` (Requisito 10, mismo valor que el ejemplo de design.md). */
const NEAREST_RIVALS_COUNT = 3;

/**
 * Type guard que distingue un `Evento_Standings` en Version_Contrato_1_1
 * (con `lap_dist_pct` por piloto, necesario para `nearestRivals`) de uno
 * en Version_Contrato_1_0. Mismo patrón `isStandingsV1_1` ya usado en
 * `apps/dashboard/components/panels/PanelFuel.tsx`/`PanelTelemetria.tsx`.
 */
function isStandingsV1_1(
  event: { version_contrato: string } | null,
): event is { version_contrato: "1.1.0"; drivers: StandingsEntryV1_1[] } {
  return event !== null && event.version_contrato === "1.1.0";
}

/**
 * Pantalla_Principal de Apex Mobile (tarea 19.6, Requisito 8.1, 8.3, 9):
 * ÚNICA pantalla de la app, sin tabs ni router interno, que monta
 * simultáneamente el velocímetro, indicador de marcha, tiempos de vuelta,
 * posición/gaps, combustible y el mini-mapa.
 *
 * Además de los 7 elementos del Requisito 9, se agrega `SessionStatusBar`
 * (bandera, vueltas/tiempo restante, incidentes y clima), a partir de
 * `Evento_Session` (`useSessionStore`), que no formaba parte del alcance
 * original pero ya tenía todos sus datos disponibles sin usar en el
 * store — la bandera en particular es información de seguridad que un
 * piloto necesita ver de un vistazo mientras conduce.
 *
 * **Layout responsive portrait/landscape (Requisito 8.3):** se usa un
 * único CSS Grid (`grid-cols-1` en portrait, `landscape:grid-cols-2` en
 * landscape vía el prefijo de media-query de Tailwind) que reordena las
 * MISMAS regiones sin desmontar ningún componente ni condicionar qué
 * datos se muestran: ambas orientaciones renderizan exactamente el mismo
 * árbol de componentes con las mismas props, solo cambia su disposición
 * visual. Esto es intencional: satisfacer el Requisito 8.3 ("mostrando en
 * ambas el mismo conjunto de datos") es más simple y más difícil de violar
 * por accidente con un único árbol reflowed por CSS que con dos árboles
 * JSX condicionales que podrían divergir entre sí.
 *
 * **Degradación explícita (Requisito 13.1/13.2):** el velocímetro, marcha,
 * tiempos de vuelta y combustible del PROPIO piloto observado dependen
 * únicamente de `Evento_Telemetry` (sin cambios entre 1.0.0/1.1.0, ver
 * Requisito 1.2), así que nunca degradan. `PositionGapPanel` (gap
 * adelante/atrás) usa `computeGaps`, que solo depende de
 * `position`/`gap`, presentes en ambas versiones de `Evento_Standings`
 * (Property 10 de design.md) — tampoco degrada. El `MiniMap` con
 * Rivales_Cercanos SÍ depende de `lap_dist_pct` por piloto (solo en
 * Version_Contrato_1_1): ante un `Evento_Standings` v1.0.0, se muestra
 * igualmente la posición propia (derivada de `Evento_Telemetry`, que
 * siempre trae `lap_dist_pct` del observado) pero sin ningún rival
 * dibujado, en vez de asumir `lap_dist_pct = 0` para los demás pilotos.
 */
export default function Home() {
  const telemetry = useTelemetryStore((s) => s.latestEvent);
  const standings = useStandingsStore((s) => s.latestEvent);
  const track = useTrackStore((s) => s.latestEvent);
  const session = useSessionStore((s) => s.latestEvent);
  const widgets = useLayoutStore((s) => s.widgets);
  const isEditing = useLayoutStore((s) => s.isEditing);
  const setRect = useLayoutStore((s) => s.setRect);

  const fuelHistory = useFuelHistory(telemetry?.fuel_level, telemetry?.last_lap_time);

  const gaps = useMemo(() => {
    if (standings === null || telemetry === null) return null;
    // `computeGaps` solo lee `position`/`gap`/`driver_id`, presentes en
    // ambas versiones de `StandingsEntryV1` (ver PanelClasificacion.tsx
    // del Dashboard para la misma adaptación de tipo).
    const allGaps = computeGaps(standings.drivers as StandingsEntryV1_1[]);
    return allGaps.find((g) => g.driverId === telemetry.driver_id) ?? null;
  }, [standings, telemetry]);

  // `driver_id` del piloto inmediatamente delante/detrás en la
  // clasificación (no un cálculo de `@apex/telemetry-core`: se ordena el
  // MISMO array `standings.drivers` ya usado para `computeGaps` por
  // `position` y se ubica al observado dentro de esa secuencia), para
  // mostrar CONTRA QUIÉN es el Gap_Adelante/Gap_Atras en
  // `PositionGapPanel`, no solo el valor en segundos.
  const { driverAheadId, driverBehindId } = useMemo(() => {
    if (standings === null || telemetry === null) {
      return { driverAheadId: null, driverBehindId: null };
    }
    const sorted = [...standings.drivers].sort((a, b) => a.position - b.position);
    const index = sorted.findIndex((d) => d.driver_id === telemetry.driver_id);
    if (index === -1) return { driverAheadId: null, driverBehindId: null };
    return {
      driverAheadId: sorted[index - 1]?.driver_id ?? null,
      driverBehindId: sorted[index + 1]?.driver_id ?? null,
    };
  }, [standings, telemetry]);

  // Parciales por sector del propio Piloto_Observado (última vuelta
  // completada vs. su propio mejor histórico): reutiliza
  // `compareSectorTimes` con `best_sector_times` como referencia y
  // `last_sector_times` como "rival", sin reimplementar la comparación
  // índice a índice. Solo disponible en Version_Contrato_1_1 (Requisito
  // 13.1): ante un evento v1.0.0 (sin tiempos de sector por piloto) el
  // resultado es `null` y `SectorTimesPanel` muestra "no disponible".
  const ownSectorComparison: SectorComparison[] | null = useMemo(() => {
    if (!isStandingsV1_1(standings) || telemetry === null) return null;
    const observedEntry = standings.drivers.find((d) => d.driver_id === telemetry.driver_id);
    if (!observedEntry) return null;
    return compareSectorTimes(observedEntry.best_sector_times, observedEntry.last_sector_times);
  }, [standings, telemetry]);

  const rivals = useMemo(() => {
    if (!isStandingsV1_1(standings) || telemetry === null) return [];
    return nearestRivals(telemetry.driver_id, standings.drivers, NEAREST_RIVALS_COUNT).map(
      (rival) => ({ driverId: rival.driver_id, lapDistPct: rival.lap_dist_pct }),
    );
  }, [standings, telemetry]);

  if (telemetry === null || track === null) {
    return (
      <main className="flex h-full flex-col items-center justify-center gap-2 p-4">
        <span className="hud-number hud-text-glow text-foreground">Apex Mobile</span>
        <p className="hud-number text-sm text-muted-foreground">
          Esperando conexión con el Generador_Demo…
        </p>
      </main>
    );
  }

  const consumptionPerLap = deriveFuelConsumptionRate(fuelHistory);
  const estimatedRemainingLaps = estimateRemainingLaps(telemetry.fuel_level, consumptionPerLap);

  const gridItems: FreeGridItem[] = (Object.keys(widgets) as WidgetId[])
    .filter((id) => widgets[id].visible)
    .map((id) => ({ id, rect: widgets[id], content: renderWidget(id) }));

  return (
    <main className="flex h-full flex-col gap-2 overflow-y-auto p-2">
      <SessionStatusBar
        flag={session?.flag ?? null}
        weather={session?.weather ?? null}
        timeRemainingS={session?.time_remaining_s ?? null}
        lapsRemaining={session?.laps_remaining ?? null}
        incidents={session?.incidents ?? null}
      />

      {/*
       * Grilla de posicionamiento LIBRE (drag-and-drop + resize, ver
       * `FreeGrid.tsx`): reemplaza el layout anterior de 2 columnas
       * fijas por posiciones/tamaños arbitrarios elegidos por el
       * usuario, persistidos en `useLayoutStore`. `isEditing` (activado
       * desde el panel de Ajustes) muestra las asas de mover/
       * redimensionar; en modo normal la grilla es de solo lectura.
       */}
      <FreeGrid
        items={gridItems}
        columns={GRID_COLUMNS}
        rowHeightPx={GRID_ROW_HEIGHT_PX}
        minW={MIN_WIDGET_W}
        minH={MIN_WIDGET_H}
        isEditing={isEditing}
        onRectChange={(id, rect) => setRect(id as WidgetId, rect)}
      />
    </main>
  );

  /** Renderiza el componente correspondiente a `id`, con los datos ya calculados arriba. */
  function renderWidget(id: WidgetId) {
    switch (id) {
      case "speedometerGear":
        return (
          <div className="flex h-full items-center justify-center gap-4">
            <Speedometer speedKmh={telemetry!.speed} rpm={telemetry!.rpm} />
            <GearIndicator gear={telemetry!.gear} />
          </div>
        );
      case "throttleBrake":
        return <ThrottleBrakePanel throttle={telemetry!.throttle} brake={telemetry!.brake} />;
      case "steeringWheel":
        return (
          <div className="flex h-full items-center justify-center rounded-md border border-border bg-card">
            <SteeringWheel steering={telemetry!.steering} size={64} />
          </div>
        );
      case "lapTimes":
        return (
          <LapTimesPanel
            currentLapTime={telemetry!.current_lap_time}
            bestLapTime={telemetry!.best_lap_time}
            deltaToPrev={telemetry!.delta_to_prev}
            deltaToBest={telemetry!.delta_to_best}
          />
        );
      case "sectorTimes":
        return <SectorTimesPanel sectorComparison={ownSectorComparison} />;
      case "positionGap":
        return (
          <PositionGapPanel
            position={telemetry!.position}
            gapAhead={gaps?.gapAhead ?? null}
            gapBehind={gaps?.gapBehind ?? null}
            driverAheadId={driverAheadId}
            driverBehindId={driverBehindId}
          />
        );
      case "fuel":
        return (
          <FuelPanel
            fuelLevel={telemetry!.fuel_level}
            estimatedRemainingLaps={estimatedRemainingLaps}
          />
        );
      case "tires":
        return <TirePanel tires={telemetry!.tires} />;
      case "miniMap":
        return (
          <MiniMap
            path={track!.path}
            observedLapDistPct={telemetry!.lap_dist_pct}
            rivals={rivals}
          />
        );
    }
  }
}
