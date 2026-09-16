/**
 * Recómputo de posiciones de clasificación entre pilotos (Requisito 6.3).
 *
 * `recomputePositions` es una función pura que, dado el conjunto de
 * pilotos de la sesión, reordena sus posiciones (`DriverState.position`)
 * según su progreso relativo de carrera.
 *
 * Ver design.md, sección "Motor de simulación (`src/simulation/`)"
 * (`recomputePositions`) y "Property 8: Unicidad y rango de posiciones en
 * Evento_Standings" (Requisito 2.1).
 *
 * Limitación de diseño documentada: `DriverState` (tarea 4.2, `state.ts`)
 * no lleva un contador de vueltas completadas de forma independiente de
 * `lapDistPct` (que se resetea a un valor en [0, 1) en cada cruce de
 * línea de meta, ver `advanceLap`). Por lo tanto, en esta fase, el
 * progreso total de carrera no puede reconstruirse combinando "vueltas
 * completadas" + "progreso en la vuelta actual": se usa únicamente
 * `lapDistPct` descendente como proxy simplificado del progreso dentro de
 * la sesión. Esto es una simplificación demo válida mientras todos los
 * pilotos permanezcan en una ventana de vueltas similar (no hay
 * "vueltas de diferencia" modeladas); un modelo más completo añadiría un
 * campo `lapsCompleted` a `DriverState` y ordenaría primero por ese
 * campo y luego por `lapDistPct` dentro de la misma vuelta.
 */

import type { DriverState } from "./state";

/**
 * Recalcula la posición de cada piloto según su progreso de carrera.
 *
 * Ordena `drivers` por `lapDistPct` descendente (mayor progreso primero)
 * y reasigna `position` de forma consecutiva a partir de 1, de modo que
 * el conjunto resultante de valores de `position` es exactamente
 * {1, ..., N} para N pilotos, sin duplicados ni huecos (Property 8).
 *
 * Es una función pura e inmutable: no muta `drivers` ni ninguno de sus
 * elementos; devuelve un nuevo array con nuevas instancias de
 * `DriverState` para los pilotos cuya posición cambió (y copias
 * superficiales para el resto, manteniendo la inmutabilidad del
 * contrato).
 *
 * Llamar a esta función en cada tick del motor de simulación produce de
 * forma natural cambios de posición entre pilotos a lo largo de la
 * sesión, conforme cada piloto avanza a un ritmo distinto (Requisito
 * 6.3).
 *
 * @param drivers - Estado actual de todos los pilotos de la sesión.
 * @returns Un nuevo array de `DriverState`, en el mismo orden que
 *   `drivers` (no en el orden de clasificación), con `position`
 *   actualizada para cada piloto.
 */
export function recomputePositions(drivers: DriverState[]): DriverState[] {
  const rankedIds = [...drivers]
    .sort((a, b) => b.lapDistPct - a.lapDistPct)
    .map((driver) => driver.driverId);

  const positionByDriverId = new Map<string, number>();
  rankedIds.forEach((driverId, index) => {
    positionByDriverId.set(driverId, index + 1);
  });

  return drivers.map((driver) => ({
    ...driver,
    position: positionByDriverId.get(driver.driverId) ?? driver.position,
  }));
}
