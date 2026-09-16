/**
 * Sistema de estado semántico ("¿estamos bien, medio bien o mal?")
 * compartido entre `apps/dashboard` y `apps/apex-mobile`, para que
 * cualquier dato mostrado con un color de referencia (delta de vuelta,
 * temperatura/desgaste de neumático, bloqueo de freno, bandera de
 * sesión) use exactamente los mismos 4 niveles y exactamente el mismo
 * nombre de variable CSS por nivel, en vez de que cada componente elija
 * su propio color ad hoc.
 *
 * Antes de este módulo, cada componente reimplementaba su propio mapeo
 * color→significado de forma independiente, con inconsistencias reales
 * entre apps (p. ej. "más rápido" era `--primary` en Apex Mobile pero
 * `--chart-4` en el Dashboard; "neumático frío" usaba `--chart-3` en el
 * Dashboard pero `--muted-foreground` en Apex Mobile). Este módulo fija
 * un único vocabulario:
 *
 * - `"ok"`: todo en orden (más rápido, neumático en ventana, sin
 *   bloqueo) → `--success`.
 * - `"warning"`: atención, no crítico (levemente más lento, neumático
 *   con desgaste notable, temperatura fuera de ventana) → `--warning`.
 * - `"critical"`: acción requerida (más lento de forma significativa,
 *   neumático en desgaste crítico, bloqueo de freno) → `--destructive`.
 * - `"neutral"`: sin dato o sin comparación posible (delta `null`,
 *   valor exactamente en cero) → `--muted-foreground`.
 *
 * `--success` es una variable NUEVA (ver `globals.css` de ambas apps):
 * antes no existía ningún token semántico para "bien", solo
 * `--destructive`/`--warning`, y cada componente usaba `--primary` (el
 * acento cian de la marca) o `--chart-4` (un verde ad hoc) para
 * "bien", mezclando color de marca con color de estado. Separar ambos
 * conceptos (marca vs. estado) es la causa raíz de la inconsistencia
 * detectada.
 */
export type StatusLevel = "ok" | "warning" | "critical" | "neutral";

/**
 * Nombre de la variable CSS (sin el prefijo `var()`) correspondiente a
 * cada `StatusLevel`. Se expone como mapeo explícito, no como función
 * `statusColor(level): string` que ya incluya `var(...)`, para que cada
 * app decida si lo usa como `style={{ color: \`var(--\${x})\` }}` o
 * como clase Tailwind (`text-${x}`, vía el bloque `@theme inline` de
 * cada `globals.css`).
 */
export const STATUS_CSS_VAR: Record<StatusLevel, string> = {
  ok: "success",
  warning: "warning",
  critical: "destructive",
  neutral: "muted-foreground",
};

/** Azúcar sintáctico: `statusVar("ok")` → `"var(--success)"`, listo para usar en `style={{ color: statusVar(level) }}`. */
export function statusVar(level: StatusLevel): string {
  return `var(--${STATUS_CSS_VAR[level]})`;
}

/**
 * Clasifica un delta de tiempo (segundos, ya sea de vuelta completa o de
 * sector) donde NEGATIVO significa "más rápido" (mejora) y POSITIVO
 * significa "más lento" (empeora) — la convención ya usada en
 * `Evento_Telemetry.delta_to_best`/`delta_to_prev` y en
 * `compareSectorTimes` (`deltaSeconds`).
 *
 * `null` (sin comparación posible, p. ej. primera vuelta de la sesión)
 * → `"neutral"`. Un delta significativamente peor (por encima de
 * `criticalThresholdS`, por defecto medio segundo) se marca `"critical"`
 * en vez de solo `"warning"`, para distinguir "un poco más lento" de
 * "mucho más lento" — el mismo tipo de gradiente de severidad que ya
 * usan las banderas de F1 (verde/amarillo/rojo) que motivó este pedido.
 */
export function classifyDelta(
  deltaSeconds: number | null,
  criticalThresholdS = 0.5,
): StatusLevel {
  if (deltaSeconds === null) return "neutral";
  if (deltaSeconds < 0) return "ok";
  if (deltaSeconds === 0) return "neutral";
  if (deltaSeconds >= criticalThresholdS) return "critical";
  return "warning";
}

/**
 * Clasifica el nivel de frenada (`brake` en `[0, 1]`) en riesgo de
 * bloqueo: por debajo de `warningThreshold` no hay riesgo (`"ok"`),
 * entre `warningThreshold` y `criticalThreshold` hay riesgo leve
 * (`"warning"`), y por encima de `criticalThreshold` se considera
 * bloqueo probable (`"critical"`).
 */
export function classifyBrakeLockRisk(
  brake: number,
  warningThreshold = 0.7,
  criticalThreshold = 0.85,
): StatusLevel {
  if (brake >= criticalThreshold) return "critical";
  if (brake >= warningThreshold) return "warning";
  return "ok";
}
