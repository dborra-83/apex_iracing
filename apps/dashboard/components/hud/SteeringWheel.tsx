"use client";

/**
 * SteeringWheel: volante SVG rotado según `steering`, mismo componente y
 * convención de mapeo que `apps/apex-mobile/components/SteeringWheel.tsx`
 * (`steering` en `[-1, 1]` → `±450°` de rotación visual), adaptado a la
 * paleta del Dashboard.
 */
export interface SteeringWheelProps {
  steering: number;
  size?: number;
}

const MAX_ROTATION_DEG = 450;

export default function SteeringWheel({ steering, size = 72 }: SteeringWheelProps) {
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
        <line x1={32} y1={32} x2={32} y2={8} stroke="var(--primary)" strokeWidth={5} />
        <line x1={32} y1={32} x2={11} y2={45} stroke="var(--primary)" strokeWidth={5} />
        <line x1={32} y1={32} x2={53} y2={45} stroke="var(--primary)" strokeWidth={5} />
        <circle cx={32} cy={32} r={7} fill="var(--card)" stroke="var(--border)" strokeWidth={1} />
        <circle cx={32} cy={6} r={2.5} fill="var(--accent)" />
      </svg>
      <span className="hud-number text-xs text-muted-foreground">
        {rotationDeg >= 0 ? "+" : ""}
        {rotationDeg.toFixed(0)}°
      </span>
    </div>
  );
}
