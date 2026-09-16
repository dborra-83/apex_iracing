import withSerwistInit from "@serwist/next";
import type { NextConfig } from "next";

/**
 * Configuración PWA de Apex Mobile (tarea 16.2, Requisito 8.2): registro
 * de Service Worker vía `@serwist/next`.
 *
 * Se eligió Serwist en vez de `next-pwa` (la librería mencionada en
 * design.md) porque `next-pwa` requiere el bundler Webpack para
 * construir y ya no se mantiene activamente; en Next.js 16 (usado por
 * este monorepo, ver `package.json`), Turbopack es el bundler por
 * defecto tanto en `next dev` como en `next build`, y `next-pwa` solo
 * funcionaría forzando el flag `--webpack` en todos los comandos.
 * Serwist es el sucesor directo y activamente mantenido del mismo
 * enfoque (precache + Service Worker vía Workbox), compatible con
 * Next.js 16.
 *
 * Limitación conocida (issue abierto en el repositorio de Serwist,
 * `serwist/serwist#54`): Serwist todavía inyecta su plugin vía la
 * API `webpack()` de `next.config.ts`, que Turbopack (bundler por
 * defecto desde Next.js 16, tanto en `next dev` como en `next build`)
 * rechaza explícitamente si no se elige un bundler de forma expĺicita.
 *
 * La opción `disable` de Serwist NO evita este problema: esa opción solo
 * se evalúa DENTRO de la función `webpack()` que `withSerwistInit`
 * agrega a la config (en tiempo de ejecución del build), pero la sola
 * PRESENCIA de esa función ya hace que Turbopack rechace la config antes
 * de llegar a evaluarla. Por eso:
 * - En desarrollo (`npm run dev` → `next dev`, con Turbopack), no se
 *   envuelve la config con `withSerwist` en absoluto: se exporta la
 *   config de Next.js sin modificar. La Pantalla_Principal sigue
 *   funcionando con normalidad sin Service Worker, y no tiene sentido
 *   cachear assets que cambian en cada guardado.
 * - En producción, el script `build` (ver `package.json`) invoca
 *   explícitamente `next build --webpack` para que Turbopack no
 *   intercepte el `webpack()` inyectado por Serwist; este es el mismo
 *   flag que la propia documentación de Next.js sugiere para proyectos
 *   con una configuración de Webpack explícita. El registro de Service
 *   Worker (offline/instalable) solo se activa en ese build de
 *   producción (`next build --webpack && next start`), que es cuando
 *   realmente importa para la instalación como PWA (Requisito 8.2).
 */
const nextConfig: NextConfig = {
  /* config options here */
};

const isProduction = process.env.NODE_ENV === "production";

export default isProduction
  ? withSerwistInit({
      swSrc: "app/sw.ts",
      swDest: "public/sw.js",
    })(nextConfig)
  : nextConfig;
