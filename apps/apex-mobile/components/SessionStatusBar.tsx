import type { FlagV1, WeatherV1 } from "@apex/contrato-datos";

/**
 * SessionStatusBar: franja de estado de sesión (bandera, vueltas/tiempo
 * restante, incidentes y clima) para la Pantalla_Principal de Apex
 * Mobile.
 *
 * No forma parte de los 7 elementos originales del Requisito 9 de la
 * especificación `apex-mobile-and-dashboard-expansion` (velocímetro,
 * marcha, tiempos de vuelta, posición/gaps, combustible, mini-mapa), pero
 * usa datos ya presentes en `Evento_Session` desde `iracing-telemetry-
 * platform` que hoy no tienen ninguna visualización en Apex Mobile. La
 * bandera en particular es información de seguridad: un piloto necesita
 * saber "amarilla"/"roja" de un vistazo, igual que en un HUD real de
 * carrera, y hoy esa información solo existe en el Dashboard.
 *
 * Se muestra SIEMPRE en la misma posición (franja superior, ancho
 * completo) en portrait y landscape, para no violar el mismo principio
 * de "mismo conjunto de datos en ambas orientaciones" ya aplicado al
 * resto de la pantalla.
 */
export interface SessionStatusBarProps {
  flag: FlagV1 | null;
  weather: WeatherV1 | null;
  timeRemainingS: number | null;
  lapsRemaining: number | null;
  incidents: number | null;
}

interface FlagDisplay {
  label: string;
  /** Color de fondo de la franja. */
  background: string;
  /** Color de texto sobre `background` (para "white"/"checkered", que son claros). */
  foreground: string;
}

/**
 * "Verde" usa `var(--success)` (el mismo token semántico "todo en orden"
 * del resto de la app, ver `@apex/telemetry-core/status`) en vez del
 * color OKLCH hardcodeado que tenía antes: ese valor fijo bypaseaba
 * completamente el sistema de tema (no cambiaba entre claro/oscuro y no
 * participaba de `--success`), y era precisamente la causa del bug de
 * legibilidad reportado ("cuando la bandera está en verde los datos de
 * esa sección no se leen bien").
 */
const FLAG_DISPLAY: Record<FlagV1, FlagDisplay> = {
  green: { label: "Verde", background: "var(--success)", foreground: "oklch(0.12 0 0)" },
  yellow: { label: "Amarilla", background: "var(--warning)", foreground: "oklch(0.12 0 0)" },
  red: { label: "Roja", background: "var(--destructive)", foreground: "oklch(0.98 0 0)" },
  white: { label: "Blanca (última vuelta)", background: "oklch(0.95 0 0)", foreground: "oklch(0.12 0 0)" },
  checkered: { label: "A cuadros", background: "oklch(0.95 0 0)", foreground: "oklch(0.12 0 0)" },
};

const WEATHER_LABEL: Record<WeatherV1, string> = {
  clear: "Despejado",
  cloudy: "Nublado",
  light_rain: "Lluvia ligera",
  heavy_rain: "Lluvia intensa",
};

/** Patrón a cuadros vía `repeating-conic-gradient`, reservado para la bandera "checkered". */
const CHECKERED_PATTERN =
  "repeating-conic-gradient(oklch(0.12 0 0) 0% 25%, oklch(0.95 0 0) 0% 50%) 0 0 / 14px 14px";

function formatTimeRemaining(seconds: number | null): string | null {
  if (seconds === null) return null;
  const minutes = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${minutes}:${String(secs).padStart(2, "0")}`;
}

export default function SessionStatusBar({
  flag,
  weather,
  timeRemainingS,
  lapsRemaining,
  incidents,
}: SessionStatusBarProps) {
  const display = flag !== null ? FLAG_DISPLAY[flag] : null;
  const isCheckered = flag === "checkered";
  const formattedTime = formatTimeRemaining(timeRemainingS);
  // La utilidad `.hud-number` fija `color: var(--primary)` (cian) de forma
  // explícita en su propia definición (ver app/globals.css), pensada para
  // valores sobre el fondo casi negro del resto de la pantalla. Esta
  // franja, en cambio, cambia de fondo según la bandera (incluyendo
  // fondos claros como "green"/"white"/"checkered"), así que el color de
  // texto correcto para cada `<span>` se fija aquí explícitamente vía
  // `style` (mayor especificidad que la clase), en vez de heredar el cian
  // fijo de `.hud-number`, que sobre un fondo verde/blanco claro resulta
  // casi ilegible por falta de contraste.
  const textColor = display?.foreground ?? "var(--muted-foreground)";

  return (
    <div
      className="flex items-center justify-between gap-3 rounded-md px-3 py-1.5"
      style={{
        background: isCheckered ? CHECKERED_PATTERN : display?.background ?? "var(--muted)",
        color: textColor,
      }}
      role="status"
      aria-label={`Bandera: ${display?.label ?? "sin datos"}`}
    >
      <span
        className="hud-number"
        style={{ fontSize: "clamp(0.9rem, 3.5vmin, 1.25rem)", color: textColor }}
      >
        {display?.label ?? "Sin bandera"}
      </span>

      <div className="flex items-center gap-3">
        {lapsRemaining !== null && (
          <span className="hud-number text-sm" style={{ color: textColor }}>
            {lapsRemaining} vueltas
          </span>
        )}
        {lapsRemaining === null && formattedTime !== null && (
          <span className="hud-number text-sm" style={{ color: textColor }}>
            {formattedTime}
          </span>
        )}
        {incidents !== null && incidents > 0 && (
          <span className="hud-number text-sm" style={{ color: textColor }}>
            {incidents} inc.
          </span>
        )}
        {weather !== null && (
          <span className="hud-number text-sm" style={{ color: textColor }}>
            {WEATHER_LABEL[weather]}
          </span>
        )}
      </div>
    </div>
  );
}
