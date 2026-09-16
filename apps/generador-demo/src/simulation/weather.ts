/**
 * Variación procedural de las condiciones climáticas de la sesión
 * (Requisito 6.6).
 *
 * `advanceWeather` es una función pura que, dado el `WeatherState` actual,
 * el tiempo transcurrido desde el último tick (`dtMs`) y un generador de
 * números aleatorios con semilla explícita (`rng`), devuelve un nuevo
 * `WeatherState`:
 *
 * - `airTemp` y `trackTemp` varían de forma gradual y acotada en cada tick
 *   (pequeño paso aleatorio escalado por `dtMs`), permaneciendo dentro de
 *   rangos plausibles y manteniendo `trackTemp >= airTemp` en general
 *   (la pista suele estar más caliente que el aire).
 * - `condition` cambia ocasionalmente, con baja probabilidad por tick, a
 *   una condición climática distinta de la actual, de modo que a lo largo
 *   de una sesión completa (muchos ticks) se observe al menos un cambio de
 *   condición sin que estos sean demasiado frecuentes.
 *
 * No muta el objeto `weather` recibido: siempre devuelve una nueva
 * instancia de `WeatherState`.
 */

import type { Rng } from "./rng";
import { nextRange } from "./rng";
import type { WeatherCondition, WeatherState } from "./state";

/** Límites plausibles de temperatura ambiente, en grados Celsius. */
const AIR_TEMP_MIN = 10;
const AIR_TEMP_MAX = 40;

/** Límites plausibles de temperatura de pista, en grados Celsius. */
const TRACK_TEMP_MIN = 15;
const TRACK_TEMP_MAX = 55;

/**
 * Paso máximo de variación de temperatura por milisegundo de simulación.
 * Con un tick típico de ~16ms esto produce variaciones muy pequeñas por
 * tick, acumulándose de forma gradual a lo largo de la sesión.
 */
const TEMP_STEP_PER_MS = 0.0005;

/**
 * Probabilidad de que la condición climática cambie en un tick de ~16ms.
 * Con esta probabilidad, a lo largo de una sesión de varios minutos
 * (decenas de miles de ticks) se espera observar al menos un cambio de
 * condición, sin que los cambios sean demasiado frecuentes.
 */
const CONDITION_CHANGE_PROBABILITY_PER_TICK = 0.002;

const ALL_CONDITIONS: readonly WeatherCondition[] = [
  "clear",
  "cloudy",
  "light_rain",
  "heavy_rain",
];

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

/**
 * Elige una condición climática distinta de `current` a partir de `rng`.
 */
function pickDifferentCondition(current: WeatherCondition, rng: Rng): WeatherCondition {
  const candidates = ALL_CONDITIONS.filter((c) => c !== current);
  const idx = Math.floor(nextRange(rng, 0, candidates.length));
  // Protección defensiva ante redondeos de punto flotante en el límite
  // superior del rango devuelto por nextRange.
  const clampedIdx = Math.min(idx, candidates.length - 1);
  return candidates[clampedIdx] as WeatherCondition;
}

/**
 * Avanza el estado climático de la sesión un paso de `dtMs` milisegundos.
 *
 * @param weather - Estado climático actual (no se muta).
 * @param dtMs - Milisegundos transcurridos desde el tick anterior.
 * @param rng - Generador de números aleatorios con semilla explícita.
 * @returns Un nuevo `WeatherState` con las temperaturas y, ocasionalmente,
 *   la condición climática actualizadas.
 */
export function advanceWeather(weather: WeatherState, dtMs: number, rng: Rng): WeatherState {
  const maxStep = TEMP_STEP_PER_MS * dtMs;

  const airTemp = clamp(
    weather.airTemp + nextRange(rng, -maxStep, maxStep),
    AIR_TEMP_MIN,
    AIR_TEMP_MAX,
  );

  // La temperatura de pista sigue a la temperatura ambiente pero con su
  // propio paso aleatorio, manteniéndose en general por encima del aire.
  const rawTrackTemp = clamp(
    weather.trackTemp + nextRange(rng, -maxStep, maxStep),
    TRACK_TEMP_MIN,
    TRACK_TEMP_MAX,
  );
  const trackTemp = Math.max(rawTrackTemp, airTemp);

  let condition = weather.condition;
  if (rng.next() < CONDITION_CHANGE_PROBABILITY_PER_TICK) {
    condition = pickDifferentCondition(weather.condition, rng);
  }

  return {
    condition,
    trackTemp,
    airTemp,
  };
}
