/**
 * Estima el número de vueltas restantes disponibles según el nivel de
 * combustible actual y el consumo observado por vuelta, para el
 * Panel_Fuel (Requisito 13.2).
 *
 * - Si `fuelConsumptionPerLap` es exactamente `0`, se devuelve `Infinity`
 *   de forma explícita: no se lanza excepción ni se produce `NaN` por una
 *   división por cero. Se usa comparación exacta (`=== 0`) y no un
 *   epsilon, porque el consumo por vuelta se deriva de diferencias de
 *   `fuel_level` entre muestras de telemetría (ver
 *   `deriveFuelConsumptionRate`), que ya puede producir exactamente `0`
 *   sin ruido de punto flotante cuando no hay consumo registrado (p. ej.
 *   al inicio de una sesión, con una sola muestra, o cuando el piloto está
 *   detenido). Introducir un epsilon añadiría un umbral arbitrario sin un
 *   requisito que lo justifique.
 * - En cualquier otro caso, se devuelve `fuelLevel / fuelConsumptionPerLap`.
 * - `fuelConsumptionPerLap` negativo está fuera del dominio esperado (el
 *   consumo observado nunca debería ser negativo, ya que `fuel_level` se
 *   clampa en 0 en el motor de simulación — ver `applyFuelConsumption`).
 *   Esta función no clampea ni valida ese caso explícitamente: se asume
 *   que el resto del sistema (derivación del consumo a partir del
 *   historial de `fuel_level`) nunca produce un valor negativo. Si se le
 *   pasa un valor negativo de todos modos, el resultado seguirá la
 *   aritmética estándar de división (pudiendo ser negativo), ya que
 *   validar ese caso está fuera del alcance de la Property 13, que solo
 *   cubre `fuelConsumptionPerLap >= 0`.
 *
 * Para cualquier `fuelLevel >= 0` y `fuelConsumptionPerLap >= 0`, el
 * resultado SHALL ser siempre un valor definido mayor o igual a 0 (nunca
 * `NaN`, nunca negativo, nunca lanza una excepción).
 *
 * **Validates: Requirements 13.2**
 */
export function estimateRemainingLaps(
  fuelLevel: number,
  fuelConsumptionPerLap: number
): number {
  if (fuelConsumptionPerLap === 0) {
    return Infinity;
  }
  return fuelLevel / fuelConsumptionPerLap;
}

/**
 * Deriva una tasa de consumo de combustible por vuelta a partir de un
 * historial de valores de `fuel_level` (uno por vuelta, en el orden en que
 * fueron registrados), para alimentar `estimateRemainingLaps` con datos
 * reales del Evento_Telemetry.
 *
 * - Con menos de dos muestras no hay ninguna diferencia observable entre
 *   vueltas, por lo que se devuelve `0` (consumo desconocido / nulo), lo
 *   que a su vez hace que `estimateRemainingLaps` devuelva `Infinity` de
 *   forma consistente en vez de una estimación arbitraria.
 * - En cualquier otro caso, se calcula el consumo promedio por vuelta como
 *   la diferencia total de combustible entre la primera y la última
 *   muestra, dividida entre el número de vueltas transcurridas. El
 *   resultado se clampa a un mínimo de `0`, ya que un aumento de
 *   `fuel_level` (p. ej. tras un repostaje en pits) no representa un
 *   "consumo negativo" para efectos de esta estimación.
 *
 * Es una función pura: no muta `fuelHistory`.
 */
export function deriveFuelConsumptionRate(fuelHistory: number[]): number {
  if (fuelHistory.length < 2) {
    return 0;
  }
  const first = fuelHistory[0]!;
  const last = fuelHistory[fuelHistory.length - 1]!;
  const laps = fuelHistory.length - 1;
  const totalConsumed = first - last;
  return Math.max(0, totalConsumed / laps);
}
