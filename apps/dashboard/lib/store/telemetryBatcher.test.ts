import { describe, it, expect, vi } from "vitest";
import fc from "fast-check";
import type { TelemetryEventV1 } from "@apex/contrato-datos";
import { createTelemetryBatcher, type ScheduleFrame, type CancelFrame } from "./telemetryBatcher";

/**
 * Feature: iracing-telemetry-platform
 *
 * Property: múltiples `push()` dentro de la misma vuelta de animación
 * producen exactamente UNA actualización del store, y dicha actualización
 * usa siempre el evento MÁS RECIENTE pasado a `push` antes del flush.
 *
 * Validates: Requirements 15.1, 15.2
 */

const VERSION = "1.0.0";

function makeTelemetryEvent(driverId: string, timestamp: number): TelemetryEventV1 {
  return {
    version_contrato: VERSION,
    timestamp,
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

/**
 * Un scheduler de frames manual (fake) que no depende de `requestAnimationFrame`:
 * `schedule` encola el callback y devuelve un handle incremental;
 * `runFrame` ejecuta (y quita de la cola) el próximo callback pendiente,
 * simulando la llegada de la siguiente vuelta de animación.
 */
function createManualFrameQueue(): {
  schedule: ScheduleFrame;
  cancel: CancelFrame;
  runFrame: () => void;
  pendingCount: () => number;
} {
  let nextHandle = 1;
  const queue = new Map<number, () => void>();

  return {
    schedule: (callback) => {
      const handle = nextHandle++;
      queue.set(handle, callback);
      return handle;
    },
    cancel: (handle) => {
      queue.delete(handle);
    },
    runFrame: () => {
      const [firstHandle] = queue.keys();
      if (firstHandle === undefined) return;
      const callback = queue.get(firstHandle)!;
      queue.delete(firstHandle);
      callback();
    },
    pendingCount: () => queue.size,
  };
}

describe("createTelemetryBatcher", () => {
  it("no invoca setTelemetryEvent hasta que se ejecuta el frame programado", () => {
    const setTelemetryEvent = vi.fn();
    const { schedule, cancel, runFrame } = createManualFrameQueue();
    const batcher = createTelemetryBatcher(setTelemetryEvent, schedule, cancel);

    batcher.push(makeTelemetryEvent("driver-1", 1));

    expect(setTelemetryEvent).not.toHaveBeenCalled();

    runFrame();

    expect(setTelemetryEvent).toHaveBeenCalledTimes(1);
  });

  it("varios push() dentro del mismo frame producen una sola actualización con el evento más reciente", () => {
    const setTelemetryEvent = vi.fn();
    const { schedule, cancel, runFrame } = createManualFrameQueue();
    const batcher = createTelemetryBatcher(setTelemetryEvent, schedule, cancel);

    const first = makeTelemetryEvent("driver-1", 1);
    const second = makeTelemetryEvent("driver-1", 2);
    const third = makeTelemetryEvent("driver-1", 3);

    batcher.push(first);
    batcher.push(second);
    batcher.push(third);

    runFrame();

    expect(setTelemetryEvent).toHaveBeenCalledTimes(1);
    expect(setTelemetryEvent).toHaveBeenCalledWith(third);
  });

  it("tras el flush, un nuevo push() programa un nuevo frame independiente", () => {
    const setTelemetryEvent = vi.fn();
    const { schedule, cancel, runFrame } = createManualFrameQueue();
    const batcher = createTelemetryBatcher(setTelemetryEvent, schedule, cancel);

    batcher.push(makeTelemetryEvent("driver-1", 1));
    runFrame();
    batcher.push(makeTelemetryEvent("driver-1", 2));
    runFrame();

    expect(setTelemetryEvent).toHaveBeenCalledTimes(2);
  });

  it("dispose() cancela el frame pendiente y descarta el evento bufferizado sin aplicarlo", () => {
    const setTelemetryEvent = vi.fn();
    const { schedule, cancel, runFrame, pendingCount } = createManualFrameQueue();
    const batcher = createTelemetryBatcher(setTelemetryEvent, schedule, cancel);

    batcher.push(makeTelemetryEvent("driver-1", 1));
    expect(pendingCount()).toBe(1);

    batcher.dispose();
    expect(pendingCount()).toBe(0);

    runFrame();
    expect(setTelemetryEvent).not.toHaveBeenCalled();
  });

  it("Property: N push() en el mismo frame producen exactamente 1 llamada con el último evento", () => {
    fc.assert(
      fc.property(
        fc.array(
          fc.record({ driverId: fc.string({ minLength: 1, maxLength: 10 }), timestamp: fc.integer({ min: 0, max: 10_000_000 }) }),
          { minLength: 1, maxLength: 50 },
        ),
        (specs) => {
          const setTelemetryEvent = vi.fn();
          const { schedule, cancel, runFrame } = createManualFrameQueue();
          const batcher = createTelemetryBatcher(setTelemetryEvent, schedule, cancel);

          const events = specs.map((s) => makeTelemetryEvent(s.driverId, s.timestamp));
          events.forEach((event) => batcher.push(event));

          runFrame();

          expect(setTelemetryEvent).toHaveBeenCalledTimes(1);
          expect(setTelemetryEvent).toHaveBeenCalledWith(events[events.length - 1]);
        },
      ),
      { numRuns: 100 },
    );
  });
});
