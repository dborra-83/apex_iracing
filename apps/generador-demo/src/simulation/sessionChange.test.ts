import { describe, it, expect } from "vitest";
import fc from "fast-check";
import { hasSessionStateChanged } from "./sessionChange";
import type {
  DriverState,
  SessionState,
  TrackDef,
  WeatherCondition,
} from "./state";
import { createFreshTireState } from "./tires";
import type { TireWearRateFactors } from "./tires";

/**
 * Fixtures fijos de neumáticos, irrelevantes para `hasSessionStateChanged`
 * (que nunca lee campos de piloto), usados solo para completar la forma
 * de `DriverState`.
 */
const TIRE_STATE_FIXTURE = createFreshTireState(20);
const TIRE_WEAR_RATE_FACTORS_FIXTURE: TireWearRateFactors = { fl: 1, fr: 1, rl: 1, rr: 1 };

/**
 * `TrackDef` placeholder mínimo pero con la forma correcta, reutilizado
 * por todos los `SessionState` generados en este archivo (no es relevante
 * para `hasSessionStateChanged`, que nunca lee `trackDef`).
 */
const arbitraryTrackDef: fc.Arbitrary<TrackDef> = fc.constant({
  trackName: "track-placeholder",
  lengthM: 4000,
  path: [
    { x: 0, y: 0 },
    { x: 1, y: 0 },
    { x: 1, y: 1 },
  ],
  sectors: [
    { index: 0, start_pct: 0, end_pct: 1 / 3 },
    { index: 1, start_pct: 1 / 3, end_pct: 2 / 3 },
    { index: 2, start_pct: 2 / 3, end_pct: 1 },
  ],
});

/** Genera un `DriverState` con la forma correcta pero valores simples/arbitrarios. */
function arbitraryDriverAt(index: number): fc.Arbitrary<DriverState> {
  return fc.record({
    driverId: fc.constant(`driver-${index}`),
    classId: fc.constant("class-0"),
    lapDistPct: fc.float({ min: 0, max: Math.fround(0.999999), noNaN: true }),
    fuelLevel: fc.float({ min: 0, max: 100, noNaN: true }),
    position: fc.constant(index + 1),
    inPits: fc.boolean(),
    currentLapTime: fc.float({ min: 0, max: 200, noNaN: true }),
    lastLapTime: fc.constant(null),
    bestLapTime: fc.constant(null),
    delta_to_best: fc.constant(null),
    delta_to_prev: fc.constant(null),
    currentSectorIndex: fc.constant(0),
    currentSectorStartLapTime: fc.constant(0),
    lastSectorTimes: fc.constant([null, null, null]),
    bestSectorTimes: fc.constant([null, null, null]),
    baseSpeedFactor: fc.constant(1),
    fuelConsumptionPerLap: fc.constant(3),
    tires: fc.constant(TIRE_STATE_FIXTURE),
    tireWearRateFactors: fc.constant(TIRE_WEAR_RATE_FACTORS_FIXTURE),
  });
}

/** Genera un array de 0 a 3 `DriverState`, usado como placeholder no relevante. */
const arbitraryDrivers: fc.Arbitrary<DriverState[]> = fc
  .integer({ min: 0, max: 3 })
  .chain((n) => fc.tuple(...Array.from({ length: n }, (_, i) => arbitraryDriverAt(i))));

const arbitraryWeatherCondition: fc.Arbitrary<WeatherCondition> = fc.constantFrom(
  "clear",
  "cloudy",
  "light_rain",
  "heavy_rain",
);

const arbitrarySessionType: fc.Arbitrary<SessionState["sessionType"]> = fc.constantFrom(
  "practice",
  "qualy",
  "race",
);

const arbitraryFlag: fc.Arbitrary<SessionState["flag"]> = fc.constantFrom(
  "green",
  "yellow",
  "red",
  "checkered",
  "white",
);

/**
 * Genera un `SessionState` arbitrario con la forma correcta para que
 * `hasSessionStateChanged` pueda leer todos sus campos relevantes
 * (`sessionType`, `weather.condition`, `flag`, `timeRemainingS`,
 * `incidents`) y también los no relevantes (`drivers`,
 * `observedDriverId`, `msSinceLastStandingsEmit`, `trackDef`).
 */
const arbitrarySessionState: fc.Arbitrary<SessionState> = fc
  .record({
    sessionType: arbitrarySessionType,
    flag: arbitraryFlag,
    timeRemainingS: fc.float({ min: 0, max: 3600, noNaN: true }),
    incidents: fc.integer({ min: 0, max: 50 }),
    drivers: arbitraryDrivers,
    weatherCondition: arbitraryWeatherCondition,
    trackTemp: fc.float({ min: -10, max: 60, noNaN: true }),
    airTemp: fc.float({ min: -10, max: 50, noNaN: true }),
    observedDriverId: fc.constant("driver-0"),
    msSinceLastStandingsEmit: fc.integer({ min: 0, max: 10000 }),
  })
  .map(({ weatherCondition, trackTemp, airTemp, ...rest }) => ({
    ...rest,
    weather: {
      condition: weatherCondition,
      trackTemp,
      airTemp,
    },
  }))
  .chain((partial) =>
    arbitraryTrackDef.map((trackDef) => ({ ...partial, trackDef }) as SessionState),
  );

/** Copia profunda simple (suficiente para el `SessionState` generado arriba). */
function deepCloneSessionState(state: SessionState): SessionState {
  return {
    ...state,
    drivers: state.drivers.map((d) => ({ ...d })),
    weather: { ...state.weather },
    trackDef: {
      ...state.trackDef,
      path: state.trackDef.path.map((p) => ({ ...p })),
      sectors: state.trackDef.sectors.map((s) => ({ ...s })),
    },
  };
}

describe("Feature: iracing-telemetry-platform, Property 3: Emisión de Evento_Session ante cualquier cambio de estado global", () => {
  it("devuelve false cuando se compara un estado contra una copia profunda idéntica", () => {
    fc.assert(
      fc.property(arbitrarySessionState, (state) => {
        const clone = deepCloneSessionState(state);
        expect(hasSessionStateChanged(state, clone)).toBe(false);
      }),
      { numRuns: 100 },
    );
  });

  it("devuelve true cuando cambia sessionType a un valor distinto", () => {
    fc.assert(
      fc.property(
        arbitrarySessionState,
        arbitrarySessionType,
        (state, newSessionType) => {
          fc.pre(newSessionType !== state.sessionType);
          const modified: SessionState = { ...state, sessionType: newSessionType };
          expect(hasSessionStateChanged(state, modified)).toBe(true);
        },
      ),
      { numRuns: 100 },
    );
  });

  it("devuelve true cuando cambia weather.condition a un valor distinto", () => {
    fc.assert(
      fc.property(
        arbitrarySessionState,
        arbitraryWeatherCondition,
        (state, newCondition) => {
          fc.pre(newCondition !== state.weather.condition);
          const modified: SessionState = {
            ...state,
            weather: { ...state.weather, condition: newCondition },
          };
          expect(hasSessionStateChanged(state, modified)).toBe(true);
        },
      ),
      { numRuns: 100 },
    );
  });

  it("devuelve true cuando cambia flag a un valor distinto", () => {
    fc.assert(
      fc.property(arbitrarySessionState, arbitraryFlag, (state, newFlag) => {
        fc.pre(newFlag !== state.flag);
        const modified: SessionState = { ...state, flag: newFlag };
        expect(hasSessionStateChanged(state, modified)).toBe(true);
      }),
      { numRuns: 100 },
    );
  });

  it("devuelve true cuando cambia timeRemainingS a un valor distinto", () => {
    fc.assert(
      fc.property(
        arbitrarySessionState,
        fc.float({ min: 0, max: 3600, noNaN: true }),
        (state, newTimeRemaining) => {
          fc.pre(newTimeRemaining !== state.timeRemainingS);
          const modified: SessionState = { ...state, timeRemainingS: newTimeRemaining };
          expect(hasSessionStateChanged(state, modified)).toBe(true);
        },
      ),
      { numRuns: 100 },
    );
  });

  it("devuelve true cuando cambia incidents a un valor distinto", () => {
    fc.assert(
      fc.property(
        arbitrarySessionState,
        fc.integer({ min: 0, max: 50 }),
        (state, newIncidents) => {
          fc.pre(newIncidents !== state.incidents);
          const modified: SessionState = { ...state, incidents: newIncidents };
          expect(hasSessionStateChanged(state, modified)).toBe(true);
        },
      ),
      { numRuns: 100 },
    );
  });

  it("devuelve false cuando solo cambian campos no relevantes (drivers, observedDriverId, msSinceLastStandingsEmit)", () => {
    fc.assert(
      fc.property(
        arbitrarySessionState,
        arbitraryDriverAt(99),
        fc.integer({ min: 0, max: 10000 }),
        (state, extraDriver, newMsSinceLastStandingsEmit) => {
          const modified: SessionState = {
            ...state,
            drivers: [...state.drivers, extraDriver],
            observedDriverId: extraDriver.driverId,
            msSinceLastStandingsEmit: newMsSinceLastStandingsEmit,
          };
          expect(hasSessionStateChanged(state, modified)).toBe(false);
        },
      ),
      { numRuns: 100 },
    );
  });
});
