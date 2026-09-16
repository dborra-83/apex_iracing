"use client";

import { useState } from "react";
import { Settings, X } from "lucide-react";
import { useThemeStore } from "@/lib/store/themeStore";
import { useLocaleStore } from "@/lib/store/localeStore";
import { useTranslation } from "@/lib/i18n/useTranslation";
import { useLayoutStore, type WidgetId } from "@/lib/store/layoutStore";
import type { Locale } from "@/lib/i18n/dictionary";
import type { DictionaryKey } from "@/lib/i18n/dictionary";

/**
 * SettingsPanel: hoja de configuración de Apex Mobile (tema, idioma, y
 * layout de widgets: modo edición + visibilidad), abierta desde un botón
 * de engranaje flotante sobre la Pantalla_Principal.
 *
 * Posición/tamaño de cada widget ya NO se configuran desde aquí: se
 * arrastran y redimensionan directamente sobre la grilla (`FreeGrid.tsx`)
 * cuando el modo "Editar layout" está activo (`useLayoutStore.isEditing`,
 * controlado por el switch de esta sección). Este panel retiene
 * únicamente lo que el drag-and-drop no puede resolver: mostrar/ocultar
 * un widget por completo, y restablecer todo el layout a los valores por
 * defecto.
 *
 * Se implementa como overlay a pantalla completa (no un modal de una
 * librería externa) que se superpone al resto de la UI sin desmontarla:
 * cerrar el panel simplemente oculta el overlay, la conexión WebSocket y
 * los stores de datos en vivo siguen intactos debajo.
 */

const WIDGET_LABEL_KEY: Record<WidgetId, DictionaryKey> = {
  speedometerGear: "widget.speedometer",
  throttleBrake: "widget.throttleBrake",
  steeringWheel: "widget.steeringWheel",
  lapTimes: "widget.lapTimes",
  sectorTimes: "widget.sectorTimes",
  positionGap: "widget.positionGap",
  fuel: "widget.fuel",
  tires: "widget.tires",
  miniMap: "widget.miniMap",
};

export default function SettingsPanel() {
  const [isOpen, setIsOpen] = useState(false);
  const { t } = useTranslation();

  const theme = useThemeStore((s) => s.theme);
  const setTheme = useThemeStore((s) => s.setTheme);
  const locale = useLocaleStore((s) => s.locale);
  const setLocale = useLocaleStore((s) => s.setLocale);
  const widgets = useLayoutStore((s) => s.widgets);
  const setVisible = useLayoutStore((s) => s.setVisible);
  const isEditing = useLayoutStore((s) => s.isEditing);
  const setEditing = useLayoutStore((s) => s.setEditing);
  const reset = useLayoutStore((s) => s.reset);

  const widgetIds = Object.keys(widgets) as WidgetId[];

  if (!isOpen) {
    return (
      <button
        type="button"
        onClick={() => setIsOpen(true)}
        className="fixed right-2 top-2 z-50 flex size-9 items-center justify-center rounded-full border border-border bg-card/90 text-muted-foreground shadow-lg"
        aria-label={t("settings.title")}
      >
        <Settings className="size-4" />
      </button>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex flex-col overflow-y-auto bg-background p-4">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="hud-number text-foreground" style={{ fontSize: "1.25rem" }}>
          {t("settings.title")}
        </h2>
        <button
          type="button"
          onClick={() => setIsOpen(false)}
          className="flex size-9 items-center justify-center rounded-full border border-border text-muted-foreground"
          aria-label={t("settings.close")}
        >
          <X className="size-4" />
        </button>
      </div>

      <section className="mb-6 flex flex-col gap-3">
        <h3 className="hud-number text-xs tracking-[0.15em] text-muted-foreground uppercase">
          {t("settings.appearance")}
        </h3>

        <div className="flex items-center justify-between">
          <span className="text-sm text-foreground">{t("settings.theme")}</span>
          <div className="flex gap-1.5 rounded-md border border-border p-0.5">
            <button
              type="button"
              onClick={() => setTheme("dark")}
              className={`rounded-sm px-3 py-1 text-xs ${
                theme === "dark" ? "bg-primary text-primary-foreground" : "text-muted-foreground"
              }`}
            >
              {t("settings.theme.dark")}
            </button>
            <button
              type="button"
              onClick={() => setTheme("light")}
              className={`rounded-sm px-3 py-1 text-xs ${
                theme === "light" ? "bg-primary text-primary-foreground" : "text-muted-foreground"
              }`}
            >
              {t("settings.theme.light")}
            </button>
          </div>
        </div>

        <div className="flex items-center justify-between">
          <span className="text-sm text-foreground">{t("settings.language")}</span>
          <div className="flex gap-1.5 rounded-md border border-border p-0.5">
            {(["es", "en"] as Locale[]).map((option) => (
              <button
                key={option}
                type="button"
                onClick={() => setLocale(option)}
                className={`rounded-sm px-3 py-1 text-xs uppercase ${
                  locale === option
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground"
                }`}
              >
                {option}
              </button>
            ))}
          </div>
        </div>
      </section>

      <section className="flex flex-1 flex-col gap-3">
        <div className="flex items-center justify-between">
          <h3 className="hud-number text-xs tracking-[0.15em] text-muted-foreground uppercase">
            {t("settings.widgets")}
          </h3>
          <button
            type="button"
            onClick={reset}
            className="text-xs text-muted-foreground underline"
          >
            {t("settings.reset")}
          </button>
        </div>

        <div className="flex flex-col gap-1 rounded-md border border-border bg-card px-3 py-2">
          <div className="flex items-center justify-between">
            <span className="text-sm text-foreground">{t("settings.layout.edit")}</span>
            <button
              type="button"
              role="switch"
              aria-checked={isEditing}
              onClick={() => setEditing(!isEditing)}
              className={`relative h-6 w-11 rounded-full transition-colors ${
                isEditing ? "bg-primary" : "bg-border"
              }`}
            >
              <span
                className={`absolute top-0.5 size-5 rounded-full bg-background transition-transform ${
                  isEditing ? "translate-x-5" : "translate-x-0.5"
                }`}
              />
            </button>
          </div>
          {isEditing && (
            <p className="text-xs text-muted-foreground">{t("settings.layout.editHint")}</p>
          )}
        </div>

        <div className="flex flex-col gap-2">
          {widgetIds.map((id) => (
            <div
              key={id}
              className="flex items-center justify-between gap-2 rounded-md border border-border bg-card px-3 py-2"
            >
              <span className="text-sm text-foreground">{t(WIDGET_LABEL_KEY[id])}</span>
              <button
                type="button"
                onClick={() => setVisible(id, !widgets[id].visible)}
                className={`rounded-sm px-2 py-1 text-[10px] uppercase ${
                  widgets[id].visible ? "text-primary" : "text-muted-foreground"
                }`}
              >
                {widgets[id].visible
                  ? t("settings.widgets.visible")
                  : t("settings.widgets.hidden")}
              </button>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
