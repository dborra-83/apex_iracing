import type { MetadataRoute } from "next";

/**
 * Web App Manifest de Apex Mobile (tarea 16.2, Requisito 8.2): permite
 * instalar la PWA en la pantalla de inicio del dispositivo del piloto.
 *
 * `display: "standalone"` oculta la UI del navegador (barra de
 * direcciones, etc.) al abrirse desde el icono instalado, reforzando la
 * estética de HUD de pantalla única (Requisito 8.1). `orientation:
 * "any"` es deliberado: a diferencia de una PWA típica que fuerza una
 * sola orientación, Apex Mobile SHALL adaptar su layout tanto a portrait
 * como a landscape (Requisito 8.3), así que el manifest no debe
 * restringir la orientación del sistema operativo.
 *
 * No se generan íconos reales (`png`) en esta tarea: `icons` queda vacío
 * a propósito para no introducir assets binarios fuera del alcance de
 * esta tarea; un manifest sin íconos sigue siendo válido y no impide que
 * el resto de la configuración PWA (Service Worker, instalación) se
 * ejercite, aunque el navegador use un ícono por defecto al instalar.
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Apex Mobile",
    short_name: "Apex Mobile",
    description:
      "Apex Mobile: pantalla única de telemetría en vivo de iRacing para el piloto",
    start_url: "/",
    display: "standalone",
    orientation: "any",
    background_color: "#0a0a0a",
    theme_color: "#0a0a0a",
    icons: [],
  };
}
