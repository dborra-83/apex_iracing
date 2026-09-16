/**
 * PositionGapPanel (tarea 19.3, Requisito 9.5): posición del
 * Piloto_Observado junto con su Gap_Adelante y Gap_Atras.
 *
 * `computeGaps` (`@apex/telemetry-core`) se invoca en `app/page.tsx`
 * (donde se dispone del `Evento_Standings` completo) y este componente
 * solo recibe el resultado ya calculado para ESTE piloto, siguiendo el
 * mismo principio de "los componentes de presentación no recalculan
 * lógica de dominio" que ya usan los paneles del Dashboard.
 *
 * `driverAheadId`/`driverBehindId` son el `driver_id` del piloto
 * inmediatamente delante/detrás en la clasificación (no un cálculo de
 * `@apex/telemetry-core`: se derivan en `app/page.tsx` ordenando
 * `Evento_Standings.drivers` por `position`, el mismo array ya usado para
 * invocar `computeGaps`), para que el piloto sepa CONTRA QUIÉN es ese gap,
 * no solo cuántos segundos es.
 */
export interface PositionGapPanelProps {
  position: number;
  gapAhead: number | null;
  gapBehind: number | null;
  driverAheadId: string | null;
  driverBehindId: string | null;
}

/** Mismo formato que `formatGap` de `PanelClasificacion.tsx`: signo explícito, "—" para `null`/`0`. */
function formatGap(gap: number | null): string {
  if (gap === null || gap === 0) return "—";
  const sign = gap > 0 ? "+" : "";
  return `${sign}${gap.toFixed(3)}`;
}

export default function PositionGapPanel({
  position,
  gapAhead,
  gapBehind,
  driverAheadId,
  driverBehindId,
}: PositionGapPanelProps) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-md border border-border bg-card px-3 py-2">
      <div className="flex flex-col items-center gap-0.5">
        <span
          className="hud-number hud-text-glow text-foreground"
          style={{ fontSize: "clamp(1.5rem, 6vmin, 2.5rem)" }}
        >
          P{position}
        </span>
        <span className="hud-number text-[9px] tracking-[0.15em] text-muted-foreground uppercase">
          Posición
        </span>
      </div>
      <div className="flex flex-col items-center gap-0.5">
        <span className="hud-number text-primary" style={{ fontSize: "clamp(1rem, 4.5vmin, 1.75rem)" }}>
          {formatGap(gapAhead)}
        </span>
        <span className="hud-number text-[9px] tracking-[0.15em] text-muted-foreground uppercase">
          Gap adelante
        </span>
        {driverAheadId !== null && (
          <span className="hud-number text-[10px] text-foreground">{driverAheadId}</span>
        )}
      </div>
      <div className="flex flex-col items-center gap-0.5">
        <span className="hud-number text-primary" style={{ fontSize: "clamp(1rem, 4.5vmin, 1.75rem)" }}>
          {formatGap(gapBehind)}
        </span>
        <span className="hud-number text-[9px] tracking-[0.15em] text-muted-foreground uppercase">
          Gap atrás
        </span>
        {driverBehindId !== null && (
          <span className="hud-number text-[10px] text-foreground">{driverBehindId}</span>
        )}
      </div>
    </div>
  );
}
