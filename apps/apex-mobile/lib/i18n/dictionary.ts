/**
 * Diccionario de traducción de Apex Mobile (panel de Ajustes, selección
 * de idioma). Deliberadamente simple: un objeto plano `clave -> texto`
 * por idioma, sin interpolación ni pluralización — la Pantalla_Principal
 * y el panel de Ajustes solo necesitan strings estáticos cortos
 * (etiquetas de widgets, opciones de configuración), no contenido rico.
 *
 * Cubre las etiquetas de la UI de configuración (panel de Ajustes) y del
 * `SessionStatusBar`/nombres de widgets, que es la superficie de texto
 * traducible identificada en esta ampliación. El resto de la pantalla
 * (valores numéricos con formato `.hud-number`, `driver_id`) no requiere
 * traducción: son datos, no texto de interfaz.
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
    "settings.widgets": "Widgets",
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
    "widget.speedometer": "Velocímetro",
    "widget.gear": "Marcha",
    "widget.throttleBrake": "Acelerador/Freno",
    "widget.steeringWheel": "Volante",
    "widget.lapTimes": "Tiempos de vuelta",
    "widget.sectorTimes": "Parciales por sector",
    "widget.positionGap": "Posición y gaps",
    "widget.fuel": "Combustible",
    "widget.tires": "Neumáticos",
    "widget.miniMap": "Mini-mapa",
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
    "settings.widgets": "Widgets",
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
    "widget.speedometer": "Speedometer",
    "widget.gear": "Gear",
    "widget.throttleBrake": "Throttle/Brake",
    "widget.steeringWheel": "Steering wheel",
    "widget.lapTimes": "Lap times",
    "widget.sectorTimes": "Sector times",
    "widget.positionGap": "Position & gaps",
    "widget.fuel": "Fuel",
    "widget.tires": "Tires",
    "widget.miniMap": "Mini-map",
    "settings.layout.edit": "Edit layout",
    "settings.layout.editHint": "Drag from the top icon to move, or from the bottom-right corner to resize.",
  },
} as const satisfies Record<Locale, Record<string, string>>;

export function translate(locale: Locale, key: DictionaryKey): string {
  return dictionaries[locale][key];
}
