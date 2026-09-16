"use client";

import { useState } from "react";
import {
  Cloud,
  CloudRain,
  CloudRainWind,
  Fuel,
  Radio,
  Settings,
  Sun,
  Thermometer,
} from "lucide-react";
import type { ComponentType, CSSProperties } from "react";
import type { WeatherV1 } from "@apex/contrato-datos";
import { deriveFuelConsumptionRate, estimateRemainingLaps } from "@apex/telemetry-core";
import { useTelemetryStore } from "@/lib/store/telemetryStore";
import { useSessionStore } from "@/lib/store/sessionStore";
import { useFuelHistory } from "@/lib/hooks/useFuelHistory";
import SettingsPanel from "@/components/SettingsPanel";

/**
 * AppHeader: barra superior delgada del Dashboard (meta de rediseño 2).
 *
 * Además del branding y el indicador de conexión ya existentes, el
 * header ahora incluye stats compactos que antes vivían en `PanelClima`
 * (temperatura de pista/ambiente, condición climática) y en `PanelFuel`
 * (combustible y vueltas restantes del PROPIO piloto observado): al
 * moverlos aquí, quedan SIEMPRE visibles (la franja superior no se
 * desplaza ni se oculta) en vez de competir por espacio dentro de la
 * grilla de paneles, liberando ese espacio para que `Panel_Fuel` (stint
 * planning multi-piloto) y el nuevo `Panel_Neumaticos` tengan más lugar.
 * `PanelClima` como panel independiente se eliminó del grid de
 * `app/page.tsx` porque toda su información ya se muestra aquí.
 *
 * Indicador de conexión: el cliente WebSocket (`lib/ws-client/client.ts`)
 * no expone su estado de conexión hacia fuera (solo `close()`), y este
 * rediseño tiene explícitamente prohibido tocar esa lógica. Por eso el
 * indicador es un punto pulsante "LIVE" siempre encendido en vez de
 * reflejar el `readyState` real del socket: visualmente comunica que el
 * Dashboard está en un HUD de sesión en vivo sin requerir cambios en el
 * cliente WebSocket ni en sus hooks de conexión.
 */

const WEATHER_ICON: Record<WeatherV1, ComponentType<{ className?: string; style?: CSSProperties }>> = {
  clear: Sun,
  cloudy: Cloud,
  light_rain: CloudRain,
  heavy_rain: CloudRainWind,
};

const WEATHER_SHORT_LABEL: Record<WeatherV1, string> = {
  clear: "Despejado",
  cloudy: "Nublado",
  light_rain: "Ll. ligera",
  heavy_rain: "Ll. intensa",
};

interface HeaderStatProps {
  icon: ComponentType<{ className?: string; style?: CSSProperties }>;
  label: string;
  value: string;
  accent?: string;
}

/** Stat compacto de una sola línea para la franja del header (ícono + etiqueta + valor), sin el tratamiento de "stat block" grande de `HudStat`. */
function HeaderStat({ icon: Icon, label, value, accent = "var(--muted-foreground)" }: HeaderStatProps) {
  return (
    <div className="hidden items-center gap-1.5 md:flex" title={label}>
      <Icon className="size-3.5" style={{ color: accent }} />
      <span className="hud-number text-xs" style={{ color: accent }}>
        {value}
      </span>
    </div>
  );
}

function formatTemp(value: number | undefined): string {
  return value === undefined ? "—" : `${value.toFixed(1)}°C`;
}

function formatRemainingLaps(remainingLaps: number): string {
  return remainingLaps === Infinity ? "—" : remainingLaps.toFixed(1);
}

export function AppHeader() {
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const telemetry = useTelemetryStore((state) => state.latestEvent);
  const session = useSessionStore((state) => state.latestEvent);
  const fuelHistory = useFuelHistory(telemetry?.fuel_level, telemetry?.last_lap_time);

  const consumptionPerLap = deriveFuelConsumptionRate(fuelHistory);
  const remainingLaps =
    telemetry === null ? null : estimateRemainingLaps(telemetry.fuel_level, consumptionPerLap);

  const WeatherIcon = session ? WEATHER_ICON[session.weather] : null;

  return (
    <header className="flex h-12 shrink-0 items-center justify-between gap-4 border-b border-border bg-card px-4">
      <div className="flex items-center gap-2.5">
        <span className="hud-number text-lg leading-none tracking-wider text-primary hud-text-glow">
          APEX
        </span>
        <span className="hidden text-[11px] font-medium uppercase tracking-[0.2em] text-muted-foreground sm:inline">
          {"// Race Engineer"}
        </span>
      </div>

      <div className="flex items-center gap-4">
        <HeaderStat
          icon={Thermometer}
          label="Temperatura de pista"
          value={formatTemp(telemetry?.track_temp)}
          accent="var(--primary)"
        />
        <HeaderStat
          icon={Thermometer}
          label="Temperatura ambiente"
          value={formatTemp(telemetry?.air_temp)}
          accent="var(--chart-3)"
        />
        {WeatherIcon !== null && session !== null && (
          <HeaderStat
            icon={WeatherIcon}
            label="Condición climática"
            value={WEATHER_SHORT_LABEL[session.weather]}
            accent="var(--accent)"
          />
        )}
        <HeaderStat
          icon={Fuel}
          label="Combustible del piloto observado"
          value={telemetry === null ? "—" : telemetry.fuel_level.toFixed(1)}
          accent="var(--primary)"
        />
        <HeaderStat
          icon={Fuel}
          label="Vueltas restantes estimadas (piloto observado)"
          value={remainingLaps === null ? "—" : formatRemainingLaps(remainingLaps)}
          accent="var(--chart-4)"
        />
      </div>

      <div className="flex items-center gap-3">
        {/*
         * En viewports muy angostos (celular en portrait) se oculta el
         * ícono de radio y el texto "LIVE", dejando solo el punto
         * pulsante: el header debe caber en una sola línea sin que el
         * indicador de conexión empuje el ícono de Ajustes fuera de
         * pantalla.
         */}
        <div className="flex items-center gap-1.5 rounded-sm border border-(--chart-4)/40 bg-(--chart-4)/10 px-2 py-0.5">
          <span className="relative flex size-2">
            <span className="absolute inline-flex size-full animate-ping rounded-full bg-(--chart-4) opacity-75" />
            <span className="relative inline-flex size-2 rounded-full bg-(--chart-4)" />
          </span>
          <Radio className="hidden size-3 text-(--chart-4) sm:inline" />
          <span className="hud-number hidden text-[11px] tracking-widest text-(--chart-4) sm:inline">
            LIVE
          </span>
        </div>

        <button
          type="button"
          onClick={() => setIsSettingsOpen(true)}
          className="flex size-7 items-center justify-center rounded-sm border border-border text-muted-foreground hover:text-foreground"
          aria-label="Ajustes"
        >
          <Settings className="size-4" />
        </button>
      </div>

      <SettingsPanel isOpen={isSettingsOpen} onClose={() => setIsSettingsOpen(false)} />
    </header>
  );
}
