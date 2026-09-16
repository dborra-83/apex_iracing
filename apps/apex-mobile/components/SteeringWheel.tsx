/**
 * SteeringWheel: volante SVG que rota según `steering` del
 * Piloto_Observado, para mostrar el ángulo de giro instantáneo del
 * volante.
 *
 * El Contrato_Datos expone `steering` en `[-1, 1]` (ver
 * `packages/contrato-datos/src/v1/telemetry.ts`), no en grados: es un
 * valor normalizado de posición del volante, no el ángulo real de la
 * dirección de las ruedas ni un rango de grados de bloqueo específico
 * del auto (el Generador_Demo no simula un rango de dirección real por
 * auto). Se mapea a un rango de rotación visual de `MAX_ROTATION_DEG` en
 * cada sentido (`450°`, un giro y cuarto, típico de un volante de
 * competición) como convención de presentación: es la ÚNICA forma de
 * mostrar "grados" a partir de un valor `[-1, 1]` sin que el
 * Contrato_Datos modele grados reales, que no existen en ninguna fuente
 * de datos actual (Generador_Demo ni un futuro bridge de iRacing, que
 * expondría igualmente un valor de posición normalizado, no grados de
 * las ruedas).
 */
export interface SteeringWheelProps {
  steering: number;
  size?: number;
}

/** Rotación máxima (°) del volante en cada sentido, mapeada desde `steering = ±1`. */
const MAX_ROTATION_DEG = 450;

export default function SteeringWheel({ steering, size = 64 }: SteeringWheelProps) {
  const clamped = Math.min(1, Math.max(-1, steering));
  const rotationDeg = clamped * MAX_ROTATION_DEG;

  return (
    <div className="flex flex-col items-center gap-1">
      <svg
        width={size}
        height={size}
        viewBox="0 0 64 64"
        role="img"
        aria-label={`Volante: ${rotationDeg.toFixed(0)}°`}
        style={{ transform: `rotate(${rotationDeg}deg)`, transition: "transform 40ms linear" }}
      >
        <circle
          cx={32}
          cy={32}
          r={26}
          fill="none"
          stroke="var(--primary)"
          strokeWidth={5}
          style={{ filter: "drop-shadow(0 0 4px var(--primary))" }}
        />
        {/* Radios en Y invertida y ambos laterales, forma clásica de volante. */}
        <line x1={32} y1={32} x2={32} y2={8} stroke="var(--primary)" strokeWidth={5} />
        <line x1={32} y1={32} x2={11} y2={45} stroke="var(--primary)" strokeWidth={5} />
        <line x1={32} y1={32} x2={53} y2={45} stroke="var(--primary)" strokeWidth={5} />
        {/* Centro (claxon). */}
        <circle cx={32} cy={32} r={7} fill="var(--card)" stroke="var(--border)" strokeWidth={1} />
        {/* Marca en la parte superior del aro, para que la rotación sea visualmente perceptible incluso cerca de 0°. */}
        <circle cx={32} cy={6} r={2.5} fill="var(--accent)" />
      </svg>
      <span className="hud-number text-xs text-muted-foreground">
        {rotationDeg >= 0 ? "+" : ""}
        {rotationDeg.toFixed(0)}°
      </span>
    </div>
  );
}
