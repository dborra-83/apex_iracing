import type { StandingsEntryV1, StandingsEventV1 } from "@apex/contrato-datos";

/**
 * Un grupo de pilotos que comparten la misma `class_id`, en el orden de
 * aparición de dicha clase dentro del `Evento_Standings` original.
 */
export interface StandingsClassGroup {
  classId: string;
  drivers: StandingsEntryV1[];
}

/**
 * Agrupa los pilotos de un `Evento_Standings` por `class_id`, sin
 * transformar ni perder ninguno de sus valores originales
 * (Requisito 10.1).
 *
 * - El orden de los grupos sigue el orden de primera aparición de cada
 *   clase en `event.drivers` (la primera clase que aparece en el evento
 *   original es el primer grupo, y así sucesivamente).
 * - Dentro de cada grupo, los pilotos se ordenan por `position` ascendente,
 *   de forma que todos los pilotos de una misma clase queden contiguos
 *   (Requisito 10.2).
 * - Es una función pura e inmutable: no muta `event.drivers` ni ninguno de
 *   sus elementos; cada piloto del resultado conserva exactamente los
 *   mismos valores (`position`, `class_id`, `gap`, `last_lap_time`,
 *   `best_lap_time`, `in_pits`, `off_track`, `driver_id`) del evento
 *   original.
 *
 * **Validates: Requirements 10.1, 10.2**
 */
export function groupStandingsByClass(
  event: StandingsEventV1
): StandingsClassGroup[] {
  const classOrder: string[] = [];
  const driversByClass = new Map<string, StandingsEntryV1[]>();

  for (const driver of event.drivers) {
    let bucket = driversByClass.get(driver.class_id);
    if (!bucket) {
      bucket = [];
      driversByClass.set(driver.class_id, bucket);
      classOrder.push(driver.class_id);
    }
    bucket.push(driver);
  }

  return classOrder.map((classId) => {
    const drivers = driversByClass.get(classId) ?? [];
    return {
      classId,
      // Se ordena una copia del bucket: nunca se muta el array original
      // ni los buckets intermedios usados para agrupar.
      drivers: [...drivers].sort((a, b) => a.position - b.position),
    };
  });
}

/**
 * View-model del Panel_Clasificacion: la lista de pilotos del
 * `Evento_Standings` reordenada de modo que todos los pilotos de una misma
 * `class_id` queden contiguos en el array resultante, preservando
 * exactamente todos los valores de cada piloto (Requisito 10.1, 10.2).
 *
 * Reglas de reordenamiento:
 * - Las clases se agrupan en el orden de su primera aparición en
 *   `event.drivers`.
 * - Dentro de cada grupo de clase, los pilotos quedan ordenados por
 *   `position` ascendente.
 *
 * Es una función pura: no muta `event` ni `event.drivers`, y no
 * transforma ningún valor de los pilotos (no se calculan ni derivan
 * campos nuevos).
 *
 * **Validates: Requirements 10.1, 10.2**
 */
export function buildStandingsViewModel(
  event: StandingsEventV1
): StandingsEntryV1[] {
  const groups = groupStandingsByClass(event);
  const result: StandingsEntryV1[] = [];
  for (const group of groups) {
    result.push(...group.drivers);
  }
  return result;
}
