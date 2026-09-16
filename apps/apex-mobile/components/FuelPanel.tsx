/**
 * FuelPanel (tarea 19.4, Requisito 9.6): combustible restante del
 * Piloto_Observado y una estimación de sus vueltas restantes.
 *
 * `deriveFuelConsumptionRate`/`estimateRemainingLaps`
 * (`@apex/telemetry-core`) se invocan en `app/page.tsx` (donde vive el
 * hook `useFuelHistory`, ver más abajo), y este componente solo recibe
 * los valores ya calculados, siguiendo el mismo patrón que
 * `apps/dashboard/components/panels/PanelFuel.tsx` v1.0.0.
 */
export interface FuelPanelProps {
  fuelLevel: number;
  estimatedRemainingLaps: number;
}

/** Misma referencia de capacidad de depósito que `apps/dashboard/components/panels/PanelFuel.tsx`. */
const FUEL_TANK_CAPACITY = 100;

function formatRemainingLaps(remainingLaps: number): string {
  return remainingLaps === Infinity ? "no disponible" : remainingLaps.toFixed(1);
}

export default function FuelPanel({ fuelLevel, estimatedRemainingLaps }: FuelPanelProps) {
  const fuelPct = Math.min(100, Math.max(0, (fuelLevel / FUEL_TANK_CAPACITY) * 100));

  return (
    <div className="flex items-center justify-between gap-3 rounded-md border border-border bg-card px-3 py-2">
      <div className="flex flex-col items-center gap-0.5">
        <span
          className="hud-number text-primary"
          style={{ fontSize: "clamp(1.25rem, 5.5vmin, 2rem)" }}
        >
          {fuelLevel.toFixed(1)}
        </span>
        <span className="hud-number text-[9px] tracking-[0.15em] text-muted-foreground uppercase">
          Combustible
        </span>
        <div
          className="mt-1 h-1.5 w-16 overflow-hidden rounded-full bg-muted"
          role="progressbar"
          aria-label="Nivel de combustible"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={Math.round(fuelPct)}
        >
          <div
            className="h-full rounded-full bg-primary"
            style={{ width: `${fuelPct}%` }}
          />
        </div>
      </div>
      <div className="flex flex-col items-center gap-0.5">
        <span
          className="hud-number text-primary"
          style={{ fontSize: "clamp(1.25rem, 5.5vmin, 2rem)" }}
        >
          {formatRemainingLaps(estimatedRemainingLaps)}
        </span>
        <span className="hud-number text-[9px] tracking-[0.15em] text-muted-foreground uppercase">
          Vueltas restantes
        </span>
      </div>
    </div>
  );
}
