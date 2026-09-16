import type { StandingsEntryV1_1 } from "@apex/contrato-datos";

/**
 * Gap (en segundos) de un piloto respecto al piloto inmediatamente
 * delante/detrás en la clasificación, derivado de `position` y `gap`
 * (Requisito 3.1).
 */
export interface DriverGaps {
  driverId: string;
  /** Segundos respecto al piloto inmediatamente delante, o null si es el líder. */
  gapAhead: number | null;
  /** Segundos respecto al piloto inmediatamente detrás, o null si es el último. */
  gapBehind: number | null;
}

/**
 * Calcula `gapAhead`/`gapBehind` para cada piloto de `drivers` a partir de
 * su `position` y su `gap` al líder, ordenando una copia de `drivers` por
 * `position` ascendente (Requisitos 3.1, 3.2, 3.3, 3.4).
 *
 * - El piloto con `position` mínima (el líder) SHALL tener `gapAhead === null`.
 * - El piloto con `position` máxima (el último) SHALL tener `gapBehind === null`.
 * - Para cualquier otro piloto P con el piloto A inmediatamente delante:
 *   `gapAhead(P) === gap(P) - gap(A)`, siempre `>= 0` dado que `gap` es
 *   monótono no decreciente con `position` en cualquier Evento_Standings
 *   válido.
 * - `gapBehind(P)` es exactamente el `gapAhead` del piloto inmediatamente
 *   detrás de P: ambos se derivan de la misma resta entre el mismo par de
 *   pilotos adyacentes, calculada una única vez por par (relación de
 *   simetría exacta, nunca pueden divergir).
 *
 * Es una función pura: no muta `drivers`. El resultado tiene exactamente
 * `drivers.length` elementos, uno por `driverId` de entrada (biyección).
 *
 * **Validates: Requirements 3.1, 3.2, 3.3, 3.4**
 */
export function computeGaps(drivers: StandingsEntryV1_1[]): DriverGaps[] {
  const sorted = [...drivers].sort((a, b) => a.position - b.position);
  const result: DriverGaps[] = [];

  for (let i = 0; i < sorted.length; i++) {
    const current = sorted[i]!;

    let gapAhead: number | null = null;
    if (i > 0) {
      const ahead = sorted[i - 1]!;
      gapAhead = current.gap - ahead.gap;
    }

    let gapBehind: number | null = null;
    if (i < sorted.length - 1) {
      const behind = sorted[i + 1]!;
      gapBehind = behind.gap - current.gap;
    }

    result.push({ driverId: current.driver_id, gapAhead, gapBehind });
  }

  return result;
}
