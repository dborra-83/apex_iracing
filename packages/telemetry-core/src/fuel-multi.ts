import { estimateRemainingLaps, deriveFuelConsumptionRate } from "./fuel";

/**
 * Estimación de stint/combustible para un piloto individual, producida por
 * `estimateStintForAllDrivers` (Panel_Fuel multi-piloto, Requisito 5).
 */
export interface DriverStintEstimate {
  driverId: string;
  /** Igual semántica que estimateRemainingLaps (v1.0.0): puede ser Infinity. */
  estimatedRemainingLaps: number;
  /**
   * Vuelta relativa (0 = vuelta actual, 1 = próxima, ...) en la que se
   * estima que el piloto deba entrar a pits. Null si
   * estimatedRemainingLaps es Infinity.
   */
  estimatedPitInLapsFromNow: number | null;
}

/**
 * Generaliza `estimateRemainingLaps`/`deriveFuelConsumptionRate` (v1.0.0,
 * ya movidas a este paquete en la tarea 1.1) a N pilotos simultáneos, para
 * alimentar el Stint_Planning_Multi_Piloto de Panel_Fuel (Requisito 5).
 *
 * - Para cada `driverId` presente en `currentFuelLevels` (el dominio de
 *   ambos mapas es idéntico por precondición del diseño), se calcula
 *   `estimatedRemainingLaps` reutilizando exactamente
 *   `estimateRemainingLaps(fuelLevel, deriveFuelConsumptionRate(history))`,
 *   sin alterar el comportamiento de ninguna de las dos funciones.
 * - El historial de combustible del piloto se toma de
 *   `driversFuelHistory.get(driverId) ?? []` (un historial ausente se trata
 *   como vacío, lo que hace que `deriveFuelConsumptionRate` devuelva `0` y
 *   por tanto `estimateRemainingLaps` devuelva `Infinity`, de forma
 *   consistente con el caso de "menos de dos muestras").
 * - `estimatedPitInLapsFromNow` es `null` si y solo si
 *   `estimatedRemainingLaps === Infinity`; en cualquier otro caso es
 *   exactamente `Math.floor(estimatedRemainingLaps)`.
 * - Función pura: no muta `driversFuelHistory` ni `currentFuelLevels`.
 * - Cada piloto se resuelve de forma independiente: no hay estado
 *   compartido entre iteraciones (ningún acumulador ni referencia mutable
 *   se transporta de un piloto al siguiente).
 *
 * **Validates: Requirements 5.1, 5.2, 5.3, 5.4**
 */
export function estimateStintForAllDrivers(
  driversFuelHistory: Map<string, number[]>,
  currentFuelLevels: Map<string, number>
): DriverStintEstimate[] {
  const results: DriverStintEstimate[] = [];

  for (const [driverId, fuelLevel] of currentFuelLevels) {
    const history = driversFuelHistory.get(driverId) ?? [];
    const consumptionRate = deriveFuelConsumptionRate(history);
    const estimatedRemainingLaps = estimateRemainingLaps(fuelLevel, consumptionRate);
    const estimatedPitInLapsFromNow =
      estimatedRemainingLaps === Infinity ? null : Math.floor(estimatedRemainingLaps);

    results.push({
      driverId,
      estimatedRemainingLaps,
      estimatedPitInLapsFromNow,
    });
  }

  return results;
}
