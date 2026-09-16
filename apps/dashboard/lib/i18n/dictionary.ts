/**
 * Diccionario de traducción del Dashboard (panel de Ajustes, selección de
 * idioma). Mismo enfoque deliberadamente simple que
 * `apps/apex-mobile/lib/i18n/dictionary.ts`: objeto plano `clave -> texto`
 * por idioma, cubriendo la UI de configuración y los nombres de panel —
 * los datos en sí (tablas de clasificación, tiempos, `driver_id`) no se
 * traducen, son datos, no texto de interfaz.
 */

export const LOCALES = ["es", "en"] as const;
export type Locale = (typeof LOCALES)[number];

export type DictionaryKey = keyof typeof dictionaries.es;

const dictionaries = {
  es: {
    "settings.title": "Ajustes",
    "settings.appearance": "Apariencia",
    "settings.theme": "Tema",
    "settings.theme.dark": "Oscuro",
    "settings.theme.light": "Claro",
    "settings.language": "Idioma",
    "settings.widgets": "Paneles",
    "settings.widgets.visible": "Visible",
    "settings.widgets.hidden": "Oculto",
    "settings.widgets.size": "Tamaño",
    "settings.widgets.size.sm": "S",
    "settings.widgets.size.md": "M",
    "settings.widgets.size.lg": "L",
    "settings.widgets.moveUp": "Subir",
    "settings.widgets.moveDown": "Bajar",
    "settings.reset": "Restablecer todo",
    "settings.close": "Cerrar",
    "widget.mapa": "Mapa",
    "widget.clasificacion": "Clasificación",
    "widget.telemetria": "Telemetría",
    "widget.neumaticos": "Neumáticos",
    "widget.volante": "Volante",
    "widget.fuel": "Fuel & Stints",
    "settings.layout.edit": "Editar layout",
    "settings.layout.editHint": "Arrastra desde el ícono superior para mover, o desde la esquina inferior para redimensionar.",
  },
  en: {
    "settings.title": "Settings",
    "settings.appearance": "Appearance",
    "settings.theme": "Theme",
    "settings.theme.dark": "Dark",
    "settings.theme.light": "Light",
    "settings.language": "Language",
    "settings.widgets": "Panels",
    "settings.widgets.visible": "Visible",
    "settings.widgets.hidden": "Hidden",
    "settings.widgets.size": "Size",
    "settings.widgets.size.sm": "S",
    "settings.widgets.size.md": "M",
    "settings.widgets.size.lg": "L",
    "settings.widgets.moveUp": "Move up",
    "settings.widgets.moveDown": "Move down",
    "settings.reset": "Reset all",
    "settings.close": "Close",
    "widget.mapa": "Track map",
    "widget.clasificacion": "Standings",
    "widget.telemetria": "Telemetry",
    "widget.neumaticos": "Tires",
    "widget.volante": "Steering wheel",
    "widget.fuel": "Fuel & Stints",
    "settings.layout.edit": "Edit layout",
    "settings.layout.editHint": "Drag from the top icon to move, or from the bottom-right corner to resize.",
  },
} as const satisfies Record<Locale, Record<string, string>>;

export function translate(locale: Locale, key: DictionaryKey): string {
  return dictionaries[locale][key];
}
