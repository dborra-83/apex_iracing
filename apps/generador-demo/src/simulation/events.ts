/**
 * Funciones de construcción de eventos del Contrato_Datos a partir del
 * estado interno de la simulación (`SessionState`).
 *
 * Estas funciones son la "proyección" mencionada en design.md, sección
 * "Data Models": `SessionState` (y sus `DriverState`, `WeatherState`,
 * `TrackDef` internos) nunca se exponen directamente; en su lugar, cada
 * `build*Event` traduce el estado interno hacia el `EventoV1`
 * correspondiente definido en `@apex/contrato-datos`, garantizando que el
 * resultado valide siempre contra el esquema Zod de su tipo (Property 1,
 * "Conformidad de todo evento con el Contrato_Datos", Requisito 6.8).
 *
 * Todas las funciones son puras: no leen `Date.now()` ni ningún otro
 * estado global. El `timestamp` se recibe siempre como parámetro, lo que
 * las mantiene deterministas y fáciles de testear con PBT (tarea 4.12).
 */

import {
  type TelemetryEventV1,
  type StandingsEventV1_1,
  type StandingsEntryV1_1,
  type SessionEventV1,
  type TrackEventV1,
} from "@apex/contrato-datos";
import type { DriverState, SessionState } from "./state";

/**
 * Version_Contrato emitida por todas las funciones `build*Event` de este
 * módulo. El Generador_Demo es la única fuente real de datos de todo el
 * monorepo (ver design.md, sección "Compatibilidad hacia atrás — matriz
 * de casos"): no hay necesidad de seguir emitiendo `"1.0.0"` en paralelo,
 * por lo que todos los eventos (telemetry, standings, session, track)
 * emiten siempre `"1.1.0"` a partir de esta ampliación (Requisito 2.1).
 * `telemetry`/`session`/`track` no cambian de estructura entre 1.0.0 y
 * 1.1.0 (Requisito 1.2); solo cambia el literal de `version_contrato`.
 */
const CONTRACT_VERSION = "1.1.0" as const;

/**
 * Duración de referencia de una vuelta, en segundos, usada únicamente para
 * derivar un `gap` simple en `buildStandingsEvent` a partir de la
 * diferencia de `lapDistPct` respecto al líder. Es un valor puramente
 * demostrativo (no proviene de un modelo real de gap temporal); coincide
 * con la referencia usada en `lap.ts`/`fuel.ts` por consistencia.
 */
const REFERENCE_LAP_DURATION_S = 90;

/**
 * Busca al piloto `driverId` dentro de `drivers`, lanzando un error
 * descriptivo si no existe. Las funciones `build*Event` asumen que
 * `observedDriverId`/los ids referenciados en el estado siempre
 * corresponden a un piloto presente en `state.drivers`; si esto no se
 * cumple, es un error de invocación (estado inconsistente) y se falla de
 * forma explícita en vez de construir un evento con datos inventados.
 */
function findDriverOrThrow(drivers: DriverState[], driverId: string): DriverState {
  const driver = drivers.find((d) => d.driverId === driverId);
  if (!driver) {
    throw new Error(`findDriverOrThrow: no existe ningún piloto con driverId "${driverId}"`);
  }
  return driver;
}

/**
 * Construye el Evento_Telemetry del piloto observado (`observedDriverId`)
 * a partir del `SessionState` actual.
 *
 * Derivaciones documentadas (campos que `DriverState` no modela
 * directamente en esta fase, ver `state.ts`):
 *
 * - `speed`: `DriverState` no lleva una velocidad instantánea propia; se
 *   deriva de `baseSpeedFactor` (el mismo factor que usa `advanceLap` para
 *   diferenciar el ritmo entre pilotos) escalado a un rango de velocidad
 *   de circuito plausible (~180-220 km/h), con una pequeña oscilación
 *   determinista en función de `lapDistPct` para que no sea un valor
 *   perfectamente constante. Al ser `baseSpeedFactor` siempre positivo
 *   (~[0.9, 1.1]) y la oscilación acotada a un rango menor que la base,
 *   `speed` es siempre `>= 0` (requerido por el esquema).
 * - `rpm`: tampoco está modelado en `DriverState`; se deriva como una
 *   oscilación determinista en función de `lapDistPct` alrededor de un
 *   valor base, acotada explícitamente a `[1000, 7000]` para garantizar
 *   `rpm >= 0` (requerido por el esquema) sin depender de ningún otro
 *   campo.
 * - `gear`: se deriva de `speed` (a mayor velocidad, marcha más alta),
 *   redondeada a un entero y acotada a `[1, 6]` (el esquema solo exige que
 *   sea un entero).
 * - `throttle`/`brake`/`steering`: no están modelados en `DriverState`; se
 *   derivan como oscilaciones deterministas simples en función de
 *   `lapDistPct` (fase de acelerador/freno alternada a lo largo de la
 *   vuelta, dirección oscilante), construidas para caer siempre
 *   exactamente dentro de sus rangos permitidos (`throttle`/`brake` en
 *   `[0, 1]`, `steering` en `[-1, 1]`).
 *
 * El resto de campos (`fuel_level`, `lap_dist_pct`, `current_lap_time`,
 * `last_lap_time`, `best_lap_time`, `delta_to_best`, `delta_to_prev`,
 * `position`) se copian directamente del `DriverState` observado, y
 * `track_temp`/`air_temp` se copian de `state.weather`.
 *
 * @param state - Estado actual de la sesión.
 * @param observedDriverId - Id del piloto cuya telemetría se transmite.
 * @param timestamp - Marca de tiempo (epoch ms) a incluir en el evento.
 */
export function buildTelemetryEvent(
  state: SessionState,
  observedDriverId: string,
  timestamp: number,
): TelemetryEventV1 {
  const driver = findDriverOrThrow(state.drivers, observedDriverId);

  const anglePhase = driver.lapDistPct * 2 * Math.PI;

  // `baseSpeedFactor` ~ [0.9, 1.1] siempre positivo; la oscilación (+-10)
  // es menor que la base (~180-220), por lo que `speed` es siempre >= 0.
  const speed = driver.baseSpeedFactor * 200 + Math.sin(anglePhase) * 10;

  // Oscilación acotada explícitamente a [1000, 7000] => siempre >= 0.
  const rpm = 4000 + Math.sin(anglePhase * 2) * 3000;

  // Entero en [1, 6], derivado de `speed` para que sea plausible.
  const gear = Math.min(6, Math.max(1, Math.round(speed / 40)));

  // (sin(x) + 1) / 2 mapea siempre a [0, 1].
  const throttle = (Math.sin(anglePhase) + 1) / 2;
  // Desfasado respecto a throttle (cos en vez de sin) para que no sean
  // idénticos, sigue mapeando siempre a [0, 1].
  const brake = (Math.cos(anglePhase) + 1) / 2;
  // sin(x) mapea siempre a [-1, 1].
  const steering = Math.sin(anglePhase * 2);

  return {
    type: "telemetry",
    version_contrato: CONTRACT_VERSION,
    timestamp,
    driver_id: driver.driverId,
    speed,
    rpm,
    gear,
    throttle,
    brake,
    steering,
    fuel_level: driver.fuelLevel,
    lap_dist_pct: driver.lapDistPct,
    current_lap_time: driver.currentLapTime,
    last_lap_time: driver.lastLapTime,
    best_lap_time: driver.bestLapTime,
    delta_to_best: driver.delta_to_best,
    delta_to_prev: driver.delta_to_prev,
    position: driver.position,
    track_temp: state.weather.trackTemp,
    air_temp: state.weather.airTemp,
    tires: driver.tires,
  };
}

/**
 * Construye el Evento_Standings (Version_Contrato_1_1) a partir de todos
 * los pilotos del `SessionState` actual.
 *
 * Derivaciones documentadas:
 *
 * - `gap`: `DriverState` no modela un gap temporal completo respecto al
 *   líder en esta fase (ver limitación documentada en `positions.ts`); se
 *   deriva de forma simple como la diferencia de `lapDistPct` respecto al
 *   piloto en la posición 1 (el líder), escalada por
 *   `REFERENCE_LAP_DURATION_S` para expresarla en segundos aproximados, y
 *   acotada a `>= 0` (el líder siempre tiene `gap = 0`). Es una
 *   aproximación demostrativa, no un cálculo real de intervalo de tiempo.
 * - `off_track`: `DriverState` no modela si un piloto está "fuera de
 *   pista" en esta fase; se usa `false` como placeholder para todos los
 *   pilotos.
 *
 * El resto de campos heredados de `StandingsEntryV1` (`driver_id`,
 * `position`, `class_id`, `last_lap_time`, `best_lap_time`, `in_pits`) se
 * copian directamente del `DriverState` correspondiente. Los 4 campos
 * nuevos de `StandingsEntryV1_1` (Requisito 2.2) se copian también
 * directamente: `lap_dist_pct`/`fuel_level` del propio `DriverState`, y
 * `last_sector_times`/`best_sector_times` tal como los mantiene
 * `recordSectorCompletion` (Requisito 2.3, 2.4).
 *
 * @param state - Estado actual de la sesión.
 * @param timestamp - Marca de tiempo (epoch ms) a incluir en el evento.
 */
export function buildStandingsEvent(
  state: SessionState,
  timestamp: number,
): StandingsEventV1_1 {
  const leader = state.drivers.find((d) => d.position === 1);
  const leaderLapDistPct = leader?.lapDistPct ?? 0;

  const drivers: StandingsEntryV1_1[] = state.drivers.map((driver) => {
    const gap = Math.max(0, (leaderLapDistPct - driver.lapDistPct) * REFERENCE_LAP_DURATION_S);

    return {
      driver_id: driver.driverId,
      position: driver.position,
      class_id: driver.classId,
      gap,
      last_lap_time: driver.lastLapTime,
      best_lap_time: driver.bestLapTime,
      in_pits: driver.inPits,
      off_track: false,
      lap_dist_pct: driver.lapDistPct,
      fuel_level: driver.fuelLevel,
      last_sector_times: driver.lastSectorTimes,
      best_sector_times: driver.bestSectorTimes,
    };
  });

  return {
    type: "standings",
    version_contrato: CONTRACT_VERSION,
    timestamp,
    drivers,
  };
}

/**
 * Construye el Evento_Session a partir del estado global del
 * `SessionState` actual.
 *
 * Derivación documentada:
 *
 * - `laps_remaining`: `SessionState` no modela vueltas restantes en esta
 *   fase (solo `timeRemainingS`); se emite `null`, valor explícitamente
 *   permitido por el esquema para este campo.
 *
 * El resto de campos (`session_type`, `weather`, `flag`,
 * `time_remaining_s`, `incidents`) se copian directamente de
 * `state`/`state.weather`.
 *
 * @param state - Estado actual de la sesión.
 * @param timestamp - Marca de tiempo (epoch ms) a incluir en el evento.
 */
export function buildSessionEvent(state: SessionState, timestamp: number): SessionEventV1 {
  return {
    type: "session",
    version_contrato: CONTRACT_VERSION,
    timestamp,
    session_type: state.sessionType,
    weather: state.weather.condition,
    flag: state.flag,
    time_remaining_s: state.timeRemainingS,
    laps_remaining: null,
    incidents: state.incidents,
  };
}

/**
 * Construye el Evento_Track a partir de la definición estática del
 * trazado (`state.trackDef`) del `SessionState` actual.
 *
 * Todos los campos se copian directamente de `state.trackDef`; no hay
 * derivaciones ni placeholders en esta función.
 *
 * @param state - Estado actual de la sesión.
 * @param timestamp - Marca de tiempo (epoch ms) a incluir en el evento.
 */
export function buildTrackEvent(state: SessionState, timestamp: number): TrackEventV1 {
  return {
    type: "track",
    version_contrato: CONTRACT_VERSION,
    timestamp,
    track_name: state.trackDef.trackName,
    length_m: state.trackDef.lengthM,
    path: state.trackDef.path,
    sectors: state.trackDef.sectors,
  };
}
