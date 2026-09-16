/**
 * Consumo de combustible del motor de simulación procedural.
 *
 * Ver design.md, sección "Generador_Demo" (`applyFuelConsumption`) y
 * sección "Error Handling" ("Consumo de combustible llega a 0 o por
 * debajo"): `applyFuelConsumption` fija un piso en 0 mediante
 * `Math.max(0, fuelLevel - consumo)`, de modo que nunca se produce un
 * `fuel_level` negativo.
 *
 * Ver también Property 7 ("Combustible no negativo y monótonamente no
 * creciente sin pit stop", Requisito 6.5): para cualquier piloto en pista,
 * entre dos llamadas consecutivas sin una parada en pits de por medio, el
 * `fuelLevel` resultante SHALL ser siempre <= al `fuelLevel` de entrada, y
 * SHALL ser siempre >= 0.
 */

import type { DriverState } from "./state";

/**
 * Duración de referencia de una vuelta, en segundos, usada exclusivamente
 * para convertir `fuelConsumptionPerLap` (consumo por vuelta completa) en
 * una tasa de consumo por milisegundo.
 *
 * Decisión de diseño: el motor no modela la duración real de la vuelta de
 * cada piloto en este punto del pipeline (se deriva en `advanceLap`, tarea
 * 4.3), por lo que se asume una duración base razonable de ~90 segundos
 * por vuelta como referencia de conversión. Esto mantiene
 * `applyFuelConsumption` como una función pura e independiente de
 * `advanceLap`, a costa de que el consumo por unidad de tiempo sea una
 * aproximación (no depende del ritmo real del piloto) en vez de un valor
 * exacto por vuelta. Esta aproximación es suficiente para cumplir el
 * Requisito 6.5 (reducción progresiva de combustible) y la Property 7
 * (monotonicidad no creciente y piso en 0).
 */
const REFERENCE_LAP_DURATION_S = 90;

/**
 * Reduce el nivel de combustible de `driver` proporcionalmente al tiempo
 * transcurrido `dtMs`, usando `fuelConsumptionPerLap` como tasa base de
 * consumo (ver `REFERENCE_LAP_DURATION_S` para la conversión de "consumo
 * por vuelta" a "consumo por milisegundo").
 *
 * Comportamiento en pits: si `driver.inPits === true`, la función NO
 * consume combustible durante este tick. Decisión de diseño: un piloto
 * detenido en boxes no está recorriendo pista, por lo que no tiene sentido
 * seguir descontando combustible por el mero paso del tiempo; además,
 * durante una parada en pits el combustible normalmente se repone (no se
 * modela la reposición aquí, solo se evita el consumo). Esto también
 * garantiza que la Property 7 (monotonicidad no creciente) se cumple de
 * forma trivial mientras el piloto está en pits, ya que `fuelLevel` no
 * cambia.
 *
 * `fuelLevel` SHALL nunca ser negativo: se aplica un piso en 0 mediante
 * `Math.max(0, fuelLevel - consumo)`.
 *
 * Esta función es pura e inmutable: devuelve un nuevo objeto `DriverState`
 * y nunca muta `driver`.
 *
 * @param driver - Estado actual del piloto.
 * @param dtMs - Tiempo transcurrido desde la última actualización, en
 *   milisegundos. Se espera `dtMs >= 0`.
 */
export function applyFuelConsumption(driver: DriverState, dtMs: number): DriverState {
  if (driver.inPits) {
    return { ...driver };
  }

  const consumptionPerMs = driver.fuelConsumptionPerLap / (REFERENCE_LAP_DURATION_S * 1000);
  const consumed = consumptionPerMs * dtMs;

  return {
    ...driver,
    fuelLevel: Math.max(0, driver.fuelLevel - consumed),
  };
}
