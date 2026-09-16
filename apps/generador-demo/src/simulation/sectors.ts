/**
 * Registro de finalización de sectores para un piloto simulado
 * (Requisitos 2.3, 2.4, 2.5).
 *
 * `recordSectorCompletion` detecta, tick a tick, la transición de un
 * sector al siguiente comparando el sector correspondiente al
 * `lapDistPct` ANTES de `advanceLap` (recibido explícitamente como
 * `previousLapDistPct`) contra el sector correspondiente al `lapDistPct`
 * DESPUÉS de `advanceLap` (ya presente en `driver.lapDistPct`, puesto que
 * esta función SHALL invocarse después de `advanceLap` en el pipeline del
 * tick, ver `engine.ts`). Reutiliza `getSectorForLapPct` de
 * `@apex/telemetry-core` para ambas determinaciones, evitando duplicar la
 * lógica de sectorización ya centralizada en ese paquete.
 *
 * Ver design.md, sección "Migración del Generador_Demo"
 * (`recordSectorCompletion`) y "Property 2: Longitud fija y consistente
 * de sector_times" / "Property 3: best_sector_times es siempre el mínimo
 * histórico por sector".
 *
 * Nota de diseño (desviación respecto al pseudocódigo de design.md): el
 * pseudocódigo describe la firma como `recordSectorCompletion(driver,
 * sectorsDef, dtMs)` y hace referencia a `driver.lapDistPct` (antes) y a
 * un campo `driver.lapDistPctDespuesDeAdvance` (después) como si ambos
 * coexistieran en el mismo objeto. `DriverState` (`state.ts`) solo modela
 * un único campo `lapDistPct`, que en el momento de invocar esta función
 * ya contiene el valor POSTERIOR a `advanceLap` (por la propia ubicación
 * de esta función en el pipeline del tick). Por lo tanto esta
 * implementación recibe explícitamente `previousLapDistPct` como
 * parámetro adicional en vez de inventar un segundo campo en
 * `DriverState`, preservando el resto de la semántica del pseudocódigo
 * (detección de transición de sector, cálculo de `sectorTime` y
 * actualización de `bestSectorTimes`) sin cambios.
 *
 * Nota de diseño adicional (cruce de línea de meta): cuando la
 * transición de sector coincide con el cruce de línea de meta (el último
 * sector conecta con el primero), `advanceLap` ya reseteó
 * `driver.currentLapTime` a 0 y fijó `driver.lastLapTime` con la
 * duración de la vuelta recién completada. En ese caso, la duración del
 * sector recién completado (el último de la vuelta anterior) se calcula
 * como `driver.lastLapTime - driver.currentSectorStartLapTime` (ambos
 * valores medidos sobre el mismo reloj de vuelta, el de la vuelta que
 * acaba de terminar), en vez de `driver.currentLapTime -
 * driver.currentSectorStartLapTime` (que daría un resultado negativo, ya
 * que `currentLapTime` fue reseteado a 0). Esta distinción no está
 * explícita en el pseudocódigo de design.md pero es necesaria para que
 * `sectorTime` sea siempre `>= 0`, tal como exige
 * `SectorTimesV1_1Schema` (`z.number().nonnegative()`).
 */

import { getSectorForLapPct } from "@apex/telemetry-core";
import type { DriverState, SectorDef } from "./state";

/**
 * Registra la finalización de un sector para `driver`, si el tick actual
 * (representado implícitamente por el cambio de `previousLapDistPct` al
 * `driver.lapDistPct` actual, ya avanzado por `advanceLap`) produjo una
 * transición de sector.
 *
 * Si `driver.lapDistPct` (post-`advanceLap`) cae en un sector distinto al
 * de `previousLapDistPct` (pre-`advanceLap`):
 * - Calcula `sectorTime`, la duración del sector recién completado (el
 *   sector de `previousLapDistPct`), como la diferencia entre el reloj de
 *   vuelta actual y `driver.currentSectorStartLapTime` (ver nota de
 *   diseño del módulo sobre el caso de cruce de línea de meta).
 * - Actualiza `lastSectorTimes[previousSector]` con `sectorTime`.
 * - Actualiza `bestSectorTimes[previousSector]` con `sectorTime` si no
 *   había un mejor tiempo previo para ese sector, o si `sectorTime` es
 *   menor que el mejor tiempo previo (Requisito 2.4).
 * - Actualiza `currentSectorIndex` al nuevo sector y
 *   `currentSectorStartLapTime` al reloj de vuelta actual (el instante en
 *   que el piloto entra al nuevo sector).
 *
 * Si no hay transición de sector, devuelve una copia superficial de
 * `driver` sin cambios, manteniendo la inmutabilidad del contrato de la
 * función (no muta `driver`).
 *
 * Esta función asume, como el resto del pipeline del tick, que como
 * máximo ocurre una transición de sector por tick (consistente con el
 * pseudocódigo de design.md, que solo contempla un único `IF`, no un
 * bucle sobre transiciones múltiples). En la práctica esto se cumple
 * mientras `dtMs` sea pequeño respecto a la duración de un sector.
 *
 * @param driver - Estado del piloto YA avanzado por `advanceLap` en este
 *   tick (`driver.lapDistPct` es el valor posterior al avance).
 * @param sectors - Definición de sectores del `TrackDef` de la sesión.
 * @param previousLapDistPct - Valor de `lapDistPct` del piloto ANTES de
 *   `advanceLap` en este mismo tick.
 * @returns Un nuevo `DriverState` con los campos de sector actualizados
 *   (o una copia sin cambios si no hubo transición de sector).
 */
export function recordSectorCompletion(
  driver: DriverState,
  sectors: SectorDef[],
  previousLapDistPct: number,
): DriverState {
  const previousSector = getSectorForLapPct(sectors, previousLapDistPct);
  const newSector = getSectorForLapPct(sectors, driver.lapDistPct);

  if (newSector === previousSector) {
    return { ...driver };
  }

  // Cruce de línea de meta: `advanceLap` ya reseteó `currentLapTime` a 0
  // y fijó `lastLapTime` con la duración de la vuelta recién completada.
  const lapJustCompleted = driver.currentLapTime === 0 && driver.lastLapTime !== null;

  const lapClockNow = lapJustCompleted ? driver.lastLapTime! : driver.currentLapTime;
  const sectorTime = lapClockNow - driver.currentSectorStartLapTime;

  const newLastSectorTimes = [...driver.lastSectorTimes];
  newLastSectorTimes[previousSector] = sectorTime;

  const newBestSectorTimes = [...driver.bestSectorTimes];
  const previousBest = newBestSectorTimes[previousSector];
  if (previousBest === null || previousBest === undefined || sectorTime < previousBest) {
    newBestSectorTimes[previousSector] = sectorTime;
  }

  return {
    ...driver,
    lastSectorTimes: newLastSectorTimes,
    bestSectorTimes: newBestSectorTimes,
    currentSectorIndex: newSector,
    currentSectorStartLapTime: lapJustCompleted ? 0 : driver.currentLapTime,
  };
}
