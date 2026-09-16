"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type {
  StandingsEntryV1_1,
  StandingsEventV1,
  StandingsEventV1_1,
} from "@apex/contrato-datos";
import { PanelHeader } from "@/components/hud/PanelHeader";
import { useStandingsStore } from "@/lib/store/standingsStore";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  estimateStintForAllDrivers,
  type DriverStintEstimate,
} from "@apex/telemetry-core";

/**
 * Número máximo de muestras de `fuel_level` por vuelta que conserva
 * `useMultiDriverFuelHistory` para derivar la tasa de consumo (Requisito
 * 13.2). No es necesario conservar el historial completo de la sesión:
 * unas pocas vueltas recientes bastan para una estimación representativa
 * del consumo actual, y limitar el tamaño evita que el array crezca sin
 * límite en sesiones largas.
 */
const MAX_FUEL_HISTORY_LAPS = 10;

/**
 * Narrowing del `Evento_Standings` completo (`StandingsEventV1 |
 * StandingsEventV1_1`, ver `standingsStore.ts`) a la variante 1.1.0, que
 * es la única que transporta `fuel_level` por piloto y por tanto la única
 * que puede alimentar el Stint_Planning_Multi_Piloto (Requisito 5.1,
 * 5.2). Mismo patrón ya usado en `PanelTelemetria.tsx` para el mismo
 * propósito (comprobar `version_contrato === "1.1.0"` en vez de asumir el
 * shape ampliado).
 *
 * Ante un Evento_Standings en Version_Contrato_1_0 (sin estos campos), el
 * Stint_Planning_Multi_Piloto se muestra como "no disponible" (Requisito
 * 13.1) en lugar de asumir un nivel de combustible por defecto.
 */
function isStandingsV1_1(
  event: StandingsEventV1 | StandingsEventV1_1
): event is StandingsEventV1_1 {
  return event.version_contrato === "1.1.0";
}

/**
 * Hook local que deriva, para CADA piloto del `Evento_Standings_Ampliado`
 * (Version_Contrato_1_1), un historial de `fuel_level` "por vuelta", para
 * alimentar `estimateStintForAllDrivers` (Requisito 5.1, 5.2).
 *
 * El Evento_Standings llega a 1-5Hz (no a 60Hz como Evento_Telemetry),
 * por lo que basta con un `useEffect` que reaccione a cada nuevo
 * `latestEvent`: para cada piloto presente, se compara su
 * `last_lap_time` actual contra el último valor visto para ESE piloto
 * (guardado en un `useRef` con un `Map<string, number | null>`, para no
 * disparar renders adicionales) y, al detectar una transición, se añade
 * su `fuel_level` actual al historial de ese piloto. Un piloto que
 * desaparece de `drivers` en un evento posterior simplemente deja de
 * actualizarse (su historial ya acumulado se conserva, no se descarta).
 */
function useMultiDriverFuelHistory(
  drivers: StandingsEntryV1_1[] | null
): Map<string, number[]> {
  const [historyByDriverId, setHistoryByDriverId] = useState<Map<string, number[]>>(
    () => new Map()
  );
  const prevLastLapTimeByDriverId = useRef<Map<string, number | null>>(new Map());

  useEffect(() => {
    if (drivers === null) {
      return;
    }
    setHistoryByDriverId((prev) => {
      let changed = false;
      const next = new Map(prev);
      for (const driver of drivers) {
        const { driver_id: driverId, last_lap_time: lastLapTime, fuel_level: fuelLevel } =
          driver;
        if (lastLapTime === null) {
          continue;
        }
        const prevLastLapTime = prevLastLapTimeByDriverId.current.get(driverId) ?? null;
        if (prevLastLapTime === lastLapTime) {
          continue;
        }
        prevLastLapTimeByDriverId.current.set(driverId, lastLapTime);
        const driverHistory = next.get(driverId) ?? [];
        const updatedHistory = [...driverHistory, fuelLevel];
        next.set(
          driverId,
          updatedHistory.length > MAX_FUEL_HISTORY_LAPS
            ? updatedHistory.slice(-MAX_FUEL_HISTORY_LAPS)
            : updatedHistory
        );
        changed = true;
      }
      return changed ? next : prev;
    });
  }, [drivers]);

  return historyByDriverId;
}

/**
 * Formatea `estimatedRemainingLaps` como "no disponible" cuando es
 * `Infinity` (consumo de combustible no determinado, Requisito 5.4), o
 * con un decimal en cualquier otro caso.
 */
function formatRemainingLaps(remainingLaps: number): string {
  return remainingLaps === Infinity ? "no disponible" : remainingLaps.toFixed(1);
}

/**
 * Formatea `estimatedPitInLapsFromNow`: `null` (que solo ocurre cuando
 * `estimatedRemainingLaps` es `Infinity`, ver `fuel-multi.ts`) se muestra
 * en blanco en vez de una vuelta de pit inventada (Requisito 5.4).
 */
function formatPitInLaps(pitInLaps: number | null): string {
  return pitInLaps === null ? "—" : String(pitInLaps);
}

/**
 * Panel_Fuel: tabla de Stint_Planning_Multi_Piloto (Requisito 5.1, 5.2,
 * 5.3) con una fila por piloto del Evento_Standings_Ampliado.
 *
 * El combustible/vueltas restantes del PROPIO piloto observado ya no se
 * muestran aquí: se movieron a `AppHeader` (stats compactos siempre
 * visibles en la franja superior, ver `AppHeader.tsx`) para liberar
 * espacio vertical del panel y dedicarlo íntegramente a la tabla
 * multi-piloto, que es la información que este panel aporta y que ningún
 * otro lugar del Dashboard muestra.
 *
 * Se suscribe a `useStandingsStore` (1-5Hz): si el último Evento_Standings
 * recibido es Version_Contrato_1_0 (sin `fuel_level` por piloto), la
 * sección se muestra como "no disponible" en vez de una tabla vacía o
 * rota (Requisito 13.1), sin asumir un nivel de combustible por defecto.
 */
export default function PanelFuel() {
  const standingsEvent = useStandingsStore((state) => state.latestEvent);
  const driversV1_1 =
    standingsEvent !== null && isStandingsV1_1(standingsEvent)
      ? standingsEvent.drivers
      : null;
  const multiDriverHistory = useMultiDriverFuelHistory(driversV1_1);

  const stintEstimates = useMemo<DriverStintEstimate[] | null>(() => {
    if (driversV1_1 === null) {
      return null;
    }
    const currentFuelLevels = new Map<string, number>(
      driversV1_1.map((driver) => [driver.driver_id, driver.fuel_level])
    );
    return estimateStintForAllDrivers(multiDriverHistory, currentFuelLevels).sort(
      (a, b) => a.estimatedRemainingLaps - b.estimatedRemainingLaps
    );
  }, [driversV1_1, multiDriverHistory]);

  const fuelLevelByDriverId =
    driversV1_1 === null
      ? null
      : new Map(driversV1_1.map((driver) => [driver.driver_id, driver.fuel_level]));

  return (
    <div className="flex h-full flex-col gap-2 p-4">
      <PanelHeader title="Fuel & Stints" />
      <div className="flex min-h-0 flex-1 flex-col gap-2">
        {stintEstimates === null || fuelLevelByDriverId === null ? (
          <div className="text-muted-foreground">
            Stint planning no disponible: el Evento_Standings recibido no
            incluye combustible por piloto.
          </div>
        ) : (
          <div className="min-h-0 flex-1 overflow-x-auto overflow-y-auto rounded-md border border-border">
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead className="py-1.5 text-[11px] tracking-wider text-muted-foreground uppercase">
                    Piloto
                  </TableHead>
                  <TableHead className="hud-number py-1.5 text-[11px] tracking-wider text-muted-foreground uppercase">
                    Combustible
                  </TableHead>
                  <TableHead className="hud-number py-1.5 text-[11px] tracking-wider text-muted-foreground uppercase">
                    Vueltas restantes (est.)
                  </TableHead>
                  <TableHead className="hud-number py-1.5 text-[11px] tracking-wider text-muted-foreground uppercase">
                    Vuelta estimada de pit
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {stintEstimates.map((estimate) => (
                  <TableRow key={estimate.driverId}>
                    <TableCell className="py-1 text-xs">{estimate.driverId}</TableCell>
                    <TableCell className="hud-number py-1">
                      {fuelLevelByDriverId.get(estimate.driverId)?.toFixed(1) ?? "—"}
                    </TableCell>
                    <TableCell className="hud-number py-1">
                      {formatRemainingLaps(estimate.estimatedRemainingLaps)}
                    </TableCell>
                    <TableCell className="hud-number py-1">
                      {formatPitInLaps(estimate.estimatedPitInLapsFromNow)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </div>
    </div>
  );
}
