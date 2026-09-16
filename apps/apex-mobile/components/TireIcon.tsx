import {
  classifyTireTemp,
  classifyTireWear,
  tireTempStatusToLevel,
  tireWearStatusToLevel,
  statusVar,
} from "@apex/telemetry-core";

/**
 * TireIcon: representación gráfica de un neumático (SVG propio, no una
 * imagen rasterizada) en vez de solo texto numérico, para que el estado
 * de cada goma se lea de un vistazo por su color en vez de tener que leer
 * un número.
 *
 * Se dibuja como un SVG en vez de usar una foto/imagen real de neumático
 * (`<img>` con un asset PNG/JPG) porque:
 * - No introduce ningún asset binario nuevo al repositorio.
 * - Permite tintar el neumático dinámicamente según `classifyTireTemp`
 *   (banda exterior de la goma) y `classifyTireWear` (anillo interior,
 *   simulando cuánto queda de goma), usando el vocabulario `StatusLevel`
 *   compartido (`@apex/telemetry-core`, `statusVar`) para que "frío/
 *   óptimo/caliente" y "nuevo/gastado/crítico" se pinten con los MISMOS
 *   colores que el resto de la app (delta de vuelta, bloqueo de freno,
 *   banderas), en vez de un mapeo de color propio de este componente.
 *
 * El resultado sigue siendo "una imagen" en el sentido visual pedido
 * (una rueda reconocible, no una barra de progreso abstracta), solo que
 * vectorial y con datos en vivo en vez de una foto fija.
 */
export interface TireIconProps {
  temp: number;
  wear: number;
  size?: number;
}

export default function TireIcon({ temp, wear, size = 56 }: TireIconProps) {
  const tempColor = statusVar(tireTempStatusToLevel(classifyTireTemp(temp)));
  const wearColor = statusVar(tireWearStatusToLevel(classifyTireWear(wear)));

  // El anillo de "goma restante" se dibuja como un `stroke-dasharray`
  // sobre un círculo: la porción llena representa `1 - wear` (cuánto
  // queda), no `wear`, para que un neumático nuevo se vea "completo".
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
      {/* Banda exterior de la goma, tintada por temperatura. */}
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
      {/* Llanta (centro oscuro neutro). */}
      <circle cx={28} cy={28} r={16} fill="var(--card)" stroke="var(--border)" strokeWidth={1} />
      {/* Anillo de goma restante, tintado por desgaste. */}
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
      {/* Rayos de llanta, puramente decorativos (referencia visual de "rueda"). */}
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
