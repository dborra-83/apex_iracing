"use client";

import type { TireCornerV1 } from "@apex/contrato-datos";
import { PanelHeader } from "@/components/hud/PanelHeader";
import TireIcon from "@/components/hud/TireIcon";
import { useTelemetryStore } from "@/lib/store/telemetryStore";

/**
 * Panel_Neumaticos: estado de los 4 neumáticos (temperatura, presión,
 * desgaste) del piloto observado, dispuestos en una cuadrícula 2x2 que
 * imita la posición real de las ruedas en el auto (DI/DD arriba, TI/TD
 * abajo), cada uno representado con `TireIcon` (gráfico de neumático) en
 * vez de solo una barra de progreso numérica.
 *
 * No forma parte de los 5 paneles originales de `iracing-telemetry-
 * platform`/`apex-mobile-and-dashboard-expansion`: se añade a partir del
 * campo `tires` (opcional, aditivo) de `TelemetryEventV1`. Al ser
 * opcional, un Evento_Telemetry sin `tires` SHALL mostrar el estado "no
 * disponible" de este panel en vez de asumir valores por defecto.
 */

interface TireCornerCardProps {
  label: string;
  corner: TireCornerV1;
}

function TireCornerCard({ label, corner }: TireCornerCardProps) {
  return (
    <div className="flex flex-col items-center gap-1 rounded-md border border-border bg-card p-2">
      <TireIcon temp={corner.temp} wear={corner.wear} size={56} />
      <span className="hud-number text-[11px] tracking-[0.16em] text-muted-foreground uppercase">
        {label}
      </span>
      <span className="hud-number text-sm text-foreground">{corner.temp.toFixed(0)}°C</span>
      <span className="hud-number text-xs text-muted-foreground">
        {corner.pressure.toFixed(1)} psi · {Math.round(corner.wear * 100)}%
      </span>
    </div>
  );
}

export default function PanelNeumaticos() {
  const telemetry = useTelemetryStore((state) => state.latestEvent);
  const tires = telemetry?.tires;

  return (
    <div className="flex h-full flex-col gap-2 p-4">
      <PanelHeader title="Neumáticos" />
      {tires === undefined ? (
        <div className="flex flex-1 items-center justify-center text-muted-foreground">
          {telemetry === null
            ? "Esperando datos de telemetría..."
            : "Datos de neumáticos no disponibles para este Evento_Telemetry."}
        </div>
      ) : (
        <div className="grid flex-1 grid-cols-2 gap-2">
          <TireCornerCard label="DI" corner={tires.fl} />
          <TireCornerCard label="DD" corner={tires.fr} />
          <TireCornerCard label="TI" corner={tires.rl} />
          <TireCornerCard label="TD" corner={tires.rr} />
        </div>
      )}
    </div>
  );
}
