import { classifyDelta, statusVar } from "@apex/telemetry-core";

/**
 * LapTimesPanel (tarea 19.2, Requisito 9.4): tiempo de vuelta actual del
 * Piloto_Observado, su mejor vuelta, y los deltas a la vuelta anterior y
 * a la vuelta óptima, todos ya presentes en `Evento_Telemetry` desde la
 * Version_Contrato_1_0 (`current_lap_time`, `best_lap_time`,
 * `delta_to_prev`, `delta_to_best`).
 *
 * El color de cada delta usa `classifyDelta`/`statusVar` de
 * `@apex/telemetry-core` (el mismo vocabulario ok/warning/critical/
 * neutral que el resto de la app), en vez de un mapeo verde/rojo propio
 * de este componente.
 */
export interface LapTimesPanelProps {
  currentLapTime: number;
  bestLapTime: number | null;
  deltaToPrev: number | null;
  deltaToBest: number | null;
}

/** Formatea un tiempo de vuelta en segundos como `m:ss.mmm`, o "—" si es `null`. */
function formatLapTime(seconds: number | null): string {
  if (seconds === null) return "—";
  const minutes = Math.floor(seconds / 60);
  const remainder = seconds - minutes * 60;
  return `${minutes}:${remainder.toFixed(3).padStart(6, "0")}`;
}

/** Formatea un delta con signo explícito, o "—" si es `null` (todavía no calculable). */
function formatDelta(delta: number | null): string {
  if (delta === null) return "—";
  const sign = delta > 0 ? "+" : delta < 0 ? "-" : "";
  return `${sign}${Math.abs(delta).toFixed(3)}`;
}

function deltaColor(delta: number | null): string {
  return statusVar(classifyDelta(delta));
}

interface StatCellProps {
  label: string;
  value: string;
  color?: string;
}

function StatCell({ label, value, color }: StatCellProps) {
  return (
    <div className="flex flex-col items-center gap-0.5">
      <span
        className="hud-number"
        style={{ fontSize: "clamp(1rem, 4.5vmin, 1.75rem)", color: color ?? "var(--primary)" }}
      >
        {value}
      </span>
      <span className="hud-number text-[9px] tracking-[0.15em] text-muted-foreground uppercase">
        {label}
      </span>
    </div>
  );
}

export default function LapTimesPanel({
  currentLapTime,
  bestLapTime,
  deltaToPrev,
  deltaToBest,
}: LapTimesPanelProps) {
  return (
    <div className="grid grid-cols-4 gap-2 rounded-md border border-border bg-card px-2 py-2">
      <StatCell label="Vuelta actual" value={formatLapTime(currentLapTime)} />
      <StatCell label="Mejor vuelta" value={formatLapTime(bestLapTime)} />
      <StatCell
        label="Delta anterior"
        value={formatDelta(deltaToPrev)}
        color={deltaColor(deltaToPrev)}
      />
      <StatCell
        label="Delta óptima"
        value={formatDelta(deltaToBest)}
        color={deltaColor(deltaToBest)}
      />
    </div>
  );
}
