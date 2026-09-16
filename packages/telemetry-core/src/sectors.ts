/**
 * Comparativa de tiempos de sector entre un piloto de referencia
 * (observado) y un rival, calculada índice a índice.
 *
 * Ver design.md, sección "Core Interfaces/Types (packages/telemetry-core)"
 * y "Function 2: compareSectorTimes".
 */
export interface SectorComparison {
  sectorIndex: number;
  /** Tiempo del piloto de referencia (observado) en ese sector, o null. */
  referenceTime: number | null;
  /** Tiempo del rival en ese sector, o null si no disponible. */
  rivalTime: number | null;
  /** rivalTime - referenceTime, o null si cualquiera de los dos es null. */
  deltaSeconds: number | null;
}

/**
 * Compara, índice a índice, los tiempos de sector de un piloto de
 * referencia (observado) contra los de un rival.
 *
 * Precondición: ambos arrays deben tener la misma longitud (ambos
 * derivados del mismo Evento_Track.sectors). Si no coinciden, se lanza un
 * Error descriptivo en lugar de intentar una comparación parcial
 * silenciosa.
 *
 * Postcondición: para cada índice i, deltaSeconds = rivalTime -
 * referenceTime solo cuando AMBOS son no-null; en caso contrario es null.
 * Nunca se produce NaN. Función pura: no muta ninguno de los arrays de
 * entrada.
 */
export function compareSectorTimes(
  referenceLastSectorTimes: (number | null)[],
  rivalLastSectorTimes: (number | null)[],
): SectorComparison[] {
  if (referenceLastSectorTimes.length !== rivalLastSectorTimes.length) {
    throw new Error(
      `compareSectorTimes: las longitudes de referenceLastSectorTimes (${referenceLastSectorTimes.length}) ` +
        `y rivalLastSectorTimes (${rivalLastSectorTimes.length}) no coinciden. ` +
        `Ambos arrays deben derivar del mismo Evento_Track.sectors.`,
    );
  }

  return referenceLastSectorTimes.map((referenceTime, sectorIndex) => {
    const rivalTime = rivalLastSectorTimes[sectorIndex] ?? null;
    const deltaSeconds =
      referenceTime !== null && rivalTime !== null ? rivalTime - referenceTime : null;

    return {
      sectorIndex,
      referenceTime,
      rivalTime,
      deltaSeconds,
    };
  });
}
