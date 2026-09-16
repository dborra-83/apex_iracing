"use client";

import {
  classifyTireTemp,
  classifyTireWear,
  tireTempStatusToLevel,
  tireWearStatusToLevel,
  statusVar,
} from "@apex/telemetry-core";

/**
 * TireIcon: representación gráfica de un neumático (SVG propio) para el
 * Dashboard, mismo componente/criterio que
 * `apps/apex-mobile/components/TireIcon.tsx` (banda exterior tintada por
 * temperatura, anillo interior de goma restante tintado por desgaste).
 *
 * El color de cada tinte viene del vocabulario `StatusLevel` compartido
 * (`@apex/telemetry-core`, `statusVar`), no de un mapeo de color propio:
 * antes este componente y su equivalente en Apex Mobile usaban paletas
 * distintas para el mismo estado (p. ej. "frío" era `--chart-3` aquí
 * pero `--muted-foreground` en Apex Mobile), inconsistencia ya corregida
 * al pasar ambos por `tireTempStatusToLevel`/`tireWearStatusToLevel`.
 */
export interface TireIconProps {
  temp: number;
  wear: number;
  size?: number;
}

export default function TireIcon({ temp, wear, size = 56 }: TireIconProps) {
  const tempColor = statusVar(tireTempStatusToLevel(classifyTireTemp(temp)));
  const wearColor = statusVar(tireWearStatusToLevel(classifyTireWear(wear)));

  const radius = 20;
  const circumference = 2 * Math.PI * radius;
  const remainingFraction = Math.max(0, 1 - wear);

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 56 56"
      role="img"
      aria-label={`Neumático: ${temp.toFixed(0)}°C, ${Math.round(wear * 100)}% de desgaste`}
    >
      <circle
        cx={28}
        cy={28}
        r={26}
        fill="none"
        stroke={tempColor}
        strokeWidth={4}
        opacity={0.9}
        style={{ filter: `drop-shadow(0 0 3px ${tempColor})` }}
      />
      <circle cx={28} cy={28} r={16} fill="var(--card)" stroke="var(--border)" strokeWidth={1} />
      <circle
        cx={28}
        cy={28}
        r={radius}
        fill="none"
        stroke="var(--muted)"
        strokeWidth={3}
        opacity={0.5}
      />
      <circle
        cx={28}
        cy={28}
        r={radius}
        fill="none"
        stroke={wearColor}
        strokeWidth={3}
        strokeDasharray={`${circumference * remainingFraction} ${circumference}`}
        strokeLinecap="round"
        transform="rotate(-90 28 28)"
      />
      {[0, 60, 120, 180, 240, 300].map((angle) => (
        <line
          key={angle}
          x1={28}
          y1={28}
          x2={28 + 10 * Math.cos((angle * Math.PI) / 180)}
          y2={28 + 10 * Math.sin((angle * Math.PI) / 180)}
          stroke="var(--border)"
          strokeWidth={1.5}
        />
      ))}
    </svg>
  );
}
