/**
 * `PanelHeader`: cabecera compacta y consistente para los 5 paneles del
 * Dashboard (meta de rediseño 8), con un título en `.hud-number` a la
 * izquierda y un slot opcional a la derecha para metadatos rápidos
 * (longitud del circuito, piloto observado, etc.). Reemplaza los
 * encabezados ad-hoc que cada panel construía por separado, sin alterar
 * el contenido/datos que cada panel muestra.
 */
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export interface PanelHeaderProps {
  title: string;
  meta?: ReactNode;
  className?: string;
}

export function PanelHeader({ title, meta, className }: PanelHeaderProps) {
  return (
    <div className={cn("flex items-baseline justify-between gap-4", className)}>
      <h2 className="hud-number text-lg tracking-wide text-foreground uppercase">
        {title}
      </h2>
      {meta !== undefined && (
        <span className="hud-number text-xs text-muted-foreground">{meta}</span>
      )}
    </div>
  );
}
