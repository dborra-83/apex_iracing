/**
 * GearIndicator (tarea 19.1, Requisito 9.3): muestra la marcha actual del
 * Piloto_Observado.
 *
 * Pensado para renderizarse en el centro del `Speedometer` (ver
 * `Speedometer.tsx`), por lo que es deliberadamente minimalista: un
 * único carácter grande con la marcha, sin borde ni fondo propio.
 *
 * `gear` sigue la misma convención ya usada por el Generador_Demo
 * (`apps/generador-demo/src/simulation/events.ts`): un entero en `[1, 6]`
 * para marcha hacia adelante. `0` (punto muerto) y valores negativos
 * (reversa) se soportan defensivamente aunque el Generador_Demo actual
 * nunca los emite, mostrando "N" y "R" respectivamente en vez de un
 * número, ya que ningún piloto real interpretaría "0" o "-1" como una
 * marcha at a glance.
 */
export interface GearIndicatorProps {
  gear: number;
}

function formatGear(gear: number): string {
  if (gear === 0) return "N";
  if (gear < 0) return "R";
  return String(gear);
}

export default function GearIndicator({ gear }: GearIndicatorProps) {
  return (
    <div className="flex flex-col items-center justify-center">
      <span
        className="hud-number hud-text-glow text-foreground"
        style={{ fontSize: "clamp(2.5rem, 12vmin, 5rem)", lineHeight: 1 }}
        aria-label={`Marcha ${formatGear(gear)}`}
      >
        {formatGear(gear)}
      </span>
      <span className="hud-number text-[10px] tracking-[0.2em] text-muted-foreground uppercase">
        Marcha
      </span>
    </div>
  );
}
