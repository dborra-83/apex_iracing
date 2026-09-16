import { useMemo } from "react";
import { statusVar, type StatusLevel } from "@apex/telemetry-core";

/**
 * Speedometer (tarea 19.1, Requisito 9.1, 9.2): velocímetro circular con
 * la velocidad instantánea del Piloto_Observado y shift lights derivados
 * de `rpm`.
 *
 * **Escala de velocidad:** el Contrato_Datos no define un máximo
 * explícito para `speed` (solo `>= 0`, ver
 * `packages/contrato-datos/src/v1/telemetry.ts`), y el Generador_Demo la
 * deriva en un rango típico de circuito (~170-230 km/h, ver
 * `apps/generador-demo/src/simulation/events.ts`). Se usa
 * `MAX_SPEED_KMH = 300` como techo de la escala del arco: suficientemente
 * amplio para no saturar visualmente con los valores típicos del
 * Generador_Demo, pero también plausible para una futura fuente de datos
 * real (el bridge real de iRacing SDK está fuera de alcance, pero no hay
 * razón para acoplar la escala del gauge a los valores exactos de la
 * simulación demo). Los valores que excedan el techo se clampan
 * visualmente (el arco no se desborda), sin alterar el valor numérico
 * mostrado en el centro.
 *
 * **Shift lights (Requisito 9.2):** el Generador_Demo (y, en general, el
 * dominio de este producto) usa un rango de `rpm` de `[1000, 7000]` (ver
 * `apps/generador-demo/src/simulation/events.ts`). Las shift lights se
 * derivan como un porcentaje fijo de ESE rango (no un valor absoluto de
 * RPM hardcodeado), tal como especifica design.md ("Shift lights"): verde
 * por debajo del 70% del rango, amarillo entre 70% y 85%, rojo entre 85%
 * y 95%, y todas las luces parpadeando (vía la clase CSS `animate-pulse`
 * de Tailwind) por encima del 95% (RPM límite, momento de cambiar de
 * marcha). Es una función pura de presentación sobre `rpm`, sin depender
 * de ningún campo nuevo del Contrato_Datos ni de `@apex/telemetry-core`
 * (que solo aloja cálculos de dominio, no de renderizado — ver design.md,
 * "Shift lights").
 */
export interface SpeedometerProps {
  speedKmh: number;
  rpm: number;
}

const MAX_SPEED_KMH = 300;
const MIN_RPM = 1000;
const MAX_RPM = 7000;
const SHIFT_LIGHT_COUNT = 5;

/** Arco del gauge: de -220° a +40° (barre 260° en sentido horario), dejando el hueco inferior para la lectura numérica. */
const ARC_START_DEG = -220;
const ARC_SWEEP_DEG = 260;

/**
 * El color de cada luz usa el vocabulario `StatusLevel` compartido
 * (`@apex/telemetry-core`): `"ok"` (verde/`--success`) en el 70%
 * inferior del rango, `"warning"` (ámbar) hasta el 85%, `"critical"`
 * (rojo) por encima — el mismo sistema que colorea deltas de vuelta,
 * bloqueo de freno y neumáticos, en vez de un enum de color local.
 */
interface ShiftLightState {
  level: StatusLevel;
  lit: boolean;
  blinking: boolean;
}

/**
 * Determina el estado de las `SHIFT_LIGHT_COUNT` luces a partir del
 * porcentaje de `rpm` dentro de `[MIN_RPM, MAX_RPM]`: cada luz se
 * enciende progresivamente (como una barra de LEDs, no todas a la vez) a
 * medida que el porcentaje avanza, con el color determinado por el umbral
 * en el que esa luz se encuentra (verde/amarillo/rojo). Por encima del
 * 95% del rango, todas las luces encendidas parpadean para señalar el
 * límite de RPM.
 */
function computeShiftLights(rpm: number): ShiftLightState[] {
  const clamped = Math.min(MAX_RPM, Math.max(MIN_RPM, rpm));
  const pct = (clamped - MIN_RPM) / (MAX_RPM - MIN_RPM);
  const blinking = pct >= 0.95;

  return Array.from({ length: SHIFT_LIGHT_COUNT }, (_, i) => {
    // Umbral de encendido progresivo de la luz i: 0%, 20%, 40%, 60%, 80%
    // del rango de RPM (barra de LEDs que se llena de izquierda a
    // derecha, no todas a la vez).
    const litThreshold = i / SHIFT_LIGHT_COUNT;
    const lit = pct >= litThreshold;
    // Color por posición de la luz en la barra (independiente de si está
    // encendida): verde en el 70% inferior, amarillo en el siguiente 15%,
    // rojo en el 15% superior.
    const lightPositionPct = (i + 1) / SHIFT_LIGHT_COUNT;
    const level: StatusLevel =
      lightPositionPct <= 0.7 ? "ok" : lightPositionPct <= 0.85 ? "warning" : "critical";

    return { level, lit, blinking: blinking && lit };
  });
}

function polarToCartesian(cx: number, cy: number, r: number, angleDeg: number) {
  const angleRad = (angleDeg * Math.PI) / 180;
  return { x: cx + r * Math.cos(angleRad), y: cy + r * Math.sin(angleRad) };
}

function describeArc(cx: number, cy: number, r: number, startDeg: number, endDeg: number): string {
  const start = polarToCartesian(cx, cy, r, startDeg);
  const end = polarToCartesian(cx, cy, r, endDeg);
  const largeArcFlag = endDeg - startDeg <= 180 ? 0 : 1;
  return `M ${start.x} ${start.y} A ${r} ${r} 0 ${largeArcFlag} 1 ${end.x} ${end.y}`;
}

export default function Speedometer({ speedKmh, rpm }: SpeedometerProps) {
  const shiftLights = useMemo(() => computeShiftLights(rpm), [rpm]);

  const speedPct = Math.min(1, Math.max(0, speedKmh / MAX_SPEED_KMH));
  const sweepEndDeg = ARC_START_DEG + ARC_SWEEP_DEG * speedPct;

  const size = 100;
  const cx = size / 2;
  const cy = size / 2;
  const r = 42;

  const trackPath = describeArc(cx, cy, r, ARC_START_DEG, ARC_START_DEG + ARC_SWEEP_DEG);
  const fillPath = describeArc(cx, cy, r, ARC_START_DEG, sweepEndDeg);

  return (
    <div className="flex flex-col items-center gap-1">
      {/* Shift lights (Requisito 9.2): fila de LEDs sobre el velocímetro. */}
      <div className="flex items-center gap-1.5" role="img" aria-label={`RPM ${Math.round(rpm)}`}>
        {shiftLights.map((light, i) => (
          <span
            key={i}
            className={`h-2.5 w-5 rounded-sm border border-border/60 ${
              light.lit && light.blinking ? "animate-pulse" : ""
            }`}
            style={{
              backgroundColor: light.lit ? statusVar(light.level) : "var(--muted)",
              boxShadow: light.lit ? `0 0 8px 1px ${statusVar(light.level)}` : undefined,
            }}
          />
        ))}
      </div>

      <div className="relative" style={{ width: "min(60vmin, 280px)", height: "min(60vmin, 280px)" }}>
        <svg viewBox={`0 0 ${size} ${size}`} className="h-full w-full" role="img" aria-label={`Velocidad ${Math.round(speedKmh)} km/h`}>
          <path
            d={trackPath}
            fill="none"
            stroke="var(--muted)"
            strokeWidth={6}
            strokeLinecap="round"
          />
          <path
            d={fillPath}
            fill="none"
            stroke="var(--primary)"
            strokeWidth={6}
            strokeLinecap="round"
            style={{ filter: "drop-shadow(0 0 4px var(--primary))" }}
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span
            className="hud-number hud-text-glow text-foreground"
            style={{ fontSize: "clamp(2rem, 10vmin, 3.5rem)", lineHeight: 1 }}
          >
            {Math.round(speedKmh)}
          </span>
          <span className="hud-number text-xs tracking-[0.2em] text-muted-foreground uppercase">
            km/h
          </span>
        </div>
      </div>
    </div>
  );
}
