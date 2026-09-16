/**
 * Simulación de paradas en pits para un piloto (Requisito 6.4).
 *
 * Modelo elegido (documentado aquí por ser el único punto de verdad sobre
 * las reglas de pit stop):
 *
 * - **Entrada a pits**: un piloto que NO está en pits (`inPits === false`)
 *   puede entrar a pits en el tick actual si su `fuelLevel` está por debajo
 *   de `PIT_ENTRY_FUEL_THRESHOLD` (umbral "bajo"). La decisión de entrar es:
 *     - **Determinística** (probabilidad 1) si `fuelLevel` está por debajo
 *       de `PIT_ENTRY_CRITICAL_FUEL_THRESHOLD` (umbral "crítico"): el piloto
 *       no puede seguir sin repostar, así que entra sí o sí.
 *     - **Probabilística por tick** (`PIT_ENTRY_PROBABILITY_PER_TICK`) si el
 *       combustible está entre el umbral crítico y el umbral bajo: cada tick
 *       en ese rango hay una probabilidad fija de que el piloto decida
 *       entrar. Esto evita que todos los pilotos con fuel bajo entren en el
 *       mismo tick exacto, produciendo un comportamiento más plausible.
 *   Al entrar a pits, el piloto reposta inmediatamente a `fuelLevel = 100`.
 *   Esto simplifica el modelo: no hace falta modelar el consumo/duración de
 *   la parada tick a tick, solo su efecto neto sobre el combustible.
 *
 * - **Salida de pits**: un piloto que SÍ está en pits (`inPits === true`)
 *   puede salir en el tick actual con una probabilidad fija por tick
 *   (`PIT_EXIT_PROBABILITY_PER_TICK`). Se eligió un modelo probabilístico
 *   por tick (en vez de un contador de ticks-en-pits) para no requerir un
 *   campo adicional en `DriverState` (que no existe en el modelo actual):
 *   con una probabilidad de salida por tick, el tiempo esperado en pits es
 *   `1 / PIT_EXIT_PROBABILITY_PER_TICK` ticks, lo que da una duración de
 *   parada plausible sin necesitar estado extra.
 *
 * Los umbrales y probabilidades se eligieron para que, en una sesión de
 * duración razonable (varios miles de ticks), sea plausible que al menos un
 * piloto con combustible bajo entre a pits y vuelva a salir: el umbral bajo
 * (15) se alcanza con el consumo normal de combustible, y la probabilidad de
 * entrada por tick (5%) garantiza que la entrada no tarde demasiados ticks
 * una vez alcanzado el umbral (esto se valida indirectamente en la tarea
 * 4.18, un test de sesión completa).
 */

import type { DriverState } from "./state";
import type { Rng } from "./rng";
import { createFreshTireState } from "./tires";

/**
 * Umbral de combustible ("bajo") por debajo del cual un piloto puede
 * empezar a considerar entrar a pits (de forma probabilística).
 */
const PIT_ENTRY_FUEL_THRESHOLD = 15;

/**
 * Umbral de combustible ("crítico") por debajo del cual el piloto entra a
 * pits de forma determinística en el siguiente tick.
 */
const PIT_ENTRY_CRITICAL_FUEL_THRESHOLD = 5;

/**
 * Probabilidad, por tick, de que un piloto con combustible entre el umbral
 * crítico y el umbral bajo decida entrar a pits en ese tick.
 */
const PIT_ENTRY_PROBABILITY_PER_TICK = 0.05;

/**
 * Probabilidad, por tick, de que un piloto actualmente en pits decida salir
 * en ese tick.
 */
const PIT_EXIT_PROBABILITY_PER_TICK = 0.1;

/**
 * Nivel de combustible al que se repostea un piloto al entrar a pits.
 */
const REFUEL_LEVEL = 100;

/**
 * Decide, para un único piloto y el tick actual, si debe entrar o salir de
 * pits, y devuelve un nuevo `DriverState` reflejando esa decisión.
 *
 * Es una función pura: no muta `driver`, siempre devuelve un objeto nuevo
 * (aunque no haya cambios de estado, se devuelve una copia superficial para
 * mantener la inmutabilidad del contrato de la función).
 *
 * Efecto sobre neumáticos (documentado aquí junto al resto de efectos de
 * la parada): al ENTRAR a pits, además de repostar a `REFUEL_LEVEL`, se
 * "cambian" los 4 neumáticos vía `createFreshTireState` (desgaste vuelve
 * a 0, temperatura vuelve a `airTemp`), igual criterio que el repostaje
 * de combustible: no se modela la duración/mecánica del cambio de rueda
 * tick a tick, solo su efecto neto. Salir de pits no tiene efecto propio
 * sobre los neumáticos (ya quedaron frescos al entrar); el calentamiento
 * ocurre gradualmente vía `advanceTires` una vez el piloto vuelve a
 * pista.
 *
 * @param driver - Estado actual del piloto.
 * @param rng - Generador de números aleatorios con semilla explícita, usado
 *   para las decisiones probabilísticas de entrada/salida.
 * @param airTemp - Temperatura ambiente actual, usada como temperatura de
 *   los neumáticos recién cambiados al entrar a pits.
 */
export function maybeTriggerPitStop(driver: DriverState, rng: Rng, airTemp: number): DriverState {
  if (driver.inPits) {
    const shouldExit = rng.next() < PIT_EXIT_PROBABILITY_PER_TICK;
    return {
      ...driver,
      inPits: shouldExit ? false : true,
    };
  }

  const isCritical = driver.fuelLevel < PIT_ENTRY_CRITICAL_FUEL_THRESHOLD;
  const isLow = driver.fuelLevel < PIT_ENTRY_FUEL_THRESHOLD;

  if (!isLow) {
    return { ...driver };
  }

  const shouldEnter = isCritical || rng.next() < PIT_ENTRY_PROBABILITY_PER_TICK;

  if (!shouldEnter) {
    return { ...driver };
  }

  return {
    ...driver,
    inPits: true,
    fuelLevel: REFUEL_LEVEL,
    tires: createFreshTireState(airTemp),
  };
}
