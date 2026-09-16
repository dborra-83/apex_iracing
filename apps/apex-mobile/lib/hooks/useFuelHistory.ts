import { useEffect, useRef, useState } from "react";

/**
 * Número máximo de muestras de `fuel_level` por vuelta conservadas, igual
 * criterio que `MAX_FUEL_HISTORY_LAPS` de
 * `apps/dashboard/components/panels/PanelFuel.tsx`.
 */
const MAX_FUEL_HISTORY_LAPS = 10;

/**
 * Hook que deriva un historial de `fuel_level` "por vuelta" a partir del
 * flujo de `Evento_Telemetry` del Piloto_Observado, para alimentar
 * `deriveFuelConsumptionRate` (Requisito 9.6).
 *
 * Reimplementación idéntica de `useFuelHistory` de
 * `apps/dashboard/components/panels/PanelFuel.tsx` para Apex Mobile: el
 * `Evento_Telemetry` no incluye un número de vuelta explícito, pero
 * `last_lap_time` cambia de valor exactamente cuando el piloto observado
 * cruza la línea de meta. Se detecta esa transición comparando el
 * `last_lap_time` del evento actual contra el último valor visto y, al
 * detectarla, se añade el `fuel_level` actual al historial.
 */
export function useFuelHistory(
  fuelLevel: number | undefined,
  lastLapTime: number | null | undefined,
): number[] {
  const [history, setHistory] = useState<number[]>([]);
  const prevLastLapTimeRef = useRef<number | null>(null);

  useEffect(() => {
    if (fuelLevel === undefined || lastLapTime === undefined || lastLapTime === null) {
      return;
    }
    if (prevLastLapTimeRef.current === lastLapTime) {
      return;
    }
    prevLastLapTimeRef.current = lastLapTime;
    setHistory((prev) => {
      const next = [...prev, fuelLevel];
      return next.length > MAX_FUEL_HISTORY_LAPS
        ? next.slice(-MAX_FUEL_HISTORY_LAPS)
        : next;
    });
  }, [fuelLevel, lastLapTime]);

  return history;
}
