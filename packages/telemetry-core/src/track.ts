import type { TrackPointV1, SectorV1 } from "@apex/contrato-datos";

/**
 * Proyecta un progreso de vuelta (`lapDistPct` en [0, 1)) sobre el trazado
 * geométrico del circuito (`path`), tratándolo como un circuito cerrado
 * (el último punto se conecta de vuelta al primero).
 *
 * El resultado SHALL ser siempre un punto derivado por interpolación lineal
 * entre dos puntos EXISTENTES y consecutivos del `path` (nunca fuera de su
 * rango convexo), cumpliendo la Property 9 (Requisitos 9.2, 9.3).
 *
 * Algoritmo: dado un `path` de N puntos, el índice "flotante" sobre el
 * trazado es `lapDistPct * N`. El punto base es
 * `Math.floor(indiceFlotante) % N` y el siguiente es `(base + 1) % N`
 * (con wraparound al primer punto cuando `base` es el último). La fracción
 * restante `indiceFlotante - Math.floor(indiceFlotante)` se usa como
 * parámetro `t` para interpolar linealmente entre ambos puntos.
 *
 * @param path Puntos del trazado cerrado, en orden. Debe tener al menos 2 puntos.
 * @param lapDistPct Progreso de vuelta en [0, 1).
 * @returns Punto interpolado sobre el segmento del trazado correspondiente.
 * @throws Error si `path` tiene menos de 2 puntos.
 */
export function lapPctToPoint(
  path: TrackPointV1[],
  lapDistPct: number
): TrackPointV1 {
  const n = path.length;
  if (n < 2) {
    throw new Error(
      `lapPctToPoint: path debe tener al menos 2 puntos, recibido ${n}`
    );
  }

  const floatIndex = lapDistPct * n;
  const baseIndex = Math.floor(floatIndex) % n;
  const nextIndex = (baseIndex + 1) % n;
  const t = floatIndex - Math.floor(floatIndex);

  const base = path[baseIndex]!;
  const next = path[nextIndex]!;

  return {
    x: base.x + (next.x - base.x) * t,
    y: base.y + (next.y - base.y) * t,
  };
}

/**
 * Determina el índice de sector al que pertenece un progreso de vuelta
 * (`lapDistPct` en [0, 1)) dado el array de `sectors` del Evento_Track.
 *
 * Regla de pertenencia: un sector contiene a `lapDistPct` cuando
 * `start_pct <= lapDistPct < end_pct`. Esto garantiza consistencia en los
 * límites entre sectores adyacentes: en el límite exacto compartido entre
 * dos sectores (`lapDistPct === start_pct` del sector siguiente, que es a
 * su vez el `end_pct` del sector anterior), el valor se asigna siempre al
 * sector siguiente, nunca a ambos ni a ninguno (sin solapamientos ni huecos).
 *
 * Caso especial: el último sector (el de mayor `end_pct`) se trata de forma
 * inclusiva en su límite superior (`start_pct <= lapDistPct <= end_pct`),
 * para cubrir el valor límite `lapDistPct` cercano a 1 dentro del rango
 * [0, 1) que corresponde al final de la vuelta.
 *
 * Si ningún sector contiene el valor (caso defensivo de `sectors` mal
 * formados, con huecos o fuera de [0,1]), se devuelve como fallback el
 * índice del último sector del array (ordenado por `end_pct` descendente)
 * en vez de lanzar una excepción, priorizando que el Panel_Mapa siempre
 * pueda mostrar algún sector en vez de romper el render.
 *
 * @param sectors Sectores del circuito, cada uno con `index`, `start_pct`, `end_pct`.
 * @param lapDistPct Progreso de vuelta en [0, 1).
 * @returns El `index` del sector correspondiente.
 * @throws Error si `sectors` está vacío.
 */
export function getSectorForLapPct(
  sectors: SectorV1[],
  lapDistPct: number
): number {
  if (sectors.length === 0) {
    throw new Error("getSectorForLapPct: sectors no puede estar vacío");
  }

  const sorted = [...sectors].sort((a, b) => a.start_pct - b.start_pct);
  const lastSector = sorted[sorted.length - 1]!;

  for (const sector of sorted) {
    const isLastSector = sector === lastSector;
    const belongs = isLastSector
      ? lapDistPct >= sector.start_pct && lapDistPct <= sector.end_pct
      : lapDistPct >= sector.start_pct && lapDistPct < sector.end_pct;

    if (belongs) {
      return sector.index;
    }
  }

  // Fallback defensivo: sectors mal formados (huecos/solapamientos que
  // dejan a lapDistPct sin cobertura). Se devuelve el último sector.
  return lastSector.index;
}

/**
 * Distancia circular entre dos progresos de vuelta `a` y `b`, ambos en
 * [0, 1), tratando el trazado como un círculo donde 0.99 y 0.01 están
 * cerca entre sí (a solo 0.02 de distancia, no a 0.98).
 *
 * Algoritmo: `raw = |a - b|`; la distancia circular es
 * `min(raw, 1 - raw)`, ya que ir "hacia adelante" (`raw`) o "hacia atrás"
 * cruzando el punto de inicio/fin de vuelta (`1 - raw`) son las dos
 * formas de recorrer el círculo entre ambos puntos, y la distancia real
 * es la más corta de las dos.
 *
 * Propiedades garantizadas (Property 9): simétrica
 * (`circularDistance(a, b) === circularDistance(b, a)`), siempre en
 * [0, 0.5] (el máximo posible en un círculo de perímetro 1 es 0.5, en el
 * punto diametralmente opuesto), y 0 si y solo si `a === b`.
 *
 * @param a Progreso de vuelta en [0, 1).
 * @param b Progreso de vuelta en [0, 1).
 * @returns Distancia circular en [0, 0.5].
 */
export function circularDistance(a: number, b: number): number {
  const raw = Math.abs(a - b);
  return Math.min(raw, 1 - raw);
}

/**
 * Encuentra hasta `maxCount` pilotos más cercanos al piloto observado
 * (`observedDriverId`) por distancia circular de `lap_dist_pct`,
 * excluyendo siempre al propio piloto observado del resultado.
 *
 * Algoritmo: se busca al piloto observado en `drivers` por `driver_id`.
 * Si no se encuentra, se devuelve como fallback documentado (Error
 * Handling de design.md: "nearestRivals invocado con observedDriverId
 * que no existe en drivers") los primeros `maxCount` elementos de
 * `drivers` sin ordenar por distancia (no se puede calcular distancia
 * sin el piloto de referencia), registrando una advertencia mediante
 * `console.warn`, sin lanzar excepción. En caso contrario, se filtran
 * los candidatos excluyendo al observado, se calcula la
 * `circularDistance` de cada uno respecto al observado, se ordenan
 * ascendentemente por esa distancia, y se devuelven los primeros
 * `maxCount`.
 *
 * Es una función pura: no muta el array `drivers` de entrada.
 *
 * @param observedDriverId `driver_id` del piloto observado, a excluir siempre del resultado.
 * @param drivers Array de pilotos candidatos (contiene como máximo un elemento con ese `driver_id`).
 * @param maxCount Número máximo de rivales a devolver (`>= 0`).
 * @returns Hasta `maxCount` rivales, ordenados por proximidad circular ascendente (o sin ordenar, como fallback, si el observado no está presente).
 */
export function nearestRivals<
  T extends { driver_id: string; lap_dist_pct: number },
>(observedDriverId: string, drivers: T[], maxCount: number): T[] {
  const observed = drivers.find(
    (driver) => driver.driver_id === observedDriverId
  );

  if (observed === undefined) {
    console.warn(
      `nearestRivals: observedDriverId "${observedDriverId}" no encontrado en drivers; ` +
        "se devuelven los primeros pilotos sin ordenar por distancia"
    );
    return drivers.slice(0, maxCount);
  }

  const candidates = drivers.filter(
    (driver) => driver.driver_id !== observedDriverId
  );

  const sorted = [...candidates].sort(
    (a, b) =>
      circularDistance(a.lap_dist_pct, observed.lap_dist_pct) -
      circularDistance(b.lap_dist_pct, observed.lap_dist_pct)
  );

  return sorted.slice(0, maxCount);
}
