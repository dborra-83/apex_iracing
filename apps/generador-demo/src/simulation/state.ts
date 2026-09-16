/**
 * Estado interno del motor de simulación procedural.
 *
 * Estos tipos NO se exponen directamente como eventos del Contrato_Datos:
 * son el modelo de dominio interno (ver diagrama ER "Data Models" en
 * design.md) que las funciones `build*Event` (tareas 4.11+) proyectan hacia
 * los cuatro tipos de `EventoV1` (`telemetry`, `standings`, `session`,
 * `track`).
 */

import type { Rng } from "./rng";
import { nextInt, nextRange } from "./rng";
import {
  createFreshTireState,
  createTireWearRateFactors,
  type TireState,
  type TireWearRateFactors,
} from "./tires";

/**
 * Punto 2D de un trazado, en el mismo sistema de coordenadas que
 * `TrackPointV1Schema` del Contrato_Datos.
 */
export interface TrackPoint {
  x: number;
  y: number;
}

/**
 * Definición de un sector del trazado, alineada con `SectorV1Schema`.
 */
export interface SectorDef {
  index: number;
  start_pct: number;
  end_pct: number;
}

/**
 * Definición estática del trazado sobre el que corre la sesión.
 */
export interface TrackDef {
  trackName: string;
  lengthM: number;
  path: TrackPoint[];
  sectors: SectorDef[];
}

/** Condiciones climáticas simuladas, alineadas con `WeatherV1Schema`. */
export type WeatherCondition = "clear" | "cloudy" | "light_rain" | "heavy_rain";

/**
 * Estado climático actual de la sesión.
 */
export interface WeatherState {
  condition: WeatherCondition;
  trackTemp: number;
  airTemp: number;
}

/**
 * Estado interno de un piloto simulado.
 *
 * Incluye tanto los campos que se proyectan directamente a los eventos de
 * telemetría/standings (posición, combustible, tiempos de vuelta, etc.)
 * como campos puramente internos usados por el motor para simular
 * comportamiento diferenciado entre pilotos (`baseSpeedFactor`,
 * `fuelConsumptionPerLap`).
 */
export interface DriverState {
  driverId: string;
  classId: string;

  /** Progreso dentro de la vuelta actual, en [0, 1). */
  lapDistPct: number;

  /** Nivel de combustible restante, siempre >= 0. */
  fuelLevel: number;

  /** Posición actual en la clasificación general (entero positivo). */
  position: number;

  /** Si el piloto está actualmente detenido en boxes. */
  inPits: boolean;

  /** Tiempo transcurrido de la vuelta en curso, en segundos. */
  currentLapTime: number;

  /** Tiempo de la última vuelta completada, o null si aún no hay ninguna. */
  lastLapTime: number | null;

  /** Mejor tiempo de vuelta registrado, o null si aún no hay ninguna. */
  bestLapTime: number | null;

  /** Delta respecto a la mejor vuelta propia, o null si no aplica. */
  delta_to_best: number | null;

  /** Delta respecto al piloto anterior en la clasificación, o null si no aplica. */
  delta_to_prev: number | null;

  /**
   * Índice del sector en el que se encuentra actualmente el piloto (según
   * `getSectorForLapPct` de `@apex/telemetry-core`), usado internamente
   * por `recordSectorCompletion` para detectar la transición de un sector
   * al siguiente. No se expone directamente en ningún evento.
   */
  currentSectorIndex: number;

  /**
   * Valor de `currentLapTime` en el instante en que el piloto entró al
   * sector actual (`currentSectorIndex`), usado internamente por
   * `recordSectorCompletion` para calcular la duración del sector al
   * completarlo. No se expone directamente en ningún evento.
   */
  currentSectorStartLapTime: number;

  /**
   * Tiempos de sector de la última vuelta completada por el piloto para
   * cada sector, de longitud igual a `sectors.length` del `TrackDef` de
   * la sesión. `null` en la posición i significa que el piloto todavía no
   * ha completado el sector i en la vuelta correspondiente (Requisito 2.5).
   * Se proyecta directamente a `StandingsEntryV1_1.last_sector_times`.
   */
  lastSectorTimes: (number | null)[];

  /**
   * Mejores tiempos de sector registrados por el piloto en la sesión,
   * misma longitud y semántica de `null` que `lastSectorTimes`. Se
   * proyecta directamente a `StandingsEntryV1_1.best_sector_times`
   * (Requisito 2.4, 2.5).
   */
  bestSectorTimes: (number | null)[];

  /**
   * Factor de rendimiento relativo del piloto (>0), usado internamente por
   * `advanceLap` para diferenciar la velocidad de progreso entre pilotos.
   * No se expone directamente en ningún evento.
   */
  baseSpeedFactor: number;

  /**
   * Consumo de combustible por vuelta completa, usado internamente por
   * `applyFuelConsumption`. No se expone directamente en ningún evento.
   */
  fuelConsumptionPerLap: number;

  /**
   * Estado actual de los 4 neumáticos (temperatura, presión, desgaste),
   * avanzado tick a tick por `advanceTires`. Se proyecta directamente a
   * `TelemetryEventV1.tires` (solo para el piloto observado, ver
   * `buildTelemetryEvent`).
   */
  tires: TireState;

  /**
   * Factores de desgaste relativo por rueda (~[0.9, 1.1]), generados una
   * única vez en `createDriverState` para diferenciar el desgaste entre
   * ruedas de un mismo piloto. No se expone directamente en ningún
   * evento.
   */
  tireWearRateFactors: TireWearRateFactors;
}

/**
 * Estado global de la sesión, incluyendo todos los pilotos, el clima, el
 * trazado y contadores internos usados por el motor para el throttling de
 * eventos (p. ej. la frecuencia de emisión de standings).
 */
export interface SessionState {
  sessionType: "practice" | "qualy" | "race";
  flag: "green" | "yellow" | "red" | "checkered" | "white";
  timeRemainingS: number;
  incidents: number;

  drivers: DriverState[];
  weather: WeatherState;
  trackDef: TrackDef;

  /** Piloto cuya telemetría detallada se transmite (Evento_Telemetry). */
  observedDriverId: string;

  /**
   * Milisegundos acumulados desde el último Evento_Standings emitido,
   * usado por `SimulationEngine` (tarea 4.15) para hacer throttling de su
   * frecuencia de emisión (1-5Hz según Requisito 2.3).
   */
  msSinceLastStandingsEmit: number;
}

/**
 * Configuración de arranque del motor de simulación.
 */
export interface SimulationConfig {
  /** Semilla del PRNG; misma semilla produce siempre la misma sesión. */
  seed: number;

  /** Número total de pilotos simulados (debe ser > 0). */
  driverCount: number;

  /**
   * Número de clases distintas de pilotos simuladas simultáneamente.
   * Debe ser >= 2 para cumplir el Requisito 6.7.
   */
  classCount: number;

  /** Identificador del trazado a simular (solo se usa como etiqueta). */
  trackId: string;
}

/**
 * Crea el estado inicial de un piloto simulado.
 *
 * El piloto arranca en el inicio de vuelta (`lapDistPct = 0`), con un
 * nivel de combustible inicial razonable, sin estar en pits y sin tiempos
 * de vuelta registrados todavía. `baseSpeedFactor` y
 * `fuelConsumptionPerLap` se derivan de `rng` para diferenciar el
 * comportamiento de cada piloto en ticks posteriores.
 *
 * @param index - Índice del piloto (0-based), usado para generar `driverId`
 *   y la posición de parrilla inicial.
 * @param classId - Identificador de la clase a la que pertenece el piloto.
 * @param rng - Generador de números aleatorios con semilla explícita.
 * @param sectorCount - Número de sectores del `TrackDef` de la sesión,
 *   usado para inicializar `lastSectorTimes`/`bestSectorTimes` con listas
 *   de valores nulos de longitud igual a `sectorCount` (Requisito 2.5).
 */
export function createDriverState(
  index: number,
  classId: string,
  rng: Rng,
  sectorCount: number,
  initialAirTemp: number = 22,
): DriverState {
  return {
    driverId: `driver-${index}`,
    classId,
    lapDistPct: 0,
    fuelLevel: 100,
    position: index + 1,
    inPits: false,
    currentLapTime: 0,
    lastLapTime: null,
    bestLapTime: null,
    delta_to_best: null,
    delta_to_prev: null,
    currentSectorIndex: 0,
    currentSectorStartLapTime: 0,
    lastSectorTimes: new Array(sectorCount).fill(null),
    bestSectorTimes: new Array(sectorCount).fill(null),
    // Factor de rendimiento relativo: ~[0.9, 1.1] para diferenciar pilotos
    // sin generar diferencias de ritmo irreales entre ellos.
    baseSpeedFactor: nextRange(rng, 0.9, 1.1),
    // Consumo de combustible por vuelta completa: ~[2, 4] unidades.
    fuelConsumptionPerLap: nextRange(rng, 2, 4),
    // Neumáticos: fríos al arranque (a la temperatura ambiente inicial),
    // sin desgaste. `initialAirTemp` tiene un valor por defecto (22) para
    // no romper llamadas existentes que no lo pasan explícitamente.
    tires: createFreshTireState(initialAirTemp),
    tireWearRateFactors: createTireWearRateFactors(rng),
  };
}

/**
 * Genera un `TrackDef` placeholder: un trazado ovalado procedural con un
 * número de puntos en [20, 50] y 3 sectores que dividen el trazado en
 * tercios iguales. `trackId` se usa únicamente como parte del nombre, no
 * hay un catálogo real de circuitos en esta fase.
 */
function createTrackDef(trackId: string, rng: Rng): TrackDef {
  const pointCount = nextInt(rng, 20, 50);
  const radiusX = 500;
  const radiusY = 250;

  const path: TrackPoint[] = [];
  for (let i = 0; i < pointCount; i++) {
    const angle = (i / pointCount) * Math.PI * 2;
    path.push({
      x: radiusX * Math.cos(angle),
      y: radiusY * Math.sin(angle),
    });
  }

  // Longitud aproximada del trazado como perímetro de una elipse
  // (aproximación de Ramanujan), suficiente para un placeholder.
  const a = radiusX;
  const b = radiusY;
  const h = Math.pow(a - b, 2) / Math.pow(a + b, 2);
  const lengthM = Math.PI * (a + b) * (1 + (3 * h) / (10 + Math.sqrt(4 - 3 * h)));

  const sectors: SectorDef[] = [
    { index: 0, start_pct: 0, end_pct: 1 / 3 },
    { index: 1, start_pct: 1 / 3, end_pct: 2 / 3 },
    { index: 2, start_pct: 2 / 3, end_pct: 1 },
  ];

  return {
    trackName: `track-${trackId}`,
    lengthM,
    path,
    sectors,
  };
}

/**
 * Crea el estado inicial completo de la sesión a partir de `config`.
 *
 * Distribuye los pilotos entre `classCount` clases genéricas
 * (`"class-0"`, `"class-1"`, ...) en round-robin, garantizando que cuando
 * `classCount >= 2` haya al menos dos clases distintas presentes de forma
 * simultánea (Requisito 6.7). Genera un `TrackDef` placeholder y un
 * `WeatherState` inicial en condición "clear".
 *
 * Esta función asume una `config` básicamente válida; la validación
 * fail-fast completa con mensajes descriptivos se implementa en el
 * constructor de `SimulationEngine` (tarea 4.15).
 *
 * @param config - Configuración de la sesión a simular.
 * @param rng - Generador de números aleatorios con semilla explícita.
 */
export function createInitialState(config: SimulationConfig, rng: Rng): SessionState {
  if (config.driverCount <= 0) {
    throw new Error(
      `createInitialState: driverCount debe ser > 0 (recibido ${config.driverCount})`,
    );
  }
  if (config.classCount < 1) {
    throw new Error(
      `createInitialState: classCount debe ser >= 1 (recibido ${config.classCount})`,
    );
  }

  const trackDef = createTrackDef(config.trackId, rng);

  const weather: WeatherState = {
    condition: "clear",
    trackTemp: 30,
    airTemp: 22,
  };

  const drivers: DriverState[] = [];
  for (let i = 0; i < config.driverCount; i++) {
    const classId = `class-${i % config.classCount}`;
    drivers.push(createDriverState(i, classId, rng, trackDef.sectors.length, weather.airTemp));
  }

  const firstDriver = drivers[0];
  if (!firstDriver) {
    // Inalcanzable: driverCount > 0 garantiza al menos un piloto en `drivers`.
    throw new Error("createInitialState: no se generó ningún piloto");
  }

  return {
    sessionType: "race",
    flag: "green",
    timeRemainingS: 3600,
    incidents: 0,
    drivers,
    weather,
    trackDef,
    observedDriverId: firstDriver.driverId,
    msSinceLastStandingsEmit: 0,
  };
}
