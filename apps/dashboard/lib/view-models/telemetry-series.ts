import type { TelemetryEventV1 } from "@apex/contrato-datos";

/**
 * Un punto de la serie de telemetría del Panel_Telemetria: el resultado de
 * proyectar un `Evento_Telemetry` sobre los ejes del trace de
 * throttle/brake y su delta de sector asociado.
 *
 * - `lapDistPct` es el eje X del gráfico (progreso de vuelta).
 * - `throttle`/`brake` son el eje Y del gráfico.
 * - `deltaToBest`/`deltaToPrev` son el delta de sector mostrado para ese
 *   punto (Requisito 11.2).
 */
export interface TelemetryTracePoint {
  lapDistPct: number;
  throttle: number;
  brake: number;
  deltaToBest: number | null;
  deltaToPrev: number | null;
}

/**
 * Construye la serie de puntos del Panel_Telemetria a partir de una
 * secuencia de `Evento_Telemetry`.
 *
 * - Preserva el ORDEN de llegada: el punto i-ésimo del resultado
 *   corresponde exactamente al evento i-ésimo de `events`, en el mismo
 *   orden (Requisito 11.1, Property 11).
 * - Preserva la LONGITUD: para N eventos de entrada se producen
 *   exactamente N puntos de salida (Property 11).
 * - Mapea `lap_dist_pct` -> `lapDistPct`, `throttle` -> `throttle` y
 *   `brake` -> `brake` mediante copia directa, sin normalizar ni escalar
 *   sus valores (Requisito 11.1).
 * - El delta de sector de cada punto (`deltaToBest`/`deltaToPrev`) es
 *   idéntico al valor de `delta_to_best`/`delta_to_prev` del evento fuente
 *   correspondiente, incluyendo la preservación explícita de `null`
 *   (Requisito 11.2).
 *
 * Es una función pura e inmutable: no muta el array `events` de entrada
 * ni ninguno de sus elementos.
 *
 * **Validates: Requirements 11.1, 11.2**
 */
export function buildTelemetrySeries(
  events: TelemetryEventV1[]
): TelemetryTracePoint[] {
  return events.map((event) => ({
    lapDistPct: event.lap_dist_pct,
    throttle: event.throttle,
    brake: event.brake,
    deltaToBest: event.delta_to_best,
    deltaToPrev: event.delta_to_prev,
  }));
}
