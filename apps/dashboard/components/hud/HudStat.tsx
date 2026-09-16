/**
 * `HudStat`: bloque de estadística compartido por los paneles del HUD
 * (meta de rediseño 8). Sustituye el patrón anterior de `Card` +
 * `CardHeader`/`CardTitle`/`CardContent` de shadcn/ui (una caja con
 * borde fino, mucho whitespace y una etiqueta + número sin jerarquía
 * fuerte) por un "stat block" de broadcast: etiqueta superior en
 * mayúsculas/tracking amplio, valor grande en `.hud-number` con
 * resplandor opcional, y una franja de acento a la izquierda en el color
 * indicado — sin introducir ninguna dependencia nueva ni tocar los
 * componentes `ui/card.tsx` originales (que otros lugares del proyecto
 * podrían seguir usando).
 *
 * Se usa en Panel_Clima y Panel_Fuel (meta de rediseño 6) para reemplazar
 * las `Card` genéricas por un tratamiento visual denso y con más
 * jerarquía, consistente entre ambos paneles.
 */
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export interface HudStatProps {
  /** Etiqueta corta en mayúsculas mostrada sobre el valor principal. */
  label: string;
  /** Contenido del valor principal (texto, ícono + texto, etc.). */
  children: ReactNode;
  /**
   * Color de acento CSS (p. ej. `var(--primary)`) usado en la franja
   * izquierda y, si `glow` es `true`, en el resplandor del valor.
   */
  accent?: string;
  /** Si es `true`, aplica `.hud-text-glow` al valor principal. */
  glow?: boolean;
  className?: string;
}

export function HudStat({
  label,
  children,
  accent = "var(--primary)",
  glow = true,
  className,
}: HudStatProps) {
  return (
    <div
      className={cn(
        "relative flex flex-col gap-1.5 overflow-hidden rounded-md border border-border bg-card py-3 pr-4 pl-4",
        className
      )}
      style={{ borderLeftColor: accent, borderLeftWidth: 3 }}
    >
      <span className="text-[11px] font-semibold tracking-[0.16em] text-muted-foreground uppercase">
        {label}
      </span>
      <div
        className={cn("hud-number text-3xl leading-none", glow && "hud-text-glow")}
        style={{ color: accent }}
      >
        {children}
      </div>
    </div>
  );
}
