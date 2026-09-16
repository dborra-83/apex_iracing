/**
 * Avance de vuelta de un piloto simulado.
 *
 * Implementa `advanceLap`, la función pura que hace progresar
 * `lapDistPct` de un `DriverState` de forma continua en función del
 * tiempo transcurrido (`dtMs`) y del `baseSpeedFactor` propio del piloto,
 * y que detecta y contabiliza el cruce de línea de meta (fin de vuelta).
 *
 * Ver design.md, sección "Motor de simulación (`src/simulation/`)" y
 * "Property 6: Avance continuo y acotado de lap_dist_pct".
 */

import type { DriverState } from "./state";

/**
 * Duración de referencia de una vuelta "base" (factor de velocidad 1.0),
 * en segundos. Es un valor interno del motor de simulación demo, no
 * proviene de ningún dato real de la pista; solo sirve para dar una
 * cadencia plausible al avance de `lapDistPct`. Un `baseSpeedFactor` mayor
 * que 1 hace que el piloto complete la vuelta en menos tiempo que este
 * valor de referencia, y uno menor que 1 la completa en más tiempo.
 */
const BASE_LAP_DURATION_S = 90;

/**
 * Avanza el progreso de vuelta (`lapDistPct`) de `driver` según el tiempo
 * transcurrido `dtMs`, sin mutar el objeto recibido.
 *
 * Decisión de diseño: esta función NO trata de forma especial el caso
 * `driver.inPits === true` (p. ej. no ralentiza ni congela el progreso
 * cuando el piloto está en pits). Modelar el efecto de una parada en pits
 * sobre el avance de vuelta es responsabilidad de `maybeTriggerPitStop`
 * (tarea 4.7); `advanceLap` se limita a la mecánica de avance continuo y
 * cruce de línea de meta descrita en el Requisito 6.2 y la Property 6.
 *
 * Reglas:
 * - Si el progreso acumulado en este tick no llega a completar la vuelta
 *   (`lapDistPct` resultante < 1), `currentLapTime` se incrementa en
 *   `dtMs / 1000` segundos y `lapDistPct` avanza sin dar la vuelta.
 * - Si el progreso acumulado completa una o más vueltas (`dtMs` grande),
 *   el `lapDistPct` resultante se normaliza siempre al rango [0, 1)
 *   mediante módulo 1, `lastLapTime` se fija al tiempo total de vuelta
 *   acumulado (`currentLapTime + dtMs/1000`), `bestLapTime` se actualiza
 *   al mínimo entre el valor previo (o `lastLapTime` si aún no había
 *   ninguno) y el nuevo `lastLapTime`, `currentLapTime` se resetea a 0, y
 *   `delta_to_best` se recalcula como `lastLapTime - bestLapTime`.
 *   `delta_to_prev` no se calcula aquí (depende de otros pilotos; es
 *   responsabilidad de la lógica de standings/posiciones) y se deja en
 *   `null`.
 * - En todo caso, el `lapDistPct` devuelto SHALL estar siempre en el
 *   rango [0, 1): nunca exactamente 1 ni fuera de rango, incluso si
 *   `dtMs` es lo bastante grande como para completar más de una vuelta
 *   en un único tick.
 *
 * @param driver - Estado actual del piloto (no se muta).
 * @param dtMs - Milisegundos transcurridos desde el último tick.
 * @returns Un nuevo `DriverState` con los campos de progreso de vuelta
 *   actualizados.
 */
export function advanceLap(driver: DriverState, dtMs: number): DriverState {
  const dtSec = dtMs / 1000;
  const progress = (dtSec * driver.baseSpeedFactor) / BASE_LAP_DURATION_S;
  const rawLapDistPct = driver.lapDistPct + progress;

  if (rawLapDistPct < 1) {
    return {
      ...driver,
      lapDistPct: rawLapDistPct,
      currentLapTime: driver.currentLapTime + dtSec,
    };
  }

  // Se completó al menos una vuelta en este tick. `% 1` garantiza que el
  // resultado quede en [0, 1) incluso si `rawLapDistPct` cubre más de una
  // vuelta completa (dtMs grande).
  const newLapDistPct = rawLapDistPct % 1;
  const newLastLapTime = driver.currentLapTime + dtSec;
  const newBestLapTime =
    driver.bestLapTime === null ? newLastLapTime : Math.min(driver.bestLapTime, newLastLapTime);

  return {
    ...driver,
    lapDistPct: newLapDistPct,
    currentLapTime: 0,
    lastLapTime: newLastLapTime,
    bestLapTime: newBestLapTime,
    delta_to_best: newLastLapTime - newBestLapTime,
    delta_to_prev: null,
  };
}
