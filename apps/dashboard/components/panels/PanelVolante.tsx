"use client";

import { PanelHeader } from "@/components/hud/PanelHeader";
import SteeringWheel from "@/components/hud/SteeringWheel";
import { useTelemetryStore } from "@/lib/store/telemetryStore";

/**
 * Panel_Volante: ángulo de giro instantáneo del volante del piloto
 * observado (`Evento_Telemetry.steering`), representado como un volante
 * SVG rotado (ver `SteeringWheel.tsx`).
 *
 * No forma parte de los 5 paneles originales: `steering` ya viajaba en
 * cada `Evento_Telemetry` desde `iracing-telemetry-platform` (sin
 * cambios de estructura), pero no tenía ninguna visualización propia en
 * el Dashboard.
 */
export default function PanelVolante() {
  const telemetry = useTelemetryStore((state) => state.latestEvent);

  return (
    <div className="flex h-full flex-col items-center justify-center gap-2 p-4">
      <PanelHeader className="w-full" title="Volante" />
      {telemetry === null ? (
        <div className="flex flex-1 items-center justify-center text-muted-foreground">
          Esperando datos de telemetría...
        </div>
      ) : (
        <div className="flex flex-1 items-center justify-center">
          <SteeringWheel steering={telemetry.steering} size={96} />
        </div>
      )}
    </div>
  );
}
