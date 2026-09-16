/**
 * Tipos mínimos propios para leer del SDK de iRacing sin acoplar el resto
 * del bridge a la forma exacta de `irsdk-node`/`@irsdk-node/types`.
 *
 * `irsdk-node` expone cada variable de telemetría como un objeto
 * `{ value: number[] | boolean[], ... }` (siempre un array, incluso para
 * variables escalares de longitud 1) y la SessionInfo como YAML ya
 * parseado a un árbol de objetos JS con claves específicas por versión
 * de iRacing. Estos tipos capturan solo la forma que este bridge
 * realmente consume, no el catálogo completo (>1000 variables) de
 * `@irsdk-node/types`.
 */

export interface RawTelemetryVar<T = number> {
  value: T[];
}

/**
 * Subconjunto de `TelemetryVarList` (`@irsdk-node/types`) efectivamente
 * leído por `mapping/telemetry.ts`. Los nombres coinciden exactamente con
 * las variables reales del SDK (confirmadas contra
 * `@irsdk-node/types@4.4.0`, instalado en este monorepo) — ver comentario
 * de cada campo en `mapping/telemetry.ts` para su significado y unidad.
 */
export interface RawTelemetrySnapshot {
  Speed: RawTelemetryVar;
  RPM: RawTelemetryVar;
  Gear: RawTelemetryVar;
  Throttle: RawTelemetryVar;
  Brake: RawTelemetryVar;
  SteeringWheelAngle: RawTelemetryVar;
  FuelLevel: RawTelemetryVar;
  LapDistPct: RawTelemetryVar;
  LapCurrentLapTime: RawTelemetryVar;
  LapLastLapTime: RawTelemetryVar;
  LapBestLapTime: RawTelemetryVar;
  LapDeltaToBestLap: RawTelemetryVar;
  LapDeltaToOptimalLap: RawTelemetryVar;
  TrackTemp: RawTelemetryVar;
  AirTemp: RawTelemetryVar;
  PlayerCarPosition: RawTelemetryVar;

  SessionFlags: RawTelemetryVar;
  SessionTimeRemain: RawTelemetryVar;
  SessionLapsRemainEx: RawTelemetryVar;
  SessionState: RawTelemetryVar;
  Skies: RawTelemetryVar;
  Precipitation: RawTelemetryVar;
  PlayerCarMyIncidentCount: RawTelemetryVar;

  CarIdxPosition: RawTelemetryVar;
  CarIdxClassPosition: RawTelemetryVar;
  CarIdxLapDistPct: RawTelemetryVar;
  CarIdxOnPitRoad: RawTelemetryVar<boolean>;
  CarIdxF2Time: RawTelemetryVar;
  CarIdxLastLapTime: RawTelemetryVar;
  CarIdxBestLapTime: RawTelemetryVar;
  CarIdxTrackSurface: RawTelemetryVar;

  LFtempCM: RawTelemetryVar;
  RFtempCM: RawTelemetryVar;
  LRtempCM: RawTelemetryVar;
  RRtempCM: RawTelemetryVar;
  LFwearM: RawTelemetryVar;
  RFwearM: RawTelemetryVar;
  LRwearM: RawTelemetryVar;
  RRwearM: RawTelemetryVar;
  LFcoldPressure: RawTelemetryVar;
  RFcoldPressure: RawTelemetryVar;
  LRcoldPressure: RawTelemetryVar;
  RRcoldPressure: RawTelemetryVar;
}

/**
 * Subconjunto de la `SessionInfo` (YAML de sesión, no telemetría de alta
 * frecuencia) que el bridge necesita: nombre/longitud de pista y
 * definición de sectores ("splits"). La forma exacta de este árbol la
 * define iRacing (no `@irsdk-node/types`, que solo tipa el nivel más
 * externo como `unknown`/genérico), así que se modela aquí como el
 * subconjunto mínimo que este bridge lee, con todos los niveles
 * intermedios opcionales — un YAML de sesión real que no tenga
 * exactamente esta forma (versión de iRacing distinta, sesión sin
 * splits configurados) no debe hacer que el bridge lance, solo que
 * `mapping/track.ts` use sus valores de reserva documentados.
 */
export interface RawSessionInfo {
  WeekendInfo?: {
    TrackDisplayName?: string;
    TrackLength?: string; // p. ej. "3.70 km"
  };
  SplitTimeInfo?: {
    Sectors?: Array<{ SectorNum?: number; SectorStartPct?: number }>;
  };
}
