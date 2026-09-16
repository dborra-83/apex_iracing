import type { RawSessionInfo } from "../sdk/types";
import type { TrackEventV1, TrackPointV1, SectorV1 } from "@apex/contrato-datos";

/**
 * Construye el `Evento_Track` a partir de la `SessionInfo` (YAML) de
 * iRacing.
 *
 * **Limitación conocida más importante de todo el bridge** (documentada
 * también en el README): la SDK de iRacing NO expone las coordenadas
 * reales del trazado del circuito en ningún lugar de la telemetría ni de
 * la SessionInfo — el `path` que consume `MiniMap`/`Panel_Mapa` en
 * ambas apps (un polígono de puntos x/y) es un dato que el Generador_Demo
 * INVENTA proceduralmente (`createTrackDef`, un óvalo), no algo que
 * exista en ningún circuito real de iRacing disponible vía SDK.
 *
 * Sin acceso a un archivo de mapas reales por circuito (fuera del
 * alcance de este bridge: requeriría digitalizar manualmente las
 * coordenadas de cada trazado, o usar datos de posición GPS acumulados a
 * lo largo de una vuelta de referencia, ninguno de los cuales está
 * implementado aquí), este mapper genera el MISMO tipo de óvalo
 * placeholder que usa el Generador_Demo, escalado según `length_m` real
 * (`WeekendInfo.TrackLength`) para que al menos el perímetro visual sea
 * proporcional al circuito real, aunque su FORMA no lo sea. El
 * `MiniMap` seguirá funcionando (posición propia + rivales sobre
 * `lap_dist_pct`, que sí es dato real), pero mostrando un óvalo
 * genérico en vez de la silueta real del circuito.
 *
 * Los sectores (`sectors`) sí usan datos reales de
 * `SplitTimeInfo.Sectors` cuando la sesión los tiene configurados
 * (`SectorStartPct` por sector); si no hay ninguno, se cae a un único
 * sector que cubre toda la vuelta (`[0, 1]`), en vez de asumir siempre 3
 * sectores como hace el Generador_Demo.
 */
export function mapTrackEvent(sessionInfo: RawSessionInfo, timestamp: number): TrackEventV1 {
  const trackName = sessionInfo.WeekendInfo?.TrackDisplayName ?? "iRacing Track";
  const lengthM = parseTrackLengthKm(sessionInfo.WeekendInfo?.TrackLength) * 1000;

  return {
    version_contrato: "1.1.0",
    timestamp,
    type: "track",
    track_name: trackName,
    length_m: lengthM > 0 ? lengthM : 4000,
    path: buildPlaceholderOvalPath(),
    sectors: buildSectors(sessionInfo),
  };
}

/** `TrackLength` viene como texto, p. ej. `"3.70 km"`; se extrae el número, o `0` si no se puede parsear. */
function parseTrackLengthKm(raw: string | undefined): number {
  if (raw === undefined) return 0;
  const match = /^([\d.]+)/.exec(raw.trim());
  return match ? Number(match[1]) : 0;
}

/**
 * Mismo óvalo procedural que `apps/generador-demo/src/simulation/state.ts`
 * (`createTrackDef`), reutilizado aquí como placeholder documentado (ver
 * docstring de `mapTrackEvent`) en vez de reimplementarlo con una forma
 * distinta.
 */
function buildPlaceholderOvalPath(): TrackPointV1[] {
  const pointCount = 40;
  const radiusX = 500;
  const radiusY = 250;
  const path: TrackPointV1[] = [];
  for (let i = 0; i < pointCount; i++) {
    const angle = (i / pointCount) * Math.PI * 2;
    path.push({ x: radiusX * Math.cos(angle), y: radiusY * Math.sin(angle) });
  }
  return path;
}

function buildSectors(sessionInfo: RawSessionInfo): SectorV1[] {
  const rawSectors = sessionInfo.SplitTimeInfo?.Sectors;
  if (!rawSectors || rawSectors.length === 0) {
    return [{ index: 0, start_pct: 0, end_pct: 1 }];
  }

  const startPcts = rawSectors
    .map((s) => s.SectorStartPct ?? 0)
    .sort((a, b) => a - b);

  return startPcts.map((startPct, index) => ({
    index,
    start_pct: startPct,
    end_pct: startPcts[index + 1] ?? 1,
  }));
}
