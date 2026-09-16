"use client";

import { useMemo } from "react";
import { PanelHeader } from "@/components/hud/PanelHeader";
import { useTrackStore } from "@/lib/store/trackStore";
import { useTelemetryStore } from "@/lib/store/telemetryStore";
import { useStandingsStore } from "@/lib/store/standingsStore";
import { useSelectedDriverStore } from "@/lib/store/selectedDriverStore";
import { getSectorForLapPct } from "@apex/telemetry-core";

/**
 * Paleta cíclica de colores por sector, reutilizando los tokens de color
 * `--chart-N` ya definidos en `app/globals.css` para el tema oscuro neón
 * (Requisito 16.1/16.3), de forma que el Panel_Mapa no introduzca colores
 * ajenos a la paleta del resto del Dashboard.
 */
const SECTOR_COLORS = [
  "var(--chart-1)",
  "var(--chart-2)",
  "var(--chart-3)",
  "var(--chart-4)",
  "var(--chart-5)",
];

function sectorColor(sectorIndex: number): string {
  return SECTOR_COLORS[sectorIndex % SECTOR_COLORS.length];
}

/**
 * Posición proyectada de un piloto no-observado sobre la barra lineal del
 * trazado (el piloto observado se sigue representando por separado, ver
 * más abajo).
 */
interface DriverMapPosition {
  driverId: string;
  position: number;
  lapDistPct: number;
  sectorIndex: number;
}

/**
 * Narrowing por-piloto de un `Evento_Standings` que puede ser 1.0.0 o
 * 1.1.0 (`StandingsEventV1 | StandingsEventV1_1`, ver `standingsStore.ts`):
 * en vez de asumir la versión de todo el evento, se comprueba campo a
 * campo si ESTE piloto concreto porta `lap_dist_pct` como número finito en
 * `[0, 1]`. Esto deja pasar también el caso (excepcional pero válido según
 * el tipo) de un evento 1.1.0 con algún piloto incompleto, degradando por
 * piloto en vez de por evento entero, sin lanzar excepciones.
 */
function hasLapDistPct(
  driver: unknown
): driver is { lap_dist_pct: number } {
  return (
    typeof driver === "object" &&
    driver !== null &&
    "lap_dist_pct" in driver &&
    typeof (driver as { lap_dist_pct: unknown }).lap_dist_pct === "number" &&
    Number.isFinite((driver as { lap_dist_pct: number }).lap_dist_pct)
  );
}

/**
 * Panel_Mapa (Requisito 9): en vez del trazado real del circuito (forma
 * 2D a partir de `Evento_Track.path`), se representa el progreso de
 * vuelta como una barra LINEAL horizontal (0% a 100% de `lap_dist_pct`),
 * segmentada por sector según `start_pct`/`end_pct`. Esta es una decisión
 * de diseño explícita para maximizar la densidad de información del
 * mosaico del Dashboard: la forma real del circuito no aporta
 * información adicional sobre el progreso relativo de los pilotos (que
 * es lo que este panel necesita comunicar), y ocupa mucho más espacio
 * vertical que una barra compacta, forzando scroll en pantallas más
 * bajas. La barra lineal comunica exactamente lo mismo (sector actual,
 * posición relativa de cada piloto) en una fracción del espacio.
 *
 * Todos los pilotos del Evento_Standings (Requisito 6): desde la
 * Version_Contrato_1_1 (`StandingsEntryV1_1`, ver
 * `packages/contrato-datos/src/v1_1/standings.ts`), cada piloto del
 * Evento_Standings porta su propio `lap_dist_pct`, ya no solo el piloto
 * observado a través del Evento_Telemetry. Este componente posiciona
 * sobre la barra CADA piloto que traiga dicho campo (Requisito 6.1) y la
 * actualiza al recibir un nuevo Evento_Standings (Requisito 6.2). Ante un
 * Evento_Standings 1.0.0 (sin `lap_dist_pct`), o ante pilotos individuales
 * sin ese campo, dichos pilotos simplemente no se grafican (no se asume
 * un valor por defecto ni se lanza una excepción) — el marcador del
 * piloto observado (derivado de `useTelemetryStore`, que siempre porta
 * `lap_dist_pct`) sigue funcionando con normalidad.
 *
 * Referencia de piloto por sección + filtro cruzado entre paneles: cada
 * marcador sobre la barra muestra su posición (`P{n}`) como etiqueta
 * visible, no solo como `title` al pasar el mouse, para poder identificar
 * de un vistazo qué piloto está en cada tramo del trazado. Además, cada
 * marcador es clickeable y alterna la selección de ese piloto en
 * `useSelectedDriverStore`, un store compartido con `Panel_Clasificacion`
 * (cuyas filas también son clickeables con el mismo store) y consumido
 * por `Panel_Telemetria` para adoptar automáticamente al piloto
 * seleccionado como rival de la Comparativa_Sectores.
 */
export default function PanelMapa() {
  const trackEvent = useTrackStore((s) => s.latestEvent);
  const telemetryEvent = useTelemetryStore((s) => s.latestEvent);
  const standingsEvent = useStandingsStore((s) => s.latestEvent);
  const selectedDriverId = useSelectedDriverStore((s) => s.selectedDriverId);
  const toggleDriver = useSelectedDriverStore((s) => s.toggleDriver);

  const sortedSectors = useMemo(() => {
    if (!trackEvent) return [];
    return [...trackEvent.sectors].sort((a, b) => a.start_pct - b.start_pct);
  }, [trackEvent]);

  const observedSectorIndex = useMemo(() => {
    if (!trackEvent || !telemetryEvent) return null;
    return getSectorForLapPct(trackEvent.sectors, telemetryEvent.lap_dist_pct);
  }, [trackEvent, telemetryEvent]);

  // Posiciones de todos los pilotos del Evento_Standings que porten
  // `lap_dist_pct` (Requisito 6.1). El piloto observado se excluye de
  // esta lista (aunque también aparezca en `Evento_Standings`) porque ya
  // se dibuja por separado como marcador destacado, evitando dibujarlo
  // dos veces.
  const allDriverPositions: DriverMapPosition[] = useMemo(() => {
    if (!trackEvent || !standingsEvent) return [];
    return standingsEvent.drivers
      .filter((driver) => driver.driver_id !== telemetryEvent?.driver_id)
      .map((driver) => {
        if (!hasLapDistPct(driver)) return null;
        return {
          driverId: driver.driver_id,
          position: driver.position,
          lapDistPct: driver.lap_dist_pct,
          sectorIndex: getSectorForLapPct(trackEvent.sectors, driver.lap_dist_pct),
        };
      })
      .filter((entry): entry is DriverMapPosition => entry !== null);
  }, [trackEvent, standingsEvent, telemetryEvent?.driver_id]);

  if (!trackEvent) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-2 p-6 text-center text-muted-foreground">
        <span className="hud-number text-lg tracking-wide text-foreground">
          Esperando Evento_Track…
        </span>
        <span className="text-sm">
          El Panel_Mapa se completará al recibir la geometría del circuito.
        </span>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col gap-2 p-2">
      <PanelHeader
        className="px-2 pt-1"
        title={trackEvent.track_name}
        meta={`${(trackEvent.length_m / 1000).toFixed(3)} km`}
      />

      {/*
       * Barra lineal del trazado: cada segmento representa un sector,
       * con ancho proporcional a `end_pct - start_pct` (no a la cantidad
       * de puntos del `path`, que ya no se usa para este panel). El
       * sector en el que se encuentra el piloto observado se resalta con
       * opacidad plena y un resplandor; el resto queda atenuado.
       */}
      <div
        className="relative h-12 w-full shrink-0 overflow-hidden rounded-md border border-border bg-card"
        role="img"
        aria-label={`Progreso de vuelta sobre ${trackEvent.track_name}, sector actual ${
          observedSectorIndex !== null ? observedSectorIndex + 1 : "desconocido"
        }`}
      >
        <div className="absolute inset-0 flex">
          {sortedSectors.map((sector) => {
            const isCurrentSector = observedSectorIndex === sector.index;
            return (
              <div
                key={sector.index}
                className="h-full border-r border-background/40 last:border-r-0"
                style={{
                  flexGrow: Math.max(sector.end_pct - sector.start_pct, 0.001),
                  flexBasis: 0,
                  backgroundColor: sectorColor(sector.index),
                  opacity: isCurrentSector ? 0.9 : 0.3,
                  boxShadow: isCurrentSector
                    ? `inset 0 0 12px 2px ${sectorColor(sector.index)}`
                    : undefined,
                }}
              />
            );
          })}
        </div>

        {/*
         * Marcadores del resto de pilotos (Requisito 6.1/6.2): puntos
         * pequeños posicionados por `lapDistPct * 100%` a lo largo de la
         * barra, alternando una leve compensación vertical (índice par/
         * impar) para reducir la superposición visual cuando varios
         * pilotos están muy cerca entre sí en progreso de vuelta.
         *
         * Cada marcador porta además una etiqueta visible con la
         * posición del piloto (referencia directa de "quién está en cada
         * sección de la pista", sin depender de un `title`/tooltip que
         * requeriría pasar el mouse por encima) y es clickeable: al
         * hacer click se alterna su selección en `useSelectedDriverStore`
         * (compartido con `Panel_Clasificacion` y con el selector de
         * rival de `Panel_Telemetria`), resaltándolo aquí y en esos otros
         * paneles simultáneamente.
         */}
        {allDriverPositions.map((driver, i) => {
          const isSelected = selectedDriverId === driver.driverId;
          return (
            <button
              key={driver.driverId}
              type="button"
              onClick={() => toggleDriver(driver.driverId)}
              className="absolute flex -translate-x-1/2 flex-col items-center gap-0.5 focus-visible:outline-none"
              style={{
                left: `${driver.lapDistPct * 100}%`,
                top: i % 2 === 0 ? "14%" : "54%",
              }}
              title={`P${driver.position} · ${driver.driverId} — click para filtrar`}
              aria-pressed={isSelected}
            >
              <span
                className="hud-number rounded-sm px-0.5 text-[9px] leading-none text-background"
                style={{
                  backgroundColor: sectorColor(driver.sectorIndex),
                  opacity: isSelected ? 1 : 0.85,
                }}
              >
                P{driver.position}
              </span>
              <span
                className="block size-2 rounded-full border"
                style={{
                  backgroundColor: sectorColor(driver.sectorIndex),
                  borderColor: isSelected ? "var(--foreground)" : "var(--background)",
                  boxShadow: isSelected
                    ? `0 0 6px 2px ${sectorColor(driver.sectorIndex)}`
                    : undefined,
                }}
              />
            </button>
          );
        })}

        {/* Marcador destacado del piloto observado. */}
        {telemetryEvent && observedSectorIndex !== null && (
          <div
            className="absolute top-1/2 -translate-x-1/2 -translate-y-1/2"
            style={{ left: `${telemetryEvent.lap_dist_pct * 100}%` }}
            title={`Observado · P${telemetryEvent.position}`}
          >
            <span
              className="block size-4 rounded-full border-2 border-foreground"
              style={{
                backgroundColor: sectorColor(observedSectorIndex),
                boxShadow: `0 0 8px 2px ${sectorColor(observedSectorIndex)}`,
              }}
            />
          </div>
        )}
      </div>

      {/*
       * Leyenda de sectores como franja HUD compacta: una sola fila
       * densa con divisores verticales entre sectores, sin saltos de
       * línea.
       */}
      <div className="hud-number flex items-center gap-3 overflow-x-auto rounded-md border border-border bg-card px-3 py-1.5 text-xs">
        {sortedSectors.map((sector) => {
          const isCurrentSector = observedSectorIndex === sector.index;
          return (
            <span
              key={sector.index}
              className={`flex items-center gap-1.5 border-l border-border pl-3 first:border-l-0 first:pl-0 ${
                isCurrentSector ? "text-foreground" : "text-muted-foreground"
              }`}
            >
              <span
                className="inline-block h-2 w-2 rounded-full"
                style={{
                  backgroundColor: sectorColor(sector.index),
                  boxShadow: isCurrentSector
                    ? `0 0 6px 1px ${sectorColor(sector.index)}`
                    : undefined,
                }}
              />
              S{sector.index + 1}
            </span>
          );
        })}

        {telemetryEvent && observedSectorIndex !== null && (
          <span className="ml-auto flex items-center gap-1.5 border-l border-border pl-3 text-foreground">
            {telemetryEvent.driver_id} · SEC {observedSectorIndex + 1} · P
            {telemetryEvent.position}
          </span>
        )}
      </div>
    </div>
  );
}
