/**
 * Motor de simulación procedural de la sesión de carrera (Generador_Demo).
 *
 * `SimulationEngine` es la clase que orquesta todas las funciones puras
 * implementadas en este módulo (`createRng`, `createInitialState`,
 * `advanceLap`, `applyFuelConsumption`, `maybeTriggerPitStop`,
 * `advanceWeather`, `recomputePositions`, `hasSessionStateChanged` y las
 * funciones `build*Event`) para producir, tick a tick, la secuencia de
 * `EventoV1` que el servidor WebSocket (tarea 6.1) retransmite a los
 * consumidores conectados.
 *
 * Ver design.md, sección "a) Motor de simulación (`src/simulation/`)" y
 * "Property 4: Exactamente un Evento_Track por sesión" (Requisito 4.3).
 */

import type { EventoV1, TrackEventV1 } from "@apex/contrato-datos";
import { createRng, type Rng } from "./rng";
import { advanceLap } from "./lap";
import { recordSectorCompletion } from "./sectors";
import { applyFuelConsumption } from "./fuel";
import { maybeTriggerPitStop } from "./pitstop";
import { advanceWeather } from "./weather";
import { advanceTires } from "./tires";
import { recomputePositions } from "./positions";
import { hasSessionStateChanged } from "./sessionChange";
import {
  buildTelemetryEvent,
  buildStandingsEvent,
  buildSessionEvent,
  buildTrackEvent as buildTrackEventFromState,
} from "./events";
import { createInitialState, type SessionState, type SimulationConfig } from "./state";

/**
 * Intervalo mínimo, en milisegundos, entre dos Evento_Standings
 * consecutivos emitidos por `tick()`. 200ms equivale a 5Hz, el extremo
 * superior del rango [1Hz, 5Hz] exigido por el Requisito 2.3; usar el
 * extremo superior (en vez de un valor intermedio) maximiza la frescura
 * de la clasificación mostrada sin salir del rango permitido.
 */
const STANDINGS_EMIT_INTERVAL_MS = 200;

/**
 * Valida `config` de forma fail-fast, lanzando un `Error` descriptivo
 * ante cualquier valor fuera de los rangos exigidos por el motor de
 * simulación. Se ejecuta en el constructor de `SimulationEngine` antes de
 * crear el PRNG o el estado inicial, de modo que un proceso Node que
 * arranca con una configuración inválida falle inmediatamente con un
 * mensaje claro (ver design.md, sección "Error Handling": "Motor de
 * simulación con configuración inválida (p. ej. `driverCount <= 0`)").
 *
 * Nota: `createInitialState` (tarea 4.2) ya valida `driverCount` y
 * `classCount` de forma defensiva, pero esta función se ejecuta antes,
 * en el propio constructor de `SimulationEngine`, para cubrir también
 * `seed` y `trackId` y para que el mensaje de error quede asociado
 * explícitamente a la construcción del motor (no a una función interna).
 */
function validateConfig(config: SimulationConfig): void {
  if (!Number.isInteger(config.driverCount) || config.driverCount <= 0) {
    throw new Error(
      `SimulationEngine: config.driverCount debe ser un entero > 0 (recibido ${config.driverCount})`,
    );
  }
  if (!Number.isInteger(config.classCount) || config.classCount < 1) {
    throw new Error(
      `SimulationEngine: config.classCount debe ser un entero >= 1 (recibido ${config.classCount})`,
    );
  }
  if (!Number.isFinite(config.seed)) {
    throw new Error(
      `SimulationEngine: config.seed debe ser un número finito (recibido ${config.seed})`,
    );
  }
  if (typeof config.trackId !== "string" || config.trackId.length === 0) {
    throw new Error(
      `SimulationEngine: config.trackId debe ser un string no vacío (recibido ${JSON.stringify(config.trackId)})`,
    );
  }
}

/**
 * Motor de simulación procedural de una sesión de carrera.
 *
 * Mantiene el `SessionState` completo de la sesión y un PRNG con semilla
 * explícita, y expone `tick(dtMs)` como única forma de avanzar la
 * simulación. Dada la misma `config.seed` y la misma secuencia de
 * llamadas a `tick(dtMs)`, dos instancias de `SimulationEngine` producen
 * exactamente la misma secuencia de eventos (Property 5, Requisito 6.1):
 * todo el estado mutable (incluyendo el PRNG) vive encapsulado en la
 * instancia, y el `timestamp` de cada evento se deriva del tiempo
 * simulado acumulado (`elapsedMs`), nunca del reloj de pared, por lo que
 * ninguna fuente de no-determinismo externa se filtra en los eventos
 * producidos.
 */
export class SimulationEngine {
  private state: SessionState;
  private readonly rng: Rng;

  /** Tiempo simulado acumulado desde el inicio de la sesión, en ms. */
  private elapsedMs = 0;

  /**
   * Snapshot del estado de la sesión tras el tick anterior (o el estado
   * inicial, antes del primer tick), usado por `hasSessionStateChanged`
   * para decidir si el tick actual debe emitir un nuevo Evento_Session.
   */
  private previousState: SessionState;

  /**
   * Si `buildTrackEvent()` ya fue invocado para esta sesión. Ver
   * `buildTrackEvent` para la garantía de unicidad (Requisito 4.3).
   */
  private trackEventEmitted = false;

  /**
   * @param config - Configuración de la sesión a simular. Se valida de
   *   forma fail-fast: si `driverCount`, `classCount`, `seed` o
   *   `trackId` no cumplen los requisitos mínimos, el constructor lanza
   *   un `Error` descriptivo en vez de construir un motor en un estado
   *   inconsistente.
   */
  constructor(config: SimulationConfig) {
    validateConfig(config);
    this.rng = createRng(config.seed);
    this.state = createInitialState(config, this.rng);
    this.previousState = this.state;
  }

  /**
   * Avanza la simulación `dtMs` milisegundos y devuelve los eventos
   * producidos en este tick.
   *
   * Orquesta, en orden, sobre el estado actual: `advanceLap` seguido de
   * `recordSectorCompletion` (para detectar la transición de sector
   * producida por ese mismo avance, Requisito 2.3) y
   * `applyFuelConsumption` para cada piloto, `maybeTriggerPitStop` para
   * cada piloto, `recomputePositions` sobre el conjunto de pilotos
   * resultante, y `advanceWeather` para el clima. A partir del nuevo
   * estado:
   *
   * - Siempre construye y devuelve un Evento_Telemetry del piloto
   *   observado (`state.observedDriverId`).
   * - Añade un Evento_Standings cuando ha transcurrido al menos
   *   `STANDINGS_EMIT_INTERVAL_MS` desde el último emitido (throttling
   *   de frecuencia según el Requisito 2.3).
   * - Añade un Evento_Session si `hasSessionStateChanged` detecta un
   *   cambio en el estado global de la sesión respecto al tick anterior
   *   (Requisito 3.3).
   *
   * Nunca incluye un Evento_Track en el array devuelto: ese evento solo
   * se obtiene a través de `buildTrackEvent()`, para satisfacer la
   * Property 4 ("Exactamente un Evento_Track por sesión").
   *
   * @param dtMs - Milisegundos transcurridos desde el tick anterior.
   */
  tick(dtMs: number): EventoV1[] {
    this.elapsedMs += dtMs;

    const airTemp = this.state.weather.airTemp;

    const advancedDrivers = this.state.drivers
      .map((driver) => {
        const previousLapDistPct = driver.lapDistPct;
        const advanced = advanceLap(driver, dtMs);
        return recordSectorCompletion(advanced, this.state.trackDef.sectors, previousLapDistPct);
      })
      .map((driver) => applyFuelConsumption(driver, dtMs))
      .map((driver) => ({
        ...driver,
        tires: advanceTires(
          driver.tires,
          driver.tireWearRateFactors,
          dtMs,
          driver.baseSpeedFactor,
          airTemp,
          driver.inPits,
        ),
      }))
      .map((driver) => maybeTriggerPitStop(driver, this.rng, airTemp));

    const drivers = recomputePositions(advancedDrivers);
    const weather = advanceWeather(this.state.weather, dtMs, this.rng);

    const msSinceLastStandingsEmit = this.state.msSinceLastStandingsEmit + dtMs;
    const shouldEmitStandings = msSinceLastStandingsEmit >= STANDINGS_EMIT_INTERVAL_MS;

    this.previousState = this.state;
    this.state = {
      ...this.state,
      drivers,
      weather,
      msSinceLastStandingsEmit: shouldEmitStandings ? 0 : msSinceLastStandingsEmit,
    };

    const events: EventoV1[] = [
      buildTelemetryEvent(this.state, this.state.observedDriverId, this.elapsedMs),
    ];

    if (shouldEmitStandings) {
      events.push(buildStandingsEvent(this.state, this.elapsedMs));
    }

    if (hasSessionStateChanged(this.previousState, this.state)) {
      events.push(buildSessionEvent(this.state, this.elapsedMs));
    }

    return events;
  }

  /**
   * Construye el Evento_Track de la sesión en curso.
   *
   * SHALL invocarse como máximo una vez por instancia de
   * `SimulationEngine` (Requisito 4.3, Property 4: "Exactamente un
   * Evento_Track por sesión"). El servidor WebSocket (tarea 6.1) lo llama
   * una única vez al arrancar y reutiliza el `TrackEventV1` devuelto para
   * cada nueva conexión entrante, en vez de invocar este método de nuevo
   * por cada cliente. Invocarlo una segunda vez sobre la misma instancia
   * lanza un `Error` descriptivo en vez de producir un segundo
   * Evento_Track silenciosamente, para que cualquier uso incorrecto de
   * la capa de servidor falle de forma explícita.
   */
  buildTrackEvent(): TrackEventV1 {
    if (this.trackEventEmitted) {
      throw new Error(
        "SimulationEngine.buildTrackEvent: el Evento_Track ya fue emitido para esta sesión; " +
          "solo puede invocarse una vez por sesión (Requisito 4.3).",
      );
    }
    this.trackEventEmitted = true;
    return buildTrackEventFromState(this.state, this.elapsedMs);
  }
}
