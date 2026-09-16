import type { RawTelemetrySnapshot } from "../sdk/types";
import type { StandingsEventV1_1, StandingsEntryV1_1 } from "@apex/contrato-datos";

/**
 * Construye el `Evento_Standings` (Version_Contrato_1_1) a partir de los
 * arrays `CarIdx*` de la SDK, uno por cada auto en la sesión (incluyendo
 * al piloto local, en su propio índice `CarIdx`).
 *
 * **Limitaciones conocidas** (documentadas también en el README del
 * bridge):
 * - `class_id`: la SDK no expone la clase de cada auto directamente en
 *   telemetría plana (solo en `DriverInfo.Drivers[].CarClassID` de la
 *   SessionInfo, no leído por este mapper para mantenerlo simple); se
 *   fija `"class-0"` para todos los autos. Multi-clase no está soportado
 *   por este bridge en su primera versión.
 * - `gap`: la SDK no expone un "gap al líder" directo por auto; se usa
 *   `CarIdxF2Time` (tiempo estimado al auto que va justo delante,
 *   "F2Time" = "Following 2 time" en la nomenclatura de la SDK) como
 *   aproximación. No es exactamente lo mismo que un gap-al-líder
 *   acumulado, pero es la única señal de gap en vivo por-auto que la SDK
 *   expone en telemetría estándar.
 * - `last_sector_times`/`best_sector_times`: la SDK no expone tiempos de
 *   sector POR AUTO en telemetría estándar (solo del piloto local, vía
 *   `SplitTimeInfo`, y ni siquiera eso en tiempo real por sector
 *   completado). Se devuelven como arrays de un único elemento `null`
 *   (longitud 1, sin sectores reales) para todos los autos: cualquier
 *   panel que dependa de esto (Comparativa_Sectores, parciales propios)
 *   mostrará "no disponible", el mismo comportamiento de degradación
 *   explícita ya implementado para `Evento_Standings` v1.0.0 (Requisito
 *   13.1 de la especificación `apex-mobile-and-dashboard-expansion`).
 * - `off_track`: se deriva de `CarIdxTrackSurface === -1` (fuera del
 *   mundo/sin datos) o `=== 0` (`OffTrack`, ver
 *   `TrackLocation`/`irsdk_TrkSurf` en `@irsdk-node/types`).
 */
export function mapStandingsEvent(
  raw: RawTelemetrySnapshot,
  carCount: number,
  timestamp: number,
): StandingsEventV1_1 {
  const drivers: StandingsEntryV1_1[] = [];

  for (let carIdx = 0; carIdx < carCount; carIdx++) {
    const position = raw.CarIdxPosition.value[carIdx] ?? 0;
    // Posición 0 significa "auto sin clasificar/no en sesión" (pit box
    // vacío, spectator, etc. — ver `CarIdxPosition` en la documentación
    // de la SDK): se excluye del Evento_Standings en vez de incluirlo
    // con una posición inválida.
    if (position <= 0) continue;

    const trackSurface = raw.CarIdxTrackSurface.value[carIdx] ?? -1;

    drivers.push({
      driver_id: `car-${carIdx}`,
      position,
      class_id: "class-0",
      gap: raw.CarIdxF2Time.value[carIdx] ?? 0,
      last_lap_time: normalizeLapTime(raw.CarIdxLastLapTime.value[carIdx]),
      best_lap_time: normalizeLapTime(raw.CarIdxBestLapTime.value[carIdx]),
      in_pits: raw.CarIdxOnPitRoad.value[carIdx] ?? false,
      off_track: trackSurface === -1 || trackSurface === 0,
      lap_dist_pct: raw.CarIdxLapDistPct.value[carIdx] ?? 0,
      fuel_level: 0, // La SDK no expone fuel_level por auto rival, solo del piloto local.
      last_sector_times: [null],
      best_sector_times: [null],
    });
  }

  return {
    version_contrato: "1.1.0",
    timestamp,
    type: "standings",
    drivers,
  };
}

function normalizeLapTime(value: number | undefined): number | null {
  if (value === undefined || value < 0) return null;
  return value;
}
