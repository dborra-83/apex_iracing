import { useEffect, useRef, useState } from "react";

/**
 * Número máximo de muestras de `fuel_level` por vuelta conservadas.
 * Mismo valor que `MAX_FUEL_HISTORY_LAPS` (antes definido localmente en
 * `PanelFuel.tsx`, ahora compartido porque `AppHeader` también lo
 * necesita para su stat compacto de "vueltas restantes" del piloto
 * observado).
 */
const MAX_FUEL_HISTORY_LAPS = 10;

/**
 * Hook que deriva un historial de `fuel_level` "por vuelta" a partir del
 * flujo de `Evento_Telemetry` del piloto observado, para alimentar
 * `deriveFuelConsumptionRate`.
 *
 * Extraído de `PanelFuel.tsx` a un hook compartido: `AppHeader` (stats
 * compactos de combustible/vueltas restantes) y `PanelFuel` (estimación
 * de vueltas restantes, si se necesitara de nuevo) pueden reutilizar la
 * misma lógica de detección de vuelta completada sin duplicarla.
 *
 * El `Evento_Telemetry` no incluye un número de vuelta explícito, pero
 * `last_lap_time` cambia de valor exactamente cuando el piloto observado
 * cruza la línea de meta. Se detecta esa transición comparando el
 * `last_lap_time` del evento actual contra el último valor visto
 * (guardado en un `useRef` para no disparar renders adicionales) y, al
 * detectarla, se añade el `fuel_level` del evento actual al historial.
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
