import { describe, it, beforeEach } from "vitest";
import fc from "fast-check";
import type {
  TelemetryEventV1,
  StandingsEventV1,
  SessionEventV1,
  TrackEventV1,
  EventoV1,
} from "@apex/contrato-datos";
import { dispatchEvent } from "./dispatchEvent";
import { useTelemetryStore } from "./telemetryStore";
import { useStandingsStore } from "./standingsStore";
import { useSessionStore } from "./sessionStore";
import { useTrackStore } from "./trackStore";

/**
 * Feature: iracing-telemetry-platform, Property 15: El enrutamiento de
 * mensajes dirige cada evento exactamente a su handler por tipo
 *
 * Para cualquier evento válido de alguno de los cuatro tipos, la función
 * de despacho del Dashboard SHALL invocar exactamente el handler/store
 * correspondiente a ese `type`, y SHALL no invocar ningún otro
 * handler/store para ese evento.
 *
 * Validates: Requirements 14.2
 */

const VERSION = "1.0.0";

function baseEnvelope(timestamp: number) {
  return { version_contrato: VERSION, timestamp };
}

function makeTelemetryEvent(driverId: string, timestamp: number): TelemetryEventV1 {
  return {
    ...baseEnvelope(timestamp),
    type: "telemetry",
    driver_id: driverId,
    speed: 50,
    rpm: 5000,
    gear: 3,
    throttle: 0.5,
    brake: 0,
    steering: 0,
    fuel_level: 20,
    lap_dist_pct: 0.25,
    current_lap_time: 30,
    last_lap_time: null,
    best_lap_time: null,
    delta_to_best: null,
    delta_to_prev: null,
    position: 1,
    track_temp: 25,
    air_temp: 20,
  };
}

function makeStandingsEvent(driverId: string, timestamp: number): StandingsEventV1 {
  return {
    ...baseEnvelope(timestamp),
    type: "standings",
    drivers: [
      {
        driver_id: driverId,
        position: 1,
        class_id: "GT3",
        gap: 0,
        last_lap_time: null,
        best_lap_time: null,
        in_pits: false,
        off_track: false,
      },
    ],
  };
}

function makeSessionEvent(incidents: number, timestamp: number): SessionEventV1 {
  return {
    ...baseEnvelope(timestamp),
    type: "session",
    session_type: "race",
    weather: "clear",
    flag: "green",
    time_remaining_s: 1800,
    laps_remaining: 20,
    incidents,
  };
}

function makeTrackEvent(trackName: string, timestamp: number): TrackEventV1 {
  return {
    ...baseEnvelope(timestamp),
    type: "track",
    track_name: trackName,
    length_m: 5000,
    path: [
      { x: 0, y: 0 },
      { x: 1, y: 1 },
    ],
    sectors: [{ index: 0, start_pct: 0, end_pct: 1 }],
  };
}

/** Restablece los 4 stores a su estado inicial (`latestEvent: null`). */
function resetAllStores() {
  useTelemetryStore.setState({ latestEvent: null });
  useStandingsStore.setState({ latestEvent: null });
  useSessionStore.setState({ latestEvent: null });
  useTrackStore.setState({ latestEvent: null });
}

describe("Feature: iracing-telemetry-platform, Property 15: El enrutamiento de mensajes dirige cada evento exactamente a su handler por tipo", () => {
  beforeEach(() => {
    resetAllStores();
  });

  it("un Evento_Telemetry solo actualiza useTelemetryStore y deja los otros 3 stores intactos", () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 1, maxLength: 20 }),
        fc.integer({ min: 0, max: 10_000_000 }),
        (driverId, timestamp) => {
          resetAllStores();
          const event: EventoV1 = makeTelemetryEvent(driverId, timestamp);

          const prevStandings = useStandingsStore.getState().latestEvent;
          const prevSession = useSessionStore.getState().latestEvent;
          const prevTrack = useTrackStore.getState().latestEvent;

          dispatchEvent(event);

          return (
            useTelemetryStore.getState().latestEvent === event &&
            useStandingsStore.getState().latestEvent === prevStandings &&
            useSessionStore.getState().latestEvent === prevSession &&
            useTrackStore.getState().latestEvent === prevTrack
          );
        },
      ),
      { numRuns: 100 },
    );
  });

  it("un Evento_Standings solo actualiza useStandingsStore y deja los otros 3 stores intactos", () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 1, maxLength: 20 }),
        fc.integer({ min: 0, max: 10_000_000 }),
        (driverId, timestamp) => {
          resetAllStores();
          const event: EventoV1 = makeStandingsEvent(driverId, timestamp);

          const prevTelemetry = useTelemetryStore.getState().latestEvent;
          const prevSession = useSessionStore.getState().latestEvent;
          const prevTrack = useTrackStore.getState().latestEvent;

          dispatchEvent(event);

          return (
            useStandingsStore.getState().latestEvent === event &&
            useTelemetryStore.getState().latestEvent === prevTelemetry &&
            useSessionStore.getState().latestEvent === prevSession &&
            useTrackStore.getState().latestEvent === prevTrack
          );
        },
      ),
      { numRuns: 100 },
    );
  });

  it("un Evento_Session solo actualiza useSessionStore y deja los otros 3 stores intactos", () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 500 }),
        fc.integer({ min: 0, max: 10_000_000 }),
        (incidents, timestamp) => {
          resetAllStores();
          const event: EventoV1 = makeSessionEvent(incidents, timestamp);

          const prevTelemetry = useTelemetryStore.getState().latestEvent;
          const prevStandings = useStandingsStore.getState().latestEvent;
          const prevTrack = useTrackStore.getState().latestEvent;

          dispatchEvent(event);

          return (
            useSessionStore.getState().latestEvent === event &&
            useTelemetryStore.getState().latestEvent === prevTelemetry &&
            useStandingsStore.getState().latestEvent === prevStandings &&
            useTrackStore.getState().latestEvent === prevTrack
          );
        },
      ),
      { numRuns: 100 },
    );
  });

  it("un Evento_Track solo actualiza useTrackStore y deja los otros 3 stores intactos", () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 1, maxLength: 20 }),
        fc.integer({ min: 0, max: 10_000_000 }),
        (trackName, timestamp) => {
          resetAllStores();
          const event: EventoV1 = makeTrackEvent(trackName, timestamp);

          const prevTelemetry = useTelemetryStore.getState().latestEvent;
          const prevStandings = useStandingsStore.getState().latestEvent;
          const prevSession = useSessionStore.getState().latestEvent;

          dispatchEvent(event);

          return (
            useTrackStore.getState().latestEvent === event &&
            useTelemetryStore.getState().latestEvent === prevTelemetry &&
            useStandingsStore.getState().latestEvent === prevStandings &&
            useSessionStore.getState().latestEvent === prevSession
          );
        },
      ),
      { numRuns: 100 },
    );
  });
});
