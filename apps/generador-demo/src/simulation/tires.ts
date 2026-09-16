/**
 * Simulación de neumáticos del motor de simulación procedural.
 *
 * Modelo elegido (documentado aquí por ser el único punto de verdad sobre
 * las reglas de temperatura/presión/desgaste de neumáticos):
 *
 * - **Temperatura**: cada neumático converge exponencialmente hacia una
 *   temperatura objetivo (`HOT_TARGET_TEMP_C` mientras el piloto NO está
 *   en pits, `airTemp` mientras SÍ lo está, simulando que el neumático se
 *   enfría al detenerse) usando suavizado exponencial
 *   (`newTemp = target + (temp - target) * decay^dtMs`), en vez de un
 *   incremento lineal sin límite: esto garantiza que la temperatura nunca
 *   se dispare sin cota y siempre tienda a un valor plausible, similar al
 *   criterio ya usado por `advanceWeather` para la temperatura ambiente.
 * - **Desgaste**: se acumula monótonamente mientras el piloto NO está en
 *   pits, proporcional al tiempo transcurrido y a `baseSpeedFactor` (un
 *   piloto más rápido desgasta más), acotado a `[0, 1]` (0 = neumático
 *   nuevo, 1 = completamente desgastado). Nunca decrece por el paso del
 *   tiempo — solo se reinicia explícitamente a 0 al cambiar de neumáticos
 *   en una parada en pits (ver `pitstop.ts`), de forma análoga a como
 *   `fuelLevel` se repone a 100 en la misma parada.
 * - **Presión**: correlacionada con la temperatura (un neumático más
 *   caliente tiene mayor presión, física real de gases), como un offset
 *   lineal sobre una presión de referencia en frío
 *   (`COLD_PRESSURE_PSI`), acotada a `>= 0`.
 *
 * Cada una de las 4 ruedas (`fl`/`fr`/`rl`/`rr`) tiene su propio
 * `wearRateFactor` (generado una vez por piloto en `createDriverState`,
 * ~[0.9, 1.1]) para diferenciar ligeramente su desgaste, igual criterio ya
 * usado por `baseSpeedFactor`/`fuelConsumptionPerLap` para diferenciar
 * pilotos entre sí.
 */

import type { Rng } from "./rng";
import { nextRange } from "./rng";

export interface TireCornerState {
  temp: number;
  pressure: number;
  wear: number;
}

export interface TireState {
  fl: TireCornerState;
  fr: TireCornerState;
  rl: TireCornerState;
  rr: TireCornerState;
}

/** Factores de desgaste relativo por rueda, generados una vez por piloto. */
export interface TireWearRateFactors {
  fl: number;
  fr: number;
  rl: number;
  rr: number;
}

/** Presión de referencia en frío, en psi, típica de un neumático de competición. */
const COLD_PRESSURE_PSI = 27.5;

/** Temperatura objetivo (°C) hacia la que converge un neumático mientras el piloto conduce activamente. */
const HOT_TARGET_TEMP_C = 90;

/** Cuánto sube la presión (psi) por cada grado Celsius por encima de la referencia en frío. */
const PRESSURE_PER_DEGREE_PSI = 0.08;

/** Temperatura de referencia (°C) sobre la que se mide el offset de presión. */
const REFERENCE_TEMP_C = 20;

/**
 * Constante de suavizado exponencial de la temperatura: valor en `(0, 1)`
 * tal que, tras 1000ms, la diferencia respecto al objetivo se reduce a
 * este factor. Un valor cercano a 1 haría la convergencia muy lenta; uno
 * cercano a 0, instantánea. `0.5` da una vida media de ~1 segundo, lo que
 * produce una respuesta visible pero no instantánea en el HUD.
 */
const TEMP_DECAY_PER_SECOND = 0.5;

/**
 * Desgaste acumulado por milisegundo de conducción a `baseSpeedFactor = 1`,
 * calibrado para que una vuelta de referencia (`REFERENCE_LAP_DURATION_S`
 * de `fuel.ts`, 90s) desgaste aproximadamente un 1% (`0.01`) el neumático,
 * de forma que una sesión de duración razonable (varios cientos de
 * vueltas simuladas) permita ver el desgaste avanzar de forma plausible
 * sin llegar a 1 demasiado rápido.
 */
const WEAR_PER_MS_AT_REFERENCE_SPEED = 0.01 / (90 * 1000);

/** Genera los 4 `wearRateFactor` (~[0.9, 1.1]) de un piloto, una única vez en `createDriverState`. */
export function createTireWearRateFactors(rng: Rng): TireWearRateFactors {
  return {
    fl: nextRange(rng, 0.9, 1.1),
    fr: nextRange(rng, 0.9, 1.1),
    rl: nextRange(rng, 0.9, 1.1),
    rr: nextRange(rng, 0.9, 1.1),
  };
}

/**
 * Crea el estado inicial de los 4 neumáticos: fríos (`airTemp`), sin
 * desgaste, a la presión de referencia en frío. Se reutiliza también al
 * "cambiar" neumáticos en una parada en pits (ver `pitstop.ts`).
 *
 * @param airTemp - Temperatura ambiente actual, usada como temperatura
 *   inicial del neumático en frío.
 */
export function createFreshTireState(airTemp: number): TireState {
  const corner: TireCornerState = { temp: airTemp, pressure: COLD_PRESSURE_PSI, wear: 0 };
  return { fl: { ...corner }, fr: { ...corner }, rl: { ...corner }, rr: { ...corner } };
}

/**
 * Avanza el estado de una única rueda `dtMs` milisegundos, sin mutar el
 * objeto recibido.
 *
 * @param corner - Estado actual de la rueda.
 * @param wearRateFactor - Factor de desgaste relativo de esta rueda (~[0.9, 1.1]).
 * @param dtMs - Milisegundos transcurridos desde el último tick.
 * @param baseSpeedFactor - Factor de rendimiento del piloto (afecta el desgaste).
 * @param airTemp - Temperatura ambiente actual (objetivo de enfriamiento en pits).
 * @param inPits - Si el piloto está actualmente detenido en boxes.
 */
function advanceTireCorner(
  corner: TireCornerState,
  wearRateFactor: number,
  dtMs: number,
  baseSpeedFactor: number,
  airTemp: number,
  inPits: boolean,
): TireCornerState {
  const targetTemp = inPits ? airTemp : HOT_TARGET_TEMP_C;
  const decay = Math.pow(TEMP_DECAY_PER_SECOND, dtMs / 1000);
  const newTemp = targetTemp + (corner.temp - targetTemp) * decay;

  const wearIncrement = inPits
    ? 0
    : WEAR_PER_MS_AT_REFERENCE_SPEED * dtMs * baseSpeedFactor * wearRateFactor;
  const newWear = Math.min(1, corner.wear + wearIncrement);

  const newPressure = Math.max(
    0,
    COLD_PRESSURE_PSI + (newTemp - REFERENCE_TEMP_C) * PRESSURE_PER_DEGREE_PSI,
  );

  return { temp: newTemp, pressure: newPressure, wear: newWear };
}

/**
 * Avanza el estado de los 4 neumáticos de un piloto `dtMs` milisegundos,
 * sin mutar el objeto recibido.
 *
 * Es una función pura: dado el mismo `tires`/`wearRateFactors`/`dtMs`/
 * `baseSpeedFactor`/`airTemp`/`inPits`, siempre devuelve el mismo
 * resultado.
 */
export function advanceTires(
  tires: TireState,
  wearRateFactors: TireWearRateFactors,
  dtMs: number,
  baseSpeedFactor: number,
  airTemp: number,
  inPits: boolean,
): TireState {
  return {
    fl: advanceTireCorner(tires.fl, wearRateFactors.fl, dtMs, baseSpeedFactor, airTemp, inPits),
    fr: advanceTireCorner(tires.fr, wearRateFactors.fr, dtMs, baseSpeedFactor, airTemp, inPits),
    rl: advanceTireCorner(tires.rl, wearRateFactors.rl, dtMs, baseSpeedFactor, airTemp, inPits),
    rr: advanceTireCorner(tires.rr, wearRateFactors.rr, dtMs, baseSpeedFactor, airTemp, inPits),
  };
}
