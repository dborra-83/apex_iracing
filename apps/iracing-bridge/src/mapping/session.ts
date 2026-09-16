import type { RawTelemetrySnapshot } from "../sdk/types";
import type { SessionEventV1, WeatherV1 } from "@apex/contrato-datos";
import { mapFlag } from "./flags";

/**
 * `Skies` (`@irsdk-node/types`, `TelemetryVarList.Skies`): entero
 * `0=clear/1=partly cloudy/2=mostly cloudy/3=overcast`, tal como lo
 * documenta la SDK oficial (ver
 * [iRacing Telemetry Documentation](https://gist.github.com/teknologika/0127fa9a031ec686537277a954972ad0),
 * sección "Weather and Environment"). `WeatherV1` (Contrato_Datos) solo
 * distingue 4 categorías (`clear`/`cloudy`/`light_rain`/`heavy_rain`),
 * más simples que las de iRacing: se colapsan las 3 variantes de
 * nubosidad de iRacing (`1`/`2`/`3`) en una única `"cloudy"`, ya que el
 * Contrato_Datos no distingue grados de nubosidad, y se prioriza
 * `Precipitation` por encima de `Skies` cuando hay lluvia detectada (una
 * sesión puede estar "overcast" y lloviendo a la vez; para el HUD, la
 * lluvia es la información más urgente).
 */
function mapWeather(skies: number, precipitationPct: number): WeatherV1 {
  if (precipitationPct >= 0.4) return "heavy_rain";
  if (precipitationPct > 0) return "light_rain";
  if (skies >= 1) return "cloudy";
  return "clear";
}

/**
 * Construye el Evento_Session a partir del snapshot crudo de telemetría.
 *
 * `SessionLapsRemainEx` es el valor recomendado por la SDK sobre el
 * deprecado `SessionLapsRemain` (ver comentario en
 * `sdk/types.ts`/`telemetry.gen.d.ts`); se reporta como `null` cuando
 * iRacing devuelve `UNLIMITED_LAPS_COUNT` (32767, sesión sin límite de
 * vueltas — típicamente una sesión con límite de tiempo en su lugar),
 * igual criterio que `SessionTimeRemain` con `UNLIMITED_TIME_VALUE`
 * (604800s = 7 días, el valor "sin límite" de tiempo).
 */
export function mapSessionEvent(raw: RawTelemetrySnapshot, timestamp: number): SessionEventV1 {
  const UNLIMITED_LAPS = 32767;
  const UNLIMITED_TIME_S = 604800;

  const lapsRemainRaw = raw.SessionLapsRemainEx.value[0] ?? UNLIMITED_LAPS;
  const timeRemainRaw = raw.SessionTimeRemain.value[0] ?? UNLIMITED_TIME_S;

  return {
    version_contrato: "1.1.0",
    timestamp,
    type: "session",
    session_type: "race",
    weather: mapWeather(raw.Skies.value[0] ?? 0, raw.Precipitation.value[0] ?? 0),
    flag: mapFlag(raw.SessionFlags.value[0] ?? 0),
    time_remaining_s: timeRemainRaw >= UNLIMITED_TIME_S ? null : timeRemainRaw,
    laps_remaining: lapsRemainRaw >= UNLIMITED_LAPS ? null : Math.round(lapsRemainRaw),
    incidents: Math.round(raw.PlayerCarMyIncidentCount.value[0] ?? 0),
  };
}
