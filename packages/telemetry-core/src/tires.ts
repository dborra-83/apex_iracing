/**
 * Clasificación de presentación del estado de un neumático (temperatura y
 * desgaste), compartida entre `apps/dashboard` y `apps/apex-mobile` para
 * que ambos widgets de neumáticos usen exactamente los mismos umbrales y
 * no diverjan en cuándo algo se considera "caliente" o "gastado".
 *
 * No es un cálculo de dominio del motor de simulación (`tires` en
 * `TelemetryEventV1` ya trae los valores crudos de temperatura/presión/
 * desgaste, ver `packages/contrato-datos/src/v1/telemetry.ts`): es
 * puramente una función de mapeo de esos valores a una categoría visual
 * (verde/amarillo/rojo), igual criterio que las shift lights del
 * `Speedometer` de Apex Mobile ("función pura de presentación, no un
 * cálculo de dominio").
 */

import type { StatusLevel } from "./status";

export type TireTempStatus = "cold" | "optimal" | "hot";
export type TireWearStatus = "fresh" | "worn" | "critical";

/** Por debajo de este valor (°C) el neumático todavía no alcanzó su ventana de trabajo. */
const COLD_TEMP_THRESHOLD_C = 70;
/** Por encima de este valor (°C) el neumático está sobrecalentado. */
const HOT_TEMP_THRESHOLD_C = 105;

/** Por encima de este desgaste ([0, 1]) el neumático se considera notablemente gastado. */
const WORN_THRESHOLD = 0.6;
/** Por encima de este desgaste el neumático se considera en estado crítico (cambio inminente). */
const CRITICAL_WEAR_THRESHOLD = 0.85;

/**
 * Clasifica la temperatura de un neumático en `"cold"` (por debajo de la
 * ventana de trabajo), `"optimal"` (dentro de la ventana), o `"hot"`
 * (sobrecalentado).
 */
export function classifyTireTemp(tempC: number): TireTempStatus {
  if (tempC < COLD_TEMP_THRESHOLD_C) return "cold";
  if (tempC > HOT_TEMP_THRESHOLD_C) return "hot";
  return "optimal";
}

/**
 * Clasifica el desgaste de un neumático (`wear` en `[0, 1]`) en
 * `"fresh"`, `"worn"`, o `"critical"`.
 */
export function classifyTireWear(wear: number): TireWearStatus {
  if (wear >= CRITICAL_WEAR_THRESHOLD) return "critical";
  if (wear >= WORN_THRESHOLD) return "worn";
  return "fresh";
}

/**
 * Traduce un `TireTempStatus` al vocabulario `StatusLevel` compartido
 * (`status.ts`), para que `TireIcon` (ambas apps) tiña el neumático con
 * el mismo sistema de color que el resto de la app en vez de un mapeo
 * de color propio. `"cold"` se marca `"warning"` (no ideal, pero no
 * urgente) y `"hot"` se marca `"critical"` (riesgo de daño/perf).
 */
export function tireTempStatusToLevel(status: TireTempStatus): StatusLevel {
  if (status === "hot") return "critical";
  if (status === "cold") return "warning";
  return "ok";
}

/**
 * Traduce un `TireWearStatus` al vocabulario `StatusLevel` compartido.
 */
export function tireWearStatusToLevel(status: TireWearStatus): StatusLevel {
  if (status === "critical") return "critical";
  if (status === "worn") return "warning";
  return "ok";
}
