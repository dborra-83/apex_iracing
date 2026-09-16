/**
 * ThrottleBrakePanel: barras de uso de throttle/brake en tiempo real del
 * Piloto_Observado, más una luz de "posible bloqueo de freno".
 *
 * No forma parte de los 7 elementos originales del Requisito 9 de la
 * especificación `apex-mobile-and-dashboard-expansion`, pero `throttle` y
 * `brake` ya viajan en cada `Evento_Telemetry` (Version_Contrato_1_0, sin
 * cambios) y no tenían ninguna visualización en Apex Mobile — a
 * diferencia del Dashboard, que sí dibuja su trace histórico completo en
 * `Panel_Telemetria`. Aquí, en cambio, solo se muestra el valor
 * INSTANTÁNEO como dos barras verticales, consistente con el resto de la
 * Pantalla_Principal (paneles compactos de un vistazo, no un gráfico
 * histórico).
 *
 * **Luz de "posible bloqueo de freno":** el Contrato_Datos no modela
 * velocidad de rueda individual ni un sensor de bloqueo real (el
 * Generador_Demo no simula físicamente el frenado, ver
 * `apps/generador-demo/src/simulation/events.ts`), por lo que esta luz
 * NO es una detección física de bloqueo. Es, deliberadamente, una
 * heurística de presentación (mismo criterio ya documentado para las
 * shift lights del `Speedometer`: "función pura de presentación... no un
 * cálculo de dominio"): usa `classifyBrakeLockRisk`/`statusVar` de
 * `@apex/telemetry-core` (mismo vocabulario ok/warning/critical/neutral
 * que el resto de la app, umbrales por defecto `0.7`/`0.85`) para
 * graduar la advertencia en tres niveles (sin riesgo / riesgo leve /
 * bloqueo probable) en vez de un único umbral binario. No requiere
 * ningún campo nuevo del Contrato_Datos.
 */
import { classifyBrakeLockRisk, statusVar } from "@apex/telemetry-core";

export interface ThrottleBrakePanelProps {
  throttle: number;
  brake: number;
}

interface BarProps {
  label: string;
  value: number;
  color: string;
}

function Bar({ label, value, color }: BarProps) {
  const pct = Math.min(100, Math.max(0, value * 100));
  return (
    <div className="flex flex-1 flex-col items-center gap-1">
      <div
        className="relative h-24 w-6 overflow-hidden rounded-sm border border-border bg-muted"
        role="progressbar"
        aria-label={label}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(pct)}
      >
        <div
          className="absolute inset-x-0 bottom-0 rounded-sm transition-[height] duration-75"
          style={{ height: `${pct}%`, backgroundColor: color }}
        />
      </div>
      <span className="hud-number text-[9px] tracking-[0.15em] text-muted-foreground uppercase">
        {label}
      </span>
    </div>
  );
}

export default function ThrottleBrakePanel({ throttle, brake }: ThrottleBrakePanelProps) {
  const lockRisk = classifyBrakeLockRisk(brake);
  const lockColor = statusVar(lockRisk);
  const possibleLockup = lockRisk === "critical";

  return (
    <div className="flex items-center justify-around gap-3 rounded-md border border-border bg-card px-3 py-2">
      <Bar label="Throttle" value={throttle} color="var(--primary)" />
      <Bar label="Brake" value={brake} color={lockColor} />

      <div className="flex flex-col items-center gap-1">
        <span
          className={`block size-5 rounded-full border ${possibleLockup ? "animate-pulse" : ""}`}
          style={{
            backgroundColor: lockRisk === "ok" ? "var(--muted)" : lockColor,
            borderColor: lockRisk === "ok" ? "var(--border)" : lockColor,
            boxShadow: possibleLockup ? `0 0 10px 3px ${lockColor}` : undefined,
          }}
          role="status"
          aria-label={
            possibleLockup ? "Posible bloqueo de freno" : "Sin bloqueo de freno detectado"
          }
        />
        <span className="hud-number text-[9px] tracking-[0.15em] text-muted-foreground uppercase">
          Bloqueo
        </span>
      </div>
    </div>
  );
}
