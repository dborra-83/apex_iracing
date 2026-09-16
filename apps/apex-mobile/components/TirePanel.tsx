import type { TireCornerV1, TireStateV1 } from "@apex/contrato-datos";
import TireIcon from "@/components/TireIcon";

/**
 * TirePanel: estado de los 4 neumáticos del Piloto_Observado, dispuestos
 * en una cuadrícula 2x2 que imita la posición real de las ruedas en el
 * auto (DI/DD arriba, TI/TD abajo), cada uno como un `TireIcon` (gráfico
 * de neumático, no solo texto) — reemplaza el layout anterior en fila de
 * 4 barras de progreso por una representación visual más reconocible.
 *
 * No forma parte de los 7 elementos originales del Requisito 9 de la
 * especificación `apex-mobile-and-dashboard-expansion`: se añade a partir
 * del campo opcional `tires` de `Evento_Telemetry`.
 */
export interface TirePanelProps {
  tires: TireStateV1 | undefined;
}

interface CornerCellProps {
  label: string;
  corner: TireCornerV1;
}

function CornerCell({ label, corner }: CornerCellProps) {
  return (
    <div className="flex flex-col items-center gap-0.5">
      <TireIcon temp={corner.temp} wear={corner.wear} size={48} />
      <span className="hud-number text-[9px] tracking-[0.15em] text-muted-foreground uppercase">
        {label}
      </span>
      <span className="hud-number text-[10px] text-foreground">{corner.temp.toFixed(0)}°</span>
    </div>
  );
}

export default function TirePanel({ tires }: TirePanelProps) {
  return (
    <div className="rounded-md border border-border bg-card px-3 py-2">
      <span className="hud-number text-[9px] tracking-[0.15em] text-muted-foreground uppercase">
        Neumáticos
      </span>
      {tires === undefined ? (
        <p className="hud-number mt-1 text-xs text-muted-foreground">no disponible</p>
      ) : (
        <div className="mt-1 grid grid-cols-2 gap-x-6 gap-y-2 justify-center">
          <CornerCell label="DI" corner={tires.fl} />
          <CornerCell label="DD" corner={tires.fr} />
          <CornerCell label="TI" corner={tires.rl} />
          <CornerCell label="TD" corner={tires.rr} />
        </div>
      )}
    </div>
  );
}
