/**
 * Detección de cambios en el estado global de la sesión.
 *
 * El "estado global de la sesión" (Requisito 3.1) está compuesto por:
 * tipo de sesión, clima, bandera actual, tiempo/vueltas restantes e
 * incidentes. Esta función se usa (tarea 4.15, `SimulationEngine.tick()`)
 * para decidir si corresponde emitir un nuevo `Evento_Session` en un tick
 * dado, según el Requisito 3.3: solo debe emitirse cuando alguno de esos
 * campos cambió respecto al tick anterior.
 *
 * Explícitamente NO forman parte de esta comparación otros campos de
 * `SessionState` como las posiciones de los pilotos, `lapDistPct`,
 * combustible, etc. — esos se reflejan en `Evento_Telemetry` /
 * `Evento_Standings`, no en `Evento_Session`.
 */

import type { SessionState } from "./state";

/**
 * Determina si el estado global de la sesión cambió entre dos snapshots.
 *
 * Compara únicamente los campos relevantes al estado global de la sesión
 * según el Requisito 3.1: `sessionType`, `weather.condition`, `flag`,
 * `timeRemainingS` e `incidents`. No muta ni lee ningún otro campo de
 * `previous` ni de `current`, y no produce efectos secundarios.
 *
 * @param previous - Snapshot del estado de la sesión en el tick anterior.
 * @param current - Snapshot del estado de la sesión en el tick actual.
 * @returns `true` si alguno de los campos relevantes difiere entre
 *   `previous` y `current`; `false` si ninguno cambió.
 */
export function hasSessionStateChanged(
  previous: SessionState,
  current: SessionState,
): boolean {
  return (
    previous.sessionType !== current.sessionType ||
    previous.weather.condition !== current.weather.condition ||
    previous.flag !== current.flag ||
    previous.timeRemainingS !== current.timeRemainingS ||
    previous.incidents !== current.incidents
  );
}
