import { classifyDelta, statusVar, type SectorComparison } from "@apex/telemetry-core";

/**
 * SectorTimesPanel: parciales por sector del Piloto_Observado, comparando
 * el tiempo del sector de la última vuelta completada contra su propio
 * mejor tiempo histórico en ese sector.
 *
 * `sectorComparison` se calcula en `app/page.tsx` invocando
 * `compareSectorTimes` (`@apex/telemetry-core`, ya usada por
 * `apps/dashboard/components/panels/PanelTelemetria.tsx` para la
 * Comparativa_Sectores contra un rival) con
 * `best_sector_times` como referencia y `last_sector_times` como "rival":
 * es una reutilización deliberada de la misma función pura para una
 * comparación distinta (propio vs. propio, no observado vs. rival), sin
 * reimplementar la lógica de comparación índice a índice ni el manejo de
 * `null`.
 *
 * Solo disponible cuando el `Evento_Standings` es Version_Contrato_1_1
 * (única versión que porta `last_sector_times`/`best_sector_times` por
 * piloto); ante un evento v1.0.0 este panel recibe `null` y muestra su
 * estado "no disponible" (Requisito 13.1, mismo criterio ya aplicado al
 * `MiniMap` con Rivales_Cercanos).
 */
export interface SectorTimesPanelProps {
  sectorComparison: SectorComparison[] | null;
}

/** Mismo formato que `formatSectorTime` de `PanelTelemetria.tsx`. */
function formatSectorTime(seconds: number | null): string {
  if (seconds === null) return "—";
  return seconds.toFixed(3);
}

/**
 * Color del parcial: usa `classifyDelta`/`statusVar` de
 * `@apex/telemetry-core` (mismo vocabulario ok/warning/critical/neutral
 * del resto de la app), en vez de un mapeo verde/rojo propio.
 */
function deltaColor(deltaSeconds: number | null): string {
  return statusVar(classifyDelta(deltaSeconds));
}

export default function SectorTimesPanel({ sectorComparison }: SectorTimesPanelProps) {
  return (
    <div className="rounded-md border border-border bg-card px-3 py-2">
      <span className="hud-number text-[9px] tracking-[0.15em] text-muted-foreground uppercase">
        Parciales por sector
      </span>
      {sectorComparison === null ? (
        <p className="hud-number mt-1 text-xs text-muted-foreground">no disponible</p>
      ) : (
        <div className="mt-1 flex items-center justify-between gap-2">
          {sectorComparison.map((sector) => (
            <div key={sector.sectorIndex} className="flex flex-col items-center gap-0.5">
              <span className="hud-number text-[10px] text-muted-foreground">
                S{sector.sectorIndex + 1}
              </span>
              <span
                className="hud-number text-sm"
                style={{ color: deltaColor(sector.deltaSeconds) }}
              >
                {formatSectorTime(sector.rivalTime)}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
