import type { RawTelemetrySnapshot } from "../sdk/types";
import type { TelemetryEventV1, TireCornerV1 } from "@apex/contrato-datos";

/**
 * Construye un `TireCornerV1` a partir de las 3 variables de temperatura
 * de carcasa (`*tempCL`/`*tempCM`/`*tempCR`, borde izquierdo/medio/
 * derecho de la banda de rodadura) y desgaste (`*wearL`/`*wearM`/
 * `*wearR`, `%` de goma restante) que expone la SDK por cada esquina.
 *
 * `TireCornerV1.temp`/`.wear` son un ÚNICO valor por rueda (no 3, ver
 * `packages/contrato-datos/src/v1/telemetry.ts`), así que se usa
 * únicamente la lectura del centro de la banda (`*tempCM`/`*wearM`) como
 * representativa de la rueda completa: es la MISMA simplificación que ya
 * hace el propio Generador_Demo (`apps/generador-demo/src/simulation/tires.ts`,
 * un único `temp`/`wear` por rueda), así que este bridge no introduce
 * información que el resto de la app (`TireIcon`, `classifyTireTemp`/
 * `classifyTireWear`) no sepa ya consumir. `wear` de la SDK es "%
 * restante" (100 = nuevo), mientras que el Contrato_Datos define `wear`
 * como "fracción gastada" en `[0, 1]` (0 = nuevo) — de signo opuesto — así
 * que se invierte con `1 - wearPct / 100`.
 *
 * `pressure` de la SDK (`*coldPressure`) es la presión EN FRÍO fijada en
 * el garage (`kPa`), no la presión en caliente en tiempo real (la SDK no
 * expone una variable de presión caliente en vivo por rueda en
 * telemetría estándar, solo en el servicio de pits). Se convierte de kPa
 * a psi (`* 0.145038`, la unidad que ya usa `TireCornerV1`/`TireIcon` en
 * el resto de la app) y se documenta esta limitación en el README del
 * bridge: la presión mostrada es la de referencia en frío, no la presión
 * dinámica real del neumático rodando.
 */
function mapTireCorner(tempCM: number, wearPct: number, coldPressureKPa: number): TireCornerV1 {
  const KPA_TO_PSI = 0.145038;
  return {
    temp: tempCM,
    pressure: coldPressureKPa * KPA_TO_PSI,
    wear: Math.min(1, Math.max(0, 1 - wearPct / 100)),
  };
}

/**
 * Construye el `Evento_Telemetry` del piloto observado (siempre el
 * piloto local, `"player"`) a partir del snapshot crudo del SDK.
 *
 * Mapeo de campos no evidentes por su nombre:
 * - `driver_id`: fijo en `"player"` — la SDK identifica al piloto local
 *   implícitamente (todas las variables de telemetría "planas", sin
 *   prefijo `CarIdx`, son siempre las del piloto local, nunca las de un
 *   rival), no hay un ID de piloto real disponible en telemetría (solo
 *   en `DriverInfo` de la SessionInfo, no leído por este bridge — ver
 *   limitaciones documentadas en el README).
 * - `position`: `PlayerCarPosition` (posición absoluta del piloto local
 *   en la sesión), no `CarIdxPosition` (ese array es por-piloto para el
 *   Evento_Standings, ver `mapping/standings.ts`).
 * - `delta_to_best`/`delta_to_prev`: la SDK expone
 *   `LapDeltaToBestLap` directamente, pero NO expone un delta a la
 *   vuelta anterior de forma directa; `LapDeltaToOptimalLap` (delta al
 *   "mejor tiempo posible" combinando los mejores tiempos de sector
 *   individuales, no al mejor tiempo de vuelta completa real) se usa
 *   como aproximación de `delta_to_prev` porque es la única otra señal
 *   de delta en vivo que expone la SDK — una aproximación imperfecta,
 *   documentada como limitación conocida (ver README del bridge).
 * - `tires`: se lee siempre (no es opcional en la práctica para un
 *   piloto real, a diferencia del Generador_Demo donde es opcional por
 *   retrocompatibilidad de fixtures).
 */
export function mapTelemetryEvent(raw: RawTelemetrySnapshot, timestamp: number): TelemetryEventV1 {
  return {
    version_contrato: "1.1.0",
    timestamp,
    type: "telemetry",
    driver_id: "player",
    speed: (raw.Speed.value[0] ?? 0) * 3.6, // m/s -> km/h
    rpm: raw.RPM.value[0] ?? 0,
    gear: Math.round(raw.Gear.value[0] ?? 0),
    throttle: raw.Throttle.value[0] ?? 0,
    brake: raw.Brake.value[0] ?? 0,
    // `SteeringWheelAngle` (rad) puede exceder [-1, 1] rad ampliamente
    // (un volante real gira varias vueltas); se normaliza dividiendo por
    // el mismo rango de ±450° usado como convención de presentación en
    // `SteeringWheel.tsx` (ver ese componente para el razonamiento
    // completo), para que el volante SVG de ambas apps reciba
    // exactamente el mismo rango normalizado `[-1, 1]` que produce el
    // Generador_Demo, sin duplicar la convención de grados en dos capas.
    steering: Math.max(
      -1,
      Math.min(1, ((raw.SteeringWheelAngle.value[0] ?? 0) * (180 / Math.PI)) / 450),
    ),
    fuel_level: raw.FuelLevel.value[0] ?? 0,
    lap_dist_pct: raw.LapDistPct.value[0] ?? 0,
    current_lap_time: Math.max(0, raw.LapCurrentLapTime.value[0] ?? 0),
    last_lap_time: normalizeLapTime(raw.LapLastLapTime.value[0]),
    best_lap_time: normalizeLapTime(raw.LapBestLapTime.value[0]),
    delta_to_best: normalizeDelta(raw.LapDeltaToBestLap.value[0]),
    delta_to_prev: normalizeDelta(raw.LapDeltaToOptimalLap.value[0]),
    position: Math.max(1, Math.round(raw.PlayerCarPosition.value[0] ?? 1)),
    track_temp: raw.TrackTemp.value[0] ?? 0,
    air_temp: raw.AirTemp.value[0] ?? 0,
    tires: {
      fl: mapTireCorner(
        raw.LFtempCM.value[0] ?? 0,
        raw.LFwearM.value[0] ?? 100,
        raw.LFcoldPressure.value[0] ?? 0,
      ),
      fr: mapTireCorner(
        raw.RFtempCM.value[0] ?? 0,
        raw.RFwearM.value[0] ?? 100,
        raw.RFcoldPressure.value[0] ?? 0,
      ),
      rl: mapTireCorner(
        raw.LRtempCM.value[0] ?? 0,
        raw.LRwearM.value[0] ?? 100,
        raw.LRcoldPressure.value[0] ?? 0,
      ),
      rr: mapTireCorner(
        raw.RRtempCM.value[0] ?? 0,
        raw.RRwearM.value[0] ?? 100,
        raw.RRcoldPressure.value[0] ?? 0,
      ),
    },
  };
}

/** `LapLastLapTime`/`LapBestLapTime` devuelven `-1` cuando no hay vuelta registrada (ver SDK); se traduce a `null`, como ya hace el Generador_Demo. */
function normalizeLapTime(value: number | undefined): number | null {
  if (value === undefined || value < 0) return null;
  return value;
}

/** `LapDeltaToBestLap`/`LapDeltaToOptimalLap` devuelven un valor muy negativo (p. ej. -9999996952) cuando no hay comparación posible; se traduce a `null`. */
function normalizeDelta(value: number | undefined): number | null {
  if (value === undefined || value < -1000) return null;
  return value;
}
