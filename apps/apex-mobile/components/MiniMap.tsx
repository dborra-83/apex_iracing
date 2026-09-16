import { useMemo } from "react";
import type { TrackPointV1 } from "@apex/contrato-datos";
import { lapPctToPoint } from "@apex/telemetry-core";

/**
 * MiniMap (tarea 19.5, Requisito 9.7, 10.1, 10.2, 10.3, 10.4): trazado del
 * circuito con la posición del Piloto_Observado y sus Rivales_Cercanos.
 *
 * `nearestRivals` (`@apex/telemetry-core`) se invoca en `app/page.tsx`
 * (donde se dispone del `Evento_Standings` completo); este componente
 * solo proyecta con `lapPctToPoint` los puntos ya seleccionados como
 * rivales cercanos, sin recalcular la selección de rivales.
 */
export interface MiniMapRivalPosition {
  driverId: string;
  lapDistPct: number;
}

export interface MiniMapProps {
  path: TrackPointV1[];
  observedLapDistPct: number;
  rivals: MiniMapRivalPosition[];
}

const VIEWBOX_PADDING_RATIO = 0.08;

function computeViewBox(path: TrackPointV1[]): string {
  const xs = path.map((p) => p.x);
  const ys = path.map((p) => p.y);
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);
  const width = maxX - minX || 1;
  const height = maxY - minY || 1;
  const padX = width * VIEWBOX_PADDING_RATIO;
  const padY = height * VIEWBOX_PADDING_RATIO;
  return `${minX - padX} ${minY - padY} ${width + padX * 2} ${height + padY * 2}`;
}

export default function MiniMap({ path, observedLapDistPct, rivals }: MiniMapProps) {
  const viewBox = useMemo(() => computeViewBox(path), [path]);
  const pathPoints = useMemo(
    () => path.map((p) => `${p.x},${p.y}`).join(" "),
    [path],
  );
  const observedPoint = useMemo(
    () => lapPctToPoint(path, observedLapDistPct),
    [path, observedLapDistPct],
  );
  const rivalPoints = useMemo(
    () =>
      rivals.map((rival) => ({
        driverId: rival.driverId,
        point: lapPctToPoint(path, rival.lapDistPct),
      })),
    [path, rivals],
  );

  return (
    <div className="relative min-h-0 flex-1 overflow-hidden rounded-md border border-border bg-card">
      <svg
        viewBox={viewBox}
        className="absolute inset-0 h-full w-full"
        preserveAspectRatio="xMidYMid meet"
        role="img"
        aria-label="Mini-mapa del circuito con posición propia y rivales cercanos"
      >
        <polygon
          points={pathPoints}
          fill="none"
          stroke="var(--muted-foreground)"
          strokeOpacity={0.5}
          strokeWidth={1.5}
        />

        {rivalPoints.map((rival) => (
          <circle
            key={rival.driverId}
            cx={rival.point.x}
            cy={rival.point.y}
            r={2.2}
            fill="var(--muted-foreground)"
          />
        ))}

        <circle
          cx={observedPoint.x}
          cy={observedPoint.y}
          r={3}
          fill="var(--primary)"
          stroke="var(--foreground)"
          strokeWidth={0.6}
          style={{ filter: "drop-shadow(0 0 3px var(--primary))" }}
        />
      </svg>
    </div>
  );
}
